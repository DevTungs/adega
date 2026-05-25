import { create } from 'zustand';
import api from '../api/client';

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface ClientState {
  clients: Client[];
  isLoading: boolean;
  fetchAll: () => Promise<void>;
  create: (data: { name: string; email?: string; phone?: string; notes?: string }) => Promise<Client>;
  update: (id: string, data: { name: string; email?: string; phone?: string; notes?: string }) => Promise<Client>;
  remove: (id: string) => Promise<void>;
}

export const useClientStore = create<ClientState>((set) => ({
  clients: [],
  isLoading: false,

  fetchAll: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/clients');
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

  remove: async (id) => {
    await api.delete(`/clients/${id}`);
    set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
  },
}));
