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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-azul">Clientes</h1>
        <div className="flex gap-1">
          {(['todos', 'divida', 'dia'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                filtro === f ? 'bg-azul text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f === 'todos' ? 'Todos' : f === 'divida' ? 'Com dívida' : 'Em dia'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Nome</th>
              <th className="px-4 py-2 text-right">Comprado</th>
              <th className="px-4 py-2 text-right">Pago</th>
              <th className="px-4 py-2 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((c) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/admin/clientes/${c.id}`)}
                className="border-t cursor-pointer hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-medium">{c.nome_guerra}</td>
                <td className="px-4 py-3 text-right">R$ {(c.total_comprado ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">R$ {(c.total_pago ?? 0).toFixed(2)}</td>
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
          <div className="text-center py-8 text-gray-400">Nenhum cliente encontrado</div>
        )}
      </div>
    </AdminLayout>
  );
}
