import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { useToast } from '../../hooks/useToast';
import { Loading } from '../../components/ui/Loading';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Field, inputClass } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';

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
  const [erroCarga, setErroCarga] = useState(false);
  const navigate = useNavigate();
  const [editModal, setEditModal] = useState<Aniversariante | null>(null);
  const [form, setForm] = useState({ titulo: '', texto: '', imagem_url: '' });
  const [salvando, setSalvando] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = async () => {
    setErroCarga(false);
    try {
      const data = await api.get<Aniversariante[]>('/api/usuarios/admin/aniversariantes');
      setLista(data);
    } catch (e) {
      setErroCarga(true);
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
      showToast(`Homenagem para ${editModal.trigrama} salva`, 'success');
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
      showToast('Imagem muito grande (máximo 5 MB)', 'error');
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

  const fechar = useCallback(() => setEditModal(null), []);

  const formatData = (iso: string) => {
    if (!iso) return '--/--';
    if (iso.includes('/')) return iso.substring(0, 5); // Fallback para DD/MM
    const partes = iso.split('-');
    if (partes.length < 3) return iso;
    const [, m, d] = partes;
    return `${d}/${m}`;
  };

  return (
    <AppLayout>
      <PageHeader
        title="Aniversariantes"
        subtitle="Personalize a mensagem de parabéns que cada militar vê no dia do aniversário."
        right={!loading && !erroCarga && lista.length > 0 ? (
          <span className="text-sm text-texto-fraco">
            {lista.length} {lista.length === 1 ? 'militar com data cadastrada' : 'militares com data cadastrada'}
          </span>
        ) : undefined}
      />

      {loading ? (
        <Loading />
      ) : erroCarga ? (
        <div className="bg-white rounded-2xl border border-borda">
          <EmptyState
            icon={<Icon name="warning" size={24} />}
            message="Não foi possível carregar os aniversariantes"
            hint="Verifique a conexão e tente outra vez."
            action={<Button variant="ghost" size="sm" onClick={() => { setLoading(true); carregar(); }}><Icon name="refresh" size={16} /> Tentar de novo</Button>}
          />
        </div>
      ) : lista.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {lista.map(u => (
            <article key={u.id} className="bg-white rounded-2xl border border-borda p-4 shadow-sm flex flex-col min-w-0">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-display text-2xl leading-none text-noite tracking-wide">{u.trigrama}</div>
                  <div className="text-sm text-texto-fraco mt-1 capitalize">{u.categoria}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-texto-fraco">Aniversário</div>
                  <div className="font-display text-2xl leading-none text-escarlate tracking-wide">{formatData(u.data_nascimento)}</div>
                </div>
              </div>

              {u.niver_titulo ? (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl min-w-0">
                  <div className="text-xs text-verde-escuro font-medium mb-0.5">Homenagem personalizada</div>
                  <div className="text-sm text-texto truncate">{u.niver_titulo}</div>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-fundo border border-dashed border-borda rounded-xl">
                  <div className="text-sm text-texto-fraco">Usa a mensagem padrão da RP</div>
                </div>
              )}

              <Button variant={u.niver_titulo ? 'ghost' : 'chip-primary'} size="sm" className="w-full mt-auto" onClick={() => abrirHomenagem(u)}>
                <Icon name="pencil" size={16} />
                {u.niver_titulo ? 'Editar homenagem' : 'Personalizar parabéns'}
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-borda">
          <EmptyState
            icon={<Icon name="bell" size={24} />}
            message="Nenhum aniversário cadastrado"
            hint="Adicione a data de nascimento no cadastro dos militares para que eles apareçam aqui."
            action={<Button variant="ghost" size="sm" onClick={() => navigate('/admin/usuarios')}><Icon name="users" size={16} /> Ir para usuários</Button>}
          />
        </div>
      )}

      {/* Modal homenagem */}
      <Modal open={!!editModal} onClose={fechar} title={editModal ? `Homenagem para ${editModal.trigrama}` : 'Homenagem'}>
        <form onSubmit={(e) => { e.preventDefault(); salvar(); }} className="space-y-4">
          <Field label="Título">
            <input
              aria-label="Título"
              type="text"
              value={form.titulo}
              onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
              placeholder="Ex.: Parabéns, guerreiro!"
              className={inputClass}
            />
          </Field>

          <Field label="Mensagem">
            <textarea
              aria-label="Mensagem"
              value={form.texto}
              onChange={e => setForm(p => ({ ...p, texto: e.target.value }))}
              rows={4}
              placeholder="Escreva uma mensagem especial para o dia"
              className={`${inputClass} resize-none`}
            />
          </Field>

          <Field label="Imagem" hint="JPG, PNG, WEBP ou GIF, até 5 MB. Ou cole o link de uma imagem.">
            <button
              type="button"
              onClick={() => !uploading && fileRef.current?.click()}
              disabled={uploading}
              className="w-full border-2 border-dashed border-borda rounded-xl p-4 text-center hover:border-azul transition-colors mb-2 outline-none focus-visible:ring-2 focus-visible:ring-azul/40"
            >
              {uploading ? (
                <span className="block text-sm text-texto-fraco py-6" role="status">Enviando imagem...</span>
              ) : form.imagem_url ? (
                <img src={resolveImg(form.imagem_url)!} alt="Prévia da imagem" className="max-h-40 mx-auto rounded-lg object-contain" />
              ) : (
                <span className="flex flex-col items-center gap-2 py-5 text-sm text-texto-fraco">
                  <Icon name="upload" size={22} />
                  Toque para enviar uma foto
                </span>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

            <div className="flex gap-2 items-center">
              <input
                aria-label="Link da imagem"
                type="text"
                value={form.imagem_url}
                onChange={e => setForm(p => ({ ...p, imagem_url: e.target.value }))}
                placeholder="Ou cole um link de imagem"
                className={inputClass}
              />
              {form.imagem_url && (
                <Button variant="chip-danger" size="sm" className="shrink-0" onClick={() => setForm(p => ({ ...p, imagem_url: '' }))} aria-label="Remover imagem">
                  <Icon name="trash" size={16} />
                </Button>
              )}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="ghost" onClick={fechar}>Cancelar</Button>
            <Button type="submit" disabled={salvando || uploading}>
              {salvando ? 'Salvando...' : uploading ? 'Enviando foto...' : 'Salvar homenagem'}
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
