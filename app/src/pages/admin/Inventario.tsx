import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Menu } from '../../components/ui/Menu';
import { Icon } from '../../components/ui/Icon';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
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
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const msgErro = (err: unknown, padrao: string) => (err instanceof Error ? err.message : padrao);

export function Inventario() {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [aba, setAba] = useState<'itens' | 'fornecedores'>('itens');
  const [itens, setItens] = useState<Item[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');

  // Modal item
  const [modalItem, setModalItem] = useState(false);
  const fecharModalItem = useCallback(() => setModalItem(false), []);
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
  const [salvando, setSalvando] = useState(false);

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
      showToast(msgErro(err, 'Erro ao enviar foto'), 'error');
    } finally {
      setEnviandoFoto(false);
    }
  };

  // Modal fornecedor
  const [modalForn, setModalForn] = useState(false);
  const fecharModalForn = useCallback(() => setModalForn(false), []);
  const [editForn, setEditForn] = useState<Fornecedor | null>(null);
  const [fNome, setFNome] = useState('');
  const [fContato, setFContato] = useState('');
  const [fEndereco, setFEndereco] = useState('');
  const [fObs, setFObs] = useState('');

  const carregar = useCallback(() => {
    setErroCarga('');
    return Promise.all([
      api.get<Item[]>('/api/inventario').then(setItens),
      api.get<Fornecedor[]>('/api/inventario/fornecedores').then(setFornecedores),
    ])
      .catch(err => setErroCarga(msgErro(err, 'Erro ao carregar o inventário')))
      .finally(() => setCarregando(false));
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const tentarDeNovo = () => { setCarregando(true); carregar(); };

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
    if (salvando) return;
    const body = {
      nome: iNome, finalidade: iFinalidade, quantidade: parseFloat(iQtd) || 0,
      unidade: iUnidade || 'un', valor_compra: iValor ? parseFloat(iValor) : null,
      fornecedor_id: iFornecedor || null, observacao: iObs || null, foto_url: iFoto,
    };
    setSalvando(true);
    try {
      if (editItem) await api.put(`/api/inventario/${editItem.id}`, body);
      else await api.post('/api/inventario', body);
      setModalItem(false); carregar();
      showToast(editItem ? 'Item atualizado' : 'Item adicionado', 'success');
    } catch (err) { showToast(msgErro(err, 'Erro ao salvar'), 'error'); }
    finally { setSalvando(false); }
  };
  const excluirItem = async (it: Item) => {
    if (!(await confirm({ title: 'Excluir item', message: `Remover "${it.nome}" do inventário?`, confirmText: 'Excluir', danger: true }))) return;
    try {
      await api.delete(`/api/inventario/${it.id}`); carregar();
      showToast('Item excluído', 'success');
    } catch (err) { showToast(msgErro(err, 'Erro ao excluir'), 'error'); }
  };

  // ----- Fornecedores -----
  const abrirForn = (f?: Fornecedor) => {
    setEditForn(f || null);
    setFNome(f?.nome || ''); setFContato(f?.contato || ''); setFEndereco(f?.endereco || ''); setFObs(f?.observacao || '');
    setModalForn(true);
  };
  const salvarForn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    const body = { nome: fNome, contato: fContato || null, endereco: fEndereco || null, observacao: fObs || null };
    setSalvando(true);
    try {
      if (editForn) await api.put(`/api/inventario/fornecedores/${editForn.id}`, body);
      else await api.post('/api/inventario/fornecedores', body);
      setModalForn(false); carregar();
      showToast(editForn ? 'Fornecedor atualizado' : 'Fornecedor adicionado', 'success');
    } catch (err) { showToast(msgErro(err, 'Erro ao salvar'), 'error'); }
    finally { setSalvando(false); }
  };
  const excluirForn = async (f: Fornecedor) => {
    if (!(await confirm({ title: 'Excluir fornecedor', message: `Remover "${f.nome}"? Os itens dele ficam sem fornecedor.`, confirmText: 'Excluir', danger: true }))) return;
    try {
      await api.delete(`/api/inventario/fornecedores/${f.id}`); carregar();
      showToast('Fornecedor excluído', 'success');
    } catch (err) { showToast(msgErro(err, 'Erro ao excluir'), 'error'); }
  };

  const ABAS = [
    { id: 'itens' as const, label: 'Itens', total: itens.length },
    { id: 'fornecedores' as const, label: 'Fornecedores', total: fornecedores.length },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Inventário"
        subtitle="Material que a RP compra e não vende: brindes, quadros, facas e afins."
        right={aba === 'itens'
          ? <Button size="sm" onClick={() => abrirItem()}><Icon name="plus" size={16} /> Novo item</Button>
          : <Button size="sm" onClick={() => abrirForn()}><Icon name="plus" size={16} /> Novo fornecedor</Button>}
      />

      <div role="tablist" aria-label="Seções do inventário" className="grid grid-cols-2 gap-1 bg-white rounded-2xl p-1 border border-borda shadow-sm mb-5 sm:max-w-sm">
        {ABAS.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={aba === t.id} onClick={() => setAba(t.id)}
            className={`min-h-[40px] rounded-xl text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${aba === t.id ? 'bg-azul text-white' : 'text-texto-fraco hover:bg-fundo hover:text-texto'}`}>
            {t.label} <span className={aba === t.id ? 'text-white/70' : 'text-texto-fraco'}>({t.total})</span>
          </button>
        ))}
      </div>

      {carregando ? (
        <Loading label="Carregando inventário..." />
      ) : erroCarga ? (
        <div role="alert" className="bg-white border border-borda rounded-2xl p-6 text-center">
          <p className="font-medium text-texto">Não foi possível carregar o inventário.</p>
          <p className="text-sm text-texto-fraco mt-1">{erroCarga}</p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={tentarDeNovo}><Icon name="refresh" size={16} /> Tentar de novo</Button>
        </div>
      ) : aba === 'itens' ? (
        itens.length === 0 ? (
          <div className="bg-white rounded-2xl border border-borda">
            <EmptyState
              icon={<Icon name="archive" size={24} />}
              message="Nenhum item no inventário"
              hint="Cadastre o que a RP comprou para controlar quantidade, valor e fornecedor."
              action={<Button size="sm" onClick={() => abrirItem()}><Icon name="plus" size={16} /> Adicionar item</Button>}
            />
          </div>
        ) : (
          <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {itens.map(it => (
              <li key={it.id} className="bg-white rounded-2xl border border-borda shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    {it.foto_url
                      ? <img src={resolveImg(it.foto_url)!} alt="" className="w-14 h-14 rounded-xl object-cover border border-borda flex-shrink-0" />
                      : <div className="w-14 h-14 rounded-xl bg-fundo-elevado border border-borda flex items-center justify-center text-texto-fraco flex-shrink-0" aria-hidden="true"><Icon name="archive" size={20} /></div>}
                    <div className="min-w-0">
                      <div className="font-medium text-texto break-words">{it.nome}</div>
                      <div className="flex items-center gap-2 flex-wrap mt-1.5">
                        <span className="text-xs font-medium bg-azul/10 text-azul px-2 py-0.5 rounded-full">{finLabel(it.finalidade)}</span>
                        <span className="text-sm text-texto"><span className="font-display text-lg leading-none">{it.quantidade.toLocaleString('pt-BR')}</span> {it.unidade}</span>
                        {it.valor_compra != null && <span className="text-sm text-dourado font-medium">{brl(it.valor_compra)}</span>}
                      </div>
                      {it.fornecedor_nome && (
                        <div className="text-xs text-texto-fraco mt-1.5 break-words">
                          Fornecedor: <span className="text-texto">{it.fornecedor_nome}</span>
                          {it.fornecedor_contato && ` · ${it.fornecedor_contato}`}
                        </div>
                      )}
                      {it.observacao && <div className="text-xs text-texto-fraco mt-1 break-words">{it.observacao}</div>}
                    </div>
                  </div>
                  <Menu label={`Ações de ${it.nome}`} items={[
                    { label: 'Editar', icon: 'pencil', onClick: () => abrirItem(it) },
                    { label: 'Excluir', icon: 'trash', danger: true, onClick: () => excluirItem(it) },
                  ]} />
                </div>
              </li>
            ))}
          </ul>
        )
      ) : fornecedores.length === 0 ? (
        <div className="bg-white rounded-2xl border border-borda">
          <EmptyState
            icon={<Icon name="users" size={24} />}
            message="Nenhum fornecedor cadastrado"
            hint="Cadastre uma vez e escolha o fornecedor ao lançar os itens."
            action={<Button size="sm" onClick={() => abrirForn()}><Icon name="plus" size={16} /> Adicionar fornecedor</Button>}
          />
        </div>
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {fornecedores.map(f => (
            <li key={f.id} className="bg-white rounded-2xl border border-borda shadow-sm p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-texto break-words">{f.nome}</div>
                  {f.contato && <div className="text-sm text-texto-fraco mt-1 inline-flex items-center gap-1.5"><Icon name="device-phone" size={14} /> {f.contato}</div>}
                  {f.endereco && <div className="text-xs text-texto-fraco mt-1 break-words">{f.endereco}</div>}
                  {f.observacao && <div className="text-xs text-texto-fraco mt-1 break-words">{f.observacao}</div>}
                </div>
                <Menu label={`Ações de ${f.nome}`} items={[
                  { label: 'Editar', icon: 'pencil', onClick: () => abrirForn(f) },
                  { label: 'Excluir', icon: 'trash', danger: true, onClick: () => excluirForn(f) },
                ]} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Modal Item */}
      <Modal open={modalItem} onClose={fecharModalItem} title={editItem ? 'Editar item' : 'Novo item'}>
        <form onSubmit={salvarItem} className="space-y-4">
          <div>
            <label htmlFor="inv-nome" className="block text-sm font-medium mb-1.5">Item</label>
            <input id="inv-nome" value={iNome} onChange={e => setINome(e.target.value)} className={inputClass} required placeholder="Ex.: Quadro Sabre Alado" />
          </div>
          <div>
            <span className="block text-sm font-medium mb-1.5">Foto (opcional)</span>
            <div className="flex items-center gap-3 flex-wrap">
              {iFoto && <img src={resolveImg(iFoto)!} alt="Foto do item" className="w-16 h-16 rounded-xl object-cover border border-borda" />}
              <label className="min-h-[40px] text-sm font-medium px-3.5 rounded-xl text-azul bg-blue-50 border border-blue-200 hover:bg-blue-100 inline-flex items-center gap-1.5 cursor-pointer focus-within:ring-2 focus-within:ring-azul/40">
                <Icon name="upload" size={16} /> {enviandoFoto ? 'Enviando...' : iFoto ? 'Trocar foto' : 'Enviar foto'}
                <input type="file" accept="image/*" onChange={enviarFoto} className="sr-only" disabled={enviandoFoto} />
              </label>
              {iFoto && <Button variant="chip-danger" size="sm" onClick={() => setIFoto(null)}>Remover foto</Button>}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="inv-fin" className="block text-sm font-medium mb-1.5">Finalidade</label>
              <select id="inv-fin" value={iFinalidade} onChange={e => setIFinalidade(e.target.value)} className={inputClass}>
                {FINALIDADES.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="inv-valor" className="block text-sm font-medium mb-1.5">Valor de compra (R$)</label>
              <input id="inv-valor" type="number" inputMode="decimal" step="0.01" value={iValor} onChange={e => setIValor(e.target.value)} className={inputClass} placeholder="0,00" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="inv-qtd" className="block text-sm font-medium mb-1.5">Quantidade</label>
              <input id="inv-qtd" type="number" inputMode="decimal" step="0.01" value={iQtd} onChange={e => setIQtd(e.target.value)} className={inputClass} placeholder="0" />
            </div>
            <div>
              <label htmlFor="inv-un" className="block text-sm font-medium mb-1.5">Unidade</label>
              <select id="inv-un" value={iUnidade} onChange={e => setIUnidade(e.target.value)} className={inputClass}>
                <option value="un">un</option><option value="cx">cx</option><option value="kg">kg</option><option value="pct">pct</option><option value="par">par</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="inv-forn" className="block text-sm font-medium mb-1.5">Fornecedor</label>
            <select id="inv-forn" value={iFornecedor} onChange={e => setIFornecedor(e.target.value)} className={inputClass}>
              <option value="">Nenhum</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <p className="text-xs text-texto-fraco mt-1">Cadastre fornecedores na aba Fornecedores.</p>
          </div>
          <div>
            <label htmlFor="inv-obs" className="block text-sm font-medium mb-1.5">Observação (opcional)</label>
            <input id="inv-obs" value={iObs} onChange={e => setIObs(e.target.value)} className={inputClass} />
          </div>
          <Button type="submit" className="w-full" disabled={salvando || enviandoFoto}>
            {salvando ? 'Salvando...' : editItem ? 'Salvar alterações' : 'Adicionar item'}
          </Button>
        </form>
      </Modal>

      {/* Modal Fornecedor */}
      <Modal open={modalForn} onClose={fecharModalForn} title={editForn ? 'Editar fornecedor' : 'Novo fornecedor'}>
        <form onSubmit={salvarForn} className="space-y-4">
          <div>
            <label htmlFor="forn-nome" className="block text-sm font-medium mb-1.5">Nome</label>
            <input id="forn-nome" value={fNome} onChange={e => setFNome(e.target.value)} className={inputClass} required placeholder="Ex.: Gráfica Aliança" />
          </div>
          <div>
            <label htmlFor="forn-contato" className="block text-sm font-medium mb-1.5">Contato (telefone ou WhatsApp)</label>
            <input id="forn-contato" type="tel" value={fContato} onChange={e => setFContato(e.target.value)} className={inputClass} placeholder="Ex.: 62 99999-8888" />
          </div>
          <div>
            <label htmlFor="forn-end" className="block text-sm font-medium mb-1.5">Endereço</label>
            <input id="forn-end" value={fEndereco} onChange={e => setFEndereco(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="forn-obs" className="block text-sm font-medium mb-1.5">Observação (opcional)</label>
            <input id="forn-obs" value={fObs} onChange={e => setFObs(e.target.value)} className={inputClass} />
          </div>
          <Button type="submit" className="w-full" disabled={salvando}>
            {salvando ? 'Salvando...' : editForn ? 'Salvar alterações' : 'Adicionar fornecedor'}
          </Button>
        </form>
      </Modal>
    </AppLayout>
  );
}
