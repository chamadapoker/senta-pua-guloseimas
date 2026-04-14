import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { Button } from '../components/ui/Button';
import { useUserAuth } from '../hooks/useUserAuth';
import { MeuCafe } from '../components/perfil/MeuCafe';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

export function Perfil() {
  const { user, token, checkAuth, updateProfile, updateFoto, removeFoto, logout, excluirConta } = useUserAuth();
  const [whatsapp, setWhatsapp] = useState('');
  const [saram, setSaram] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [verificando, setVerificando] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login', { state: { returnTo: '/perfil' } });
      return;
    }
    checkAuth().then(ok => {
      if (!ok) navigate('/login', { state: { returnTo: '/perfil' } });
      setVerificando(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      setWhatsapp(user.whatsapp);
      setSaram(user.saram);
    }
  }, [user]);

  if (verificando || !user) {
    return <AppLayout><div className="text-center py-20 text-gray-400">Carregando...</div></AppLayout>;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(''); setMsg('');
    setSalvando(true);
    try {
      await updateProfile({ whatsapp: whatsapp.trim(), saram: saram.trim() });
      setMsg('Dados atualizados!');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErro('Foto deve ter no máximo 2MB');
      return;
    }
    setErro(''); setMsg('');
    try {
      await updateFoto(file);
      setMsg('Foto atualizada!');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar foto');
    }
  };

  const handleRemoveFoto = async () => {
    setErro(''); setMsg('');
    try {
      await removeFoto();
      setMsg('Foto removida!');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao remover foto');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-sm mx-auto py-6 animate-fade-in">
        <h1 className="font-display text-3xl text-azul tracking-wider mb-6 text-center">MEU PERFIL</h1>

        <div className="flex flex-col items-center mb-6">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-28 h-28 rounded-full bg-fundo border-2 border-borda flex items-center justify-center overflow-hidden hover:border-azul transition-colors mb-2"
          >
            {resolveImg(user.foto_url) ? (
              <img src={resolveImg(user.foto_url)!} alt={user.trigrama} className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-3xl text-azul">{user.trigrama}</span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFoto} className="hidden" />
          <div className="flex gap-3 text-xs">
            <button type="button" onClick={() => fileRef.current?.click()} className="text-azul hover:underline">
              {user.foto_url ? 'Trocar foto' : 'Adicionar foto'}
            </button>
            {user.foto_url && (
              <button type="button" onClick={handleRemoveFoto} className="text-vermelho hover:underline">Remover</button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-borda p-4 mb-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-texto-fraco">Email</span>
            <span className="font-medium truncate ml-2">{user.email}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-texto-fraco">Trigrama</span>
            <span className="font-display text-azul text-lg tracking-widest">{user.trigrama}</span>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">SARAM</label>
            <input
              type="text"
              inputMode="numeric"
              value={saram}
              onChange={(e) => setSaram(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">WhatsApp</label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
            />
          </div>

          {erro && <p className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}
          {msg && <p className="text-verde text-sm bg-green-50 border border-green-200 rounded-xl px-3 py-2">{msg}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </form>

        <div className="mt-5">
          <MeuCafe />
        </div>

        <button
          onClick={() => { logout(); navigate('/'); }}
          className="w-full mt-4 text-center text-vermelho text-sm font-medium py-3 hover:underline"
        >
          Sair da conta
        </button>

        <div className="mt-6 pt-6 border-t border-borda">
          <button
            onClick={async () => {
              const confirmacao = window.prompt(
                'Esta ação é IRREVERSÍVEL. Todos os seus dados serão apagados (perfil, histórico de pedidos, participações em ximboca, assinatura de café).\n\nDigite EXCLUIR para confirmar:'
              );
              if (confirmacao !== 'EXCLUIR') return;
              try {
                await excluirConta();
                navigate('/');
              } catch (err) {
                setErro(err instanceof Error ? err.message : 'Erro ao excluir conta');
              }
            }}
            className="w-full text-center text-vermelho text-xs py-3 hover:underline"
          >
            Excluir minha conta permanentemente (LGPD)
          </button>
          <p className="text-center text-[10px] text-texto-fraco mt-1">
            Você tem o direito de solicitar a exclusão total dos seus dados.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
