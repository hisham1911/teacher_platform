import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { HttpError } from './http-error';

describe('apiClient', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:5000');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('يرسل GET إلى المسار الصحيح ويعيد JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiClient.get<{ status: string }>('/api/v1/system/info');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/v1/system/info',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.status).toBe('ok');
  });

  it('يرمي HttpError عند رد غير ناجح', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ title: 'Problem' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(apiClient.get('/api/v1/system/info')).rejects.toBeInstanceOf(HttpError);
  });

  it('يرمي MissingApiBaseUrlError عند غياب عنوان الـAPI', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    await expect(apiClient.get('/api/v1/system/info')).rejects.toThrow(/VITE_API_BASE_URL/);
  });
});
