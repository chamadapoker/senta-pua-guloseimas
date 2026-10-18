import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../services/api';
import { parseDataBanco, TZ_BR } from '../services/datas';
import { Icon, type IconName } from '../components/ui/Icon';
import { ESQUADRAO } from '../config/esquadrao';

interface EventoCheckin { id: string; nome: string; data: string; imagem_url: string | null; total_pagos: number; entraram: number; }
interface Resultado { estado: 'OK' | 'JA_ENTROU' | 'NAO_PAGO' | 'NAO_ENCONTRADO' | 'ERRO'; mensagem?: string; nome?: string; tipo_nome?: string | null; numero_ingresso?: number | null; checkin_at?: string; }
interface PagoItem { id: string; nome: string; numero_ingresso: number | null; tipo_nome: string | null; checkin_at: string | null; status: string; }

// Resultado da leitura em tela cheia: verde liberado, escarlate barrado, âmbar quando não deu para validar
const VISUAL: Record<string, { fundo: string; icone: string; icon: IconName; titulo: string }> = {
  OK: { fundo: 'bg-verde-escuro text-white', icone: 'bg-white text-verde-escuro', icon: 'check', titulo: 'Entrada liberada' },
  JA_ENTROU: { fundo: 'bg-escarlate text-white', icone: 'bg-white text-escarlate', icon: 'x', titulo: 'Já entrou' },
  NAO_PAGO: { fundo: 'bg-escarlate text-white', icone: 'bg-white text-escarlate', icon: 'cash', titulo: 'Pagamento pendente' },
  NAO_ENCONTRADO: { fundo: 'bg-escarlate text-white', icone: 'bg-white text-escarlate', icon: 'x', titulo: 'Ingresso inválido' },
  ERRO: { fundo: 'bg-amber-400 text-noite', icone: 'bg-noite text-amber-400', icon: 'warning', titulo: 'Não foi possível validar' },
};

// Falha de rede/sessão não é "ingresso inválido": mostra o motivo real
function resultadoDeErro(e: unknown): Resultado {
  const status = (e as { status?: number })?.status;
  let mensagem: string;
  if (status === 401) mensagem = 'Sessão expirada. Entre de novo.';
  else if (status === 403) mensagem = 'Sem permissão de recepcionista.';
  else if (status === 429) mensagem = e instanceof Error ? e.message : 'Muitas tentativas. Aguarde.';
  else if (!status) mensagem = 'Sem conexão. Verifique a internet e tente de novo.';
  else mensagem = `Erro no servidor (${status}). Tente de novo.`;
  return { estado: 'ERRO', mensagem };
}

function mensagemCamera(err: unknown): string {
  const txt = String((err as { name?: string })?.name || '') + ' ' + String((err as { message?: string })?.message || err || '');
  if (/NotAllowed|Permission|denied/i.test(txt)) {
    return 'Acesso à câmera bloqueado. Libere a permissão da câmera nas configurações do navegador e recarregue a página. Enquanto isso, use a busca por nome.';
  }
  if (typeof navigator !== 'undefined' && !navigator.mediaDevices) {
    return 'Câmera indisponível neste navegador (é preciso abrir o site em HTTPS). Use a busca por nome.';
  }
  return 'Não foi possível abrir a câmera (indisponível ou em uso por outro app). Use a busca por nome.';
}

