import api from './client';

export const stockApi = {
  getMovements: (params?: {
    product_id?: string;
    type?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/stock/movements', { params }),

  getByProduct: (productId: string) =>
    api.get(`/stock/movements/product/${productId}`),

  getSummary: () =>
    api.get('/stock/summary'),

  receiveStock: (data: {
    product_id: string;
    quantity: number;
    cost_price?: number;
    supplier_name?: string;
    notes?: string;
    invoice_number?: string;
  }) => api.post('/stock/receive', data),
};
