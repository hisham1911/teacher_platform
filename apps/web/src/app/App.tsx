import { RouterProvider } from 'react-router';
import { AuthBootstrapGate } from '../features/auth/auth-bootstrap';
import { AppProviders } from './providers';
import { router } from './router';

export function App() {
  return (
    <AppProviders>
      <AuthBootstrapGate>
        <RouterProvider router={router} />
      </AuthBootstrapGate>
    </AppProviders>
  );
}
