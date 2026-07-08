import { useEffect, useRef, useState } from 'react';
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
import { gerarCobrancaXimbocaPDF } from '../../../services/pdf';
import { useConfirm } from '../../../hooks/useConfirm';
import { useToast } from '../../../hooks/useToast';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';
function resolveImg(url: string | null): string | null {
  return url ? (url.startsWith('/api') ? `${WORKER_URL}${url}` : url) : null;
}

interface Participante { id: string; nome: string; whatsapp: string | null; status: string; paid_at: string | null; valor_individual: number | null; categoria_consumo: string; }
interface Despesa { id: string; descricao: string; valor: number; categoria: string; quantidade: number | null; unidade: string | null; created_at: string; }
interface EstoqueItem { id: string; nome: string; quantidade: number; unidade: string; }
interface IngressoTipo { id: string; evento_id: string; nome: string; valor: number; ordem: number; }
interface Evento { id: string; nome: string; data: string; valor_por_pessoa: number; valor_cerveja: number | null; valor_refri: number | null; descricao: string; status: string; pix_chave: string | null; pix_tipo: string | null; pix_nome: string | null; pix_whatsapp: string | null; imagem_url: string | null; }

export function XimbocaEvento() {
  const { id } = useParams<{ id: string }>();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);

  // Add participant
  const [modalPart, setModalPart] = useState(false);
  const [partNome, setPartNome] = useState('');
  const [partWhats, setPartWhats] = useState('');
  const [partCategoria, setPartCategoria] = useState('padrao');
  const [partValor, setPartValor] = useState('');

  // Edit event
  const [modalEdit, setModalEdit] = useState(false);
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
  const qrRef = useRef<HTMLDivElement>(null);

  // Consumir estoque
  const [modalEstoque, setModalEstoque] = useState(false);
  const [estoqueLista, setEstoqueLista] = useState<EstoqueItem[]>([]);
  const [estoqueId, setEstoqueId] = useState('');
  const [estoqueQtd, setEstoqueQtd] = useState('');

  // Add expense
  const [modalDesp, setModalDesp] = useState(false);
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

  const carregar = () => {
    api.get<{ evento: Evento; participantes: Participante[]; despesas: Despesa[]; tipos: IngressoTipo[] }>(`/api/ximboca/eventos/${id}`).then(d => {
      setEvento(d.evento);
      setParticipantes(d.participantes);
      setDespesas(d.despesas);
      setTipos(d.tipos || []);
    });
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
    await api.put(`/api/ximboca/participantes/${pid}/pagar`, {});
    carregar();
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

  const qrUrl = typeof window !== 'undefined' ? `${window.location.origin}/ximboca` : '';

  if (!evento) return <AppLayout><Loading /></AppLayout>;

  const valorEfetivo = (p: Participante) => p.valor_individual ?? evento.valor_por_pessoa;
  const totalPagos = participantes.filter(p => p.status === 'pago').length;
  const totalArrecadado = participantes.filter(p => p.status === 'pago').reduce((a, p) => a + valorEfetivo(p), 0);
  const totalDespesas = despesas.reduce((a, d) => a + d.valor, 0);
  const saldo = totalArrecadado - totalDespesas;

  return (
    <AppLayout>
      <BackButton to="/admin/ximboca/eventos" className="mb-3" />
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <h1 className="font-display text-2xl text-azul tracking-wider">{evento.nome}</h1>
        <Badge variant={evento.status === 'aberto' ? 'success' : 'warning'}>{evento.status}</Badge>
      </div>
      <p className="text-sm text-texto-fraco mb-3">{new Date(evento.data + 'T12:00:00').toLocaleDateString('pt-BR')} | R$ {evento.valor_por_pessoa.toFixed(2)}/pessoa</p>
      <div className="flex gap-2 flex-wrap mb-5">
        <Button variant="chip-primary" size="xs" onClick={abrirEdicao} className="inline-flex items-center gap-1.5"><Icon name="pencil" size={12} /> Editar Evento</Button>
        <Button variant="chip-primary" size="xs" onClick={() => setModalQR(true)} className="inline-flex items-center gap-1.5"><Icon name="qr-code" size={12} /> QR Code</Button>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl p-3 border border-borda text-center">
          <div className="text-xs text-texto-fraco">Participantes</div>
          <div className="font-display text-lg text-azul">{totalPagos}/{participantes.length}</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-borda text-center">
          <div className="text-xs text-texto-fraco">Arrecadado</div>
          <div className="font-display text-lg text-verde">R$ {totalArrecadado.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-borda text-center">
          <div className="text-xs text-texto-fraco">Gasto</div>
          <div className="font-display text-lg text-vermelho">R$ {totalDespesas.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-xl p-3 border border-borda text-center">
          <div className="text-xs text-texto-fraco">Saldo</div>
          <div className={`font-display text-lg ${saldo >= 0 ? 'text-verde' : 'text-vermelho'}`}>R$ {saldo.toFixed(2)}</div>
        </div>
      </div>

      {/* Ingressos e Portaria */}
      <div className="bg-white rounded-xl border border-borda shadow-sm mb-6">
        <div className="bg-azul px-5 py-3 rounded-t-xl">
          <h2 className="text-sm font-medium text-white uppercase tracking-wider">Ingressos & Portaria</h2>
        </div>
        <div className="p-4 space-y-5">
          <div>
            <div className="text-xs font-medium text-texto uppercase tracking-wider mb-2">Capa do evento</div>
            {evento.imagem_url && <img src={resolveImg(evento.imagem_url)!} alt="capa" className="w-full max-w-xs rounded-lg border border-borda mb-2" />}
            <label className="text-xs font-medium px-3 py-1.5 rounded-lg text-azul bg-blue-50 border border-blue-200 hover:bg-blue-100 inline-flex items-center gap-1.5 cursor-pointer">
              <Icon name="upload" size={12} /> {evento.imagem_url ? 'Trocar capa' : 'Enviar capa'}
              <input type="file" accept="image/*" onChange={enviarCapa} className="hidden" />
            </label>
          </div>

          <div>
            <div className="text-xs font-medium text-texto uppercase tracking-wider mb-2">Tipos de ingresso</div>
            <div className="space-y-1 mb-2">
              {tipos.map(t => (
                <div key={t.id} className="flex items-center justify-between bg-fundo rounded-lg px-3 py-2 text-sm">
                  <span>{t.nome} — <span className="font-medium">R$ {t.valor.toFixed(2)}</span></span>
                  <Button variant="chip-danger" size="xs" onClick={() => removerTipo(t.id)} aria-label="Excluir"><Icon name="trash" size={14} /></Button>
                </div>
              ))}
              {tipos.length === 0 && <p className="text-xs text-texto-fraco">Sem tipos — o evento usa o valor por pessoa padrão.</p>}
            </div>
            <form onSubmit={adicionarTipo} className="flex gap-2">
              <input value={novoTipoNome} onChange={e => setNovoTipoNome(e.target.value)} className={inputClass} placeholder="Ex: Militar" />
              <input type="number" step="0.01" value={novoTipoValor} onChange={e => setNovoTipoValor(e.target.value)} className={inputClass} placeholder="Valor" />
              <Button type="submit" size="sm">+ Tipo</Button>
            </form>
          </div>

          <div>
            <div className="text-xs font-medium text-texto uppercase tracking-wider mb-1">Check-in na portaria</div>
            {checkinStats
              ? <p className="text-sm">Entraram: <span className="font-display text-azul">{checkinStats.entraram}/{checkinStats.total_pagos}</span></p>
              : <p className="text-xs text-texto-fraco">Sem pagamentos ainda.</p>}
            <p className="text-[11px] text-texto-fraco mt-1">Quem faz o check-in são os militares marcados como <b>recepcionista</b> em Admin → Usuários. Eles acessam pelo menu <b>Check-in</b>.</p>
          </div>
        </div>
      </div>

      {/* Participants */}
      <div className="bg-white rounded-xl border border-borda shadow-sm mb-6">
        <div className="bg-azul px-5 py-3 flex items-center justify-between rounded-t-xl">
          <h2 className="text-sm font-medium text-white uppercase tracking-wider">Participantes</h2>
          <Button size="sm" onClick={() => setModalPart(true)}>+ Adicionar</Button>
        </div>
        <div className="divide-y divide-borda/50 list-zebra">
          {participantes.map(p => (
            <div key={p.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
              <div>
                <span className="font-medium text-texto text-sm">{p.nome}</span>
                <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-fundo text-texto-fraco">{p.categoria_consumo}</span>
                <span className="text-xs text-texto-fraco ml-2">R$ {valorEfetivo(p).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {p.status === 'pago' ? (
                  <>
                    <Badge variant="success">Pago</Badge>
                    <Button variant="chip-danger" size="xs" onClick={() => removerParticipante(p.id)} aria-label="Excluir"><Icon name="trash" size={14} /></Button>
                  </>
                ) : (
                  <>
                    <Button variant="chip-success" size="xs" onClick={() => marcarPago(p.id)}>Pagar</Button>
                    <Menu items={[
                      { label: 'Cobrar (WhatsApp)', icon: 'device-phone', disabled: !p.whatsapp, onClick: () => window.open(`https://wa.me/${p.whatsapp ? '55' + p.whatsapp : ''}?text=${encodeURIComponent(`Opa! Ximboca "${evento.nome}" (${new Date(evento.data + 'T12:00:00').toLocaleDateString('pt-BR')})\nSeu valor: R$ ${valorEfetivo(p).toFixed(2)}\nFavor regularizar o pagamento!`)}`, '_blank') },
                      { label: 'Gerar PDF', icon: 'document', onClick: () => cobrarParticipante(p) },
                      { label: 'Excluir', icon: 'trash', danger: true, onClick: () => removerParticipante(p.id) },
                    ]} />
                  </>
                )}
              </div>
            </div>
          ))}
          {participantes.length === 0 && <div className="text-center py-6 text-texto-fraco text-sm">Nenhum participante</div>}
        </div>
      </div>

      {/* Expenses */}
      <div className="bg-white rounded-xl border border-borda shadow-sm">
        <div className="bg-azul px-5 py-3 flex items-center justify-between rounded-t-xl flex-wrap gap-2">
          <h2 className="text-sm font-medium text-white uppercase tracking-wider">Despesas</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={abrirEstoque}><span className="inline-flex items-center gap-1.5"><Icon name="archive" size={12} /> Do Estoque</span></Button>
            <Button size="sm" onClick={() => setModalDesp(true)}>+ Adicionar</Button>
          </div>
        </div>
        <div className="divide-y divide-borda/50 list-zebra">
          {despesas.map(d => (
            <div key={d.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <span className="text-sm text-texto">{d.descricao}</span>
                {d.quantidade && <span className="text-xs text-texto-fraco ml-1">({d.quantidade} {d.unidade || 'un'})</span>}
                <span className="text-[10px] text-texto-fraco ml-2 bg-fundo px-1.5 py-0.5 rounded">{d.categoria}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-vermelho text-sm">R$ {d.valor.toFixed(2)}</span>
                <Button variant="chip-danger" size="xs" onClick={() => removerDespesa(d.id)} aria-label="Excluir"><Icon name="trash" size={14} /></Button>
              </div>
            </div>
          ))}
          {despesas.length === 0 && <div className="text-center py-6 text-texto-fraco text-sm">Nenhuma despesa</div>}
        </div>
      </div>

      {/* Add participant modal */}
      <Modal open={modalPart} onClose={() => setModalPart(false)} title="Adicionar Participante">
        <form onSubmit={adicionarParticipante} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input value={partNome} onChange={e => setPartNome(e.target.value.toUpperCase())} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto uppercase" required placeholder="Trigrama ou nome" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">WhatsApp (opcional)</label>
            <input type="tel" value={partWhats} onChange={e => setPartWhats(e.target.value.replace(/\D/g, ''))} className={inputClass} placeholder="Ex: 62999998888" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Consumo</label>
              <select value={partCategoria} onChange={e => setPartCategoria(e.target.value)} className={inputClass}>
                <option value="padrao">Padrao (R$ {evento?.valor_por_pessoa.toFixed(2)})</option>
                <option value="refri">So refri</option>
                <option value="cerveja">Cerveja</option>
                <option value="chopp">Chopp</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor (R$)</label>
              <input type="number" step="0.01" value={partValor} onChange={e => setPartValor(e.target.value)} className={inputClass} placeholder={evento?.valor_por_pessoa.toFixed(2)} />
              <p className="text-xs text-texto-fraco mt-0.5">Deixe vazio para valor padrao</p>
            </div>
          </div>
          <Button type="submit" className="w-full">Adicionar</Button>
        </form>
      </Modal>

      {/* Consumir estoque modal */}
      <Modal open={modalEstoque} onClose={() => setModalEstoque(false)} title="Consumir do Estoque">
        <form onSubmit={consumirEstoque} className="space-y-4">
          <p className="text-xs text-texto-fraco">Debita a quantidade do estoque central da Ximboca e registra como despesa neste evento (R$ 0 — custo já foi pago ao adquirir).</p>
          {estoqueLista.length === 0 ? (
            <p className="text-sm text-texto-fraco text-center py-4">Nenhum item no estoque. Cadastre em Ximboca → Estoque.</p>
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
              <Button type="submit" className="w-full" disabled={!estoqueId || !estoqueQtd}>Confirmar Consumo</Button>
            </>
          )}
        </form>
      </Modal>

      {/* Edit event modal */}
      <Modal open={modalEdit} onClose={() => setModalEdit(false)} title="Editar Evento">
        <form onSubmit={salvarEdicao} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nome</label>
            <input value={edNome} onChange={e => setEdNome(e.target.value)} className={inputClass} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Data</label>
              <input type="date" value={edData} onChange={e => setEdData(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">R$/pessoa</label>
              <input type="number" step="0.01" value={edValor} onChange={e => setEdValor(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1 text-sm font-medium mb-1"><Icon name="beer" size={14} /> Cerveja</label>
              <input type="number" step="0.01" value={edCerveja} onChange={e => setEdCerveja(e.target.value)} className={inputClass} placeholder="Vazio = não oferece" />
            </div>
            <div>
              <label className="flex items-center gap-1 text-sm font-medium mb-1"><Icon name="soda" size={14} /> Refri</label>
              <input type="number" step="0.01" value={edRefri} onChange={e => setEdRefri(e.target.value)} className={inputClass} placeholder="Vazio = não oferece" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <input value={edDescricao} onChange={e => setEdDescricao(e.target.value)} className={inputClass} />
          </div>

          <div className="border-t border-borda pt-3 space-y-3">
            <p className="text-xs font-medium text-texto uppercase tracking-wider">PIX do Responsável (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
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
              <input value={edPixNome} onChange={e => setEdPixNome(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp (comprovante)</label>
              <input type="tel" value={edPixWhatsapp} onChange={e => setEdPixWhatsapp(e.target.value.replace(/\D/g, ''))} className={inputClass} placeholder="Ex: 62999998888" />
            </div>
          </div>

          <Button type="submit" className="w-full">Salvar Alterações</Button>
        </form>
      </Modal>

      {/* QR Code modal */}
      <Modal open={modalQR} onClose={() => setModalQR(false)} title="QR Code do Evento">
        <div className="space-y-4 text-center">
          <p className="text-sm text-texto-fraco">Compartilhe com os participantes para se inscreverem</p>
          <div ref={qrRef} className="inline-block bg-white p-4 rounded-xl border border-borda">
            <QRCodeCanvas value={qrUrl} size={240} level="M" includeMargin />
          </div>
          <div className="text-xs text-texto-fraco break-all">{qrUrl}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={baixarQR}><span className="inline-flex items-center gap-1.5"><Icon name="download" size={14} /> Baixar PNG</span></Button>
            <Button variant="outline" onClick={() => window.print()}><span className="inline-flex items-center gap-1.5"><Icon name="printer" size={14} /> Imprimir</span></Button>
          </div>
        </div>
      </Modal>

      {/* Add expense modal */}
      <Modal open={modalDesp} onClose={() => setModalDesp(false)} title="Adicionar Despesa">
        <form onSubmit={adicionarDespesa} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Descricao</label>
            <input value={despDescricao} onChange={e => setDespDescricao(e.target.value)} className={inputClass} required placeholder="Ex: 10kg Picanha, Carvao..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Valor (R$)</label>
              <input type="number" step="0.01" value={despValor} onChange={e => setDespValor(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <select value={despCategoria} onChange={e => setDespCategoria(e.target.value)} className={inputClass}>
                <option value="carne">Carne</option>
                <option value="bebida">Bebida</option>
                <option value="carvao">Carvao</option>
                <option value="descartavel">Descartavel</option>
                <option value="tempero">Tempero</option>
                <option value="geral">Geral</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Quantidade</label>
              <input type="number" step="0.01" value={despQtd} onChange={e => setDespQtd(e.target.value)} className={inputClass} placeholder="Ex: 10" />
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
          <Button type="submit" className="w-full">Adicionar</Button>
        </form>
      </Modal>
    </AppLayout>
  );
}
