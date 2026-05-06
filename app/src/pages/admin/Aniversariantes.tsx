import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { useToast } from '../../hooks/useToast';

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

  const formatData = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}`;
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-azul tracking-wider uppercase">Aniversariantes</h1>
        <div className="text-xs text-texto-fraco bg-white px-3 py-1.5 rounded-full border border-borda">
          {lista.length} militares com data cadastrada
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-texto-fraco">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map(u => (
            <div key={u.id} className="bg-white rounded-2xl border border-borda p-5 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-display text-xl text-azul tracking-wider">{u.trigrama}</div>
                  <div className="text-[10px] text-texto-fraco uppercase font-bold tracking-widest">{u.categoria}</div>
                </div>
                <div className="bg-azul/10 text-azul text-xs font-bold px-3 py-1 rounded-full">
                  🎂 {formatData(u.data_nascimento)}
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
                <label className="block text-[10px] font-bold text-texto-fraco uppercase tracking-widest mb-1.5 ml-1">URL da Imagem Especial</label>
                <input
                  type="text"
                  value={form.imagem_url}
                  onChange={e => setForm(p => ({ ...p, imagem_url: e.target.value }))}
                  placeholder="Link da foto ou escudo do esquadrão"
                  className="w-full bg-fundo border border-borda rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-azul/20 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-8">
              <Button variant="ghost" onClick={() => setEditModal(null)}>Cancelar</Button>
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar Homenagem'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