export function CheckinRecepcionista() {
  const { eventoId } = useParams<{ eventoId?: string }>();
  const navigate = useNavigate();
  const [eventos, setEventos] = useState<EventoCheckin[]>([]);
  const [evento, setEvento] = useState<EventoCheckin | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<PagoItem[]>([]);
  const [erroBusca, setErroBusca] = useState('');
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  const [erroCamera, setErroCamera] = useState('');
  const [erroEventos, setErroEventos] = useState(false);
  const travadoRef = useRef(false);
  // Busca por nome: só aplica a resposta da última consulta (ignora respostas fora de ordem)
  const buscaSeqRef = useRef(0);

  const limpar = () => { travadoRef.current = false; setResultado(null); setUltimoId(null); };

  const carregarEventos = async () => {
    const data = await api.get<EventoCheckin[]>('/api/ximboca/checkin/eventos');
    setEventos(data);
    if (eventoId) setEvento(data.find(e => e.id === eventoId) || null);
  };

  useEffect(() => {
    setErroEventos(false);
    carregarEventos().catch(() => setErroEventos(true));
    /* eslint-disable-next-line */
  }, [eventoId]);

  const validar = async (participanteId: string) => {
    if (travadoRef.current || !eventoId) return;
    travadoRef.current = true;
    setUltimoId(participanteId);
    let d: Resultado;
    try {
      d = await api.post<Resultado>(`/api/ximboca/checkin/${eventoId}/validar`, { participante_id: participanteId });
    } catch (e) {
      d = resultadoDeErro(e);
    }
    setResultado(d);
    if (d.estado === 'OK') carregarEventos().catch(() => {});
    // Pendente fica na tela com botões (recepcionista decide). Os outros somem sozinhos.
    if (d.estado !== 'NAO_PAGO') setTimeout(limpar, 2500);
  };

  const pagarEEntrar = async () => {
    if (!ultimoId || !eventoId) return;
    try {
      const d = await api.post<Resultado>(`/api/ximboca/checkin/${eventoId}/pagar-entrar`, { participante_id: ultimoId });
      setResultado(d);
      carregarEventos().catch(() => {});
      if (busca) buscar(busca);
    } catch (e) {
      setResultado(resultadoDeErro(e));
    }
    setTimeout(limpar, 2500);
  };

  useEffect(() => {
    if (!eventoId) return;
    setErroCamera('');
    let scanner: Html5Qrcode | null = null;
    try {
      scanner = new Html5Qrcode('leitor-qr');
      scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 },
        (texto) => { validar(texto.trim()); }, () => {}).catch((err) => setErroCamera(mensagemCamera(err)));
    } catch (err) {
      setErroCamera(mensagemCamera(err));
    }
    return () => { try { scanner?.stop().catch(() => {}); } catch { /* não chegou a iniciar */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId]);

  const buscar = async (q: string) => {
    setBusca(q);
    if (!eventoId) return;
    const seq = ++buscaSeqRef.current;
    try {
      const res = await api.get<PagoItem[]>(`/api/ximboca/checkin/${eventoId}/lista?q=${encodeURIComponent(q)}`);
      if (seq !== buscaSeqRef.current) return; // já chegou/foi feita outra busca mais nova
      setLista(res);
      setErroBusca('');
    } catch {
      if (seq !== buscaSeqRef.current) return;
      setErroBusca('Erro ao buscar. Tente de novo.');
    }
  };

  // Lista de eventos (sem evento selecionado)
  if (!eventoId) {
    return (
      <div className="min-h-screen bg-noite text-white px-4 pt-6 pb-10">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <img src={ESQUADRAO.imagens.brasao_grande} alt="" width={44} height={44} className="w-11 h-11 object-contain" />
            <div>
              <h1 className="font-display text-3xl leading-none tracking-wide">Check-in</h1>
              <p className="text-sm text-noite-texto mt-0.5">Escolha o evento para ler os ingressos.</p>
            </div>
          </div>
          <div className="space-y-2">
            {erroEventos ? (
              <div className="rounded-2xl bg-noite-2 border border-noite-3 p-4 text-center">
                <p className="text-white">Não foi possível carregar os eventos.</p>
                <button
                  onClick={() => { setErroEventos(false); carregarEventos().catch(() => setErroEventos(true)); }}
                  className="mt-3 min-h-[44px] px-5 rounded-xl bg-white text-noite font-semibold inline-flex items-center gap-2"
                >
                  <Icon name="refresh" size={16} /> Tentar de novo
                </button>
              </div>
            ) : eventos.length === 0 && (
              <p className="rounded-2xl bg-noite-2 border border-noite-3 p-6 text-center text-noite-texto">Nenhum evento aberto para check-in.</p>
            )}
            {eventos.map(e => (
              <button key={e.id} onClick={() => navigate(`/checkin/${e.id}`)}
                className="w-full flex items-center gap-3 text-left bg-noite-2 hover:bg-noite-3 border border-noite-3 rounded-2xl p-4 min-h-[72px] outline-none focus-visible:ring-2 focus-visible:ring-white/60">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[17px] leading-snug">{e.nome}</div>
                  <div className="text-sm text-noite-texto mt-0.5">Entraram {e.entraram} de {e.total_pagos}</div>
                </div>
                <Icon name="chevron-right" size={20} className="text-noite-texto" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const visual = resultado ? VISUAL[resultado.estado] ?? VISUAL.ERRO : null;

  return (
    <div className="min-h-screen bg-noite text-white px-4 pt-4 pb-10">
      <div className="max-w-md mx-auto">
        <button onClick={() => navigate('/checkin')} className="inline-flex items-center gap-1.5 min-h-[44px] -ml-1 px-1 text-sm font-medium text-noite-texto hover:text-white">
          <Icon name="arrow-left" size={18} /> Eventos
        </button>
        <div className="flex items-end justify-between gap-3 mb-4">
          <h1 className="font-display text-3xl leading-none tracking-wide min-w-0">{evento?.nome || 'Check-in'}</h1>
          <div className="text-right shrink-0">
            <div className="font-display text-4xl leading-none tabular-nums">
              {evento?.entraram ?? 0}<span className="text-noite-fraco">/{evento?.total_pagos ?? 0}</span>
            </div>
            <div className="text-xs text-noite-texto">entraram</div>
          </div>
        </div>

        <div id="leitor-qr" className="w-full rounded-2xl overflow-hidden mb-4 bg-black/30" />
        {erroCamera && (
          <p role="alert" className="text-sm text-amber-100 bg-amber-900/40 border border-amber-600 rounded-xl px-3 py-2.5 mb-4">{erroCamera}</p>
        )}

        <div>
          <label htmlFor="checkin-busca" className="block text-sm text-noite-texto mb-1.5">Não leu? Busque pelo nome</label>
          <input
            id="checkin-busca"
            type="search"
            value={busca}
            onChange={e => buscar(e.target.value)}
            placeholder="Nome do participante"
            autoCapitalize="characters"
            autoCorrect="off"
            className="w-full bg-noite-2 border border-noite-3 rounded-xl px-4 py-3 text-base text-white placeholder:text-noite-fraco mb-2 outline-none focus:ring-2 focus:ring-white/40"
          />
          {erroBusca && <p role="alert" className="text-red-300 text-sm mb-2">{erroBusca}</p>}
          <ul className="space-y-1.5">
            {lista.map(p => (
              <li key={p.id}>
                <button onClick={() => validar(p.id)} disabled={!!p.checkin_at}
                  className={`w-full min-h-[48px] flex items-center justify-between gap-3 px-4 rounded-xl text-left ${p.checkin_at ? 'bg-noite-2 text-noite-fraco' : 'bg-noite-3 hover:bg-faixa text-white'}`}>
                  <span className="min-w-0 truncate">{p.nome}{p.tipo_nome ? ` · ${p.tipo_nome}` : ''}</span>
                  <span className={`shrink-0 text-sm font-medium ${p.checkin_at ? 'text-green-300' : p.status === 'pago' ? 'text-white' : 'text-amber-300'}`}>
                    {p.checkin_at ? 'Já entrou' : p.status === 'pago' ? `#${String(p.numero_ingresso ?? 0).padStart(3, '0')}` : 'Pendente'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {resultado && visual && (
        <div role="alertdialog" aria-live="assertive" aria-label={visual.titulo}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center text-center px-6 ${visual.fundo}`}>
          <span className={`w-24 h-24 rounded-full flex items-center justify-center mb-5 ${visual.icone}`}>
            <Icon name={visual.icon} size={56} strokeWidth={2.5} />
          </span>
          <div className="font-display text-6xl leading-none tracking-wide">{visual.titulo}</div>
          {resultado.nome && <div className="text-3xl font-semibold mt-4">{resultado.nome}</div>}
          {resultado.mensagem && <div className="text-xl mt-3 max-w-sm">{resultado.mensagem}</div>}
          {(resultado.tipo_nome || resultado.numero_ingresso != null) && (
            <div className="text-xl mt-2 opacity-90">
              {resultado.tipo_nome}{resultado.tipo_nome && resultado.numero_ingresso != null ? ' · ' : ''}
              {resultado.numero_ingresso != null && `#${String(resultado.numero_ingresso).padStart(3, '0')}`}
            </div>
          )}
          {resultado.checkin_at && <div className="text-lg opacity-90 mt-2">às {parseDataBanco(resultado.checkin_at).toLocaleTimeString('pt-BR', { timeZone: TZ_BR, hour: '2-digit', minute: '2-digit' })}</div>}
          {resultado.estado === 'NAO_PAGO' && (
            <div className="mt-10 flex flex-col gap-3 w-full max-w-xs">
              <button onClick={pagarEEntrar}
                className="min-h-[56px] bg-white text-escarlate font-bold text-base rounded-2xl active:scale-[0.98] transition-transform">
                Recebi o pagamento, liberar entrada
              </button>
              <button onClick={limpar} className="min-h-[48px] rounded-2xl border-2 border-white/80 text-white font-semibold">Fechar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
