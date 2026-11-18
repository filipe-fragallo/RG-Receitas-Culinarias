import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';
import { PageLoader } from './PageLoader';

export function PublicOnlyRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <PageLoader label="Verificando sua sessão…" />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
