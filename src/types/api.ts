export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> extends ApiSuccess<T[]> {
  meta: PaginationMeta;
}

/** Build a success response */
export function ok<T>(data: T, meta?: PaginationMeta): ApiSuccess<T> {
  return { success: true, data, ...(meta ? { meta } : {}) };
}

/** Build an error response */
export function err(
  code: string,
  message: string,
  details?: unknown,
): ApiError {
  return { success: false, error: { code, message, details } };
}
