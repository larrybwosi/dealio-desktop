// lib/axios.ts
import axios from "axios";
import { usePosAuthStore } from "@/store/pos-auth-store";

export const apiClient = axios.create({
  baseURL: "http://localhost:3000/api/v1/pos",
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
    if (deviceKey) {
      config.headers["X-Device-Api-Key"] = deviceKey;
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
