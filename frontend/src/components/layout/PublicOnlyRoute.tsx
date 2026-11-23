import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { PageLoader } from './PageLoader';

export function PublicOnlyRoute() {
  const { status, retryRestore } = useAuth();

  if (status === 'loading') {
    return <PageLoader label="Verificando sua sessão…" />;
  }

  if (status === 'error') {
    return (
      <PageLoader
        label="Não foi possível verificar sua sessão. Confira sua conexão e tente novamente."
        onRetry={retryRestore}
      />
    );
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
