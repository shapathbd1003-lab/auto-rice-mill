import axios from 'axios';
import { isDesktop } from './desktopAdapter';
import { handleDesktopRequest } from './desktopApi';

const BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

if (isDesktop) {
  api.interceptors.request.use((config) => {
    const url = (config.url || '').replace(/^\/+/, '');
    const body = config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : {};
    return handleDesktopRequest(config.method, url, body, config.params)
      .then((response) => Promise.reject({ __desktop: true, response }))
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
  // Attach JWT to every request
  api.interceptors.request.use((config) => {
    const token = sessionStorage.getItem('token');
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

      // Never auto-refresh for auth endpoints — let errors surface to the user
      const isAuthEndpoint = original?.url?.includes('/auth/login') ||
                             original?.url?.includes('/auth/logout') ||
                             original?.url?.includes('/auth/refresh');

      if (error.response?.status === 401 && !original._retry && !isAuthEndpoint) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
            .then((token) => { original.headers.Authorization = `Bearer ${token}`; return api(original); });
        }
        original._retry = true;
        isRefreshing = true;
        try {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken) throw new Error('No refresh token');

          const { data } = await axios.post(`${BASE_URL}/v2/auth/refresh`, { refreshToken });
          const newToken = data.data.token;

          sessionStorage.setItem('token', newToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

          // Update Redux store with fresh user data if returned
          if (data.data.user) {
            const stored = localStorage.getItem('user');
            if (stored) {
              const merged = { ...JSON.parse(stored), ...data.data.user };
              localStorage.setItem('user', JSON.stringify(merged));
            }
          }

          processQueue(null, newToken);
          return api(original);
        } catch (err) {
          processQueue(err, null);
          sessionStorage.clear();
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          // Correct HashRouter redirect — stay on same host, use hash path
          window.location.replace(window.location.pathname + '#/login');
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
