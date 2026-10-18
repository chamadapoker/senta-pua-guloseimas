import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../../../components/AppLayout';
import { BackButton } from '../../../components/ui/BackButton';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { PageHeader } from '../../../components/ui/PageHeader';
import { inputClass } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { api } from '../../../services/api';
import { dataLocal } from '../../../services/periodo';
import { useConfirm } from '../../../hooks/useConfirm';
import { useToast } from '../../../hooks/useToast';
import { StatCard } from '../../../components/admin/StatCard';
import { Card } from '../../../components/ui/Card';
import { Loading } from '../../../components/ui/Loading';
import { EmptyState } from '../../../components/ui/EmptyState';
import { SeletorSalaCafe, nomeSalaCafe, useConfigCafe, useSalaCafe } from './SalaCafe';

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CATEGORIAS: Record<string, string> = {
  cafe: 'Café (pó)',
  acucar: 'Açúcar',
  leite: 'Leite',
  filtro: 'Filtro',
  copos: 'Copos e descartáveis',
  limpeza: 'Limpeza',
  equipamento: 'Equipamento',
  geral: 'Geral',
};

interface Despesa {
  id: string;
  tipo: 'oficial' | 'graduado';
  descricao: string;
  categoria: string;
  valor: number;
  data: string;
  nota_fiscal: string | null;
  observacao: string;
  created_by: string | null;
  created_at: string;
}

interface Saldo {
  total_entrada: number;
  total_saida: number;
  saldo_atual: number;
  total_pendente: number;
  saldo_previsto: number;
}

