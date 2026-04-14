import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
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

export function Usuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const filtroStatus: FiltroStatus = (() => {
    const f = searchParams.get('f');
    if (f === 'ativos' || f === 'desativados' || f === 'visitantes' || f === 'expirados') return f;
    return 'todos';
  })();
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoria>('todas');
  const [busca, setBusca] = useState(searchParams.get('trigrama') || '');

  const [senhaModal, setSenhaModal] = useState<Usuario | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
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
      setMsg(`${u.trigrama}: atualizado`);
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

  return (
    <AppLayout>
      <h1 className="font-display text-2xl text-azul tracking-wider mb-5">
        {filtroStatus === 'visitantes' ? 'USUÁRIOS — VISITANTES' :
          filtroStatus === 'expirados' ? 'USUÁRIOS — EXPIRADOS' :
          filtroStatus === 'ativos' ? 'USUÁRIOS — ATIVOS' :
          filtroStatus === 'desativados' ? 'USUÁRIOS — DESATIVADOS' :
          'USUÁRIOS'}
      </h1>

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

              {/* Linha 3: acoes */}
              <div className="flex gap-2 flex-wrap">
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
    </AppLayout>
  );
}
