import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <img src="/logo.png" alt="1/10 GpAv" className="w-10 h-10 object-contain" />
      <div className="leading-tight">
        <div className="font-bold text-white text-sm">Senta Pua</div>
        <div className="text-red-300 text-xs font-medium">Guloseimas</div>
      </div>
    </div>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="bg-gradient-to-r from-gray-900 to-azul border-b-[3px] border-vermelho">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <span className="text-red-300 text-xs font-medium">1/10 GpAv</span>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-4">{children}</main>
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
    <div className="min-h-screen bg-bg">
      <header className="bg-gradient-to-r from-gray-900 to-azul border-b-[3px] border-vermelho">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/admin"><Logo /></Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-gray-300 text-xs hover:text-white">Catálogo</Link>
            <button onClick={logout} className="text-red-300 text-xs hover:text-white">Sair</button>
          </div>
        </div>
      </header>
      <nav className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                location.pathname === link.to
                  ? 'border-vermelho text-azul'
                  : 'border-transparent text-gray-500 hover:text-azul'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-4">{children}</main>
    </div>
  );
}
