import { HttpError, MissingApiBaseUrlError } from './http-error';

export interface RequestOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

function resolveBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!baseUrl) {
    throw new MissingApiBaseUrlError();
  }
  return baseUrl.replace(/\/+$/, '');
}

/**
 * الحدود الوحيدة المسموح لها بالتحدث مع الـAPI.
 * لا يجوز استدعاء fetch مباشرة من Components أو Queries خارج هذا المجلد.
 */
export const apiClient = {
  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return request<T>('GET', path, undefined, options);
  },
  async post<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return request<T>('POST', path, body, options);
  },
  async put<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return request<T>('PUT', path, body, options);
  },
  async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return request<T>('DELETE', path, undefined, options);
  },
};

async function request<T>(
  method: string,
  path: string,
  body: unknown,
  options: RequestOptions,
): Promise<T> {
  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    method,
    signal: options.signal,
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    throw new HttpError(response.status, errorBody);
  }

  return (await response.json()) as T;
}
