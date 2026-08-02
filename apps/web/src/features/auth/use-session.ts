import { useSyncExternalStore } from 'react';
import { getSessionSnapshot, subscribeToSession, type SessionSnapshot } from '../../lib/auth/session';

/** يقرأ الحالة الحالية من Session Store بدون React state إضافي */
export function useSessionSnapshot(): SessionSnapshot {
  return useSyncExternalStore(subscribeToSession, getSessionSnapshot, getSessionSnapshot);
}
