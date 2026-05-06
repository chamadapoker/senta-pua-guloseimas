import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
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

type EditForm = { trigrama: string; email: string; saram: string; whatsapp: string; esquadrao_origem: string };

export function Usuarios() {
  const { showToast } = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [editModal, setEditModal] = useState<Usuario | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    trigrama: '', email: '', saram: '', whatsapp: '', esquadrao_origem: '',
  });
  const [editErro, setEditErro] = useState('');
  const [novoModal, setNovoModal] = useState(false);
  const [novoForm, setNovoForm] = useState({
    trigrama: '', 
    email: '', 
    saram: '', 
    whatsapp: '', 
    categoria: 'oficial' as Categoria, 
    senha: '',
    is_visitante: false, 
    esquadrao_origem: '', 
    expira_em: ''
  });
  const [acaoLoading, setAcaoLoading] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const data = await api.get<Usuario[]>('/api/usuarios/admin/lista');
      setUsuarios(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return usuarios.filter(u => {
      if (busca) {
        const q = busca.toLowerCase();
        if (!u.trigrama.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      }
      // Filtro status (vindo do sidebar)
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
    setErro(''); setMsg('');
    setAcaoLoading(u.id);
    try {
      await api.put(`/api/usuarios/admin/${u.id}/visitante`, patch);
      showToast(`${u.trigrama}: atualizado`, 'success');
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setAcaoLoading(null);
    }
  };

  const toggleFiado = async (u: Usuario) => {
    const novo = u.permite_fiado === 1 ? 0 : 1;
    setErro(''); setMsg('');
    setAcaoLoading(u.id);
    try {
      await api.put(`/api/usuarios/admin/${u.id}/fiado`, { permite_fiado: novo });
      setMsg(`${u.trigrama}: fiado ${novo === 1 ? 'liberado' : 'bloqueado'}`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setAcaoLoading(null);
    }
  };

  const trocarCategoria = async (u: Usuario, cat: Categoria) => {
    setErro(''); setMsg('');
    setAcaoLoading(u.id);
    try {
      await api.put(`/api/usuarios/admin/${u.id}/categoria`, { categoria: cat });
      setMsg(`${u.trigrama}: categoria alterada`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao alterar categoria');
    } finally {
      setAcaoLoading(null);
    }
  };

  const abrirResetSenha = (u: Usuario) => {
    setSenhaModal(u);
    setNovaSenha('');
    setErro('');
  };

  const confirmarResetSenha = async () => {
    if (!senhaModal || novaSenha.length < 6) {
      setErro('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    setAcaoLoading(senhaModal.id);
    setErro(''); setMsg('');
    try {
      await api.put(`/api/usuarios/admin/${senhaModal.id}/senha`, { nova_senha: novaSenha });
      setMsg(`Senha de ${senhaModal.trigrama} resetada`);
      setSenhaModal(null);
      setNovaSenha('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao resetar senha');
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
    });
    setEditErro('');
  };

  const salvarEditar = async () => {
    if (!editModal) return;
    setEditErro(''); setMsg(''); setErro('');

    const tri = editForm.trigrama.trim().toUpperCase();
    if (!/^[A-ZÀ-ÚÖ]{3}$/.test(tri)) { setEditErro('Trigrama deve ter exatamente 3 letras'); return; }
    const em = editForm.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setEditErro('Email inválido'); return; }
    const sa = editForm.saram.trim();
    if (!/^\d+$/.test(sa)) { setEditErro('SARAM deve conter apenas números'); return; }
    const wp = editForm.whatsapp.trim();
    if (!wp) { setEditErro('WhatsApp obrigatório'); return; }

    const payload: Record<string, string | null> = {
      trigrama: tri,
      email: em,
      saram: sa,
      whatsapp: wp,
    };
    if (editModal.is_visitante === 1) {
      payload.esquadrao_origem = editForm.esquadrao_origem.trim().toUpperCase() || null;
    }

    setAcaoLoading(editModal.id);
    try {
      await api.put(`/api/usuarios/admin/${editModal.id}`, payload);
      setMsg(`${tri}: dados atualizados`);
      setEditModal(null);
      await carregar();
    } catch (e) {
      setEditErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setAcaoLoading(null);
    }
  };

  const excluirUsuario = async (u: Usuario) => {
    const aviso = `EXCLUIR usuário ${u.trigrama}?\n\nEsta ação é IRREVERSÍVEL e remove:\n- Conta do usuário\n- Cliente vinculado\n- Pedidos da cantina e itens\n- Pedidos da loja, parcelas e itens\n- Assinaturas e pagamentos do café\n- Foto de perfil\n\nDigite OK para confirmar.`;
    const resp = window.prompt(aviso);
    if (resp?.trim().toUpperCase() !== 'OK') return;

    setErro(''); setMsg('');
    setAcaoLoading(u.id);
    try {
      await api.delete(`/api/usuarios/admin/${u.id}`);
      setMsg(`${u.trigrama}: usuário excluído`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir usuário');
    } finally {
      setAcaoLoading(null);
    }
  };

  const toggleAtivo = async (u: Usuario) => {
    const acao = u.ativo === 1 ? 'desativar' : 'ativar';
    if (!window.confirm(`Confirma ${acao} conta de ${u.trigrama}?`)) return;
    setErro(''); setMsg('');
    setAcaoLoading(u.id);
    try {
      await api.put(`/api/usuarios/admin/${u.id}/${acao}`, {});
      setMsg(`${u.trigrama}: conta ${u.ativo === 1 ? 'desativada' : 'reativada'}`);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : `Erro ao ${acao}`);
    } finally {
      setAcaoLoading(null);
    }
  };

  const salvarNovo = async () => {
    setErro(''); setMsg('');
    const { trigrama, email, saram, whatsapp, categoria, senha, is_visitante, esquadrao_origem, expira_em } = novoForm;

    if (!trigrama || !email || !saram || !whatsapp || !categoria || !senha) {
      setErro('Preencha todos os campos obrigatórios');
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
      setMsg(`Usuário ${trigrama} criado com sucesso`);
      setNovoModal(false);
      setNovoForm({
        trigrama: '', email: '', saram: '', whatsapp: '', categoria: 'oficial', senha: '',
        is_visitante: false, esquadrao_origem: '', expira_em: ''
      });
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar usuário');
    } finally {
      setAcaoLoading(null);
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-azul tracking-wider">
          {filtroStatus === 'visitantes' ? 'USUÁRIOS — VISITANTES' :
            filtroStatus === 'expirados' ? 'USUÁRIOS — EXPIRADOS' :
            filtroStatus === 'ativos' ? 'USUÁRIOS — ATIVOS' :
            filtroStatus === 'desativados' ? 'USUÁRIOS — DESATIVADOS' :
            'USUÁRIOS'}
        </h1>
        <Button size="sm" onClick={() => setNovoModal(true)}>+ Novo Usuário</Button>
      </div>

      {/* Busca */}
      <div className="mb-4">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por trigrama ou email..."
          className="w-full bg-white border border-borda rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
        />
      </div>

      {/* Indicador de filtro status (vindo do sidebar) */}
      {filtroStatus !== 'todos' && (
        <div className="mb-4 flex items-center gap-2 text-xs">
          <span className="text-texto-fraco">Filtro:</span>
          <span className="bg-azul text-white px-2 py-0.5 rounded-full font-medium">
            {filtroStatus === 'ativos' ? 'Ativos' :
              filtroStatus === 'desativados' ? 'Desativados' :
              filtroStatus === 'visitantes' ? 'Visitantes' :
              'Visitantes expirados'}
          </span>
          <Link to="/admin/usuarios" className="text-texto-fraco hover:text-azul underline">Limpar</Link>
        </div>
      )}

      {/* Filtro categoria (in-page) */}
      <div className="flex gap-1 flex-wrap mb-5">
        {([
          { id: 'todas', label: 'Todas categorias' },
          { id: 'oficial', label: 'Oficiais' },
          { id: 'graduado', label: 'Graduados' },
          { id: 'praca', label: 'Praças' },
        ] as const).map(f => (
          <button
            key={f.id}
            onClick={() => setFiltroCategoria(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filtroCategoria === f.id ? 'bg-azul text-white' : 'bg-white text-texto-fraco border border-borda hover:text-texto'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {msg && <p className="text-verde text-sm bg-green-50 border border-green-200 rounded-xl px-3 py-2 mb-3">{msg}</p>}
      {erro && <p className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{erro}</p>}

      {loading ? (
        <div className="text-center py-10 text-texto-fraco">Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-xl border border-borda p-10 text-center text-texto-fraco">
          {usuarios.length === 0 ? 'Nenhum usuário cadastrado ainda.' : 'Nenhum usuário encontrado com esses filtros.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(u => (
            <div
              key={u.id}
              className={`bg-white rounded-xl border border-borda p-4 ${u.ativo === 0 ? 'opacity-60' : ''}`}
            >
              {/* Linha 1: identificacao */}
              <div className="flex items-center gap-3 mb-3">
                {resolveImg(u.foto_url) ? (
                  <img src={resolveImg(u.foto_url)!} alt={u.trigrama} className="w-11 h-11 rounded-full object-cover border border-borda" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-azul/10 flex items-center justify-center font-display text-azul text-sm">
                    {u.trigrama}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display text-azul text-lg tracking-widest">{u.trigrama}</span>
                    <span className="text-xs text-texto-fraco">{CATEGORIA_LABEL[u.categoria as Categoria]}</span>
                    {u.sala_cafe && (
                      <span className="text-[10px] text-azul bg-azul/10 px-1.5 py-0.5 rounded">
                        Cantina {u.sala_cafe === 'oficiais' ? 'Oficiais' : 'Graduados'}
                      </span>
                    )}
                    {u.is_visitante === 1 && (
                      <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded font-medium">VISITANTE</span>
                    )}
                    {u.ativo === 0 && (
                      <span className="text-[10px] text-vermelho bg-red-50 px-1.5 py-0.5 rounded font-medium">DESATIVADA</span>
                    )}
                  </div>
                  <div className="text-xs text-texto-fraco truncate">{u.email}</div>
                </div>
              </div>

              {/* Bloco visitante */}
              {u.is_visitante === 1 && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-amber-800 font-semibold">VISITANTE</span>
                    {u.esquadrao_origem && <span className="text-texto-fraco">— {u.esquadrao_origem}</span>}
                    {u.expira_em && (() => {
                      const hoje = new Date();
                      const alvo = new Date(u.expira_em + 'T00:00:00');
                      const dias = Math.ceil((alvo.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <span className={`ml-auto px-2 py-0.5 rounded-full font-medium ${
                          u.acesso_pausado === 1 ? 'bg-red-100 text-vermelho' :
                          dias < 0 ? 'bg-red-100 text-vermelho' :
                          dias <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-verde-escuro'
                        }`}>
                          {u.acesso_pausado === 1 ? 'Pausado' :
                            dias < 0 ? `Expirou há ${-dias}d` :
                            dias === 0 ? 'Expira hoje' : `${dias}d restantes`}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <label className="text-xs text-texto-fraco">Expira em:</label>
                    <input
                      type="date"
                      defaultValue={u.expira_em || ''}
                      onBlur={(e) => {
                        if (e.target.value && e.target.value !== u.expira_em) {
                          salvarVisitante(u, { expira_em: e.target.value });
                        }
                      }}
                      className="bg-white border border-borda rounded-lg px-2 py-1 text-xs"
                    />
                    <label className="flex items-center gap-1 text-xs text-texto-fraco cursor-pointer ml-auto">
                      <input
                        type="checkbox"
                        checked={u.acesso_pausado === 1}
                        onChange={(e) => salvarVisitante(u, { acesso_pausado: e.target.checked ? 1 : 0 })}
                        className="accent-vermelho"
                      />
                      Pausado
                    </label>
                  </div>
                </div>
              )}

              {/* Linha 2: categoria */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                {(['oficial', 'graduado', 'praca'] as Categoria[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => trocarCategoria(u, cat)}
                    disabled={acaoLoading === u.id || u.categoria === cat}
                    className={`py-2 px-2 rounded-lg text-xs font-medium border transition-all disabled:opacity-60
                      ${u.categoria === cat
                        ? 'bg-azul text-white border-azul'
                        : 'bg-white text-texto-fraco border-borda hover:border-azul/50'}
                    `}
                  >
                    {CATEGORIA_LABEL[cat]}
                  </button>
                ))}
              </div>

              {/* Toggle Fiado */}
              <div className="mb-3 flex items-center justify-between text-xs py-2 px-3 bg-fundo rounded-lg">
                <span className="text-texto-fraco">
                  Fiado: {u.permite_fiado === 1 ? (
                    <span className="text-verde-escuro font-medium">Liberado</span>
                  ) : (
                    <span className="text-vermelho font-medium">Bloqueado</span>
                  )}
                </span>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={u.permite_fiado === 1}
                    onChange={() => toggleFiado(u)}
                    disabled={acaoLoading === u.id}
                    className="sr-only peer"
                  />
                  <div className="relative w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-verde"></div>
                </label>
              </div>

              {/* Linha 3: acoes */}
              <div className="flex gap-2 flex-wrap">
                <Button variant="primary" size="sm" onClick={() => abrirEditar(u)} disabled={acaoLoading === u.id}>
                  Gerenciar conta
                </Button>
                <Button variant="outline" size="sm" onClick={() => abrirResetSenha(u)} disabled={acaoLoading === u.id}>
                  Resetar senha
                </Button>
                <Button
                  variant={u.ativo === 1 ? 'danger' : 'primary'}
                  size="sm"
                  onClick={() => toggleAtivo(u)}
                  disabled={acaoLoading === u.id}
                >
                  {u.ativo === 1 ? 'Desativar' : 'Reativar'}
                </Button>
                {isSuperAdmin && (
                  <Button variant="danger" size="sm" onClick={() => excluirUsuario(u)} disabled={acaoLoading === u.id}>
                    Excluir
                  </Button>
                )}
                {u.cliente_id ? (
                  <Link to={`/admin/clientes/${u.cliente_id}`} className="ml-auto text-xs text-azul hover:underline self-center">
                    Ver extrato financeiro →
                  </Link>
                ) : (
                  <span className="ml-auto text-xs text-texto-fraco self-center">Sem histórico</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal reset senha */}
      {senhaModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSenhaModal(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl text-azul tracking-wider mb-4">Nova senha para {senhaModal.trigrama}</h3>
            <input
              type="text"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-white border border-borda rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
              autoFocus
            />
            {erro && <p className="text-vermelho text-xs mb-3">{erro}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setSenhaModal(null)}>Cancelar</Button>
              <Button size="sm" onClick={confirmarResetSenha} disabled={acaoLoading === senhaModal.id}>
                {acaoLoading === senhaModal.id ? 'Salvando...' : 'Resetar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar dados */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl text-azul tracking-wider mb-4">Gerenciar {editModal.trigrama}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-texto-fraco mb-1">Trigrama (3 letras)</label>
                <input
                  type="text"
                  maxLength={3}
                  value={editForm.trigrama}
                  onChange={(e) => setEditForm(prev => ({ ...prev, trigrama: e.target.value.toUpperCase() }))}
                  className="w-full bg-white border border-borda rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-texto-fraco mb-1">E-mail</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value.toLowerCase() }))}
                  className="w-full bg-white border border-borda rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-texto-fraco mb-1">SARAM (apenas números)</label>
                <input
                  type="text"
                  value={editForm.saram}
                  onChange={(e) => setEditForm(prev => ({ ...prev, saram: e.target.value.replace(/\D/g, '') }))}
                  className="w-full bg-white border border-borda rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-texto-fraco mb-1">WhatsApp</label>
                <input
                  type="text"
                  value={editForm.whatsapp}
                  onChange={(e) => setEditForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                  className="w-full bg-white border border-borda rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
                />
              </div>

              {editModal.is_visitante === 1 && (
                <div>
                  <label className="block text-xs font-medium text-texto-fraco mb-1">Esquadrão de Origem</label>
                  <input
                    type="text"
                    value={editForm.esquadrao_origem}
                    onChange={(e) => setEditForm(prev => ({ ...prev, esquadrao_origem: e.target.value.toUpperCase() }))}
                    className="w-full bg-white border border-borda rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-azul/30 focus:border-azul"
                  />
                </div>
              )}
            </div>

            {editErro && <p className="text-vermelho text-xs mt-4">{editErro}</p>}
            
            <div className="flex gap-2 justify-end mt-6">
              <Button variant="ghost" size="sm" onClick={() => setEditModal(null)}>Cancelar</Button>
              <Button size="sm" onClick={salvarEditar} disabled={acaoLoading === editModal.id}>
                {acaoLoading === editModal.id ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo usuario */}
      {novoModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setNovoModal(false)}>
          <div className="bg-white rounded-2xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl text-azul tracking-wider mb-4">Novo Usuário</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-texto-fraco mb-1">Trigrama (3 letras)*</label>
                <input
                  type="text"
                  maxLength={3}
                  value={novoForm.trigrama}
                  onChange={(e) => setNovoForm(prev => ({ ...prev, trigrama: e.target.value.toUpperCase() }))}
                  className="w-full bg-white border border-borda rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-azul/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-texto-fraco mb-1">SARAM*</label>
                  <input
                    type="text"
                    value={novoForm.saram}
                    onChange={(e) => setNovoForm(prev => ({ ...prev, saram: e.target.value.replace(/\D/g, '') }))}
                    className="w-full bg-white border border-borda rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-azul/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-texto-fraco mb-1">WhatsApp*</label>
                  <input
                    type="text"
                    value={novoForm.whatsapp}
                    onChange={(e) => setNovoForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                    className="w-full bg-white border border-borda rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-azul/30"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-texto-fraco mb-1">E-mail*</label>
                <input
                  type="email"
                  value={novoForm.email}
                  onChange={(e) => setNovoForm(prev => ({ ...prev, email: e.target.value.toLowerCase() }))}
                  className="w-full bg-white border border-borda rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-azul/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-texto-fraco mb-1">Senha inicial*</label>
                <input
                  type="password"
                  value={novoForm.senha}
                  onChange={(e) => setNovoForm(prev => ({ ...prev, senha: e.target.value }))}
                  className="w-full bg-white border border-borda rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-azul/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-texto-fraco mb-1">Categoria*</label>
                <select
                  value={novoForm.categoria}
                  onChange={(e) => setNovoForm(prev => ({ ...prev, categoria: e.target.value as Categoria }))}
                  className="w-full bg-white border border-borda rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-azul/30"
                >
                  <option value="oficial">Oficial</option>
                  <option value="graduado">Graduado/SO</option>
                  <option value="praca">Praça</option>
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={novoForm.is_visitante}
                    onChange={(e) => setNovoForm(prev => ({ ...prev, is_visitante: e.target.checked }))}
                    className="accent-azul"
                  />
                  <span className="text-sm font-medium text-texto">É visitante?</span>
                </label>
              </div>

              {novoForm.is_visitante && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-fundo rounded-xl border border-borda">
                  <div>
                    <label className="block text-[10px] font-medium text-texto-fraco mb-1 uppercase">Esquadrão Origem</label>
                    <input
                      type="text"
                      value={novoForm.esquadrao_origem}
                      onChange={(e) => setNovoForm(prev => ({ ...prev, esquadrao_origem: e.target.value.toUpperCase() }))}
                      className="w-full bg-white border border-borda rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-azul/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-texto-fraco mb-1 uppercase">Expira em</label>
                    <input
                      type="date"
                      value={novoForm.expira_em}
                      onChange={(e) => setNovoForm(prev => ({ ...prev, expira_em: e.target.value }))}
                      className="w-full bg-white border border-borda rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-azul/30"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <Button variant="ghost" size="sm" onClick={() => setNovoModal(false)}>Cancelar</Button>
              <Button size="sm" onClick={salvarNovo} disabled={acaoLoading === 999999}>
                {acaoLoading === 999999 ? 'Criando...' : 'Criar Usuário'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
