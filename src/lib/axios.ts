// lib/axios.ts
import axios from "axios";

// These functions would get tokens from your app's state
// (e.g., Zustand, Context, or localStorage)
let deviceKey: string | null = null;
let memberToken: string | null = null;

export const setDeviceKey = (key: string) => {
  deviceKey = key;
  // You might want to persist this in localStorage for a POS device
  localStorage.setItem("pos_device_key", key);
};
export const setMemberToken = (token: string | null) => {
  memberToken = token;
};
export const loadDeviceKey = () => {
  deviceKey = localStorage.getItem("pos_device_key");
};

export const apiClient = axios.create({
  baseURL: "/api", // Assumes your Next.js app serves API routes
});

// Add a request interceptor to inject tokens
apiClient.interceptors.request.use(
  (config) => {
    // Load device key from storage if not in memory
    if (!deviceKey) {
      loadDeviceKey();
    }

    // 1. Add the Device API Key to all requests
    if (deviceKey) {
      config.headers["X-Device-Api-Key"] = deviceKey;
    }

    // 2. Add the Member JWT (if it exists) to all requests
    // The check-in endpoint will ignore this, but check-out will need it.
    if (memberToken) {
      config.headers["Authorization"] = `Bearer ${memberToken}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
