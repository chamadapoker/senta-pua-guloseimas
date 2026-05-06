import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';
import { api } from '../services/api';
import { Icon } from './ui/Icon';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  const [notificacoes, setNotificacoes] = useState<any[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { token: adminToken } = useAuth();
  const { user, token: userToken } = useUserAuth();
  const isAdmin = !!adminToken;

  useEffect(() => {
    if (userToken) {
      api.get<any[]>('/api/notificacoes/me').then(setNotificacoes).catch(() => {});
    }
  }, [userToken]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotif(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const marcarLida = async (id: number) => {
    try {
      await api.put(`/api/notificacoes/${id}/lida`, {});
      setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: 1 } : n));
    } catch {}
  };

  const unreadCount = notificacoes.filter(n => !n.lida).length;

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
            <span className="font-display text-azul text-base tracking-wider">SENTA PUA</span>
          </Link>

          {/* Desktop spacer */}
          <div className="hidden lg:block" />

          {/* Right: avatar/login */}
          <div className="flex items-center gap-2">
            {(userToken || user) && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotif(!showNotif)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-fundo relative transition-colors"
                >
                  <Icon name="bell" size={20} className="text-texto-fraco" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-vermelho text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotif && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-borda z-[60] overflow-hidden animate-scale-in">
                    <div className="px-4 py-3 border-b border-borda bg-fundo/50 flex items-center justify-between">
                      <span className="text-xs font-bold text-azul uppercase tracking-wider">Notificações</span>
                      {unreadCount > 0 && <span className="text-[10px] text-vermelho font-medium">{unreadCount} pendentes</span>}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notificacoes.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-texto-fraco">Nenhuma notificação</div>
                      ) : (
                        notificacoes.map(n => (
                          <div
                            key={n.id}
                            onClick={() => marcarLida(n.id)}
                            className={`px-4 py-3 border-b border-borda last:border-0 cursor-pointer transition-colors ${!n.lida ? 'bg-azul/5 hover:bg-azul/10' : 'hover:bg-fundo'}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${!n.lida ? 'text-azul' : 'text-texto-fraco'}`}>
                                {n.titulo}
                              </span>
                              {!n.lida && <span className="w-2 h-2 bg-azul rounded-full"></span>}
                            </div>
                            <p className="text-xs text-texto leading-relaxed">{n.mensagem}</p>
                            <div className="text-[9px] text-texto-fraco mt-1.5 uppercase font-medium">
                              {new Date(n.created_at).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

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

      <footer className={`transition-all duration-300 ${sidebarPl} text-center py-4 text-[10px] text-texto-fraco tracking-wider space-y-1`}>
        <div>Desenvolvido pelo 3S TIN HÖEHR</div>
        <Link to="/privacidade" className="hover:text-azul hover:underline">Política de Privacidade</Link>
      </footer>
    </div>
  );
}
