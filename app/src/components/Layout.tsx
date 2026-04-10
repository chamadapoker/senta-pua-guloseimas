import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-3 group">
      <img src="/logo.png" alt="1/10 GpAv" className="w-9 h-9 object-contain group-hover:scale-105 transition-transform" />
      <div className="leading-tight">
        <div className="font-display text-lg text-white tracking-wider">SENTA PUA</div>
        <div className="text-[10px] text-dourado tracking-[0.2em] uppercase">Guloseimas</div>
      </div>
    </Link>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-fundo">
      <header className="bg-fundo-card/80 backdrop-blur-md border-b border-borda sticky top-0 z-30">
        <div className="h-[2px] bg-gradient-to-r from-vermelho via-dourado to-vermelho" />
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <span className="text-[10px] text-texto-fraco tracking-widest uppercase">1/10 GpAv</span>
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
    { to: '/admin/clientes', label: 'Clientes' },
  ];

  return (
    <div className="min-h-screen bg-fundo">
      <header className="bg-fundo-card/80 backdrop-blur-md border-b border-borda sticky top-0 z-30">
        <div className="h-[2px] bg-gradient-to-r from-vermelho via-dourado to-vermelho" />
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <Link to="/" className="text-texto-fraco text-xs hover:text-dourado transition-colors">Catálogo</Link>
            <button onClick={logout} className="text-texto-fraco text-xs hover:text-vermelho transition-colors">Sair</button>
          </div>
        </div>
      </header>
      <nav className="bg-fundo-card border-b border-borda">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${
                location.pathname === link.to
                  ? 'border-vermelho text-white'
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
