import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { dataLocal } from '../services/periodo';
import { formatarDataBanco } from '../services/datas';
import { useCopiar } from '../hooks/useCopiar';
import { ESQUADRAO } from '../config/esquadrao';

const BASE = import.meta.env.VITE_WORKER_URL || '';
const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  return url ? (url.startsWith('/api') ? `${WORKER_URL}${url}` : url) : null;
}

interface IngressoTipo { id: string; nome: string; valor: number; ordem: number; }
interface EventoAberto {
  id: string; nome: string; data: string; descricao: string;
  imagem_url: string | null; status: string; valor_por_pessoa: number;
  valor_cerveja: number | null; valor_refri: number | null;
  inscricao_ate: string | null;
  tipos: IngressoTipo[]; total_participantes: number;
}

function formatData(iso: string): string {
  return formatarDataBanco(iso, { day: '2-digit', month: 'long', year: 'numeric' });
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Moldura da página pública: fundo azul-noite com o brasão
function Moldura({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-noite px-4 pt-6 pb-10">
      <Link to="/" className="flex items-center justify-center gap-2.5 mb-5 outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-xl" aria-label={`${ESQUADRAO.nome}, ir para o início`}>
        <img src={ESQUADRAO.imagens.brasao_grande} alt="" width={40} height={40} className="w-10 h-10 object-contain" />
        <span className="font-display text-2xl leading-none text-white tracking-[0.08em]">{ESQUADRAO.nome}</span>
      </Link>
      <main className="max-w-md mx-auto bg-white rounded-2xl overflow-hidden shadow-flutua">{children}</main>
    </div>
  );
}

export function EventoPublicoShare() {
  const { id } = useParams<{ id: string }>();
  const [evento, setEvento] = useState<EventoAberto | null>(null);
  const [erro, setErro] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const { copiar, modalCopiaManual } = useCopiar();

  const carregar = useCallback(() => {
    setErro(false);
    fetch(`${BASE}/api/ximboca/publico/evento/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setEvento)
      .catch(() => setErro(true));
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  const url = typeof window !== 'undefined' ? window.location.href : '';
  const texto = evento ? `${evento.nome} — ${formatData(evento.data)}. Bora?` : '';

  const copiarLink = async () => {
    if (!(await copiar(url))) return;
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };
  const compartilharNativo = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: evento?.nome, text: texto, url }); } catch { /* cancelado */ }
    } else {
      copiarLink();
    }
  };

  const share = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(texto + ' ' + url)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(texto)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  };

  if (erro) {
    return (
      <Moldura>
        <div className="p-6 text-center">
          <h1 className="font-display text-3xl text-noite tracking-wide leading-none">Evento não encontrado</h1>
          <p className="text-sm text-texto-fraco mt-2">O link pode estar errado ou o evento foi removido. Se a conexão caiu, tente de novo.</p>
          <div className="flex flex-col gap-2 mt-5">
            <button onClick={carregar} className="min-h-[44px] rounded-xl border border-borda font-medium hover:bg-fundo-elevado inline-flex items-center justify-center gap-2">
              <Icon name="refresh" size={16} /> Tentar de novo
            </button>
            <Link to="/" className="min-h-[44px] inline-flex items-center justify-center text-sm text-azul underline underline-offset-2">Ir para o início</Link>
          </div>
        </div>
      </Moldura>
    );
  }
  if (!evento) {
    return (
      <Moldura>
        <div role="status" className="p-10 flex flex-col items-center gap-3 text-texto-fraco">
          <span className="w-8 h-8 rounded-full border-[3px] border-borda border-t-destaque animate-spin" aria-hidden="true" />
          <span className="text-sm">Carregando evento...</span>
        </div>
      </Moldura>
    );
  }

  const capa = resolveImg(evento.imagem_url);
  const hojeBRT = dataLocal(new Date());
  const prazoEncerrado = !!evento.inscricao_ate && hojeBRT > evento.inscricao_ate;
  const encerrado = evento.status !== 'aberto' || prazoEncerrado;
  const dia = formatarDataBanco(evento.data, { day: '2-digit' });
  const mes = formatarDataBanco(evento.data, { month: 'short' }).replace('.', '');
  const linkCls = 'min-h-[44px] inline-flex items-center justify-center gap-2 px-3 rounded-xl border border-borda bg-white text-sm font-medium hover:bg-fundo-elevado outline-none focus-visible:ring-2 focus-visible:ring-azul/40';

  return (
    <Moldura>
      {capa && <img src={capa} alt="" className="w-full object-cover max-h-72" />}
      <div className="h-1.5 bg-destaque" aria-hidden="true" />

      <div className="p-5 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-16 shrink-0 rounded-xl bg-noite text-white text-center py-2">
            <div className="font-display text-4xl leading-none">{dia}</div>
            <div className="text-xs font-semibold capitalize text-noite-texto mt-0.5">{mes}</div>
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[2rem] leading-none text-noite tracking-wide">{evento.nome}</h1>
            <p className="text-sm text-texto-fraco mt-1.5">{formatData(evento.data)}</p>
          </div>
        </div>

        {evento.inscricao_ate && !prazoEncerrado && (
          <p className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <Icon name="clock" size={16} /> Inscrições até {formatData(evento.inscricao_ate)}
          </p>
        )}

        {evento.descricao && <p className="text-[15px] text-texto leading-relaxed">{evento.descricao}</p>}

        {evento.tipos.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-noite mb-2">Ingressos</h2>
            <ul className="rounded-xl border border-borda divide-y divide-borda">
              {evento.tipos.map(t => (
                <li key={t.id} className="flex items-center justify-between px-4 py-3">
                  <span className="font-medium">{t.nome}</span>
                  <span className="font-display text-xl leading-none tracking-wide text-noite">{brl(t.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {encerrado ? (
          <p className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center text-sm text-amber-800">
            As inscrições deste evento estão encerradas.
          </p>
        ) : (
          <Link to="/ximboca"
            className="flex items-center justify-center w-full min-h-[52px] bg-destaque text-destaque-texto font-semibold text-base rounded-xl hover:brightness-90 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-destaque/40 focus-visible:ring-offset-2">
            Quero participar
          </Link>
        )}
        <p className="text-center text-sm text-texto-fraco -mt-2">
          {evento.total_participantes} {evento.total_participantes === 1 ? 'pessoa já confirmou' : 'pessoas já confirmaram'}
        </p>

        <div className="border-t border-borda pt-4">
          <h2 className="text-sm font-semibold text-noite mb-3">Chame a turma</h2>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={compartilharNativo} className="col-span-2 min-h-[44px] inline-flex items-center justify-center gap-2 px-3 rounded-xl bg-noite text-white text-sm font-medium hover:bg-noite-2 outline-none focus-visible:ring-2 focus-visible:ring-azul/40">
              <Icon name="megaphone" size={16} /> Compartilhar
            </button>
            <a href={share.whatsapp} target="_blank" rel="noopener noreferrer" className={linkCls}>WhatsApp</a>
            <a href={share.telegram} target="_blank" rel="noopener noreferrer" className={linkCls}>Telegram</a>
            <a href={share.facebook} target="_blank" rel="noopener noreferrer" className={linkCls}>Facebook</a>
            <button onClick={copiarLink} className={linkCls}>
              <Icon name={copiado ? 'check' : 'document'} size={16} /> {copiado ? 'Link copiado' : 'Copiar link'}
            </button>
          </div>
        </div>
      </div>
      {modalCopiaManual}
    </Moldura>
  );
}
