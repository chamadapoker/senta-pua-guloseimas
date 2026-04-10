import { useEffect, useState, useRef } from 'react';
import { AdminLayout } from '../../components/Layout';
import { Button } from '../../components/ui/Button';
import { Toggle } from '../../components/ui/Toggle';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../services/api';
import type { Produto } from '../../types';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

function uploadImagem(file: File): Promise<{ url: string }> {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);
  return fetch(`${WORKER_URL}/api/images/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  }).then((r) => {
    if (!r.ok) throw new Error('Falha no upload');
    return r.json() as Promise<{ url: string }>;
  });
}

export function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Produto | null>(null);
  const [form, setForm] = useState({ nome: '', emoji: '🍬', preco: '', ordem: '0', imagem_url: '' });
  const [previewImg, setPreviewImg] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = () => api.get<Produto[]>('/api/produtos/todos').then(setProdutos);

  useEffect(() => { carregar(); }, []);

  const abrirNovo = () => {
    setEditando(null);
    setForm({ nome: '', emoji: '🍬', preco: '', ordem: '0', imagem_url: '' });
    setPreviewImg('');
    setModalAberto(true);
  };

  const abrirEditar = (p: Produto) => {
    setEditando(p);
    const imgUrl = p.imagem_url || '';
    setForm({
      nome: p.nome,
      emoji: p.emoji,
      preco: String(p.preco),
      ordem: String(p.ordem),
      imagem_url: imgUrl,
    });
    setPreviewImg(imgUrl.startsWith('/api') ? `${WORKER_URL}${imgUrl}` : imgUrl);
    setModalAberto(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewImg(URL.createObjectURL(file));
    setUploading(true);
    try {
      const { url } = await uploadImagem(file);
      setForm((f) => ({ ...f, imagem_url: url }));
    } catch {
      alert('Erro ao enviar imagem');
      setPreviewImg('');
    } finally {
      setUploading(false);
    }
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      nome: form.nome,
      emoji: form.emoji,
      preco: parseFloat(form.preco),
      ordem: parseInt(form.ordem),
      imagem_url: form.imagem_url || null,
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

  const resolveImg = (url: string | null) => {
    if (!url) return null;
    return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-azul">Produtos</h1>
        <Button size="sm" onClick={abrirNovo}>+ Adicionar</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {produtos.map((p) => (
          <div key={p.id} className="bg-white rounded-xl overflow-hidden border border-gray-100">
            <div className="aspect-video bg-gray-50 relative">
              {resolveImg(p.imagem_url) ? (
                <img src={resolveImg(p.imagem_url)!} alt={p.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-5xl">{p.emoji}</div>
              )}
              <div className="absolute top-2 right-2">
                <Toggle checked={!!p.disponivel} onChange={() => toggleDisponivel(p)} />
              </div>
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-sm">{p.emoji} {p.nome}</h3>
                <span className="text-azul font-bold">R$ {p.preco.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400">Ordem: {p.ordem}</span>
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
          {/* Upload de imagem */}
          <div className="flex flex-col items-center gap-2">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-36 h-36 rounded-xl bg-gray-50 border-2 border-dashed border-gray-300 overflow-hidden flex items-center justify-center cursor-pointer hover:border-azul transition-colors"
            >
              {uploading ? (
                <div className="text-sm text-gray-400 animate-pulse">Enviando...</div>
              ) : previewImg ? (
                <img src={previewImg} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center px-2">
                  <div className="text-3xl mb-1">{form.emoji}</div>
                  <span className="text-xs text-gray-400">Toque para enviar foto</span>
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
            {previewImg && (
              <button
                type="button"
                onClick={() => { setPreviewImg(''); setForm((f) => ({ ...f, imagem_url: '' })); }}
                className="text-xs text-vermelho hover:underline"
              >
                Remover foto
              </button>
            )}
          </div>

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

          <Button type="submit" className="w-full" disabled={uploading}>
            {uploading ? 'Aguarde o upload...' : editando ? 'Salvar' : 'Criar'}
          </Button>
        </form>
      </Modal>
    </AdminLayout>
  );
}
