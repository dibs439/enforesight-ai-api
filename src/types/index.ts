// Custom type definitions
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface HealthCheckResponse {
  status: string;
  message: string;
  timestamp: string;
  environment: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

export * from './customer';

