import { create } from 'zustand';
import api from '../api/client';

export interface DashboardStats {
  totalClients: number;
  activeClients: number;
  totalLicenses: number;
  activeLicenses: number;
  expiredLicenses: number;
  blockedLicenses: number;
  pendingLicenses: number;
  recentActivations: {
    id: string;
    license_id: string;
    machine_fingerprint: string;
    action: string;
    result: string;
    message: string | null;
    created_at: string;
    license_key?: string;
    client_name?: string;
  }[];
}

interface DashboardState {
  stats: DashboardStats | null;
  isLoading: boolean;
  fetchStats: () => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: null,
  isLoading: false,

  fetchStats: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/stats');
      set({ stats: data.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
}));
