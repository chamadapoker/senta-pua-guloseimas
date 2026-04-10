import { useEffect, useState } from 'react';
import { AdminLayout } from '../../../components/Layout';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { api } from '../../../services/api';

interface Assinante {
  id: string;
  cliente_id: string;
  nome_guerra: string;
  tipo: string;
  plano: string;
  valor: number;
  ativo: number;
  total_pago: number;
  total_devido: number;
}

export function CafeAssinantes() {
  const [sala, setSala] = useState<'oficial' | 'graduado'>(() =>
    (localStorage.getItem('cafe_tipo') as 'oficial' | 'graduado') || 'graduado'
  );
  const [assinantes, setAssinantes] = useState<Assinante[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Assinante | null>(null);
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [tipo, setTipo] = useState('graduado');
  const [plano, setPlano] = useState('mensal');
  const [valor, setValor] = useState('');

  useEffect(() => { localStorage.setItem('cafe_tipo', sala); }, [sala]);
  const carregar = () => api.get<Assinante[]>(`/api/cafe/admin/assinantes?tipo=${sala}`).then(setAssinantes);
  useEffect(() => { carregar(); }, [sala]);

  const fecharModal = () => {
    setModalAberto(false);
    setEditando(null);
    setNomeGuerra(''); setTipo(sala); setPlano('mensal'); setValor('');
  };

  const abrirEditar = (a: Assinante) => {
    setEditando(a);
    setNomeGuerra(a.nome_guerra);
    setTipo(a.tipo);
    setPlano(a.plano);
    setValor(String(a.valor));
    setModalAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando && !/^[A-ZÀ-ÚÖ]{3}$/.test(nomeGuerra.trim())) {
      alert('Trigrama deve ter exatamente 3 letras');
      return;
    }
    try {
      if (editando) {
        await api.put(`/api/cafe/admin/assinantes/${editando.id}`, {
          tipo,
          plano,
          valor: parseFloat(valor),
        });
      } else {
        await api.post('/api/cafe/admin/assinantes', {
          nome_guerra: nomeGuerra.trim().toUpperCase(),
          tipo,
          plano,
          valor: parseFloat(valor),
        });
      }
      fecharModal();
      carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro');
    }
  };

  const toggleAtivo = async (a: Assinante) => {
    if (a.ativo) {
      if (!confirm(`Desativar ${a.nome_guerra}?`)) return;
      await api.put(`/api/cafe/admin/assinantes/${a.id}/desativar`, {});
    } else {
      await api.put(`/api/cafe/admin/assinantes/${a.id}`, { ativo: 1 });
    }
    carregar();
  };

  const excluir = async (a: Assinante) => {
    if (!confirm(`Excluir ${a.nome_guerra} permanentemente? Todos os pagamentos desse assinante serão apagados.`)) return;
    await api.delete(`/api/cafe/admin/assinantes/${a.id}`);
    carregar();
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl text-azul tracking-wider">ASSINANTES</h1>
        <Button size="sm" onClick={() => { setEditando(null); setTipo(sala); setModalAberto(true); }}>+ Adicionar</Button>
      </div>
      <div className="flex gap-1 mb-5">
        <button onClick={() => setSala('oficial')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${sala === 'oficial' ? 'bg-azul text-white' : 'bg-white text-texto-fraco border border-borda'}`}>
          Oficiais
        </button>
        <button onClick={() => setSala('graduado')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${sala === 'graduado' ? 'bg-azul text-white' : 'bg-white text-texto-fraco border border-borda'}`}>
          Graduados
        </button>
      </div>

      <div className="bg-white rounded-xl overflow-hidden border border-borda shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-azul">
                <th className="px-4 py-3 text-left text-xs text-white uppercase tracking-wider">Militar</th>
                <th className="px-4 py-3 text-center text-xs text-white uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3 text-center text-xs text-white uppercase tracking-wider">Plano</th>
                <th className="px-4 py-3 text-right text-xs text-white uppercase tracking-wider">Valor</th>
                <th className="px-4 py-3 text-right text-xs text-white uppercase tracking-wider">Pago</th>
                <th className="px-4 py-3 text-right text-xs text-white uppercase tracking-wider">Deve</th>
                <th className="px-4 py-3 text-center text-xs text-white uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {assinantes.map((a) => (
                <tr key={a.id} className={`border-b border-borda/50 hover:bg-fundo transition-colors ${!a.ativo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-texto">{a.nome_guerra}</td>
                  <td className="px-4 py-3 text-center text-xs capitalize">{a.tipo}</td>
                  <td className="px-4 py-3 text-center text-xs capitalize">{a.plano}</td>
                  <td className="px-4 py-3 text-right text-texto-fraco">R$ {a.valor.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-verde font-medium">R$ {a.total_pago.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant={a.total_devido > 0 ? 'danger' : 'success'}>R$ {a.total_devido.toFixed(2)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => abrirEditar(a)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg text-azul bg-blue-50 border border-blue-200 hover:bg-blue-100">
                        Editar
                      </button>
                      <button onClick={() => toggleAtivo(a)}
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg ${
                          a.ativo ? 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100' : 'text-verde bg-green-50 border border-green-200 hover:bg-green-100'
                        }`}>
                        {a.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                      <button onClick={() => excluir(a)}
                        className="text-xs font-medium px-2.5 py-1 rounded-lg text-vermelho bg-red-50 border border-red-200 hover:bg-red-100">
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {assinantes.length === 0 && <div className="text-center py-10 text-texto-fraco">Nenhum assinante</div>}
      </div>

      <Modal open={modalAberto} onClose={fecharModal} title={editando ? 'Editar Assinante' : 'Novo Assinante'}>
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Trigrama</label>
            <input value={nomeGuerra} maxLength={3}
              onChange={(e) => setNomeGuerra(e.target.value.toUpperCase().replace(/[^A-ZÀ-ÚÖ]/g, '').slice(0, 3))}
              className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto uppercase tracking-widest" required disabled={!!editando} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto">
                <option value="oficial">Oficial</option>
                <option value="graduado">Graduado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Plano</label>
              <select value={plano} onChange={(e) => setPlano(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto">
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Valor (R$)</label>
            <input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)}
              className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" required />
          </div>
          <Button type="submit" className="w-full">{editando ? 'Salvar' : 'Adicionar'}</Button>
        </form>
      </Modal>
    </AdminLayout>
  );
}
