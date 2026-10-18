import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Loading } from '../../components/ui/Loading';
import { inputClass } from '../../components/ui/Field';
import { StatCard } from '../../components/admin/StatCard';
import { api } from '../../services/api';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';

interface Devedor {
  nome_guerra: string;
  whatsapp: string | null;
  total: number;
  qtd: number;
  cantina: number;
  loja: number;
  cafe: number;
  ximboca: number;
  dias_atraso: number;
}

interface Resumo {
  total_devedores: number;
  valor_total: number;
  sem_whatsapp: number;
}

const brl = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function Cobrancas() {
  const [devedores, setDevedores] = useState<Devedor[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [dias, setDias] = useState(0);
  const [modelo, setModelo] = useState(
    `Oi {NOME}, tudo bem?\n\nTem um valor pendente na caixinha:\n*Total: R$ {TOTAL}*\n{DETALHE}\n\nQuando der, passa um PIX ou fala comigo. Obrigado!`
  );
  const confirmar = useConfirm();
  const { showToast } = useToast();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    api.get<{ devedores: Devedor[]; resumo: Resumo }>(`/api/admin/devedores-consolidados?dias=${dias}`)
      .then(r => { if (ativo) { setDevedores(r.devedores); setResumo(r.resumo); } })
      .catch((e: any) => {
        if (!ativo) return;
        const msg = e?.message || 'Erro ao carregar devedores';
        setErro(msg);
        showToast(msg, 'error');
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [dias, recarregar, showToast]);

  const montarDetalhe = (d: Devedor) => {
    const partes: string[] = [];
    if (d.cantina > 0) partes.push(`• Cantina: R$ ${d.cantina.toFixed(2)}`);
    if (d.loja > 0)    partes.push(`• Loja: R$ ${d.loja.toFixed(2)}`);
    if (d.cafe > 0)    partes.push(`• Café: R$ ${d.cafe.toFixed(2)}`);
    if (d.ximboca > 0) partes.push(`• Ximboca: R$ ${d.ximboca.toFixed(2)}`);
    return partes.join('\n');
  };

  const montarMensagem = (d: Devedor) =>
    modelo
      .replace(/\{NOME\}/g, d.nome_guerra)
      .replace(/\{TOTAL\}/g, d.total.toFixed(2))
      .replace(/\{DETALHE\}/g, montarDetalhe(d))
      .replace(/\{DIAS\}/g, String(d.dias_atraso));

  const abrirWhatsapp = (d: Devedor) => {
    if (!d.whatsapp) return;
    const msg = montarMensagem(d);
    window.open(`https://wa.me/55${d.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const abrirTodos = async () => {
    const comWhats = devedores.filter(d => d.whatsapp);
    if (!comWhats.length) return;
    if (!(await confirmar({ title: 'Cobrar todos', message: `Abrir ${comWhats.length} abas do WhatsApp? O navegador pode bloquear pop-ups.`, confirmText: 'Abrir', danger: false }))) return;
    comWhats.forEach((d, i) => setTimeout(() => abrirWhatsapp(d), i * 400));
  };

  const comWhatsCount = devedores.filter(d => d.whatsapp).length;

  const corAtraso = (dias: number) => dias > 30 ? 'text-escarlate font-semibold' : dias > 7 ? 'text-amber-700' : 'text-texto-fraco';

  const botaoZap = (d: Devedor, full = false) => (
    <Button
      variant={d.whatsapp ? 'chip-success' : 'chip'}
      size={full ? 'sm' : 'xs'}
      className={full ? 'w-full' : ''}
      onClick={() => abrirWhatsapp(d)}
      disabled={!d.whatsapp}
      aria-label={d.whatsapp ? `Cobrar ${d.nome_guerra} no WhatsApp` : `${d.nome_guerra} não tem WhatsApp cadastrado`}
    >
      {d.whatsapp ? <><Icon name="device-phone" size={14} /> Cobrar no WhatsApp</> : 'Sem WhatsApp'}
    </Button>
  );

  const partes = (d: Devedor) => ([
    ['Cantina', d.cantina], ['Loja', d.loja], ['Café', d.cafe], ['Ximboca', d.ximboca],
  ] as const).filter(([, v]) => v > 0);

  return (
    <AppLayout>
      <BackButton to="/admin" className="mb-3" />
      <PageHeader
        title="Cobranças"
        subtitle="Todos que devem na cantina, loja, café e Ximboca, com cobrança pelo WhatsApp."
        right={
          <Button variant="success" size="sm" onClick={abrirTodos} disabled={!comWhatsCount}>
            <Icon name="megaphone" size={16} /> Cobrar todos ({comWhatsCount})
          </Button>
        }
      />

      {resumo && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
          <StatCard label="Devedores" value={String(resumo.total_devedores)} color={resumo.total_devedores ? 'text-escarlate' : 'text-verde'} icon={<Icon name="users" size={22} />} />
          <StatCard label="Sem WhatsApp" value={String(resumo.sem_whatsapp)} color={resumo.sem_whatsapp ? 'text-amber-700' : 'text-texto-fraco'} icon={<Icon name="warning" size={22} />} hint="Cobre pessoalmente" />
          <div className="col-span-2 lg:col-span-1">
            <StatCard label="Valor total em aberto" value={brl(resumo.valor_total)} color={resumo.valor_total > 0 ? 'text-escarlate' : 'text-verde'} icon={<Icon name="cash" size={22} />} />
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-start mb-4">
        <label className="flex items-center gap-2 text-sm text-texto-fraco shrink-0">
          Atraso mínimo
          <select value={dias} onChange={e => setDias(parseInt(e.target.value))} className={`${inputClass} !w-auto min-h-[44px]`}>
            <option value={0}>Todos</option>
            <option value={7}>7 dias ou mais</option>
            <option value={15}>15 dias ou mais</option>
            <option value={30}>30 dias ou mais</option>
            <option value={60}>60 dias ou mais</option>
          </select>
        </label>

        <details className="bg-white rounded-2xl border border-borda shadow-sm p-3 flex-1 min-w-0">
          <summary className="text-sm font-medium cursor-pointer text-texto flex items-center gap-1.5 min-h-[28px]">
            <Icon name="pencil" size={14} /> Editar modelo de mensagem
          </summary>
          <label htmlFor="cob-modelo" className="sr-only">Modelo de mensagem</label>
          <textarea
            id="cob-modelo"
            value={modelo}
            onChange={e => setModelo(e.target.value)}
            rows={6}
            className={`${inputClass} mt-2 font-mono`}
          />
          <p className="text-xs text-texto-fraco mt-1">
            Variáveis: <code>{'{NOME}'}</code> <code>{'{TOTAL}'}</code> <code>{'{DETALHE}'}</code> <code>{'{DIAS}'}</code>
          </p>
        </details>
      </div>

      {carregando && devedores.length === 0 ? (
        <Loading label="Carregando devedores..." />
      ) : erro && devedores.length === 0 ? (
        <Card className="text-center py-8">
          <p className="text-[15px] font-medium text-texto">Não foi possível carregar os devedores.</p>
          <p className="text-sm text-texto-fraco mt-1">{erro}</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={() => setRecarregar(n => n + 1)}>
            <Icon name="refresh" size={16} /> Tentar de novo
          </Button>
        </Card>
      ) : devedores.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Icon name="check" size={26} />}
            message="Ninguém devendo neste filtro"
            hint={dias > 0 ? 'Diminua o atraso mínimo para ver mais devedores.' : 'Todas as contas estão em dia.'}
          />
        </Card>
      ) : (
        <div className={carregando ? 'opacity-60' : ''}>
          {/* Mobile: cartões */}
          <ul className="md:hidden space-y-2">
            {devedores.map(d => (
              <li key={d.nome_guerra} className="bg-white rounded-2xl border border-borda shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-texto truncate">{d.nome_guerra}</div>
                    <div className={`text-xs ${corAtraso(d.dias_atraso)}`}>{d.dias_atraso} dia(s) de atraso</div>
                  </div>
                  <span className="font-display text-2xl leading-none tracking-wide text-escarlate shrink-0">{brl(d.total)}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-texto-fraco mt-2">
                  {partes(d).map(([nome, v]) => <span key={nome}>{nome} {brl(v)}</span>)}
                </div>
                <div className="mt-3 pt-3 border-t border-borda">{botaoZap(d, true)}</div>
              </li>
            ))}
          </ul>

          {/* Desktop: tabela */}
          <div className="hidden md:block bg-white rounded-2xl border border-borda shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-fundo-elevado border-b border-borda text-texto-fraco">
                  <th className="px-3 py-3 text-left text-xs font-medium">Militar</th>
                  <th className="px-3 py-3 text-right text-xs font-medium">Cantina</th>
                  <th className="px-3 py-3 text-right text-xs font-medium">Loja</th>
                  <th className="px-3 py-3 text-right text-xs font-medium">Café</th>
                  <th className="px-3 py-3 text-right text-xs font-medium">Ximboca</th>
                  <th className="px-3 py-3 text-right text-xs font-medium">Total</th>
                  <th className="px-3 py-3 text-center text-xs font-medium">Atraso</th>
                  <th className="px-3 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {devedores.map(d => (
                  <tr key={d.nome_guerra} className="border-b border-borda/60 last:border-0 hover:bg-fundo">
                    <td className="px-3 py-3 font-medium">{d.nome_guerra}</td>
                    <td className="px-3 py-3 text-right text-xs text-texto-fraco tabular-nums">{d.cantina > 0 ? brl(d.cantina) : '—'}</td>
                    <td className="px-3 py-3 text-right text-xs text-texto-fraco tabular-nums">{d.loja > 0 ? brl(d.loja) : '—'}</td>
                    <td className="px-3 py-3 text-right text-xs text-texto-fraco tabular-nums">{d.cafe > 0 ? brl(d.cafe) : '—'}</td>
                    <td className="px-3 py-3 text-right text-xs text-texto-fraco tabular-nums">{d.ximboca > 0 ? brl(d.ximboca) : '—'}</td>
                    <td className="px-3 py-3 text-right font-display text-lg tracking-wide text-escarlate whitespace-nowrap">{brl(d.total)}</td>
                    <td className={`px-3 py-3 text-center text-xs ${corAtraso(d.dias_atraso)}`}>{d.dias_atraso} d</td>
                    <td className="px-3 py-3 text-right">{botaoZap(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
