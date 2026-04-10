import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <img src="/logo.png" alt="1/10 GpAv" className="w-9 h-9 object-contain" />
      <div className="leading-tight">
        <div className="font-display text-lg text-azul tracking-wider">SENTA PUA</div>
        <div className="text-[10px] text-vermelho tracking-[0.15em] font-medium uppercase">Guloseimas</div>
      </div>
    </Link>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-fundo">
      <header className="bg-white border-b border-borda sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <span className="text-[10px] text-texto-fraco tracking-widest uppercase font-medium">1/10 GpAv</span>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-5">{children}</main>
    </div>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { logout } = useAuth();

  const navLinks = [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/pedidos', label: 'Pedidos' },
    { to: '/admin/produtos', label: 'Produtos' },
    { to: '/admin/clientes', label: 'Militares' },
  ];

  return (
    <div className="min-h-screen bg-fundo">
      <header className="bg-white border-b border-borda sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <Link to="/" className="text-texto-fraco text-xs hover:text-azul transition-colors">Catálogo</Link>
            <button onClick={logout} className="text-texto-fraco text-xs hover:text-vermelho transition-colors">Sair</button>
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
    </div>
  );
}
