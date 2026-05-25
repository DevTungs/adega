import api from './client';

export type LicenseStatus = 'active' | 'expired' | 'blocked' | 'invalid' | 'pending' | 'tampered';

export interface LicenseStatusResponse {
  status: LicenseStatus;
  customerName: string | null;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  lastError: string | null;
  canCreateOrders: boolean;
  message: string | null;
}

export const licenseApi = {
  getStatus: () => api.get<{ success: boolean; data: LicenseStatusResponse }>('/license/status'),
  activate: (licenseKey: string) => api.post<{ success: boolean; data: LicenseStatusResponse; message: string }>('/license/activate', { licenseKey }),
  validate: () => api.post<{ success: boolean; data: LicenseStatusResponse }>('/license/validate'),
};
