// frontend/src/utils/errorHandler.ts

export interface ErrorResponse {
  message: string;
  status?: number;
  type: 'network' | 'timeout' | 'server' | 'validation' | 'unknown';
  details?: any;
}

export class AppError extends Error {
  public readonly status?: number;
  public readonly type: ErrorResponse['type'];
  public readonly details?: any;

  constructor(message: string, type: ErrorResponse['type'] = 'unknown', status?: number, details?: any) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const handleApiError = (error: any): ErrorResponse => {
  // Log error để debug
  console.error('API Error:', error);

  // Network error
  if (error.name === 'AbortError' || error.message?.includes('abort')) {
    return {
      message: '⏰ Yêu cầu đã quá thời gian chờ (30s). Vui lòng thử lại với mô tả ngắn hơn.',
      type: 'timeout',
      status: 408
    };
  }

  // Network connection error
  if (error.message?.includes('Failed to fetch') || 
      error.message?.includes('NetworkError') ||
      error.message?.includes('network')) {
    return {
      message: '🌐 Không thể kết nối đến server. Vui lòng kiểm tra:\n' +
               '• Backend có đang chạy không? (python backend/app.py)\n' +
               '• Địa chỉ API đúng không? (http://localhost:8000)\n' +
               '• CORS đã được cấu hình chưa?',
      type: 'network',
      status: 0
    };
  }

  // HTTP errors
  if (error.status || error.response?.status) {
    const status = error.status || error.response?.status;
    
    switch (status) {
      case 400:
        return {
          message: '❌ Yêu cầu không hợp lệ. Vui lòng kiểm tra lại dữ liệu nhập.',
          type: 'validation',
          status: 400,
          details: error.response?.data
        };
      case 401:
        return {
          message: '🔒 Không có quyền truy cập. Vui lòng đăng nhập lại.',
          type: 'server',
          status: 401
        };
      case 403:
        return {
          message: '🚫 Bạn không có quyền thực hiện hành động này.',
          type: 'server',
          status: 403
        };
      case 404:
        return {
          message: '🔍 Không tìm thấy API. Kiểm tra lại đường dẫn: /api/uml/generate',
          type: 'server',
          status: 404
        };
      case 429:
        return {
          message: '⏳ Quá nhiều yêu cầu. Vui lòng thử lại sau.',
          type: 'server',
          status: 429
        };
      case 500:
        return {
          message: '💥 Lỗi từ server. Vui lòng kiểm tra log của backend và thử lại.',
          type: 'server',
          status: 500
        };
      case 502:
        return {
          message: '⚠️ Server đang bảo trì hoặc quá tải. Vui lòng thử lại sau.',
          type: 'server',
          status: 502
        };
      default:
        return {
          message: `❌ Lỗi server (${status}). Vui lòng thử lại sau.`,
          type: 'server',
          status
        };
    }
  }

  // Validation errors
  if (error.message?.includes('json') || error.message?.includes('parse')) {
    return {
      message: '📄 Dữ liệu trả về không hợp lệ. Vui lòng thử lại.',
      type: 'validation',
      status: 500
    };
  }

  // Empty response
  if (error.message?.includes('rỗng') || error.message?.includes('empty')) {
    return {
      message: '📭 Server trả về dữ liệu rỗng. Vui lòng thử lại với mô tả chi tiết hơn.',
      type: 'validation',
      status: 204
    };
  }

  // Unknown error
  return {
    message: `❌ Lỗi không xác định: ${error.message || 'Vui lòng thử lại sau.'}`,
    type: 'unknown',
    details: error
  };
};

export const getUserFriendlyMessage = (error: ErrorResponse): string => {
  return error.message;
};

export const isRetryableError = (error: ErrorResponse): boolean => {
  return ['network', 'timeout', 'server'].includes(error.type);
};

export const getRetryDelay = (attempt: number): number => {
  // Exponential backoff: 2s, 4s, 8s
  return Math.min(2000 * Math.pow(2, attempt), 10000);
};