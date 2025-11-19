// lib/axios.ts
import axios from "axios";
import { usePosAuthStore } from "@/store/pos-auth-store";

const key =
  "dealio_pk_live_d13f6d495c284664_eb873b9838ed358ff04f0994e5a0a4197b9a636e75af318b5169ebe4da776871";
export const apiClient = axios.create({
  baseURL: "http://localhost:3000/",
  timeout: 10000, // Add a timeout
});

// Add a request interceptor to inject auth headers
apiClient.interceptors.request.use(
  (config) => {
    // Get the current state directly from the store
    const { deviceKey, memberToken } = usePosAuthStore.getState();

    // Ensure headers object exists
    config.headers = config.headers || {};

    // 1. Add the Device API Key to all requests
    if (key) {
      config.headers["X-Device-Api-Key"] = key;
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
      // usePosAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  }
);
