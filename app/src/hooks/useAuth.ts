import { create } from 'zustand';
import { api } from '../services/api';

interface AdminInfo {
  id: string;
  email: string;
  nome: string;
  role: 'super_admin' | 'admin';
}

interface AuthState {
  token: string | null;
  email: string | null;
  admin: AdminInfo | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  email: null,
  admin: null,
  loading: false,

  login: async (email, senha) => {
    set({ loading: true });
    try {
      const res = await api.post<{ token: string; admin?: AdminInfo }>('/api/auth/login', { email, senha });
      localStorage.setItem('token', res.token);
      set({ token: res.token, email, admin: res.admin || null, loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, email: null, admin: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const res = await api.get<AdminInfo | { email: string }>('/api/auth/me');
      const adminInfo = 'role' in res ? res as AdminInfo : null;
      set({ token, email: res.email, admin: adminInfo });
      return true;
    } catch {
      localStorage.removeItem('token');
      set({ token: null, email: null, admin: null });
      return false;
    }
  },
}));
