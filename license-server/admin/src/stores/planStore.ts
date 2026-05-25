import { create } from 'zustand';
import api from '../api/client';

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  duration_days: number;
  grace_days: number;
  price: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface PlanState {
  plans: Plan[];
  isLoading: boolean;
  fetchAll: () => Promise<void>;
  create: (data: { name: string; description?: string; duration_days: number; grace_days: number; price: number }) => Promise<Plan>;
  update: (id: string, data: { name: string; description?: string; duration_days: number; grace_days: number; price: number }) => Promise<Plan>;
  remove: (id: string) => Promise<void>;
}

export const usePlanStore = create<PlanState>((set) => ({
  plans: [],
  isLoading: false,

  fetchAll: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/plans');
      set({ plans: data.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  create: async (body) => {
    const { data } = await api.post('/plans', body);
    const plan = data.data as Plan;
    set((s) => ({ plans: [plan, ...s.plans] }));
    return plan;
  },

  update: async (id, body) => {
    const { data } = await api.put(`/plans/${id}`, body);
    const plan = data.data as Plan;
    set((s) => ({ plans: s.plans.map((p) => (p.id === id ? plan : p)) }));
    return plan;
  },

  remove: async (id) => {
    await api.delete(`/plans/${id}`);
    set((s) => ({ plans: s.plans.filter((p) => p.id !== id) }));
  },
}));
