// Datas vindas do banco (D1/SQLite): created_at/paid_at chegam em UTC no
// formato "YYYY-MM-DD HH:MM:SS", sem "Z". new Date() direto interpretaria
// como horário local e mostraria o dia/hora errados. Exibição sempre em Brasília.
import { dataLocal } from './periodo';

export const TZ_BR = 'America/Sao_Paulo';

export function parseDataBanco(s: string): Date {
  // Só a data (ex.: data de evento): meio-dia UTC para não "voltar" um dia
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00Z`);
  // Já tem fuso explícito (ISO com Z ou offset)
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(s)) return new Date(s);
  return new Date(s.replace(' ', 'T') + 'Z');
}

export function formatarDataBanco(
  s: string,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }
): string {
  return parseDataBanco(s).toLocaleDateString('pt-BR', { ...opts, timeZone: TZ_BR });
}

export function formatarDataHoraBanco(s: string): string {
  return parseDataBanco(s).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ_BR,
  });
}

// "hoje" / "ontem" / "dd/mm" no fuso de Brasília
export function formatarDiaRelativo(s: string): string {
  const dia = dataLocal(parseDataBanco(s));
  const agora = new Date();
  if (dia === dataLocal(agora)) return 'hoje';
  if (dia === dataLocal(new Date(agora.getTime() - 24 * 60 * 60 * 1000))) return 'ontem';
  return formatarDataBanco(s, { day: '2-digit', month: '2-digit' });
}
