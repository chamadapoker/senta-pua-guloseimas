import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/Layout';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../services/api';
import type { Cliente } from '../../types';

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtro, setFiltro] = useState<'todos' | 'divida' | 'dia'>('todos');
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Cliente[]>('/api/clientes').then(setClientes);
  }, []);

  const filtrados = clientes.filter((c) => {
    if (filtro === 'divida') return (c.saldo_devedor ?? 0) > 0;
    if (filtro === 'dia') return (c.saldo_devedor ?? 0) === 0;
    return true;
  });

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-2xl text-white tracking-wider">CLIENTES</h1>
        <div className="flex gap-1">
          {(['todos', 'divida', 'dia'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filtro === f ? 'bg-vermelho text-white' : 'bg-fundo-elevado text-texto-fraco border border-borda hover:text-texto'
              }`}
            >
              {f === 'todos' ? 'Todos' : f === 'divida' ? 'Com dívida' : 'Em dia'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-fundo-card rounded-xl overflow-hidden border border-borda">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-borda">
              <th className="px-4 py-3 text-left text-xs text-texto-fraco uppercase tracking-wider">Nome</th>
              <th className="px-4 py-3 text-right text-xs text-texto-fraco uppercase tracking-wider">Comprado</th>
              <th className="px-4 py-3 text-right text-xs text-texto-fraco uppercase tracking-wider">Pago</th>
              <th className="px-4 py-3 text-right text-xs text-texto-fraco uppercase tracking-wider">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/admin/clientes/${c.id}`)}
                className="border-b border-borda/50 cursor-pointer hover:bg-fundo-elevado transition-colors"
              >
                <td className="px-4 py-3 font-medium text-white">{c.nome_guerra}</td>
                <td className="px-4 py-3 text-right text-texto-fraco">R$ {(c.total_comprado ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-texto-fraco">R$ {(c.total_pago ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <Badge variant={(c.saldo_devedor ?? 0) > 0 ? 'danger' : 'success'}>
                    R$ {(c.saldo_devedor ?? 0).toFixed(2)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length === 0 && (
          <div className="text-center py-10 text-texto-fraco">Nenhum cliente encontrado</div>
        )}
      </div>
    </AdminLayout>
  );
}
