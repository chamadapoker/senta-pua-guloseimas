import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';
import { Icon } from './ui/Icon';
import { itensBottomNav } from '../config/bottomNav';

export function BottomNav({ onAbrirMenu }: { onAbrirMenu: () => void }) {
  const { pathname } = useLocation();
  const { token: adminToken } = useAuth();
  const { user, token: userToken } = useUserAuth();
  const isAdmin = !!adminToken;
  const isUser = !!(userToken || user);

  const itens = useMemo(
    () => itensBottomNav(pathname, { isAdmin, isUser }),
    [pathname, isAdmin, isUser]
  );

  // Item ativo = correspondência exata; senão o prefixo mais longo (ex: /admin/clientes/:id)
  const activeTo = useMemo(() => {
    const exato = itens.find((i) => i.to === pathname);
    if (exato) return exato.to;
    const prefixos = itens
      .filter((i) => pathname.startsWith(i.to + '/'))
      .sort((a, b) => b.to.length - a.to.length);
    return prefixos[0]?.to ?? null;
  }, [itens, pathname]);

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-borda shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${itens.length + 1}, minmax(0, 1fr))` }}
      >
        {itens.map((item) => {
          const ativo = item.to === activeTo;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                ativo ? 'text-azul' : 'text-texto-fraco'
              }`}
            >
              <Icon name={item.icon as never} size={22} />
              <span className="truncate max-w-[68px]">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={onAbrirMenu}
          className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-texto-fraco"
          aria-label="Abrir menu"
        >
          <Icon name="menu" size={22} />
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
