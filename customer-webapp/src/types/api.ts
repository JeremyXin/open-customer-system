export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  size: number;
}

export interface ErrorResponse {
  success: false;
  error: string;
  message: string;
  timestamp: string;
  path: string;
}
