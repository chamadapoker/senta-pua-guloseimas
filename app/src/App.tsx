import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Home } from './pages/Home';
import { Catalogo } from './pages/Catalogo';
import { Checkout } from './pages/Checkout';
import { PixPage } from './pages/PixPage';
import { Obrigado } from './pages/Obrigado';
import { Login } from './pages/admin/Login';
import { Dashboard } from './pages/admin/Dashboard';
import { Produtos } from './pages/admin/Produtos';
import { Clientes } from './pages/admin/Clientes';
import { ClienteExtrato } from './pages/admin/ClienteExtrato';
import { Pedidos } from './pages/admin/Pedidos';
import { Configuracoes } from './pages/admin/Configuracoes';
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
import { CafePublico } from './pages/CafePublico';
import { LojaPublica } from './pages/LojaPublica';
import { useAuth } from './hooks/useAuth';

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

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalogo/:categoria" element={<Catalogo />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/pix/:pedidoId" element={<PixPage />} />
        <Route path="/obrigado" element={<Obrigado />} />
        <Route path="/loja" element={<LojaPublica />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={<AdminGuard><Dashboard /></AdminGuard>} />
        <Route path="/admin/produtos" element={<AdminGuard><Produtos /></AdminGuard>} />
        <Route path="/admin/clientes" element={<AdminGuard><Clientes /></AdminGuard>} />
        <Route path="/admin/clientes/:id" element={<AdminGuard><ClienteExtrato /></AdminGuard>} />
        <Route path="/admin/pedidos" element={<AdminGuard><Pedidos /></AdminGuard>} />
        <Route path="/admin/config" element={<AdminGuard><Configuracoes /></AdminGuard>} />
        {/* Loja Militar */}
        <Route path="/admin/loja" element={<AdminGuard><LojaDashboard /></AdminGuard>} />
        <Route path="/admin/loja/produtos" element={<AdminGuard><LojaProdutos /></AdminGuard>} />
        <Route path="/admin/loja/pedidos" element={<AdminGuard><LojaPedidos /></AdminGuard>} />
        {/* Caixinha do Café */}
        <Route path="/admin/cafe" element={<AdminGuard><CafeDashboard /></AdminGuard>} />
        <Route path="/admin/cafe/mensalidades" element={<AdminGuard><CafeMensalidades /></AdminGuard>} />
        <Route path="/admin/cafe/insumos" element={<AdminGuard><CafeInsumos /></AdminGuard>} />
        <Route path="/admin/cafe/assinantes" element={<AdminGuard><CafeAssinantes /></AdminGuard>} />
        {/* Ximboca */}
        <Route path="/admin/ximboca" element={<AdminGuard><XimbocaDashboard /></AdminGuard>} />
        <Route path="/admin/ximboca/eventos" element={<AdminGuard><XimbocaEventos /></AdminGuard>} />
        <Route path="/admin/ximboca/eventos/:id" element={<AdminGuard><XimbocaEvento /></AdminGuard>} />
        <Route path="/admin/ximboca/estoque" element={<AdminGuard><XimbocaEstoque /></AdminGuard>} />
        {/* Cafe Publico */}
        <Route path="/cafe" element={<CafePublico />} />
      </Routes>
    </BrowserRouter>
  );
}
