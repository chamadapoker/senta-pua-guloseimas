import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Menu } from '../../components/ui/Menu';
import { Icon } from '../../components/ui/Icon';
import { inputClass } from '../../components/ui/Field';
import { api } from '../../services/api';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  return url ? (url.startsWith('/api') ? `${WORKER_URL}${url}` : url) : null;
}

interface Fornecedor { id: string; nome: string; contato: string | null; endereco: string | null; observacao: string | null; }
interface Item {
  id: string; nome: string; finalidade: string | null; quantidade: number; unidade: string;
  valor_compra: number | null; fornecedor_id: string | null;
  fornecedor_nome: string | null; fornecedor_contato: string | null; fornecedor_endereco: string | null;
  observacao: string | null; foto_url: string | null;
}

const FINALIDADES = [
  { v: 'presente', l: 'Presente' },
  { v: 'uso_interno', l: 'Uso interno' },
  { v: 'consumo', l: 'Consumo' },
  { v: 'outro', l: 'Outro' },
];
const finLabel = (f: string | null) => FINALIDADES.find(x => x.v === f)?.l || f || '—';

export function Inventario() {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [aba, setAba] = useState<'itens' | 'fornecedores'>('itens');
  const [itens, setItens] = useState<Item[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  // Modal item
  const [modalItem, setModalItem] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [iNome, setINome] = useState('');
  const [iFinalidade, setIFinalidade] = useState('presente');
  const [iQtd, setIQtd] = useState('');
  const [iUnidade, setIUnidade] = useState('un');
  const [iValor, setIValor] = useState('');
  const [iFornecedor, setIFornecedor] = useState('');
  const [iObs, setIObs] = useState('');
  const [iFoto, setIFoto] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const enviarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoFoto(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.upload<{ url: string }>('/api/inventario/upload', fd);
      setIFoto(r.url);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao enviar foto', 'error');
    } finally {
      setEnviandoFoto(false);
    }
  };

  // Modal fornecedor
  const [modalForn, setModalForn] = useState(false);
  const [editForn, setEditForn] = useState<Fornecedor | null>(null);
  const [fNome, setFNome] = useState('');
  const [fContato, setFContato] = useState('');
  const [fEndereco, setFEndereco] = useState('');
  const [fObs, setFObs] = useState('');

  const carregar = () => {
    api.get<Item[]>('/api/inventario').then(setItens).catch(() => {});
    api.get<Fornecedor[]>('/api/inventario/fornecedores').then(setFornecedores).catch(() => {});
  };
  useEffect(() => { carregar(); }, []);

  // ----- Itens -----
  const abrirItem = (it?: Item) => {
    setEditItem(it || null);
    setINome(it?.nome || '');
    setIFinalidade(it?.finalidade || 'presente');
    setIQtd(it ? String(it.quantidade) : '');
    setIUnidade(it?.unidade || 'un');
    setIValor(it?.valor_compra != null ? String(it.valor_compra) : '');
    setIFornecedor(it?.fornecedor_id || '');
    setIObs(it?.observacao || '');
    setIFoto(it?.foto_url || null);
    setModalItem(true);
  };
  const salvarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      nome: iNome, finalidade: iFinalidade, quantidade: parseFloat(iQtd) || 0,
      unidade: iUnidade || 'un', valor_compra: iValor ? parseFloat(iValor) : null,
      fornecedor_id: iFornecedor || null, observacao: iObs || null, foto_url: iFoto,
    };
    try {
      if (editItem) await api.put(`/api/inventario/${editItem.id}`, body);
      else await api.post('/api/inventario', body);
      setModalItem(false); carregar();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Erro ao salvar', 'error'); }
  };
  const excluirItem = async (it: Item) => {
    if (!(await confirm({ title: 'Excluir item', message: `Remover "${it.nome}" do inventário?`, confirmText: 'Excluir', danger: true }))) return;
    await api.delete(`/api/inventario/${it.id}`); carregar();
  };

  // ----- Fornecedores -----
  const abrirForn = (f?: Fornecedor) => {
    setEditForn(f || null);
    setFNome(f?.nome || ''); setFContato(f?.contato || ''); setFEndereco(f?.endereco || ''); setFObs(f?.observacao || '');
    setModalForn(true);
  };
  const salvarForn = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { nome: fNome, contato: fContato || null, endereco: fEndereco || null, observacao: fObs || null };
    try {
      if (editForn) await api.put(`/api/inventario/fornecedores/${editForn.id}`, body);
      else await api.post('/api/inventario/fornecedores', body);
      setModalForn(false); carregar();
    } catch (err) { showToast(err instanceof Error ? err.message : 'Erro ao salvar', 'error'); }
  };
  const excluirForn = async (f: Fornecedor) => {
    if (!(await confirm({ title: 'Excluir fornecedor', message: `Remover "${f.nome}"? Os itens dele ficam sem fornecedor.`, confirmText: 'Excluir', danger: true }))) return;
    await api.delete(`/api/inventario/fornecedores/${f.id}`); carregar();
  };

  return (
    <AppLayout>
      <PageHeader
        title="INVENTÁRIO"
        subtitle="Material que a RP compra e não vende (brindes, quadros, facas…)"
        right={aba === 'itens'
          ? <Button size="sm" onClick={() => abrirItem()}>+ Item</Button>
          : <Button size="sm" onClick={() => abrirForn()}>+ Fornecedor</Button>}
      />

      <div className="flex gap-1 bg-white rounded-xl p-1 border border-borda shadow-sm mb-5 max-w-xs">
        {(['itens', 'fornecedores'] as const).map(t => (
          <button key={t} onClick={() => setAba(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${aba === t ? 'bg-azul text-white shadow-sm' : 'text-texto-fraco'}`}>
            {t}
          </button>
        ))}
      </div>

      {aba === 'itens' ? (
        <div className="space-y-2">
          {itens.map(it => (
            <div key={it.id} className="bg-white rounded-xl border border-borda shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  {it.foto_url && <img src={resolveImg(it.foto_url)!} alt="" className="w-14 h-14 rounded-lg object-cover border border-borda flex-shrink-0" />}
                  <div className="min-w-0">
                  <div className="font-medium text-texto">{it.nome}</div>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-azul/10 text-azul px-2 py-0.5 rounded">{finLabel(it.finalidade)}</span>
                    <span className="text-xs text-texto-fraco">{it.quantidade} {it.unidade}</span>
                    {it.valor_compra != null && <span className="text-xs text-texto-fraco">· R$ {it.valor_compra.toFixed(2)}</span>}
                  </div>
                  {it.fornecedor_nome && (
                    <div className="text-[11px] text-texto-fraco mt-1">
                      Fornecedor: <span className="text-texto">{it.fornecedor_nome}</span>
                      {it.fornecedor_contato && ` · ${it.fornecedor_contato}`}
                    </div>
                  )}
                  {it.observacao && <div className="text-[11px] text-texto-fraco mt-0.5 italic">{it.observacao}</div>}
                  </div>
                </div>
                <Menu items={[
                  { label: 'Editar', icon: 'pencil', onClick: () => abrirItem(it) },
                  { label: 'Excluir', icon: 'trash', danger: true, onClick: () => excluirItem(it) },
                ]} />
              </div>
            </div>
          ))}
          {itens.length === 0 && <div className="bg-white rounded-xl border border-borda p-10 text-center text-texto-fraco">Nenhum item cadastrado. Adicione o primeiro.</div>}
        </div>
      ) : (
        <div className="space-y-2">
          {fornecedores.map(f => (
            <div key={f.id} className="bg-white rounded-xl border border-borda shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-texto">{f.nome}</div>
                  {f.contato && <div className="text-xs text-texto-fraco mt-0.5 inline-flex items-center gap-1"><Icon name="device-phone" size={12} /> {f.contato}</div>}
                  {f.endereco && <div className="text-[11px] text-texto-fraco mt-0.5">{f.endereco}</div>}
                  {f.observacao && <div className="text-[11px] text-texto-fraco mt-0.5 italic">{f.observacao}</div>}
                </div>
                <Menu items={[
                  { label: 'Editar', icon: 'pencil', onClick: () => abrirForn(f) },
                  { label: 'Excluir', icon: 'trash', danger: true, onClick: () => excluirForn(f) },
                ]} />
              </div>
            </div>
          ))}
          {fornecedores.length === 0 && <div className="bg-white rounded-xl border border-borda p-10 text-center text-texto-fraco">Nenhum fornecedor. Cadastre pra reusar nos itens.</div>}
        </div>
      )}

      {/* Modal Item */}
      <Modal open={modalItem} onClose={() => setModalItem(false)} title={editItem ? 'Editar item' : 'Novo item'}>
        <form onSubmit={salvarItem} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Item</label>
            <input value={iNome} onChange={e => setINome(e.target.value)} className={inputClass} required placeholder="Ex: Quadro Sabre Alado" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Foto (opcional)</label>
            <div className="flex items-center gap-3">
              {iFoto && <img src={resolveImg(iFoto)!} alt="" className="w-16 h-16 rounded-lg object-cover border border-borda" />}
              <label className="text-xs font-medium px-3 py-1.5 rounded-lg text-azul bg-blue-50 border border-blue-200 hover:bg-blue-100 inline-flex items-center gap-1.5 cursor-pointer">
                <Icon name="upload" size={12} /> {enviandoFoto ? 'Enviando...' : iFoto ? 'Trocar foto' : 'Enviar foto'}
                <input type="file" accept="image/*" onChange={enviarFoto} className="hidden" disabled={enviandoFoto} />
              </label>
              {iFoto && <button type="button" onClick={() => setIFoto(null)} className="text-xs text-vermelho hover:underline">Remover</button>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Finalidade</label>
              <select value={iFinalidade} onChange={e => setIFinalidade(e.target.value)} className={inputClass}>
                {FINALIDADES.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor de compra (R$)</label>
              <input type="number" step="0.01" value={iValor} onChange={e => setIValor(e.target.value)} className={inputClass} placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Quantidade</label>
              <input type="number" step="0.01" value={iQtd} onChange={e => setIQtd(e.target.value)} className={inputClass} placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unidade</label>
              <select value={iUnidade} onChange={e => setIUnidade(e.target.value)} className={inputClass}>
                <option value="un">un</option><option value="cx">cx</option><option value="kg">kg</option><option value="pct">pct</option><option value="par">par</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fornecedor</label>
            <select value={iFornecedor} onChange={e => setIFornecedor(e.target.value)} className={inputClass}>
              <option value="">— Nenhum —</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <p className="text-[11px] text-texto-fraco mt-0.5">Cadastre fornecedores na aba "Fornecedores".</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Observação (opcional)</label>
            <input value={iObs} onChange={e => setIObs(e.target.value)} className={inputClass} />
          </div>
          <Button type="submit" className="w-full">{editItem ? 'Salvar' : 'Adicionar'}</Button>
        </form>
      </Modal>

      {/* Modal Fornecedor */}
      <Modal open={modalForn} onClose={() => setModalForn(false)} title={editForn ? 'Editar fornecedor' : 'Novo fornecedor'}>
        <form onSubmit={salvarForn} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input value={fNome} onChange={e => setFNome(e.target.value)} className={inputClass} required placeholder="Ex: Gráfica Aliança" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contato (telefone/WhatsApp)</label>
            <input value={fContato} onChange={e => setFContato(e.target.value)} className={inputClass} placeholder="Ex: 62 99999-8888" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Endereço</label>
            <input value={fEndereco} onChange={e => setFEndereco(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Observação (opcional)</label>
            <input value={fObs} onChange={e => setFObs(e.target.value)} className={inputClass} />
          </div>
          <Button type="submit" className="w-full">{editForn ? 'Salvar' : 'Adicionar'}</Button>
        </form>
      </Modal>
    </AppLayout>
  );
}
