// lib/axios.ts
import axios from "axios";
import { useAuthStore } from "@/store/pos-auth-store";

export const API_ENDPOINT = import.meta.env.DEV ? 'http://localhost:3000' : 'https://dealioerp.vercel.app';
export const apiClient = axios.create({
  baseURL: API_ENDPOINT,
  timeout: 10000, // Add a timeout
});

//dealio_pk_live_6a2c2394e958b429_64b5900be9f1b4c996b2a975cc3a45ee974ffd5f3fdc30f0e6de232fe83e9960

// Add a request interceptor to inject auth headers
apiClient.interceptors.request.use(
  (config) => {
    // Get the current state directly from the store
    const { deviceKey, memberToken } = useAuthStore.getState();

    // Ensure headers object exists
    config.headers = config.headers || {};

    // 1. Add the Device API Key to all requests
    if (deviceKey) {
      config.headers['X-Device-Api-Key'] = deviceKey;
    }

    // 2. Add the Member JWT (if it exists)
    if (memberToken) {
      config.headers["Authorization"] = `Bearer ${memberToken}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Optional: Add response interceptor for token refresh or error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 errors globally if needed
    if (error.response?.status === 401) {
      // Could clear auth state here
      // useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  }
);
