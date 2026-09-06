import axios from 'axios';
import { Platform } from 'react-native';
// @ts-ignore
import { BASE_URL as ENV_BASE_URL } from '@env';

export const BASE_URL = ENV_BASE_URL || Platform.select({
  ios: __DEV__ ? 'http://localhost:5000' : 'https://api.social-square.me',
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

// Helper: clear state and broadcast LOGOUT so App.tsx navigates to Login
const forceLogout = () => {
  try {
    const { useAuthStore } = require('../store/zustand/useAuthStore');
    // Fire-and-forget; broadcast happens synchronously inside logout()
    useAuthStore.getState().logout();
  } catch (e) {
    // As a last resort, emit LOGOUT directly so navigation still fires
    try {
      const { appChannel } = require('./broadcast');
      appChannel.postMessage({ type: 'LOGOUT' });
    } catch (_) {
      // ignore
    }
  }
};

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

    if (err.response?.status === 401) {
      // Refresh, /me, or logout itself failed — session is dead, log out immediately.
      // /auth/logout MUST be terminal here: logout() calls this endpoint, and if it
      // 401s and retries a refresh, that refresh (on failure) calls logout() again,
      // which calls this endpoint again — a circular await that never resolves.
      if (
        originalRequest.url?.includes('/auth/refresh') ||
        originalRequest.url?.includes('/auth/me') ||
        originalRequest.url?.includes('/auth/logout')
      ) {
        forceLogout();
        return Promise.reject(err);
      }

      // First 401 on a normal request — try to refresh the token once
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const { refreshAccessToken } = require('../store/zustand/useAuthStore');
          const token = await refreshAccessToken();
          if (token) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          }
          // refreshAccessToken returned null/undefined — treat as failure
          forceLogout();
        } catch (_refreshErr) {
          // refreshAccessToken threw (already called logout internally),
          // but call forceLogout as a safety net to ensure the broadcast fires.
          forceLogout();
        }
      } else {
        // Already retried and still got 401
        forceLogout();
      }
    }

    return Promise.reject(err);
  }
);
