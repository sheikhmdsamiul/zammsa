import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

function friendlyApiMessage(data: any): string | null {
  const raw = typeof data === 'string'
    ? data
    : data?.error || data?.detail || data?.message || data?.non_field_errors?.[0] || '';

  const text = String(raw || '');
  if (
    text.includes('fiscal_year, department') ||
    text.includes('fiscal year and department') ||
    text.includes('must make a unique set')
  ) {
    return 'An Annual Procurement Plan already exists for the selected fiscal year and department.';
  }

  return text || null;
}

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
      message = friendlyApiMessage(data) || message;
    } else if (typeof data === 'string' && !data.startsWith('<')) {
      message = friendlyApiMessage(data) || data;
    }

    if (status !== 401) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;
