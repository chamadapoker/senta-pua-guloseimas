import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/ui/Loading';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { inputClass } from '../../components/ui/Field';
import { api } from '../../services/api';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';
import { useAcao } from '../../hooks/useAcao';
import type { Pedido } from '../../types';

interface Resp {
  items: Pedido[];
  total: number;
  limit: number;
  offset: number;
}

const PAGE = 50;

const STATUS_OPCOES = [
  { id: '', label: 'Todos' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'fiado', label: 'Fiado' },
  { id: 'pago', label: 'Pagos' },
];

const brl = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (d: string) => new Date(d.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

const STATUS_VALIDOS = ['', 'pendente', 'fiado', 'pago'];
const dataValida = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');

interface Filtros {
  status: string;
  q: string;
  de: string;
  ate: string;
  offset: number;
}

export function Pedidos() {
  const [searchParams] = useSearchParams();
  // Filtros iniciais vêm da URL (ex: /admin/pedidos?status=pendente vindo do dashboard)
  const [filtros, setFiltros] = useState<Filtros>(() => {
    const st = searchParams.get('status') || '';
    return {
      status: STATUS_VALIDOS.includes(st) ? st : '',
      q: searchParams.get('q') || searchParams.get('busca') || '',
      de: dataValida(searchParams.get('de')),
      ate: dataValida(searchParams.get('ate')),
      offset: 0,
    };
  });
  const [data, setData] = useState<Resp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  // Rascunho dos campos do formulário (só vale ao clicar "Aplicar")
  const [q, setQ] = useState(filtros.q);
  const [de, setDe] = useState(filtros.de);
  const [ate, setAte] = useState(filtros.ate);
  // id -> total, para mostrar soma na confirmação do lote
  const [selecionados, setSelecionados] = useState<Map<string, number>>(new Map());
  const [recarregar, setRecarregar] = useState(0);
  const confirmar = useConfirm();
  const { showToast } = useToast();
  const { busy, executar } = useAcao();

  useEffect(() => {
    let ativo = true;
    const qs = new URLSearchParams({ limit: String(PAGE), offset: String(filtros.offset) });
    if (filtros.status) qs.set('status', filtros.status);
    if (filtros.q.trim()) qs.set('q', filtros.q.trim());
    if (filtros.de) qs.set('de', filtros.de);
    if (filtros.ate) qs.set('ate', filtros.ate);
    setCarregando(true);
    setErro('');
    api.get<Resp>(`/api/pedidos?${qs}`)
      .then(r => { if (ativo) setData(r); })
      .catch((e: any) => { if (ativo) setErro(e?.message || 'Erro ao carregar pedidos'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [filtros, recarregar]);

  const carregar = () => setRecarregar(n => n + 1);

  const pedidos = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE);
  const offset = filtros.offset;
  const currentPage = Math.floor(offset / PAGE) + 1;
  const setOffset = (o: number) => setFiltros(f => ({ ...f, offset: o }));

  const trocarStatus = (s: string) => setFiltros(f => ({ ...f, status: s, offset: 0 }));
  const aplicarFiltros = () => setFiltros(f => ({ ...f, q, de, ate, offset: 0 }));
  const limparFiltros = () => { setQ(''); setDe(''); setAte(''); setFiltros(f => ({ ...f, q: '', de: '', ate: '', offset: 0 })); };

  const marcarPago = async (pedidoId: string) => {
    const ok = await executar(`pagar:${pedidoId}`, () => api.put(`/api/pedidos/${pedidoId}/pagar`, {}), { sucesso: 'Pedido marcado como pago' });
    if (ok !== undefined) {
      setSelecionados(prev => { const n = new Map(prev); n.delete(pedidoId); return n; });
      carregar();
    }
  };

  const marcarLotePago = async () => {
    const ids = [...selecionados.keys()];
    if (ids.length === 0) return;
    const soma = [...selecionados.values()].reduce((a, b) => a + b, 0);
    const ok = await confirmar({
      title: 'Marcar como pago',
      message: `Marcar ${ids.length} pedido(s) como pago(s), totalizando ${brl(soma)}?`,
      confirmText: 'Marcar pago',
    });
    if (!ok) return;
    await executar('lote', async () => {
      const res = await Promise.allSettled(ids.map(id => api.put(`/api/pedidos/${id}/pagar`, {})));
      const falhas = res.filter(r => r.status === 'rejected').length;
      setSelecionados(new Map());
      carregar();
      if (falhas > 0) showToast(`${falhas} de ${ids.length} pedido(s) não puderam ser marcados como pagos. Tente novamente.`, 'error');
      else showToast(`${ids.length} pedido(s) marcado(s) como pago(s)`, 'success');
    });
  };

  const excluirPedido = async (pedidoId: string) => {
    if (!(await confirmar({ title: 'Excluir pedido', message: 'Tem certeza? Essa ação não pode ser desfeita.', confirmText: 'Excluir', danger: true }))) return;
    try {
      await api.delete(`/api/pedidos/${pedidoId}`);
      carregar();
    } catch (e) {
      showToast('Erro ao excluir: ' + (e instanceof Error ? e.message : 'tente novamente'), 'error');
    }
  };

  const toggleSelecionado = (p: Pedido) => {
    const novo = new Map(selecionados);
    if (novo.has(p.id)) novo.delete(p.id); else novo.set(p.id, p.total);
    setSelecionados(novo);
  };

  const statusBadge = (status: string) => {
    if (status === 'pago') return <Badge variant="success">Pago</Badge>;
    if (status === 'fiado') return <Badge variant="danger">Fiado</Badge>;
    return <Badge variant="warning">Pendente</Badge>;
  };

  const metodo = (m: Pedido['metodo_pagamento']) => (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
      m === 'pix' ? 'bg-blue-50 text-azul' : m === 'dinheiro' ? 'bg-green-50 text-verde-escuro' : 'bg-amber-50 text-amber-700'
    }`}>
      {m === 'pix' ? 'Pix' : m === 'dinheiro' ? 'Dinheiro' : 'Fiado'}
    </span>
  );

  const somaSelecionados = [...selecionados.values()].reduce((a, b) => a + b, 0);
  const filtrosAtivos = !!(filtros.q || filtros.de || filtros.ate);

  const acoes = (p: Pedido) => (
    <>
      {p.status !== 'pago' && (
        <Button variant="chip-success" size="xs" onClick={() => marcarPago(p.id)} disabled={busy(`pagar:${p.id}`) || busy('lote')}>
          {busy(`pagar:${p.id}`) ? 'Salvando...' : 'Marcar como pago'}
        </Button>
      )}
      <Button variant="chip-danger" size="xs" onClick={() => excluirPedido(p.id)}>Excluir</Button>
    </>
  );

  const checkbox = (p: Pedido) => p.status !== 'pago' ? (
    <input
      type="checkbox"
      checked={selecionados.has(p.id)}
      onChange={() => toggleSelecionado(p)}
      aria-label={`Selecionar pedido de ${p.nome_guerra}`}
      className="w-5 h-5 accent-azul cursor-pointer"
    />
  ) : null;

  return (
    <AppLayout>
      <PageHeader title="Pedidos da cantina" subtitle="Acompanhe, filtre e dê baixa nos pedidos feitos na cantina." />

      <div className="flex gap-1.5 flex-wrap mb-3" role="group" aria-label="Filtrar por status">
        {STATUS_OPCOES.map((s) => (
          <Button
            key={s.id}
            size="xs"
            variant={filtros.status === s.id ? 'chip-primary' : 'chip'}
            aria-pressed={filtros.status === s.id}
            onClick={() => trocarStatus(s.id)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <form onSubmit={e => { e.preventDefault(); aplicarFiltros(); }} className="bg-white rounded-2xl border border-borda shadow-sm p-3 sm:p-4 mb-4 grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:items-end">
        <div className="col-span-2 sm:flex-1 sm:min-w-[180px]">
          <label htmlFor="ped-q" className="block text-sm font-medium mb-1.5">Buscar trigrama</label>
          <input id="ped-q" value={q} onChange={e => setQ(e.target.value)} placeholder="Ex.: HÖE" className={`${inputClass} min-h-[44px]`} />
        </div>
        <div className="min-w-0">
          <label htmlFor="ped-de" className="block text-sm font-medium mb-1.5">De</label>
          <input id="ped-de" type="date" value={de} onChange={e => setDe(e.target.value)} className={`${inputClass} min-h-[44px]`} />
        </div>
        <div className="min-w-0">
          <label htmlFor="ped-ate" className="block text-sm font-medium mb-1.5">Até</label>
          <input id="ped-ate" type="date" value={ate} onChange={e => setAte(e.target.value)} className={`${inputClass} min-h-[44px]`} />
        </div>
        <div className="col-span-2 flex gap-2">
          <Button type="submit" size="md" className="flex-1 sm:flex-none">Aplicar filtros</Button>
          <Button type="button" size="md" variant="ghost" onClick={limparFiltros}>Limpar</Button>
        </div>
      </form>

      {selecionados.size > 0 && (
        <div className="bg-noite rounded-2xl p-3 sm:px-4 mb-4 flex items-center justify-between gap-3 flex-wrap sticky top-2 z-10">
          <span className="text-white text-sm">
            {selecionados.size} selecionado(s) · <strong className="font-display text-lg tracking-wide">{brl(somaSelecionados)}</strong>
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelecionados(new Map())}>Limpar seleção</Button>
            <Button size="sm" variant="success" onClick={marcarLotePago} disabled={busy('lote')}>
              <Icon name="check" size={16} /> {busy('lote') ? 'Processando...' : 'Marcar como pago'}
            </Button>
          </div>
        </div>
      )}

      {!erro && data && (
        <div className="text-sm text-texto-fraco mb-2">
          {total} pedido(s){totalPages > 1 && ` · página ${currentPage} de ${totalPages}`}
        </div>
      )}

      {carregando && pedidos.length === 0 ? (
        <Loading label="Carregando pedidos..." />
      ) : erro ? (
        <Card className="text-center py-8">
          <p className="text-[15px] font-medium text-texto">Não foi possível carregar os pedidos.</p>
          <p className="text-sm text-texto-fraco mt-1">{erro}</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={carregar}>
            <Icon name="refresh" size={16} /> Tentar de novo
          </Button>
        </Card>
      ) : pedidos.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="cart" size={26} />}
            message="Nenhum pedido encontrado"
            hint={filtrosAtivos || filtros.status ? 'Tente outro status ou limpe os filtros.' : 'Os pedidos feitos na cantina aparecem aqui.'}
          />
        </Card>
      ) : (
        <div className={carregando ? 'opacity-60 transition-opacity' : ''}>
          {/* Mobile: cartões */}
          <ul className="md:hidden space-y-2">
            {pedidos.map((p) => (
              <li key={p.id} className={`bg-white border rounded-2xl shadow-sm p-4 ${selecionados.has(p.id) ? 'border-azul' : 'border-borda'}`}>
                <div className="flex items-start gap-3">
                  {p.status !== 'pago' && <div className="pt-0.5">{checkbox(p)}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-texto truncate">{p.nome_guerra}</div>
                        <div className="text-xs text-texto-fraco">{dataBR(p.created_at)}</div>
                      </div>
                      <span className="font-display text-2xl leading-none tracking-wide text-dourado shrink-0">{brl(p.total)}</span>
                    </div>
                    {p.itens_resumo && <p className="text-sm text-texto-fraco mt-2 break-words">{p.itens_resumo}</p>}
                    <div className="flex items-center gap-1.5 mt-2">{statusBadge(p.status)}{metodo(p.metodo_pagamento)}</div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-borda [&>button]:flex-1 [&>button]:min-h-[40px]">{acoes(p)}</div>
              </li>
            ))}
          </ul>

          {/* Desktop: tabela */}
          <div className="hidden md:block bg-white rounded-2xl overflow-hidden border border-borda shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-fundo-elevado border-b border-borda text-texto-fraco">
                  <th className="px-3 py-3 w-10"><span className="sr-only">Selecionar</span></th>
                  <th className="px-3 py-3 text-left text-xs font-medium">Data</th>
                  <th className="px-3 py-3 text-left text-xs font-medium">Militar</th>
                  <th className="px-3 py-3 text-left text-xs font-medium">Itens</th>
                  <th className="px-3 py-3 text-right text-xs font-medium">Total</th>
                  <th className="px-3 py-3 text-center text-xs font-medium">Método</th>
                  <th className="px-3 py-3 text-center text-xs font-medium">Status</th>
                  <th className="px-3 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => (
                  <tr key={p.id} className={`border-b border-borda/60 last:border-0 hover:bg-fundo transition-colors ${selecionados.has(p.id) ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-3 py-3">{checkbox(p)}</td>
                    <td className="px-3 py-3 text-xs text-texto-fraco whitespace-nowrap">{dataBR(p.created_at)}</td>
                    <td className="px-3 py-3 font-medium text-texto">{p.nome_guerra}</td>
                    <td className="px-3 py-3 text-xs text-texto-fraco max-w-[220px] truncate" title={p.itens_resumo}>{p.itens_resumo}</td>
                    <td className="px-3 py-3 text-right font-display text-lg tracking-wide text-dourado whitespace-nowrap">{brl(p.total)}</td>
                    <td className="px-3 py-3 text-center">{metodo(p.metodo_pagamento)}</td>
                    <td className="px-3 py-3 text-center">{statusBadge(p.status)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">{acoes(p)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 mt-4" aria-label="Paginação">
          <Button size="sm" variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
            <Icon name="arrow-left" size={16} /> Anterior
          </Button>
          <span className="text-sm text-texto-fraco px-2">{currentPage} de {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
            Próxima <Icon name="arrow-right" size={16} />
          </Button>
        </nav>
      )}
    </AppLayout>
  );
}
