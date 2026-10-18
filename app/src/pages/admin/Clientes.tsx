import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Loading } from '../../components/ui/Loading';
import { EmptyState } from '../../components/ui/EmptyState';
import { Card } from '../../components/ui/Card';
import { Icon } from '../../components/ui/Icon';
import { inputClass } from '../../components/ui/Field';
import { StatCard } from '../../components/admin/StatCard';
import { api } from '../../services/api';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';
import { PeriodoFiltro, usePeriodoUrl } from '../../components/admin/PeriodoFiltro';
import { descreverPeriodo, periodoAtivo, periodoParaQuery } from '../../services/periodo';
import type { Cliente } from '../../types';

const brl = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type Filtro = 'todos' | 'divida' | 'dia' | 'bloqueados';
type Ordem = 'nome' | 'saldo';

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'divida', label: 'Com dívida' },
  { id: 'dia', label: 'Em dia' },
  { id: 'bloqueados', label: 'Bloqueados' },
];

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('nome');
  const [periodo, setPeriodo] = usePeriodoUrl();
  const navigate = useNavigate();
  const confirmar = useConfirm();
  const { showToast } = useToast();
  const query = periodoParaQuery(periodo);

  const carregar = () => api.get<Cliente[]>(`/api/clientes${query}`)
    .then((r) => { setClientes(r); setErro(false); })
    .catch(() => { setErro(true); showToast('Erro ao carregar militares.', 'error'); })
    .finally(() => setCarregando(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setCarregando(true); carregar(); }, [query]);

  const toggleBloqueio = async (e: React.MouseEvent, c: Cliente) => {
    e.stopPropagation();
    const novoStatus = c.ativo ? 0 : 1;
    const acao = novoStatus ? 'desbloquear' : 'bloquear';
    if (!(await confirmar({
      title: 'Confirmar',
      message: `Deseja ${acao} ${c.nome_guerra}?`,
      confirmText: acao.charAt(0).toUpperCase() + acao.slice(1),
      danger: !novoStatus,
    }))) return;
    try {
      await api.put(`/api/clientes/${c.id}/bloquear`, { ativo: novoStatus });
      carregar();
    } catch {
      showToast('Erro ao atualizar. Tente novamente.', 'error');
    }
  };

  const excluirMilitar = async (e: React.MouseEvent, c: Cliente) => {
    e.stopPropagation();
    if (!(await confirmar({
      title: 'Excluir militar',
      message: `Excluir ${c.nome_guerra} permanentemente? Todos os pedidos, pagamentos e dados desse militar serão apagados.`,
      confirmText: 'Excluir',
      danger: true,
    }))) return;
    try {
      await api.delete(`/api/clientes/${c.id}`);
      carregar();
    } catch {
      showToast('Erro ao excluir. Tente novamente.', 'error');
    }
  };

  const resumo = useMemo(() => {
    const comDivida = clientes.filter(c => (c.saldo_devedor ?? 0) > 0);
    return {
      total: clientes.length,
      comDivida: comDivida.length,
      emAberto: comDivida.reduce((s, c) => s + (c.saldo_devedor ?? 0), 0),
    };
  }, [clientes]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = clientes.filter((c) => {
      if (filtro === 'divida' && !((c.saldo_devedor ?? 0) > 0)) return false;
      if (filtro === 'dia' && (c.saldo_devedor ?? 0) !== 0) return false;
      if (filtro === 'bloqueados' && c.ativo) return false;
      if (termo && !c.nome_guerra.toLowerCase().includes(termo) && !(c.saram ?? '').toLowerCase().includes(termo)) return false;
      return true;
    });
    return [...lista].sort((a, b) =>
      ordem === 'saldo'
        ? (b.saldo_devedor ?? 0) - (a.saldo_devedor ?? 0) || a.nome_guerra.localeCompare(b.nome_guerra, 'pt-BR')
        : a.nome_guerra.localeCompare(b.nome_guerra, 'pt-BR')
    );
  }, [clientes, filtro, busca, ordem]);

  const abrir = (c: Cliente) => navigate(`/admin/clientes/${c.id}${query}`);

  const marcadores = (c: Cliente) => (
    <>
      {c.usuario_id && (
        <span className="inline-flex items-center gap-1 text-[11px] text-verde-escuro font-medium bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
          <Icon name="check" size={10} /> Tem conta
        </span>
      )}
      {!c.ativo && <Badge variant="danger">Bloqueado</Badge>}
      {c.visitante ? (
        <span className="text-[11px] text-azul font-medium bg-azul/10 px-1.5 py-0.5 rounded-full">
          Visitante{c.esquadrao_origem ? ` · ${c.esquadrao_origem}` : ''}
        </span>
      ) : null}
    </>
  );

  const acoes = (c: Cliente) => (
    <>
      <Button variant={c.ativo ? 'chip-warning' : 'chip-success'} size="xs" onClick={(e) => toggleBloqueio(e, c)}>
        {c.ativo ? 'Bloquear' : 'Desbloquear'}
      </Button>
      <Button variant="chip-danger" size="xs" onClick={(e) => excluirMilitar(e, c)}>
        Excluir
      </Button>
    </>
  );

  return (
    <AppLayout>
      <PageHeader title="Contas dos militares" subtitle="Quanto cada militar comprou, pagou e ainda deve na cantina." />

      <PeriodoFiltro periodo={periodo} onChange={setPeriodo} className="mb-2" />
      <p className="text-xs text-texto-fraco mb-4">
        {periodoAtivo(periodo)
          ? <>Comprado, pago e saldo da cantina de <strong>{descreverPeriodo(periodo)}</strong>.</>
          : 'Comprado, pago e saldo da cantina de todo o período.'}
      </p>

      {!carregando && !erro && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5">
          <StatCard label="Militares" value={String(resumo.total)} color="text-noite" icon={<Icon name="users" size={22} />} />
          <StatCard label="Com dívida" value={String(resumo.comDivida)} color={resumo.comDivida ? 'text-escarlate' : 'text-verde'} icon={<Icon name="warning" size={22} />} />
          <div className="col-span-2 lg:col-span-1">
            <StatCard label="Total em aberto no período" value={brl(resumo.emAberto)} color={resumo.emAberto > 0 ? 'text-escarlate' : 'text-verde'} icon={<Icon name="cash" size={22} />} />
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center mb-3">
        <label htmlFor="busca-militar" className="sr-only">Buscar por trigrama ou SARAM</label>
        <input
          id="busca-militar"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por trigrama ou SARAM"
          className={`${inputClass} sm:max-w-xs min-h-[44px]`}
        />
        <label className="flex items-center gap-2 text-sm text-texto-fraco sm:ml-auto">
          Ordenar por
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className={`${inputClass} !w-auto min-h-[44px]`}>
            <option value="nome">Nome (A–Z)</option>
            <option value="saldo">Maior saldo devedor</option>
          </select>
        </label>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-4" role="group" aria-label="Filtrar militares">
        {FILTROS.map((f) => (
          <Button
            key={f.id}
            size="xs"
            variant={filtro === f.id ? 'chip-primary' : 'chip'}
            aria-pressed={filtro === f.id}
            onClick={() => setFiltro(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {carregando ? (
        <Loading label="Carregando militares..." />
      ) : erro ? (
        <Card className="text-center py-8">
          <p className="text-[15px] font-medium text-texto">Não foi possível carregar os militares.</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={() => { setCarregando(true); carregar(); }}>
            <Icon name="refresh" size={16} /> Tentar de novo
          </Button>
        </Card>
      ) : filtrados.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="users" size={26} />}
            message={clientes.length === 0 ? 'Nenhum militar cadastrado ainda' : 'Nenhum militar encontrado'}
            hint={clientes.length === 0 ? 'Os militares aparecem aqui depois da primeira compra.' : 'Tente outra busca, outro filtro ou amplie o período.'}
          />
        </Card>
      ) : (
        <>
          {/* Mobile: cartões */}
          <ul className="md:hidden space-y-2">
            {filtrados.map((c) => {
              const saldo = c.saldo_devedor ?? 0;
              return (
                <li key={c.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => abrir(c)}
                    onKeyDown={(e) => { if (e.key === 'Enter') abrir(c); }}
                    className={`bg-white border border-borda rounded-2xl shadow-sm p-4 cursor-pointer ${!c.ativo ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-texto truncate">{c.nome_guerra}</div>
                        <div className="text-xs text-texto-fraco font-mono">{c.saram || 'Sem SARAM'}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-display text-2xl leading-none tracking-wide ${saldo > 0 ? 'text-escarlate' : 'text-verde'}`}>{brl(saldo)}</div>
                        <div className="text-[11px] text-texto-fraco mt-1">{saldo > 0 ? 'em aberto' : 'em dia'}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2 empty:hidden">{marcadores(c)}</div>
                    <div className="flex justify-between gap-2 text-xs text-texto-fraco mt-3">
                      <span>Comprado {brl(c.total_comprado ?? 0)}</span>
                      <span>Pago {brl(c.total_pago ?? 0)}</span>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-borda [&>button]:flex-1 [&>button]:min-h-[40px]">{acoes(c)}</div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop: tabela */}
          <div className="hidden md:block bg-white rounded-2xl overflow-hidden border border-borda shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-fundo-elevado border-b border-borda text-texto-fraco">
                  <th className="px-4 py-3 text-left text-xs font-medium">Trigrama</th>
                  <th className="px-4 py-3 text-left text-xs font-medium">SARAM</th>
                  <th className="px-4 py-3 text-right text-xs font-medium">Comprado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium">Pago</th>
                  <th className="px-4 py-3 text-right text-xs font-medium">Saldo</th>
                  <th className="px-4 py-3 text-right text-xs font-medium"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => abrir(c)}
                    className={`border-b border-borda/60 last:border-0 cursor-pointer hover:bg-fundo transition-colors ${!c.ativo ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-texto">{c.nome_guerra}</span>
                        {marcadores(c)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-texto-fraco font-mono text-xs">{c.saram || '—'}</td>
                    <td className="px-4 py-3 text-right text-texto-fraco tabular-nums">{brl(c.total_comprado ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-texto-fraco tabular-nums">{brl(c.total_pago ?? 0)}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={(c.saldo_devedor ?? 0) > 0 ? 'danger' : 'success'}>{brl(c.saldo_devedor ?? 0)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">{acoes(c)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-texto-fraco mt-3">
            {filtrados.length} de {clientes.length} militar{clientes.length === 1 ? '' : 'es'}. Toque em um militar para ver o extrato.
          </p>
        </>
      )}
    </AppLayout>
  );
}
