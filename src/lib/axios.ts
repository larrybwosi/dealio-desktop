// lib/axios.ts
import axios, { AxiosAdapter } from "axios";
import { invoke } from '@tauri-apps/api/core';

export const API_ENDPOINT = import.meta.env.DEV ? 'http://localhost:3000' : 'https://dealioerp.vercel.app';

// Custom Tauri Adapter to proxy requests through the backend
const tauriAdapter: AxiosAdapter = async (config) => {
  try {
    // 1. Serialize params if they exist
    let path = config.url || '';
    if (config.params) {
        const query = new URLSearchParams(config.params).toString();
        if (query) {
            path += (path.includes('?') ? '&' : '?') + query;
        }
    }

    // 2. Invoke the backend proxy
    const result = await invoke<any>('authenticated_api_request', {
      method: config.method?.toUpperCase() || 'GET',
      path: path,
      body: config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : null,
    });

    // 3. Formulate an Axios-compatible response
    return {
      data: result,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  } catch (error: any) {
    // 4. Transform backend error into Axios error
    const axiosError: any = new Error(error);
    axiosError.config = config;
    if (error.includes('API Error')) {
        const statusMatch = error.match(/API Error (\d+)/);
        axiosError.response = {
            status: statusMatch ? parseInt(statusMatch[1]) : 500,
            data: { message: error },
            headers: {},
            config
        };
    }
    throw axiosError;
  }
};

export const apiClient = axios.create({
  baseURL: API_ENDPOINT,
  timeout: 15000,
  adapter: tauriAdapter, // Use our custom backend proxy
});
