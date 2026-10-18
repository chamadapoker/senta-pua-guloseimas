import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../../../components/AppLayout';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { PageHeader } from '../../../components/ui/PageHeader';
import { inputClass } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { Menu } from '../../../components/ui/Menu';
import { api } from '../../../services/api';
import { dataLocal } from '../../../services/periodo';
import { useConfirm } from '../../../hooks/useConfirm';
import { useToast } from '../../../hooks/useToast';
import { useAcao } from '../../../hooks/useAcao';
import { Icon } from '../../../components/ui/Icon';
import { Card } from '../../../components/ui/Card';
import { Loading } from '../../../components/ui/Loading';
import { EmptyState } from '../../../components/ui/EmptyState';

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Assinante {
  id: string;
  cliente_id: string;
  nome_guerra: string;
  tipo: string;
  plano: string;
  valor: number;
  ativo: number;
  total_pago: number;
  total_devido: number;
}

interface Pagamento {
  id: string;
  referencia: string;
  valor: number;
  status: string;
  paid_at: string | null;
}

export function CafeAssinantes() {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { busy, executar } = useAcao();
  const [sala, setSala] = useState<'oficial' | 'graduado'>(() =>
    (localStorage.getItem('cafe_tipo') as 'oficial' | 'graduado') || 'graduado'
  );
  const [assinantes, setAssinantes] = useState<Assinante[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Assinante | null>(null);
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [tipo, setTipo] = useState('graduado');
  const [plano, setPlano] = useState('mensal');
  const [valor, setValor] = useState('');

  // Modal detalhes/cobrar
  const [detalhes, setDetalhes] = useState<Assinante | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [cobrancaValor, setCobrancaValor] = useState('');
  const [cobrancaRef, setCobrancaRef] = useState('');
  const fecharDetalhes = useCallback(() => setDetalhes(null), []);

  useEffect(() => { localStorage.setItem('cafe_tipo', sala); }, [sala]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [carregandoPags, setCarregandoPags] = useState(false);
  const carregar = () => {
    setCarregando(true);
    setErro('');
    return api.get<Assinante[]>(`/api/cafe/admin/assinantes?tipo=${sala}`)
      .then(setAssinantes)
      .catch((e: any) => setErro(e?.message || 'Erro ao carregar assinantes'))
      .finally(() => setCarregando(false));
  };
  useEffect(() => { carregar(); }, [sala]);

  const fecharModal = useCallback(() => {
    setModalAberto(false);
    setEditando(null);
    setNomeGuerra(''); setTipo(sala); setPlano('mensal'); setValor('');
  }, [sala]);

  const abrirDetalhes = async (a: Assinante) => {
    setDetalhes(a);
    setCobrancaValor(String(a.valor));
    setCobrancaRef(dataLocal(new Date()).slice(0, 7));
    setPagamentos([]);
    setCarregandoPags(true);
    try {
      const pags = await api.get<Pagamento[]>(`/api/cafe/admin/assinantes/${a.id}/pagamentos`);
      setPagamentos(pags);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar cobranças', 'error');
    } finally {
      setCarregandoPags(false);
    }
  };

  const cobrar = async () => {
    if (!detalhes || !cobrancaValor || !cobrancaRef) return;
    const valor = parseFloat(cobrancaValor);
    if (!(valor > 0)) { showToast('Informe um valor válido', 'error'); return; }
    const ok = await confirm({
      title: 'Lançar cobrança',
      message: `Cobrar ${brl(valor)} de ${detalhes.nome_guerra} referente a ${cobrancaRef}?`,
      confirmText: 'Cobrar',
    });
    if (!ok) return;
    const assinanteId = detalhes.id;
    await executar('cobrar', async () => {
      await api.post(`/api/cafe/admin/assinantes/${assinanteId}/cobrar`, { valor, referencia: cobrancaRef });
      const pags = await api.get<Pagamento[]>(`/api/cafe/admin/assinantes/${assinanteId}/pagamentos`);
      setPagamentos(pags);
      carregar();
    }, { sucesso: 'Cobrança lançada' });
  };

  const marcarPago = async (pagId: string) => {
    await executar(`pagar:${pagId}`, async () => {
      await api.put(`/api/cafe/admin/mensalidades/${pagId}/pagar`, {});
      if (detalhes) {
        const pags = await api.get<Pagamento[]>(`/api/cafe/admin/assinantes/${detalhes.id}/pagamentos`);
        setPagamentos(pags);
      }
      carregar();
    }, { sucesso: 'Mensalidade marcada como paga' });
  };

  const abrirEditar = (a: Assinante) => {
    setEditando(a);
    setNomeGuerra(a.nome_guerra);
    setTipo(a.tipo);
    setPlano(a.plano);
    setValor(String(a.valor));
    setModalAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando && !/^[A-ZÀ-ÚÖ]{3}$/.test(nomeGuerra.trim())) {
      showToast('Trigrama deve ter exatamente 3 letras', 'error');
      return;
    }
    try {
      if (editando) {
        await api.put(`/api/cafe/admin/assinantes/${editando.id}`, {
          tipo,
          plano,
          valor: parseFloat(valor),
        });
      } else {
        await api.post('/api/cafe/admin/assinantes', {
          nome_guerra: nomeGuerra.trim().toUpperCase(),
          tipo,
          plano,
          valor: parseFloat(valor),
        });
      }
      fecharModal();
      carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro', 'error');
    }
  };

  const toggleAtivo = async (a: Assinante) => {
    if (a.ativo) {
      if (!(await confirm({ title: 'Desativar', message: `Desativar ${a.nome_guerra}?`, confirmText: 'Desativar', danger: false }))) return;
      await api.put(`/api/cafe/admin/assinantes/${a.id}/desativar`, {});
    } else {
      await api.put(`/api/cafe/admin/assinantes/${a.id}`, { ativo: 1 });
    }
    carregar();
  };

  const excluir = async (a: Assinante) => {
    if (!(await confirm({ title: 'Excluir', message: `Excluir ${a.nome_guerra} permanentemente? Todos os pagamentos desse assinante serão apagados.`, confirmText: 'Excluir', danger: true }))) return;
    await api.delete(`/api/cafe/admin/assinantes/${a.id}`);
    carregar();
  };

  const planoLabel = (a: Assinante) => a.plano === 'anual'
    ? <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">VIP anual</span>
    : <span className="text-xs text-texto-fraco">Mensal</span>;

  const situacao = (a: Assinante) => a.plano === 'anual' && a.total_devido === 0
    ? <Badge variant="success">Em dia</Badge>
    : <Badge variant={a.total_devido > 0 ? 'danger' : 'success'}>{a.total_devido > 0 ? `Deve ${brl(a.total_devido)}` : 'Em dia'}</Badge>;

  const pagoLabel = (a: Assinante) => a.plano === 'anual' && a.total_devido === 0
    ? `Pago ${new Date().getFullYear()}`
    : brl(a.total_pago);

  const menuItens = (a: Assinante) => [
    { label: 'Ver cobranças', icon: 'eye' as const, onClick: () => abrirDetalhes(a) },
    { label: 'Editar', icon: 'pencil' as const, onClick: () => abrirEditar(a) },
    { label: a.ativo ? 'Desativar' : 'Ativar', icon: (a.ativo ? 'x' : 'check') as 'x' | 'check', onClick: () => toggleAtivo(a) },
    { label: 'Excluir', icon: 'trash' as const, danger: true, onClick: () => excluir(a) },
  ];

  const novo = () => { setEditando(null); setTipo(sala); setModalAberto(true); };

  return (
    <AppLayout>
      <PageHeader
        title="Assinantes do café"
        subtitle="Quem contribui com a caixinha, plano e situação de pagamento."
        right={<Button size="sm" onClick={novo}><Icon name="plus" size={16} /> Novo assinante</Button>}
      />
      <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label="Sala do café">
        {(['oficial', 'graduado'] as const).map(t => (
          <Button key={t} size="sm" variant={sala === t ? 'primary' : 'chip'} aria-pressed={sala === t} onClick={() => setSala(t)}>
            {t === 'oficial' ? 'Oficiais' : 'Graduados'}
          </Button>
        ))}
      </div>

      {erro ? (
        <Card className="text-center py-10">
          <p className="text-escarlate text-sm mb-4">{erro}</p>
          <Button size="sm" onClick={carregar}><Icon name="refresh" size={16} /> Tentar de novo</Button>
        </Card>
      ) : carregando && assinantes.length === 0 ? (
        <Loading label="Carregando assinantes..." />
      ) : assinantes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="users" size={24} />}
            message="Nenhum assinante nesta sala"
            hint="Adicione quem participa da caixinha do café."
            action={<Button size="sm" onClick={novo}><Icon name="plus" size={16} /> Novo assinante</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Celular: cartões */}
          <div className="md:hidden space-y-3">
            {assinantes.map((a) => (
              <Card key={a.id} className={!a.ativo ? 'opacity-60' : ''}>
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => abrirDetalhes(a)} className="min-w-0 text-left min-h-[40px]">
                    <div className="font-display text-2xl text-noite tracking-wide leading-none">{a.nome_guerra}</div>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      {planoLabel(a)}
                      <span className="text-xs text-texto-fraco capitalize">{a.tipo}</span>
                      {!a.ativo && <Badge variant="neutral">Inativo</Badge>}
                    </div>
                  </button>
                  <Menu label={`Ações de ${a.nome_guerra}`} items={menuItens(a)} />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-borda text-sm">
                  <div><div className="text-xs text-texto-fraco">Valor</div><div className="font-medium">{brl(a.valor)}</div></div>
                  <div><div className="text-xs text-texto-fraco">Pago</div><div className="font-medium text-verde-escuro">{pagoLabel(a)}</div></div>
                  <div className="text-right"><div className="text-xs text-texto-fraco mb-0.5">Situação</div>{situacao(a)}</div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden md:block bg-white rounded-2xl overflow-hidden border border-borda shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-noite">
                  <th className="px-4 py-3 text-left text-xs font-medium text-white">Militar</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-white">Tipo</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-white">Plano</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white">Valor</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white">Pago</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white">Situação</th>
                  <th className="px-4 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {assinantes.map((a) => (
                  <tr key={a.id} className={`border-b border-borda/50 last:border-0 hover:bg-fundo ${!a.ativo ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => abrirDetalhes(a)} className="font-medium text-azul hover:underline">{a.nome_guerra}</button>
                      {!a.ativo && <span className="ml-2"><Badge variant="neutral">Inativo</Badge></span>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs capitalize">{a.tipo}</td>
                    <td className="px-4 py-3 text-center">{planoLabel(a)}</td>
                    <td className="px-4 py-3 text-right text-texto-fraco whitespace-nowrap">{brl(a.valor)}</td>
                    <td className="px-4 py-3 text-right text-verde-escuro font-medium whitespace-nowrap">{pagoLabel(a)}</td>
                    <td className="px-4 py-3 text-right">{situacao(a)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end"><Menu label={`Ações de ${a.nome_guerra}`} items={menuItens(a)} /></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={modalAberto} onClose={fecharModal} title={editando ? 'Editar assinante' : 'Novo assinante'}>
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label htmlFor="ca-trigrama" className="block text-sm font-medium mb-1.5">Trigrama</label>
            <input id="ca-trigrama" value={nomeGuerra} maxLength={3}
              onChange={(e) => setNomeGuerra(e.target.value.toUpperCase().replace(/[^A-ZÀ-ÚÖ]/g, '').slice(0, 3))}
              className={`${inputClass} uppercase tracking-widest disabled:bg-fundo disabled:text-texto-fraco`} required disabled={!!editando} />
            <p className="text-xs text-texto-fraco mt-1">{editando ? 'O trigrama não pode ser alterado.' : 'Exatamente 3 letras.'}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ca-tipo" className="block text-sm font-medium mb-1.5">Sala</label>
              <select id="ca-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputClass}>
                <option value="oficial">Oficial</option>
                <option value="graduado">Graduado</option>
              </select>
            </div>
            <div>
              <label htmlFor="ca-plano" className="block text-sm font-medium mb-1.5">Plano</label>
              <select id="ca-plano" value={plano} onChange={(e) => setPlano(e.target.value)} className={inputClass}>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="ca-valor" className="block text-sm font-medium mb-1.5">Valor (R$)</label>
            <input id="ca-valor" type="number" step="0.01" min="0" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
              className={inputClass} required />
          </div>
          <Button type="submit" className="w-full">{editando ? 'Salvar alterações' : 'Adicionar assinante'}</Button>
        </form>
      </Modal>

      {/* Modal detalhes do assinante */}
      <Modal open={!!detalhes} onClose={fecharDetalhes} title={detalhes ? detalhes.nome_guerra : ''}>
        {detalhes && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 bg-fundo rounded-xl px-4 py-3">
              <div>
                <span className="text-sm font-medium">{detalhes.plano === 'anual' ? 'Plano anual' : 'Plano mensal'}</span>
                <p className="text-xs text-texto-fraco">Valor: {brl(detalhes.valor)}</p>
              </div>
              <Badge variant={detalhes.total_devido > 0 ? 'danger' : 'success'}>
                {detalhes.total_devido > 0 ? `Deve ${brl(detalhes.total_devido)}` : 'Em dia'}
              </Badge>
            </div>

            {/* Criar cobrança manual */}
            <div className="border border-borda rounded-xl p-4">
              <h3 className="text-sm font-medium text-noite mb-3">Lançar cobrança</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label htmlFor="ca-ref" className="block text-xs text-texto-fraco mb-1">Mês de referência</label>
                  <input id="ca-ref" type="month" value={cobrancaRef} onChange={(e) => setCobrancaRef(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="ca-cvalor" className="block text-xs text-texto-fraco mb-1">Valor (R$)</label>
                  <input id="ca-cvalor" type="number" step="0.01" min="0" inputMode="decimal" value={cobrancaValor} onChange={(e) => setCobrancaValor(e.target.value)} className={inputClass} />
                </div>
              </div>
              <Button size="sm" className="w-full" onClick={cobrar} disabled={busy('cobrar')}>
                {busy('cobrar') ? 'Lançando...' : `Cobrar ${brl(parseFloat(cobrancaValor || '0'))}`}
              </Button>
            </div>

            {/* Histórico de pagamentos */}
            <div>
              <h3 className="text-sm font-medium mb-2">Histórico</h3>
              {carregandoPags ? (
                <Loading label="Carregando cobranças..." />
              ) : pagamentos.length === 0 ? (
                <p className="text-sm text-texto-fraco text-center py-4">Nenhuma cobrança lançada.</p>
              ) : (
                <div className="space-y-2">
                  {pagamentos.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-2 flex-wrap bg-white border border-borda rounded-xl px-3 py-2">
                      <div>
                        <span className="text-sm font-medium">{p.referencia}</span>
                        <span className="text-sm text-texto-fraco ml-2">{brl(p.valor)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.status === 'pago' ? (
                          <Badge variant="success">Pago</Badge>
                        ) : (
                          <>
                            <Badge variant="warning">Pendente</Badge>
                            <Button variant="chip-success" size="sm" onClick={() => marcarPago(p.id)} disabled={busy(`pagar:${p.id}`)}>{busy(`pagar:${p.id}`) ? 'Salvando...' : 'Marcar pago'}</Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}
