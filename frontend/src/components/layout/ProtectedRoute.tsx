import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { PageLoader } from './PageLoader';

export function ProtectedRoute() {
  const { status, retryRestore } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <PageLoader />;
  }

  if (status === 'error') {
    return (
      <PageLoader
        label="Não foi possível verificar sua sessão. Confira sua conexão e tente novamente."
        onRetry={retryRestore}
      />
    );
  }

  if (status === 'anonymous') {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }

  return <Outlet />;
}
