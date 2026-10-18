import { create } from 'zustand';
import { api } from '../services/api';

/** Escopo do admin: null = acesso total; 'cafe_graduado' = só o café da sala dos graduados. */
export type EscopoAdmin = 'cafe_graduado' | null;

export interface AdminInfo {
  id: string;
  email: string;
  nome: string;
  role: 'super_admin' | 'admin';
  escopo?: EscopoAdmin;
}

/** Página inicial do admin restrito ao café dos graduados. */
export const HOME_CAFE_GRADUADO = '/admin/cafe?sala=graduado';

// Último escopo conhecido (lembrado entre recargas). Serve só para a interface não
// mostrar o menu completo por um instante enquanto o /api/auth/me não responde;
// quem bloqueia de verdade é o backend.
const CHAVE_ESCOPO = 'admin_escopo';

function lerEscopoSalvo(): EscopoAdmin | undefined {
  try {
    const v = localStorage.getItem(CHAVE_ESCOPO);
    if (v === null) return undefined;
    return v === 'cafe_graduado' ? 'cafe_graduado' : null;
  } catch { return undefined; }
}

function salvarEscopo(e: EscopoAdmin | undefined) {
  try {
    if (e === undefined) localStorage.removeItem(CHAVE_ESCOPO);
    else localStorage.setItem(CHAVE_ESCOPO, e ?? 'total');
  } catch { /* sem storage */ }
}

function normalizarAdmin(a: AdminInfo | null | undefined): AdminInfo | null {
  if (!a) return null;
  return { ...a, escopo: a.escopo === 'cafe_graduado' ? 'cafe_graduado' : null };
}

interface AuthState {
  token: string | null;
  email: string | null;
  admin: AdminInfo | null;
  /** Escopo lembrado da última sessão (undefined = ainda não sabemos). */
  escopoSalvo: EscopoAdmin | undefined;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  email: null,
  admin: null,
  escopoSalvo: lerEscopoSalvo(),
  loading: false,

  login: async (email, senha) => {
    set({ loading: true });
    try {
      const res = await api.post<{ token: string; admin?: AdminInfo }>('/api/auth/login', { email, senha });
      localStorage.setItem('token', res.token);
      const admin = normalizarAdmin(res.admin);
      if (admin) salvarEscopo(admin.escopo ?? null);
      set({ token: res.token, email, admin, escopoSalvo: admin ? admin.escopo ?? null : lerEscopoSalvo(), loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    salvarEscopo(undefined);
    set({ token: null, email: null, admin: null, escopoSalvo: undefined });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const res = await api.get<AdminInfo | { email: string }>('/api/auth/me');
      const adminInfo = 'role' in res ? normalizarAdmin(res as AdminInfo) : null;
      if (adminInfo) salvarEscopo(adminInfo.escopo ?? null);
      set(prev => ({
        token,
        email: res.email,
        admin: adminInfo,
        escopoSalvo: adminInfo ? adminInfo.escopo ?? null : prev.escopoSalvo,
      }));
      return true;
    } catch (e: any) {
      // Só desloga em token inválido/expirado. Erro de rede mantém a sessão.
      // (403 de escopo negado não acontece aqui: /api/auth/me é liberado para todo admin.)
      if ((e?.status === 401 || e?.status === 403) && !e?.escopoNegado) {
        localStorage.removeItem('token');
        salvarEscopo(undefined);
        set({ token: null, email: null, admin: null, escopoSalvo: undefined });
        return false;
      }
      return true;
    }
  },
}));

/** true quando o admin só pode mexer no café dos graduados. */
export function acessoRestritoCafe(admin: AdminInfo | null | undefined): boolean {
  return admin?.escopo === 'cafe_graduado';
}

/**
 * Escopo do admin logado para a interface.
 * - `carregando`: há token de admin, mas ainda não sabemos o escopo (mostre só o mínimo).
 * - `acessoRestritoCafe`: só o café dos graduados.
 */
export function useAcessoAdmin(): { carregando: boolean; acessoRestritoCafe: boolean; escopo: EscopoAdmin | undefined } {
  const token = useAuth(s => s.token);
  const admin = useAuth(s => s.admin);
  const escopoSalvo = useAuth(s => s.escopoSalvo);
  const escopo: EscopoAdmin | undefined = admin ? (admin.escopo ?? null) : escopoSalvo;
  return {
    carregando: !!token && escopo === undefined,
    acessoRestritoCafe: !!token && escopo === 'cafe_graduado',
    escopo,
  };
}

/** Versão fora de componente (ex.: depois do login). */
export function acessoRestritoCafeAgora(): boolean {
  const s = useAuth.getState();
  if (!s.token) return false;
  const escopo = s.admin ? (s.admin.escopo ?? null) : s.escopoSalvo;
  return escopo === 'cafe_graduado';
}
