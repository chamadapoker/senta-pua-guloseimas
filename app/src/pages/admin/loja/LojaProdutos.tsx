import { useEffect, useState } from 'react';
import { AdminLayout } from '../../../components/Layout';
import { Button } from '../../../components/ui/Button';
import { Toggle } from '../../../components/ui/Toggle';
import { Modal } from '../../../components/ui/Modal';
import { api } from '../../../services/api';

interface Variacao {
  id?: string;
  nome: string;
  estoque: number;
}

interface LojaProduto {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  imagem_url: string | null;
  disponivel: number;
  ordem: number;
  variacoes: Variacao[];
}

export function LojaProdutos() {
  const [produtos, setProdutos] = useState<LojaProduto[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<LojaProduto | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [preco, setPreco] = useState('');
  const [ordem, setOrdem] = useState('0');
  const [disponivel, setDisponivel] = useState(true);
  const [variacoes, setVariacoes] = useState<Variacao[]>([]);
  const [novaVariacao, setNovaVariacao] = useState('');

  const carregar = () => api.get<LojaProduto[]>('/api/loja/admin/produtos').then(setProdutos);
  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
    setEditando(null);
    setNome(''); setDescricao(''); setPreco(''); setOrdem('0'); setDisponivel(true);
    setVariacoes([]); setNovaVariacao('');
    setModalAberto(true);
  };

  const abrirEditar = (p: LojaProduto) => {
    setEditando(p);
    setNome(p.nome); setDescricao(p.descricao); setPreco(String(p.preco)); setOrdem(String(p.ordem)); setDisponivel(!!p.disponivel);
    setVariacoes(p.variacoes || []);
    setNovaVariacao('');
    setModalAberto(true);
  };

  const adicionarVariacao = () => {
    if (!novaVariacao.trim()) return;
    setVariacoes([...variacoes, { nome: novaVariacao.trim(), estoque: 0 }]);
    setNovaVariacao('');
  };

  const removerVariacao = (index: number) => {
    setVariacoes(variacoes.filter((_, i) => i !== index));
  };

  const atualizarEstoqueVariacao = (index: number, estoque: number) => {
    const novas = [...variacoes];
    novas[index] = { ...novas[index], estoque };
    setVariacoes(novas);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      nome,
      descricao,
      preco: parseFloat(preco),
      ordem: parseInt(ordem),
      disponivel: disponivel ? 1 : 0,
      variacoes: variacoes.map(v => ({ nome: v.nome, estoque: v.estoque })),
    };
    if (editando) {
      await api.put(`/api/loja/admin/produtos/${editando.id}`, data);
    } else {
      await api.post('/api/loja/admin/produtos', data);
    }
    setModalAberto(false);
    carregar();
  };

  const toggleDisponivel = async (p: LojaProduto) => {
    await api.put(`/api/loja/admin/produtos/${p.id}`, { disponivel: p.disponivel ? 0 : 1 });
    carregar();
  };

  const excluir = async (p: LojaProduto) => {
    if (!confirm(`Excluir "${p.nome}"?`)) return;
    await api.delete(`/api/loja/admin/produtos/${p.id}`);
    carregar();
  };

  const estoqueTotal = (p: LojaProduto) => p.variacoes?.reduce((acc, v) => acc + v.estoque, 0) ?? 0;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl text-azul tracking-wider">PRODUTOS - LOJA</h1>
        <Button size="sm" onClick={abrirNovo}>+ Adicionar</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {produtos.map((p) => (
          <div key={p.id} className="bg-fundo-card rounded-xl overflow-hidden border border-borda">
            <div className="bg-azul p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm text-white">{p.nome}</h3>
                <Toggle checked={!!p.disponivel} onChange={() => toggleDisponivel(p)} />
              </div>
              <span className="text-white/90 font-bold">R$ {p.preco.toFixed(2)}</span>
              {p.descricao && <p className="text-xs text-white/60 mt-1">{p.descricao}</p>}
            </div>
            <div className="p-3">
              {p.variacoes?.length > 0 ? (
                <div className="space-y-1 mb-3">
                  {p.variacoes.map((v, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-texto">{v.nome}</span>
                      <span className={`font-medium ${v.estoque <= 0 ? 'text-vermelho' : v.estoque <= 3 ? 'text-amber-500' : 'text-verde'}`}>
                        Est: {v.estoque}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-texto-fraco mb-3">Sem variações</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-texto-fraco">Total: {estoqueTotal(p)} un.</span>
                <div className="flex gap-2">
                  <button onClick={() => abrirEditar(p)} className="text-azul text-xs font-medium hover:underline">Editar</button>
                  <button onClick={() => excluir(p)} className="text-vermelho text-xs font-medium hover:underline">Excluir</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {produtos.length === 0 && (
        <div className="text-center py-12 text-gray-400">Nenhum produto cadastrado</div>
      )}

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar Produto' : 'Novo Produto'}>
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Preço (R$)</label>
              <input type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ordem</label>
              <input type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" />
            </div>
          </div>

          {/* Variações */}
          <div>
            <label className="block text-sm font-medium mb-2">Variações (tamanho, cor...)</label>
            <div className="space-y-2 mb-2">
              {variacoes.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-1 text-sm bg-fundo rounded-lg px-3 py-2">{v.nome}</span>
                  <input
                    type="number"
                    min="0"
                    value={v.estoque}
                    onChange={(e) => atualizarEstoqueVariacao(i, parseInt(e.target.value) || 0)}
                    className="w-20 bg-white border border-borda rounded-lg px-2 py-2 text-sm text-center"
                    placeholder="Est."
                  />
                  <button type="button" onClick={() => removerVariacao(i)} className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-vermelho text-sm">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={novaVariacao}
                onChange={(e) => setNovaVariacao(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), adicionarVariacao())}
                placeholder="Ex: P, M, G, GG, Azul..."
                className="flex-1 bg-white border border-borda rounded-lg px-3 py-2 text-sm"
              />
              <Button type="button" size="sm" onClick={adicionarVariacao}>+</Button>
            </div>
          </div>

          {/* Disponível */}
          <div className="flex items-center justify-between bg-fundo rounded-xl px-4 py-3">
            <span className="text-sm font-medium">{disponivel ? 'Disponível' : 'Indisponível'}</span>
            <Toggle checked={disponivel} onChange={setDisponivel} />
          </div>

          <Button type="submit" className="w-full">
            {editando ? 'Salvar' : 'Criar'}
          </Button>
        </form>
      </Modal>
    </AdminLayout>
  );
}
