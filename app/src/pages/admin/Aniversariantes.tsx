import { useEffect, useState, useRef } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { Loading } from '../../components/ui/Loading';
import { PageHeader } from '../../components/ui/PageHeader';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

function resolveImg(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/api') ? `${WORKER_URL}${url}` : url;
}

async function uploadImagem(file: File): Promise<string> {
  const token = localStorage.getItem('token');
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${WORKER_URL}/api/images/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) throw new Error('Falha no upload');
  const data = await res.json() as { url: string };
  return data.url;
}

interface Aniversariante {
  id: number;
  trigrama: string;
  categoria: string;
  data_nascimento: string;
  niver_titulo: string | null;
  niver_texto: string | null;
  niver_imagem_url: string | null;
}

export function Aniversariantes() {
  const { showToast } = useToast();
  const [lista, setLista] = useState<Aniversariante[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState<Aniversariante | null>(null);
  const [form, setForm] = useState({ titulo: '', texto: '', imagem_url: '' });
  const [salvando, setSalvando] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = async () => {
    try {
      const data = await api.get<Aniversariante[]>('/api/usuarios/admin/aniversariantes');
      setLista(data);
    } catch (e) {
      showToast('Erro ao carregar aniversariantes', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const abrirHomenagem = (u: Aniversariante) => {
    setEditModal(u);
    setForm({
      titulo: u.niver_titulo || '',
      texto: u.niver_texto || '',
      imagem_url: u.niver_imagem_url || '',
    });
  };

  const salvar = async () => {
    if (!editModal) return;
    setSalvando(true);
    try {
      await api.put(`/api/usuarios/admin/${editModal.id}/homenagem`, {
        niver_titulo: form.titulo,
        niver_texto: form.texto,
        niver_imagem_url: form.imagem_url,
      });
      showToast(`Homenagem para ${editModal.trigrama} salva!`, 'success');
      setEditModal(null);
      carregar();
    } catch (e) {
      showToast('Erro ao salvar homenagem', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      showToast('Formato inválido. Use JPG, PNG, WEBP ou GIF', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Imagem muito grande (máx 5MB)', 'error');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImagem(file);
      setForm(p => ({ ...p, imagem_url: url }));
    } catch {
      showToast('Erro ao enviar imagem', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const formatData = (iso: string) => {
    if (!iso) return '--/--';
    if (iso.includes('/')) return iso.substring(0, 5); // Fallback para DD/MM
    const partes = iso.split('-');
    if (partes.length < 3) return iso;
    const [y, m, d] = partes;
    return `${d}/${m}`;
  };

  return (
    <AppLayout>
      <PageHeader
        title="Aniversariantes"
        right={
          <div className="text-xs text-texto-fraco bg-white px-3 py-1.5 rounded-full border border-borda">
            {lista.length} militares com data cadastrada
          </div>
        }
      />

      {loading ? (
        <Loading />
      ) : lista.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map(u => (
            <div key={u.id} className="bg-white rounded-2xl border border-borda p-5 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-display text-xl text-azul tracking-wider">{u.trigrama}</div>
                  <div className="text-[10px] text-texto-fraco uppercase font-bold tracking-widest">{u.categoria}</div>
                </div>
                <div className="bg-azul/10 text-azul text-xs font-bold px-3 py-1 rounded-full">
                  {formatData(u.data_nascimento)}
                </div>
              </div>

              {u.niver_titulo ? (
                <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-xl">
                  <div className="text-[10px] text-verde-escuro font-bold uppercase mb-1">Homenagem Ativa</div>
                  <div className="text-xs text-verde-escuro font-medium truncate">{u.niver_titulo}</div>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-fundo border border-borda border-dashed rounded-xl">
                  <div className="text-xs text-texto-fraco italic">Usando mensagem genérica da RP</div>
                </div>
              )}

              <Button variant="outline" size="sm" className="w-full" onClick={() => abrirHomenagem(u)}>
                {u.niver_titulo ? 'Editar Homenagem' : 'Personalizar Parabéns'}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-borda p-12 text-center shadow-sm max-w-lg mx-auto mt-10">
          <h2 className="font-display text-xl text-azul tracking-wider uppercase mb-3">Aguardando Dados</h2>
          <p className="text-sm text-texto-fraco leading-relaxed mb-8">
            Nenhum aniversário foi identificado no sistema ainda. Para começar, adicione a data de nascimento no perfil dos militares.
          </p>
          <Button variant="outline" onClick={() => window.location.href = '/admin/usuarios'}>
            Gerenciar Usuários
          </Button>
        </div>
      )}

      {/* Modal Homenagem */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-xl text-azul tracking-wider mb-5 uppercase">Preparar Homenagem</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-texto-fraco uppercase tracking-widest mb-1.5 ml-1">Título da Surpresa</label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Parabéns, Guerreiro!"
                  className="w-full bg-fundo border border-borda rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-azul/20 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-texto-fraco uppercase tracking-widest mb-1.5 ml-1">Texto da Mensagem</label>
                <textarea
                  value={form.texto}
                  onChange={e => setForm(p => ({ ...p, texto: e.target.value }))}
                  rows={4}
                  placeholder="Escreva uma mensagem especial para o dia..."
                  className="w-full bg-fundo border border-borda rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-azul/20 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-texto-fraco uppercase tracking-widest mb-1.5 ml-1">Imagem Especial</label>

                <div
                  onClick={() => !uploading && fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-borda rounded-2xl p-4 text-center cursor-pointer hover:border-azul transition-colors mb-2"
                >
                  {uploading ? (
                    <div className="text-sm text-texto-fraco animate-pulse py-6">Enviando...</div>
                  ) : form.imagem_url ? (
                    <img src={resolveImg(form.imagem_url)!} alt="Prévia" className="max-h-40 mx-auto rounded-xl object-contain" />
                  ) : (
                    <div className="py-6 text-sm text-texto-fraco">Toque para enviar uma foto<br /><span className="text-[10px]">JPG, PNG, WEBP · máx 5MB</span></div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

                {form.imagem_url && (
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, imagem_url: '' }))}
                    className="text-xs text-vermelho hover:underline mb-2"
                  >
                    Remover imagem
                  </button>
                )}

                <input
                  type="text"
                  value={form.imagem_url}
                  onChange={e => setForm(p => ({ ...p, imagem_url: e.target.value }))}
                  placeholder="Ou cole um link de imagem"
                  className="w-full bg-fundo border border-borda rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-azul/20 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-8">
              <Button variant="ghost" onClick={() => setEditModal(null)}>Cancelar</Button>
              <Button onClick={salvar} disabled={salvando || uploading}>
                {salvando ? 'Salvando...' : uploading ? 'Enviando foto...' : 'Salvar Homenagem'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
