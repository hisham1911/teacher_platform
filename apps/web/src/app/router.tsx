import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet } from 'react-router';
import { RootLayout } from '../components/layout/root-layout';

const HomePage = lazy(() => import('../routes/public/home-page'));
const DashboardPage = lazy(() => import('../routes/dashboard/dashboard-page'));
const PlayDemoPage = lazy(() => import('../routes/play/play-demo-page'));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status">
      <span className="text-sm text-slate-500">جاري التحميل…</span>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    element: (
      <RootLayout>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Outlet />
        </Suspense>
      </RootLayout>
    ),
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/play/demo', element: <PlayDemoPage /> },
    ],
  },
]);
