import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sidebar, secaoDaRota } from './Sidebar';
import { BottomNav } from './BottomNav';
import { useAuth } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';
import { api } from '../services/api';
import { Icon } from './ui/Icon';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

// Preferência do menu no desktop: fixado aberto ou recolhendo sozinho (padrão)
const CHAVE_MENU = 'menu_fixado';
function lerFixado(): boolean {
  try { return localStorage.getItem(CHAVE_MENU) === '1'; } catch { return false; }
}

interface Notificacao { id: number; titulo: string; mensagem: string; lida: number; created_at: string }

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fixada, setFixada] = useState(lerFixado);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const { token: adminToken } = useAuth();
  const { user, token: userToken } = useUserAuth();
  const isAdmin = !!adminToken;
  const secao = secaoDaRota(pathname, isAdmin);

  useEffect(() => {
    if (userToken) {
      api.get<Notificacao[]>('/api/notificacoes/me').then(setNotificacoes).catch(() => {});
    }
  }, [userToken]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotif(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowNotif(false); };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const toggleFixada = () => {
    setFixada(prev => {
      const novo = !prev;
      try { localStorage.setItem(CHAVE_MENU, novo ? '1' : '0'); } catch { /* sem storage: vale só nesta sessão */ }
      return novo;
    });
  };

  const marcarLida = async (id: number) => {
    try {
      await api.put(`/api/notificacoes/${id}/lida`, {});
      setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: 1 } : n));
    } catch { /* tenta de novo no próximo clique */ }
  };

  const unreadCount = notificacoes.filter(n => !n.lida).length;
  // Menu recolhido ocupa 72px; aberto por hover flutua por cima sem empurrar a página
  const sidebarPl = fixada ? 'lg:pl-64' : 'lg:pl-[72px]';
  const larguraConteudo = isAdmin ? 'max-w-7xl' : 'max-w-5xl';
  const fotoUser = user ? resolveImg(user.foto_url) : null;

  return (
    <div className="min-h-screen bg-fundo">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:bg-white focus:px-3 focus:py-2 focus:rounded-lg focus:shadow">
        Pular para o conteúdo
      </a>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        fixada={fixada}
        onToggleFixada={toggleFixada}
      />

      <header
        className={`sticky top-0 z-30 transition-[padding] duration-300 ${sidebarPl}
          bg-noite text-white lg:bg-white/90 lg:text-texto lg:backdrop-blur lg:border-b lg:border-borda
          pt-[env(safe-area-inset-top)] lg:pt-0`}
      >
        <div className={`${larguraConteudo} mx-auto px-4 h-14 lg:h-16 flex items-center gap-3`}>
          {/* Mobile: brasão + seção */}
          <Link to={isAdmin ? '/admin' : '/'} className="lg:hidden shrink-0" aria-label="Início">
            <img src="/brasao-96.png" alt="" className="h-9 w-auto" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="lg:hidden font-display text-lg leading-none tracking-wider">SENTA PUA</div>
            <div className="text-[12px] lg:text-sm text-noite-fraco lg:text-texto-fraco truncate mt-0.5 lg:mt-0">
              {secao || (isAdmin ? 'Painel do admin' : 'Cantina, loja e café do esquadrão')}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {(userToken || user) && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotif(!showNotif)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 lg:hover:bg-fundo relative transition-colors"
                  aria-label={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : 'Notificações'}
                  aria-expanded={showNotif}
                >
                  <Icon name="bell" size={20} className="text-noite-texto lg:text-texto-fraco" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-escarlate text-white text-[10px] font-bold flex items-center justify-center rounded-full ring-2 ring-noite lg:ring-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotif && (
                  <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] bg-white text-texto rounded-2xl shadow-2xl border border-borda z-[60] overflow-hidden animate-scale-in">
                    <div className="px-4 py-3 border-b border-borda flex items-center justify-between">
                      <span className="text-sm font-semibold text-texto">Notificações</span>
                      {unreadCount > 0 && <span className="text-xs text-escarlate font-medium">{unreadCount} não lidas</span>}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notificacoes.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-texto-fraco">Você não tem notificações.</div>
                      ) : (
                        notificacoes.map(n => (
                          <button
                            key={n.id}
                            onClick={() => marcarLida(n.id)}
                            className={`w-full text-left px-4 py-3 border-b border-borda last:border-0 transition-colors ${!n.lida ? 'bg-azul/5 hover:bg-azul/10' : 'hover:bg-fundo'}`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`text-sm font-semibold ${!n.lida ? 'text-azul' : 'text-texto-fraco'}`}>{n.titulo}</span>
                              {!n.lida && <span className="w-2 h-2 bg-escarlate rounded-full shrink-0" aria-label="Não lida" />}
                            </div>
                            <p className="text-sm text-texto leading-relaxed">{n.mensagem}</p>
                            <div className="text-xs text-texto-fraco mt-1.5">
                              {new Date(n.created_at.replace(' ', 'T') + (n.created_at.endsWith('Z') ? '' : 'Z')).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {user ? (
              <Link to="/perfil" className="flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-azul" title="Meu perfil">
                {fotoUser ? (
                  <img src={fotoUser} alt={user.trigrama} className="w-9 h-9 rounded-full object-cover ring-2 ring-white/30 lg:ring-borda" />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-faixa text-white flex items-center justify-center font-display text-sm tracking-wider">
                    {user.trigrama}
                  </span>
                )}
              </Link>
            ) : !isAdmin && (
              <Link to="/login" className="h-9 px-3 rounded-full bg-faixa text-white text-sm font-medium flex items-center gap-1.5 hover:bg-faixa/90 transition-colors">
                <Icon name="user" size={16} />
                Entrar
              </Link>
            )}
          </div>
        </div>
        {/* Fio escarlate sob o topo no mobile, como a borda do brasão */}
        <div className="h-[3px] bg-escarlate lg:hidden" />
      </header>

      <main id="conteudo" className={`transition-[padding] duration-300 ${sidebarPl} pb-28 lg:pb-0`}>
        <div className={`${larguraConteudo} mx-auto px-4 sm:px-6 py-5 sm:py-6`}>
          {children}
        </div>
      </main>

      <footer className={`transition-[padding] duration-300 ${sidebarPl} text-center py-4 pb-28 lg:pb-6 text-xs text-texto-fraco space-y-1`}>
        <div>Desenvolvido pelo 3S TIN HÖEHR</div>
        <Link to="/privacidade" className="hover:text-azul hover:underline">Política de privacidade</Link>
      </footer>

      <BottomNav onAbrirMenu={() => setSidebarOpen(true)} />
    </div>
  );
}
