import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { API_URL } from './constants';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: add Authorization header
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor: unwrap Result<T> wrapper and handle 401 refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Backend wraps all responses in Result<T>: { success, code, data, message }
    // Unwrap to return the inner data directly
    const body = response.data;
    if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
      response.data = body.data;
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !(originalRequest as any)._retry) {
      (originalRequest as any)._retry = true;
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          // Use raw axios to avoid interceptor loop
          const response = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
          const result = response.data;
          // Unwrap Result wrapper for refresh response too
          const tokenData = result?.data ?? result;
          const { accessToken } = tokenData;
          localStorage.setItem('access_token', accessToken);
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (typeof window !== 'undefined') {
          window.location.href = '/dashboard/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
