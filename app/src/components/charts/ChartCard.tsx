import { useState, type ReactNode } from 'react';
import { Icon } from '../ui/Icon';
import { brl } from './tema';

export interface LinhaTabela {
  rotulo: string;
  valores: (string | number)[];
}

interface Props {
  titulo: string;
  subtitulo?: string;
  legenda?: { cor: string; nome: string }[];
  // Visão em tabela (acessível e para quem não distingue as cores)
  tabela?: { colunas: string[]; linhas: LinhaTabela[] };
  vazio?: boolean;
  textoVazio?: string;
  acao?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function ChartCard({ titulo, subtitulo, legenda, tabela, vazio, textoVazio, acao, className = '', children }: Props) {
  const [verTabela, setVerTabela] = useState(false);

  return (
    <section className={`bg-white border border-borda rounded-2xl shadow-sm p-4 sm:p-5 min-w-0 flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-noite leading-tight">{titulo}</h2>
          {subtitulo && <p className="text-xs text-texto-fraco mt-1">{subtitulo}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {acao}
          {tabela && !vazio && (
            <button
              onClick={() => setVerTabela(v => !v)}
              className="h-8 px-2.5 rounded-lg text-xs font-medium text-texto-fraco hover:text-texto hover:bg-fundo border border-transparent hover:border-borda outline-none focus-visible:ring-2 focus-visible:ring-azul/40 inline-flex items-center gap-1"
              aria-pressed={verTabela}
            >
              <Icon name={verTabela ? 'chart' : 'note'} size={14} />
              {verTabela ? 'Gráfico' : 'Tabela'}
            </button>
          )}
        </div>
      </div>

      {legenda && legenda.length > 1 && !vazio && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-3" aria-label="Legenda">
          {legenda.map(l => (
            <li key={l.nome} className="inline-flex items-center gap-1.5 text-xs text-texto">
              <span className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: l.cor }} aria-hidden="true" />
              {l.nome}
            </li>
          ))}
        </ul>
      )}

      <div className="flex-1 min-h-0">
        {vazio ? (
          <div className="h-full min-h-[160px] flex items-center justify-center text-center text-sm text-texto-fraco px-4">
            {textoVazio || 'Sem dados no período.'}
          </div>
        ) : verTabela && tabela ? (
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-xs text-texto-fraco">
                  {tabela.colunas.map((c, i) => (
                    <th key={c} className={`py-2 pr-3 font-medium ${i > 0 ? 'text-right' : ''}`}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabela.linhas.map(l => (
                  <tr key={l.rotulo} className="border-t border-borda">
                    <td className="py-1.5 pr-3 text-texto">{l.rotulo}</td>
                    {l.valores.map((v, i) => (
                      <td key={i} className="py-1.5 pr-3 text-right tabular-nums text-texto">{typeof v === 'number' ? brl(v) : v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

// Tooltip padrão (Recharts): fundo azul-noite, cada linha com amostra da cor, nome e valor
interface TooltipItem { name?: string; value?: number; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }
export function TooltipNoite({ active, payload, label, formatarValor = brl, rotulo }: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
  formatarValor?: (v: number) => string;
  rotulo?: (label: string, payload?: TooltipItem[]) => string;
}) {
  if (!active || !payload?.length) return null;
  const itens = payload.filter(p => p.value !== undefined && p.value !== null);
  const total = itens.reduce((s, p) => s + (Number(p.value) || 0), 0);
  return (
    <div className="bg-noite text-white rounded-xl shadow-flutua px-3.5 py-2.5 text-[13px] min-w-[150px] pointer-events-none">
      <div className="text-[11px] text-noite-fraco mb-1.5">{rotulo ? rotulo(String(label ?? ''), payload) : label}</div>
      {itens.map(p => (
        <div key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-4 leading-6">
          <span className="inline-flex items-center gap-1.5 text-noite-texto">
            <span className="w-2 h-2 rounded-[2px]" style={{ backgroundColor: p.color }} aria-hidden="true" />
            {p.name}
          </span>
          <span className="font-semibold tabular-nums">{formatarValor(Number(p.value) || 0)}</span>
        </div>
      ))}
      {itens.length > 1 && (
        <div className="flex items-center justify-between gap-4 leading-6 border-t border-white/10 mt-1 pt-1">
          <span className="text-noite-texto">Total</span>
          <span className="font-semibold tabular-nums">{formatarValor(total)}</span>
        </div>
      )}
    </div>
  );
}

// Barras horizontais em HTML (rótulo + barra + valor) — leitura direta, sem depender da cor
export function BarrasHorizontais({ itens, cor, formatar = brl }: {
  itens: { rotulo: string; valor: number; detalhe?: string; cor?: string }[];
  cor: string;
  formatar?: (v: number) => string;
}) {
  const max = Math.max(...itens.map(i => i.valor), 0) || 1;
  return (
    <ul className="space-y-2.5">
      {itens.map(i => (
        <li key={i.rotulo} className="group">
          <div className="flex items-baseline justify-between gap-3 text-sm mb-1">
            <span className="text-texto truncate">{i.rotulo}</span>
            <span className="tabular-nums text-texto font-semibold shrink-0">
              {formatar(i.valor)}
              {i.detalhe && <span className="text-xs text-texto-fraco font-normal ml-1.5">{i.detalhe}</span>}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-fundo overflow-hidden" aria-hidden="true">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: i.valor > 0 ? `${Math.max(2, (i.valor / max) * 100)}%` : '0%', backgroundColor: i.cor ?? cor }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
