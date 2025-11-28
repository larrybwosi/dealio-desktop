// lib/axios.ts
import axios from "axios";
import { useAuthStore } from "@/store/pos-auth-store";

export const apiClient = axios.create({
  baseURL: import.meta.env.DEV ? 'http://localhost:3000' : 'https://dealioprev.vercel.app',
  timeout: 10000, // Add a timeout
});

export const API_ENDPOINT = import.meta.env.DEV ? 'http://localhost:3000' : 'https://dealioprev.vercel.app';
console.log(API_ENDPOINT);
// export const API_ENDPOINT = 'http://localhost:3000'
// export const API_ENDPOINT =  'https://dealioerp.vercel.app';


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
