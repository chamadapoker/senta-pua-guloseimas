import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

interface Admin {
  id: string;
  email: string;
  nome: string;
  role: 'super_admin' | 'admin';
  ativo: number;
  created_at: string;
  last_login: string | null;
}

export function Admins() {
  const { admin: currentAdmin } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Admin | null>(null);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState<'admin' | 'super_admin'>('admin');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const isSuperAdmin = currentAdmin?.role === 'super_admin';

  const carregar = () => api.get<Admin[]>('/api/admins').then(setAdmins);
  useEffect(() => { carregar(); }, []);

  const abrirCriar = () => {
    setEditando(null);
    setNome(''); setEmail(''); setSenha(''); setRole('admin'); setErro('');
    setModalAberto(true);
  };

  const abrirEditar = (a: Admin) => {
    setEditando(a);
    setNome(a.nome); setEmail(a.email); setSenha(''); setRole(a.role); setErro('');
    setModalAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      if (editando) {
        const body: Record<string, unknown> = { nome, role };
        if (senha) body.senha = senha;
        await api.put(`/api/admins/${editando.id}`, body);
      } else {
        if (!senha) { setErro('Senha obrigatória'); return; }
        await api.post('/api/admins', { nome, email, senha, role });
      }
      setModalAberto(false);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const toggleAtivo = async (a: Admin) => {
    await api.put(`/api/admins/${a.id}`, { ativo: !a.ativo });
    carregar();
  };

  const excluir = async (a: Admin) => {
    if (!confirm(`Remover "${a.nome}"? Ação irreversível.`)) return;
    try {
      await api.delete(`/api/admins/${a.id}`);
      carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro');
    }
  };

  return (
    <AppLayout>
      <BackButton to="/admin" className="mb-3" />
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-azul tracking-wider">ADMINISTRADORES</h1>
        {isSuperAdmin && <Button size="sm" onClick={abrirCriar}>+ Novo Admin</Button>}
      </div>

      {!isSuperAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-900">
          Apenas super admins podem gerenciar administradores.
        </div>
      )}

      <div className="bg-white rounded-xl border border-borda overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-azul">
              <th className="px-3 py-2 text-left text-white font-medium">Nome</th>
              <th className="px-3 py-2 text-left text-white font-medium">Email</th>
              <th className="px-3 py-2 text-left text-white font-medium">Papel</th>
              <th className="px-3 py-2 text-left text-white font-medium">Último acesso</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {admins.map(a => (
              <tr key={a.id} className={a.ativo ? '' : 'opacity-50'}>
                <td className="px-3 py-2">{a.nome}</td>
                <td className="px-3 py-2 text-texto-fraco">{a.email}</td>
                <td className="px-3 py-2">
                  <Badge variant={a.role === 'super_admin' ? 'success' : 'neutral'}>
                    {a.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                  </Badge>
                  {!a.ativo && <span className="ml-2 text-xs text-vermelho">INATIVO</span>}
                </td>
                <td className="px-3 py-2 text-xs text-texto-fraco">
                  {a.last_login ? new Date(a.last_login + 'Z').toLocaleString('pt-BR') : 'nunca'}
                </td>
                <td className="px-3 py-2 text-right">
                  {isSuperAdmin && (
                    <div className="flex gap-1 justify-end flex-wrap">
                      <button onClick={() => abrirEditar(a)} className="text-xs px-2 py-1 rounded-lg text-texto bg-fundo border border-borda hover:bg-gray-200">Editar</button>
                      <button onClick={() => toggleAtivo(a)} className="text-xs px-2 py-1 rounded-lg text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100">
                        {a.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                      {a.id !== currentAdmin?.id && (
                        <button onClick={() => excluir(a)} className="text-xs px-2 py-1 rounded-lg text-vermelho bg-red-50 border border-red-200 hover:bg-red-100">Excluir</button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6 text-texto-fraco">Nenhum admin cadastrado</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar Admin' : 'Novo Admin'}>
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={!!editando} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto disabled:bg-fundo disabled:text-texto-fraco" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {editando ? 'Nova senha (deixe vazio para manter)' : 'Senha'}
            </label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} minLength={8} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" placeholder="Mínimo 8 caracteres" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Papel</label>
            <select value={role} onChange={e => setRole(e.target.value as 'admin' | 'super_admin')} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto">
              <option value="admin">Admin (uso normal)</option>
              <option value="super_admin">Super Admin (gerencia outros admins)</option>
            </select>
          </div>
          {erro && <p className="text-vermelho text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Salvando...' : editando ? 'Salvar' : 'Criar Admin'}
          </Button>
        </form>
      </Modal>
    </AppLayout>
  );
}
