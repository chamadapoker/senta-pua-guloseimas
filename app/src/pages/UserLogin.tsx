import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { useUserAuth } from '../hooks/useUserAuth';

export function UserLogin() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const { login, loading } = useUserAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    try {
      await login(email, senha);
      navigate(returnTo, { replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao fazer login');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-sm mx-auto py-10 animate-fade-in">
        <h1 className="font-display text-3xl text-azul tracking-wider mb-6 text-center">ENTRAR</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
              required
              autoComplete="current-password"
            />
          </div>
          {erro && <p className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
        <p className="text-center text-sm text-texto-fraco mt-4">
          Não tem conta? <Link to="/cadastro" state={{ returnTo }} className="text-azul font-medium hover:underline">Cadastre-se</Link>
        </p>
        <p className="text-center text-xs text-texto-fraco mt-6">
          <Link to="/admin/login" className="hover:underline">Acesso administrativo</Link>
        </p>
      </div>
    </AppLayout>
  );
}
