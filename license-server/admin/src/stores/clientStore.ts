import { create } from 'zustand';
import api from '../api/client';

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  gtin_username: string | null;
  gtin_password: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface ClientState {
  clients: Client[];
  isLoading: boolean;
  fetchAll: (includeInactive?: boolean) => Promise<void>;
  create: (data: { name: string; email?: string; phone?: string; notes?: string; gtin_username?: string; gtin_password?: string }) => Promise<Client>;
  update: (id: string, data: { name: string; email?: string; phone?: string; notes?: string; gtin_username?: string; gtin_password?: string }) => Promise<Client>;
  deactivate: (id: string) => Promise<void>;
  activate: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useClientStore = create<ClientState>((set) => ({
  clients: [],
  isLoading: false,

  fetchAll: async (includeInactive = false) => {
    set({ isLoading: true });
    try {
      const params = includeInactive ? '?includeInactive=1' : '';
      const { data } = await api.get(`/clients${params}`);
      set({ clients: data.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  create: async (body) => {
    const { data } = await api.post('/clients', body);
    const client = data.data as Client;
    set((s) => ({ clients: [client, ...s.clients] }));
    return client;
  },

  update: async (id, body) => {
    const { data } = await api.put(`/clients/${id}`, body);
    const client = data.data as Client;
    set((s) => ({ clients: s.clients.map((c) => (c.id === id ? client : c)) }));
    return client;
  },

  deactivate: async (id) => {
    await api.patch(`/clients/${id}/deactivate`);
    set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, is_active: 0 } : c)) }));
  },

  activate: async (id) => {
    await api.patch(`/clients/${id}/activate`);
    set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, is_active: 1 } : c)) }));
  },

  remove: async (id) => {
    await api.delete(`/clients/${id}`);
    set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
  },
}));
