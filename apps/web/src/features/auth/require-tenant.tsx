import { Navigate, Outlet } from 'react-router';
import { getActiveTenantId } from '../../lib/auth/session';

export function RequireTenant() {
  return getActiveTenantId()
    ? <Outlet />
    : <Navigate to="/onboarding/choose" replace />;
}
