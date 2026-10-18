// Origens permitidas no CORS. FRONTEND_URL só entra se estiver definido e não vazio
// (nunca "undefined" na lista); barra final removida para casar com o header Origin.
const ORIGENS_FIXAS = ['https://app-senta-pua.pages.dev', 'http://localhost:5173'];

export function origensPermitidas(frontendUrl: string | undefined | null): string[] {
  const extra = typeof frontendUrl === 'string' ? frontendUrl.trim().replace(/\/+$/, '') : '';
  return extra && !ORIGENS_FIXAS.includes(extra) ? [extra, ...ORIGENS_FIXAS] : [...ORIGENS_FIXAS];
}
