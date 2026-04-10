import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/Layout';
import { Button } from '../../components/ui/Button';
import { Toggle } from '../../components/ui/Toggle';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../services/api';
import type { Produto } from '../../types';

export function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [form, setForm] = useState({ nome: '', emoji: '🍬', preco: '', ordem: '0' });

  const carregar = () => api.get<Produto[]>('/api/produtos/todos').then(setProdutos);

  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ nome: '', emoji: '🍬', preco: '', ordem: '0' });
    setModalAberto(true);
  };

  const abrirEditar = (p: Produto) => {
    setEditando(p);
    setForm({ nome: p.nome, emoji: p.emoji, preco: String(p.preco), ordem: String(p.ordem) });
    setModalAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { nome: form.nome, emoji: form.emoji, preco: parseFloat(form.preco), ordem: parseInt(form.ordem) };
    if (editando) {
      await api.put(`/api/produtos/${editando.id}`, data);
    } else {
      await api.post('/api/produtos', data);
    }
    setModalAberto(false);
    carregar();
  };

  const toggleDisponivel = async (p: Produto) => {
    await api.put(`/api/produtos/${p.id}`, { disponivel: p.disponivel ? 0 : 1 });
    carregar();
  };

  const excluir = async (p: Produto) => {
    if (!confirm(`Excluir "${p.nome}"?`)) return;
    await api.delete(`/api/produtos/${p.id}`);
    carregar();
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-azul">Produtos</h1>
        <Button size="sm" onClick={abrirNovo}>+ Adicionar</Button>
      </div>

      <div className="bg-white rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left"></th>
              <th className="px-4 py-2 text-left">Nome</th>
              <th className="px-4 py-2 text-right">Preço</th>
              <th className="px-4 py-2 text-center">Ativo</th>
              <th className="px-4 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-3 text-xl">{p.emoji}</td>
                <td className="px-4 py-3 font-medium">{p.nome}</td>
                <td className="px-4 py-3 text-right">R$ {p.preco.toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <Toggle checked={!!p.disponivel} onChange={() => toggleDisponivel(p)} />
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button onClick={() => abrirEditar(p)} className="text-azul hover:underline">Editar</button>
                  <button onClick={() => excluir(p)} className="text-vermelho hover:underline">Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar Produto' : 'Novo Produto'}>
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full border rounded-lg px-3 py-2" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Emoji</label>
              <input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Preço (R$)</label>
              <input type="number" step="0.01" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} className="w-full border rounded-lg px-3 py-2" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ordem</label>
            <input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} className="w-full border rounded-lg px-3 py-2" />
          </div>
          <Button type="submit" className="w-full">{editando ? 'Salvar' : 'Criar'}</Button>
        </form>
      </Modal>
    </AdminLayout>
  );
}
