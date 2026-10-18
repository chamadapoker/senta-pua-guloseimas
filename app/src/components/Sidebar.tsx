import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useAuth, useAcessoAdmin, HOME_CAFE_GRADUADO } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';
import { useComprovantesPendentes } from '../hooks/useComprovantesPendentes';
import { Icon } from './ui/Icon';
import { nomeSalaCafe, useConfigCafe } from '../pages/admin/cafe/SalaCafe';
import { ESQUADRAO, NOME_MAIUSCULO, ALT_BRASAO } from '../config/esquadrao';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  children?: { to: string; label: string }[];
}

const VISITOR_NAV: NavItem[] = [
  { to: '/', label: 'Início', icon: <Icon name="home" /> },
  { to: '/catalogo/oficiais', label: 'Cantina', icon: <Icon name="cutlery" />, children: [
    { to: '/catalogo/oficiais', label: 'Cantina dos Oficiais' },
    { to: '/catalogo/graduados', label: 'Cantina dos Graduados' },
  ]},
  { to: '/loja', label: 'Loja', icon: <Icon name="bag" /> },
  { to: '/cafe', label: 'Café', icon: <Icon name="coffee" /> },
];

const USER_NAV: NavItem[] = [
  { to: '/', label: 'Início', icon: <Icon name="home" /> },
  { to: '/catalogo/oficiais', label: 'Cantina', icon: <Icon name="cutlery" />, children: [
    { to: '/catalogo/oficiais', label: 'Cantina dos Oficiais' },
    { to: '/catalogo/graduados', label: 'Cantina dos Graduados' },
  ]},
  { to: '/loja', label: 'Loja', icon: <Icon name="bag" />, children: [
    { to: '/loja', label: 'Catálogo' },
    { to: '/loja/minhas', label: 'Minhas compras' },
  ]},
  { to: '/cafe', label: 'Café', icon: <Icon name="coffee" /> },
  { to: '/ximboca', label: 'Ximboca', icon: <Icon name="fire" /> },
  { to: '/perfil', label: 'Meu perfil', icon: <Icon name="user" /> },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Cantina', icon: <Icon name="cutlery" />, children: [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/pedidos', label: 'Pedidos' },
    { to: '/admin/produtos', label: 'Produtos' },
    { to: '/admin/clientes', label: 'Contas dos militares' },
    { to: '/admin/relatorios', label: 'Relatórios' },
    { to: '/admin/lucratividade', label: 'Lucratividade' },
  ]},
  { to: '/admin/loja', label: 'Loja', icon: <Icon name="bag" />, children: [
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
    { to: '/admin/caixa', label: 'Caixa consolidado' },
    { to: '/admin/auditoria', label: 'Auditoria' },
  ]},
  { to: '/admin/pessoas', label: 'Pessoas', icon: <Icon name="users" />, children: [
    { to: '/admin/usuarios', label: 'Usuários do app' },
    { to: '/admin/aniversariantes', label: 'Aniversariantes' },
    { to: '/admin/admins', label: 'Administradores' },
  ]},
  { to: '/admin/inventario', label: 'Inventário', icon: <Icon name="archive" /> },
  { to: '/admin/documentacao', label: 'Documentação', icon: <Icon name="book" /> },
  { to: '/admin/config', label: 'Configurações', icon: <Icon name="cog" />, children: [
    { to: '/admin/config?aba=nomes', label: 'Nomes das salas' },
    { to: '/admin/config?aba=pix', label: 'Chaves PIX' },
    { to: '/admin/config?aba=valores', label: 'Valores e taxas' },
    { to: '/admin/config?aba=loja', label: 'Regras da loja' },
  ]},
];

