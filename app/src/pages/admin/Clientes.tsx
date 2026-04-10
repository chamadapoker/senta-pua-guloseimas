import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/Layout';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../services/api';
import type { Cliente } from '../../types';

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtro, setFiltro] = useState<'todos' | 'divida' | 'dia' | 'bloqueados'>('todos');
  const navigate = useNavigate();

  const carregar = () => api.get<Cliente[]>('/api/clientes').then(setClientes);
  useEffect(() => { carregar(); }, []);

  const toggleBloqueio = async (e: React.MouseEvent, c: Cliente) => {
    e.stopPropagation();
    const novoStatus = c.ativo ? 0 : 1;
    const acao = novoStatus ? 'desbloquear' : 'bloquear';
    if (!window.confirm(`Tem certeza que deseja ${acao} ${c.nome_guerra}?`)) return;
    await api.put(`/api/clientes/${c.id}/bloquear`, { ativo: novoStatus });
    carregar();
  };

  const excluirMilitar = async (e: React.MouseEvent, c: Cliente) => {
    e.stopPropagation();
    if (!window.confirm(`Excluir ${c.nome_guerra} permanentemente? Todos os pedidos, pagamentos e dados desse militar serao apagados.`)) return;
    await api.delete(`/api/clientes/${c.id}`);
    carregar();
  };

  const filtrados = clientes.filter((c) => {
    if (filtro === 'divida') return (c.saldo_devedor ?? 0) > 0;
    if (filtro === 'dia') return (c.saldo_devedor ?? 0) === 0;
    if (filtro === 'bloqueados') return !c.ativo;
    return true;
  });

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-azul tracking-wider">MILITARES</h1>
        <div className="flex gap-1 flex-wrap justify-end">
          {(['todos', 'divida', 'dia', 'bloqueados'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filtro === f ? 'bg-vermelho text-white' : 'bg-white text-texto-fraco border border-borda hover:text-texto'
              }`}
            >
              {f === 'todos' ? 'Todos' : f === 'divida' ? 'Com dívida' : f === 'dia' ? 'Em dia' : 'Bloqueados'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl overflow-hidden border border-borda shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="bg-azul">
              <th className="px-4 py-3 text-left text-xs text-white uppercase tracking-wider">Trigrama</th>
              <th className="px-4 py-3 text-right text-xs text-white uppercase tracking-wider">Comprado</th>
              <th className="px-4 py-3 text-right text-xs text-white uppercase tracking-wider">Pago</th>
              <th className="px-4 py-3 text-right text-xs text-white uppercase tracking-wider">Saldo</th>
              <th className="px-4 py-3 text-center text-xs text-white uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/admin/clientes/${c.id}`)}
                className={`border-b border-borda/50 cursor-pointer hover:bg-fundo transition-colors ${!c.ativo ? 'opacity-60' : ''}`}
              >
                <td className="px-4 py-3 font-medium text-texto">
                  {c.nome_guerra}
                  {!c.ativo && <span className="ml-2 text-[10px] text-vermelho font-medium">BLOQUEADO</span>}
                  {c.visitante ? (
                    <span className="ml-2 text-[10px] text-azul font-medium bg-azul/10 px-1.5 py-0.5 rounded">VISITANTE{c.esquadrao_origem ? ` - ${c.esquadrao_origem}` : ''}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right text-texto-fraco">R$ {(c.total_comprado ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-texto-fraco">R$ {(c.total_pago ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <Badge variant={(c.saldo_devedor ?? 0) > 0 ? 'danger' : 'success'}>
                    R$ {(c.saldo_devedor ?? 0).toFixed(2)}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={(e) => toggleBloqueio(e, c)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg ${
                        c.ativo
                          ? 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100'
                          : 'text-verde bg-green-50 border border-green-200 hover:bg-green-100'
                      }`}
                    >
                      {c.ativo ? 'Bloquear' : 'Desbloquear'}
                    </button>
                    <button
                      onClick={(e) => excluirMilitar(e, c)}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg text-vermelho bg-red-50 border border-red-200 hover:bg-red-100"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filtrados.length === 0 && (
          <div className="text-center py-10 text-texto-fraco">Nenhum militar encontrado</div>
        )}
      </div>
    </AdminLayout>
  );
}
