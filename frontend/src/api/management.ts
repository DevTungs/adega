import api from './client';

export const couponsApi = {
  getAll: () => api.get('/coupons'),
  getById: (id: string) => api.get(`/coupons/${id}`),
  create: (data: any) => api.post('/coupons', data),
  update: (id: string, data: any) => api.put(`/coupons/${id}`, data),
  delete: (id: string) => api.delete(`/coupons/${id}`),
  validate: (data: { code: string; order_total: number; customer_id?: string }) =>
    api.post('/coupons/validate', data),
};

export const promotionsApi = {
  getAll: () => api.get('/promotions'),
  getActive: () => api.get('/promotions/active'),
  getById: (id: string) => api.get(`/promotions/${id}`),
  create: (data: any) => api.post('/promotions', data),
  update: (id: string, data: any) => api.put(`/promotions/${id}`, data),
  delete: (id: string) => api.delete(`/promotions/${id}`),
};

export const suppliersApi = {
  getAll: (params?: { search?: string }) => api.get('/suppliers', { params }),
  getById: (id: string) => api.get(`/suppliers/${id}`),
  create: (data: any) => api.post('/suppliers', data),
  update: (id: string, data: any) => api.put(`/suppliers/${id}`, data),
  delete: (id: string) => api.delete(`/suppliers/${id}`),
};

export const driversApi = {
  getAll: () => api.get('/drivers'),
  getById: (id: string) => api.get(`/drivers/${id}`),
  create: (data: any) => api.post('/drivers', data),
  update: (id: string, data: any) => api.put(`/drivers/${id}`, data),
  delete: (id: string) => api.delete(`/drivers/${id}`),
  toggleAvailability: (id: string) => api.patch(`/drivers/${id}/availability`),
};
