import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useSessionSnapshot } from './use-session';
import { RouteLoadingFallback } from '../../app/route-loading-fallback';

/**
 * حارس المسارات المصادقة:
 * - أثناء initializing ننتظر نتيجة bootstrap (Refresh واحد صاخب) ونعرض Loading
 *   دون أي تحويل، حتى لا يُرحّل المستخدم إلى Login قبل انتهاء Boot-after-Reload.
 * - anonymous فقط يُحوّل إلى Login.
 */
export function RequireAuth(): ReactNode {
  const { status } = useSessionSnapshot();
  const location = useLocation();

  if (status === 'initializing') {
    return <RouteLoadingFallback />;
  }
  if (status === 'anonymous') {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}
