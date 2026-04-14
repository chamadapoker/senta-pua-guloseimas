import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import type { Pedido } from '../../types';

interface Resp {
  items: Pedido[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE = 50;

export function Pedidos() {
  const [data, setData] = useState<Resp | null>(null);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [q, setQ] = useState('');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [offset, setOffset] = useState(0);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const carregar = () => {
    const qs = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (filtroStatus) qs.set('status', filtroStatus);
    if (q.trim()) qs.set('q', q.trim());
    if (de) qs.set('de', de);
    if (ate) qs.set('ate', ate);
    api.get<Resp>(`/api/pedidos?${qs}`).then(setData);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [filtroStatus, offset]);

  const pedidos = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE);
  const currentPage = Math.floor(offset / PAGE) + 1;

  const trocarStatus = (s: string) => { setFiltroStatus(s); setOffset(0); };
  const aplicarFiltros = () => { setOffset(0); carregar(); };
  const limparFiltros = () => { setQ(''); setDe(''); setAte(''); setOffset(0); setTimeout(carregar, 0); };

  const marcarPago = async (pedidoId: string) => {
    await api.put(`/api/pedidos/${pedidoId}/pagar`, {});
    carregar();
  };

  const marcarLotePago = async () => {
    await Promise.all([...selecionados].map(id => api.put(`/api/pedidos/${id}/pagar`, {})));
    setSelecionados(new Set());
    carregar();
  };

  const excluirPedido = async (pedidoId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este pedido? Essa ação não pode ser desfeita.')) return;
    try {
      await api.delete(`/api/pedidos/${pedidoId}`);
      carregar();
    } catch (e) {
      alert('Erro ao excluir: ' + (e instanceof Error ? e.message : 'tente novamente'));
    }
  };

  const toggleSelecionado = (id: string) => {
    const novo = new Set(selecionados);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setSelecionados(novo);
  };

  const statusBadge = (status: string) => {
    if (status === 'pago') return <Badge variant="success">Pago</Badge>;
    if (status === 'fiado') return <Badge variant="danger">Fiado</Badge>;
    return <Badge variant="warning">Pendente</Badge>;
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h1 className="font-display text-2xl text-azul tracking-wider">PEDIDOS</h1>
        <div className="flex gap-1">
          {['', 'pendente', 'fiado', 'pago'].map((s) => (
            <button
              key={s}
              onClick={() => trocarStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filtroStatus === s ? 'bg-vermelho text-white' : 'bg-white text-texto-fraco border border-borda hover:text-texto'
              }`}
            >
              {s || 'Todos'}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={e => { e.preventDefault(); aplicarFiltros(); }} className="bg-white rounded-xl border border-borda p-3 mb-4 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-[10px] text-texto-fraco uppercase mb-1">Buscar trigrama</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Ex: HÖE" className="w-full bg-white border border-borda rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[10px] text-texto-fraco uppercase mb-1">De</label>
          <input type="date" value={de} onChange={e => setDe(e.target.value)} className="bg-white border border-borda rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-[10px] text-texto-fraco uppercase mb-1">Até</label>
          <input type="date" value={ate} onChange={e => setAte(e.target.value)} className="bg-white border border-borda rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <button type="submit" className="px-4 py-1.5 rounded-lg bg-azul text-white text-sm font-medium">Aplicar</button>
        <button type="button" onClick={limparFiltros} className="px-3 py-1.5 rounded-lg bg-fundo border border-borda text-sm">Limpar</button>
      </form>

      <div className="text-xs text-texto-fraco mb-2">
        {total} pedido(s) · Página {currentPage}/{totalPages || 1}
      </div>

      {selecionados.size > 0 && (
        <div className="bg-azul rounded-xl p-3 mb-4 flex items-center justify-between border border-azul-claro/30">
          <span className="text-white text-sm">{selecionados.size} selecionado(s)</span>
          <Button size="sm" variant="danger" onClick={marcarLotePago}>Marcar como pago</Button>
        </div>
      )}

      <div className="bg-white rounded-xl overflow-hidden border border-borda shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-azul">
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3 text-left text-xs text-white uppercase tracking-wider">Data</th>
                <th className="px-3 py-3 text-left text-xs text-white uppercase tracking-wider">Militar</th>
                <th className="px-3 py-3 text-left text-xs text-white uppercase tracking-wider hidden sm:table-cell">Itens</th>
                <th className="px-3 py-3 text-right text-xs text-white uppercase tracking-wider">Total</th>
                <th className="px-3 py-3 text-center text-xs text-white uppercase tracking-wider hidden md:table-cell">Método</th>
                <th className="px-3 py-3 text-center text-xs text-white uppercase tracking-wider">Status</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className="border-b border-borda/50 hover:bg-fundo transition-colors">
                  <td className="px-3 py-3">
                    {p.status !== 'pago' && (
                      <input
                        type="checkbox"
                        checked={selecionados.has(p.id)}
                        onChange={() => toggleSelecionado(p.id)}
                        className="accent-vermelho"
                      />
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-texto-fraco whitespace-nowrap">
                    {new Date(p.created_at + 'Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </td>
                  <td className="px-3 py-3 font-medium text-texto">{p.nome_guerra}</td>
                  <td className="px-3 py-3 text-xs text-texto-fraco max-w-[150px] truncate hidden sm:table-cell">
                    {p.itens_resumo}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-dourado font-display tracking-wide">R$ {p.total.toFixed(2)}</td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      p.metodo_pagamento === 'pix' ? 'bg-blue-50 text-azul' :
                      p.metodo_pagamento === 'dinheiro' ? 'bg-green-50 text-verde-escuro' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      {p.metodo_pagamento === 'pix' ? '💠 PIX' : p.metodo_pagamento === 'dinheiro' ? '💵 CASH' : '📝 FIADO'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">{statusBadge(p.status)}</td>
                  <td className="px-3 py-3 flex items-center gap-2">
                    {p.status !== 'pago' && (
                      <button onClick={() => marcarPago(p.id)} className="text-verde text-xs hover:underline">
                        Pagar
                      </button>
                    )}
                    <button onClick={() => excluirPedido(p.id)} className="text-vermelho text-xs hover:underline">
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pedidos.length === 0 && (
          <div className="text-center py-10 text-texto-fraco">Nenhum pedido</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} className="px-3 py-1.5 rounded-lg bg-white border border-borda text-sm disabled:opacity-40">← Anterior</button>
          <span className="text-sm text-texto-fraco">{currentPage}/{totalPages}</span>
          <button disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)} className="px-3 py-1.5 rounded-lg bg-white border border-borda text-sm disabled:opacity-40">Próxima →</button>
        </div>
      )}
    </AppLayout>
  );
}
