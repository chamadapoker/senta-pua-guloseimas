const BASE_URL = import.meta.env.VITE_WORKER_URL || '';

function pickToken(path: string): string | null {
  const adminToken = localStorage.getItem('token');
  const userToken = localStorage.getItem('user_token');

  // User-only routes
  if (path.startsWith('/api/usuarios/me')) return userToken;
  if (path === '/api/usuarios/login' || path === '/api/usuarios/cadastro') return null;

  // Admin-only routes
  if (path.startsWith('/api/auth')) return adminToken;
  if (path.startsWith('/api/usuarios/admin')) return adminToken;

  // Admin-prefixed routes (dashboard, etc)
  if (path.startsWith('/api/admin')) return adminToken;

  // For other /api/* routes: prefer admin token if present (admin actions), else user token for public endpoints that can accept auth
  return adminToken || userToken;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (options?.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const token = pickToken(path);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', body: formData }),
};
