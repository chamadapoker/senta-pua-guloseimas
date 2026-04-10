import { create } from 'zustand';
import { api } from '../services/api';

interface AuthState {
  token: string | null;
  email: string | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  email: null,
  loading: false,

  login: async (email, senha) => {
    set({ loading: true });
    try {
      const { token } = await api.post<{ token: string }>('/api/auth/login', { email, senha });
      localStorage.setItem('token', token);
      set({ token, email, loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, email: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) return false;
    try {
      const { email } = await api.get<{ email: string }>('/api/auth/me');
      set({ token, email });
      return true;
    } catch {
      localStorage.removeItem('token');
      set({ token: null, email: null });
      return false;
    }
  },
}));