export function CafeDespesas() {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  // Segue a sala escolhida no topo (a mesma das outras telas do café)
  const [tipo, setTipo] = useSalaCafe();
  const config = useConfigCafe();
  const nomeSala = nomeSalaCafe(config, tipo);
  const [lista, setLista] = useState<Despesa[]>([]);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [modal, setModal] = useState(false);
  const fecharModal = useCallback(() => setModal(false), []);
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('geral');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(() => dataLocal(new Date()));
  const [notaFiscal, setNotaFiscal] = useState('');
  const [observacao, setObservacao] = useState('');

  const carregar = () => {
    const q = `?tipo=${tipo}`;
    setCarregando(true);
    setErro('');
    Promise.all([
      api.get<Despesa[]>(`/api/cafe/admin/despesas${q}`),
      api.get<Saldo>(`/api/cafe/admin/saldo${q}`),
    ]).then(([d, s]) => { setLista(d); setSaldo(s); })
      .catch((e: any) => setErro(e?.message || 'Erro ao carregar despesas'))
      .finally(() => setCarregando(false));
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [tipo]);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    try {
      await api.post('/api/cafe/admin/despesas', {
        tipo, descricao, categoria,
        valor: parseFloat(valor), data,
        nota_fiscal: notaFiscal || null,
        observacao,
      });
      setModal(false);
      setDescricao(''); setValor(''); setNotaFiscal(''); setObservacao('');
      showToast('Despesa registrada', 'success');
      carregar();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar despesa', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (d: Despesa) => {
    if (!(await confirm({ title: 'Excluir', message: `Remover "${d.descricao}" (${brl(d.valor)})?`, confirmText: 'Excluir', danger: true }))) return;
    await api.delete(`/api/cafe/admin/despesas/${d.id}`);
    carregar();
  };

  const dataBR = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

  return (
    <AppLayout>
      <BackButton to={`/admin/cafe?sala=${tipo}`} className="mb-3" />
      <SeletorSalaCafe sala={tipo} onChange={setTipo} config={config} />
      <PageHeader
        title="Despesas do café"
        subtitle={`Compras da caixinha e o saldo da ${nomeSala}.`}
        right={<Button size="sm" onClick={() => setModal(true)}><Icon name="plus" size={16} /> Nova despesa</Button>}
      />

      {saldo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard label="Entrou" value={brl(saldo.total_entrada)} color="text-verde-escuro" icon={<Icon name="download" size={18} />} />
          <StatCard label="Saiu" value={brl(saldo.total_saida)} color="text-escarlate" icon={<Icon name="upload" size={18} />} />
          <StatCard label="Saldo atual" value={brl(saldo.saldo_atual)} color={saldo.saldo_atual >= 0 ? 'text-verde-escuro' : 'text-escarlate'} icon={<Icon name="vault" size={18} />} />
          <StatCard label="Saldo previsto" value={brl(saldo.saldo_previsto)} color="text-azul" icon={<Icon name="chart" size={18} />} hint="Somando as mensalidades pendentes" />
        </div>
      )}

      {erro ? (
        <Card className="text-center py-10">
          <p className="text-escarlate text-sm mb-4">{erro}</p>
          <Button size="sm" onClick={carregar}><Icon name="refresh" size={16} /> Tentar de novo</Button>
        </Card>
      ) : carregando && lista.length === 0 ? (
        <Loading label="Carregando despesas..." />
      ) : lista.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="note" size={24} />}
            message="Nenhuma despesa registrada"
            hint={`Registre as compras da ${nomeSala} para acompanhar o saldo.`}
            action={<Button size="sm" onClick={() => setModal(true)}><Icon name="plus" size={16} /> Nova despesa</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Celular: cartões */}
          <div className="md:hidden space-y-2">
            {lista.map(d => (
              <Card key={d.id} className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-texto break-words">{d.descricao}</div>
                  <div className="text-xs text-texto-fraco mt-0.5">
                    {dataBR(d.data)} · {CATEGORIAS[d.categoria] || d.categoria}
                    {d.nota_fiscal && <> · NF {d.nota_fiscal}</>}
                  </div>
                  {d.observacao && <div className="text-xs text-texto-fraco mt-1 break-words">{d.observacao}</div>}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="font-display text-xl text-escarlate tracking-wide leading-none">{brl(d.valor)}</span>
                  <Button variant="chip-danger" size="sm" onClick={() => excluir(d)} aria-label={`Excluir ${d.descricao}`}>
                    <Icon name="trash" size={15} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden md:block bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-noite">
                  <th className="px-4 py-3 text-left text-xs text-white font-medium">Data</th>
                  <th className="px-4 py-3 text-left text-xs text-white font-medium">Descrição</th>
                  <th className="px-4 py-3 text-left text-xs text-white font-medium">Categoria</th>
                  <th className="px-4 py-3 text-right text-xs text-white font-medium">Valor</th>
                  <th className="px-4 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {lista.map(d => (
                  <tr key={d.id} className="border-b border-borda/50 last:border-0 hover:bg-fundo">
                    <td className="px-4 py-2.5 text-xs text-texto-fraco whitespace-nowrap">{dataBR(d.data)}</td>
                    <td className="px-4 py-2.5">
                      {d.descricao}
                      {d.nota_fiscal && <span className="ml-1.5 text-xs text-texto-fraco">NF {d.nota_fiscal}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-texto-fraco">{CATEGORIAS[d.categoria] || d.categoria}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-escarlate whitespace-nowrap">{brl(d.valor)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="chip-danger" size="sm" onClick={() => excluir(d)} aria-label={`Excluir ${d.descricao}`}>
                        <Icon name="trash" size={15} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={modal} onClose={fecharModal} title="Nova despesa">
        <form onSubmit={salvar} className="space-y-4">
          <p className="text-sm text-texto-fraco">
            Sala: <strong className="text-texto">{nomeSala}</strong>
            <span className="block text-xs mt-0.5">Para lançar em outra sala, troque a sala no topo da tela.</span>
          </p>
          <div>
            <label htmlFor="cd-cat" className="block text-sm font-medium mb-1.5">Categoria</label>
            <select id="cd-cat" value={categoria} onChange={e => setCategoria(e.target.value)} className={inputClass}>
              {Object.entries(CATEGORIAS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cd-desc" className="block text-sm font-medium mb-1.5">Descrição</label>
            <input id="cd-desc" value={descricao} onChange={e => setDescricao(e.target.value)} className={inputClass} required placeholder="Ex.: 1 kg de café Melitta" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cd-valor" className="block text-sm font-medium mb-1.5">Valor (R$)</label>
              <input id="cd-valor" type="number" step="0.01" min="0" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label htmlFor="cd-data" className="block text-sm font-medium mb-1.5">Data</label>
              <input id="cd-data" type="date" value={data} onChange={e => setData(e.target.value)} className={inputClass} required />
            </div>
          </div>
          <div>
            <label htmlFor="cd-nf" className="block text-sm font-medium mb-1.5">Nota fiscal (opcional)</label>
            <input id="cd-nf" value={notaFiscal} onChange={e => setNotaFiscal(e.target.value)} className={inputClass} placeholder="Número da NF" />
          </div>
          <div>
            <label htmlFor="cd-obs" className="block text-sm font-medium mb-1.5">Observação (opcional)</label>
            <input id="cd-obs" value={observacao} onChange={e => setObservacao(e.target.value)} className={inputClass} />
          </div>
          <Button type="submit" className="w-full" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar despesa'}</Button>
        </form>
      </Modal>
    </AppLayout>
  );
}