// Menu do admin que só cuida do café dos graduados (nome da sala vem da config)
function navCafeGraduado(nomeSala: string): NavItem[] {
  return [
    { to: HOME_CAFE_GRADUADO, label: `Café · ${nomeSala}`, icon: <Icon name="coffee" />, children: [
      { to: HOME_CAFE_GRADUADO, label: 'Painel' },
      { to: '/admin/cafe/assinantes?sala=graduado', label: 'Assinantes' },
      { to: '/admin/cafe/mensalidades?sala=graduado', label: 'Mensalidades' },
      { to: '/admin/cafe/despesas?sala=graduado', label: 'Despesas' },
      { to: '/admin/cafe/insumos?sala=graduado', label: 'Insumos' },
    ]},
    { to: '/admin/comprovantes', label: 'Comprovantes', icon: <Icon name="paper-clip" /> },
    { to: '/admin/config', label: 'Configurações do café', icon: <Icon name="cog" /> },
  ];
}

/** Nome da sala dos graduados para o menu (config `nome_cafe_graduados`). */
export function useNomeSalaGraduados(): string {
  const config = useConfigCafe();
  return nomeSalaCafe(config, 'graduado');
}

// Rótulo da seção atual (usado no topo da página)
export function secaoDaRota(
  pathname: string,
  isAdmin: boolean,
  opts: { restritoCafe?: boolean; nomeSalaGraduados?: string } = {}
): string {
  const nav = isAdmin
    ? (opts.restritoCafe ? navCafeGraduado(opts.nomeSalaGraduados || ESQUADRAO.salas_cafe.graduado) : ADMIN_NAV)
    : USER_NAV;
  let melhor = '';
  let tam = -1;
  for (const item of nav) {
    for (const alvo of [item, ...(item.children ?? [])]) {
      const [path] = alvo.to.split('?');
      const casa = pathname === path || (path !== '/' && path !== '/admin' && pathname.startsWith(path + '/'));
      if (casa && path.length > tam) {
        tam = path.length;
        melhor = alvo === item || !item.children ? item.label : `${item.label} · ${alvo.label}`;
      }
    }
  }
  return melhor;
}

interface SidebarProps {
  open: boolean; // gaveta mobile
  onClose: () => void;
  fixada: boolean; // desktop: true = sempre aberta; false = recolhe sozinha e abre ao passar o mouse
  onToggleFixada: () => void;
}

