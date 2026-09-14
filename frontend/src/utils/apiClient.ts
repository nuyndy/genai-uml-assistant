// frontend/src/utils/apiClient.ts
import { AppError, handleApiError, ErrorResponse } from './errorHandler';

interface ApiOptions {
  timeout?: number;
  headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT = 30000; // 30s
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseURL: string = BASE_URL) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  async request<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    options: ApiOptions = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const headers = { ...this.defaultHeaders, ...options.headers };

      const config: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        config.body = JSON.stringify(data);
      }

      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      // Xử lý response
      if (!response.ok) {
        let errorMessage = response.statusText;
        let errorData = null;

        try {
          errorData = await response.json();
          errorMessage = errorData.message || errorData.detail || errorMessage;
        } catch (e) {
          // Nếu không parse được JSON
        }

        const error = new AppError(
          errorMessage,
          'server',
          response.status,
          errorData
        );
        throw error;
      }

      // Parse JSON response
      try {
        const result = await response.json();
        return result as T;
      } catch (e) {
        throw new AppError(
          'Dữ liệu trả về không hợp lệ',
          'validation',
          500
        );
      }

    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        error.message || 'Lỗi không xác định',
        'unknown'
      );
    }
  }

  // Các method tiện ích
  async get<T = any>(endpoint: string, options?: ApiOptions): Promise<T> {
    return this.request<T>(endpoint, 'GET', undefined, options);
  }

  async post<T = any>(endpoint: string, data?: any, options?: ApiOptions): Promise<T> {
    return this.request<T>(endpoint, 'POST', data, options);
  }

  async put<T = any>(endpoint: string, data?: any, options?: ApiOptions): Promise<T> {
    return this.request<T>(endpoint, 'PUT', data, options);
  }

  async delete<T = any>(endpoint: string, options?: ApiOptions): Promise<T> {
    return this.request<T>(endpoint, 'DELETE', undefined, options);
  }
}

// Singleton instance
export const apiClient = new ApiClient();

// Helper function
export const handleApiCall = async <T>(
  apiCall: () => Promise<T>
): Promise<{ data: T | null; error: ErrorResponse | null }> => {
  try {
    const data = await apiCall();
    return { data, error: null };
  } catch (error: any) {
    const errorResponse = handleApiError(error);
    return { data: null, error: errorResponse };
  }
};