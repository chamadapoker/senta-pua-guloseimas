import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { inputClass } from '../../components/ui/Field';
import { useAuth, acessoRestritoCafeAgora, HOME_CAFE_GRADUADO } from '../../hooks/useAuth';
import { ESQUADRAO, NOME_MAIUSCULO, ALT_BRASAO } from '../../config/esquadrao';

// Porta de entrada do admin: tela cheia em azul-noite, sem o layout do app
export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErro('');
    try {
      await login(email, senha);
      // Responsável só pelo café dos graduados cai direto no painel do café
      navigate(acessoRestritoCafeAgora() ? HOME_CAFE_GRADUADO : '/admin');
    }
    catch (err) { setErro(err instanceof Error ? err.message : 'Erro ao fazer login'); }
  };

  return (
    <main className="min-h-[100dvh] bg-noite flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <img src={ESQUADRAO.imagens.brasao_grande} alt={ALT_BRASAO} width={96} height={96} className="w-24 h-24 object-contain" />
          <p className="font-display text-5xl text-white tracking-wider leading-none mt-5">{NOME_MAIUSCULO}</p>
          <span className="flamula-sm block w-12 h-1.5 bg-destaque mt-3" aria-hidden="true" />
          <p className="text-sm text-white/70 mt-3">Área administrativa do {ESQUADRAO.nome_completo}</p>
        </div>

        <div className="bg-white rounded-2xl overflow-hidden">
          <div className="h-1 bg-destaque" aria-hidden="true" />
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <h1 className="font-display text-2xl text-noite tracking-wide leading-none">Entrar como admin</h1>
              <p className="text-sm text-texto-fraco mt-1.5">Use o email e a senha do seu acesso de administrador.</p>
            </div>
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium mb-1.5">Email</label>
              <input id="login-email" type="email" autoComplete="username" inputMode="email" value={email}
                onChange={(e) => setEmail(e.target.value)} className={`${inputClass} min-h-[44px]`} required />
            </div>
            <div>
              <label htmlFor="login-senha" className="block text-sm font-medium mb-1.5">Senha</label>
              <input id="login-senha" type="password" autoComplete="current-password" value={senha}
                onChange={(e) => setSenha(e.target.value)} className={`${inputClass} min-h-[44px]`} required />
            </div>
            {erro && (
              <p role="alert" className="flex items-start gap-2 text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
                <span>{erro}</span>
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="inline-flex items-center gap-1.5 min-h-[40px] px-3 text-sm text-white/70 hover:text-white rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-white/40">
            <Icon name="arrow-left" size={16} /> Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}
