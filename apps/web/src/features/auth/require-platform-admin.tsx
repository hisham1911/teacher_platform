import { Navigate, Outlet } from 'react-router';
import { useSessionSnapshot } from './use-session';

export function RequirePlatformAdmin() {
  const { user } = useSessionSnapshot();
  return user?.platformRoles.includes('PlatformAdmin')
    ? <Outlet />
    : <Navigate to="/dashboard" replace />;
}
