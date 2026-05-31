import { create } from 'zustand';
import { licenseApi, LicenseStatusResponse } from '../api/license';

interface LicenseState {
  license: LicenseStatusResponse | null;
  isLoading: boolean;
  fetchStatus: () => Promise<void>;
  activate: (licenseKey: string) => Promise<void>;
  validateNow: () => Promise<LicenseStatusResponse>;
}

export const useLicenseStore = create<LicenseState>((set) => ({
  license: null,
  isLoading: false,

  fetchStatus: async () => {
    set({ isLoading: true });
    try {
      const { data } = await licenseApi.getStatus();
      set({ license: data.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  activate: async (licenseKey) => {
    set({ isLoading: true });
    try {
      const { data } = await licenseApi.activate(licenseKey);
      set({ license: data.data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  validateNow: async () => {
    set({ isLoading: true });
    try {
      const { data } = await licenseApi.validate();
      set({ license: data.data, isLoading: false });
      return data.data;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
}));
