import { useQuery } from '@tanstack/react-query';
import { getSystemInfo } from '../api-client/endpoints';
import { MissingApiBaseUrlError } from '../api-client/http-error';

/**
 * يستعلم من /api/v1/system/info.
 * يبقى معطّلًا عند غياب VITE_API_BASE_URL حتى لا تفشل الصفحات العامة في التطوير المحلي.
 */
export function useSystemInfoQuery() {
  const hasBaseUrl = Boolean(import.meta.env.VITE_API_BASE_URL);

  return useQuery({
    queryKey: ['system-info'],
    queryFn: ({ signal }) => getSystemInfo(signal),
    enabled: hasBaseUrl,
    retry: (failureCount, error) => {
      if (error instanceof MissingApiBaseUrlError) return false;
      return failureCount < 1;
    },
  });
}
