import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from '../services/api';

interface EventoCheckin { id: string; nome: string; data: string; imagem_url: string | null; total_pagos: number; entraram: number; }
interface Resultado { estado: 'OK' | 'JA_ENTROU' | 'NAO_PAGO' | 'NAO_ENCONTRADO'; nome?: string; tipo_nome?: string | null; numero_ingresso?: number | null; checkin_at?: string; }
interface PagoItem { id: string; nome: string; numero_ingresso: number | null; tipo_nome: string | null; checkin_at: string | null; status: string; }

const CORES: Record<string, string> = { OK: 'bg-green-600', JA_ENTROU: 'bg-amber-500', NAO_PAGO: 'bg-red-600', NAO_ENCONTRADO: 'bg-red-600' };
const TITULOS: Record<string, string> = { OK: 'ENTROU', JA_ENTROU: 'JÁ ENTROU', NAO_PAGO: 'PAGAMENTO PENDENTE', NAO_ENCONTRADO: 'INGRESSO INVÁLIDO' };

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
  const travadoRef = useRef(false);

  const limpar = () => { travadoRef.current = false; setResultado(null); setUltimoId(null); };

  const carregarEventos = async () => {
    const data = await api.get<EventoCheckin[]>('/api/ximboca/checkin/eventos');
    setEventos(data);
    if (eventoId) setEvento(data.find(e => e.id === eventoId) || null);
  };

  useEffect(() => { carregarEventos().catch(() => {}); /* eslint-disable-next-line */ }, [eventoId]);

  const validar = async (participanteId: string) => {
    if (travadoRef.current || !eventoId) return;
    travadoRef.current = true;
    setUltimoId(participanteId);
    let d: Resultado;
    try {
      d = await api.post<Resultado>(`/api/ximboca/checkin/${eventoId}/validar`, { participante_id: participanteId });
    } catch {
      d = { estado: 'NAO_ENCONTRADO' };
    }
    setResultado(d);
    if (d.estado === 'OK') carregarEventos();
    // Pendente fica na tela com botões (recepcionista decide). Os outros somem sozinhos.
    if (d.estado !== 'NAO_PAGO') setTimeout(limpar, 2500);
  };

  const pagarEEntrar = async () => {
    if (!ultimoId || !eventoId) return;
    try {
      const d = await api.post<Resultado>(`/api/ximboca/checkin/${eventoId}/pagar-entrar`, { participante_id: ultimoId });
      setResultado(d);
      carregarEventos();
      if (busca) buscar(busca);
    } catch {
      setResultado({ estado: 'NAO_ENCONTRADO' });
    }
    setTimeout(limpar, 2500);
  };

  useEffect(() => {
    if (!eventoId) return;
    const scanner = new Html5Qrcode('leitor-qr');
    scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 },
      (texto) => { validar(texto.trim()); }, () => {}).catch(() => {});
    return () => { scanner.stop().catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId]);

  const buscar = async (q: string) => {
    setBusca(q);
    if (!eventoId) return;
    try {
      const res = await api.get<PagoItem[]>(`/api/ximboca/checkin/${eventoId}/lista?q=${encodeURIComponent(q)}`);
      setLista(res);
      setErroBusca('');
    } catch {
      setErroBusca('Erro ao buscar. Tente de novo.');
    }
  };

  // Lista de eventos (sem evento selecionado)
  if (!eventoId) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <h1 className="font-display text-xl tracking-wider text-center mb-4">Check-in</h1>
        <div className="max-w-sm mx-auto space-y-2">
          {eventos.length === 0 && <p className="text-center text-gray-400">Nenhum evento aberto.</p>}
          {eventos.map(e => (
            <button key={e.id} onClick={() => navigate(`/checkin/${e.id}`)}
              className="w-full text-left bg-gray-800 hover:bg-gray-700 rounded-xl p-4">
              <div className="font-display tracking-wider">{e.nome}</div>
              <div className="text-sm text-gray-400">Entraram: {e.entraram}/{e.total_pagos}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <button onClick={() => navigate('/checkin')} className="text-sm text-gray-400 mb-2">‹ Eventos</button>
      <h1 className="font-display text-xl tracking-wider text-center">{evento?.nome || 'Check-in'}</h1>
      <p className="text-center text-lg mb-4">Entraram: <span className="font-bold text-green-400">{evento?.entraram ?? 0}/{evento?.total_pagos ?? 0}</span></p>

      <div id="leitor-qr" className="w-full max-w-sm mx-auto rounded-xl overflow-hidden mb-4" />

      {resultado && (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center text-center ${CORES[resultado.estado]}`}>
          <div className="text-4xl font-display tracking-wider mb-2">{TITULOS[resultado.estado]}</div>
          {resultado.nome && <div className="text-2xl">{resultado.nome}</div>}
          {resultado.tipo_nome && <div className="text-lg opacity-90">{resultado.tipo_nome}</div>}
          {resultado.numero_ingresso != null && <div className="text-lg opacity-90">#{String(resultado.numero_ingresso).padStart(3, '0')}</div>}
          {resultado.checkin_at && <div className="text-sm opacity-80 mt-2">às {new Date(resultado.checkin_at + 'Z').toLocaleTimeString('pt-BR')}</div>}
          {resultado.estado === 'NAO_PAGO' && (
            <div className="mt-8 flex flex-col gap-3 w-full max-w-xs px-6">
              <button onClick={pagarEEntrar}
                className="bg-white text-red-700 font-bold py-3.5 rounded-2xl shadow-lg active:scale-[0.98] transition-transform">
                Recebi o pagamento — liberar entrada
              </button>
              <button onClick={limpar} className="text-white/90 underline text-sm py-1">Fechar</button>
            </div>
          )}
        </div>
      )}

      <div className="max-w-sm mx-auto">
        <div className="text-xs text-gray-400 mb-1">Não leu? Busque pelo nome:</div>
        <input value={busca} onChange={e => buscar(e.target.value)} placeholder="Nome do participante"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-2" />
        {erroBusca && <p className="text-red-400 text-xs mb-2">{erroBusca}</p>}
        <div className="space-y-1">
          {lista.map(p => (
            <button key={p.id} onClick={() => validar(p.id)} disabled={!!p.checkin_at}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${p.checkin_at ? 'bg-gray-800 text-gray-500' : 'bg-gray-700 hover:bg-gray-600'}`}>
              <span>{p.nome} {p.tipo_nome ? `· ${p.tipo_nome}` : ''}</span>
              <span className={p.checkin_at ? 'text-green-400' : p.status === 'pago' ? '' : 'text-amber-400'}>
                {p.checkin_at ? 'entrou ✓' : p.status === 'pago' ? `#${String(p.numero_ingresso ?? 0).padStart(3, '0')}` : 'pendente'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
