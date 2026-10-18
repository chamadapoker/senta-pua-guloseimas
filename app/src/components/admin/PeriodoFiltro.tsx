import { useSearchParams } from 'react-router-dom';
import { inputClass } from '../ui/Field';
import {
  atalhoAtivo,
  periodoDaUrl,
  periodoDoAtalho,
  type AtalhoPeriodo,
  type Periodo,
} from '../../services/periodo';

const ATALHOS: { id: AtalhoPeriodo; label: string }[] = [
  { id: 'mes', label: 'Este mês' },
  { id: 'mes_passado', label: 'Mês passado' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: 'tudo', label: 'Tudo' },
];

// Período guardado na URL (?de=&ate=) para sobreviver a recarregar e ir/voltar do extrato
export function usePeriodoUrl(): [Periodo, (p: Periodo) => void] {
  const [params, setParams] = useSearchParams();
  const periodo = periodoDaUrl(params);
  const setPeriodo = (p: Periodo) => {
    const next = new URLSearchParams(params);
    if (p.de) next.set('de', p.de); else next.delete('de');
    if (p.ate) next.set('ate', p.ate); else next.delete('ate');
    setParams(next, { replace: true });
  };
  return [periodo, setPeriodo];
}

interface Props {
  periodo: Periodo;
  onChange: (p: Periodo) => void;
  className?: string;
}

export function PeriodoFiltro({ periodo, onChange, className = '' }: Props) {
  const ativo = atalhoAtivo(periodo);
  const invertido = !!(periodo.de && periodo.ate && periodo.de > periodo.ate);

  return (
    <div className={`bg-white rounded-xl border border-borda p-3 ${className}`}>
      <div className="flex gap-1 flex-wrap mb-3">
        {ATALHOS.map(a => (
          <button
            key={a.id}
            onClick={() => onChange(periodoDoAtalho(a.id))}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              ativo === a.id ? 'bg-azul text-white' : 'bg-white text-texto-fraco border border-borda hover:text-texto'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-texto-fraco">
          De
          <input
            type="date"
            value={periodo.de}
            max={periodo.ate || undefined}
            onChange={e => onChange({ ...periodo, de: e.target.value })}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-xs text-texto-fraco">
          Até
          <input
            type="date"
            value={periodo.ate}
            min={periodo.de || undefined}
            onChange={e => onChange({ ...periodo, ate: e.target.value })}
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>
      {invertido && <p className="text-xs text-vermelho mt-2">A data inicial é depois da final.</p>}
    </div>
  );
}
