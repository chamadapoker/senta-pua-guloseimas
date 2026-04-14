import { useEffect, useState } from 'react';
import { AppLayout } from '../../../components/AppLayout';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { api } from '../../../services/api';

interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  estoque: number;
  estoque_min: number;
}

export function CafeInsumos() {
  const [tipo, setTipo] = useState<'oficial' | 'graduado'>(() =>
    (localStorage.getItem('cafe_tipo') as 'oficial' | 'graduado') || 'graduado'
  );
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Insumo | null>(null);
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('un');
  const [estoque, setEstoque] = useState('0');
  const [estoqueMin, setEstoqueMin] = useState('0');

  useEffect(() => { localStorage.setItem('cafe_tipo', tipo); }, [tipo]);
  const carregar = () => api.get<Insumo[]>(`/api/cafe/admin/insumos?tipo=${tipo}`).then(setInsumos);
  useEffect(() => { carregar(); }, [tipo]);

  const abrirNovo = () => {
    setEditando(null);
    setNome(''); setUnidade('un'); setEstoque('0'); setEstoqueMin('0');
    setModalAberto(true);
  };

  const abrirEditar = (i: Insumo) => {
    setEditando(i);
    setNome(i.nome); setUnidade(i.unidade); setEstoque(String(i.estoque)); setEstoqueMin(String(i.estoque_min));
    setModalAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { nome, unidade, estoque: parseFloat(estoque), estoque_min: parseFloat(estoqueMin), tipo };
    if (editando) {
      await api.put(`/api/cafe/admin/insumos/${editando.id}`, data);
    } else {
      await api.post('/api/cafe/admin/insumos', data);
    }
    setModalAberto(false);
    carregar();
  };

  const excluir = async (i: Insumo) => {
    if (!confirm(`Excluir "${i.nome}"?`)) return;
    await api.delete(`/api/cafe/admin/insumos/${i.id}`);
    carregar();
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-2xl text-azul tracking-wider">ESTOQUE INSUMOS</h1>
        <Button size="sm" onClick={abrirNovo}>+ Adicionar</Button>
      </div>
      <div className="flex gap-1 mb-5">
        <button onClick={() => setTipo('oficial')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tipo === 'oficial' ? 'bg-azul text-white' : 'bg-white text-texto-fraco border border-borda'}`}>
          Oficiais
        </button>
        <button onClick={() => setTipo('graduado')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tipo === 'graduado' ? 'bg-azul text-white' : 'bg-white text-texto-fraco border border-borda'}`}>
          Graduados
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {insumos.map((i) => {
          const alerta = i.estoque <= i.estoque_min;
          return (
            <div key={i.id} className={`bg-white rounded-xl p-4 border shadow-sm ${alerta ? 'border-vermelho' : 'border-borda'}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-texto">{i.nome}</h3>
                {alerta && <span className="text-xs bg-red-50 text-vermelho px-2 py-0.5 rounded-full border border-red-200 font-medium">Baixo</span>}
              </div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className={`text-2xl font-display font-bold ${alerta ? 'text-vermelho' : 'text-azul'}`}>{i.estoque}</span>
                <span className="text-sm text-texto-fraco">{i.unidade}</span>
              </div>
              <p className="text-xs text-texto-fraco mb-3">Minimo: {i.estoque_min} {i.unidade}</p>
              <div className="flex gap-2">
                <button onClick={() => abrirEditar(i)} className="text-azul text-xs font-medium hover:underline">Editar</button>
                <button onClick={() => excluir(i)} className="text-vermelho text-xs font-medium hover:underline">Excluir</button>
              </div>
            </div>
          );
        })}
      </div>

      {insumos.length === 0 && <div className="text-center py-12 text-gray-400">Nenhum insumo cadastrado</div>}

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar Insumo' : 'Novo Insumo'}>
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" required placeholder="Ex: Cafe, Acucar, Copos..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Unidade</label>
              <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto">
                <option value="un">un</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="L">L</option>
                <option value="ml">ml</option>
                <option value="pct">pct</option>
                <option value="cx">cx</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Estoque</label>
              <input type="number" step="0.01" value={estoque} onChange={(e) => setEstoque(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Minimo</label>
              <input type="number" step="0.01" value={estoqueMin} onChange={(e) => setEstoqueMin(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" />
            </div>
          </div>
          <Button type="submit" className="w-full">{editando ? 'Salvar' : 'Criar'}</Button>
        </form>
      </Modal>
    </AppLayout>
  );
}
