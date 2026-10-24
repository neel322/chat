import axios from 'axios';

// Detect whether the current page is on localhost or a local network IP (192.168.x.x)
const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const BACKEND_URL = `http://${hostname}:5000/api`;

console.log('API Base URL:', BACKEND_URL); // Verify this in browser DevTools Console (F12)

const api = axios.create({
  baseURL: BACKEND_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;