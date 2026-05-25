import { create } from 'zustand';
import api from '../api/client';

interface Admin {
  id: string;
  username: string;
  name: string;
}

interface AuthState {
  token: string | null;
  admin: Admin | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('admin_token'),
  admin: null,
  isLoading: false,

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { username, password });
      const { token, admin } = data.data;
      localStorage.setItem('admin_token', token);
      set({ token, admin, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('admin_token');
    set({ token: null, admin: null });
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ admin: data.data });
    } catch {
      localStorage.removeItem('admin_token');
      set({ token: null, admin: null });
    }
  },
}));
