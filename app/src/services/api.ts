import { useAuth } from '../hooks/useAuth';
import { useUserAuth } from '../hooks/useUserAuth';

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
  // Rotas só de admin chamadas também fora de /admin (ex.: contador do menu)
  if (path.startsWith('/api/comprovantes/pendentes')) return adminToken;
  if (path.startsWith('/api/notificacoes/admin')) return adminToken;
  if (path.startsWith('/api/cafe/admin')) return adminToken;
  if (path.startsWith('/api/loja/admin')) return adminToken;

  // Comprovantes: POST (upload) é do usuário; o resto (fila/aprovação) é admin.
  if (path === '/api/comprovantes' && method === 'POST') return userToken || adminToken;
  if (path === '/api/comprovantes/me') return userToken;
  if (path.startsWith('/api/notificacoes/me')) return userToken;
  if (path.startsWith('/api/ximboca/checkin')) return userToken;

  // Rotas não mapeadas: dentro da área admin usa o token admin; no resto do
  // app (lado do usuário) prefere o token de usuário.
  const naAreaAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  if (naAreaAdmin) return adminToken || userToken;
  return userToken || adminToken;
}

function handleAdminUnauthorized() {
  useAuth.getState().logout();
  if (typeof window === 'undefined') return;
  const p = window.location.pathname;
  // Só redireciona dentro da área admin (e nunca a partir da própria tela de login).
  if (p.startsWith('/admin') && !p.startsWith('/admin/login')) {
    window.location.replace('/admin/login');
  }
}

function handleUserUnauthorized() {
  useUserAuth.getState().logout();
  if (typeof window === 'undefined') return;
  const p = window.location.pathname;
  // Não redireciona da área admin, das telas de login/cadastro (evita loop)
  // nem de páginas públicas que funcionam sem conta.
  const semRedirect = ['/admin', '/login', '/cadastro', '/privacidade', '/acesso-expirado', '/e/'];
  if (semRedirect.some((r) => p.startsWith(r))) return;
  window.location.replace('/login');
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
    // 401 numa requisição autenticada com o token de admin = sessão admin expirou.
    // Login do admin fica de fora (senha errada não é sessão expirada).
    if (
      res.status === 401 &&
      token &&
      token === localStorage.getItem('token') &&
      !path.startsWith('/api/auth/login')
    ) {
      handleAdminUnauthorized();
    } else if (
      res.status === 401 &&
      token &&
      token === localStorage.getItem('user_token')
    ) {
      // Sessão do usuário expirou/foi invalidada.
      handleUserUnauthorized();
    }
    const error: any = new Error(body.error || `HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string, data?: unknown) =>
    request<T>(path, data === undefined ? { method: 'DELETE' } : { method: 'DELETE', body: JSON.stringify(data) }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', body: formData }),
};
