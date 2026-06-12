import { api } from './api';

// Cache das configurações públicas (chaves PIX, nomes das salas, etc.).
// Evita refetch de /api/config a cada navegação de página.
let cache: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

export async function getConfig(): Promise<Record<string, string>> {
  if (cache) return cache;
  if (!inflight) {
    inflight = api.get<Record<string, string>>('/api/config')
      .then((c) => { cache = c; inflight = null; return c; })
      .catch((e) => { inflight = null; throw e; });
  }
  return inflight;
}

// Chamar após salvar config no admin, para que as próximas leituras venham frescas.
export function clearConfigCache(): void {
  cache = null;
  inflight = null;
}
