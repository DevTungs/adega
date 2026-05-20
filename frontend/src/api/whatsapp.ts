import api from './client';

export const whatsappApi = {
  connect: () => api.post('/whatsapp/connect'),
  disconnect: () => api.post('/whatsapp/disconnect'),
  getStatus: () => api.get('/whatsapp/status'),
  toggleBot: (active: boolean) => api.post('/whatsapp/bot/toggle', { active }),
  sendMessage: (phone: string, message: string) => api.post('/whatsapp/send', { phone, message }),
  getConversations: () => api.get('/whatsapp/conversations'),
  getMessages: (phone: string) => api.get(`/whatsapp/messages/${encodeURIComponent(phone)}`),
};
