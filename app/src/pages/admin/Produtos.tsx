import { useCallback, useEffect, useState, useRef } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { Button } from '../../components/ui/Button';
import { Toggle } from '../../components/ui/Toggle';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../services/api';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';
import { PageHeader } from '../../components/ui/PageHeader';
import { inputClass } from '../../components/ui/Field';
import { Loading } from '../../components/ui/Loading';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { StatCard } from '../../components/admin/StatCard';
import type { Produto } from '../../types';

const brl = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const SALAS = [
  { id: 'todas' as const, label: 'Todas as salas' },
  { id: 'oficiais' as const, label: 'Oficiais' },
  { id: 'graduados' as const, label: 'Graduados' },
];

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

export function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [nome, setNome] = useState('');
  const [emoji, setEmoji] = useState('🍬');
  const [preco, setPreco] = useState('');
  const [precoCusto, setPrecoCusto] = useState('');
  const [ordem, setOrdem] = useState('0');
  const [categoria, setCategoria] = useState<'oficiais' | 'graduados'>('oficiais');
  const [disponivel, setDisponivel] = useState(true);
  const [imagemUrl, setImagemUrl] = useState('');
  const [previewImg, setPreviewImg] = useState('');
  const [estoque, setEstoque] = useState('');
  const [uploading, setUploading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const confirmar = useConfirm();
  const { showToast } = useToast();

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [busca, setBusca] = useState('');
  const [sala, setSala] = useState<'todas' | 'oficiais' | 'graduados'>('todas');

  const carregar = () => api.get<Produto[]>('/api/produtos/todos')
    .then((r) => { setProdutos(r); setErro(false); })
    .catch(() => setErro(true))
    .finally(() => setCarregando(false));
  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
    setEditando(null);
    setNome(''); setEmoji('🍬'); setPreco(''); setPrecoCusto(''); setOrdem('0'); setCategoria('oficiais'); setDisponivel(true);
    setEstoque('');
    setImagemUrl(''); setPreviewImg('');
    setModalAberto(true);
  };

  const abrirEditar = (p: Produto) => {
    setEditando(p);
    setNome(p.nome); setEmoji(p.emoji); setPreco(String(p.preco)); setPrecoCusto(p.preco_custo != null ? String(p.preco_custo) : ''); setOrdem(String(p.ordem)); setCategoria(p.categoria || 'oficiais'); setDisponivel(!!p.disponivel);
    setEstoque(p.estoque != null ? String(p.estoque) : '');
    setImagemUrl(p.imagem_url || '');
    setPreviewImg(resolveImg(p.imagem_url) || '');
    setModalAberto(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewImg(URL.createObjectURL(file));
    setUploading(true);
    try {
      const url = await uploadImagem(file);
      setImagemUrl(url);
    } catch {
      showToast('Erro ao enviar imagem. Tente novamente.', 'error');
      setPreviewImg(resolveImg(imagemUrl) || '');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      nome,
      emoji,
      preco: parseFloat(preco),
      preco_custo: precoCusto !== '' ? parseFloat(precoCusto) : null,
      ordem: parseInt(ordem),
      imagem_url: imagemUrl || null,
      categoria,
      disponivel: disponivel ? 1 : 0,
      estoque: estoque !== '' ? parseInt(estoque) : null,
    };
    if (salvando) return;
    setSalvando(true);
    try {
      if (editando) {
        await api.put(`/api/produtos/${editando.id}`, data);
      } else {
        await api.post('/api/produtos', data);
      }
      setModalAberto(false);
      carregar();
    } catch (err) {
      showToast('Erro ao salvar: ' + (err instanceof Error ? err.message : 'tente novamente'), 'error');
    } finally {
      setSalvando(false);
    }
  };

  const toggleDisponivel = async (p: Produto) => {
    try {
      await api.put(`/api/produtos/${p.id}`, { disponivel: p.disponivel ? 0 : 1 });
      carregar();
    } catch {
      showToast('Erro ao atualizar disponibilidade. Tente novamente.', 'error');
    }
  };

  const excluir = async (p: Produto) => {
    if (!(await confirmar({ title: 'Excluir produto', message: `Excluir "${p.nome}"?`, confirmText: 'Excluir', danger: true }))) return;
    try {
      await api.delete(`/api/produtos/${p.id}`);
      carregar();
    } catch {
      showToast('Erro ao excluir. Tente novamente.', 'error');
    }
  };

  const fecharModal = useCallback(() => setModalAberto(false), []);

  const termo = busca.trim().toLowerCase();
  const visiveis = produtos.filter(p =>
    (sala === 'todas' || (p.categoria || 'oficiais') === sala) &&
    (!termo || p.nome.toLowerCase().includes(termo))
  );
  const esgotados = produtos.filter(p => !p.disponivel || (p.estoque != null && p.estoque <= 0)).length;
  const estoqueBaixo = produtos.filter(p => p.estoque != null && p.estoque > 0 && p.estoque <= 5).length;

  return (
    <AppLayout>
      <PageHeader
        title="Produtos da cantina"
        subtitle="Cadastre produtos, preços e estoque de cada sala."
        right={<Button size="sm" onClick={abrirNovo}><Icon name="plus" size={16} /> Adicionar produto</Button>}
      />

      {carregando ? (
        <Loading label="Carregando produtos..." />
      ) : erro ? (
        <Card className="text-center py-8">
          <p className="text-[15px] font-medium text-texto">Não foi possível carregar os produtos.</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={() => { setCarregando(true); carregar(); }}>
            <Icon name="refresh" size={16} /> Tentar de novo
          </Button>
        </Card>
      ) : produtos.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="tag" size={26} />}
            message="Nenhum produto cadastrado"
            hint="Adicione o primeiro produto para ele aparecer no catálogo da cantina."
            action={<Button size="sm" onClick={abrirNovo}><Icon name="plus" size={16} /> Adicionar produto</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
            <StatCard label="Produtos" value={String(produtos.length)} color="text-noite" icon={<Icon name="tag" size={22} />} />
            <StatCard label="Disponíveis" value={String(produtos.length - esgotados)} color="text-verde" icon={<Icon name="check" size={22} />} />
            <StatCard label="Esgotados" value={String(esgotados)} color={esgotados ? 'text-escarlate' : 'text-texto-fraco'} icon={<Icon name="x" size={22} />} />
            <StatCard label="Estoque baixo (até 5)" value={String(estoqueBaixo)} color={estoqueBaixo ? 'text-amber-600' : 'text-texto-fraco'} icon={<Icon name="warning" size={22} />} />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-4">
            <label htmlFor="prod-busca" className="sr-only">Buscar produto</label>
            <input
              id="prod-busca"
              type="search"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar produto"
              className={`${inputClass} sm:max-w-xs min-h-[44px]`}
            />
            <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filtrar por sala">
              {SALAS.map(s => (
                <Button key={s.id} size="xs" variant={sala === s.id ? 'chip-primary' : 'chip'} aria-pressed={sala === s.id} onClick={() => setSala(s.id)}>
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          {visiveis.length === 0 ? (
            <Card>
              <EmptyState message="Nenhum produto encontrado" hint="Tente outra busca ou outra sala." />
            </Card>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visiveis.map((p) => {
                const img = resolveImg(p.imagem_url);
                const semEstoque = p.estoque != null && p.estoque <= 0;
                return (
                  <li key={p.id} className={`bg-white rounded-2xl overflow-hidden border border-borda shadow-sm flex flex-col ${!p.disponivel ? 'opacity-75' : ''}`}>
                    <div className="aspect-video bg-fundo relative">
                      {img ? (
                        <img src={img} alt={p.nome} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl" aria-hidden="true">{p.emoji}</div>
                      )}
                      <span className="absolute top-2 left-2 bg-white/95 text-noite text-xs font-medium px-2 py-0.5 rounded-full border border-borda">
                        {p.categoria === 'graduados' ? 'Graduados' : 'Oficiais'}
                      </span>
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-texto leading-snug min-w-0 break-words">{p.nome}</h3>
                        <span className="font-display text-2xl leading-none tracking-wide text-dourado shrink-0">{brl(p.preco)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs">
                        {p.disponivel && !semEstoque ? <Badge variant="success">Disponível</Badge> : <Badge variant="danger">Esgotado</Badge>}
                        {p.estoque != null ? (
                          <Badge variant={p.estoque <= 0 ? 'danger' : p.estoque <= 5 ? 'warning' : 'neutral'}>Estoque: {p.estoque}</Badge>
                        ) : (
                          <Badge variant="neutral">Estoque livre</Badge>
                        )}
                        <span className="text-texto-fraco">Ordem {p.ordem}</span>
                      </div>
                      {p.preco_custo != null && p.preco_custo > 0 && (
                        <p className="text-xs text-texto-fraco mt-2">Custo {brl(p.preco_custo)} · margem {brl(p.preco - p.preco_custo)}</p>
                      )}
                      <div className="mt-auto pt-3 border-t border-borda flex items-center justify-between gap-2 flex-wrap">
                        <label className="flex items-center gap-2 text-sm text-texto-fraco min-h-[40px] cursor-pointer">
                          <Toggle checked={!!p.disponivel} onChange={() => toggleDisponivel(p)} />
                          <span>{p.disponivel ? 'À venda' : 'Pausado'}</span>
                        </label>
                        <div className="flex gap-2">
                          <Button variant="chip-primary" size="sm" onClick={() => abrirEditar(p)}>
                            <Icon name="pencil" size={14} /> Editar
                          </Button>
                          <Button variant="chip-danger" size="sm" onClick={() => excluir(p)} aria-label={`Excluir ${p.nome}`}>
                            <Icon name="trash" size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <Modal open={modalAberto} onClose={fecharModal} title={editando ? 'Editar produto' : 'Novo produto'}>
        <form onSubmit={salvar} className="space-y-4">
          {/* Upload de imagem */}
          <div className="flex flex-col items-center gap-2">
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' && !uploading) fileRef.current?.click(); }}
              onClick={() => !uploading && fileRef.current?.click()}
              aria-label="Enviar foto do produto"
              className="w-36 h-36 rounded-xl bg-fundo border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center cursor-pointer hover:border-azul transition-colors"
            >
              {uploading ? (
                <div className="text-sm text-texto-fraco animate-pulse">Enviando...</div>
              ) : previewImg ? (
                <img src={previewImg} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center px-2">
                  <div className="text-3xl mb-1">{emoji}</div>
                  <span className="text-xs text-texto-fraco">Toque para enviar foto</span>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            {imagemUrl && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-verde-escuro font-medium">Foto salva</span>
                <button
                  type="button"
                  onClick={() => { setPreviewImg(''); setImagemUrl(''); }}
                  className="text-xs text-escarlate hover:underline min-h-[40px] px-2"
                >
                  Remover
                </button>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="prod-nome" className="block text-sm font-medium mb-1">Nome</label>
            <input id="prod-nome" value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} required />
          </div>

          <div>
            <label htmlFor="prod-preco" className="block text-sm font-medium mb-1">Preço de venda (R$)</label>
            <input id="prod-preco" inputMode="decimal" type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} className={inputClass} required />
            <label htmlFor="prod-custo" className="block text-sm font-medium mb-1 mt-3">Preço de custo (R$) <span className="text-texto-fraco font-normal">· opcional, para calcular a margem</span></label>
            <input id="prod-custo" inputMode="decimal" type="number" step="0.01" value={precoCusto} onChange={(e) => setPrecoCusto(e.target.value)} className={inputClass} placeholder="Deixe vazio se não souber" />
            {preco && precoCusto && parseFloat(preco) > 0 && parseFloat(precoCusto) > 0 && (
              <div className="text-xs text-texto-fraco mt-1">
                Margem: <span className="font-medium text-verde-escuro">{brl(parseFloat(preco) - parseFloat(precoCusto))}</span>
                {' '}({(((parseFloat(preco) - parseFloat(precoCusto)) / parseFloat(preco)) * 100).toFixed(1)}%)
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prod-ordem" className="block text-sm font-medium mb-1">Ordem no catálogo</label>
              <input id="prod-ordem" type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="prod-sala" className="block text-sm font-medium mb-1">Sala</label>
              <select
                id="prod-sala"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as 'oficiais' | 'graduados')}
                className={inputClass}
              >
                <option value="oficiais">Sala dos Oficiais</option>
                <option value="graduados">Sala dos Graduados</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="prod-estoque" className="block text-sm font-medium mb-1">Estoque</label>
            <input
              id="prod-estoque"
              type="number"
              min="0"
              value={estoque}
              onChange={(e) => {
                const v = e.target.value;
                setEstoque(v);
                const n = v === '' ? null : parseInt(v);
                if (n !== null && !Number.isNaN(n)) {
                  if (n > 0) setDisponivel(true);
                  else if (n === 0) setDisponivel(false);
                }
              }}
              placeholder="Vazio = sem limite"
              className={inputClass}
            />
            <p className="text-xs text-texto-fraco mt-1">Deixe vazio para estoque ilimitado</p>
          </div>

          {/* Disponível / Esgotado */}
          <div className="flex items-center justify-between bg-fundo rounded-xl px-4 py-3">
            <div>
              <span className="text-sm font-medium">{disponivel ? 'Disponível' : 'Esgotado'}</span>
              <p className="text-xs text-texto-fraco">{disponivel ? 'Produto aparece no catálogo' : 'Produto aparece como esgotado'}</p>
            </div>
            <Toggle checked={disponivel} onChange={setDisponivel} />
          </div>

          <Button type="submit" className="w-full" disabled={uploading || salvando}>
            {uploading ? 'Aguarde o envio da foto...' : salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar produto'}
          </Button>
        </form>
      </Modal>
    </AppLayout>
  );
}
