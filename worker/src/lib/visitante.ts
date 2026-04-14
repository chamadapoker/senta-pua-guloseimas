export interface UsuarioVisitanteStatus {
  is_visitante: number;
  expira_em: string | null;
  acesso_pausado: number;
}

export function dataHojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function calcularExpiracaoVisitante(dias = 30): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function visitanteBloqueado(u: UsuarioVisitanteStatus): boolean {
  if (u.is_visitante !== 1) return false;
  if (u.acesso_pausado === 1) return true;
  if (u.expira_em && u.expira_em < dataHojeISO()) return true;
  return false;
}
