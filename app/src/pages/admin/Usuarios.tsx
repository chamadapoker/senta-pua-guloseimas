import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Button } from '../../components/ui/Button';
import { Menu } from '../../components/ui/Menu';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { Field, inputClass } from '../../components/ui/Field';
import { Toggle } from '../../components/ui/Toggle';
import { Icon } from '../../components/ui/Icon';
import { api } from '../../services/api';
import { dataLocal } from '../../services/periodo';
import { Loading } from '../../components/ui/Loading';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import type { Usuario, Categoria } from '../../types';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

const CATEGORIA_LABEL: Record<Categoria, string> = {
  oficial: 'Oficial',
  graduado: 'Graduado/SO',
  praca: 'Praça',
};

type FiltroStatus = 'todos' | 'ativos' | 'desativados' | 'visitantes' | 'expirados';
type FiltroCategoria = 'todas' | 'oficial' | 'graduado' | 'praca';

const FILTROS_STATUS: { id: FiltroStatus; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'ativos', label: 'Ativos' },
  { id: 'desativados', label: 'Desativados' },
  { id: 'visitantes', label: 'Visitantes' },
  { id: 'expirados', label: 'Visitantes expirados' },
];

const FILTROS_CATEGORIA: { id: FiltroCategoria; label: string }[] = [
  { id: 'todas', label: 'Todas as categorias' },
  { id: 'oficial', label: 'Oficiais' },
  { id: 'graduado', label: 'Graduados' },
  { id: 'praca', label: 'Praças' },
];

type EditForm = { trigrama: string; email: string; saram: string; whatsapp: string; esquadrao_origem: string; data_nascimento: string };

const chipClass = (ativo: boolean) =>
  `min-h-[40px] px-3.5 rounded-full text-sm font-medium border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${
    ativo ? 'bg-noite text-white border-noite' : 'bg-white text-texto-fraco border-borda hover:text-texto hover:border-borda-forte'
  }`;

