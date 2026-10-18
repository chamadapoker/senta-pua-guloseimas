import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useUserAuth } from '../hooks/useUserAuth';
import { TelaEntrada, campoEntrada, rotuloEntrada } from './TelaEntrada';

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
    <TelaEntrada
      titulo="Entrar"
      subtitulo="Cantinas, loja, café e ximboca na sua conta."
      rodape={
        <>
          <p>
            Ainda não tem conta?{' '}
            <Link to="/cadastro" state={{ returnTo }} className="text-white font-semibold underline underline-offset-4">Criar conta</Link>
          </p>
          <p>
            <Link to="/admin/login" className="text-noite-fraco hover:text-white underline-offset-4 hover:underline">Acesso administrativo</Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className={rotuloEntrada}>E-mail</label>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={campoEntrada}
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="login-senha" className={rotuloEntrada}>Senha</label>
          <input
            id="login-senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className={campoEntrada}
            required
            autoComplete="current-password"
          />
        </div>
        {erro && <p role="alert" className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
    </TelaEntrada>
  );
}
