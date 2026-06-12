export interface BottomItem {
  to: string;
  label: string;
  icon: string; // nome de Icon
}

interface BottomSection {
  match: (path: string) => boolean;
  items: BottomItem[];
}

// ---- Usuário (logado) ----
const USER_DEFAULT: BottomItem[] = [
  { to: '/', label: 'Início', icon: 'info' },
  { to: '/catalogo/oficiais', label: 'Cantina', icon: 'cutlery' },
  { to: '/loja', label: 'Loja', icon: 'cart' },
  { to: '/perfil', label: 'Perfil', icon: 'user' },
];

const USER_SECTIONS: BottomSection[] = [
  {
    match: (p) => p.startsWith('/catalogo'),
    items: [
      { to: '/catalogo/oficiais', label: 'Oficiais', icon: 'cutlery' },
      { to: '/catalogo/graduados', label: 'Graduados', icon: 'cutlery' },
    ],
  },
  {
    match: (p) => p === '/loja' || p.startsWith('/loja/'),
    items: [
      { to: '/loja', label: 'Catálogo', icon: 'cart' },
      { to: '/loja/minhas', label: 'Minhas', icon: 'archive' },
    ],
  },
];

// ---- Visitante (sem login) ----
const VISITOR_DEFAULT: BottomItem[] = [
  { to: '/', label: 'Início', icon: 'info' },
  { to: '/catalogo/oficiais', label: 'Cantina', icon: 'cutlery' },
  { to: '/loja', label: 'Loja', icon: 'cart' },
  { to: '/cafe', label: 'Café', icon: 'coffee' },
];

// ---- Admin ----
const ADMIN_CANTINA: BottomItem[] = [
  { to: '/admin', label: 'Dashboard', icon: 'info' },
  { to: '/admin/pedidos', label: 'Pedidos', icon: 'cart' },
  { to: '/admin/produtos', label: 'Produtos', icon: 'tag' },
  { to: '/admin/clientes', label: 'Militares', icon: 'users' },
];

const ADMIN_SECTIONS: BottomSection[] = [
  {
    match: (p) => p.startsWith('/admin/loja'),
    items: [
      { to: '/admin/loja', label: 'Dashboard', icon: 'info' },
      { to: '/admin/loja/pedidos', label: 'Pedidos', icon: 'cart' },
      { to: '/admin/loja/produtos', label: 'Produtos', icon: 'tag' },
    ],
  },
  {
    match: (p) => p.startsWith('/admin/cafe'),
    items: [
      { to: '/admin/cafe', label: 'Dashboard', icon: 'info' },
      { to: '/admin/cafe/mensalidades', label: 'Mensal.', icon: 'cash' },
      { to: '/admin/cafe/assinantes', label: 'Assinantes', icon: 'users' },
      { to: '/admin/cafe/despesas', label: 'Despesas', icon: 'credit-card' },
    ],
  },
  {
    match: (p) => p.startsWith('/admin/ximboca'),
    items: [
      { to: '/admin/ximboca', label: 'Dashboard', icon: 'info' },
      { to: '/admin/ximboca/eventos', label: 'Eventos', icon: 'fire' },
      { to: '/admin/ximboca/estoque', label: 'Estoque', icon: 'archive' },
    ],
  },
  {
    match: (p) =>
      p.startsWith('/admin/comprovantes') ||
      p.startsWith('/admin/cobrancas') ||
      p.startsWith('/admin/caixa') ||
      p.startsWith('/admin/auditoria'),
    items: [
      { to: '/admin/comprovantes', label: 'Comprov.', icon: 'paper-clip' },
      { to: '/admin/cobrancas', label: 'Cobranças', icon: 'cash' },
      { to: '/admin/caixa', label: 'Caixa', icon: 'vault' },
      { to: '/admin/auditoria', label: 'Auditoria', icon: 'note' },
    ],
  },
  {
    match: (p) =>
      p.startsWith('/admin/usuarios') ||
      p.startsWith('/admin/aniversariantes') ||
      p.startsWith('/admin/admins'),
    items: [
      { to: '/admin/usuarios', label: 'Militares', icon: 'users' },
      { to: '/admin/aniversariantes', label: 'Niver', icon: 'bell' },
      { to: '/admin/admins', label: 'Admins', icon: 'user' },
    ],
  },
];

export function itensBottomNav(
  pathname: string,
  opts: { isAdmin: boolean; isUser: boolean }
): BottomItem[] {
  if (opts.isAdmin) {
    const sec = ADMIN_SECTIONS.find((s) => s.match(pathname));
    return sec ? sec.items : ADMIN_CANTINA;
  }
  const sec = USER_SECTIONS.find((s) => s.match(pathname));
  if (sec) return sec.items;
  return opts.isUser ? USER_DEFAULT : VISITOR_DEFAULT;
}
