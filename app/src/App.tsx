import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
import { Login } from './pages/admin/Login';
import { Dashboard } from './pages/admin/Dashboard';
import { Produtos } from './pages/admin/Produtos';
import { Clientes } from './pages/admin/Clientes';
import { ClienteExtrato } from './pages/admin/ClienteExtrato';
import { Pedidos } from './pages/admin/Pedidos';
import { Configuracoes } from './pages/admin/Configuracoes';
import { Relatorios } from './pages/admin/Relatorios';
import { Usuarios } from './pages/admin/Usuarios';
import { Admins } from './pages/admin/Admins';
import { Comprovantes } from './pages/admin/Comprovantes';
import { Auditoria } from './pages/admin/Auditoria';
import { CafeDespesas } from './pages/admin/cafe/CafeDespesas';
import { Lucratividade } from './pages/admin/Lucratividade';
import { Cobrancas } from './pages/admin/Cobrancas';
import { CaixaConsolidado } from './pages/admin/CaixaConsolidado';
import { LojaDashboard } from './pages/admin/loja/LojaDashboard';
import { LojaProdutos } from './pages/admin/loja/LojaProdutos';
import { LojaPedidos } from './pages/admin/loja/LojaPedidos';
import { CafeDashboard } from './pages/admin/cafe/CafeDashboard';
import { CafeMensalidades } from './pages/admin/cafe/CafeMensalidades';
import { CafeInsumos } from './pages/admin/cafe/CafeInsumos';
import { CafeAssinantes } from './pages/admin/cafe/CafeAssinantes';
import { XimbocaDashboard } from './pages/admin/ximboca/XimbocaDashboard';
import { XimbocaEventos } from './pages/admin/ximboca/XimbocaEventos';
import { XimbocaEvento } from './pages/admin/ximboca/XimbocaEvento';
import { XimbocaEstoque } from './pages/admin/ximboca/XimbocaEstoque';
import { Documentacao } from './pages/admin/Documentacao';
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
  if (!autenticado) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

function UserAuthLoader() {
  const { token, checkAuth } = useUserAuth();
  useEffect(() => {
    if (token) checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  );
}
