import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getConfig } from '../../../services/config';
import { Icon } from '../../../components/ui/Icon';
import { useAcessoAdmin } from '../../../hooks/useAuth';
import type { SalaCafeTipo, PlanoCafe } from '../../../types';
import { ESQUADRAO } from '../../../config/esquadrao';

// ---------- Utilitários puros (usados também nas telas do militar) ----------

export const NOME_SALA_PADRAO: Record<SalaCafeTipo, string> = {
  oficial: ESQUADRAO.salas_cafe.oficial,
  graduado: ESQUADRAO.salas_cafe.graduado,
};

export function nomeSalaCafe(config: Record<string, string>, sala: SalaCafeTipo): string {
  const v = sala === 'oficial' ? config.nome_cafe_oficiais : config.nome_cafe_graduados;
  return (v && v.trim()) || NOME_SALA_PADRAO[sala];
}

export function pixSalaCafe(config: Record<string, string>, sala: SalaCafeTipo) {
  const p = `pix_cafe_${sala}`;
  return {
    chave: config[`${p}_chave`] || '',
    nome: config[`${p}_nome`] || '',
    whatsapp: config[`${p}_whatsapp`] || '',
  };
}

/** Valor padrão configurado para a sala + plano (null se não configurado). */
export function valorPadraoCafe(config: Record<string, string>, sala: SalaCafeTipo, plano: PlanoCafe): number | null {
  const n = parseFloat(config[`cafe_valor_${sala}_${plano}`] || '');
  return n > 0 ? n : null;
}

/** Sala do café que corresponde à categoria do militar (praça = não participa). */
export function salaDaCategoria(categoria: string | null | undefined): SalaCafeTipo | null {
  if (categoria === 'oficial') return 'oficial';
  if (categoria === 'graduado') return 'graduado';
  return null;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** 'YYYY-MM' -> 'out/2026'. Outros formatos voltam como vieram. */
export function mesCurto(ym: string | null | undefined): string {
  if (!ym) return '';
  const [a, m] = ym.split('-');
  const i = parseInt(m || '', 10) - 1;
  if (!a || i < 0 || i > 11) return ym;
  return `${MESES[i]}/${a}`;
}

export function mesAtualYM(): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface RefPagamento { referencia: string; periodo_fim?: string | null; rotulo?: string | null }

/** Cobrança de anuidade? (novo: periodo_fim; antigo: referência só com o ano) */
export function ehAnuidade(p: RefPagamento): boolean {
  return !!p.periodo_fim || /^\d{4}$/.test(p.referencia) || /^anuidade/i.test(p.rotulo || '');
}

/** Texto legível da referência: usa o `rotulo` do servidor quando vier. */
export function rotuloReferencia(p: RefPagamento): string {
  if (p.rotulo) return p.rotulo;
  if (p.periodo_fim) return `Anuidade ${mesCurto(p.referencia)} a ${mesCurto(p.periodo_fim)}`;
  if (/^\d{4}$/.test(p.referencia)) return `Anuidade ${p.referencia}`;
  return mesCurto(p.referencia);
}

// ---------- Sala selecionada no admin (URL ?sala= + localStorage) ----------

const CHAVE_LOCAL = 'cafe_tipo';

function lerLocal(): SalaCafeTipo {
  try {
    const v = localStorage.getItem(CHAVE_LOCAL);
    if (v === 'oficial' || v === 'graduado') return v;
  } catch { /* sem storage */ }
  return 'graduado';
}

/** Sala do café em uso nas telas do admin. Lê ?sala= da URL; sem ela, a última usada. */
export function useSalaCafe(): [SalaCafeTipo, (s: SalaCafeTipo) => void] {
  const [params, setParams] = useSearchParams();
  const { acessoRestritoCafe } = useAcessoAdmin();
  const p = params.get('sala');
  // Responsável só pelo café dos graduados: sempre a sala dos graduados (corrige ?sala=oficial)
  const sala: SalaCafeTipo = acessoRestritoCafe ? 'graduado' : p === 'oficial' || p === 'graduado' ? p : lerLocal();

  useEffect(() => {
    try { localStorage.setItem(CHAVE_LOCAL, sala); } catch { /* sem storage */ }
    if (p !== sala) {
      setParams(prev => { const n = new URLSearchParams(prev); n.set('sala', sala); return n; }, { replace: true });
    }
  }, [sala, p, setParams]);

  const trocar = useCallback((s: SalaCafeTipo) => {
    if (acessoRestritoCafe && s !== 'graduado') return;
    setParams(prev => { const n = new URLSearchParams(prev); n.set('sala', s); return n; }, { replace: true });
  }, [setParams, acessoRestritoCafe]);

  return [sala, trocar];
}

/** Config pública (nomes das salas, PIX, valores padrão), com cache. */
export function useConfigCafe(): Record<string, string> {
  const [config, setConfig] = useState<Record<string, string>>({});
  useEffect(() => {
    let ativo = true;
    getConfig().then(c => { if (ativo) setConfig(c); }).catch(() => {});
    return () => { ativo = false; };
  }, []);
  return config;
}

const ESTILO_SALA: Record<SalaCafeTipo, { ativo: string; faixa: string }> = {
  oficial: { ativo: 'bg-noite text-white shadow-sm', faixa: 'bg-noite text-white' },
  graduado: { ativo: 'bg-faixa text-white shadow-sm', faixa: 'bg-faixa text-white' },
};

/**
 * Seletor de sala do topo das telas do café + faixa "você está vendo a sala X".
 * Fica acima do PageHeader para que a sala seja a primeira coisa vista.
 */
export function SeletorSalaCafe({ sala, onChange, config }: {
  sala: SalaCafeTipo; onChange: (s: SalaCafeTipo) => void; config: Record<string, string>;
}) {
  const nomeAtual = nomeSalaCafe(config, sala);
  const { acessoRestritoCafe } = useAcessoAdmin();
  // Responsável só pelo café dos graduados: sem seletor, apenas a faixa da sala dele
  if (acessoRestritoCafe) {
    return (
      <div className="mb-5">
        <div className={`max-w-xl rounded-xl px-3 py-2 text-sm font-medium flex items-center gap-2 ${ESTILO_SALA.graduado.faixa}`} role="status">
          <Icon name="coffee" size={16} />
          <span className="truncate">Café · {nomeSalaCafe(config, 'graduado')}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="mb-5">
      <div role="radiogroup" aria-label="Sala do café" className="grid grid-cols-2 gap-1 bg-white rounded-2xl p-1 border border-borda shadow-sm max-w-xl">
        {(['oficial', 'graduado'] as const).map(t => {
          const ativo = sala === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => onChange(t)}
              className={`min-h-[44px] px-3 rounded-xl text-sm font-medium transition-colors inline-flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-azul/40 ${
                ativo ? ESTILO_SALA[t].ativo : 'text-texto-fraco hover:bg-fundo hover:text-texto'
              }`}
            >
              <Icon name="coffee" size={16} />
              <span className="truncate">{nomeSalaCafe(config, t)}</span>
            </button>
          );
        })}
      </div>
      <div className={`mt-2 max-w-xl rounded-xl px-3 py-1.5 text-xs font-medium flex items-center gap-2 ${ESTILO_SALA[sala].faixa}`} role="status">
        <span className={`w-1.5 h-4 rounded-full ${sala === 'oficial' ? 'bg-dourado' : 'bg-white/80'}`} aria-hidden="true" />
        Você está vendo: {nomeAtual}
      </div>
    </div>
  );
}
