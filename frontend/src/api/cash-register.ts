import api from './client';

export const cashRegisterApi = {
  getCurrent: () =>
    api.get('/cash-register/current'),

  open: (opening_amount: number) =>
    api.post('/cash-register/open', { opening_amount }),

  close: (closing_amount: number) =>
    api.post('/cash-register/close', { closing_amount }),

  addMovement: (type: 'sangria' | 'suprimento', amount: number, description?: string) =>
    api.post('/cash-register/movement', { type, amount, description }),

  getSummary: (id: string) =>
    api.get(`/cash-register/${id}/summary`),
};
