import axios from 'axios';

// Detect if running in Electron (file:// protocol)
const isElectron = window.location.protocol === 'file:';
const apiBase = isElectron ? 'http://localhost:3333/api' : '/api';

const api = axios.create({
  baseURL: apiBase,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 402 && error.response?.data?.error === 'LICENSE_REQUIRED') {
      return Promise.reject(error);
    }
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    const isOnLoginPage = window.location.hash.includes('/login') || window.location.pathname.includes('/login');
    if (error.response?.status === 401 && !isLoginRequest && !isOnLoginPage) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
