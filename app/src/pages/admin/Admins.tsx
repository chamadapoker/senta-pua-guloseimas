import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Field, inputClass } from '../../components/ui/Field';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Menu } from '../../components/ui/Menu';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { api } from '../../services/api';
import { useAuth, type EscopoAdmin } from '../../hooks/useAuth';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';

interface Admin {
  id: string;
  email: string;
  nome: string;
  role: 'super_admin' | 'admin';
  ativo: number;
  escopo?: EscopoAdmin;
  created_at: string;
  last_login: string | null;
}

// Datas do banco vêm em UTC sem "Z"
function formatarAcesso(x: string | null): string {
  if (!x) return 'Nunca acessou';
  const d = new Date(x.replace(' ', 'T') + (x.endsWith('Z') ? '' : 'Z'));
  if (isNaN(d.getTime())) return x;
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function Admins() {
  const { admin: currentAdmin } = useAuth();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Admin | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState<'admin' | 'super_admin'>('admin');
  // Acesso: null = total; 'cafe_graduado' = só o café dos graduados (sempre admin comum)
  const [escopo, setEscopo] = useState<EscopoAdmin>(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const isSuperAdmin = currentAdmin?.role === 'super_admin';

  const carregar = () => {
    setErroCarga(false);
    return api.get<Admin[]>('/api/admins')
      .then(setAdmins)
      .catch(() => setErroCarga(true))
      .finally(() => setCarregando(false));
  };
  useEffect(() => { carregar(); }, []);

  const fecharModal = useCallback(() => setModalAberto(false), []);

  const abrirCriar = () => {
    setEditando(null);
    setNome(''); setEmail(''); setSenha(''); setRole('admin'); setEscopo(null); setErro('');
    setModalAberto(true);
  };

  const abrirEditar = (a: Admin) => {
    setEditando(a);
    setNome(a.nome); setEmail(a.email); setSenha(''); setRole(a.role); setEscopo(a.escopo === 'cafe_graduado' ? 'cafe_graduado' : null); setErro('');
    setModalAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    // Acesso restrito ao café é sempre admin comum
    const roleFinal = escopo ? 'admin' : role;
    try {
      if (editando) {
        const body: Record<string, unknown> = { nome, role: roleFinal, escopo };
        if (senha) body.senha = senha;
        await api.put(`/api/admins/${editando.id}`, body);
      } else {
        if (!senha) { setErro('Informe uma senha'); return; }
        await api.post('/api/admins', { nome, email, senha, role: roleFinal, escopo });
      }
      setModalAberto(false);
      showToast(editando ? 'Administrador atualizado' : 'Administrador criado', 'success');
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const toggleAtivo = async (a: Admin) => {
    const desativar = !!a.ativo;
    const ok = await confirm({
      title: desativar ? 'Desativar administrador' : 'Ativar administrador',
      message: desativar
        ? `Desativar "${a.nome}"? Ele perde o acesso ao painel até ser reativado.`
        : `Reativar o acesso de "${a.nome}" ao painel?`,
      confirmText: desativar ? 'Desativar' : 'Ativar',
      danger: desativar,
    });
    if (!ok) return;
    try {
      await api.put(`/api/admins/${a.id}`, { ativo: !a.ativo });
      showToast(desativar ? 'Administrador desativado' : 'Administrador ativado', 'success');
      carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao alterar status', 'error');
    }
  };

  const excluir = async (a: Admin) => {
    if (!(await confirm({ title: 'Excluir administrador', message: `Remover "${a.nome}"? Esta ação não pode ser desfeita.`, confirmText: 'Excluir', danger: true }))) return;
    try {
      await api.delete(`/api/admins/${a.id}`);
      showToast('Administrador removido', 'success');
      carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao excluir', 'error');
    }
  };

  const menuDe = (a: Admin) => isSuperAdmin ? (
    <Menu label={`Ações de ${a.nome}`} items={[
      { label: 'Editar', icon: 'pencil', onClick: () => abrirEditar(a) },
      { label: a.ativo ? 'Desativar' : 'Ativar', icon: a.ativo ? 'x' : 'check', onClick: () => toggleAtivo(a) },
      a.id !== currentAdmin?.id && { label: 'Excluir', icon: 'trash', danger: true, onClick: () => excluir(a) },
    ]} />
  ) : null;

  const papel = (a: Admin) => (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <Badge variant={a.role === 'super_admin' ? 'success' : 'neutral'}>
        {a.role === 'super_admin' ? 'Super admin' : 'Admin'}
      </Badge>
      {a.escopo === 'cafe_graduado' && <Badge variant="warning">Só café dos graduados</Badge>}
      {!a.ativo && <Badge variant="danger">Inativo</Badge>}
    </span>
  );

  return (
    <AppLayout>
      <BackButton to="/admin" className="mb-3" />
      <PageHeader
        title="Administradores"
        subtitle="Quem tem acesso ao painel, com qual papel e com qual acesso."
        right={isSuperAdmin && <Button size="sm" onClick={abrirCriar}><Icon name="plus" size={16} /> Novo administrador</Button>}
      />

      {!isSuperAdmin && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-900">
          <Icon name="info" size={18} className="shrink-0 mt-0.5" />
          Apenas super admins podem criar, editar ou remover administradores.
        </div>
      )}

      {carregando ? (
        <Loading />
      ) : erroCarga ? (
        <div className="bg-white rounded-2xl border border-borda">
          <EmptyState
            icon={<Icon name="warning" size={24} />}
            message="Não foi possível carregar os administradores"
            hint="Verifique a conexão e tente outra vez."
            action={<Button variant="ghost" size="sm" onClick={() => { setCarregando(true); carregar(); }}><Icon name="refresh" size={16} /> Tentar de novo</Button>}
          />
        </div>
      ) : admins.length === 0 ? (
        <div className="bg-white rounded-2xl border border-borda">
          <EmptyState
            icon={<Icon name="users" size={24} />}
            message="Nenhum administrador cadastrado"
            hint={isSuperAdmin ? 'Crie o primeiro acesso ao painel.' : undefined}
            action={isSuperAdmin ? <Button size="sm" onClick={abrirCriar}><Icon name="plus" size={16} /> Novo administrador</Button> : undefined}
          />
        </div>
      ) : (
        <>
          {/* Mobile: cartões */}
          <ul className="md:hidden space-y-2">
            {admins.map(a => (
              <li key={a.id} className={`bg-white rounded-2xl border border-borda shadow-sm p-4 ${a.ativo ? '' : 'opacity-70'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-noite truncate">{a.nome}</div>
                    <div className="text-sm text-texto-fraco truncate">{a.email}</div>
                  </div>
                  <div className="shrink-0 -mr-1">{menuDe(a)}</div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                  {papel(a)}
                  <span className="text-xs text-texto-fraco">Último acesso: {formatarAcesso(a.last_login)}</span>
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop: tabela */}
          <div className="hidden md:block bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-fundo-elevado border-b border-borda text-texto-fraco">
                  <th className="px-4 py-3 text-left font-medium">Nome</th>
                  <th className="px-4 py-3 text-left font-medium">E-mail</th>
                  <th className="px-4 py-3 text-left font-medium">Papel</th>
                  <th className="px-4 py-3 text-left font-medium">Último acesso</th>
                  <th className="px-4 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {admins.map(a => (
                  <tr key={a.id} className={a.ativo ? '' : 'opacity-60'}>
                    <td className="px-4 py-3 font-medium text-noite">{a.nome}</td>
                    <td className="px-4 py-3 text-texto-fraco">{a.email}</td>
                    <td className="px-4 py-3">{papel(a)}</td>
                    <td className="px-4 py-3 text-texto-fraco whitespace-nowrap">{formatarAcesso(a.last_login)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end">{menuDe(a)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={modalAberto} onClose={fecharModal} title={editando ? 'Editar administrador' : 'Novo administrador'}>
        <form onSubmit={salvar} className="space-y-4">
          <Field label="Nome">
            <input aria-label="Nome" value={nome} onChange={e => setNome(e.target.value)} className={inputClass} required />
          </Field>
          <Field label="E-mail" hint={editando ? 'O e-mail não pode ser alterado.' : undefined}>
            <input aria-label="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={!!editando} className={`${inputClass} disabled:bg-fundo disabled:text-texto-fraco`} required />
          </Field>
          <Field label={editando ? 'Nova senha' : 'Senha'} hint={editando ? 'Deixe em branco para manter a senha atual. Mínimo de 8 caracteres.' : 'Mínimo de 8 caracteres.'}>
            <input aria-label={editando ? 'Nova senha' : 'Senha'} type="password" autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} minLength={8} className={inputClass} />
          </Field>
          <Field
            label="Acesso"
            hint={escopo === 'cafe_graduado'
              ? 'Vê e usa só o café da sala dos graduados (assinantes, mensalidades, despesas, insumos, comprovantes e configurações do café).'
              : 'Vê e usa todo o painel.'}
          >
            <select
              aria-label="Acesso"
              value={escopo ?? 'total'}
              onChange={e => {
                const novo: EscopoAdmin = e.target.value === 'cafe_graduado' ? 'cafe_graduado' : null;
                setEscopo(novo);
                if (novo) setRole('admin');
              }}
              className={inputClass}
            >
              <option value="total">Acesso total</option>
              <option value="cafe_graduado">Só o café dos graduados</option>
            </select>
          </Field>
          {!escopo && (
            <Field label="Papel">
              <select aria-label="Papel" value={role} onChange={e => setRole(e.target.value as 'admin' | 'super_admin')} className={inputClass}>
                <option value="admin">Admin (uso normal)</option>
                <option value="super_admin">Super admin (gerencia outros admins)</option>
              </select>
            </Field>
          )}
          {erro && <p className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2" role="alert">{erro}</p>}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="ghost" onClick={fecharModal}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : editando ? 'Salvar' : 'Criar administrador'}
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
