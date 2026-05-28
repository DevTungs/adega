import api from './client';

export const productsApi = {
  getAll: (params?: { category_id?: string; search?: string }) =>
    api.get('/products', { params }),

  getCatalog: () =>
    api.get('/products/catalog'),

  getById: (id: string) =>
    api.get(`/products/${id}`),

  create: (data: any) =>
    api.post('/products', data),

  update: (id: string, data: any) =>
    api.put(`/products/${id}`, data),

  delete: (id: string) =>
    api.delete(`/products/${id}`),

  updateStock: (id: string, quantity: number) =>
    api.patch(`/products/${id}/stock`, { quantity }),

  searchByBarcode: (barcode: string) =>
    api.get(`/products/barcode/${barcode}`).then(res => res.data),
};

export const categoriesApi = {
  getAll: () =>
    api.get('/categories'),

  getById: (id: string) =>
    api.get(`/categories/${id}`),

  create: (data: any) =>
    api.post('/categories', data),

  update: (id: string, data: any) =>
    api.put(`/categories/${id}`, data),

  delete: (id: string) =>
    api.delete(`/categories/${id}`),
};
