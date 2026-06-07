import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const hasAccessToken = !!localStorage.getItem('access_token');
    const requestUrl = String(original?.url || '');

    // Do not hard-logout users on every unauthorized endpoint.
    // A role-scoped 401 from one widget should not destroy the whole session.
    // Only redirect to login when there is no token and request is not the login call itself.
    if (status === 401 && !hasAccessToken && !requestUrl.includes('/auth/login/')) {
      window.location.href = '/login';
      return Promise.reject(error);
    }

    let message = 'An unexpected error occurred';
    const data = error.response?.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      message = data.error || data.detail || data.message || message;
      if (message === 'An unexpected error occurred' && Array.isArray(data.non_field_errors)) {
        message = data.non_field_errors[0];
      }
    } else if (typeof data === 'string' && !data.startsWith('<')) {
      message = data;
    }

    if (status !== 401) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;
