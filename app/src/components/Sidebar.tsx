import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  children?: { to: string; label: string }[];
}

const VISITOR_NAV: NavItem[] = [
  { to: '/', label: 'Catálogo', icon: '🛒' },
  { to: '/loja', label: 'Loja', icon: '🎖️' },
  { to: '/cafe', label: 'Café', icon: '☕' },
];

const USER_NAV: NavItem[] = [
  { to: '/', label: 'Catálogo', icon: '🛒' },
  { to: '/loja', label: 'Loja', icon: '🎖️' },
  { to: '/cafe', label: 'Café', icon: '☕' },
  { to: '/perfil', label: 'Meu Perfil', icon: '👤' },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Guloseimas', icon: '🍬', children: [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/pedidos', label: 'Pedidos' },
    { to: '/admin/produtos', label: 'Produtos' },
    { to: '/admin/clientes', label: 'Militares' },
    { to: '/admin/relatorios', label: 'Relatórios' },
  ]},
  { to: '/admin/loja', label: 'Loja', icon: '🎖️', children: [
    { to: '/admin/loja', label: 'Dashboard' },
    { to: '/admin/loja/pedidos', label: 'Pedidos' },
    { to: '/admin/loja/produtos', label: 'Produtos' },
  ]},
  { to: '/admin/cafe', label: 'Café', icon: '☕', children: [
    { to: '/admin/cafe', label: 'Dashboard' },
    { to: '/admin/cafe/mensalidades', label: 'Mensalidades' },
    { to: '/admin/cafe/insumos', label: 'Insumos' },
    { to: '/admin/cafe/assinantes', label: 'Assinantes' },
  ]},
  { to: '/admin/ximboca', label: 'Ximboca', icon: '🍖', children: [
    { to: '/admin/ximboca', label: 'Dashboard' },
    { to: '/admin/ximboca/eventos', label: 'Eventos' },
    { to: '/admin/ximboca/estoque', label: 'Estoque' },
  ]},
  { to: '/admin/config', label: 'Configurações', icon: '⚙️' },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const { token: adminToken, logout: adminLogout } = useAuth();
  const { user, logout: userLogout } = useUserAuth();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const isAdmin = !!adminToken;
  const isUser = !!user;

  const nav = isAdmin ? ADMIN_NAV : isUser ? USER_NAV : VISITOR_NAV;

  // Close mobile sidebar on navigation
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleMenu = (key: string) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isActive = (to: string) => location.pathname === to;
  const isInSection = (item: NavItem) =>
    location.pathname === item.to || !!item.children?.some(c => location.pathname === c.to);

  const sidebarWidth = collapsed ? 'w-16' : 'w-64';

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={`fixed top-0 left-0 h-full bg-white border-r border-borda z-50 flex flex-col transition-all duration-300
        ${sidebarWidth}
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo + collapse toggle */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-borda">
          {!collapsed ? (
            <Link to={isAdmin ? '/admin' : '/'} className="flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
              <span className="font-display text-azul text-lg tracking-wider">APP RP</span>
            </Link>
          ) : (
            <Link to={isAdmin ? '/admin' : '/'} className="mx-auto">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            </Link>
          )}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex w-7 h-7 items-center justify-center rounded-lg hover:bg-fundo text-texto-fraco"
            title={collapsed ? 'Expandir' : 'Recolher'}
          >
            <svg className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {nav.map((item) => (
            <div key={item.to}>
              {item.children ? (
                <>
                  <button
                    onClick={() => toggleMenu(item.to)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5
                      ${isInSection(item) ? 'bg-azul/10 text-azul' : 'text-texto-fraco hover:bg-fundo hover:text-texto'}
                    `}
                  >
                    <span className="text-base flex-shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        <svg className={`w-4 h-4 transition-transform ${openMenus[item.to] || isInSection(item) ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                  {!collapsed && (openMenus[item.to] || isInSection(item)) && (
                    <div className="ml-8 space-y-0.5 mb-1">
                      {item.children.map(child => (
                        <Link
                          key={child.to}
                          to={child.to}
                          className={`block px-3 py-2 rounded-lg text-sm transition-all
                            ${isActive(child.to) ? 'bg-azul text-white font-medium' : 'text-texto-fraco hover:bg-fundo hover:text-texto'}
                          `}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5
                    ${isActive(item.to) ? 'bg-azul text-white' : 'text-texto-fraco hover:bg-fundo hover:text-texto'}
                  `}
                >
                  <span className="text-base flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* Bottom: auth actions */}
        <div className="border-t border-borda p-2">
          {isAdmin ? (
            <button onClick={adminLogout} title={collapsed ? 'Sair (Admin)' : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-vermelho hover:bg-red-50 transition-all">
              <span className="text-base flex-shrink-0">🚪</span>
              {!collapsed && <span>Sair (Admin)</span>}
            </button>
          ) : isUser ? (
            <button onClick={userLogout} title={collapsed ? 'Sair' : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-vermelho hover:bg-red-50 transition-all">
              <span className="text-base flex-shrink-0">🚪</span>
              {!collapsed && <span>Sair</span>}
            </button>
          ) : (
            <Link to="/login" title={collapsed ? 'Entrar / Cadastrar' : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-azul hover:bg-azul/10 transition-all">
              <span className="text-base flex-shrink-0">🔑</span>
              {!collapsed && <span>Entrar / Cadastrar</span>}
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
