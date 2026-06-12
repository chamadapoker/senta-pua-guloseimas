import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, lazy, Suspense } from 'react';
import { ToastProvider } from './hooks/useToast';
import { Home } from './pages/Home';
import { Catalogo } from './pages/Catalogo';
import { Checkout } from './pages/Checkout';
import { PixPage } from './pages/PixPage';
import { Obrigado } from './pages/Obrigado';
import { UserLogin } from './pages/UserLogin';
import { UserCadastro } from './pages/UserCadastro';
import { CadastroEscolha } from './pages/CadastroEscolha';
import { UserCadastroVisitante } from './pages/UserCadastroVisitante';
import { AcessoExpirado } from './pages/AcessoExpirado';
import { PoliticaPrivacidade } from './pages/PoliticaPrivacidade';
import { Perfil } from './pages/Perfil';
// Páginas admin carregadas sob demanda (code-splitting) — saem do bundle inicial.
const Login = lazy(() => import('./pages/admin/Login').then(m => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/admin/Dashboard').then(m => ({ default: m.Dashboard })));
const Produtos = lazy(() => import('./pages/admin/Produtos').then(m => ({ default: m.Produtos })));
const Clientes = lazy(() => import('./pages/admin/Clientes').then(m => ({ default: m.Clientes })));
const ClienteExtrato = lazy(() => import('./pages/admin/ClienteExtrato').then(m => ({ default: m.ClienteExtrato })));
const Pedidos = lazy(() => import('./pages/admin/Pedidos').then(m => ({ default: m.Pedidos })));
const Configuracoes = lazy(() => import('./pages/admin/Configuracoes').then(m => ({ default: m.Configuracoes })));
const Relatorios = lazy(() => import('./pages/admin/Relatorios').then(m => ({ default: m.Relatorios })));
const Usuarios = lazy(() => import('./pages/admin/Usuarios').then(m => ({ default: m.Usuarios })));
const Admins = lazy(() => import('./pages/admin/Admins').then(m => ({ default: m.Admins })));
const Comprovantes = lazy(() => import('./pages/admin/Comprovantes').then(m => ({ default: m.Comprovantes })));
const Auditoria = lazy(() => import('./pages/admin/Auditoria').then(m => ({ default: m.Auditoria })));
const CafeDespesas = lazy(() => import('./pages/admin/cafe/CafeDespesas').then(m => ({ default: m.CafeDespesas })));
const Lucratividade = lazy(() => import('./pages/admin/Lucratividade').then(m => ({ default: m.Lucratividade })));
const Cobrancas = lazy(() => import('./pages/admin/Cobrancas').then(m => ({ default: m.Cobrancas })));
const CaixaConsolidado = lazy(() => import('./pages/admin/CaixaConsolidado').then(m => ({ default: m.CaixaConsolidado })));
const LojaDashboard = lazy(() => import('./pages/admin/loja/LojaDashboard').then(m => ({ default: m.LojaDashboard })));
const LojaProdutos = lazy(() => import('./pages/admin/loja/LojaProdutos').then(m => ({ default: m.LojaProdutos })));
const LojaPedidos = lazy(() => import('./pages/admin/loja/LojaPedidos').then(m => ({ default: m.LojaPedidos })));
const CafeDashboard = lazy(() => import('./pages/admin/cafe/CafeDashboard').then(m => ({ default: m.CafeDashboard })));
const CafeMensalidades = lazy(() => import('./pages/admin/cafe/CafeMensalidades').then(m => ({ default: m.CafeMensalidades })));
const CafeInsumos = lazy(() => import('./pages/admin/cafe/CafeInsumos').then(m => ({ default: m.CafeInsumos })));
const CafeAssinantes = lazy(() => import('./pages/admin/cafe/CafeAssinantes').then(m => ({ default: m.CafeAssinantes })));
const XimbocaDashboard = lazy(() => import('./pages/admin/ximboca/XimbocaDashboard').then(m => ({ default: m.XimbocaDashboard })));
const XimbocaEventos = lazy(() => import('./pages/admin/ximboca/XimbocaEventos').then(m => ({ default: m.XimbocaEventos })));
const XimbocaEvento = lazy(() => import('./pages/admin/ximboca/XimbocaEvento').then(m => ({ default: m.XimbocaEvento })));
const XimbocaEstoque = lazy(() => import('./pages/admin/ximboca/XimbocaEstoque').then(m => ({ default: m.XimbocaEstoque })));
const Documentacao = lazy(() => import('./pages/admin/Documentacao').then(m => ({ default: m.Documentacao })));
const Aniversariantes = lazy(() => import('./pages/admin/Aniversariantes').then(m => ({ default: m.Aniversariantes })));
import { CafePublico } from './pages/CafePublico';
import { LojaPublica } from './pages/LojaPublica';
import { LojaMinhas } from './pages/LojaMinhas';
import { XimbocaPublica } from './pages/XimbocaPublica';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useAuth } from './hooks/useAuth';
import { useUserAuth } from './hooks/useUserAuth';
import { api } from './services/api';
import { setPixDefaults } from './services/pix';

// Load PIX config once on app start
api.get<Record<string, string>>('/api/config').then(c => {
  setPixDefaults(
    c.pix_guloseimas_chave || '',
    c.pix_guloseimas_nome || '',
    c.pix_guloseimas_cidade || 'ANAPOLIS'
  );
}).catch(() => {});

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { token, checkAuth } = useAuth();
  const [verificando, setVerificando] = useState(true);
  const [autenticado, setAutenticado] = useState(false);

  useEffect(() => {
    if (!token) { setVerificando(false); return; }
    checkAuth().then((ok) => { setAutenticado(ok); setVerificando(false); });
  }, [token, checkAuth]);

  if (verificando) return <div className="text-center py-20 text-gray-400">Verificando...</div>;

  // checkAuth retorna false só quando o token é inválido/expirado (401/403);
  // erro de rede retorna true e mantém a sessão.
  if (!autenticado) return <Navigate to="/admin/login" replace />;

  return <>{children}</>;
}

