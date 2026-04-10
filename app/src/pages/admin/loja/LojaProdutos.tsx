import { useEffect, useState, useRef } from 'react';
import { AdminLayout } from '../../../components/Layout';
import { Button } from '../../../components/ui/Button';
import { Toggle } from '../../../components/ui/Toggle';
import { Modal } from '../../../components/ui/Modal';
import { api } from '../../../services/api';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

async function uploadImagem(file: File): Promise<string> {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${WORKER_URL}/api/images/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error('Falha no upload');
  const data = await res.json() as { url: string };
  return data.url;
}

const ORDEM_TAMANHOS: Record<string, number> = {
  'PP': 1, 'P': 2, 'M': 3, 'G': 4, 'GG': 5, 'XG': 6, 'XXG': 7, 'EG': 8, 'EGG': 9,
};

function ordenarVariacoes(variacoes: Variacao[]): Variacao[] {
  return [...variacoes].sort((a, b) => {
    const ordemA = ORDEM_TAMANHOS[a.tamanho?.toUpperCase() || ''] ?? 99;
    const ordemB = ORDEM_TAMANHOS[b.tamanho?.toUpperCase() || ''] ?? 99;
    if (ordemA !== ordemB) return ordemA - ordemB;
    return (a.cor || '').localeCompare(b.cor || '');
  });
}

interface Variacao {
  id?: string;
  nome: string;
  tamanho?: string;
  cor?: string;
  estoque: number;
}

interface Imagem {
  id?: string;
  url: string;
  ordem: number;
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
  imagens: Imagem[];
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
  const [imagens, setImagens] = useState<{ url: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [variacoes, setVariacoes] = useState<Variacao[]>([]);
  const [novaTamanho, setNovaTamanho] = useState('');
  const [novaCor, setNovaCor] = useState('');

  const carregar = () => api.get<LojaProduto[]>('/api/loja/admin/produtos').then(setProdutos);
  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
    setEditando(null);
    setNome(''); setDescricao(''); setPreco(''); setOrdem('0'); setDisponivel(true);
    setImagens([]);
    setVariacoes([]); setNovaTamanho(''); setNovaCor('');
    setModalAberto(true);
  };

