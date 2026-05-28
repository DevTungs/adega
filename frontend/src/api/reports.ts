import api from './client';

export const reportsApi = {
  getSales: (params?: { period?: string; date_from?: string; date_to?: string }) =>
    api.get('/reports/sales', { params }),

  getTopProducts: (params?: { limit?: number; sort?: string; date_from?: string; date_to?: string }) =>
    api.get('/reports/products/top', { params }),

  getCategories: (params?: { date_from?: string; date_to?: string }) =>
    api.get('/reports/categories', { params }),

  getTopCustomers: (params?: { limit?: number }) =>
    api.get('/reports/customers/top', { params }),

  getInventoryValuation: () =>
    api.get('/reports/inventory/valuation'),

  getLowStock: () =>
    api.get('/reports/inventory/low-stock'),

  getInventoryByCategory: () =>
    api.get('/reports/inventory/by-category'),

  getProfit: (params?: { date_from?: string; date_to?: string }) =>
    api.get('/reports/profit', { params }),

  getHours: (params?: { date_from?: string; date_to?: string }) =>
    api.get('/reports/hours', { params }),

  getComparison: (params?: { date_from?: string; date_to?: string }) =>
    api.get('/reports/comparison', { params }),
};
