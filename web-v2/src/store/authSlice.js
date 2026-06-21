import { createSlice } from '@reduxjs/toolkit';

const stored = localStorage.getItem('user');

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user:            stored ? JSON.parse(stored) : null,
    token:           sessionStorage.getItem('token') || null,
    refreshToken:    localStorage.getItem('refreshToken') || null,
    isAuthenticated: !!stored,
    isOffline:       false,
  },
  reducers: {
    setCredentials(state, { payload }) {
      state.user          = payload.user;
      state.token         = payload.token;
      state.refreshToken  = payload.refreshToken;
      state.isAuthenticated = true;
      state.isOffline     = payload.isOffline ?? false;
      if (!payload.isOffline) {
        sessionStorage.setItem('token', payload.token);
        localStorage.setItem('refreshToken', payload.refreshToken);
      }
      localStorage.setItem('user', JSON.stringify(payload.user));
    },
    // Refresh user data from /me endpoint without requiring re-login
    refreshUser(state, { payload }) {
      if (payload && state.user) {
        state.user = { ...state.user, ...payload };
        // Ensure permissions stored for sidebar use
        if (payload.permissions) state.user.permissions = payload.permissions;
        localStorage.setItem('user', JSON.stringify(state.user));
      }
    },
    logout(state) {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      sessionStorage.clear();
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    },
  },
});

export const { setCredentials, refreshUser, logout } = authSlice.actions;
export default authSlice.reducer;
