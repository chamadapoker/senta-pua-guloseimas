import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { BackButton } from '../components/ui/BackButton';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useUserAuth } from '../hooks/useUserAuth';
import { Loading } from '../components/ui/Loading';
import { MeuCafe } from '../components/perfil/MeuCafe';
import { api } from '../services/api';
import { formatarDataBanco } from '../services/datas';
import { useConfirm } from '../hooks/useConfirm';
import { useToast } from '../hooks/useToast';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

export function Perfil() {
  const { user, token, checkAuth, updateProfile, updateFoto, removeFoto, logout, excluirConta } = useUserAuth();
  const confirm = useConfirm();
  const { showToast } = useToast();
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
  const [senhaExclusao, setSenhaExclusao] = useState('');
  const [erroExclusao, setErroExclusao] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [gerandoExtrato, setGerandoExtrato] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  // Callback estável para o Modal (ele refaz o foco quando onClose muda)
  const excluindoRef = useRef(false);
  excluindoRef.current = excluindo;
  const fecharExcluir = useCallback(() => { if (!excluindoRef.current) setModalExcluir(false); }, []);

  const verificar = () => {
    if (!token) {
      navigate('/login', { state: { returnTo: '/perfil' } });
      return;
    }
    setVerificando(true);
    checkAuth().then(ok => {
      if (!ok) navigate('/login', { state: { returnTo: '/perfil' } });
      setVerificando(false);
    });
  };

  useEffect(() => {
    verificar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      setWhatsapp(user.whatsapp);
      setSaram(user.saram);
      setDataNascimento(user.data_nascimento || '');
    }
  }, [user]);

  if (verificando) {
    return <AppLayout><Loading label="Carregando seu perfil..." /></AppLayout>;
  }

  // checkAuth falhou por rede e não há dados em cache
  if (!user) {
    return (
      <AppLayout>
        <div className="max-w-sm mx-auto py-16 text-center animate-fade-in">
          <p className="text-sm text-vermelho mb-4">Não foi possível carregar seu perfil. Verifique sua conexão.</p>
          <Button variant="outline" onClick={verificar}><Icon name="refresh" size={16} /> Tentar de novo</Button>
        </div>
      </AppLayout>
    );
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
      setMsg('Dados atualizados.');
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
      setMsg('Foto atualizada.');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar foto');
    }
  };

  const handleRemoveFoto = async () => {
    if (!(await confirm({ title: 'Remover foto', message: 'Remover sua foto de perfil?', confirmText: 'Remover', danger: true }))) return;
    setErro(''); setMsg('');
    try {
      await removeFoto();
      setMsg('Foto removida.');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao remover foto');
    }
  };

  const baixarExtrato = async () => {
    if (gerandoExtrato) return;
    setGerandoExtrato(true);
    try {
      const { gerarExtratoUnificadoPDF } = await import('../services/pdf');
      type ExtData = { cliente: { nome_guerra: string }; guloseimas: { total: number; status: string; itens_resumo: string | null; created_at: string }[]; loja: { total: number; status: string; itens_resumo: string | null; created_at: string; parcelas: number }[]; cafe: { valor: number; status: string; referencia: string; cafe_tipo: string; cafe_plano: string }[]; ximboca: { status: string; evento_nome: string; evento_data: string; valor_por_pessoa: number; valor_individual: number | null }[] };
      const d = await api.get<ExtData>('/api/usuarios/me/extrato');
      // created_at vem em UTC do banco; exibe no fuso de Brasília
      const fmt = (iso: string) => formatarDataBanco(iso);
      const total = d.guloseimas.filter(p => p.status !== 'pago').reduce((s, p) => s + p.total, 0)
        + d.loja.filter(p => p.status !== 'pago').reduce((s, p) => s + p.total, 0)
        + d.cafe.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0)
        + d.ximboca.filter(p => p.status !== 'pago').reduce((s, p) => s + (p.valor_individual ?? p.valor_por_pessoa), 0);
      const cafeGraduado = d.cafe.some(p => p.cafe_tipo === 'graduado');
      await gerarExtratoUnificadoPDF(d.cliente.nome_guerra, {
        guloseimas: d.guloseimas.filter(p => p.status !== 'pago').map(p => ({ itens: p.itens_resumo || '-', valor: p.total, data: fmt(p.created_at) })),
        loja: d.loja.filter(p => p.status !== 'pago').map(p => ({ itens: p.itens_resumo || '-', valor: p.total, data: fmt(p.created_at), parcelas: p.parcelas })),
        cafe: d.cafe.filter(p => p.status === 'pendente').map(p => ({ referencia: p.referencia, valor: p.valor, tipo: `${p.cafe_tipo} - ${p.cafe_plano}` })),
        ximboca: d.ximboca.filter(p => p.status !== 'pago').map(p => ({ evento: p.evento_nome, data: formatarDataBanco(p.evento_data), valor: p.valor_individual ?? p.valor_por_pessoa })),
      }, total, cafeGraduado);
    } catch (e) {
      showToast('Erro ao gerar extrato: ' + (e instanceof Error ? e.message : 'desconhecido'), 'error');
    } finally {
      setGerandoExtrato(false);
    }
  };

  const foto = resolveImg(user.foto_url);
  const campo = 'w-full bg-white border border-borda rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-azul/25 focus:border-azul';
  const rotulo = 'block text-sm font-medium text-texto mb-1.5';

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto animate-fade-in">
        <BackButton to="/" className="min-h-[44px] mb-1" />
        <PageHeader title="Meu perfil" />

        {/* Cabeçalho: foto e trigrama */}
        <Card size="lg" className="mb-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label={user.foto_url ? 'Trocar foto' : 'Adicionar foto'}
              className="relative w-20 h-20 shrink-0 rounded-full bg-noite flex items-center justify-center overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-azul/50 focus-visible:ring-offset-2"
            >
              {foto ? (
                <img src={foto} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-3xl text-white tracking-wide">{user.trigrama}</span>
              )}
              <span className="absolute bottom-0 inset-x-0 bg-noite/80 text-white text-[11px] py-0.5">Foto</span>
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFoto} className="hidden" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-4xl leading-none text-noite tracking-[0.12em]">{user.trigrama}</p>
              <p className="text-sm text-texto-fraco truncate mt-1">{user.email}</p>
              <div className="flex gap-1 mt-1.5 -ml-2">
                <button type="button" onClick={() => fileRef.current?.click()} className="min-h-[36px] px-2 text-sm font-medium text-azul hover:underline">
                  {user.foto_url ? 'Trocar foto' : 'Adicionar foto'}
                </button>
                {user.foto_url && (
                  <button type="button" onClick={handleRemoveFoto} className="min-h-[36px] px-2 text-sm font-medium text-vermelho hover:underline">Remover</button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Dados */}
        <Card size="lg" className="mb-4">
          <h2 className="text-[15px] font-semibold text-noite mb-4">Meus dados</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="perfil-saram" className={rotulo}>SARAM</label>
                <input
                  id="perfil-saram"
                  type="text"
                  inputMode="numeric"
                  value={saram}
                  onChange={(e) => setSaram(e.target.value.replace(/\D/g, ''))}
                  className={campo}
                />
              </div>
              <div>
                <label htmlFor="perfil-whatsapp" className={rotulo}>WhatsApp com DDD</label>
                <input
                  id="perfil-whatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                  className={campo}
                />
              </div>
            </div>
            <div>
              <label htmlFor="perfil-nascimento" className={rotulo}>Data de nascimento</label>
              <input
                id="perfil-nascimento"
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
                className={campo}
              />
              <p className="text-xs text-texto-fraco mt-1">Usada para a surpresa no seu aniversário.</p>
            </div>

            {erro && <p role="alert" className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}
            {msg && <p role="status" className="text-verde-escuro text-sm bg-green-50 border border-green-200 rounded-xl px-3 py-2">{msg}</p>}

            <Button type="submit" className="w-full sm:w-auto" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </form>
        </Card>

        {/* Café */}
        <div className="mb-4">
          <MeuCafe />
        </div>

        {/* Extrato */}
        <Card className="mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <h2 className="text-[15px] font-semibold text-noite">Extrato</h2>
              <p className="text-sm text-texto-fraco">Tudo o que está em aberto em cantina, loja, café e ximboca, em PDF.</p>
            </div>
            <Button variant="ghost" onClick={baixarExtrato} disabled={gerandoExtrato}>
              <Icon name="download" size={16} /> {gerandoExtrato ? 'Gerando...' : 'Baixar PDF'}
            </Button>
          </div>
        </Card>

        <Button variant="ghost" size="lg" className="w-full mb-8" onClick={() => { logout(); navigate('/'); }}>
          <Icon name="logout" size={18} /> Sair da conta
        </Button>

        {/* Zona de perigo: discreta, no fim */}
        <section aria-labelledby="perfil-privacidade" className="rounded-2xl border border-red-200 bg-white p-4 mb-4">
          <h2 id="perfil-privacidade" className="text-sm font-semibold text-texto">Privacidade e dados</h2>
          <p className="text-sm text-texto-fraco mt-1">
            Você pode pedir a exclusão total dos seus dados (LGPD). Veja a{' '}
            <Link to="/privacidade" className="text-azul underline underline-offset-2">Política de Privacidade</Link>.
          </p>
          <Button
            variant="chip-danger"
            size="sm"
            className="mt-3"
            onClick={() => { setModalExcluir(true); setConfirmouExclusao(false); setTextoExclusao(''); setSenhaExclusao(''); setErroExclusao(''); }}
          >
            <Icon name="trash" size={16} /> Excluir minha conta
          </Button>
        </section>

        <Modal open={modalExcluir} onClose={fecharExcluir} title="Excluir conta">
          <p className="text-sm text-texto mb-2">
            Esta ação é <strong>irreversível</strong>. Serão apagados permanentemente:
          </p>
          <ul className="text-sm text-texto-fraco list-disc pl-5 mb-4 space-y-0.5">
            <li>Sua conta de usuário e foto</li>
            <li>Histórico de pedidos nas cantinas e loja</li>
            <li>Assinatura e pagamentos do café</li>
            <li>Participações em ximbocas</li>
          </ul>

          <label className="flex items-start gap-3 text-sm text-texto bg-red-50 border border-red-200 rounded-xl p-3 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmouExclusao}
              onChange={(e) => setConfirmouExclusao(e.target.checked)}
              className="mt-0.5 w-5 h-5 shrink-0 accent-vermelho"
            />
            <span>Entendo que meus dados serão apagados e não poderão ser recuperados.</span>
          </label>

          <label htmlFor="excluir-texto" className="block text-sm font-medium mb-1.5">Digite <strong>EXCLUIR</strong> para confirmar</label>
          <input
            id="excluir-texto"
            type="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            value={textoExclusao}
            onChange={(e) => setTextoExclusao(e.target.value)}
            className={`${campo} mb-4`}
            placeholder="EXCLUIR"
          />

          <label htmlFor="excluir-senha" className="block text-sm font-medium mb-1.5">Sua senha atual</label>
          <input
            id="excluir-senha"
            type="password"
            autoComplete="current-password"
            value={senhaExclusao}
            onChange={(e) => setSenhaExclusao(e.target.value)}
            className={campo}
          />
          <p className="text-xs text-texto-fraco mt-1.5 mb-4">
            Contas com débito em aberto (cantina, loja, café ou ximboca) não podem ser excluídas.
          </p>

          {erroExclusao && <p role="alert" className="text-vermelho text-sm mb-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erroExclusao}</p>}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={fecharExcluir} disabled={excluindo}>Cancelar</Button>
            <Button
              variant="danger"
              disabled={!confirmouExclusao || textoExclusao !== 'EXCLUIR' || !senhaExclusao || excluindo}
              onClick={async () => {
                if (excluindo) return;
                setExcluindo(true);
                setErroExclusao('');
                try {
                  await excluirConta(senhaExclusao);
                  showToast('Conta excluída', 'success');
                  navigate('/');
                } catch (err) {
                  // Mensagem do servidor: senha incorreta (403), débito em aberto (409), limite de tentativas (429)
                  setErroExclusao(err instanceof Error ? err.message : 'Erro ao excluir conta');
                } finally {
                  setExcluindo(false);
                }
              }}
            >
              {excluindo ? 'Excluindo...' : 'Excluir conta'}
            </Button>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
