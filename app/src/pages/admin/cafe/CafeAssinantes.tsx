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
import type { PlanoCafe, SalaCafeTipo } from '../../../types';
import {
  SeletorSalaCafe, ehAnuidade, mesAtualYM, mesCurto, nomeSalaCafe, rotuloReferencia,
  salaDaCategoria, useConfigCafe, useSalaCafe, valorPadraoCafe,
} from './SalaCafe';

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
  valido_ate?: string | null; // anual (contrato novo)
}

interface Pagamento {
  id: string;
  referencia: string;
  valor: number;
  status: string;
  paid_at: string | null;
  periodo_fim?: string | null;
  rotulo?: string | null;
}

// Resultado da busca do trigrama: se tem conta, a sala vem da categoria
type Busca =
  | { estado: 'ocioso' }
  | { estado: 'buscando' }
  | { estado: 'sem-conta' }
  | { estado: 'erro' }
  | { estado: 'conta'; categoria: string; sala: SalaCafeTipo | null };

const CATEGORIA_LABEL: Record<string, string> = { oficial: 'Oficial', graduado: 'Graduado/SO', praca: 'Praça' };

export function CafeAssinantes() {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { busy, executar } = useAcao();
  const [sala, setSala] = useSalaCafe();
  const config = useConfigCafe();
  const nomeSala = nomeSalaCafe(config, sala);
  const [assinantes, setAssinantes] = useState<Assinante[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Assinante | null>(null);
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [tipo, setTipo] = useState<SalaCafeTipo>('graduado');
  const [plano, setPlano] = useState<PlanoCafe>('mensal');
  const [valor, setValor] = useState('');
  const [busca, setBusca] = useState<Busca>({ estado: 'ocioso' });

  // Modal detalhes/cobrar
  const [detalhes, setDetalhes] = useState<Assinante | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [cobrancaValor, setCobrancaValor] = useState('');
  const [cobrancaRef, setCobrancaRef] = useState('');
  const fecharDetalhes = useCallback(() => setDetalhes(null), []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [sala]);

  // Ao completar o trigrama, descobre se o militar tem conta (a sala segue a categoria dele)
  const trigramaBusca = nomeGuerra.trim().toUpperCase();
  useEffect(() => {
    if (!modalAberto || trigramaBusca.length !== 3) { setBusca({ estado: 'ocioso' }); return; }
    let ativo = true;
    setBusca({ estado: 'buscando' });
    const t = setTimeout(() => {
      api.get<{ categoria?: string } | null>(`/api/usuarios/admin/por-trigrama/${encodeURIComponent(trigramaBusca)}`)
        .then(u => {
          if (!ativo) return;
          if (u && u.categoria) setBusca({ estado: 'conta', categoria: u.categoria, sala: salaDaCategoria(u.categoria) });
          else setBusca({ estado: 'sem-conta' });
        })
        .catch(() => { if (ativo) setBusca({ estado: 'erro' }); });
    }, 300);
    return () => { ativo = false; clearTimeout(t); };
  }, [trigramaBusca, modalAberto]);

  const temConta = busca.estado === 'conta';
  const ehPraca = busca.estado === 'conta' && busca.sala === null;
  // Sala que vai valer: a da categoria (quem tem conta) ou a escolhida (sem conta)
  const salaEfetiva: SalaCafeTipo = busca.estado === 'conta' && busca.sala ? busca.sala : tipo;
  const padrao = valorPadraoCafe(config, salaEfetiva, plano);

  const fecharModal = useCallback(() => {
    setModalAberto(false);
    setEditando(null);
    setNomeGuerra(''); setTipo(sala); setPlano('mensal'); setValor('');
  }, [sala]);

  const recarregarPagamentos = async (assinanteId: string) => {
    const pags = await api.get<Pagamento[]>(`/api/cafe/admin/assinantes/${assinanteId}/pagamentos`);
    setPagamentos(pags);
  };

  const abrirDetalhes = async (a: Assinante) => {
    setDetalhes(a);
    setCobrancaValor(String(a.valor));
    setCobrancaRef(dataLocal(new Date()).slice(0, 7));
    setPagamentos([]);
    setCarregandoPags(true);
    try {
      await recarregarPagamentos(a.id);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar cobranças', 'error');
    } finally {
      setCarregandoPags(false);
    }
  };

  const cobrar = async () => {
    if (!detalhes || !cobrancaValor) return;
    const anual = detalhes.plano === 'anual';
    if (!anual && !cobrancaRef) return;
    const v = parseFloat(cobrancaValor);
    if (!(v > 0)) { showToast('Informe um valor válido', 'error'); return; }
    const ok = await confirm({
      title: anual ? 'Lançar anuidade' : 'Lançar cobrança',
      message: anual
        ? `Cobrar a anuidade de ${brl(v)} de ${detalhes.nome_guerra}? O período de 12 meses é calculado pelo sistema.`
        : `Cobrar ${brl(v)} de ${detalhes.nome_guerra} referente a ${mesCurto(cobrancaRef)}?`,
      confirmText: 'Cobrar',
    });
    if (!ok) return;
    const assinanteId = detalhes.id;
    await executar('cobrar', async () => {
      // Anual: o servidor gera a anuidade (período a partir da adesão); mensal: mês escolhido
      await api.post(`/api/cafe/admin/assinantes/${assinanteId}/cobrar`, anual
        ? { valor: v, plano: 'anual' }
        : { valor: v, referencia: cobrancaRef, plano: 'mensal' });
      await recarregarPagamentos(assinanteId);
      carregar();
    }, { sucesso: anual ? 'Anuidade lançada' : 'Cobrança lançada' });
  };

  const marcarPago = async (pagId: string) => {
    await executar(`pagar:${pagId}`, async () => {
      await api.put(`/api/cafe/admin/mensalidades/${pagId}/pagar`, {});
      if (detalhes) await recarregarPagamentos(detalhes.id);
      carregar();
    }, { sucesso: 'Cobrança marcada como paga' });
  };

  const abrirEditar = (a: Assinante) => {
    setEditando(a);
    setNomeGuerra(a.nome_guerra);
    setTipo(a.tipo === 'oficial' ? 'oficial' : 'graduado');
    setPlano(a.plano === 'anual' ? 'anual' : 'mensal');
    setValor(String(a.valor));
    setModalAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editando && !/^[A-ZÀ-ÚÖ]{3}$/.test(nomeGuerra.trim())) {
      showToast('Trigrama deve ter exatamente 3 letras', 'error');
      return;
    }
    if (ehPraca) {
      showToast('Praça não participa do café', 'error');
      return;
    }
    const valorNum = valor.trim() === '' ? undefined : parseFloat(valor);
    if (valorNum !== undefined && !(valorNum > 0)) { showToast('Informe um valor válido ou deixe vazio para usar o padrão', 'error'); return; }
    // Quem tem conta: a sala vem da categoria (o servidor ignora o tipo); sem conta: a escolhida
    const corpoSala = temConta ? {} : { tipo };
    await executar('salvar', async () => {
      if (editando) {
        await api.put(`/api/cafe/admin/assinantes/${editando.id}`, {
          ...corpoSala,
          plano,
          ...(valorNum !== undefined ? { valor: valorNum } : {}),
        });
      } else {
        await api.post('/api/cafe/admin/assinantes', {
          nome_guerra: nomeGuerra.trim().toUpperCase(),
          tipo: temConta && busca.estado === 'conta' && busca.sala ? busca.sala : tipo,
          plano,
          ...(valorNum !== undefined ? { valor: valorNum } : {}),
        });
      }
      fecharModal();
      carregar();
    }, { sucesso: editando ? 'Assinante atualizado' : 'Assinante adicionado' });
  };

  const toggleAtivo = async (a: Assinante) => {
    if (a.ativo) {
      if (!(await confirm({ title: 'Desativar', message: `Desativar ${a.nome_guerra}?`, confirmText: 'Desativar', danger: false }))) return;
    }
    await executar(`ativo:${a.id}`, async () => {
      if (a.ativo) await api.put(`/api/cafe/admin/assinantes/${a.id}/desativar`, {});
      else await api.put(`/api/cafe/admin/assinantes/${a.id}`, { ativo: 1 });
      carregar();
    });
  };

  const excluir = async (a: Assinante) => {
    if (!(await confirm({ title: 'Excluir', message: `Excluir ${a.nome_guerra} permanentemente? Todos os pagamentos desse assinante serão apagados.`, confirmText: 'Excluir', danger: true }))) return;
    await executar(`excluir:${a.id}`, async () => {
      await api.delete(`/api/cafe/admin/assinantes/${a.id}`);
      carregar();
    }, { sucesso: 'Assinante excluído' });
  };

  const planoLabel = (a: Assinante) => a.plano === 'anual'
    ? <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Anual</span>
    : <span className="text-xs text-texto-fraco">Mensal</span>;

  const situacao = (a: Assinante) => {
    if (a.total_devido > 0) {
      return <Badge variant="danger">{a.plano === 'anual' ? `Anuidade em aberto · ${brl(a.total_devido)}` : `Deve ${brl(a.total_devido)}`}</Badge>;
    }
    if (a.plano === 'anual' && a.valido_ate !== undefined) {
      if (!a.valido_ate) return <Badge variant="warning">Anuidade em aberto</Badge>;
      if (a.valido_ate < mesAtualYM()) return <Badge variant="warning">Venceu em {mesCurto(a.valido_ate)}</Badge>;
      return <Badge variant="success">Válido até {mesCurto(a.valido_ate)}</Badge>;
    }
    return <Badge variant="success">Em dia</Badge>;
  };

  const menuItens = (a: Assinante) => [
    { label: 'Ver cobranças', icon: 'eye' as const, onClick: () => abrirDetalhes(a) },
    { label: 'Editar', icon: 'pencil' as const, onClick: () => abrirEditar(a) },
    { label: a.ativo ? 'Desativar' : 'Ativar', icon: (a.ativo ? 'x' : 'check') as 'x' | 'check', onClick: () => toggleAtivo(a) },
    { label: 'Excluir', icon: 'trash' as const, danger: true, onClick: () => excluir(a) },
  ];

  const novo = () => { setEditando(null); setTipo(sala); setPlano('mensal'); setValor(''); setNomeGuerra(''); setModalAberto(true); };

  return (
    <AppLayout>
      <SeletorSalaCafe sala={sala} onChange={setSala} config={config} />
      <PageHeader
        title="Assinantes do café"
        subtitle={`Quem contribui com a caixinha da ${nomeSala}, plano e situação de pagamento.`}
        right={<Button size="sm" onClick={novo}><Icon name="plus" size={16} /> Novo assinante</Button>}
      />

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
                      {!a.ativo && <Badge variant="neutral">Inativo</Badge>}
                    </div>
                  </button>
                  <Menu label={`Ações de ${a.nome_guerra}`} items={menuItens(a)} />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-borda text-sm">
                  <div><div className="text-xs text-texto-fraco">Valor</div><div className="font-medium">{brl(a.valor)}</div></div>
                  <div className="text-right"><div className="text-xs text-texto-fraco">Já pagou</div><div className="font-medium text-verde-escuro">{brl(a.total_pago)}</div></div>
                </div>
                <div className="mt-2">{situacao(a)}</div>
              </Card>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden md:block bg-white rounded-2xl overflow-hidden border border-borda shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-noite">
                  <th className="px-4 py-3 text-left text-xs font-medium text-white">Militar</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-white">Plano</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white">Valor</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white">Já pagou</th>
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
                    <td className="px-4 py-3 text-center">{planoLabel(a)}</td>
                    <td className="px-4 py-3 text-right text-texto-fraco whitespace-nowrap">{brl(a.valor)}</td>
                    <td className="px-4 py-3 text-right text-verde-escuro font-medium whitespace-nowrap">{brl(a.total_pago)}</td>
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

          {/* Sala: segue a categoria de quem tem conta; só se escolhe para quem não tem */}
          {busca.estado === 'buscando' && (
            <p className="text-sm text-texto-fraco" role="status">Procurando a conta do militar...</p>
          )}
          {busca.estado === 'conta' && busca.sala && (
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 text-azul rounded-xl px-3.5 py-2.5 text-sm" role="status">
              <Icon name="info" size={18} className="mt-0.5 shrink-0" />
              <p>
                Sala definida pela categoria: <strong>{CATEGORIA_LABEL[busca.categoria] || busca.categoria}</strong> → {nomeSalaCafe(config, busca.sala)}
                {busca.sala !== sala && <span className="block text-xs mt-0.5">Ele vai aparecer na outra sala, não nesta.</span>}
              </p>
            </div>
          )}
          {ehPraca && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3.5 py-2.5 text-sm" role="alert">
              <Icon name="warning" size={18} className="mt-0.5 shrink-0" />
              <p>Este militar é <strong>praça</strong>. Praça não participa do café, então não é possível cadastrá-lo.</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!temConta && (
              <div>
                <label htmlFor="ca-tipo" className="block text-sm font-medium mb-1.5">Sala</label>
                <select id="ca-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as SalaCafeTipo)} className={inputClass}>
                  <option value="oficial">{nomeSalaCafe(config, 'oficial')}</option>
                  <option value="graduado">{nomeSalaCafe(config, 'graduado')}</option>
                </select>
                {busca.estado === 'sem-conta' && <p className="text-xs text-texto-fraco mt-1">Sem conta no app: escolha a sala.</p>}
                {busca.estado === 'erro' && <p className="text-xs text-texto-fraco mt-1">Não deu para verificar a conta. Se ele tiver conta, vale a sala da categoria.</p>}
              </div>
            )}
            <div>
              <label htmlFor="ca-plano" className="block text-sm font-medium mb-1.5">Plano</label>
              <select id="ca-plano" value={plano} onChange={(e) => setPlano(e.target.value as PlanoCafe)} className={inputClass}>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual (12 meses a partir da adesão)</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="ca-valor" className="block text-sm font-medium mb-1.5">Valor (R$)</label>
            <input id="ca-valor" type="number" step="0.01" min="0" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
              className={inputClass}
              placeholder={padrao !== null ? `Padrão da sala: ${brl(padrao)}` : 'Sem valor padrão configurado'} />
            <p className="text-xs text-texto-fraco mt-1">
              {editando
                ? 'Deixe vazio para manter o valor atual.'
                : padrao !== null
                  ? 'Deixe vazio para usar o valor padrão da sala e do plano.'
                  : 'Informe o valor ou configure o padrão em Configurações > Valores.'}
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={busy('salvar') || ehPraca || busca.estado === 'buscando'}>
            {busy('salvar') ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar assinante'}
          </Button>
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
              {situacao(detalhes)}
            </div>

            {/* Criar cobrança manual */}
            <div className="border border-borda rounded-xl p-4">
              <h3 className="text-sm font-medium text-noite mb-3">{detalhes.plano === 'anual' ? 'Lançar anuidade' : 'Lançar cobrança'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {detalhes.plano === 'anual' ? (
                  <p className="text-xs text-texto-fraco sm:col-span-1">
                    A anuidade vale 12 meses. O período é calculado pelo sistema a partir da adesão; confirme só o valor.
                  </p>
                ) : (
                  <div>
                    <label htmlFor="ca-ref" className="block text-xs text-texto-fraco mb-1">Mês de referência</label>
                    <input id="ca-ref" type="month" value={cobrancaRef} onChange={(e) => setCobrancaRef(e.target.value)} className={inputClass} />
                  </div>
                )}
                <div>
                  <label htmlFor="ca-cvalor" className="block text-xs text-texto-fraco mb-1">Valor (R$)</label>
                  <input id="ca-cvalor" type="number" step="0.01" min="0" inputMode="decimal" value={cobrancaValor} onChange={(e) => setCobrancaValor(e.target.value)} className={inputClass} />
                </div>
              </div>
              <Button size="sm" className="w-full" onClick={cobrar} disabled={busy('cobrar')}>
                {busy('cobrar') ? 'Lançando...' : `${detalhes.plano === 'anual' ? 'Cobrar anuidade de' : 'Cobrar'} ${brl(parseFloat(cobrancaValor || '0'))}`}
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
                      <div className="flex items-center gap-2 flex-wrap">
                        {ehAnuidade(p) && <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">Anuidade</span>}
                        <span className="text-sm font-medium">{rotuloReferencia(p)}</span>
                        <span className="text-sm text-texto-fraco">{brl(p.valor)}</span>
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