export function Sidebar({ open, onClose, fixada, onToggleFixada }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { token: adminToken, admin, logout: adminLogout } = useAuth();
  const { user, logout: userLogout } = useUserAuth();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [hover, setHover] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );

  const isAdmin = !!adminToken;
  const isUser = !!user;
  const compPendentes = useComprovantesPendentes(isAdmin, location.pathname);
  const { acessoRestritoCafe: restritoCafe, carregando: carregandoAdmin } = useAcessoAdmin();
  const nomeSalaGraduados = useNomeSalaGraduados();
  const homeAdmin = restritoCafe ? HOME_CAFE_GRADUADO : '/admin';

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Intenção de hover: abre com um pequeno atraso (não abre só de cruzar o mouse)
  // e fecha um pouco depois de sair (não fecha ao escorregar pela borda)
  const entrar = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHover(true), 120);
  };
  const sair = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHover(false), 280);
  };

  // "mini" = só ícones: desktop, não fixada e sem o mouse em cima. No mobile a gaveta abre sempre inteira.
  const mini = isDesktop && !fixada && !hover;
  // Aberta por hover: flutua por cima do conteúdo (com sombra), sem empurrar a página
  const flutuando = isDesktop && !fixada && hover;

  // Admin com escopo ainda desconhecido: menu vazio (não mostra o completo por um instante)
  const nav = isAdmin
    ? (carregandoAdmin ? [] : restritoCafe ? navCafeGraduado(nomeSalaGraduados) : ADMIN_NAV)
    : isUser ? USER_NAV : VISITOR_NAV;

  useEffect(() => {
    onClose();
    setHover(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  const toggleMenu = (key: string) => {
    setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const currentPathQuery = location.pathname + (location.search || '');
  const isActive = (to: string) => {
    if (to.includes('?')) return currentPathQuery === to;
    if (location.pathname === to) return !location.search || !nav.some(i => i.children?.some(c => c.to.startsWith(to + '?')));
    // Subpáginas (ex.: /admin/clientes/:id) acendem o item pai
    return to !== '/' && to !== '/admin' && location.pathname.startsWith(to + '/');
  };
  const isInSection = (item: NavItem) =>
    isActive(item.to) || !!item.children?.some(c => {
      const [childPath] = c.to.split('?');
      return location.pathname === childPath || (childPath !== '/admin' && location.pathname.startsWith(childPath + '/'));
    });

  // Contador de comprovantes pendentes: no item "Comprovantes" e no grupo que o contém (Financeiro)
  const badgeDoItem = (to: string) => (isAdmin && to === '/admin/comprovantes' ? compPendentes : 0);
  const badgeDoGrupo = (item: NavItem) =>
    badgeDoItem(item.to) + (item.children?.reduce((acc, c) => acc + badgeDoItem(c.to), 0) || 0);
  const badge = (n: number, extra = '') => n > 0 && (
    <span className={`${extra} text-[10px] font-bold bg-escarlate text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ring-2 ring-noite`}>
      {n > 99 ? '99+' : n}
    </span>
  );

  const nomeLogado = isAdmin ? (admin?.nome || 'Administrador') : user ? user.trigrama : '';
  const papelLogado = isAdmin ? (restritoCafe ? 'Responsável pelo café' : 'Administrador') : user ? 'Militar' : '';
  const iniciais = isAdmin ? (admin?.nome || 'AD').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : user?.trigrama?.slice(0, 3) ?? '';

  const sair_ = () => {
    if (isAdmin) { adminLogout(); navigate('/admin/login', { replace: true }); }
    else userLogout();
  };

  // Classes base dos itens no menu escuro
  const itemBase = 'w-full flex items-center gap-3 h-11 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/50';
  const itemInativo = 'text-noite-texto hover:bg-noite-2 hover:text-white';

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-noite/60 backdrop-blur-[2px] z-40 lg:hidden animate-fade-in" onClick={onClose} />
      )}

      <aside
        onMouseEnter={isDesktop && !fixada ? entrar : undefined}
        onMouseLeave={isDesktop && !fixada ? sair : undefined}
        aria-label="Menu principal"
        className={`fixed top-0 left-0 h-full bg-noite text-noite-texto z-50 flex flex-col
          transition-[width,transform,box-shadow] duration-300 ease-out
          w-[min(86vw,288px)] ${mini ? 'lg:w-[72px]' : 'lg:w-64'}
          ${open ? 'translate-x-0 shadow-flutua' : '-translate-x-full lg:translate-x-0'}
          ${flutuando ? 'lg:shadow-flutua' : ''}
        `}
      >
        {/* Faixa escarlate no topo: a borda vermelha do brasão */}
        <div className="h-1 bg-escarlate shrink-0" />

        <div className={`flex items-center h-16 shrink-0 ${mini ? 'justify-center px-0' : 'justify-between pl-4 pr-2'}`}>
          <Link to={isAdmin ? homeAdmin : '/'} className="flex items-center gap-3 min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/50">
            <img src={ESQUADRAO.imagens.brasao} alt={ALT_BRASAO} className="h-10 w-auto shrink-0 drop-shadow" />
            {!mini && (
              <span className="min-w-0">
                <span className="block font-display text-white text-xl leading-none tracking-wider">{NOME_MAIUSCULO}</span>
                <span className="block text-[11px] text-noite-fraco mt-1 truncate">{ESQUADRAO.nome_completo} · {isAdmin ? (restritoCafe ? 'café dos graduados' : 'painel do admin') : 'cantina e loja'}</span>
              </span>
            )}
          </Link>
          {/* Desktop: fixar/soltar. Mobile: fechar a gaveta */}
          {!mini && (
            <>
              <button
                onClick={() => { onToggleFixada(); setHover(false); }}
                className="hidden lg:flex w-8 h-8 items-center justify-center rounded-lg text-noite-fraco hover:text-white hover:bg-noite-2 outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                title={fixada ? 'Recolher automaticamente' : 'Manter o menu aberto'}
                aria-label={fixada ? 'Recolher automaticamente' : 'Manter o menu aberto'}
              >
                <Icon name={fixada ? 'unpin' : 'pin'} size={16} />
              </button>
              <button
                onClick={onClose}
                className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg text-noite-fraco hover:text-white hover:bg-noite-2"
                aria-label="Fechar menu"
              >
                <Icon name="close" size={20} />
              </button>
            </>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden scroll-noite py-2 px-3 space-y-0.5">
          {isAdmin && carregandoAdmin && (
            <p role="status" className={`text-[13px] text-noite-fraco py-3 ${mini ? 'text-center' : 'px-3'}`}>
              {mini ? '...' : 'Carregando menu...'}
            </p>
          )}
          {nav.map((item) => {
            const naSecao = isInSection(item);
            if (!item.children) {
              const ativo = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={mini ? item.label : undefined}
                  className={`${itemBase} relative ${mini ? 'justify-center px-0' : 'px-3'}
                    ${ativo ? 'flamula bg-escarlate text-white' : itemInativo}`}
                >
                  <span className="w-5 flex justify-center shrink-0">{item.icon}</span>
                  {!mini && <span className="flex-1 truncate">{item.label}</span>}
                  {badge(badgeDoItem(item.to), mini ? 'absolute top-0.5 right-1' : 'mr-3')}
                </Link>
              );
            }
            const aberto = openMenus[item.to] ?? naSecao;
            return (
              <div key={item.to}>
                <button
                  onClick={() => {
                    if (mini) {
                      // No modo recolhido, clicar no grupo leva à primeira página dele
                      navigate(item.children![0].to);
                    } else {
                      setOpenMenus(prev => ({ ...prev, [item.to]: !aberto }));
                    }
                  }}
                  title={mini ? item.label : undefined}
                  aria-expanded={mini ? undefined : aberto}
                  className={`${itemBase} relative ${mini ? 'justify-center px-0' : 'px-3'}
                    ${naSecao ? (mini ? 'flamula bg-escarlate text-white' : 'text-white bg-noite-2') : itemInativo}`}
                >
                  <span className="w-5 flex justify-center shrink-0">{item.icon}</span>
                  {mini && badge(badgeDoGrupo(item), 'absolute top-0.5 right-1')}
                  {!mini && (
                    <>
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {badge(badgeDoGrupo(item))}
                      <Icon name="chevron-right" size={16} className={`text-noite-fraco transition-transform duration-200 ${aberto ? 'rotate-90' : ''}`} />
                    </>
                  )}
                </button>
                {!mini && aberto && (
                  <div className="relative ml-[22px] pl-3 py-1 border-l border-noite-3 space-y-0.5">
                    {item.children.map(child => {
                      const ativo = isActive(child.to);
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          className={`flex items-center gap-2 h-9 pl-3 pr-4 rounded-md text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/50
                            ${ativo ? 'flamula-sm bg-escarlate text-white font-semibold' : 'text-noite-fraco hover:text-white hover:bg-noite-2'}`}
                        >
                          <span className="flex-1 truncate">{child.label}</span>
                          {badge(badgeDoItem(child.to))}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Quem está logado + sair */}
        <div className="shrink-0 border-t border-noite-2 p-3">
          {isAdmin || isUser ? (
            <div className={`flex items-center gap-3 ${mini ? 'justify-center' : ''}`}>
              <div
                className="w-10 h-10 shrink-0 rounded-full bg-faixa text-white font-display text-sm tracking-wider flex items-center justify-center ring-2 ring-noite-3"
                title={mini ? `${nomeLogado} (${papelLogado})` : undefined}
              >
                {iniciais}
              </div>
              {!mini && (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">{nomeLogado}</div>
                    <div className="text-[11px] text-noite-fraco">{papelLogado} · v{__APP_VERSION__}</div>
                  </div>
                  <button
                    onClick={sair_}
                    className="w-10 h-10 flex items-center justify-center rounded-lg text-noite-fraco hover:text-white hover:bg-escarlate transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    title="Sair"
                    aria-label="Sair"
                  >
                    <Icon name="logout" size={18} />
                  </button>
                </>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              title={mini ? 'Entrar ou cadastrar' : undefined}
              className={`${itemBase} ${mini ? 'justify-center px-0' : 'px-3'} bg-faixa text-white hover:bg-faixa/90`}
            >
              <Icon name="user" />
              {!mini && <span>Entrar ou cadastrar</span>}
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
