import { lazy, Suspense } from 'react';
import { createBrowserRouter, Outlet } from 'react-router';
import { RootLayout } from '../components/layout/root-layout';
import { RouteLoadingFallback } from './route-loading-fallback';
import { RequireAuth } from '../features/auth/require-auth';

const HomePage = lazy(() => import('../routes/public/home-page'));

const LoginPage = lazy(() => import('../routes/auth/login-page'));
const SignupPage = lazy(() => import('../routes/auth/signup-page'));
const ForgotPasswordPage = lazy(() => import('../routes/auth/forgot-password-page'));
const ConfirmEmailPage = lazy(() => import('../routes/auth/confirm-email-page'));
const ResetPasswordPage = lazy(() => import('../routes/auth/reset-password-page'));

const OnboardingPage = lazy(() => import('../routes/onboarding/onboarding-page'));
const ChooseWorkspacePage = lazy(() => import('../routes/onboarding/choose-workspace-page'));

const DashboardPage = lazy(() => import('../routes/dashboard/dashboard-page'));
const SettingsPage = lazy(() => import('../routes/dashboard/settings-page'));

const QuestionsPage = lazy(() => import('../routes/dashboard/questions/questions-page'));
const QuestionNewPage = lazy(() => import('../routes/dashboard/questions/question-new-page'));
const QuestionEditPage = lazy(() => import('../routes/dashboard/questions/question-edit-page'));
const QuestionPreviewPage = lazy(() => import('../routes/dashboard/questions/question-preview-page'));
const QuestionVersionsPage = lazy(() => import('../routes/dashboard/questions/question-versions-page'));

const PlayDemoPage = lazy(() => import('../routes/play/play-demo-page'));

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
      { path: '/auth/login', element: <LoginPage /> },
      { path: '/auth/signup', element: <SignupPage /> },
      { path: '/auth/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/auth/confirm-email', element: <ConfirmEmailPage /> },
      { path: '/auth/reset-password', element: <ResetPasswordPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/onboarding', element: <OnboardingPage /> },
          { path: '/onboarding/choose', element: <ChooseWorkspacePage /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/dashboard/settings', element: <SettingsPage /> },
          { path: '/dashboard/questions', element: <QuestionsPage /> },
          { path: '/dashboard/questions/new', element: <QuestionNewPage /> },
          { path: '/dashboard/questions/:questionId/edit', element: <QuestionEditPage /> },
          { path: '/dashboard/questions/:questionId/preview', element: <QuestionPreviewPage /> },
          { path: '/dashboard/questions/:questionId/versions', element: <QuestionVersionsPage /> },
        ],
      },
      { path: '/play/demo', element: <PlayDemoPage /> },
    ],
  },
]);
