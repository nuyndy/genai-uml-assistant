// frontend/src/hooks/useApi.ts
import { useState, useCallback } from 'react';
import { apiClient, handleApiCall } from '../utils/apiClient';
import { ErrorResponse } from '../utils/errorHandler';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ErrorResponse | null;
  success: boolean;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
  setData: (data: T) => void;
}

export const useApi = <T>(
  apiFunction: (...args: any[]) => Promise<T>,
  autoExecute: boolean = false,
  initialData?: T
): UseApiReturn<T> => {
  const [state, setState] = useState<UseApiState<T>>({
    data: initialData || null,
    loading: false,
    error: null,
    success: false,
  });

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      setState(prev => ({ ...prev, loading: true, error: null, success: false }));

      try {
        const result = await handleApiCall(() => apiFunction(...args));
        
        if (result.error) {
          setState({
            data: null,
            loading: false,
            error: result.error,
            success: false,
          });
          return null;
        }

        setState({
          data: result.data,
          loading: false,
          error: null,
          success: true,
        });
        return result.data;

      } catch (error: any) {
        // Fallback error handling
        setState({
          data: null,
          loading: false,
          error: {
            message: error.message || 'Lỗi không xác định',
            type: 'unknown'
          },
          success: false,
        });
        return null;
      }
    },
    [apiFunction]
  );

  const reset = useCallback(() => {
    setState({
      data: initialData || null,
      loading: false,
      error: null,
      success: false,
    });
  }, [initialData]);

  const setData = useCallback((data: T) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  // Auto execute if needed
  useState(() => {
    if (autoExecute) {
      execute();
    }
  });

  return {
    ...state,
    execute,
    reset,
    setData,
  };
};

// Hook specific cho UML
export const useUmlGeneration = () => {
  return useApi(
    async (description: string, language: string = 'vi') => {
      const response = await apiClient.post('/api/uml/generate', {
        description,
        language,
      });
      return response;
    },
    false
  );
};