import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';

// ---- Icons (Heroicons outline, 24px) ----
const I = ({ d, children }: { d?: string; children?: ReactNode }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" className="w-5 h-5 flex-shrink-0">
    {d ? <path strokeLinecap="round" strokeLinejoin="round" d={d} /> : children}
  </svg>
);

const IconCart = () => <I d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />;
const IconBag = () => <I d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007Z" />;
const IconCoffee = () => <I d="M6 21h9m-9 0a2.25 2.25 0 0 1-2.25-2.25V6.75A.75.75 0 0 1 4.5 6h12a.75.75 0 0 1 .75.75V9M6 21h9a2.25 2.25 0 0 0 2.25-2.25V14.25m0-5.25h1.875A2.625 2.625 0 0 1 22.5 11.625v0A2.625 2.625 0 0 1 19.875 14.25H17.25m0-5.25v5.25M9 3v2m3-2v2m-6 14.25V6.75" />;
const IconUser = () => <I d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />;
const IconDashboard = () => <I d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />;
const IconCalendar = () => <I d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />;
const IconSettings = () => (
  <I>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </I>
);
const IconLogout = () => <I d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />;
const IconLogin = () => <I d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />;
const IconGift = () => <I d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />;
const IconHome = () => <I d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />;
const IconFire = () => (
  <I>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 0 0 .495-7.467 5.99 5.99 0 0 0-1.925 3.546 5.974 5.974 0 0 1-2.133-1A3.75 3.75 0 0 0 12 18Z" />
  </I>
);

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  children?: { to: string; label: string }[];
}

const VISITOR_NAV: NavItem[] = [
  { to: '/', label: 'Início', icon: <IconHome /> },
  { to: '/catalogo/oficiais', label: 'Cantina', icon: <IconCart />, children: [
    { to: '/catalogo/oficiais', label: 'Cantina dos Oficiais' },
    { to: '/catalogo/graduados', label: 'Cantina dos Graduados' },
  ]},
  { to: '/loja', label: 'Loja', icon: <IconBag /> },
  { to: '/cafe', label: 'Café', icon: <IconCoffee /> },
];

const USER_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <IconHome /> },
  { to: '/catalogo/oficiais', label: 'Cantina', icon: <IconCart />, children: [
    { to: '/catalogo/oficiais', label: 'Cantina dos Oficiais' },
    { to: '/catalogo/graduados', label: 'Cantina dos Graduados' },
  ]},
  { to: '/loja', label: 'Loja', icon: <IconBag /> },
  { to: '/cafe', label: 'Café', icon: <IconCoffee /> },
  { to: '/ximboca', label: 'Ximboca', icon: <IconFire /> },
  { to: '/perfil', label: 'Meu Perfil', icon: <IconUser /> },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Cantina', icon: <IconGift />, children: [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/pedidos', label: 'Pedidos' },
    { to: '/admin/produtos', label: 'Produtos' },
    { to: '/admin/clientes', label: 'Militares' },
    { to: '/admin/relatorios', label: 'Relatórios' },
  ]},
  { to: '/admin/loja', label: 'Loja', icon: <IconBag />, children: [
    { to: '/admin/loja', label: 'Dashboard' },
    { to: '/admin/loja/pedidos', label: 'Pedidos' },
    { to: '/admin/loja/produtos', label: 'Produtos' },
  ]},
  { to: '/admin/cafe', label: 'Café', icon: <IconCoffee />, children: [
    { to: '/admin/cafe', label: 'Dashboard' },
    { to: '/admin/cafe/mensalidades', label: 'Mensalidades' },
    { to: '/admin/cafe/insumos', label: 'Insumos' },
    { to: '/admin/cafe/assinantes', label: 'Assinantes' },
  ]},
  { to: '/admin/ximboca', label: 'Ximboca', icon: <IconFire />, children: [
    { to: '/admin/ximboca', label: 'Dashboard' },
    { to: '/admin/ximboca/eventos', label: 'Eventos' },
    { to: '/admin/ximboca/estoque', label: 'Estoque' },
  ]},
  { to: '/admin/usuarios', label: 'Usuários', icon: <IconUser />, children: [
    { to: '/admin/usuarios', label: 'Todos' },
    { to: '/admin/usuarios?f=ativos', label: 'Ativos' },
    { to: '/admin/usuarios?f=desativados', label: 'Desativados' },
    { to: '/admin/usuarios?f=visitantes', label: 'Visitantes' },
    { to: '/admin/usuarios?f=expirados', label: 'Expirados' },
  ]},
  { to: '/admin/comprovantes', label: 'Comprovantes', icon: <IconGift /> },
  { to: '/admin/admins', label: 'Administradores', icon: <IconSettings /> },
  { to: '/admin/config', label: 'Configurações', icon: <IconSettings /> },
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

  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleMenu = (key: string) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const currentPathQuery = location.pathname + (location.search || '');
  const isActive = (to: string) => {
    if (to.includes('?')) return currentPathQuery === to;
    // Link sem query: so marca ativo se nao houver query atual
    return location.pathname === to && !location.search;
  };
  const isInSection = (item: NavItem) =>
    location.pathname === item.to || !!item.children?.some(c => {
      const [childPath] = c.to.split('?');
      return location.pathname === childPath;
    });

  const sidebarWidth = collapsed ? 'w-16' : 'w-64';

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={`fixed top-0 left-0 h-full bg-white border-r border-borda z-50 flex flex-col transition-all duration-300
        ${sidebarWidth}
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between px-3 py-4 border-b border-borda">
          {!collapsed ? (
            <Link to={isAdmin ? '/admin' : '/'} className="flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
              <span className="font-display text-azul text-lg tracking-wider">SENTA PUA</span>
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
                    {item.icon}
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
                  {item.icon}
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )}
            </div>
          ))}
        </nav>

        <div className="border-t border-borda p-2">
          {isAdmin ? (
            <button onClick={adminLogout} title={collapsed ? 'Sair (Admin)' : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-vermelho hover:bg-red-50 transition-all">
              <IconLogout />
              {!collapsed && <span>Sair (Admin)</span>}
            </button>
          ) : isUser ? (
            <button onClick={userLogout} title={collapsed ? 'Sair' : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-vermelho hover:bg-red-50 transition-all">
              <IconLogout />
              {!collapsed && <span>Sair</span>}
            </button>
          ) : (
            <Link to="/login" title={collapsed ? 'Entrar / Cadastrar' : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-azul hover:bg-azul/10 transition-all">
              <IconLogin />
              {!collapsed && <span>Entrar / Cadastrar</span>}
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
