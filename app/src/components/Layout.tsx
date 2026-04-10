import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const isMd = size === 'md';
  return (
    <Link to="/" className="flex items-center gap-3 justify-center">
      <img src="/logo.png" alt="1/10 GpAv" className={`${isMd ? 'w-10 h-10' : 'w-11 h-11'} object-contain`} />
      <div className="leading-tight">
        <div className={`font-display text-azul tracking-wider ${isMd ? 'text-xl' : 'text-2xl'}`}>SENTA PUA</div>
        <div className={`text-vermelho tracking-[0.15em] font-medium uppercase ${isMd ? 'text-[10px]' : 'text-xs'}`}>Guloseimas</div>
      </div>
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

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { logout } = useAuth();

  const navLinks = [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/pedidos', label: 'Pedidos' },
    { to: '/admin/produtos', label: 'Produtos' },
    { to: '/admin/clientes', label: 'Militares' },
    { to: '/admin/config', label: 'Catálogos' },
  ];

  return (
    <div className="min-h-screen bg-fundo">
      <header className="bg-white border-b border-borda sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <Link to="/" className="text-azul text-sm font-medium px-3 py-2 rounded-lg bg-azul/10 hover:bg-azul/20 transition-colors">Catálogo</Link>
            <button onClick={logout} className="text-vermelho text-sm font-medium px-3 py-2 rounded-lg bg-vermelho/10 hover:bg-vermelho/20 transition-colors">Sair</button>
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
