import { create } from 'zustand';
import { api } from '../services/api';
import type { Usuario } from '../types';

interface CadastroData {
  email: string;
  senha: string;
  trigrama: string;
  saram: string;
  whatsapp: string;
  categoria: 'oficial' | 'graduado' | 'praca';
  aceite_lgpd: boolean;
}

interface CadastroVisitanteData extends CadastroData {
  esquadrao_origem: string;
}

interface UserAuthState {
  token: string | null;
  user: Usuario | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  cadastrar: (dados: CadastroData) => Promise<void>;
  cadastrarVisitante: (dados: CadastroVisitanteData) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
  updateProfile: (dados: { whatsapp?: string; saram?: string }) => Promise<void>;
  updateFoto: (file: File) => Promise<void>;
  removeFoto: () => Promise<void>;
  excluirConta: () => Promise<void>;
}

export const useUserAuth = create<UserAuthState>((set, get) => ({
  token: localStorage.getItem('user_token'),
  user: null,
  loading: false,

  login: async (email, senha) => {
    set({ loading: true });
    try {
      const { token, user } = await api.post<{ token: string; user: Usuario }>(
        '/api/usuarios/login',
        { email, senha }
      );
      localStorage.setItem('user_token', token);
      set({ token, user, loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  cadastrar: async (dados) => {
    set({ loading: true });
    try {
      const { token, user } = await api.post<{ token: string; user: Usuario }>(
        '/api/usuarios/cadastro',
        dados
      );
      localStorage.setItem('user_token', token);
      set({ token, user, loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  cadastrarVisitante: async (dados) => {
    set({ loading: true });
    try {
      const { token, user } = await api.post<{ token: string; user: Usuario }>(
        '/api/usuarios/cadastro/visitante',
        dados
      );
      localStorage.setItem('user_token', token);
      set({ token, user, loading: false });
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  logout: () => {
    localStorage.removeItem('user_token');
    set({ token: null, user: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('user_token');
    if (!token) return false;
    try {
      const user = await api.get<Usuario>('/api/usuarios/me');
      set({ token, user });
      return true;
    } catch {
      localStorage.removeItem('user_token');
      set({ token: null, user: null });
      return false;
    }
  },

  updateProfile: async (dados) => {
    const user = await api.put<Usuario>('/api/usuarios/me', dados);
    set({ user });
  },

  updateFoto: async (file) => {
    const formData = new FormData();
    formData.append('foto', file);
    const { foto_url } = await api.upload<{ foto_url: string }>('/api/usuarios/me/foto', formData);
    const current = get().user;
    if (current) set({ user: { ...current, foto_url } });
  },

  removeFoto: async () => {
    await api.delete('/api/usuarios/me/foto');
    const current = get().user;
    if (current) set({ user: { ...current, foto_url: null } });
  },

  excluirConta: async () => {
    await api.delete('/api/usuarios/me');
    localStorage.removeItem('user_token');
    set({ token: null, user: null });
  },
}));
