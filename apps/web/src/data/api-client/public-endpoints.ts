import { apiClient } from './client';
import type { SystemInfo } from '../../types/system-info';

/** Endpoint تجريبي آمن لإثبات اتصال الواجهة بالـAPI — قراءة عامة غير مصادقة */
export async function getSystemInfo(signal?: AbortSignal): Promise<SystemInfo> {
  return apiClient.get<SystemInfo>('/api/v1/system/info', { signal });
}
