import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicLayout } from '../../components/Layout';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    try {
      await login(email, senha);
      navigate('/admin');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao fazer login');
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-sm mx-auto py-10 animate-fade-in">
        <h1 className="font-display text-3xl text-white tracking-wider mb-6 text-center">ADMIN</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-fundo-card border border-borda rounded-xl px-4 py-3 text-texto focus:outline-none focus:ring-2 focus:ring-dourado/50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Senha</label>
            <input
              type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
              className="w-full bg-fundo-card border border-borda rounded-xl px-4 py-3 text-texto focus:outline-none focus:ring-2 focus:ring-dourado/50"
              required
            />
          </div>
          {erro && <p className="text-vermelho text-sm bg-vermelho/10 border border-vermelho/20 rounded-lg px-3 py-2">{erro}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </div>
    </PublicLayout>
  );
}
