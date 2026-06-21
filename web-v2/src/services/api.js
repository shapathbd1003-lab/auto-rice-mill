import axios from 'axios';
import { isDesktop } from './desktopAdapter';
import { handleDesktopRequest } from './desktopApi';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  timeout: 30000,
});

if (isDesktop) {
  // In desktop mode replace every request with a SQLite call
  api.interceptors.request.use((config) => {
    const url = (config.url || '').replace(/^\/+/, '');
    const body = config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : {};

    return handleDesktopRequest(config.method, url, body, config.params)
      .then((response) => {
        // Resolve the axios call immediately by throwing a special object
        // that the response interceptor catches and re-returns as success
        return Promise.reject({ __desktop: true, response });
      })
      .catch((err) => {
        if (err?.__desktop) return Promise.reject(err);
        return Promise.reject(new Error(err?.message || 'Desktop DB error'));
      });
  });

  api.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err?.__desktop) return Promise.resolve(err.response);
      return Promise.reject(err);
    }
  );
} else {
  // Web mode: attach JWT + auto-refresh on 401
  api.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  let isRefreshing = false;
  let failedQueue = [];
  const processQueue = (error, token = null) => {
    failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
    failedQueue = [];
  };

  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const original = error.config;
      // Don't auto-refresh for auth endpoints — let the error bubble up
      const isAuthEndpoint = original.url?.includes('/auth/login') || original.url?.includes('/auth/logout');
      if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
            .then((token) => { original.headers.Authorization = `Bearer ${token}`; return api(original); });
        }
        original._retry = true;
        isRefreshing = true;
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          const baseURL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
          const { data } = await axios.post(`${baseURL}/v2/auth/refresh`, { refreshToken });
          const newToken = data.data.token;
          sessionStorage.setItem('token', newToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          processQueue(null, newToken);
          return api(original);
        } catch (err) {
          processQueue(err, null);
          localStorage.clear();
          sessionStorage.clear();
          window.location.href = window.location.pathname + '#/login';
          return Promise.reject(err);
        } finally {
          isRefreshing = false;
        }
      }
      return Promise.reject(error);
    }
  );
}

export default api;
