import { useEffect, useState, useRef } from 'react';
import { AdminLayout } from '../../components/Layout';
import { Button } from '../../components/ui/Button';
import { Toggle } from '../../components/ui/Toggle';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../services/api';
import type { Produto } from '../../types';

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
  const [ordem, setOrdem] = useState('0');
  const [categoria, setCategoria] = useState<'oficiais' | 'graduados' | 'geral'>('geral');
  const [imagemUrl, setImagemUrl] = useState('');
  const [previewImg, setPreviewImg] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = () => api.get<Produto[]>('/api/produtos/todos').then(setProdutos);
  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
    setEditando(null);
    setNome(''); setEmoji('🍬'); setPreco(''); setOrdem('0'); setCategoria('geral');
    setImagemUrl(''); setPreviewImg('');
    setModalAberto(true);
  };

  const abrirEditar = (p: Produto) => {
    setEditando(p);
    setNome(p.nome); setEmoji(p.emoji); setPreco(String(p.preco)); setOrdem(String(p.ordem)); setCategoria(p.categoria || 'geral');
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
      alert('Erro ao enviar imagem. Tente novamente.');
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
      ordem: parseInt(ordem),
      imagem_url: imagemUrl || null,
      categoria,
    };
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
        <h1 className="font-display text-2xl text-white tracking-wider">Produtos</h1>
        <Button size="sm" onClick={abrirNovo}>+ Adicionar</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {produtos.map((p) => (
          <div key={p.id} className="bg-fundo-card rounded-xl overflow-hidden border border-borda">
            <div className="aspect-video bg-fundo-elevado relative">
              {resolveImg(p.imagem_url) ? (
                <img src={resolveImg(p.imagem_url)!} alt={p.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl">{p.emoji}</div>
              )}
              <div className="absolute top-2 right-2">
                <Toggle checked={!!p.disponivel} onChange={() => toggleDisponivel(p)} />
              </div>
              <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                {p.categoria === 'oficiais' ? '🎖️ Oficiais' : p.categoria === 'graduados' ? '⭐ Graduados' : '📋 Geral'}
              </span>
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm">{p.emoji} {p.nome}</h3>
                <span className="text-dourado font-bold">R$ {p.preco.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-texto-fraco">Ordem: {p.ordem}</span>
                <div className="flex gap-2">
                  <button onClick={() => abrirEditar(p)} className="text-dourado text-xs font-medium hover:underline">Editar</button>
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
          {/* Upload de imagem */}
          <div className="flex flex-col items-center gap-2">
            <div
              onClick={() => !uploading && fileRef.current?.click()}
              className="w-36 h-36 rounded-xl bg-fundo-elevado border-2 border-dashed border-borda overflow-hidden flex items-center justify-center cursor-pointer hover:border-azul transition-colors"
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
                <span className="text-xs text-emerald-400 font-medium">Foto salva</span>
                <button
                  type="button"
                  onClick={() => { setPreviewImg(''); setImagemUrl(''); }}
                  className="text-xs text-vermelho hover:underline"
                >
                  Remover
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full bg-fundo-elevado border border-borda rounded-lg px-3 py-2 text-texto" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Emoji</label>
              <input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="w-full bg-fundo-elevado border border-borda rounded-lg px-3 py-2 text-texto" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Preço (R$)</label>
              <input type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} className="w-full bg-fundo-elevado border border-borda rounded-lg px-3 py-2 text-texto" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Ordem</label>
              <input type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} className="w-full bg-fundo-elevado border border-borda rounded-lg px-3 py-2 text-texto" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sala</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as 'oficiais' | 'graduados' | 'geral')}
                className="w-full bg-fundo-elevado border border-borda rounded-lg px-3 py-2 text-texto"
              >
                <option value="geral">Geral (ambas)</option>
                <option value="oficiais">Sala dos Oficiais</option>
                <option value="graduados">Sala dos Graduados</option>
              </select>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={uploading}>
            {uploading ? 'Aguarde o upload...' : editando ? 'Salvar' : 'Criar'}
          </Button>
        </form>
      </Modal>
    </AdminLayout>
  );
}