function UserAuthLoader() {
  const { token, user, checkAuth } = useUserAuth();
  useEffect(() => {
    if (token && !user) checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user]);
  return null;
}

function VisitorGuard({ children }: { children: React.ReactNode }) {
  const { user } = useUserAuth();
  if (user?.acesso_bloqueado) {
    return <Navigate to="/acesso-expirado" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <UserAuthLoader />
        <UpdatePrompt />
        <Suspense fallback={<div className="text-center py-20 text-gray-400">Carregando...</div>}>
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalogo/:categoria" element={<VisitorGuard><Catalogo /></VisitorGuard>} />
        <Route path="/checkout" element={<VisitorGuard><Checkout /></VisitorGuard>} />
        <Route path="/pix/:pedidoId" element={<VisitorGuard><PixPage /></VisitorGuard>} />
        <Route path="/obrigado" element={<Obrigado />} />
        <Route path="/loja" element={<VisitorGuard><LojaPublica /></VisitorGuard>} />
        <Route path="/loja/minhas" element={<VisitorGuard><LojaMinhas /></VisitorGuard>} />
        <Route path="/cafe" element={<CafePublico />} />
        <Route path="/ximboca" element={<VisitorGuard><XimbocaPublica /></VisitorGuard>} />
        {/* User auth */}
        <Route path="/login" element={<UserLogin />} />
        <Route path="/cadastro" element={<CadastroEscolha />} />
        <Route path="/cadastro/militar" element={<UserCadastro />} />
        <Route path="/cadastro/visitante" element={<UserCadastroVisitante />} />
        <Route path="/acesso-expirado" element={<AcessoExpirado />} />
        <Route path="/privacidade" element={<PoliticaPrivacidade />} />
        <Route path="/perfil" element={<Perfil />} />
        {/* Admin */}
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminGuard><Dashboard /></AdminGuard>} />
        <Route path="/admin/produtos" element={<AdminGuard><Produtos /></AdminGuard>} />
        <Route path="/admin/clientes" element={<AdminGuard><Clientes /></AdminGuard>} />
        <Route path="/admin/clientes/:id" element={<AdminGuard><ClienteExtrato /></AdminGuard>} />
        <Route path="/admin/pedidos" element={<AdminGuard><Pedidos /></AdminGuard>} />
        <Route path="/admin/config" element={<AdminGuard><Configuracoes /></AdminGuard>} />
        <Route path="/admin/relatorios" element={<AdminGuard><Relatorios /></AdminGuard>} />
        <Route path="/admin/usuarios" element={<AdminGuard><Usuarios /></AdminGuard>} />
        <Route path="/admin/admins" element={<AdminGuard><Admins /></AdminGuard>} />
        <Route path="/admin/comprovantes" element={<AdminGuard><Comprovantes /></AdminGuard>} />
        <Route path="/admin/auditoria" element={<AdminGuard><Auditoria /></AdminGuard>} />
        <Route path="/admin/cafe/despesas" element={<AdminGuard><CafeDespesas /></AdminGuard>} />
        <Route path="/admin/lucratividade" element={<AdminGuard><Lucratividade /></AdminGuard>} />
        <Route path="/admin/cobrancas" element={<AdminGuard><Cobrancas /></AdminGuard>} />
        <Route path="/admin/caixa" element={<AdminGuard><CaixaConsolidado /></AdminGuard>} />
        <Route path="/admin/loja" element={<AdminGuard><LojaDashboard /></AdminGuard>} />
        <Route path="/admin/loja/produtos" element={<AdminGuard><LojaProdutos /></AdminGuard>} />
        <Route path="/admin/loja/pedidos" element={<AdminGuard><LojaPedidos /></AdminGuard>} />
        <Route path="/admin/cafe" element={<AdminGuard><CafeDashboard /></AdminGuard>} />
        <Route path="/admin/cafe/mensalidades" element={<AdminGuard><CafeMensalidades /></AdminGuard>} />
        <Route path="/admin/cafe/insumos" element={<AdminGuard><CafeInsumos /></AdminGuard>} />
        <Route path="/admin/cafe/assinantes" element={<AdminGuard><CafeAssinantes /></AdminGuard>} />
        <Route path="/admin/ximboca" element={<AdminGuard><XimbocaDashboard /></AdminGuard>} />
        <Route path="/admin/ximboca/eventos" element={<AdminGuard><XimbocaEventos /></AdminGuard>} />
        <Route path="/admin/ximboca/eventos/:id" element={<AdminGuard><XimbocaEvento /></AdminGuard>} />
        <Route path="/admin/ximboca/estoque" element={<AdminGuard><XimbocaEstoque /></AdminGuard>} />
        <Route path="/admin/documentacao" element={<AdminGuard><Documentacao /></AdminGuard>} />
        <Route path="/admin/aniversariantes" element={<AdminGuard><Aniversariantes /></AdminGuard>} />
      </Routes>
        </Suspense>
    </BrowserRouter>
    </ToastProvider>
  );
}
