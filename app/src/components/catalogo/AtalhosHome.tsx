import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../ui/Icon';
import { ESQUADRAO, ALT_BRASAO } from '../../config/esquadrao';

const ATALHOS: { to: string; icon: IconName; titulo: string; texto: string }[] = [
  { to: '/catalogo/oficiais', icon: 'cutlery', titulo: 'Cantina dos Oficiais', texto: 'Lanches e bebidas da sala dos oficiais' },
  { to: '/catalogo/graduados', icon: 'soda', titulo: 'Cantina dos Graduados', texto: 'Lanches e bebidas da sala dos graduados' },
  { to: '/loja', icon: 'bag', titulo: 'Loja', texto: 'Produtos com a marca do esquadrão' },
  { to: '/cafe', icon: 'coffee', titulo: 'Café', texto: 'Caixinha do café: mensalidade e pagamento' },
  { to: '/ximboca', icon: 'fire', titulo: 'Ximboca', texto: 'Eventos do esquadrão e sua participação' },
];

// Atalhos grandes da página inicial (logado ou não)
export function AtalhosHome() {
  return (
    <nav aria-label="Atalhos" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
      {ATALHOS.map((a) => (
        <Link
          key={a.to}
          to={a.to}
          className="group flex items-center gap-3.5 bg-white border border-borda rounded-2xl p-3.5 sm:p-4 min-h-[72px] hover:border-azul/60 active:scale-[0.99] transition-[border-color,transform] outline-none focus-visible:ring-2 focus-visible:ring-azul/40"
        >
          <span className="w-12 h-12 shrink-0 rounded-xl bg-noite text-white flex items-center justify-center">
            <Icon name={a.icon} size={22} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-texto leading-tight">{a.titulo}</span>
            <span className="block text-sm text-texto-fraco mt-0.5 leading-snug">{a.texto}</span>
          </span>
          <Icon name="chevron-right" size={18} className="shrink-0 text-texto-fraco group-hover:text-azul transition-colors" />
        </Link>
      ))}
    </nav>
  );
}

// Faixa de identidade do topo da página inicial: brasão, nome do esquadrão e uma linha
export function HeroSentaPua({ linha, children }: { linha: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden bg-noite text-white rounded-2xl px-5 py-6 sm:px-7 sm:py-8 mb-5">
      <div className="flex items-center gap-4 sm:gap-6">
        <img src={ESQUADRAO.imagens.brasao_grande} alt={ALT_BRASAO} width={96} height={96} className="w-[72px] h-[72px] sm:w-24 sm:h-24 object-contain shrink-0" />
        <div className="min-w-0">
          <p className="font-display text-[2.75rem] sm:text-6xl leading-[0.9] tracking-[0.04em]">{ESQUADRAO.nome}</p>
          <span className="flamula-sm block w-12 h-1.5 bg-destaque mt-2" aria-hidden="true" />
          <p className="text-[15px] text-noite-texto mt-2.5 leading-snug">{linha}</p>
        </div>
      </div>
      {children && <div className="mt-5">{children}</div>}
    </section>
  );
}
