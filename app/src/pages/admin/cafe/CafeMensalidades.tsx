import { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../../../components/AppLayout';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { PageHeader } from '../../../components/ui/PageHeader';
import { inputClass } from '../../../components/ui/Field';
import { Modal } from '../../../components/ui/Modal';
import { api } from '../../../services/api';
import { dataLocal } from '../../../services/periodo';
import { getConfig } from '../../../services/config';
import { gerarCobrancaCafePDF } from '../../../services/pdf';
import { useToast } from '../../../hooks/useToast';
import { useAcao } from '../../../hooks/useAcao';
import { Icon } from '../../../components/ui/Icon';
import { Card } from '../../../components/ui/Card';
import { Loading } from '../../../components/ui/Loading';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatCard } from '../../../components/admin/StatCard';

const brl = (v: number) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Mensalidade {
  id: string;
  assinante_id: string;
  referencia: string;
  valor: number;
  status: 'pendente' | 'pago';
  nome_guerra: string;
  tipo: string;
  paid_at: string | null;
}

export function CafeMensalidades() {
  const { showToast } = useToast();
  const { busy, executar } = useAcao();
  const [tipo, setTipo] = useState<'oficial' | 'graduado'>(() =>
    (localStorage.getItem('cafe_tipo') as 'oficial' | 'graduado') || 'graduado'
  );
  const [mensalidades, setMensalidades] = useState<Mensalidade[]>([]);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroRef, setFiltroRef] = useState('');
  const [modalGerar, setModalGerar] = useState(false);
  const [referencia, setReferencia] = useState('');
  const [gerando, setGerando] = useState(false);
  const [pixConfig, setPixConfig] = useState({ oficial: '', graduado: '' });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const abrirGerar = useCallback(() => setModalGerar(true), []);
  const fecharGerar = useCallback(() => setModalGerar(false), []);

  useEffect(() => { localStorage.setItem('cafe_tipo', tipo); }, [tipo]);
  useEffect(() => {
    getConfig().then(c => {
      setPixConfig({ oficial: c.pix_cafe_oficial_chave || '', graduado: c.pix_cafe_graduado_chave || '' });
    }).catch(() => {});
  }, []);

  const carregar = () => {
    const params = new URLSearchParams();
    params.set('tipo', tipo);
    if (filtroStatus) params.set('status', filtroStatus);
    if (filtroRef) params.set('referencia', filtroRef);
    setCarregando(true);
    setErro('');
    api.get<Mensalidade[]>(`/api/cafe/admin/mensalidades?${params}`)
      .then(setMensalidades)
      .catch((e: any) => setErro(e?.message || 'Erro ao carregar mensalidades'))
      .finally(() => setCarregando(false));
  };

  useEffect(() => { carregar(); }, [tipo, filtroStatus, filtroRef]);

  useEffect(() => {
    setReferencia(dataLocal(new Date()).slice(0, 7));
  }, []);

  const gerarMensalidades = async () => {
    setGerando(true);
    try {
      const res = await api.post<{ criados: number; total: number }>('/api/cafe/admin/gerar-mensalidades', { referencia, tipo });
      showToast(`${res.criados} mensalidades geradas de ${res.total} assinantes`, 'success');
      setModalGerar(false);
      carregar();
    } catch (e) {
      showToast('Erro: ' + (e instanceof Error ? e.message : 'tente novamente'), 'error');
    } finally { setGerando(false); }
  };

  const cobrar = async (m: Mensalidade) => {
    const pendentes = mensalidades.filter(x => x.nome_guerra === m.nome_guerra && x.status === 'pendente');
    const totalDevido = pendentes.reduce((a, x) => a + x.valor, 0);
    const pixChave = pixConfig[tipo];
    await gerarCobrancaCafePDF(m.nome_guerra, tipo, pendentes.map(p => ({ referencia: p.referencia, valor: p.valor })), totalDevido, pixChave);
  };

  const marcarPago = async (id: string) => {
    const ok = await executar(`pagar:${id}`, () => api.put(`/api/cafe/admin/mensalidades/${id}/pagar`, {}), { sucesso: 'Mensalidade marcada como paga' });
    if (ok !== undefined) carregar();
  };

  // Get unique references for filter
  const referencias = [...new Set(mensalidades.map(m => m.referencia))].sort().reverse();

  const refBR = (r: string) => {
    const [a, m] = r.split('-');
    return m ? `${m}/${a}` : r;
  };
  const totalPendente = mensalidades.filter(m => m.status === 'pendente').reduce((a, m) => a + m.valor, 0);
  const totalPago = mensalidades.filter(m => m.status === 'pago').reduce((a, m) => a + m.valor, 0);

  const acoes = (m: Mensalidade) => m.status === 'pendente' && (
    <div className="flex gap-2 flex-wrap">
      <Button variant="chip-success" size="sm" onClick={() => marcarPago(m.id)} disabled={busy(`pagar:${m.id}`)}>
        <Icon name="check" size={15} /> {busy(`pagar:${m.id}`) ? 'Salvando...' : 'Marcar pago'}
      </Button>
      <Button variant="chip-primary" size="sm" onClick={() => cobrar(m)}>
        <Icon name="document" size={15} /> Cobrança em PDF
      </Button>
    </div>
  );

  return (
    <AppLayout>
      <PageHeader
        title="Mensalidades do café"
        subtitle="Gere as cobranças do mês e marque quem já pagou."
        right={<Button size="sm" onClick={abrirGerar}><Icon name="plus" size={16} /> Gerar mensalidades</Button>}
      />
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Sala do café">
        {(['oficial', 'graduado'] as const).map(t => (
          <Button key={t} size="sm" variant={tipo === t ? 'primary' : 'chip'} aria-pressed={tipo === t} onClick={() => setTipo(t)}>
            {t === 'oficial' ? 'Oficiais' : 'Graduados'}
          </Button>
        ))}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filtrar por status">
          {[{ v: '', l: 'Todas' }, { v: 'pendente', l: 'Pendentes' }, { v: 'pago', l: 'Pagas' }].map((s) => (
            <Button key={s.v} size="sm" variant={filtroStatus === s.v ? 'chip-primary' : 'chip'} aria-pressed={filtroStatus === s.v} onClick={() => setFiltroStatus(s.v)}>
              {s.l}
            </Button>
          ))}
        </div>
        {referencias.length > 0 && (
          <select value={filtroRef} onChange={(e) => setFiltroRef(e.target.value)} aria-label="Mês de referência"
            className={`${inputClass} !w-auto min-h-[40px] !py-2`}>
            <option value="">Todos os meses</option>
            {referencias.map(r => <option key={r} value={r}>{refBR(r)}</option>)}
          </select>
        )}
      </div>

      {mensalidades.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard label="Pendente na lista" value={brl(totalPendente)} color={totalPendente > 0 ? 'text-amber-600' : 'text-verde'} icon={<Icon name="clock" size={18} />} />
          <StatCard label="Pago na lista" value={brl(totalPago)} color="text-verde" icon={<Icon name="check" size={18} />} />
        </div>
      )}

      {erro ? (
        <Card className="text-center py-10">
          <p className="text-escarlate text-sm mb-4">{erro}</p>
          <Button size="sm" onClick={carregar}><Icon name="refresh" size={16} /> Tentar de novo</Button>
        </Card>
      ) : carregando && mensalidades.length === 0 ? (
        <Loading label="Carregando mensalidades..." />
      ) : mensalidades.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="credit-card" size={24} />}
            message={filtroStatus || filtroRef ? 'Nenhuma mensalidade com estes filtros' : 'Nenhuma mensalidade gerada'}
            hint={filtroStatus || filtroRef ? 'Troque os filtros para ver as outras.' : 'Gere as mensalidades do mês para os assinantes ativos.'}
            action={filtroStatus || filtroRef
              ? <Button variant="ghost" size="sm" onClick={() => { setFiltroStatus(''); setFiltroRef(''); }}>Limpar filtros</Button>
              : <Button size="sm" onClick={abrirGerar}><Icon name="plus" size={16} /> Gerar mensalidades</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Celular: cartões */}
          <div className="md:hidden space-y-3">
            {mensalidades.map((m) => (
              <Card key={m.id}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="font-display text-2xl text-noite tracking-wide leading-none">{m.nome_guerra}</div>
                    <div className="text-xs text-texto-fraco mt-1">Referência {refBR(m.referencia)} · <span className="capitalize">{m.tipo}</span></div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-xl text-dourado tracking-wide leading-none">{brl(m.valor)}</div>
                    <div className="mt-1"><Badge variant={m.status === 'pago' ? 'success' : 'warning'}>{m.status === 'pago' ? 'Pago' : 'Pendente'}</Badge></div>
                  </div>
                </div>
                {acoes(m)}
              </Card>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden md:block bg-white rounded-2xl overflow-hidden border border-borda shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-noite">
                  <th className="px-4 py-3 text-left text-xs font-medium text-white">Militar</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-white">Sala</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-white">Referência</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-white">Valor</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-white">Status</th>
                  <th className="px-4 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {mensalidades.map((m) => (
                  <tr key={m.id} className="border-b border-borda/50 last:border-0 hover:bg-fundo">
                    <td className="px-4 py-3 font-medium text-texto">{m.nome_guerra}</td>
                    <td className="px-4 py-3 text-center text-xs text-texto-fraco capitalize">{m.tipo}</td>
                    <td className="px-4 py-3 text-center text-xs text-texto-fraco">{refBR(m.referencia)}</td>
                    <td className="px-4 py-3 text-right font-display text-lg text-dourado tracking-wide whitespace-nowrap">{brl(m.valor)}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={m.status === 'pago' ? 'success' : 'warning'}>{m.status === 'pago' ? 'Pago' : 'Pendente'}</Badge>
                    </td>
                    <td className="px-4 py-3">{acoes(m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={modalGerar} onClose={fecharGerar} title="Gerar mensalidades">
        <div className="space-y-4">
          <div>
            <label htmlFor="cm-ref" className="block text-sm font-medium mb-1.5">Mês de referência</label>
            <input id="cm-ref" type="month" value={referencia} onChange={(e) => setReferencia(e.target.value)} className={inputClass} />
            <p className="text-xs text-texto-fraco mt-1">Plano mensal: cobra o mês escolhido. Plano anual: cobra uma vez por ano, automaticamente.</p>
          </div>
          <p className="text-sm text-texto-fraco">Sala: <strong className="text-texto">{tipo === 'oficial' ? 'Oficiais' : 'Graduados'}</strong></p>
          <Button className="w-full" onClick={gerarMensalidades} disabled={gerando}>
            {gerando ? 'Gerando...' : 'Gerar mensalidades'}
          </Button>
        </div>
      </Modal>
    </AppLayout>
  );
}
