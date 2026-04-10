import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type SistemaAdmin = 'guloseimas' | 'loja' | 'cafe' | 'ximboca';

const SISTEMAS_ADMIN: { id: SistemaAdmin; label: string }[] = [
  { id: 'guloseimas', label: 'Guloseimas' },
  { id: 'loja', label: 'Loja' },
  { id: 'cafe', label: 'Café' },
  { id: 'ximboca', label: 'Ximboca' },
];

function getSistemaFromPath(pathname: string): SistemaAdmin {
  if (pathname.startsWith('/admin/loja')) return 'loja';
  if (pathname.startsWith('/admin/cafe')) return 'cafe';
  if (pathname.startsWith('/admin/ximboca')) return 'ximboca';
  return 'guloseimas';
}

function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const isMd = size === 'md';
  return (
    <Link to="/" className="flex items-center gap-3 justify-center">
      <img src="/logo.png" alt="1/10 GpAv" className={`${isMd ? 'w-10 h-10' : 'w-11 h-11'} object-contain`} />
      <div className={`font-display text-azul tracking-wider ${isMd ? 'text-xl' : 'text-2xl'}`}>APP RP POKER</div>
    </Link>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-fundo">
      <header className="bg-white border-b border-borda sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-center">
          <Logo size="lg" />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-5">{children}</main>
      <footer className="text-center py-4 text-[10px] text-texto-fraco tracking-wider">
        Desenvolvido pelo 3S TIN HÖEHR
      </footer>
    </div>
  );
}

const NAV_LINKS: Record<SistemaAdmin, { to: string; label: string }[]> = {
  guloseimas: [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/pedidos', label: 'Pedidos' },
    { to: '/admin/produtos', label: 'Produtos' },
    { to: '/admin/clientes', label: 'Militares' },
    { to: '/admin/config', label: 'Catálogos' },
  ],
  loja: [
    { to: '/admin/loja', label: 'Dashboard' },
    { to: '/admin/loja/pedidos', label: 'Pedidos' },
    { to: '/admin/loja/produtos', label: 'Produtos' },
  ],
  cafe: [
    { to: '/admin/cafe', label: 'Dashboard' },
    { to: '/admin/cafe/mensalidades', label: 'Mensalidades' },
    { to: '/admin/cafe/insumos', label: 'Estoque Insumos' },
    { to: '/admin/cafe/assinantes', label: 'Assinantes' },
  ],
  ximboca: [
    { to: '/admin/ximboca', label: 'Dashboard' },
    { to: '/admin/ximboca/eventos', label: 'Eventos' },
    { to: '/admin/ximboca/estoque', label: 'Estoque' },
  ],
};

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { logout } = useAuth();
  const sistemaAtual = getSistemaFromPath(location.pathname);
  const navLinks = NAV_LINKS[sistemaAtual];

  return (
    <div className="min-h-screen bg-fundo">
      <header className="bg-white border-b border-borda sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            {SISTEMAS_ADMIN.map((s) => (
              <Link
                key={s.id}
                to={s.id === 'guloseimas' ? '/admin' : `/admin/${s.id}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  sistemaAtual === s.id
                    ? 'bg-azul text-white shadow-sm'
                    : 'bg-fundo text-texto-fraco hover:bg-gray-200'
                }`}
              >
                <span>{s.label}</span>
              </Link>
            ))}
            <button onClick={logout} className="text-vermelho text-sm font-medium px-3 py-2 rounded-lg bg-vermelho/10 hover:bg-vermelho/20 transition-colors ml-2">Sair</button>
          </div>
        </div>
      </header>
      <nav className="bg-white border-b border-borda">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                location.pathname === link.to
                  ? 'border-azul text-azul'
                  : 'border-transparent text-texto-fraco hover:text-texto'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-5">{children}</main>
      <footer className="text-center py-4 text-[10px] text-texto-fraco tracking-wider">
        Desenvolvido pelo 3S TIN HÖEHR
      </footer>
    </div>
  );
}
