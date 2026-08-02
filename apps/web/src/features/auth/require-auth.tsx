import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useSessionSnapshot } from './use-session';

/**
 * حارس المسارات المصادقة: يوجّه إلى Login إن لم توجد جلسة.
 * لا يعرض محتوى مؤقت بلا تحقق — لكن لا يمنع عرضه أثناء تحميل Refresh واحد صاخب
 * لأن الـbootstrap يحصل قبل تقديم هذه الصفحة عمليًا.
 */
export function RequireAuth(): ReactNode {
  const { user } = useSessionSnapshot();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}
