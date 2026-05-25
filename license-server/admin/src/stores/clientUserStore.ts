import { create } from 'zustand';
import api from '../api/client';

export interface ClientUser {
  id: string;
  client_id: string | null;
  username: string;
  name: string | null;
  role: string;
  is_active: number;
  client_name: string | null;
  created_at: string;
  updated_at: string;
}

interface ClientUserState {
  users: ClientUser[];
  isLoading: boolean;
  fetchAll: () => Promise<void>;
  create: (data: { client_id?: string | null; username: string; password: string; name?: string; role?: string }) => Promise<ClientUser>;
  update: (id: string, data: { client_id?: string | null; username: string; password?: string; name?: string; role?: string }) => Promise<ClientUser>;
  remove: (id: string) => Promise<void>;
}

export const useClientUserStore = create<ClientUserState>((set) => ({
  users: [],
  isLoading: false,

  fetchAll: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/client-users');
      set({ users: data.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  create: async (body) => {
    const { data } = await api.post('/client-users', body);
    const user = data.data as ClientUser;
    set((s) => ({ users: [user, ...s.users] }));
    return user;
  },

  update: async (id, body) => {
    const { data } = await api.put(`/client-users/${id}`, body);
    const user = data.data as ClientUser;
    set((s) => ({ users: s.users.map((u) => (u.id === id ? user : u)) }));
    return user;
  },

  remove: async (id) => {
    await api.delete(`/client-users/${id}`);
    set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
  },
}));
