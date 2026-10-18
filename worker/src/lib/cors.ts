import { ESQUADRAO_PADRAO } from './esquadrao';

// Origens permitidas no CORS: url_app do esquadrão (config) + localhost do Vite.
// FRONTEND_URL só entra se estiver definido e não vazio (nunca "undefined" na lista);
// barra final removida para casar com o header Origin.
const LOCALHOST = 'http://localhost:5173';

function semBarraFinal(u: string): string {
  return u.trim().replace(/\/+$/, '');
}

export function origensPermitidas(
  frontendUrl: string | undefined | null,
  urlApp: string = ESQUADRAO_PADRAO.url_app,
): string[] {
  const app = semBarraFinal(urlApp);
  const fixas = app && app !== LOCALHOST ? [app, LOCALHOST] : [LOCALHOST];
  const extra = typeof frontendUrl === 'string' ? semBarraFinal(frontendUrl) : '';
  return extra && !fixas.includes(extra) ? [extra, ...fixas] : [...fixas];
}
