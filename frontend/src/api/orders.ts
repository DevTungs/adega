import api from './client';

export const ordersApi = {
  getAll: (params?: { status?: string; order_type?: string; limit?: number; offset?: number }) =>
    api.get('/orders', { params }),

  getById: (id: string) =>
    api.get(`/orders/${id}`),

  create: (data: any) =>
    api.post('/orders', data),

  updateStatus: (id: string, status: string, notes?: string) =>
    api.patch(`/orders/${id}/status`, { status, notes }),

  assignDriver: (id: string, driverId: string) =>
    api.patch(`/orders/${id}/assign`, { driver_id: driverId }),

  cancel: (id: string, reason?: string) =>
    api.post(`/orders/${id}/cancel`, { reason }),

  getTimeline: (id: string) =>
    api.get(`/orders/${id}/timeline`),

  getStats: (dateFrom?: string, dateTo?: string) =>
    api.get('/reports/dashboard', { params: { date_from: dateFrom, date_to: dateTo } }),

  confirmPix: (phone: string) =>
    api.post('/orders/confirm-pix', { phone }),

  rejectPix: (phone: string) =>
    api.post('/orders/reject-pix', { phone }),
};
