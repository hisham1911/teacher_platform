import { getSessionSnapshot } from '../../lib/auth/session';
import { apiClient } from './client';
import { HttpError } from './http-error';

export async function updatePlatformUserStatus(
  userId: string,
  suspended: boolean,
  signal?: AbortSignal,
): Promise<{ suspended: boolean }> {
  const accessToken = getSessionSnapshot().accessToken;
  if (!accessToken) {
    throw new HttpError(401, { title: 'Unauthorized', status: 401 });
  }

  return apiClient.put<{ suspended: boolean }>(
    `/api/v1/platform/users/${encodeURIComponent(userId)}/status`,
    { suspended },
    {
      signal,
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
}
