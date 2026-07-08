import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';

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
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function EventoPublicoShare() {
  const { id } = useParams<{ id: string }>();
  const [evento, setEvento] = useState<EventoAberto | null>(null);
  const [erro, setErro] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/ximboca/publico/evento/${id}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setEvento)
      .catch(() => setErro(true));
  }, [id]);

  const url = typeof window !== 'undefined' ? window.location.href : '';
  const texto = evento ? `${evento.nome} — ${formatData(evento.data)}. Bora?` : '';

  const compartilharNativo = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: evento?.nome, text: texto, url }); } catch { /* cancelado */ }
    } else {
      copiarLink();
    }
  };
  const copiarLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const share = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(texto + ' ' + url)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(texto)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  };

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-fundo p-6 text-center">
        <div>
          <div className="font-display text-2xl text-azul tracking-wider mb-2">Evento não encontrado</div>
          <Link to="/" className="text-azul hover:underline text-sm">Ir para o início</Link>
        </div>
      </div>
    );
  }
  if (!evento) return <div className="min-h-screen flex items-center justify-center text-texto-fraco bg-fundo">Carregando...</div>;

  const capa = resolveImg(evento.imagem_url);
  const hojeBRT = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const prazoEncerrado = !!evento.inscricao_ate && hojeBRT > evento.inscricao_ate;
  const encerrado = evento.status !== 'aberto' || prazoEncerrado;

  return (
    <div className="min-h-screen bg-fundo">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-sm">
        {/* Capa */}
        {capa ? (
          <div className="relative">
            <img src={capa} alt={evento.nome} className="w-full object-cover max-h-72" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h1 className="font-display text-3xl text-white tracking-wider leading-tight drop-shadow">{evento.nome}</h1>
            </div>
          </div>
        ) : (
          <div className="bg-azul p-6 text-center">
            <img src="/logo.png" alt="" className="w-12 h-12 object-contain mx-auto mb-2" />
            <h1 className="font-display text-3xl text-white tracking-wider">{evento.nome}</h1>
          </div>
        )}

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-2 text-sm text-texto-fraco">
            <Icon name="clock" size={16} className="text-azul" />
            <span className="capitalize font-medium text-texto">{formatData(evento.data)}</span>
          </div>
          {evento.inscricao_ate && !prazoEncerrado && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Icon name="alarm" size={14} /> Inscrições até {formatData(evento.inscricao_ate)}
            </div>
          )}

          {evento.descricao && <p className="text-sm text-texto leading-relaxed">{evento.descricao}</p>}

          {/* Ingressos */}
          {evento.tipos.length > 0 && (
            <div>
              <div className="text-xs font-bold text-texto-fraco uppercase tracking-wider mb-2">Ingressos</div>
              <div className="space-y-2">
                {evento.tipos.map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-fundo rounded-xl px-4 py-3 border border-borda">
                    <span className="font-medium">{t.nome}</span>
                    <span className="font-display text-lg text-azul">R$ {t.valor.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          {encerrado ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center text-sm text-amber-800">
              As inscrições deste evento estão encerradas.
            </div>
          ) : (
            <Link to="/ximboca"
              className="block w-full text-center bg-azul text-white font-bold tracking-widest py-4 rounded-2xl shadow-lg shadow-azul/20 hover:bg-azul-claro transition-colors">
              QUERO PARTICIPAR
            </Link>
          )}
          <p className="text-center text-xs text-texto-fraco">{evento.total_participantes} pessoa(s) já confirmaram</p>

          {/* Compartilhar */}
          <div className="border-t border-borda pt-4">
            <div className="text-xs font-bold text-texto-fraco uppercase tracking-wider mb-3 text-center">Compartilhar</div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button onClick={compartilharNativo} title="Compartilhar"
                className="w-11 h-11 rounded-full bg-azul text-white flex items-center justify-center hover:bg-azul-claro transition-colors">
                <Icon name="megaphone" size={18} />
              </button>
              <a href={share.whatsapp} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                className="w-11 h-11 rounded-full bg-green-50 text-verde-escuro border border-green-200 flex items-center justify-center hover:bg-green-100 transition-colors">
                <Icon name="device-phone" size={18} />
              </a>
              <a href={share.telegram} target="_blank" rel="noopener noreferrer" title="Telegram"
                className="w-11 h-11 rounded-full bg-blue-50 text-azul border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors">
                <Icon name="paper-clip" size={18} />
              </a>
              <a href={share.facebook} target="_blank" rel="noopener noreferrer" title="Facebook"
                className="w-11 h-11 rounded-full bg-blue-50 text-azul border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors">
                <Icon name="users" size={18} />
              </a>
              <button onClick={copiarLink} title="Copiar link"
                className="w-11 h-11 rounded-full bg-fundo border border-borda text-texto-fraco flex items-center justify-center hover:bg-fundo-elevado transition-colors">
                <Icon name={copiado ? 'check' : 'document'} size={18} />
              </button>
            </div>
            {copiado && <p className="text-center text-xs text-verde mt-2">Link copiado!</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
