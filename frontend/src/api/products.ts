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

  // Variants
  getVariants: (productId: string) =>
    api.get(`/products/${productId}/variants`).then(res => res.data),

  createVariant: (data: any) =>
    api.post('/variants', data).then(res => res.data),

  updateVariant: (id: string, data: any) =>
    api.put(`/variants/${id}`, data).then(res => res.data),

  deleteVariant: (id: string) =>
    api.delete(`/variants/${id}`).then(res => res.data),

  // Modifiers
  getModifiers: (productId: string) =>
    api.get(`/products/${productId}/modifiers`).then(res => res.data),

  createModifier: (data: any) =>
    api.post('/modifiers', data).then(res => res.data),

  updateModifier: (id: string, data: any) =>
    api.put(`/modifiers/${id}`, data).then(res => res.data),

  deleteModifier: (id: string) =>
    api.delete(`/modifiers/${id}`).then(res => res.data),

  // Modifier Options
  createModifierOption: (data: any) =>
    api.post('/modifier-options', data).then(res => res.data),

  updateModifierOption: (id: string, data: any) =>
    api.put(`/modifier-options/${id}`, data).then(res => res.data),

  deleteModifierOption: (id: string) =>
    api.delete(`/modifier-options/${id}`).then(res => res.data),
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