// Situação do acesso de visitante (prazo/pausa)
function situacaoVisitante(u: Usuario): { texto: string; classe: string } | null {
  if (u.acesso_pausado === 1) return { texto: 'Acesso pausado', classe: 'bg-red-50 text-vermelho border-red-200' };
  if (!u.expira_em) return null;
  const alvo = new Date(u.expira_em + 'T00:00:00');
  const dias = Math.ceil((alvo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (dias < 0) return { texto: `Expirou há ${-dias} ${-dias === 1 ? 'dia' : 'dias'}`, classe: 'bg-red-50 text-vermelho border-red-200' };
  if (dias === 0) return { texto: 'Expira hoje', classe: 'bg-amber-50 text-amber-700 border-amber-200' };
  return {
    texto: `${dias} ${dias === 1 ? 'dia restante' : 'dias restantes'}`,
    classe: dias <= 5 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-verde-escuro border-green-200',
  };
}

export function Usuarios() {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroCarga, setErroCarga] = useState('');
  const [searchParams] = useSearchParams();
  const admin = useAuth(s => s.admin);
  const isSuperAdmin = admin?.role === 'super_admin';
  const filtroStatus: FiltroStatus = (() => {
    const f = searchParams.get('f');
    if (f === 'ativos' || f === 'desativados' || f === 'visitantes' || f === 'expirados') return f;
    return 'todos';
  })();
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoria>('todas');
  const [busca, setBusca] = useState(searchParams.get('trigrama') || '');

  const [senhaModal, setSenhaModal] = useState<Usuario | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [senhaErro, setSenhaErro] = useState('');
  const [editModal, setEditModal] = useState<Usuario | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    trigrama: '', email: '', saram: '', whatsapp: '', esquadrao_origem: '', data_nascimento: '',
  });
  const [editErro, setEditErro] = useState('');
  const [novoModal, setNovoModal] = useState(false);
  const [novoErro, setNovoErro] = useState('');
  const [novoForm, setNovoForm] = useState({
    trigrama: '',
    email: '',
    saram: '',
    whatsapp: '',
    categoria: 'oficial' as Categoria,
    senha: '',
    is_visitante: false,
    esquadrao_origem: '',
    expira_em: '',
    data_nascimento: ''
  });
  const [acaoLoading, setAcaoLoading] = useState<number | null>(null);

  // Callbacks estáveis: o Modal refaz o foco quando onClose muda
  const fecharSenha = useCallback(() => setSenhaModal(null), []);
  const fecharEditar = useCallback(() => setEditModal(null), []);
  const fecharNovo = useCallback(() => setNovoModal(false), []);

  const falha = (e: unknown, padrao: string) => showToast(e instanceof Error ? e.message : padrao, 'error');

  const carregar = async () => {
    setLoading(true);
    setErroCarga('');
    try {
      const data = await api.get<Usuario[]>('/api/usuarios/admin/lista');
      setUsuarios(data);
    } catch (e) {
      setErroCarga(e instanceof Error ? e.message : 'Não foi possível carregar os usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const hoje = dataLocal(new Date());
    return usuarios.filter(u => {
      if (busca) {
        const q = busca.toLowerCase();
        if (!u.trigrama.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      // Filtro status (vindo do sidebar ou dos chips)
      if (filtroStatus === 'ativos' && u.ativo !== 1) return false;
      if (filtroStatus === 'desativados' && u.ativo !== 0) return false;
      if (filtroStatus === 'visitantes' && u.is_visitante !== 1) return false;
      if (filtroStatus === 'expirados') {
        const expirado = u.is_visitante === 1 && (
          u.acesso_pausado === 1 || (!!u.expira_em && u.expira_em < hoje)
        );
        if (!expirado) return false;
      }
      // Filtro categoria (in-page)
      if (filtroCategoria !== 'todas' && u.categoria !== filtroCategoria) return false;
      return true;
    });
  }, [usuarios, filtroStatus, filtroCategoria, busca]);

  const salvarVisitante = async (u: Usuario, patch: { expira_em?: string; acesso_pausado?: number }) => {
    setAcaoLoading(u.id);
    try {
      await api.put(`/api/usuarios/admin/${u.id}/visitante`, patch);
      showToast(`${u.trigrama}: atualizado`, 'success');
      await carregar();
    } catch (e) {
      falha(e, 'Erro ao salvar');
    } finally {
      setAcaoLoading(null);
    }
  };

  const toggleFiado = async (u: Usuario) => {
    const novo = u.permite_fiado === 1 ? 0 : 1;
    setAcaoLoading(u.id);
    try {
      await api.put(`/api/usuarios/admin/${u.id}/fiado`, { permite_fiado: novo });
      showToast(`${u.trigrama}: fiado ${novo === 1 ? 'liberado' : 'bloqueado'}`, 'success');
      await carregar();
    } catch (e) {
      falha(e, 'Erro ao salvar');
    } finally {
      setAcaoLoading(null);
    }
  };

  const toggleRecepcionista = async (u: Usuario) => {
    const novo = u.is_recepcionista === 1 ? 0 : 1;
    setAcaoLoading(u.id);
    try {
      await api.put(`/api/usuarios/admin/${u.id}/recepcionista`, { is_recepcionista: novo });
      showToast(`${u.trigrama}: recepcionista ${novo === 1 ? 'habilitado' : 'desabilitado'}`, 'success');
      await carregar();
    } catch (e) {
      falha(e, 'Erro ao salvar');
    } finally {
      setAcaoLoading(null);
    }
  };

  const trocarCategoria = async (u: Usuario, cat: Categoria) => {
    setAcaoLoading(u.id);
    try {
      await api.put(`/api/usuarios/admin/${u.id}/categoria`, { categoria: cat });
      showToast(`${u.trigrama}: categoria alterada`, 'success');
      await carregar();
    } catch (e) {
      falha(e, 'Erro ao alterar categoria');
    } finally {
      setAcaoLoading(null);
    }
  };

  const abrirResetSenha = (u: Usuario) => {
    setSenhaModal(u);
    setNovaSenha('');
    setSenhaErro('');
  };

  const confirmarResetSenha = async () => {
    if (!senhaModal || novaSenha.length < 6) {
      setSenhaErro('A senha precisa ter no mínimo 6 caracteres');
      return;
    }
    setAcaoLoading(senhaModal.id);
    setSenhaErro('');
    try {
      await api.put(`/api/usuarios/admin/${senhaModal.id}/senha`, { nova_senha: novaSenha });
      showToast(`Senha de ${senhaModal.trigrama} redefinida`, 'success');
      setSenhaModal(null);
      setNovaSenha('');
    } catch (e) {
      setSenhaErro(e instanceof Error ? e.message : 'Erro ao redefinir senha');
    } finally {
      setAcaoLoading(null);
    }
  };

  const abrirEditar = (u: Usuario) => {
    setEditModal(u);
    setEditForm({
      trigrama: u.trigrama,
      email: u.email,
      saram: u.saram,
      whatsapp: u.whatsapp,
      esquadrao_origem: u.esquadrao_origem || '',
      data_nascimento: u.data_nascimento || '',
    });
    setEditErro('');
  };

  const salvarEditar = async () => {
    if (!editModal) return;
    setEditErro('');

    const tri = editForm.trigrama.trim().toUpperCase();
    if (!/^[A-ZÀ-ÚÖ]{3}$/.test(tri)) { setEditErro('O trigrama deve ter exatamente 3 letras'); return; }
    const em = editForm.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setEditErro('E-mail inválido'); return; }
    const sa = editForm.saram.trim();
    if (!/^\d+$/.test(sa)) { setEditErro('O SARAM deve conter apenas números'); return; }
    const wp = editForm.whatsapp.trim();
    if (!wp) { setEditErro('Informe o WhatsApp'); return; }

    const payload: Record<string, string | null> = {
      trigrama: tri,
      email: em,
      saram: sa,
      whatsapp: wp,
      data_nascimento: editForm.data_nascimento || null,
    };
    if (editModal.is_visitante === 1) {
      payload.esquadrao_origem = editForm.esquadrao_origem.trim().toUpperCase() || null;
    }

    setAcaoLoading(editModal.id);
    try {
      await api.put(`/api/usuarios/admin/${editModal.id}`, payload);
      showToast(`${tri}: dados atualizados`, 'success');
      setEditModal(null);
      await carregar();
    } catch (e) {
      setEditErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setAcaoLoading(null);
    }
  };

  const excluirUsuario = async (u: Usuario) => {
    const aviso = `Excluir o usuário ${u.trigrama}? Esta ação não pode ser desfeita e remove:\n- Conta do usuário\n- Cliente vinculado\n- Pedidos da cantina e itens\n- Pedidos da loja, parcelas e itens\n- Assinaturas e pagamentos do café\n- Foto de perfil`;
    if (!(await confirm({ title: 'Excluir conta', message: aviso, confirmText: 'Excluir definitivamente', danger: true }))) return;

    setAcaoLoading(u.id);
    try {
      await api.delete(`/api/usuarios/admin/${u.id}`);
      showToast(`${u.trigrama}: usuário excluído`, 'success');
      await carregar();
    } catch (e) {
      falha(e, 'Erro ao excluir usuário');
    } finally {
      setAcaoLoading(null);
    }
  };

  const toggleAtivo = async (u: Usuario) => {
    const acao = u.ativo === 1 ? 'desativar' : 'ativar';
    if (!(await confirm({ message: `Confirma ${acao} a conta de ${u.trigrama}?`, confirmText: u.ativo === 1 ? 'Desativar' : 'Ativar' }))) return;
    setAcaoLoading(u.id);
    try {
      await api.put(`/api/usuarios/admin/${u.id}/${acao}`, {});
      showToast(`${u.trigrama}: conta ${u.ativo === 1 ? 'desativada' : 'reativada'}`, 'success');
      await carregar();
    } catch (e) {
      falha(e, `Erro ao ${acao}`);
    } finally {
      setAcaoLoading(null);
    }
  };

  const salvarNovo = async () => {
    setNovoErro('');
    const { trigrama, email, saram, whatsapp, categoria, senha, is_visitante, esquadrao_origem, expira_em } = novoForm;

    if (!trigrama || !email || !saram || !whatsapp || !categoria || !senha) {
      setNovoErro('Preencha todos os campos obrigatórios');
      return;
    }

    setAcaoLoading(999999);
    try {
      await api.post('/api/usuarios/admin', {
        ...novoForm,
        is_visitante: is_visitante ? 1 : 0,
        expira_em: expira_em || null,
        esquadrao_origem: esquadrao_origem || null,
      });
      showToast(`Usuário ${trigrama} criado`, 'success');
      setNovoModal(false);
      setNovoForm({
        trigrama: '', email: '', saram: '', whatsapp: '', categoria: 'oficial', senha: '',
        is_visitante: false, esquadrao_origem: '', expira_em: '', data_nascimento: ''
      });
      await carregar();
    } catch (e) {
      setNovoErro(e instanceof Error ? e.message : 'Erro ao criar usuário');
    } finally {
      setAcaoLoading(null);
    }
  };

  const filtrosAtivos = filtroStatus !== 'todos' || filtroCategoria !== 'todas' || !!busca;
  const linkStatus = (f: FiltroStatus) => (f === 'todos' ? '/admin/usuarios' : `/admin/usuarios?f=${f}`);

  return (
    <AppLayout>
      <PageHeader
        title="Usuários"
        subtitle="Contas dos militares e visitantes: categoria, fiado, acesso e dados de cadastro."
        right={
          <Button size="sm" onClick={() => { setNovoErro(''); setNovoModal(true); }}>
            <Icon name="plus" size={16} /> Novo usuário
          </Button>
        }
      />

      {/* Busca + filtros */}
      <div className="space-y-3 mb-5">
        <div>
          <label htmlFor="busca-usuarios" className="sr-only">Buscar usuários</label>
          <input
            id="busca-usuarios"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por trigrama ou e-mail"
            className={`${inputClass} min-h-[44px]`}
          />
        </div>
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filtrar por situação">
          {FILTROS_STATUS.map(f => (
            <Link key={f.id} to={linkStatus(f.id)} className={`${chipClass(filtroStatus === f.id)} inline-flex items-center`} aria-current={filtroStatus === f.id ? 'true' : undefined}>
              {f.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filtrar por categoria">
          {FILTROS_CATEGORIA.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroCategoria(f.id)}
              aria-pressed={filtroCategoria === f.id}
              className={chipClass(filtroCategoria === f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {!loading && !erroCarga && (
          <p className="text-sm text-texto-fraco">
            {filtrados.length} de {usuarios.length} {usuarios.length === 1 ? 'usuário' : 'usuários'}
          </p>
        )}
      </div>

      {loading ? (
        <Loading />
      ) : erroCarga ? (
        <div className="bg-white rounded-2xl border border-borda">
          <EmptyState
            icon={<Icon name="warning" size={24} />}
            message="Não foi possível carregar os usuários"
            hint={erroCarga}
            action={<Button variant="ghost" size="sm" onClick={carregar}><Icon name="refresh" size={16} /> Tentar de novo</Button>}
          />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-borda">
          {usuarios.length === 0 ? (
            <EmptyState
              icon={<Icon name="users" size={24} />}
              message="Nenhum usuário cadastrado ainda"
              hint="Os militares se cadastram pelo app. Você também pode criar uma conta aqui."
              action={<Button size="sm" onClick={() => { setNovoErro(''); setNovoModal(true); }}><Icon name="plus" size={16} /> Novo usuário</Button>}
            />
          ) : (
            <EmptyState
              icon={<Icon name="users" size={24} />}
              message="Nenhum usuário encontrado"
              hint="Ajuste a busca ou os filtros para ver mais resultados."
              action={filtrosAtivos ? (
                <Link to="/admin/usuarios" onClick={() => { setBusca(''); setFiltroCategoria('todas'); }} className="inline-flex items-center min-h-[40px] px-3.5 rounded-xl text-sm font-medium bg-white border border-borda hover:bg-fundo-elevado">
                  Limpar filtros
                </Link>
              ) : undefined}
            />
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtrados.map(u => {
            const ocupado = acaoLoading === u.id;
            const situacao = u.is_visitante === 1 ? situacaoVisitante(u) : null;
            const foto = resolveImg(u.foto_url);
            return (
              <article
                key={u.id}
                className={`bg-white rounded-2xl border border-borda shadow-sm p-4 min-w-0 flex flex-col ${u.ativo === 0 ? 'opacity-70' : ''}`}
              >
                {/* Identificação + menu */}
                <div className="flex items-start gap-3">
                  {foto ? (
                    <img src={foto} alt="" className="w-12 h-12 rounded-full object-cover border border-borda shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-noite/5 border border-borda flex items-center justify-center font-display text-noite text-base shrink-0" aria-hidden="true">
                      {u.trigrama}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display text-noite text-2xl leading-none tracking-wide">{u.trigrama}</span>
                      {u.is_visitante === 1 && (
                        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Visitante</span>
                      )}
                      {u.ativo === 0 && (
                        <span className="text-xs text-vermelho bg-red-50 border border-red-200 px-2 py-0.5 rounded-full font-medium">Desativada</span>
                      )}
                    </div>
                    <div className="text-sm text-texto-fraco truncate mt-1">{u.email}</div>
                    <div className="text-xs text-texto-fraco mt-0.5">
                      {CATEGORIA_LABEL[u.categoria as Categoria]}
                      {u.sala_cafe && <> · Cantina {u.sala_cafe === 'oficiais' ? 'dos oficiais' : 'dos graduados'}</>}
                    </div>
                  </div>
                  <div className="shrink-0 -mr-1">
                    <Menu label={`Ações de ${u.trigrama}`} items={[
                      { label: 'Editar dados', icon: 'pencil', disabled: ocupado, onClick: () => abrirEditar(u) },
                      { label: 'Redefinir senha', icon: 'refresh', disabled: ocupado, onClick: () => abrirResetSenha(u) },
                      { label: u.ativo === 1 ? 'Desativar conta' : 'Reativar conta', icon: u.ativo === 1 ? 'x' : 'check', disabled: ocupado, onClick: () => toggleAtivo(u) },
                      isSuperAdmin && { label: 'Excluir conta', icon: 'trash', danger: true, disabled: ocupado, onClick: () => excluirUsuario(u) },
                    ]} />
                  </div>
                </div>

                {/* Visitante: prazo e pausa */}
                {u.is_visitante === 1 && (
                  <div className="mt-3 p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="text-amber-800 font-medium">Acesso de visitante</span>
                      {u.esquadrao_origem && <span className="text-texto-fraco">· {u.esquadrao_origem}</span>}
                      {situacao && (
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full border font-medium ${situacao.classe}`}>{situacao.texto}</span>
                      )}
                    </div>
                    <div className="flex gap-3 flex-wrap items-center">
                      <label htmlFor={`expira-${u.id}`} className="text-sm text-texto-fraco">Expira em</label>
                      <input
                        id={`expira-${u.id}`}
                        type="date"
                        defaultValue={u.expira_em || ''}
                        onBlur={(e) => {
                          if (e.target.value && e.target.value !== u.expira_em) {
                            salvarVisitante(u, { expira_em: e.target.value });
                          }
                        }}
                        className="bg-white border border-borda rounded-lg px-2.5 min-h-[40px] text-sm"
                      />
                      <label className="flex items-center gap-2 text-sm text-texto-fraco cursor-pointer ml-auto min-h-[40px]">
                        <input
                          type="checkbox"
                          checked={u.acesso_pausado === 1}
                          onChange={(e) => salvarVisitante(u, { acesso_pausado: e.target.checked ? 1 : 0 })}
                          className="accent-vermelho w-4 h-4"
                        />
                        Pausar acesso
                      </label>
                    </div>
                  </div>
                )}

                {/* Categoria */}
                <div className="mt-3">
                  <div className="text-xs text-texto-fraco mb-1.5" id={`cat-${u.id}`}>Categoria</div>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-fundo rounded-xl" role="group" aria-labelledby={`cat-${u.id}`}>
                    {(['oficial', 'graduado', 'praca'] as Categoria[]).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => trocarCategoria(u, cat)}
                        disabled={ocupado || u.categoria === cat}
                        aria-pressed={u.categoria === cat}
                        className={`min-h-[40px] px-1 rounded-lg text-sm font-medium transition-colors truncate outline-none focus-visible:ring-2 focus-visible:ring-azul/40 disabled:cursor-default
                          ${u.categoria === cat
                            ? 'bg-white text-noite border border-borda shadow-sm'
                            : 'text-texto-fraco hover:text-texto disabled:opacity-50'}
                        `}
                      >
                        {CATEGORIA_LABEL[cat]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Permissões */}
                <div className="mt-3 divide-y divide-borda border border-borda rounded-xl">
                  <label className="flex items-center justify-between gap-3 px-3 min-h-[48px] cursor-pointer">
                    <span className="text-sm">
                      Fiado{' '}
                      <span className={u.permite_fiado === 1 ? 'text-verde-escuro font-medium' : 'text-texto-fraco'}>
                        · {u.permite_fiado === 1 ? 'liberado' : 'bloqueado'}
                      </span>
                    </span>
                    <Toggle checked={u.permite_fiado === 1} onChange={() => toggleFiado(u)} disabled={ocupado} />
                  </label>
                  <label className="flex items-center justify-between gap-3 px-3 min-h-[48px] cursor-pointer">
                    <span className="text-sm">
                      Recepcionista{' '}
                      <span className={u.is_recepcionista === 1 ? 'text-verde-escuro font-medium' : 'text-texto-fraco'}>
                        · {u.is_recepcionista === 1 ? 'habilitado' : 'desabilitado'}
                      </span>
                    </span>
                    <Toggle checked={u.is_recepcionista === 1} onChange={() => toggleRecepcionista(u)} disabled={ocupado} />
                  </label>
                </div>

                {/* Rodapé */}
                <div className="mt-3 pt-3 border-t border-borda flex items-center justify-between gap-2 flex-wrap">
                  {u.cliente_id ? (
                    <Link
                      to={`/admin/clientes/${u.cliente_id}`}
                      className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl text-sm font-medium bg-blue-50 text-azul border border-blue-200 hover:bg-blue-100"
                    >
                      <Icon name="document" size={16} /> Ver extrato financeiro
                    </Link>
                  ) : (
                    <span className="text-sm text-texto-fraco">Sem histórico financeiro</span>
                  )}
                  {ocupado && <span className="text-xs text-texto-fraco" role="status">Salvando...</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal redefinir senha */}
      <Modal open={!!senhaModal} onClose={fecharSenha} title={senhaModal ? `Nova senha para ${senhaModal.trigrama}` : 'Nova senha'}>
        {senhaModal && (
          <form onSubmit={(e) => { e.preventDefault(); confirmarResetSenha(); }} className="space-y-4">
            <Field label="Nova senha" hint="Mínimo de 6 caracteres. Repasse ao militar por um canal seguro.">
              <input
                id="nova-senha"
                type="text"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className={inputClass}
                aria-label="Nova senha"
              />
            </Field>
            {senhaErro && <p className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2" role="alert">{senhaErro}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setSenhaModal(null)}>Cancelar</Button>
              <Button type="submit" disabled={acaoLoading === senhaModal.id}>
                {acaoLoading === senhaModal.id ? 'Salvando...' : 'Redefinir senha'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal editar dados */}
      <Modal open={!!editModal} onClose={fecharEditar} title={editModal ? `Editar ${editModal.trigrama}` : 'Editar usuário'}>
        {editModal && (
          <form onSubmit={(e) => { e.preventDefault(); salvarEditar(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Trigrama" hint="Exatamente 3 letras">
                <input
                  aria-label="Trigrama"
                  type="text"
                  maxLength={3}
                  value={editForm.trigrama}
                  onChange={(e) => setEditForm(prev => ({ ...prev, trigrama: e.target.value.toUpperCase() }))}
                  className={inputClass}
                />
              </Field>
              <Field label="SARAM" hint="Apenas números">
                <input
                  aria-label="SARAM"
                  type="text"
                  inputMode="numeric"
                  value={editForm.saram}
                  onChange={(e) => setEditForm(prev => ({ ...prev, saram: e.target.value.replace(/\D/g, '') }))}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="E-mail">
              <input
                aria-label="E-mail"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value.toLowerCase() }))}
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="WhatsApp">
                <input
                  aria-label="WhatsApp"
                  type="tel"
                  value={editForm.whatsapp}
                  onChange={(e) => setEditForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label="Data de nascimento">
                <input
                  aria-label="Data de nascimento"
                  type="date"
                  value={editForm.data_nascimento}
                  onChange={(e) => setEditForm(prev => ({ ...prev, data_nascimento: e.target.value }))}
                  className={inputClass}
                />
              </Field>
            </div>

            {editModal.is_visitante === 1 && (
              <Field label="Esquadrão de origem">
                <input
                  aria-label="Esquadrão de origem"
                  type="text"
                  value={editForm.esquadrao_origem}
                  onChange={(e) => setEditForm(prev => ({ ...prev, esquadrao_origem: e.target.value.toUpperCase() }))}
                  className={inputClass}
                />
              </Field>
            )}

            {editErro && <p className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2" role="alert">{editErro}</p>}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="ghost" onClick={() => setEditModal(null)}>Cancelar</Button>
              <Button type="submit" disabled={acaoLoading === editModal.id}>
                {acaoLoading === editModal.id ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal novo usuário */}
      <Modal open={novoModal} onClose={fecharNovo} title="Novo usuário" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); salvarNovo(); }} className="space-y-4">
          <p className="text-sm text-texto-fraco">Campos marcados com * são obrigatórios.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Trigrama *" hint="Exatamente 3 letras">
              <input
                aria-label="Trigrama"
                type="text"
                maxLength={3}
                value={novoForm.trigrama}
                onChange={(e) => setNovoForm(prev => ({ ...prev, trigrama: e.target.value.toUpperCase() }))}
                className={inputClass}
              />
            </Field>
            <Field label="Categoria *">
              <select
                aria-label="Categoria"
                value={novoForm.categoria}
                onChange={(e) => setNovoForm(prev => ({ ...prev, categoria: e.target.value as Categoria }))}
                className={inputClass}
              >
                <option value="oficial">Oficial</option>
                <option value="graduado">Graduado/SO</option>
                <option value="praca">Praça</option>
              </select>
            </Field>
            <Field label="SARAM *">
              <input
                aria-label="SARAM"
                type="text"
                inputMode="numeric"
                value={novoForm.saram}
                onChange={(e) => setNovoForm(prev => ({ ...prev, saram: e.target.value.replace(/\D/g, '') }))}
                className={inputClass}
              />
            </Field>
            <Field label="WhatsApp *">
              <input
                aria-label="WhatsApp"
                type="tel"
                value={novoForm.whatsapp}
                onChange={(e) => setNovoForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="E-mail *" className="sm:col-span-2">
              <input
                aria-label="E-mail"
                type="email"
                value={novoForm.email}
                onChange={(e) => setNovoForm(prev => ({ ...prev, email: e.target.value.toLowerCase() }))}
                className={inputClass}
              />
            </Field>
            <Field label="Senha inicial *">
              <input
                aria-label="Senha inicial"
                type="password"
                autoComplete="new-password"
                value={novoForm.senha}
                onChange={(e) => setNovoForm(prev => ({ ...prev, senha: e.target.value }))}
                className={inputClass}
              />
            </Field>
            <Field label="Data de nascimento">
              <input
                aria-label="Data de nascimento"
                type="date"
                value={novoForm.data_nascimento}
                onChange={(e) => setNovoForm(prev => ({ ...prev, data_nascimento: e.target.value }))}
                className={inputClass}
              />
            </Field>
          </div>

          <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={novoForm.is_visitante}
              onChange={(e) => setNovoForm(prev => ({ ...prev, is_visitante: e.target.checked }))}
              className="accent-azul w-4 h-4"
            />
            <span className="text-sm font-medium text-texto">É visitante de outro esquadrão</span>
          </label>

          {novoForm.is_visitante && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-fundo rounded-xl border border-borda">
              <Field label="Esquadrão de origem">
                <input
                  aria-label="Esquadrão de origem"
                  type="text"
                  value={novoForm.esquadrao_origem}
                  onChange={(e) => setNovoForm(prev => ({ ...prev, esquadrao_origem: e.target.value.toUpperCase() }))}
                  className={inputClass}
                />
              </Field>
              <Field label="Acesso expira em">
                <input
                  aria-label="Acesso expira em"
                  type="date"
                  value={novoForm.expira_em}
                  onChange={(e) => setNovoForm(prev => ({ ...prev, expira_em: e.target.value }))}
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          {novoErro && <p className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2" role="alert">{novoErro}</p>}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="ghost" onClick={() => setNovoModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={acaoLoading === 999999}>
              {acaoLoading === 999999 ? 'Criando...' : 'Criar usuário'}
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
