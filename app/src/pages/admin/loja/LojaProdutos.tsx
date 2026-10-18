import { useCallback, useEffect, useState, useRef } from 'react';
import { AppLayout } from '../../../components/AppLayout';
import { Button } from '../../../components/ui/Button';
import { PageHeader } from '../../../components/ui/PageHeader';
import { inputClass } from '../../../components/ui/Field';
import { Toggle } from '../../../components/ui/Toggle';
import { Modal } from '../../../components/ui/Modal';
import { api } from '../../../services/api';
import { useConfirm } from '../../../hooks/useConfirm';
import { useToast } from '../../../hooks/useToast';
import { Icon } from '../../../components/ui/Icon';
import { Card } from '../../../components/ui/Card';
import { Loading } from '../../../components/ui/Loading';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Badge } from '../../../components/ui/Badge';
import type { LojaCategoria } from '../../../types';

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
  categoria_id?: string | null;
  variacoes: Variacao[];
  imagens: Imagem[];
}

const NOVA_CATEGORIA = '__nova__';
type FiltroCategoria = 'todas' | 'sem' | string;

const msgErro = (e: unknown, padrao = 'tente novamente') => (e instanceof Error && e.message ? e.message : padrao);

export function LojaProdutos() {
  const [produtos, setProdutos] = useState<LojaProduto[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const fecharModal = useCallback(() => setModalAberto(false), []);
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
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [criandoCatForm, setCriandoCatForm] = useState(false);
  const [novaCatForm, setNovaCatForm] = useState('');
  const confirmar = useConfirm();
  const { showToast } = useToast();

  // Categorias
  const [categorias, setCategorias] = useState<LojaCategoria[]>([]);
  const [catModalAberto, setCatModalAberto] = useState(false);
  const fecharCatModal = useCallback(() => setCatModalAberto(false), []);
  const [novaCatNome, setNovaCatNome] = useState('');
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [renomeandoNome, setRenomeandoNome] = useState('');
  const [catOcupada, setCatOcupada] = useState(false);
  const [filtroCat, setFiltroCat] = useState<FiltroCategoria>('todas');

  const carregarCategorias = () =>
    api.get<LojaCategoria[]>('/api/loja/categorias')
      .then(setCategorias)
      .catch(() => { /* sem categorias, a tela segue funcionando */ });

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const carregar = () => {
    setErro('');
    return api.get<LojaProduto[]>('/api/loja/admin/produtos')
      .then(setProdutos)
      .catch((e: any) => setErro(e?.message || 'Erro ao carregar produtos'))
      .finally(() => setCarregando(false));
  };
  useEffect(() => { carregar(); carregarCategorias(); }, []);

  const nomeCategoria = (id: string | null | undefined) => (id ? categorias.find(c => c.id === id)?.nome : undefined);
  const contagemCat = (id: string) => produtos.filter(p => p.categoria_id === id).length;
  const semCategoriaQtd = produtos.filter(p => !p.categoria_id || !categorias.some(c => c.id === p.categoria_id)).length;
  const produtosFiltrados = produtos.filter(p => {
    if (filtroCat === 'todas') return true;
    if (filtroCat === 'sem') return !p.categoria_id || !categorias.some(c => c.id === p.categoria_id);
    return p.categoria_id === filtroCat;
  });

  const criarCategoria = async (nomeCat: string): Promise<LojaCategoria | null> => {
    const n = nomeCat.trim();
    if (!n) return null;
    setCatOcupada(true);
    try {
      const nova = await api.post<LojaCategoria>('/api/loja/admin/categorias', { nome: n });
      await carregarCategorias();
      showToast(`Categoria "${nova.nome}" criada`, 'success');
      return nova;
    } catch (e) {
      showToast('Erro ao criar categoria: ' + msgErro(e), 'error');
      return null;
    } finally {
      setCatOcupada(false);
    }
  };

  const adicionarCategoria = async () => {
    const nova = await criarCategoria(novaCatNome);
    if (nova) setNovaCatNome('');
  };

  const salvarRenomear = async (c: LojaCategoria) => {
    const n = renomeandoNome.trim();
    if (!n || n === c.nome) { setRenomeandoId(null); return; }
    setCatOcupada(true);
    try {
      await api.put(`/api/loja/admin/categorias/${c.id}`, { nome: n });
      setRenomeandoId(null);
      await carregarCategorias();
    } catch (e) {
      showToast('Erro ao renomear: ' + msgErro(e), 'error');
    } finally {
      setCatOcupada(false);
    }
  };

  const moverCategoria = async (index: number, direcao: -1 | 1) => {
    const alvo = index + direcao;
    if (alvo < 0 || alvo >= categorias.length) return;
    const novas = [...categorias];
    [novas[index], novas[alvo]] = [novas[alvo], novas[index]];
    // Renumera tudo (0..n-1) para a troca funcionar mesmo se as ordens estiverem repetidas
    const renumeradas = novas.map((c, i) => ({ ...c, ordem: i }));
    const alteradas = renumeradas.filter(c => categorias.find(o => o.id === c.id)?.ordem !== c.ordem);
    setCategorias(renumeradas);
    setCatOcupada(true);
    try {
      await Promise.all(alteradas.map(c => api.put(`/api/loja/admin/categorias/${c.id}`, { ordem: c.ordem })));
    } catch (e) {
      showToast('Erro ao reordenar: ' + msgErro(e), 'error');
    } finally {
      setCatOcupada(false);
      carregarCategorias();
    }
  };

  const excluirCategoria = async (c: LojaCategoria) => {
    const qtd = contagemCat(c.id);
    const aviso = qtd === 0
      ? 'Nenhum produto usa esta categoria.'
      : qtd === 1 ? 'O produto desta categoria ficará sem categoria.' : `Os ${qtd} produtos desta categoria ficarão sem categoria.`;
    if (!(await confirmar({ title: 'Excluir categoria', message: `Excluir "${c.nome}"? ${aviso}`, confirmText: 'Excluir', danger: true }))) return;
    setCatOcupada(true);
    try {
      await api.delete(`/api/loja/admin/categorias/${c.id}`);
      if (filtroCat === c.id) setFiltroCat('todas');
      await Promise.all([carregarCategorias(), carregar()]);
    } catch (e) {
      showToast('Erro ao excluir categoria: ' + msgErro(e), 'error');
    } finally {
      setCatOcupada(false);
    }
  };

  const confirmarNovaCatForm = async () => {
    const nova = await criarCategoria(novaCatForm);
    if (nova) {
      setCategoriaId(nova.id);
      setCriandoCatForm(false);
      setNovaCatForm('');
    }
  };

  const abrirNovo = () => {
    setEditando(null);
    setNome(''); setDescricao(''); setPreco(''); setOrdem('0'); setDisponivel(true);
    setImagens([]);
    setVariacoes([]); setNovaTamanho(''); setNovaCor('');
    setCategoriaId(filtroCat !== 'todas' && filtroCat !== 'sem' ? filtroCat : '');
    setCriandoCatForm(false); setNovaCatForm('');
    setModalAberto(true);
  };

  const abrirEditar = (p: LojaProduto) => {
    setEditando(p);
    setNome(p.nome); setDescricao(p.descricao); setPreco(String(p.preco)); setOrdem(String(p.ordem)); setDisponivel(!!p.disponivel);
    setImagens((p.imagens || []).map(i => ({ url: i.url, preview: resolveImg(i.url) || i.url })));
    setVariacoes(p.variacoes || []);
    setNovaTamanho(''); setNovaCor('');
    setCategoriaId(p.categoria_id && categorias.some(c => c.id === p.categoria_id) ? p.categoria_id : '');
    setCriandoCatForm(false); setNovaCatForm('');
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
      showToast('Erro ao enviar imagem. Tente novamente.', 'error');
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
      categoria_id: categoriaId || null,
      imagens: imagens.map((img, i) => ({ url: img.url, ordem: i })),
      variacoes: variacoes.map(v => ({ nome: v.nome || `${v.tamanho || ''}${v.cor ? ' - ' + v.cor : ''}`.trim(), tamanho: v.tamanho || null, cor: v.cor || null, estoque: v.estoque ?? 0 })),
    };
    try {
      if (editando) {
        await api.put(`/api/loja/admin/produtos/${editando.id}`, data);
      } else {
        await api.post('/api/loja/admin/produtos', data);
      }
      setModalAberto(false);
      carregar();
      carregarCategorias();
    } catch (err) {
      showToast('Erro ao salvar: ' + (err instanceof Error ? err.message : 'tente novamente'), 'error');
    }
  };

  const toggleDisponivel = async (p: LojaProduto) => {
    await api.put(`/api/loja/admin/produtos/${p.id}`, { disponivel: p.disponivel ? 0 : 1 });
    carregar();
  };

  const excluir = async (p: LojaProduto) => {
    if (!(await confirmar({ title: 'Excluir produto', message: `Excluir "${p.nome}"?`, confirmText: 'Excluir', danger: true }))) return;
    await api.delete(`/api/loja/admin/produtos/${p.id}`);
    carregar();
  };

  const estoqueTotal = (p: LojaProduto) => p.variacoes?.reduce((acc, v) => acc + v.estoque, 0) ?? 0;

  return (
    <AppLayout>
      <PageHeader
        title="Produtos da loja"
        subtitle="Cadastre produtos, fotos, tamanhos e estoque."
        right={
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="ghost" onClick={() => setCatModalAberto(true)}><Icon name="tag" size={16} /> Categorias</Button>
            <Button size="sm" onClick={abrirNovo}><Icon name="plus" size={16} /> Novo produto</Button>
          </div>
        }
      />

      {!erro && !carregando && produtos.length > 0 && categorias.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filtrar por categoria">
          {([
            { id: 'todas', nome: 'Todas', qtd: produtos.length },
            ...categorias.map(c => ({ id: c.id, nome: c.nome, qtd: contagemCat(c.id) })),
            ...(semCategoriaQtd > 0 ? [{ id: 'sem', nome: 'Sem categoria', qtd: semCategoriaQtd }] : []),
          ]).map(f => (
            <button key={f.id} type="button" aria-pressed={filtroCat === f.id} onClick={() => setFiltroCat(f.id)}
              className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full text-sm font-medium border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${
                filtroCat === f.id ? 'bg-noite text-white border-noite' : 'bg-white text-texto border-borda hover:border-azul/60'
              }`}>
              {f.nome}
              <span className={`text-xs tabular-nums ${filtroCat === f.id ? 'text-white/80' : 'text-texto-fraco'}`}>{f.qtd}</span>
            </button>
          ))}
        </div>
      )}

      {erro ? (
        <Card className="text-center py-10">
          <p className="text-escarlate text-sm mb-4">{erro}</p>
          <Button size="sm" onClick={() => { setCarregando(true); carregar(); }}><Icon name="refresh" size={16} /> Tentar de novo</Button>
        </Card>
      ) : carregando ? (
        <Loading label="Carregando produtos..." />
      ) : produtos.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="tag" size={24} />}
            message="Nenhum produto cadastrado"
            hint="Cadastre o primeiro produto para ele aparecer na loja."
            action={<Button size="sm" onClick={abrirNovo}><Icon name="plus" size={16} /> Novo produto</Button>}
          />
        </Card>
      ) : produtosFiltrados.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="tag" size={24} />}
            message="Nenhum produto nesta categoria"
            action={<Button size="sm" variant="ghost" onClick={() => setFiltroCat('todas')}>Ver todos</Button>}
          />
        </Card>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {produtosFiltrados.map((p) => (
          <div key={p.id} className={`bg-white rounded-2xl overflow-hidden border border-borda shadow-sm flex flex-col ${p.disponivel ? '' : 'opacity-75'}`}>
            <div className="aspect-video bg-fundo relative">
              {p.imagens?.length > 0 ? (
                <img src={resolveImg(p.imagens[0].url)!} alt={p.nome} className="w-full h-full object-cover" />
              ) : resolveImg(p.imagem_url) ? (
                <img src={resolveImg(p.imagem_url)!} alt={p.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-texto-fraco/40">
                  <Icon name="tag" size={40} />
                </div>
              )}
              {p.imagens?.length > 1 && (
                <div className="absolute bottom-2 left-2 bg-noite/70 text-white text-xs px-2 py-0.5 rounded-full">
                  {p.imagens.length} fotos
                </div>
              )}
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="font-semibold text-noite min-w-0 break-words">{p.nome}</h3>
                <span className="font-display text-xl text-dourado tracking-wide leading-none shrink-0">{brl(p.preco)}</span>
              </div>
              {nomeCategoria(p.categoria_id) && (
                <span className="self-start inline-flex items-center gap-1 text-[11px] font-medium text-azul bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 mb-1.5">
                  <Icon name="tag" size={12} /> {nomeCategoria(p.categoria_id)}
                </span>
              )}
              {p.descricao && <p className="text-sm text-texto-fraco mb-2 break-words">{p.descricao}</p>}

              <div className="flex items-center justify-between gap-2 bg-fundo rounded-xl px-3 py-2 my-2">
                <span className="text-sm">{p.disponivel ? <Badge variant="success">À venda</Badge> : <Badge variant="neutral">Fora da loja</Badge>}</span>
                <label className="flex items-center gap-2 text-xs text-texto-fraco">
                  <span className="sr-only">Disponível na loja: {p.nome}</span>
                  <Toggle checked={!!p.disponivel} onChange={() => toggleDisponivel(p)} />
                </label>
              </div>

              {p.variacoes?.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {ordenarVariacoes(p.variacoes).map((v, i) => (
                    <span key={i} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border ${
                      v.estoque <= 0 ? 'bg-red-50 border-red-200 text-red-700' : v.estoque <= 3 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-green-50 border-green-200 text-verde-escuro'
                    }`}>
                      <span className="font-medium">{v.tamanho || (!v.cor ? v.nome : '')}</span>
                      {v.cor && <span>{v.tamanho ? `(${v.cor})` : v.cor}</span>}
                      <span>· {v.estoque}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-texto-fraco mb-3">Sem variações</p>
              )}
              <div className="mt-auto flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-borda">
                <span className="text-xs text-texto-fraco">Estoque total: <strong className="text-texto">{estoqueTotal(p)}</strong> un.</span>
                <div className="flex gap-2">
                  <Button variant="chip-primary" size="sm" onClick={() => abrirEditar(p)}><Icon name="pencil" size={15} /> Editar</Button>
                  <Button variant="chip-danger" size="sm" onClick={() => excluir(p)} aria-label={`Excluir ${p.nome}`}><Icon name="trash" size={15} /></Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      <Modal open={modalAberto} onClose={fecharModal} title={editando ? 'Editar produto' : 'Novo produto'} size="lg">
        <form onSubmit={salvar} className="space-y-4">
          {/* Upload de imagens (até 3) */}
          <div>
            <span className="block text-sm font-medium mb-2">Fotos do produto (até 3)</span>
            <div className="flex gap-2 flex-wrap">
              {imagens.map((img, i) => (
                <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-borda">
                  <img src={img.preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removerImagem(i)} aria-label={`Remover foto ${i + 1}`}
                    className="absolute top-1 right-1 w-8 h-8 bg-escarlate text-white rounded-full flex items-center justify-center">
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
              {imagens.length < 3 && (
                <button
                  type="button"
                  onClick={() => !uploading && fileRef.current?.click()}
                  disabled={uploading}
                  className="w-24 h-24 rounded-xl bg-fundo border-2 border-dashed border-borda flex flex-col items-center justify-center gap-1 text-texto-fraco hover:border-azul hover:text-azul transition-colors"
                >
                  {uploading ? (
                    <span className="text-xs">Enviando...</span>
                  ) : (
                    <>
                      <Icon name="upload" size={20} />
                      <span className="text-xs">Adicionar foto</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            <p className="text-xs text-texto-fraco mt-1">A primeira foto é a capa do produto.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="lp-nome" className="block text-sm font-medium mb-1.5">Nome</label>
              <input id="lp-nome" value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} required />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="lp-desc" className="block text-sm font-medium mb-1.5">Descrição</label>
              <input id="lp-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="lp-preco" className="block text-sm font-medium mb-1.5">Preço (R$)</label>
              <input id="lp-preco" type="number" step="0.01" inputMode="decimal" value={preco} onChange={(e) => setPreco(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label htmlFor="lp-ordem" className="block text-sm font-medium mb-1.5">Ordem na vitrine</label>
              <input id="lp-ordem" type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="lp-categoria" className="block text-sm font-medium mb-1.5">Categoria</label>
              <select
                id="lp-categoria"
                value={criandoCatForm ? NOVA_CATEGORIA : categoriaId}
                onChange={(e) => {
                  if (e.target.value === NOVA_CATEGORIA) { setCriandoCatForm(true); setNovaCatForm(''); }
                  else { setCriandoCatForm(false); setCategoriaId(e.target.value); }
                }}
                className={inputClass}
              >
                <option value="">Sem categoria</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                <option value={NOVA_CATEGORIA}>+ Nova categoria…</option>
              </select>
              {criandoCatForm && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                  <input
                    value={novaCatForm}
                    aria-label="Nome da nova categoria"
                    autoFocus
                    onChange={(e) => setNovaCatForm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); confirmarNovaCatForm(); }
                    }}
                    placeholder="Nome da categoria"
                    className={inputClass}
                  />
                  <Button type="button" size="sm" onClick={confirmarNovaCatForm} disabled={catOcupada || !novaCatForm.trim()}>
                    {catOcupada ? 'Criando...' : 'Criar'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setCriandoCatForm(false)}>Cancelar</Button>
                </div>
              )}
            </div>
          </div>

          {/* Variações */}
          <div>
            <span className="block text-sm font-medium mb-2">Tamanhos e cores</span>
            {variacoes.length > 0 && (
              <div className="space-y-2 mb-3">
                {variacoes.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 bg-fundo rounded-xl px-3 py-2">
                    <div className="flex-1 min-w-0 flex items-center gap-1.5 text-sm flex-wrap">
                      {v.tamanho && <span className="bg-noite text-white px-2 py-0.5 rounded text-xs font-bold">{v.tamanho}</span>}
                      {v.cor && <span className="text-texto-fraco text-xs">{v.cor}</span>}
                      {!v.tamanho && !v.cor && <span className="text-texto text-xs">{v.nome}</span>}
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-texto-fraco">
                      Estoque
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={v.estoque}
                        onChange={(e) => atualizarEstoqueVariacao(i, parseInt(e.target.value) || 0)}
                        className="w-16 min-h-[40px] bg-white border border-borda rounded-lg px-2 text-sm text-center text-texto"
                      />
                    </label>
                    <button type="button" onClick={() => removerVariacao(i)} aria-label={`Remover variação ${v.nome}`}
                      className="w-10 h-10 shrink-0 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-escarlate">
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
              <input
                value={novaTamanho}
                aria-label="Tamanho da nova variação"
                onChange={(e) => setNovaTamanho(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), adicionarVariacao())}
                placeholder="Tamanho (PP, P, M...)"
                className={inputClass}
              />
              <input
                value={novaCor}
                aria-label="Cor da nova variação"
                onChange={(e) => setNovaCor(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), adicionarVariacao())}
                placeholder="Cor (opcional)"
                className={inputClass}
              />
              <Button type="button" size="sm" variant="ghost" onClick={adicionarVariacao}><Icon name="plus" size={16} /> Adicionar</Button>
            </div>
            <p className="text-xs text-texto-fraco mt-1">Os tamanhos ficam em ordem: PP, P, M, G, GG, XG.</p>
          </div>

          {/* Disponível */}
          <div className="flex items-center justify-between bg-fundo rounded-xl px-4 py-3">
            <span className="text-sm font-medium">{disponivel ? 'À venda na loja' : 'Fora da loja'}</span>
            <Toggle checked={disponivel} onChange={setDisponivel} />
          </div>

          <Button type="submit" className="w-full" disabled={uploading}>
            {uploading ? 'Aguarde o envio da foto...' : editando ? 'Salvar alterações' : 'Criar produto'}
          </Button>
        </form>
      </Modal>

      <Modal open={catModalAberto} onClose={fecharCatModal} title="Categorias">
        <div className="space-y-4">
          <p className="text-sm text-texto-fraco">A ordem aqui é a ordem das seções na loja.</p>
          {categorias.length === 0 ? (
            <p className="text-sm text-texto-fraco bg-fundo rounded-xl px-4 py-3">Nenhuma categoria ainda. Crie a primeira abaixo.</p>
          ) : (
            <ul className="space-y-2">
              {categorias.map((c, i) => {
                const qtd = contagemCat(c.id);
                return (
                  <li key={c.id} className="flex items-center gap-2 bg-fundo rounded-xl px-2 py-2">
                    <div className="flex flex-col shrink-0">
                      <button type="button" onClick={() => moverCategoria(i, -1)} disabled={i === 0 || catOcupada}
                        aria-label={`Subir ${c.nome}`}
                        className="w-10 h-6 flex items-center justify-center rounded-md text-texto-fraco hover:bg-borda disabled:opacity-30">
                        <Icon name="chevron-up" size={16} />
                      </button>
                      <button type="button" onClick={() => moverCategoria(i, 1)} disabled={i === categorias.length - 1 || catOcupada}
                        aria-label={`Descer ${c.nome}`}
                        className="w-10 h-6 flex items-center justify-center rounded-md text-texto-fraco hover:bg-borda disabled:opacity-30">
                        <Icon name="chevron-down" size={16} />
                      </button>
                    </div>
                    {renomeandoId === c.id ? (
                      <>
                        <input
                          value={renomeandoNome}
                          aria-label={`Novo nome para ${c.nome}`}
                          autoFocus
                          onChange={(e) => setRenomeandoNome(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); salvarRenomear(c); } }}
                          className={`${inputClass} flex-1 min-w-0`}
                        />
                        <Button size="sm" variant="chip-success" onClick={() => salvarRenomear(c)} disabled={catOcupada} aria-label="Salvar nome"><Icon name="check" size={15} /></Button>
                        <Button size="sm" variant="chip" onClick={() => setRenomeandoId(null)} aria-label="Cancelar renomear"><Icon name="close" size={15} /></Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-noite break-words">{c.nome}</div>
                          <div className="text-xs text-texto-fraco">{qtd} {qtd === 1 ? 'produto' : 'produtos'}</div>
                        </div>
                        <Button size="sm" variant="chip-primary" onClick={() => { setRenomeandoId(c.id); setRenomeandoNome(c.nome); }} aria-label={`Renomear ${c.nome}`}><Icon name="pencil" size={15} /></Button>
                        <Button size="sm" variant="chip-danger" onClick={() => excluirCategoria(c)} disabled={catOcupada} aria-label={`Excluir ${c.nome}`}><Icon name="trash" size={15} /></Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div>
            <label htmlFor="lp-nova-cat" className="block text-sm font-medium mb-1.5">Nova categoria</label>
            <div className="flex gap-2">
              <input
                id="lp-nova-cat"
                value={novaCatNome}
                onChange={(e) => setNovaCatNome(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarCategoria(); } }}
                placeholder="Ex.: Camisetas"
                className={`${inputClass} flex-1 min-w-0`}
              />
              <Button size="sm" onClick={adicionarCategoria} disabled={catOcupada || !novaCatNome.trim()}><Icon name="plus" size={16} /> Adicionar</Button>
            </div>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
