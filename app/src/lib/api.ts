import axios from 'axios';
import { Platform } from 'react-native';

export const BASE_URL = Platform.select({
  ios: 'https://api.social-square.me',
  android: 'https://api.social-square.me',
  default: 'https://api.social-square.me',
});

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((config: any) => {
  try {
    const { getToken } = require('../store/zustand/useAuthStore');
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore
  }

  config.headers['x-request-id'] = `req-${Math.random().toString(36).substring(2, 11)}-${Date.now().toString(36)}`;
  return config;
});

api.interceptors.response.use(
  (res: any) => {
    if (typeof res.data === 'string' && res.data) {
      try {
        res.data = JSON.parse(res.data);
      } catch (e) {
        // ignore
      }
    }
    return res;
  },
  async (err: any) => {
    const originalRequest = err.config;
    if (
      err.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;
      try {
        const { refreshAccessToken } = require('../store/zustand/useAuthStore');
        const token = await refreshAccessToken();
        if (token) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        // Handle session expiry or logout
      }
    }
    return Promise.reject(err);
  }
);
