import { useEffect, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';

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

export function Cobrancas() {
  const [devedores, setDevedores] = useState<Devedor[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [dias, setDias] = useState(0);
  const [modelo, setModelo] = useState(
    `Oi {NOME}, tudo bem?\n\nTem um valor pendente na caixinha:\n*Total: R$ {TOTAL}*\n{DETALHE}\n\nQuando der, passa um PIX ou fala comigo. Obrigado!`
  );

  const carregar = () => {
    api.get<{ devedores: Devedor[]; resumo: Resumo }>(`/api/admin/devedores-consolidados?dias=${dias}`)
      .then(r => { setDevedores(r.devedores); setResumo(r.resumo); });
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [dias]);

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

  const abrirTodos = () => {
    const comWhats = devedores.filter(d => d.whatsapp);
    if (!comWhats.length) return;
    if (!confirm(`Abrir ${comWhats.length} abas do WhatsApp? O navegador pode bloquear pop-ups.`)) return;
    comWhats.forEach((d, i) => setTimeout(() => abrirWhatsapp(d), i * 400));
  };

  return (
    <AppLayout>
      <BackButton to="/admin" className="mb-3" />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="font-display text-2xl text-azul tracking-wider">COBRANÇAS</h1>
        <div className="flex gap-2 items-center">
          <label className="text-xs text-texto-fraco">Atraso mín:</label>
          <select value={dias} onChange={e => setDias(parseInt(e.target.value))} className="bg-white border border-borda rounded-lg px-2 py-1 text-sm">
            <option value={0}>Todos</option>
            <option value={7}>7+ dias</option>
            <option value={15}>15+ dias</option>
            <option value={30}>30+ dias</option>
            <option value={60}>60+ dias</option>
          </select>
        </div>
      </div>

      {resumo && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl p-3 border border-borda text-center">
            <div className="text-[10px] text-texto-fraco uppercase">Devedores</div>
            <div className="font-display text-lg text-azul">{resumo.total_devedores}</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-borda text-center">
            <div className="text-[10px] text-texto-fraco uppercase">Valor Total</div>
            <div className="font-display text-lg text-vermelho">R$ {resumo.valor_total.toFixed(2)}</div>
          </div>
          <div className="bg-white rounded-xl p-3 border border-borda text-center">
            <div className="text-[10px] text-texto-fraco uppercase">Sem WhatsApp</div>
            <div className="font-display text-lg text-amber-700">{resumo.sem_whatsapp}</div>
          </div>
        </div>
      )}

      <details className="bg-white rounded-xl border border-borda p-3 mb-4">
        <summary className="text-sm font-medium cursor-pointer text-texto-fraco">✏ Editar modelo de mensagem</summary>
        <textarea
          value={modelo}
          onChange={e => setModelo(e.target.value)}
          rows={6}
          className="mt-2 w-full bg-white border border-borda rounded-lg px-3 py-2 text-sm font-mono"
        />
        <p className="text-[10px] text-texto-fraco mt-1">
          Variáveis: <code>{'{NOME}'}</code> <code>{'{TOTAL}'}</code> <code>{'{DETALHE}'}</code> <code>{'{DIAS}'}</code>
        </p>
      </details>

      <div className="mb-3 flex justify-end">
        <Button variant="success" onClick={abrirTodos} disabled={!devedores.some(d => d.whatsapp)}>
          📢 Cobrar todos ({devedores.filter(d => d.whatsapp).length})
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-borda overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="bg-azul">
              <th className="px-3 py-2 text-left text-white font-medium">Militar</th>
              <th className="px-3 py-2 text-right text-white font-medium">Cantina</th>
              <th className="px-3 py-2 text-right text-white font-medium">Loja</th>
              <th className="px-3 py-2 text-right text-white font-medium">Café</th>
              <th className="px-3 py-2 text-right text-white font-medium">Ximb</th>
              <th className="px-3 py-2 text-right text-white font-medium">Total</th>
              <th className="px-3 py-2 text-center text-white font-medium">Atraso</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {devedores.map(d => (
              <tr key={d.nome_guerra}>
                <td className="px-3 py-2 font-medium">{d.nome_guerra}</td>
                <td className="px-3 py-2 text-right text-xs text-texto-fraco">{d.cantina > 0 ? `R$ ${d.cantina.toFixed(2)}` : '—'}</td>
                <td className="px-3 py-2 text-right text-xs text-texto-fraco">{d.loja > 0 ? `R$ ${d.loja.toFixed(2)}` : '—'}</td>
                <td className="px-3 py-2 text-right text-xs text-texto-fraco">{d.cafe > 0 ? `R$ ${d.cafe.toFixed(2)}` : '—'}</td>
                <td className="px-3 py-2 text-right text-xs text-texto-fraco">{d.ximboca > 0 ? `R$ ${d.ximboca.toFixed(2)}` : '—'}</td>
                <td className="px-3 py-2 text-right font-bold text-vermelho">R$ {d.total.toFixed(2)}</td>
                <td className={`px-3 py-2 text-center text-xs ${d.dias_atraso > 30 ? 'text-vermelho font-bold' : d.dias_atraso > 7 ? 'text-amber-700' : 'text-texto-fraco'}`}>
                  {d.dias_atraso}d
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => abrirWhatsapp(d)}
                    disabled={!d.whatsapp}
                    className="text-xs px-2 py-1 rounded-lg text-verde bg-green-50 border border-green-200 hover:bg-green-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {d.whatsapp ? '📱 WhatsApp' : 'sem zap'}
                  </button>
                </td>
              </tr>
            ))}
            {devedores.length === 0 && (
              <tr><td colSpan={8} className="text-center py-6 text-texto-fraco">🎉 Nenhum devedor no filtro selecionado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
