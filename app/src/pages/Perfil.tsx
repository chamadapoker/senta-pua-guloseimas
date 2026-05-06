import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '../components/ui/Button';
import { useUserAuth } from '../hooks/useUserAuth';
import { MeuCafe } from '../components/perfil/MeuCafe';
import { api } from '../services/api';
import { gerarExtratoUnificadoPDF } from '../services/pdf';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

export function Perfil() {
  const { user, token, checkAuth, updateProfile, updateFoto, removeFoto, logout, excluirConta } = useUserAuth();
  const [whatsapp, setWhatsapp] = useState('');
  const [saram, setSaram] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [verificando, setVerificando] = useState(true);
  const [modalExcluir, setModalExcluir] = useState(false);
  const [confirmouExclusao, setConfirmouExclusao] = useState(false);
  const [textoExclusao, setTextoExclusao] = useState('');
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
      setDataNascimento(user.data_nascimento || '');
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
      await updateProfile({ 
        whatsapp: whatsapp.trim(), 
        saram: saram.trim(),
        data_nascimento: dataNascimento || null
      });
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
        <BackButton to="/" className="mb-3" />
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

          <div>
            <label className="block text-sm font-medium text-texto-fraco mb-1.5">Data de Nascimento</label>
            <input
              type="date"
              value={dataNascimento}
              onChange={(e) => setDataNascimento(e.target.value)}
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
            />
            <p className="text-[10px] text-texto-fraco mt-1 ml-1 uppercase font-medium">Para receber surpresas no seu aniversário</p>
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
          onClick={async () => {
            try {
              type ExtData = { cliente: { nome_guerra: string }; guloseimas: { total: number; status: string; itens_resumo: string | null; created_at: string }[]; loja: { total: number; status: string; itens_resumo: string | null; created_at: string; parcelas: number }[]; cafe: { valor: number; status: string; referencia: string; cafe_tipo: string; cafe_plano: string }[]; ximboca: { status: string; evento_nome: string; evento_data: string; valor_por_pessoa: number; valor_individual: number | null }[] };
              const d = await api.get<ExtData>('/api/usuarios/me/extrato');
              const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
              const total = d.guloseimas.filter(p => p.status !== 'pago').reduce((s, p) => s + p.total, 0)
                + d.loja.filter(p => p.status !== 'pago').reduce((s, p) => s + p.total, 0)
                + d.cafe.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0)
                + d.ximboca.filter(p => p.status !== 'pago').reduce((s, p) => s + (p.valor_individual ?? p.valor_por_pessoa), 0);
              const cafeGraduado = d.cafe.some(p => p.cafe_tipo === 'graduado');
              await gerarExtratoUnificadoPDF(d.cliente.nome_guerra, {
                guloseimas: d.guloseimas.filter(p => p.status !== 'pago').map(p => ({ itens: p.itens_resumo || '-', valor: p.total, data: fmt(p.created_at) })),
                loja: d.loja.filter(p => p.status !== 'pago').map(p => ({ itens: p.itens_resumo || '-', valor: p.total, data: fmt(p.created_at), parcelas: p.parcelas })),
                cafe: d.cafe.filter(p => p.status === 'pendente').map(p => ({ referencia: p.referencia, valor: p.valor, tipo: `${p.cafe_tipo} - ${p.cafe_plano}` })),
                ximboca: d.ximboca.filter(p => p.status !== 'pago').map(p => ({ evento: p.evento_nome, data: fmt(p.evento_data + 'T12:00:00'), valor: p.valor_individual ?? p.valor_por_pessoa })),
              }, total, cafeGraduado);
            } catch (e) {
              alert('Erro ao gerar extrato: ' + (e instanceof Error ? e.message : 'desconhecido'));
            }
          }}
          className="w-full mt-4 bg-white border border-borda rounded-xl py-3 text-sm font-medium text-azul hover:bg-azul/5"
        >
          Baixar meu extrato (PDF)
        </button>

        <button
          onClick={() => { logout(); navigate('/'); }}
          className="w-full mt-2 text-center text-vermelho text-sm font-medium py-3 hover:underline"
        >
          Sair da conta
        </button>

        <div className="mt-6 pt-6 border-t border-borda">
          <button
            onClick={() => { setModalExcluir(true); setConfirmouExclusao(false); setTextoExclusao(''); setErro(''); }}
            className="w-full text-center text-vermelho text-xs py-3 hover:underline"
          >
            Excluir minha conta permanentemente (LGPD)
          </button>
          <p className="text-center text-[10px] text-texto-fraco mt-1">
            Você tem o direito de solicitar a exclusão total dos seus dados.
          </p>
        </div>

        {modalExcluir && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalExcluir(false)}>
            <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-display text-xl text-vermelho tracking-wider mb-2">EXCLUIR CONTA</h3>
              <p className="text-sm text-texto mb-3">
                Esta ação é <strong>irreversível</strong>. Serão apagados permanentemente:
              </p>
              <ul className="text-xs text-texto-fraco list-disc pl-5 mb-4 space-y-0.5">
                <li>Sua conta de usuário e foto</li>
                <li>Histórico de pedidos nas cantinas e loja</li>
                <li>Assinatura e pagamentos do café</li>
                <li>Participações em ximbocas</li>
              </ul>

              <label className="flex items-start gap-2 text-xs text-texto bg-red-50 rounded-lg p-3 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmouExclusao}
                  onChange={(e) => setConfirmouExclusao(e.target.checked)}
                  className="mt-0.5 accent-vermelho"
                />
                <span>Entendo que meus dados serão apagados e não poderão ser recuperados.</span>
              </label>

              <label className="block text-xs text-texto-fraco mb-1.5">Digite <strong>EXCLUIR</strong> para confirmar:</label>
              <input
                type="text"
                value={textoExclusao}
                onChange={(e) => setTextoExclusao(e.target.value)}
                className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-sm mb-4"
                placeholder="EXCLUIR"
              />

              {erro && <p className="text-vermelho text-xs mb-3">{erro}</p>}

              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => setModalExcluir(false)}>Cancelar</Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={!confirmouExclusao || textoExclusao !== 'EXCLUIR'}
                  onClick={async () => {
                    try {
                      await excluirConta();
                      navigate('/');
                    } catch (err) {
                      setErro(err instanceof Error ? err.message : 'Erro ao excluir conta');
                    }
                  }}
                >
                  Excluir conta
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
