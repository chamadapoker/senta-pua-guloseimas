import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useAuth, useAcessoAdmin } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';
import { useComprovantesPendentes } from '../hooks/useComprovantesPendentes';
import { Icon } from './ui/Icon';
import { itensBottomNav } from '../config/bottomNav';

// Barra flutuante do mobile: 60px de altura + área segura (a classe .acima-nav depende dessa medida)
export function BottomNav({ onAbrirMenu }: { onAbrirMenu: () => void }) {
  const { pathname } = useLocation();
  const { token: adminToken } = useAuth();
  const { user, token: userToken } = useUserAuth();
  const isAdmin = !!adminToken;
  const isUser = !!(userToken || user);
  const { acessoRestritoCafe: restritoCafe, carregando: carregandoAdmin } = useAcessoAdmin();
  const compPendentes = useComprovantesPendentes(isAdmin);

  const itens = useMemo(
    () => itensBottomNav(pathname, { isAdmin, isUser, restritoCafe, carregandoAdmin }),
    [pathname, isAdmin, isUser, restritoCafe, carregandoAdmin]
  );

  // Item ativo = correspondência exata; senão o prefixo mais longo (ex: /admin/clientes/:id).
  // Compara só o caminho (alguns itens levam ?sala=graduado).
  const activeTo = useMemo(() => {
    const caminho = (to: string) => to.split('?')[0];
    const exato = itens.find((i) => caminho(i.to) === pathname);
    if (exato) return exato.to;
    const prefixos = itens
      .filter((i) => pathname.startsWith(caminho(i.to) + '/'))
      .sort((a, b) => caminho(b.to).length - caminho(a.to).length);
    return prefixos[0]?.to ?? null;
  }, [itens, pathname]);

  const celula = 'relative flex flex-col items-center justify-center gap-1 h-full text-[11px] font-medium outline-none focus-visible:bg-noite-2 rounded-xl transition-colors';

  return (
    <nav aria-label="Navegação rápida" className="lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-safe pointer-events-none">
      <div
        className="pointer-events-auto mx-auto max-w-md h-[60px] grid bg-noite rounded-2xl shadow-flutua ring-1 ring-white/5 px-1"
        style={{ gridTemplateColumns: `repeat(${itens.length + 1}, minmax(0, 1fr))` }}
      >
        {itens.map((item) => {
          const ativo = item.to === activeTo;
          const n = isAdmin && item.to === '/admin/comprovantes' ? compPendentes : 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={ativo ? 'page' : undefined}
              className={`${celula} ${ativo ? 'text-white' : 'text-noite-fraco active:text-white'}`}
            >
              {ativo && <span className="flamula-v absolute top-0 w-6 h-[7px] bg-escarlate" aria-hidden="true" />}
              <span className="relative">
                <Icon name={item.icon as never} size={22} />
                {n > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-escarlate text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-noite">
                    {n > 99 ? '99+' : n}
                  </span>
                )}
              </span>
              <span className="truncate max-w-[72px]">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={onAbrirMenu}
          className={`${celula} text-noite-fraco active:text-white`}
          aria-label="Abrir menu completo"
        >
          <Icon name="menu" size={22} />
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
