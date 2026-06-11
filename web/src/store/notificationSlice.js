import { createSlice } from '@reduxjs/toolkit';

const notificationSlice = createSlice({
  name: 'notifications',
  initialState: { items: [], unreadCount: 0 },
  reducers: {
    setNotifications(state, { payload }) {
      state.items = payload;
      state.unreadCount = payload.filter((n) => !n.is_read).length;
    },
    markRead(state, { payload: id }) {
      const n = state.items.find((i) => i.id === id);
      if (n) { n.is_read = true; state.unreadCount = Math.max(0, state.unreadCount - 1); }
    },
    markAllRead(state) {
      state.items.forEach((n) => { n.is_read = true; });
      state.unreadCount = 0;
    },
  },
});

export const { setNotifications, markRead, markAllRead } = notificationSlice.actions;
export default notificationSlice.reducer;
