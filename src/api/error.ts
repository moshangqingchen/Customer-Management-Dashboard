import type { AppErrorPayload } from './types';

export class ApiError extends Error implements AppErrorPayload {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'ApiError'; }
}
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (typeof error === 'string') {
    try { return toApiError(JSON.parse(error) as unknown); } catch { return new ApiError('unknown', error); }
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return new ApiError('code' in error ? String(error.code) : 'unknown', String(error.message));
  }
  return new ApiError('unknown', '操作失败，请重试');
}
