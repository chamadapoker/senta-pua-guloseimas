import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';
import { api } from '../services/api';
import { Icon } from './ui/Icon';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  children?: { to: string; label: string }[];
}

const VISITOR_NAV: NavItem[] = [
  { to: '/', label: 'Início', icon: <Icon name="info" /> },
  { to: '/catalogo/oficiais', label: 'Cantina', icon: <Icon name="cart" />, children: [
    { to: '/catalogo/oficiais', label: 'Cantina dos Oficiais' },
    { to: '/catalogo/graduados', label: 'Cantina dos Graduados' },
  ]},
  { to: '/loja', label: 'Loja', icon: <Icon name="cart" /> },
  { to: '/cafe', label: 'Café', icon: <Icon name="coffee" /> },
];

const USER_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <Icon name="info" /> },
  { to: '/catalogo/oficiais', label: 'Cantina', icon: <Icon name="cart" />, children: [
    { to: '/catalogo/oficiais', label: 'Cantina dos Oficiais' },
    { to: '/catalogo/graduados', label: 'Cantina dos Graduados' },
  ]},
  { to: '/loja', label: 'Loja', icon: <Icon name="cart" />, children: [
    { to: '/loja', label: 'Catálogo' },
    { to: '/loja/minhas', label: 'Minhas Compras' },
  ]},
  { to: '/cafe', label: 'Café', icon: <Icon name="coffee" /> },
  { to: '/ximboca', label: 'Ximboca', icon: <Icon name="fire" /> },
  { to: '/perfil', label: 'Meu Perfil', icon: <Icon name="user" /> },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Cantina', icon: <Icon name="cutlery" />, children: [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/pedidos', label: 'Pedidos' },
    { to: '/admin/produtos', label: 'Produtos' },
    { to: '/admin/clientes', label: 'Militares' },
    { to: '/admin/relatorios', label: 'Relatórios' },
    { to: '/admin/lucratividade', label: 'Lucratividade' },
  ]},
  { to: '/admin/loja', label: 'Loja', icon: <Icon name="cart" />, children: [
    { to: '/admin/loja', label: 'Dashboard' },
    { to: '/admin/loja/pedidos', label: 'Pedidos' },
    { to: '/admin/loja/produtos', label: 'Produtos' },
  ]},
  { to: '/admin/cafe', label: 'Café', icon: <Icon name="coffee" />, children: [
    { to: '/admin/cafe', label: 'Dashboard' },
    { to: '/admin/cafe/mensalidades', label: 'Mensalidades' },
    { to: '/admin/cafe/despesas', label: 'Despesas' },
    { to: '/admin/cafe/insumos', label: 'Insumos' },
    { to: '/admin/cafe/assinantes', label: 'Assinantes' },
  ]},
  { to: '/admin/ximboca', label: 'Ximboca', icon: <Icon name="fire" />, children: [
    { to: '/admin/ximboca', label: 'Dashboard' },
    { to: '/admin/ximboca/eventos', label: 'Eventos' },
    { to: '/admin/ximboca/estoque', label: 'Estoque' },
  ]},
  { to: '/admin/financeiro', label: 'Financeiro', icon: <Icon name="cash" />, children: [
    { to: '/admin/comprovantes', label: 'Comprovantes' },
    { to: '/admin/cobrancas', label: 'Cobranças' },
    { to: '/admin/caixa', label: 'Caixa Consolidado' },
    { to: '/admin/auditoria', label: 'Auditoria' },
  ]},
  { to: '/admin/pessoas', label: 'Pessoas', icon: <Icon name="users" />, children: [
    { to: '/admin/usuarios', label: 'Militares' },
    { to: '/admin/aniversariantes', label: 'Aniversariantes' },
    { to: '/admin/admins', label: 'Administradores' },
  ]},
  { to: '/admin/documentacao', label: 'Documentação', icon: <Icon name="note" /> },
  { to: '/admin/config', label: 'Configurações', icon: <Icon name="refresh" />, children: [
    { to: '/admin/config?aba=nomes', label: 'Nomes das Salas' },
    { to: '/admin/config?aba=pix', label: 'Chaves PIX' },
    { to: '/admin/config?aba=valores', label: 'Valores e Taxas' },
    { to: '/admin/config?aba=loja', label: 'Regras da Loja' },
  ]},
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
  const [compPendentes, setCompPendentes] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchCount = () => api.get<{ total: number }>('/api/comprovantes/pendentes/count').then(r => setCompPendentes(r.total)).catch(() => {});
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [isAdmin, location.pathname]);

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
                    onClick={() => {
                      if (collapsed) {
                        onToggleCollapse();
                        if (!openMenus[item.to]) toggleMenu(item.to);
                      } else {
                        toggleMenu(item.to);
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5
                      ${isInSection(item) ? 'bg-azul/10 text-azul' : 'text-texto-fraco hover:bg-fundo hover:text-texto'}
                    `}
                  >
                    <div className="w-5 flex justify-center">{item.icon}</div>
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
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
                            ${isActive(child.to) ? 'bg-azul text-white font-medium shadow-sm' : 'text-texto-fraco hover:bg-fundo hover:text-texto'}
                          `}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive(child.to) ? 'bg-white' : 'bg-borda'}`} />
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 relative
                    ${isActive(item.to) ? 'bg-azul text-white' : 'text-texto-fraco hover:bg-fundo hover:text-texto'}
                  `}
                >
                  <div className="w-5 flex justify-center">{item.icon}</div>
                  {!collapsed && <span className="flex-1">{item.label}</span>}
                  {item.to === '/admin/comprovantes' && compPendentes > 0 && (
                    <span className={`${collapsed ? 'absolute -top-1 -right-1' : ''} text-[10px] font-bold bg-vermelho text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center`}>
                      {compPendentes}
                    </span>
                  )}
                </Link>
              )}
            </div>
          ))}
        </nav>

        <div className="border-t border-borda p-2">
          {isAdmin ? (
            <button onClick={adminLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-vermelho hover:bg-red-50 transition-all">
              <Icon name="x" />
              {!collapsed && <span>Sair (Admin)</span>}
            </button>
          ) : isUser ? (
            <button onClick={userLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-vermelho hover:bg-red-50 transition-all">
              <Icon name="x" />
              {!collapsed && <span>Sair</span>}
            </button>
          ) : (
            <Link to="/login"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-azul hover:bg-azul/10 transition-all">
              <Icon name="user" />
              {!collapsed && <span>Entrar / Cadastrar</span>}
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
