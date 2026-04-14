const BASE_URL = import.meta.env.VITE_WORKER_URL || '';

function pickToken(path: string, method?: string): string | null {
  const adminToken = localStorage.getItem('token');
  const userToken = localStorage.getItem('user_token');

  if (path.startsWith('/api/usuarios/me')) return userToken;
  if (path === '/api/usuarios/login' || path === '/api/usuarios/cadastro' || path === '/api/usuarios/cadastro/visitante') return null;

  if (path.startsWith('/api/auth')) return adminToken;
  if (path.startsWith('/api/usuarios/admin')) return adminToken;
  if (path.startsWith('/api/admin')) return adminToken;
  if (path.startsWith('/api/admins')) return adminToken;

  // Comprovantes: user para upload/próprios, admin para fila/aprovação
  if (path === '/api/comprovantes' && (method === 'POST' || !method)) {
    // Upload é do usuário; listagem (GET) é admin — só que GET admin cai no else abaixo
    if (method === 'POST') return userToken || adminToken;
  }
  if (path === '/api/comprovantes/me') return userToken;

  return adminToken || userToken;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (options?.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const token = pickToken(path, options?.method);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Erro desconhecido' })) as { error?: string; acesso_bloqueado?: boolean };
    if (res.status === 403 && body.acesso_bloqueado) {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/acesso-expirado')) {
        window.location.href = '/acesso-expirado';
      }
    }
    throw new Error(body.error || `HTTP ${res.status}`);
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
