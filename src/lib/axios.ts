// lib/axios.ts
import axios from "axios";
import { useAuthStore } from "@/store/pos-auth-store";

export const API_ENDPOINT = import.meta.env.DEV ? 'http://localhost:3000' : 'https://dealioerp.vercel.app';
export const apiClient = axios.create({
  baseURL: API_ENDPOINT,
  timeout: 10000, // Add a timeout
});

//dealio_sk_test_6a0164e28c0b01a2_92c092583b8c9c246c6af011e300791658624cacb44b712d2c5cd35b890f66a7
// Shoestoredealio_sk_test_c40d652eae09c374_3345cabf39d8ffa533cd8cf76073fc6c45f4d57d758694d663e0ea0b19fd4922
// Restaurant 

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
