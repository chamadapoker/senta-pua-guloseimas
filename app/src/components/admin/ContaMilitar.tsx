import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import type { Usuario, Categoria } from '../../types';

interface Props {
  trigrama: string;
}

const CATEGORIA_LABEL: Record<Categoria, string> = {
  oficial: 'Oficial',
  graduado: 'Graduado/SO',
  praca: 'Praça',
};

export function ContaMilitar({ trigrama }: Props) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [mostrandoSenha, setMostrandoSenha] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const u = await api.get<Usuario | null>(`/api/usuarios/admin/por-trigrama/${trigrama}`);
      setUser(u);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [trigrama]);

  const trocarCategoria = async (cat: Categoria) => {
    if (!user) return;
    setErro(''); setMsg('');
    try {
      await api.put(`/api/usuarios/admin/${user.id}/categoria`, { categoria: cat });
      setMsg(`Categoria alterada para ${CATEGORIA_LABEL[cat]}`);
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao alterar');
    }
  };

  const resetarSenha = async () => {
    if (!user || novaSenha.length < 6) {
      setErro('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    setErro(''); setMsg('');
    try {
      await api.put(`/api/usuarios/admin/${user.id}/senha`, { nova_senha: novaSenha });
      setMsg('Senha resetada com sucesso');
      setNovaSenha('');
      setMostrandoSenha(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao resetar senha');
    }
  };

  const toggleAtivo = async () => {
    if (!user) return;
    setErro(''); setMsg('');
    const endpoint = user.ativo === 1 ? 'desativar' : 'ativar';
    try {
      await api.put(`/api/usuarios/admin/${user.id}/${endpoint}`, {});
      setMsg(user.ativo === 1 ? 'Conta desativada' : 'Conta reativada');
      carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao alterar status');
    }
  };

  if (loading) return <div className="bg-white rounded-xl border border-borda p-4 text-center text-sm text-texto-fraco">Carregando conta...</div>;

  if (!user) return (
    <div className="bg-white rounded-xl border border-borda p-4 text-center text-sm text-texto-fraco">
      Este militar ainda não tem conta de usuário cadastrada.
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-borda p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-texto-fraco">Email</div>
          <div className="font-medium text-sm">{user.email}</div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.ativo === 1 ? 'bg-green-100 text-verde-escuro' : 'bg-red-50 text-vermelho'}`}>
          {user.ativo === 1 ? 'Ativa' : 'Desativada'}
        </span>
      </div>

      <div>
        <div className="text-xs text-texto-fraco mb-2">Categoria</div>
        <div className="grid grid-cols-3 gap-2">
          {(['oficial', 'graduado', 'praca'] as Categoria[]).map(cat => (
            <button
              key={cat}
              onClick={() => trocarCategoria(cat)}
              className={`py-2 px-2 rounded-lg text-xs font-medium border transition-all
                ${user.categoria === cat
                  ? 'bg-azul text-white border-azul'
                  : 'bg-white text-texto-fraco border-borda hover:border-azul/50'}
              `}
            >
              {CATEGORIA_LABEL[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-borda flex-wrap">
        {!mostrandoSenha ? (
          <Button variant="outline" size="sm" onClick={() => setMostrandoSenha(true)}>Resetar senha</Button>
        ) : (
          <div className="flex-1 flex gap-2 w-full">
            <input
              type="text"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Nova senha (min 6)"
              className="flex-1 bg-white border border-borda rounded-lg px-3 py-2 text-sm"
            />
            <Button size="sm" onClick={resetarSenha}>OK</Button>
            <Button variant="ghost" size="sm" onClick={() => { setMostrandoSenha(false); setNovaSenha(''); }}>×</Button>
          </div>
        )}
        <Button variant={user.ativo === 1 ? 'danger' : 'primary'} size="sm" onClick={toggleAtivo}>
          {user.ativo === 1 ? 'Desativar conta' : 'Reativar conta'}
        </Button>
      </div>

      {msg && <p className="text-verde text-xs bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>}
      {erro && <p className="text-vermelho text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
    </div>
  );
}
