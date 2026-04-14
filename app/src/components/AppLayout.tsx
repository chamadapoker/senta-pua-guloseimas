import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const { token: adminToken } = useAuth();
  const { user } = useUserAuth();
  const isAdmin = !!adminToken;

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', String(collapsed));
  }, [collapsed]);

  const sidebarPl = collapsed ? 'lg:pl-16' : 'lg:pl-64';

  return (
    <div className="min-h-screen bg-fundo">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      <header className={`bg-white border-b border-borda sticky top-0 z-30 shadow-sm transition-all duration-300 ${sidebarPl}`}>
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl hover:bg-fundo"
            aria-label="Abrir menu"
          >
            <svg className="w-6 h-6 text-texto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Mobile logo */}
          <Link to={isAdmin ? '/admin' : '/'} className="flex items-center gap-2 lg:hidden">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-display text-azul text-base tracking-wider">APP RP POKER</span>
          </Link>

          {/* Desktop spacer */}
          <div className="hidden lg:block" />

          {/* Right: avatar/login */}
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/perfil" className="flex items-center gap-2" title="Meu perfil">
                {resolveImg(user.foto_url) ? (
                  <img src={resolveImg(user.foto_url)!} alt={user.trigrama} className="w-9 h-9 rounded-full object-cover border-2 border-borda" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-azul/10 flex items-center justify-center text-azul font-display text-sm">
                    {user.trigrama}
                  </div>
                )}
              </Link>
            ) : isAdmin ? (
              <div className="w-9 h-9 rounded-full bg-azul flex items-center justify-center text-white font-display text-xs" title="Admin">
                ADM
              </div>
            ) : (
              <Link to="/login" className="w-9 h-9 rounded-full bg-fundo flex items-center justify-center border border-borda hover:bg-azul/10 transition-colors" title="Entrar">
                <svg className="w-5 h-5 text-texto-fraco" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className={`transition-all duration-300 ${sidebarPl}`}>
        <div className="max-w-5xl mx-auto px-4 py-5">
          {children}
        </div>
      </main>

      <footer className={`transition-all duration-300 ${sidebarPl} text-center py-4 text-[10px] text-texto-fraco tracking-wider`}>
        Desenvolvido pelo 3S TIN HÖEHR
      </footer>
    </div>
  );
}