  const abrirEditar = (p: LojaProduto) => {
    setEditando(p);
    setNome(p.nome); setDescricao(p.descricao); setPreco(String(p.preco)); setOrdem(String(p.ordem)); setDisponivel(!!p.disponivel);
    setImagens((p.imagens || []).map(i => ({ url: i.url, preview: resolveImg(i.url) || i.url })));
    setVariacoes(p.variacoes || []);
    setNovaTamanho(''); setNovaCor('');
    setModalAberto(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || imagens.length >= 3) return;
    const preview = URL.createObjectURL(file);
    setUploading(true);
    try {
      const url = await uploadImagem(file);
      setImagens(prev => [...prev, { url, preview }]);
    } catch {
      alert('Erro ao enviar imagem. Tente novamente.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removerImagem = (index: number) => {
    setImagens(prev => prev.filter((_, i) => i !== index));
  };

  const adicionarVariacao = () => {
    const tamanho = novaTamanho.trim().toUpperCase();
    const cor = novaCor.trim();
    if (!tamanho && !cor) return;
    const nome = [tamanho, cor].filter(Boolean).join(' - ');
    setVariacoes(ordenarVariacoes([...variacoes, { nome, tamanho: tamanho || undefined, cor: cor || undefined, estoque: 0 }]));
    setNovaTamanho(''); setNovaCor('');
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
      imagem_url: imagens[0]?.url || null,
      imagens: imagens.map((img, i) => ({ url: img.url, ordem: i })),
      variacoes: variacoes.map(v => ({ nome: v.nome, tamanho: v.tamanho || null, cor: v.cor || null, estoque: v.estoque })),
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
            <div className="aspect-video bg-fundo relative">
              {p.imagens?.length > 0 ? (
                <img src={resolveImg(p.imagens[0].url)!} alt={p.nome} className="w-full h-full object-cover" />
              ) : resolveImg(p.imagem_url) ? (
                <img src={resolveImg(p.imagem_url)!} alt={p.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-texto-fraco/30">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
              )}
              <div className="absolute top-2 right-2">
                <Toggle checked={!!p.disponivel} onChange={() => toggleDisponivel(p)} />
              </div>
              {p.imagens?.length > 1 && (
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                  {p.imagens.length} fotos
                </div>
              )}
            </div>
            <div className="bg-azul p-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm text-white">{p.nome}</h3>
                <span className="text-white/90 font-bold">R$ {p.preco.toFixed(2)}</span>
              </div>
              {p.descricao && <p className="text-xs text-white/60">{p.descricao}</p>}
            </div>
            <div className="p-3">
              {p.variacoes?.length > 0 ? (
                <div className="space-y-1 mb-3">
                  {ordenarVariacoes(p.variacoes).map((v, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-texto font-medium">{v.tamanho || ''}</span>
                        {v.cor && <span className="text-texto-fraco">({v.cor})</span>}
                        {!v.tamanho && !v.cor && <span className="text-texto">{v.nome}</span>}
                      </div>
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
          {/* Upload de imagens (até 3) */}
          <div>
            <label className="block text-sm font-medium mb-2">Fotos do produto (até 3)</label>
            <div className="flex gap-2 flex-wrap">
              {imagens.map((img, i) => (
                <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-borda">
                  <img src={img.preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removerImagem(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-vermelho text-white rounded-full flex items-center justify-center text-xs">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              {imagens.length < 3 && (
                <div
                  onClick={() => !uploading && fileRef.current?.click()}
                  className="w-24 h-24 rounded-xl bg-fundo border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-azul transition-colors"
                >
                  {uploading ? (
                    <div className="text-[10px] text-texto-fraco animate-pulse">Enviando...</div>
                  ) : (
                    <div className="text-center">
                      <svg className="w-6 h-6 mx-auto text-texto-fraco/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                      <span className="text-[10px] text-texto-fraco">Foto</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>

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
            <label className="block text-sm font-medium mb-2">Variações</label>
            {variacoes.length > 0 && (
              <div className="space-y-2 mb-3">
                {variacoes.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 bg-fundo rounded-lg px-3 py-2">
                    <div className="flex-1 flex items-center gap-1.5 text-sm">
                      {v.tamanho && <span className="bg-azul text-white px-2 py-0.5 rounded text-xs font-bold">{v.tamanho}</span>}
                      {v.cor && <span className="text-texto-fraco text-xs">{v.cor}</span>}
                      {!v.tamanho && !v.cor && <span className="text-texto text-xs">{v.nome}</span>}
                    </div>
                    <input
                      type="number"
                      min="0"
                      value={v.estoque}
                      onChange={(e) => atualizarEstoqueVariacao(i, parseInt(e.target.value) || 0)}
                      className="w-16 bg-white border border-borda rounded-lg px-2 py-1 text-sm text-center"
                      placeholder="Est."
                    />
                    <button type="button" onClick={() => removerVariacao(i)} className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-vermelho">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={novaTamanho}
                onChange={(e) => setNovaTamanho(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), adicionarVariacao())}
                placeholder="Tamanho (PP, P, M...)"
                className="flex-1 bg-white border border-borda rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={novaCor}
                onChange={(e) => setNovaCor(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), adicionarVariacao())}
                placeholder="Cor (opcional)"
                className="flex-1 bg-white border border-borda rounded-lg px-3 py-2 text-sm"
              />
              <Button type="button" size="sm" onClick={adicionarVariacao}>+</Button>
            </div>
            <p className="text-xs text-texto-fraco mt-1">Tamanhos são ordenados: PP, P, M, G, GG, XG</p>
          </div>

          {/* Disponível */}
          <div className="flex items-center justify-between bg-fundo rounded-xl px-4 py-3">
            <span className="text-sm font-medium">{disponivel ? 'Disponível' : 'Indisponível'}</span>
            <Toggle checked={disponivel} onChange={setDisponivel} />
          </div>

          <Button type="submit" className="w-full" disabled={uploading}>
            {uploading ? 'Aguarde o upload...' : editando ? 'Salvar' : 'Criar'}
          </Button>
        </form>
      </Modal>
    </AdminLayout>
  );
}
