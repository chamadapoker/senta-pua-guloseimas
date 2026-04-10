import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminLayout } from '../../../components/Layout';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { api } from '../../../services/api';
import { gerarCobrancaXimbocaPDF } from '../../../services/pdf';

interface Participante { id: string; nome: string; whatsapp: string | null; status: string; paid_at: string | null; valor_individual: number | null; categoria_consumo: string; }
interface Despesa { id: string; descricao: string; valor: number; categoria: string; quantidade: number | null; unidade: string | null; created_at: string; }
interface Evento { id: string; nome: string; data: string; valor_por_pessoa: number; descricao: string; status: string; }

export function XimbocaEvento() {
  const { id } = useParams<{ id: string }>();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);

  // Add participant
  const [modalPart, setModalPart] = useState(false);
  const [partNome, setPartNome] = useState('');
  const [partWhats, setPartWhats] = useState('');
  const [partCategoria, setPartCategoria] = useState('padrao');
  const [partValor, setPartValor] = useState('');

  // Add expense
  const [modalDesp, setModalDesp] = useState(false);
  const [despDescricao, setDespDescricao] = useState('');
  const [despValor, setDespValor] = useState('');
  const [despCategoria, setDespCategoria] = useState('geral');
  const [despQtd, setDespQtd] = useState('');
  const [despUnidade, setDespUnidade] = useState('');

  const carregar = () => {
    api.get<{ evento: Evento; participantes: Participante[]; despesas: Despesa[] }>(`/api/ximboca/eventos/${id}`).then(d => {
      setEvento(d.evento);
      setParticipantes(d.participantes);
      setDespesas(d.despesas);
    });
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
    if (!confirm('Remover participante?')) return;
    await api.delete(`/api/ximboca/participantes/${pid}`);
    carregar();
  };

  const adicionarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/api/ximboca/eventos/${id}/despesas`, { descricao: despDescricao, valor: parseFloat(despValor), categoria: despCategoria, quantidade: parseFloat(despQtd) || null, unidade: despUnidade || null });
    setModalDesp(false); setDespDescricao(''); setDespValor(''); setDespCategoria('geral'); setDespQtd(''); setDespUnidade('');
    carregar();
  };

  const removerDespesa = async (did: string) => {
    if (!confirm('Remover despesa?')) return;
    await api.delete(`/api/ximboca/despesas/${did}`);
    carregar();
  };

  if (!evento) return <AdminLayout><div className="text-center py-10 text-texto-fraco">Carregando...</div></AdminLayout>;

  const valorEfetivo = (p: Participante) => p.valor_individual ?? evento.valor_por_pessoa;
  const totalPagos = participantes.filter(p => p.status === 'pago').length;
  const totalArrecadado = participantes.filter(p => p.status === 'pago').reduce((a, p) => a + valorEfetivo(p), 0);
  const totalDespesas = despesas.reduce((a, d) => a + d.valor, 0);
  const saldo = totalArrecadado - totalDespesas;

  return (
    <AdminLayout>
      <div className="flex items-center gap-3 mb-2">
        <Link to="/admin/ximboca/eventos" className="text-texto-fraco hover:text-texto">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="font-display text-2xl text-azul tracking-wider">{evento.nome}</h1>
        <Badge variant={evento.status === 'aberto' ? 'success' : 'warning'}>{evento.status}</Badge>
      </div>
      <p className="text-sm text-texto-fraco mb-5">{new Date(evento.data + 'T12:00:00').toLocaleDateString('pt-BR')} | R$ {evento.valor_por_pessoa.toFixed(2)}/pessoa</p>

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

      {/* Participants */}
      <div className="bg-white rounded-xl border border-borda shadow-sm mb-6">
        <div className="bg-azul px-5 py-3 flex items-center justify-between rounded-t-xl">
          <h2 className="text-sm font-medium text-white uppercase tracking-wider">Participantes</h2>
          <Button size="sm" onClick={() => setModalPart(true)}>+ Adicionar</Button>
        </div>
        <div className="divide-y divide-borda/50">
          {participantes.map(p => (
            <div key={p.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
              <div>
                <span className="font-medium text-texto text-sm">{p.nome}</span>
                <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-fundo text-texto-fraco">{p.categoria_consumo}</span>
                <span className="text-xs text-texto-fraco ml-2">R$ {valorEfetivo(p).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                {p.status === 'pago' ? (
                  <Badge variant="success">Pago</Badge>
                ) : (
                  <>
                    <a href={`https://wa.me/${p.whatsapp ? '55' + p.whatsapp : ''}?text=${encodeURIComponent(`Opa! Ximboca "${evento.nome}" (${new Date(evento.data + 'T12:00:00').toLocaleDateString('pt-BR')})\nSeu valor: R$ ${valorEfetivo(p).toFixed(2)}\nFavor regularizar o pagamento!`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className={`text-xs font-medium px-2 py-1 rounded-lg text-verde bg-green-50 border border-green-200 hover:bg-green-100 ${!p.whatsapp ? 'opacity-50 pointer-events-none' : ''}`}>
                      Cobrar
                    </a>
                    <button onClick={() => cobrarParticipante(p)} className="text-xs font-medium px-2 py-1 rounded-lg text-azul bg-blue-50 border border-blue-200 hover:bg-blue-100">PDF</button>
                    <button onClick={() => marcarPago(p.id)} className="text-xs font-medium px-2 py-1 rounded-lg text-azul bg-blue-50 border border-blue-200 hover:bg-blue-100">Pagar</button>
                  </>
                )}
                <button onClick={() => removerParticipante(p.id)} className="text-xs font-medium px-1.5 py-1 rounded-lg text-vermelho bg-red-50 border border-red-200 hover:bg-red-100">X</button>
              </div>
            </div>
          ))}
          {participantes.length === 0 && <div className="text-center py-6 text-texto-fraco text-sm">Nenhum participante</div>}
        </div>
      </div>

      {/* Expenses */}
      <div className="bg-white rounded-xl border border-borda shadow-sm">
        <div className="bg-azul px-5 py-3 flex items-center justify-between rounded-t-xl">
          <h2 className="text-sm font-medium text-white uppercase tracking-wider">Despesas</h2>
          <Button size="sm" onClick={() => setModalDesp(true)}>+ Adicionar</Button>
        </div>
        <div className="divide-y divide-borda/50">
          {despesas.map(d => (
            <div key={d.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <span className="text-sm text-texto">{d.descricao}</span>
                {d.quantidade && <span className="text-xs text-texto-fraco ml-1">({d.quantidade} {d.unidade || 'un'})</span>}
                <span className="text-[10px] text-texto-fraco ml-2 bg-fundo px-1.5 py-0.5 rounded">{d.categoria}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-vermelho text-sm">R$ {d.valor.toFixed(2)}</span>
                <button onClick={() => removerDespesa(d.id)} className="text-xs font-medium px-2 py-1 rounded-lg text-vermelho bg-red-50 border border-red-200 hover:bg-red-100">X</button>
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
            <input type="tel" value={partWhats} onChange={e => setPartWhats(e.target.value.replace(/\D/g, ''))} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" placeholder="Ex: 62999998888" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Consumo</label>
              <select value={partCategoria} onChange={e => setPartCategoria(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto">
                <option value="padrao">Padrao (R$ {evento?.valor_por_pessoa.toFixed(2)})</option>
                <option value="refri">So refri</option>
                <option value="cerveja">Cerveja</option>
                <option value="chopp">Chopp</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor (R$)</label>
              <input type="number" step="0.01" value={partValor} onChange={e => setPartValor(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" placeholder={evento?.valor_por_pessoa.toFixed(2)} />
              <p className="text-xs text-texto-fraco mt-0.5">Deixe vazio para valor padrao</p>
            </div>
          </div>
          <Button type="submit" className="w-full">Adicionar</Button>
        </form>
      </Modal>

      {/* Add expense modal */}
      <Modal open={modalDesp} onClose={() => setModalDesp(false)} title="Adicionar Despesa">
        <form onSubmit={adicionarDespesa} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Descricao</label>
            <input value={despDescricao} onChange={e => setDespDescricao(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" required placeholder="Ex: 10kg Picanha, Carvao..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Valor (R$)</label>
              <input type="number" step="0.01" value={despValor} onChange={e => setDespValor(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <select value={despCategoria} onChange={e => setDespCategoria(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto">
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
              <input type="number" step="0.01" value={despQtd} onChange={e => setDespQtd(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto" placeholder="Ex: 10" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Unidade</label>
              <select value={despUnidade} onChange={e => setDespUnidade(e.target.value)} className="w-full bg-white border border-borda rounded-lg px-3 py-2 text-texto">
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
    </AdminLayout>
  );
}
