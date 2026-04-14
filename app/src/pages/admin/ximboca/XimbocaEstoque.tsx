import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/AppLayout';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { api } from '../../../services/api';

interface ItemEstoque {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  origem_evento: string | null;
}

export function XimbocaEstoque() {
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<ItemEstoque | null>(null);
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('0');
  const [unidade, setUnidade] = useState('un');
  const [origem, setOrigem] = useState('');

  const carregar = () => api.get<ItemEstoque[]>('/api/ximboca/estoque').then(setItens);
  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => { setEditando(null); setNome(''); setQuantidade('0'); setUnidade('un'); setOrigem(''); setModalAberto(true); };
  const abrirEditar = (i: ItemEstoque) => { setEditando(i); setNome(i.nome); setQuantidade(String(i.quantidade)); setUnidade(i.unidade); setOrigem(i.origem_evento || ''); setModalAberto(true); };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { nome, quantidade: parseFloat(quantidade), unidade, origem_evento: origem || null };
    if (editando) await api.put(`/api/ximboca/estoque/${editando.id}`, data);
    else await api.post('/api/ximboca/estoque', data);
    setModalAberto(false);
    carregar();
  };

  const excluir = async (i: ItemEstoque) => {
    if (!confirm(`Excluir "${i.nome}"?`)) return;
    await api.delete(`/api/ximboca/estoque/${i.id}`);
    carregar();
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-azul tracking-wider">ESTOQUE XIMBOCA</h1>
        <Button size="sm" onClick={abrirNovo}>+ Adicionar</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {itens.map(i => (
          <div key={i.id} className="bg-white rounded-xl p-4 border border-borda shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-texto">{i.nome}</h3>
            </div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-2xl font-display font-bold text-azul">{i.quantidade}</span>
              <span className="text-sm text-texto-fraco">{i.unidade}</span>
            </div>
            {i.origem_evento && <p className="text-xs text-texto-fraco mb-3">Sobra de: {i.origem_evento}</p>}
            <div className="flex gap-2">
              <button onClick={() => abrirEditar(i)} className="text-azul text-xs font-medium hover:underline">Editar</button>
              <button onClick={() => excluir(i)} className="text-vermelho text-xs font-medium hover:underline">Excluir</button>
            </div>
          </div>
        ))}
      </div>

      {itens.length === 0 && <div className="text-center py-12 text-gray-400">Nenhum item em estoque</div>}

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar Item' : 'Novo Item'}>
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" required placeholder="Ex: Carvao, Cerveja, Copo..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Quantidade</label>
              <input type="number" step="0.01" value={quantidade} onChange={e => setQuantidade(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unidade</label>
              <select value={unidade} onChange={e => setUnidade(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto">
                <option value="un">un</option>
                <option value="kg">kg</option>
                <option value="L">L</option>
                <option value="fardo">fardo</option>
                <option value="pct">pct</option>
                <option value="cx">cx</option>
                <option value="saco">saco</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sobra de qual evento (opcional)</label>
            <input value={origem} onChange={e => setOrigem(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" placeholder="Ex: Churrasco Abril" />
          </div>
          <Button type="submit" className="w-full">{editando ? 'Salvar' : 'Criar'}</Button>
        </form>
      </Modal>
    </AppLayout>
  );
}
