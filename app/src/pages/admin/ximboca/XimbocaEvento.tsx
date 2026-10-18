import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { AppLayout } from '../../../components/AppLayout';
import { BackButton } from '../../../components/ui/BackButton';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Menu } from '../../../components/ui/Menu';
import { api } from '../../../services/api';
import { Loading } from '../../../components/ui/Loading';
import { inputClass } from '../../../components/ui/Field';
import { PageHeader } from '../../../components/ui/PageHeader';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatCard } from '../../../components/admin/StatCard';
import { gerarCobrancaXimbocaPDF } from '../../../services/pdf';
import { useConfirm } from '../../../hooks/useConfirm';
import { useToast } from '../../../hooks/useToast';
import { useAcao } from '../../../hooks/useAcao';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  return url ? (url.startsWith('/api') ? `${WORKER_URL}${url}` : url) : null;
}

interface Participante { id: string; nome: string; whatsapp: string | null; status: string; paid_at: string | null; valor_individual: number | null; categoria_consumo: string; }
interface Despesa { id: string; descricao: string; valor: number; categoria: string; quantidade: number | null; unidade: string | null; created_at: string; }
interface EstoqueItem { id: string; nome: string; quantidade: number; unidade: string; }
interface IngressoTipo { id: string; evento_id: string; nome: string; valor: number; ordem: number; }
interface Tarefa { id: string; titulo: string; responsavel: string | null; feito: number; }
interface Cautela { id: string; item: string; quantidade: number; unidade: string; origem: string | null; responsavel: string | null; qtd_devolvida: number; }
interface Evento { id: string; nome: string; data: string; valor_por_pessoa: number; valor_cerveja: number | null; valor_refri: number | null; descricao: string; status: string; pix_chave: string | null; pix_tipo: string | null; pix_nome: string | null; pix_whatsapp: string | null; imagem_url: string | null; }

type Aba = 'participantes' | 'despesas' | 'organizacao' | 'divulgacao';

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataEvento = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

const CATEGORIAS: Record<string, string> = {
  carne: 'Carne', bebida: 'Bebida', carvao: 'Carvão', descartavel: 'Descartável', tempero: 'Tempero', geral: 'Geral',
};
const rotuloCategoria = (c: string) => CATEGORIAS[c] || c;
const CONSUMO: Record<string, string> = { padrao: 'Padrão', refri: 'Só refri', cerveja: 'Cerveja', chopp: 'Chopp' };
const rotuloConsumo = (c: string) => CONSUMO[c] || c;

// Bloco de seção (fora do componente para não remontar a cada render)
function Secao({ titulo, resumo, acao, children }: { titulo: string; resumo?: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-borda flex items-center justify-between gap-x-3 gap-y-2 flex-wrap">
        <div className="min-w-0">
          <h2 className="font-display text-xl text-noite tracking-wide leading-none">{titulo}</h2>
          {resumo && <p className="text-xs text-texto-fraco mt-1">{resumo}</p>}
        </div>
        {acao && <div className="flex items-center gap-2 flex-wrap">{acao}</div>}
      </div>
      {children}
    </section>
  );
}

