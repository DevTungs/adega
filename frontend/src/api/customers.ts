import api from './client';

export const customersApi = {
  getAll: (params?: { search?: string }) =>
    api.get('/customers', { params }),

  getById: (id: string) =>
    api.get(`/customers/${id}`),

  getOrders: (id: string, limit?: number) =>
    api.get(`/customers/${id}/orders`, { params: { limit } }),

  update: (id: string, data: any) =>
    api.patch(`/customers/${id}`, data),

  updateByPhone: (phone: string, data: any) =>
    api.patch(`/customers/phone/${phone}`, data),
};
