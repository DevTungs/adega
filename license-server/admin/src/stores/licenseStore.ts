import { create } from 'zustand';
import api from '../api/client';

export interface License {
  id: string;
  license_key: string;
  client_id: string;
  plan_id: string;
  status: 'active' | 'expired' | 'blocked' | 'pending';
  machine_fingerprint: string | null;
  max_machines: number;
  active_machines: number;
  activated_at: string | null;
  expires_at: string;
  last_validated_at: string | null;
  created_at: string;
  updated_at: string;
  client_name: string;
  plan_name: string;
}

export interface ActivationLog {
  id: string;
  license_id: string;
  machine_fingerprint: string;
  action: string;
  result: string;
  message: string | null;
  created_at: string;
}

interface LicenseState {
  licenses: License[];
  currentLicense: License | null;
  activationLogs: ActivationLog[];
  isLoading: boolean;
  fetchAll: (filters?: { status?: string; client_id?: string }) => Promise<void>;
  fetchById: (id: string) => Promise<void>;
  fetchLogs: (id: string) => Promise<void>;
  create: (data: { client_id: string; plan_id: string; expires_at: string; max_machines?: number }) => Promise<License>;
  renew: (id: string, expires_at: string) => Promise<License>;
  block: (id: string) => Promise<License>;
  unblock: (id: string) => Promise<License>;
  remove: (id: string) => Promise<void>;
}

export const useLicenseStore = create<LicenseState>((set) => ({
  licenses: [],
  currentLicense: null,
  activationLogs: [],
  isLoading: false,

  fetchAll: async (filters) => {
    set({ isLoading: true });
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.client_id) params.set('client_id', filters.client_id);
      const { data } = await api.get(`/licenses?${params.toString()}`);
      set({ licenses: data.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  fetchById: async (id) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/licenses/${id}`);
      set({ currentLicense: data.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  fetchLogs: async (id) => {
    try {
      const { data } = await api.get(`/licenses/${id}/activations`);
      set({ activationLogs: data.data });
    } catch (error) {
      throw error;
    }
  },

  create: async (body) => {
    const { data } = await api.post('/licenses', body);
    const license = data.data as License;
    set((s) => ({ licenses: [license, ...s.licenses] }));
    return license;
  },

  renew: async (id, expires_at) => {
    const { data } = await api.patch(`/licenses/${id}/renew`, { expires_at });
    const license = data.data as License;
    set((s) => ({
      licenses: s.licenses.map((l) => (l.id === id ? license : l)),
      currentLicense: s.currentLicense?.id === id ? license : s.currentLicense,
    }));
    return license;
  },

  block: async (id) => {
    const { data } = await api.patch(`/licenses/${id}/block`);
    const license = data.data as License;
    set((s) => ({
      licenses: s.licenses.map((l) => (l.id === id ? license : l)),
      currentLicense: s.currentLicense?.id === id ? license : s.currentLicense,
    }));
    return license;
  },

  unblock: async (id) => {
    const { data } = await api.patch(`/licenses/${id}/unblock`);
    const license = data.data as License;
    set((s) => ({
      licenses: s.licenses.map((l) => (l.id === id ? license : l)),
      currentLicense: s.currentLicense?.id === id ? license : s.currentLicense,
    }));
    return license;
  },

  remove: async (id) => {
    await api.delete(`/licenses/${id}`);
    set((s) => ({
      licenses: s.licenses.filter((l) => l.id !== id),
      currentLicense: s.currentLicense?.id === id ? null : s.currentLicense,
    }));
  },
}));