export function XimbocaEvento() {
  const { id } = useParams<{ id: string }>();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const { busy, executar } = useAcao();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [erroCarga, setErroCarga] = useState('');
  const [aba, setAba] = useState<Aba>('participantes');

  // Add participant
  const [modalPart, setModalPart] = useState(false);
  const fecharModalPart = useCallback(() => setModalPart(false), []);
  const [partNome, setPartNome] = useState('');
  const [partWhats, setPartWhats] = useState('');
  const [partCategoria, setPartCategoria] = useState('padrao');
  const [partValor, setPartValor] = useState('');

  // Edit event
  const [modalEdit, setModalEdit] = useState(false);
  const fecharModalEdit = useCallback(() => setModalEdit(false), []);
  const [edNome, setEdNome] = useState('');
  const [edData, setEdData] = useState('');
  const [edValor, setEdValor] = useState('');
  const [edCerveja, setEdCerveja] = useState('');
  const [edRefri, setEdRefri] = useState('');
  const [edDescricao, setEdDescricao] = useState('');
  const [edPixChave, setEdPixChave] = useState('');
  const [edPixTipo, setEdPixTipo] = useState('aleatoria');
  const [edPixNome, setEdPixNome] = useState('');
  const [edPixWhatsapp, setEdPixWhatsapp] = useState('');

  // QR code
  const [modalQR, setModalQR] = useState(false);
  const fecharModalQR = useCallback(() => setModalQR(false), []);
  const qrRef = useRef<HTMLDivElement>(null);

  // Consumir estoque
  const [modalEstoque, setModalEstoque] = useState(false);
  const fecharModalEstoque = useCallback(() => setModalEstoque(false), []);
  const [estoqueLista, setEstoqueLista] = useState<EstoqueItem[]>([]);
  const [estoqueId, setEstoqueId] = useState('');
  const [estoqueQtd, setEstoqueQtd] = useState('');

  // Add expense
  const [modalDesp, setModalDesp] = useState(false);
  const fecharModalDesp = useCallback(() => setModalDesp(false), []);
  const [despDescricao, setDespDescricao] = useState('');
  const [despValor, setDespValor] = useState('');
  const [despCategoria, setDespCategoria] = useState('geral');
  const [despQtd, setDespQtd] = useState('');
  const [despUnidade, setDespUnidade] = useState('');

  // Tipos de ingresso, capa e check-in
  const [tipos, setTipos] = useState<IngressoTipo[]>([]);
  const [novoTipoNome, setNovoTipoNome] = useState('');
  const [novoTipoValor, setNovoTipoValor] = useState('');
  const [checkinStats, setCheckinStats] = useState<{ total_pagos: number; entraram: number; faltam: number } | null>(null);

  // Checklist
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [novaTarefa, setNovaTarefa] = useState('');
  const [novaTarefaResp, setNovaTarefaResp] = useState('');

  // Cautela de material
  const [cautelas, setCautelas] = useState<Cautela[]>([]);
  const [cautItem, setCautItem] = useState('');
  const [cautQtd, setCautQtd] = useState('');
  const [cautUnidade, setCautUnidade] = useState('un');
  const [cautOrigem, setCautOrigem] = useState('');
  const [cautResp, setCautResp] = useState('');

  const carregar = () => {
    setErroCarga('');
    api.get<{ evento: Evento; participantes: Participante[]; despesas: Despesa[]; tipos: IngressoTipo[]; tarefas: Tarefa[]; cautelas: Cautela[] }>(`/api/ximboca/eventos/${id}`).then(d => {
      setEvento(d.evento);
      setParticipantes(d.participantes);
      setDespesas(d.despesas);
      setTipos(d.tipos || []);
      setTarefas(d.tarefas || []);
      setCautelas(d.cautelas || []);
    }).catch((e: any) => setErroCarga(e?.message || 'Não foi possível carregar o evento.'));
    api.get<{ total_pagos: number; entraram: number; faltam: number }>(`/api/ximboca/eventos/${id}/checkin-stats`).then(setCheckinStats).catch(() => {});
  };

  useEffect(() => { carregar(); }, [id]);

  const adicionarParticipante = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/api/ximboca/eventos/${id}/participantes`, { nome: partNome, whatsapp: partWhats || null, valor_individual: parseFloat(partValor) || null, categoria_consumo: partCategoria });
    setModalPart(false); setPartNome(''); setPartWhats(''); setPartCategoria('padrao'); setPartValor('');
    carregar();
  };

  const marcarPago = async (pid: string) => {
    const ok = await executar(`pagar:${pid}`, () => api.put(`/api/ximboca/participantes/${pid}/pagar`, {}), { sucesso: 'Participante marcado como pago' });
    if (ok !== undefined) carregar();
  };

  const cobrarParticipante = async (p: Participante) => {
    if (!evento) return;
    const valor = p.valor_individual ?? evento.valor_por_pessoa;
    const dataFormatada = new Date(evento.data + 'T12:00:00').toLocaleDateString('pt-BR');
    await gerarCobrancaXimbocaPDF(evento.nome, dataFormatada, p.nome, valor);
  };

  const removerParticipante = async (pid: string) => {
    if (!(await confirm({ message: 'Remover participante?', confirmText: 'Remover', danger: true }))) return;
    await api.delete(`/api/ximboca/participantes/${pid}`);
    carregar();
  };

  const adicionarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/api/ximboca/eventos/${id}/despesas`, { descricao: despDescricao, valor: parseFloat(despValor), categoria: despCategoria, quantidade: parseFloat(despQtd) || null, unidade: despUnidade || null });
    setModalDesp(false); setDespDescricao(''); setDespValor(''); setDespCategoria('geral'); setDespQtd(''); setDespUnidade('');
    carregar();
  };

  const abrirEstoque = () => {
    api.get<EstoqueItem[]>('/api/ximboca/estoque').then(setEstoqueLista);
    setEstoqueId(''); setEstoqueQtd('');
    setModalEstoque(true);
  };

  const consumirEstoque = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/api/ximboca/eventos/${id}/consumir-estoque`, {
        estoque_id: estoqueId,
        quantidade: parseFloat(estoqueQtd),
      });
      setModalEstoque(false);
      carregar();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao consumir estoque', 'error');
    }
  };

  const removerDespesa = async (did: string) => {
    if (!(await confirm({ message: 'Remover despesa?', confirmText: 'Remover', danger: true }))) return;
    await api.delete(`/api/ximboca/despesas/${did}`);
    carregar();
  };

  const adicionarTipo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTipoNome || !novoTipoValor) return;
    await api.post(`/api/ximboca/eventos/${id}/tipos`, { nome: novoTipoNome, valor: parseFloat(novoTipoValor), ordem: tipos.length });
    setNovoTipoNome(''); setNovoTipoValor('');
    carregar();
  };

  const removerTipo = async (tipoId: string) => {
    if (!(await confirm({ message: 'Remover este tipo de ingresso?', confirmText: 'Remover', danger: true }))) return;
    try { await api.delete(`/api/ximboca/tipos/${tipoId}`); carregar(); }
    catch (err) { showToast(err instanceof Error ? err.message : 'Erro ao remover', 'error'); }
  };

  const adicionarTarefa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTarefa.trim()) return;
    await api.post(`/api/ximboca/eventos/${id}/tarefas`, { titulo: novaTarefa, responsavel: novaTarefaResp || null });
    setNovaTarefa(''); setNovaTarefaResp('');
    carregar();
  };
  const toggleTarefa = async (t: Tarefa) => {
    await api.put(`/api/ximboca/tarefas/${t.id}`, { feito: t.feito ? 0 : 1 });
    carregar();
  };
  const removerTarefa = async (t: Tarefa) => {
    if (!(await confirm({ message: `Remover a tarefa "${t.titulo}"?`, confirmText: 'Remover', danger: true }))) return;
    await api.delete(`/api/ximboca/tarefas/${t.id}`);
    carregar();
  };

  const adicionarCautela = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cautItem.trim()) return;
    await api.post(`/api/ximboca/eventos/${id}/cautelas`, {
      item: cautItem, quantidade: parseFloat(cautQtd) || 0, unidade: cautUnidade || 'un',
      origem: cautOrigem || null, responsavel: cautResp || null,
    });
    setCautItem(''); setCautQtd(''); setCautUnidade('un'); setCautOrigem(''); setCautResp('');
    carregar();
  };
  const salvarDevolucao = async (ct: Cautela, valor: string) => {
    const v = parseFloat(valor);
    if (isNaN(v) || v === ct.qtd_devolvida) return;
    await api.put(`/api/ximboca/cautelas/${ct.id}`, { qtd_devolvida: Math.max(0, v) });
    carregar();
  };
  const devolverTudo = async (ct: Cautela) => {
    await api.put(`/api/ximboca/cautelas/${ct.id}`, { qtd_devolvida: ct.quantidade });
    carregar();
  };
  const removerCautela = async (ct: Cautela) => {
    if (!(await confirm({ message: `Remover a cautela "${ct.item}"?`, confirmText: 'Remover', danger: true }))) return;
    await api.delete(`/api/ximboca/cautelas/${ct.id}`);
    carregar();
  };

  const enviarCapa = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    await api.upload(`/api/ximboca/eventos/${id}/imagem`, fd);
    carregar();
  };

  const abrirEdicao = () => {
    if (!evento) return;
    setEdNome(evento.nome);
    setEdData(evento.data);
    setEdValor(evento.valor_por_pessoa?.toString() || '');
    setEdCerveja(evento.valor_cerveja !== null ? String(evento.valor_cerveja) : '');
    setEdRefri(evento.valor_refri !== null ? String(evento.valor_refri) : '');
    setEdDescricao(evento.descricao || '');
    setEdPixChave(evento.pix_chave || '');
    setEdPixTipo(evento.pix_tipo || 'aleatoria');
    setEdPixNome(evento.pix_nome || '');
    setEdPixWhatsapp(evento.pix_whatsapp || '');
    setModalEdit(true);
  };

  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.put(`/api/ximboca/eventos/${id}`, {
      nome: edNome,
      data: edData,
      valor_por_pessoa: parseFloat(edValor) || 0,
      valor_cerveja: edCerveja ? parseFloat(edCerveja) : null,
      valor_refri: edRefri ? parseFloat(edRefri) : null,
      descricao: edDescricao,
      pix_chave: edPixChave.trim() || null,
      pix_tipo: edPixChave.trim() ? edPixTipo : null,
      pix_nome: edPixNome.trim() || null,
      pix_whatsapp: edPixWhatsapp.replace(/\D/g, '') || null,
    });
    setModalEdit(false);
    carregar();
  };

  const baixarQR = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas || !evento) return;
    const link = document.createElement('a');
    link.download = `qrcode-${evento.nome.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const qrUrl = typeof window !== 'undefined' ? `${window.location.origin}/e/${id}` : '';
  const [linkCopiado, setLinkCopiado] = useState(false);
  const copiarLinkEvento = async () => {
    await navigator.clipboard.writeText(qrUrl);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2500);
  };

  if (!evento) {
    return (
      <AppLayout>
        <BackButton to="/admin/ximboca/eventos" className="mb-3" />
        {erroCarga ? (
          <Card size="lg" className="text-center">
            <p className="text-escarlate text-sm mb-4">{erroCarga}</p>
            <Button variant="ghost" size="sm" onClick={carregar}><Icon name="refresh" size={16} />Tentar de novo</Button>
          </Card>
        ) : <Loading />}
      </AppLayout>
    );
  }

  const valorEfetivo = (p: Participante) => p.valor_individual ?? evento.valor_por_pessoa;
  const totalPagos = participantes.filter(p => p.status === 'pago').length;
  const totalPendentes = participantes.length - totalPagos;
  const totalArrecadado = participantes.filter(p => p.status === 'pago').reduce((a, p) => a + valorEfetivo(p), 0);
  const totalPendente = participantes.filter(p => p.status !== 'pago').reduce((a, p) => a + valorEfetivo(p), 0);
  const totalDespesas = despesas.reduce((a, d) => a + d.valor, 0);
  const saldo = totalArrecadado - totalDespesas;
  const tarefasFeitas = tarefas.filter(t => t.feito).length;
  const cautelasAbertas = cautelas.filter(ct => (ct.quantidade || 0) - (ct.qtd_devolvida || 0) > 0).length;
  const dataFmt = dataEvento(evento.data);

  const abas: { id: Aba; label: string; extra?: string }[] = [
    { id: 'participantes', label: 'Participantes', extra: String(participantes.length) },
    { id: 'despesas', label: 'Despesas', extra: String(despesas.length) },
    { id: 'organizacao', label: 'Organização', extra: tarefas.length ? `${tarefasFeitas}/${tarefas.length}` : undefined },
    { id: 'divulgacao', label: 'Divulgação' },
  ];
  // No mobile só a aba ativa aparece; a partir de lg tudo fica visível em sequência
  const visivel = (a: Aba) => (aba === a ? '' : 'hidden lg:block');

  return (
    <AppLayout>
      <BackButton to="/admin/ximboca/eventos" className="mb-3" />
      <PageHeader
        title={evento.nome}
        subtitle={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <Badge variant={evento.status === 'aberto' ? 'success' : 'neutral'}>{evento.status === 'aberto' ? 'Aberto' : 'Fechado'}</Badge>
            <span>{dataFmt} · {brl(evento.valor_por_pessoa)} por pessoa</span>
          </span>
        }
        right={
          <>
            <Button variant="ghost" size="sm" onClick={abrirEdicao}><Icon name="pencil" size={16} />Editar evento</Button>
            <Button variant="ghost" size="sm" onClick={() => setModalQR(true)}><Icon name="qr-code" size={16} />QR code</Button>
          </>
        }
      />

      {/* Resumo financeiro */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Pagos" value={`${totalPagos}/${participantes.length}`} color="text-azul" icon={<Icon name="users" size={18} />}
          hint={totalPendentes > 0 ? `${totalPendentes} pendente${totalPendentes > 1 ? 's' : ''}` : 'Todos em dia'} />
        <StatCard label="Arrecadado" value={brl(totalArrecadado)} color="text-verde-escuro" icon={<Icon name="cash" size={18} />}
          hint={totalPendente > 0 ? `Falta receber ${brl(totalPendente)}` : undefined} />
        <StatCard label="Gasto" value={brl(totalDespesas)} color="text-escarlate" icon={<Icon name="cart" size={18} />} />
        <StatCard label="Saldo" value={brl(saldo)} color={saldo >= 0 ? 'text-verde-escuro' : 'text-escarlate'} icon={<Icon name="vault" size={18} />} />
      </div>

      {/* Abas (só no mobile/tablet) */}
      <div role="tablist" aria-label="Seções do evento" className="lg:hidden flex flex-wrap gap-2 mb-4">
        {abas.map(a => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={`min-h-[40px] px-3.5 rounded-xl text-sm font-medium border transition-colors ${
              aba === a.id ? 'bg-noite text-white border-noite' : 'bg-white text-texto border-borda hover:bg-fundo-elevado'
            }`}
          >
            {a.label}
            {a.extra && <span className={`ml-1.5 text-xs ${aba === a.id ? 'text-white/70' : 'text-texto-fraco'}`}>{a.extra}</span>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 lg:items-start">
        <div className="space-y-6 mb-6 lg:mb-0">
          {/* Participantes */}
          <div className={visivel('participantes')}>
            <Secao
              titulo="Participantes"
              resumo={participantes.length > 0 ? `${totalPagos} pagos · ${totalPendentes} pendentes` : undefined}
              acao={<Button size="sm" onClick={() => setModalPart(true)}><Icon name="plus" size={16} />Adicionar</Button>}
            >
              {participantes.length === 0 ? (
                <EmptyState
                  icon={<Icon name="users" size={24} />}
                  message="Nenhum participante"
                  hint="As inscrições pela página pública aparecem aqui. Você também pode adicionar alguém na mão."
                  action={<Button size="sm" variant="ghost" onClick={() => setModalPart(true)}><Icon name="plus" size={16} />Adicionar participante</Button>}
                />
              ) : (
                <ul className="divide-y divide-borda">
                  {participantes.map(p => (
                    <li key={p.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-noite text-sm break-words">{p.nome}</div>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5 text-xs text-texto-fraco">
                          <span className="capitalize">{rotuloConsumo(p.categoria_consumo)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-dourado font-medium">{brl(valorEfetivo(p))}</span>
                        </div>
                      </div>
                      {p.status === 'pago' ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="success">Pago</Badge>
                          <Menu label={`Ações de ${p.nome}`} items={[
                            { label: 'Remover', icon: 'trash', danger: true, onClick: () => removerParticipante(p.id) },
                          ]} />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button variant="chip-success" size="sm" disabled={busy(`pagar:${p.id}`)} onClick={() => marcarPago(p.id)}>
                            {busy(`pagar:${p.id}`) ? 'Salvando...' : 'Pago'}
                          </Button>
                          <Menu label={`Ações de ${p.nome}`} items={[
                            { label: 'Cobrar no WhatsApp', icon: 'device-phone', disabled: !p.whatsapp, onClick: () => window.open(`https://wa.me/${p.whatsapp ? '55' + p.whatsapp : ''}?text=${encodeURIComponent(`Opa! Ximboca "${evento.nome}" (${new Date(evento.data + 'T12:00:00').toLocaleDateString('pt-BR')})\nSeu valor: R$ ${valorEfetivo(p).toFixed(2)}\nFavor regularizar o pagamento!`)}`, '_blank') },
                            { label: 'Gerar cobrança em PDF', icon: 'document', onClick: () => cobrarParticipante(p) },
                            { label: 'Remover', icon: 'trash', danger: true, onClick: () => removerParticipante(p.id) },
                          ]} />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Secao>
          </div>

          {/* Despesas */}
          <div className={visivel('despesas')}>
            <Secao
              titulo="Despesas"
              resumo={despesas.length > 0 ? `Total ${brl(totalDespesas)}` : undefined}
              acao={
                <>
                  <Button size="sm" variant="ghost" onClick={abrirEstoque}><Icon name="archive" size={16} />Do estoque</Button>
                  <Button size="sm" onClick={() => setModalDesp(true)}><Icon name="plus" size={16} />Adicionar</Button>
                </>
              }
            >
              {despesas.length === 0 ? (
                <EmptyState
                  icon={<Icon name="cart" size={24} />}
                  message="Nenhuma despesa lançada"
                  hint="Registre compras de carne, bebida e carvão para fechar o saldo do evento."
                  action={<Button size="sm" variant="ghost" onClick={() => setModalDesp(true)}><Icon name="plus" size={16} />Adicionar despesa</Button>}
                />
              ) : (
                <ul className="divide-y divide-borda">
                  {despesas.map(d => (
                    <li key={d.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-noite break-words">{d.descricao}</div>
                        <div className="text-xs text-texto-fraco mt-0.5">
                          {rotuloCategoria(d.categoria)}
                          {d.quantidade ? ` · ${d.quantidade.toLocaleString('pt-BR')} ${d.unidade || 'un'}` : ''}
                        </div>
                      </div>
                      <span className="font-display text-lg leading-none text-escarlate shrink-0">{brl(d.valor)}</span>
                      <Button variant="chip-danger" size="sm" className="shrink-0" onClick={() => removerDespesa(d.id)} aria-label={`Remover despesa ${d.descricao}`}><Icon name="trash" size={15} /></Button>
                    </li>
                  ))}
                </ul>
              )}
            </Secao>
          </div>
        </div>

        <div className="space-y-6">
          {/* Organização: checklist + cautela */}
          <div className={`space-y-6 ${visivel('organizacao')}`}>
            <Secao titulo="Checklist da organização" resumo={tarefas.length > 0 ? `${tarefasFeitas} de ${tarefas.length} feitas` : undefined}>
              {tarefas.length === 0 ? (
                <p className="text-sm text-texto-fraco px-4 pt-4 text-center">Nenhuma tarefa ainda. Monte a checklist do evento abaixo.</p>
              ) : (
                <ul className="divide-y divide-borda">
                  {tarefas.map(t => (
                    <li key={t.id} className="flex items-center gap-2 px-2 py-1">
                      <button onClick={() => toggleTarefa(t)}
                        className="w-10 h-10 flex items-center justify-center shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-azul/40"
                        aria-label={t.feito ? `Desmarcar ${t.titulo}` : `Marcar ${t.titulo} como feita`}>
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${t.feito ? 'bg-verde border-verde text-white' : 'border-borda-forte bg-white'}`}>
                          {t.feito ? <Icon name="check" size={13} /> : null}
                        </span>
                      </button>
                      <div className="flex-1 min-w-0 py-1.5">
                        <div className={`text-sm break-words ${t.feito ? 'line-through text-texto-fraco' : 'text-texto'}`}>{t.titulo}</div>
                        {t.responsavel && <div className="text-xs text-texto-fraco">Responsável: {t.responsavel}</div>}
                      </div>
                      <button onClick={() => removerTarefa(t)} aria-label={`Remover tarefa ${t.titulo}`}
                        className="w-10 h-10 flex items-center justify-center rounded-lg text-texto-fraco hover:text-escarlate hover:bg-red-50 transition-colors shrink-0"><Icon name="trash" size={15} /></button>
                    </li>
                  ))}
                </ul>
              )}
              <form onSubmit={adicionarTarefa} className="grid grid-cols-1 sm:grid-cols-[1fr_10rem_auto] gap-2 p-4 border-t border-borda mt-2">
                <input value={novaTarefa} onChange={e => setNovaTarefa(e.target.value)} className={inputClass} placeholder="Ex.: Comprar carvão" aria-label="Nova tarefa" />
                <input value={novaTarefaResp} onChange={e => setNovaTarefaResp(e.target.value)} className={inputClass} placeholder="Responsável" aria-label="Responsável pela tarefa" />
                <Button type="submit" size="sm"><Icon name="plus" size={16} />Tarefa</Button>
              </form>
            </Secao>

            <Secao titulo="Cautela de material" resumo={cautelas.length > 0 ? (cautelasAbertas > 0 ? `${cautelasAbertas} a devolver` : 'Tudo devolvido') : undefined}>
              <p className="text-xs text-texto-fraco px-4 pt-3">Material emprestado (ex.: do rancho). Dê baixa na devolução. Não entra no estoque.</p>
              <div className="space-y-2 p-4">
                {cautelas.map(ct => {
                  const falta = (ct.quantidade || 0) - (ct.qtd_devolvida || 0);
                  const ok = falta <= 0;
                  return (
                    <div key={ct.id} className="bg-fundo rounded-xl p-3 border border-borda">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-noite break-words">{ct.item} <span className="text-texto-fraco font-normal">· {ct.quantidade} {ct.unidade}</span></div>
                          {(ct.origem || ct.responsavel) && (
                            <div className="text-xs text-texto-fraco">
                              {ct.origem && <>De {ct.origem}{ct.responsavel ? ' · ' : ''}</>}{ct.responsavel && <>Responsável: {ct.responsavel}</>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {ok ? <Badge variant="success">Devolvido</Badge> : <Badge variant="warning">Falta {falta} {ct.unidade}</Badge>}
                          <button onClick={() => removerCautela(ct)} aria-label={`Remover cautela ${ct.item}`} className="w-10 h-10 flex items-center justify-center rounded-lg text-texto-fraco hover:text-escarlate hover:bg-red-50"><Icon name="trash" size={15} /></button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-sm flex-wrap">
                        <label htmlFor={`dev-${ct.id}`} className="text-texto-fraco">Devolvido</label>
                        <input id={`dev-${ct.id}`} type="number" step="0.01" min="0" inputMode="decimal" defaultValue={ct.qtd_devolvida}
                          key={`${ct.id}-${ct.qtd_devolvida}`}
                          onBlur={(e) => salvarDevolucao(ct, e.target.value)}
                          className="w-24 min-h-[40px] bg-white border border-borda rounded-lg px-2.5 text-texto" />
                        <span className="text-texto-fraco">de {ct.quantidade} {ct.unidade}</span>
                        {!ok && <Button size="sm" variant="chip-success" className="ml-auto" onClick={() => devolverTudo(ct)}>Devolver tudo</Button>}
                      </div>
                    </div>
                  );
                })}
                {cautelas.length === 0 && <p className="text-sm text-texto-fraco text-center">Nenhum material sob cautela.</p>}
              </div>
              <form onSubmit={adicionarCautela} className="grid grid-cols-2 gap-2 p-4 border-t border-borda">
                <input value={cautItem} onChange={e => setCautItem(e.target.value)} className={`${inputClass} col-span-2`} placeholder="Item (ex.: taças)" aria-label="Item" />
                <input type="number" step="0.01" inputMode="decimal" value={cautQtd} onChange={e => setCautQtd(e.target.value)} className={inputClass} placeholder="Quantidade" aria-label="Quantidade" />
                <select value={cautUnidade} onChange={e => setCautUnidade(e.target.value)} className={inputClass} aria-label="Unidade">
                  <option value="un">un</option><option value="cx">cx</option><option value="kg">kg</option><option value="L">L</option><option value="pct">pct</option>
                </select>
                <input value={cautOrigem} onChange={e => setCautOrigem(e.target.value)} className={`${inputClass} col-span-2 sm:col-span-1`} placeholder="De onde (ex.: rancho)" aria-label="De onde vem" />
                <input value={cautResp} onChange={e => setCautResp(e.target.value)} className={`${inputClass} col-span-2 sm:col-span-1`} placeholder="Responsável" aria-label="Responsável pela cautela" />
                <Button type="submit" size="sm" className="col-span-2"><Icon name="plus" size={16} />Adicionar à cautela</Button>
              </form>
            </Secao>
          </div>

          {/* Divulgação, ingressos e portaria */}
          <div className={visivel('divulgacao')}>
            <Secao titulo="Divulgação e portaria">
              <div className="p-4 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-noite mb-2">Link público do evento</h3>
                  <div className="bg-fundo rounded-xl px-3 py-2 text-xs break-all mb-2 border border-borda">{qrUrl}</div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="chip" onClick={copiarLinkEvento}><Icon name={linkCopiado ? 'check' : 'paper-clip'} size={15} />{linkCopiado ? 'Copiado' : 'Copiar link'}</Button>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`${evento.nome} — ${new Date(evento.data + 'T12:00:00').toLocaleDateString('pt-BR')}. Bora? ${qrUrl}`)}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center min-h-[40px] rounded-xl px-3.5 text-sm font-medium bg-green-50 text-verde-escuro border border-green-200 hover:bg-green-100">WhatsApp</a>
                    <a href={`https://t.me/share/url?url=${encodeURIComponent(qrUrl)}&text=${encodeURIComponent(evento.nome)}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center min-h-[40px] rounded-xl px-3.5 text-sm font-medium bg-blue-50 text-azul border border-blue-200 hover:bg-blue-100">Telegram</a>
                    <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(qrUrl)}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center min-h-[40px] rounded-xl px-3.5 text-sm font-medium bg-blue-50 text-azul border border-blue-200 hover:bg-blue-100">Facebook</a>
                  </div>
                  <p className="text-xs text-texto-fraco mt-2">Página aberta, sem login. Mande no grupo para divulgar; o QR code aponta para ela.</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-noite mb-2">Capa do evento</h3>
                  {evento.imagem_url && <img src={resolveImg(evento.imagem_url)!} alt={`Capa de ${evento.nome}`} className="w-full max-w-xs rounded-xl border border-borda mb-2" />}
                  <label className="min-h-[40px] text-sm font-medium px-3.5 rounded-xl text-azul bg-blue-50 border border-blue-200 hover:bg-blue-100 inline-flex items-center gap-2 cursor-pointer focus-within:ring-2 focus-within:ring-azul/40">
                    <Icon name="upload" size={15} /> {evento.imagem_url ? 'Trocar capa' : 'Enviar capa'}
                    <input type="file" accept="image/*" onChange={enviarCapa} className="sr-only" />
                  </label>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-noite mb-2">Tipos de ingresso</h3>
                  <div className="space-y-1.5 mb-2">
                    {tipos.map(t => (
                      <div key={t.id} className="flex items-center justify-between gap-2 bg-fundo rounded-xl pl-3 pr-1 py-1 text-sm">
                        <span className="min-w-0 break-words">{t.nome} <span className="text-dourado font-medium ml-1">{brl(t.valor)}</span></span>
                        <Button variant="chip-danger" size="sm" onClick={() => removerTipo(t.id)} aria-label={`Remover ingresso ${t.nome}`}><Icon name="trash" size={15} /></Button>
                      </div>
                    ))}
                    {tipos.length === 0 && <p className="text-xs text-texto-fraco">Sem tipos cadastrados. O evento usa o valor por pessoa padrão.</p>}
                  </div>
                  <form onSubmit={adicionarTipo} className="grid grid-cols-[1fr_7rem_auto] gap-2">
                    <input value={novoTipoNome} onChange={e => setNovoTipoNome(e.target.value)} className={inputClass} placeholder="Ex.: Militar" aria-label="Nome do tipo de ingresso" />
                    <input type="number" step="0.01" inputMode="decimal" value={novoTipoValor} onChange={e => setNovoTipoValor(e.target.value)} className={inputClass} placeholder="Valor" aria-label="Valor do ingresso" />
                    <Button type="submit" size="sm" aria-label="Adicionar tipo de ingresso"><Icon name="plus" size={16} /></Button>
                  </form>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-noite mb-1">Check-in na portaria</h3>
                  {checkinStats
                    ? <p className="text-sm">Entraram <span className="font-display text-xl text-azul ml-1">{checkinStats.entraram}/{checkinStats.total_pagos}</span></p>
                    : <p className="text-xs text-texto-fraco">Sem pagamentos ainda.</p>}
                  <p className="text-xs text-texto-fraco mt-1">O check-in é feito pelos militares marcados como <b>recepcionista</b> em Usuários. Eles acessam pelo menu <b>Check-in</b>.</p>
                </div>
              </div>
            </Secao>
          </div>
        </div>
      </div>

      {/* Add participant modal */}
      <Modal open={modalPart} onClose={fecharModalPart} title="Adicionar participante">
        <form onSubmit={adicionarParticipante} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input value={partNome} onChange={e => setPartNome(e.target.value.toUpperCase())} className={`${inputClass} uppercase`} required placeholder="Trigrama ou nome" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">WhatsApp (opcional)</label>
            <input type="tel" value={partWhats} onChange={e => setPartWhats(e.target.value.replace(/\D/g, ''))} className={inputClass} placeholder="Ex.: 62999998888" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Consumo</label>
              <select value={partCategoria} onChange={e => setPartCategoria(e.target.value)} className={inputClass}>
                <option value="padrao">Padrão ({brl(evento?.valor_por_pessoa ?? 0)})</option>
                <option value="refri">Só refri</option>
                <option value="cerveja">Cerveja</option>
                <option value="chopp">Chopp</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor (R$)</label>
              <input type="number" step="0.01" value={partValor} onChange={e => setPartValor(e.target.value)} className={inputClass} placeholder={evento?.valor_por_pessoa.toFixed(2)} />
              <p className="text-xs text-texto-fraco mt-1">Deixe vazio para usar o valor padrão.</p>
            </div>
          </div>
          <Button type="submit" className="w-full">Adicionar participante</Button>
        </form>
      </Modal>

      {/* Consumir estoque modal */}
      <Modal open={modalEstoque} onClose={fecharModalEstoque} title="Usar item do estoque">
        <form onSubmit={consumirEstoque} className="space-y-4">
          <p className="text-xs text-texto-fraco">Tira a quantidade do estoque da Ximboca e registra como despesa de R$ 0 neste evento (o custo já foi pago na compra).</p>
          {estoqueLista.length === 0 ? (
            <p className="text-sm text-texto-fraco text-center py-4">Nenhum item no estoque. Cadastre em Ximboca, Estoque.</p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Item</label>
                <select value={estoqueId} onChange={e => setEstoqueId(e.target.value)} className={inputClass} required>
                  <option value="">Selecione...</option>
                  {estoqueLista.map(it => (
                    <option key={it.id} value={it.id}>{it.nome} — {it.quantidade} {it.unidade} disponível</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Quantidade a consumir</label>
                <input type="number" step="0.01" min="0.01" value={estoqueQtd} onChange={e => setEstoqueQtd(e.target.value)} className={inputClass} required />
              </div>
              <Button type="submit" className="w-full" disabled={!estoqueId || !estoqueQtd}>Usar do estoque</Button>
            </>
          )}
        </form>
      </Modal>

      {/* Edit event modal */}
      <Modal open={modalEdit} onClose={fecharModalEdit} title="Editar evento" size="lg">
        <form onSubmit={salvarEdicao} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input value={edNome} onChange={e => setEdNome(e.target.value)} className={inputClass} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Data</label>
              <input type="date" value={edData} onChange={e => setEdData(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor por pessoa (R$)</label>
              <input type="number" step="0.01" value={edValor} onChange={e => setEdValor(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1 text-sm font-medium mb-1"><Icon name="beer" size={14} /> Valor com cerveja</label>
              <input type="number" step="0.01" value={edCerveja} onChange={e => setEdCerveja(e.target.value)} className={inputClass} placeholder="Vazio = não oferece" />
            </div>
            <div>
              <label className="flex items-center gap-1 text-sm font-medium mb-1"><Icon name="soda" size={14} /> Valor com refri</label>
              <input type="number" step="0.01" value={edRefri} onChange={e => setEdRefri(e.target.value)} className={inputClass} placeholder="Vazio = não oferece" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <input value={edDescricao} onChange={e => setEdDescricao(e.target.value)} className={inputClass} />
          </div>

          <div className="border-t border-borda pt-3 space-y-3">
            <p className="text-sm font-semibold text-noite">PIX do responsável <span className="font-normal text-texto-fraco">(opcional)</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select value={edPixTipo} onChange={e => setEdPixTipo(e.target.value)} className={inputClass}>
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="aleatoria">Aleatória</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Chave PIX</label>
                <input value={edPixChave} onChange={e => setEdPixChave(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nome do recebedor</label>
              <input value={edPixNome} onChange={e => setEdPixNome(e.target.value)} className={inputClass} placeholder="Ex.: JOAO SILVA" />
              <p className="text-xs text-texto-fraco mt-1">Sem acento, até 25 letras.</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp (comprovante)</label>
              <input type="tel" value={edPixWhatsapp} onChange={e => setEdPixWhatsapp(e.target.value.replace(/\D/g, ''))} className={inputClass} placeholder="Ex.: 62999998888" />
            </div>
          </div>

          <Button type="submit" className="w-full">Salvar alterações</Button>
        </form>
      </Modal>

      {/* QR Code modal */}
      <Modal open={modalQR} onClose={fecharModalQR} title="QR code do evento">
        <div className="space-y-4 text-center">
          <p className="text-sm text-texto-fraco">Compartilhe para o pessoal se inscrever pela página pública.</p>
          <div ref={qrRef} className="inline-block bg-white p-4 rounded-xl border border-borda">
            <QRCodeCanvas value={qrUrl} size={240} level="M" includeMargin style={{ maxWidth: '100%', height: 'auto' }} />
          </div>
          <div className="text-xs text-texto-fraco break-all">{qrUrl}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button onClick={baixarQR}><Icon name="download" size={16} />Baixar imagem</Button>
            <Button variant="ghost" onClick={() => window.print()}><Icon name="printer" size={16} />Imprimir</Button>
          </div>
        </div>
      </Modal>

      {/* Add expense modal */}
      <Modal open={modalDesp} onClose={fecharModalDesp} title="Adicionar despesa">
        <form onSubmit={adicionarDespesa} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <input value={despDescricao} onChange={e => setDespDescricao(e.target.value)} className={inputClass} required placeholder="Ex.: 10 kg de picanha, carvão" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Valor (R$)</label>
              <input type="number" step="0.01" inputMode="decimal" value={despValor} onChange={e => setDespValor(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <select value={despCategoria} onChange={e => setDespCategoria(e.target.value)} className={inputClass}>
                <option value="carne">Carne</option>
                <option value="bebida">Bebida</option>
                <option value="carvao">Carvão</option>
                <option value="descartavel">Descartável</option>
                <option value="tempero">Tempero</option>
                <option value="geral">Geral</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Quantidade</label>
              <input type="number" step="0.01" value={despQtd} onChange={e => setDespQtd(e.target.value)} className={inputClass} placeholder="Ex.: 10" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unidade</label>
              <select value={despUnidade} onChange={e => setDespUnidade(e.target.value)} className={inputClass}>
                <option value="">-</option>
                <option value="kg">kg</option>
                <option value="un">un</option>
                <option value="L">L</option>
                <option value="fardo">fardo</option>
                <option value="pct">pct</option>
                <option value="cx">cx</option>
                <option value="saco">saco</option>
              </select>
            </div>
          </div>
          <Button type="submit" className="w-full">Adicionar despesa</Button>
        </form>
      </Modal>
    </AppLayout>
  );
}
