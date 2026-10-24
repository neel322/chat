// chat-frontend/src/entities/user/model/useAuthStore.js
import { create } from 'zustand';
import api from '../../../shared/api/axiosInstance';

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || null,
  error: null,

  login: async (identifier, password) => {
    try {
      const res = await api.post('/auth/login', { identifier, password });
      const { user, token } = res.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      set({ user, token, error: null });
      return user;
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      set({ error: msg });
      throw err; // <-- CRUCIAL: must re-throw so AuthPage can display it!
    }
  },

  register: async (username, email, password) => {
    try {
      const res = await api.post('/auth/register', { username, email, password });
      const { user, token } = res.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      set({ user, token, error: null });
      return user;
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed';
      set({ error: msg });
      throw err; // <-- CRUCIAL: must re-throw so AuthPage can display it!
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, error: null });
  },

  updateProfile: async (username, email) => {
    try {
      const res = await api.patch('/users/profile', { username, email });
      const updatedUser = res.data.user;
      localStorage.setItem('user', JSON.stringify(updatedUser));
      set({ user: updatedUser, error: null });
      return true;
    } catch (err) {
      set({ error: err.response?.data?.error || 'Update failed' });
      return false;
    }
  }
}));