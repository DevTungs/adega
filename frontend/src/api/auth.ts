import api from './client';

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),

  getProfile: () =>
    api.get('/auth/me'),

  logout: () =>
    api.post('/auth/logout'),
};
