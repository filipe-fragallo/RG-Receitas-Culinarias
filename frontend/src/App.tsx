import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { PublicOnlyRoute } from './components/layout/PublicOnlyRoute';
import { AuthProvider } from './contexts/AuthProvider';
import { ToastProvider } from './contexts/ToastProvider';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { RecipeFormPage } from './pages/RecipeFormPage';
import { RecipesPage } from './pages/RecipesPage';
import { RegisterPage } from './pages/RegisterPage';

function LegacyRecipeRoutes() {
  const path = window.location.pathname;
  const match = path.match(/^\/receitas\/(\d+)(?:\/(editar))?\/?$/);

  if (!match) return <Navigate to="/" replace />;

  return (
    <Navigate
      to={`/recipes/${match[1]}${match[2] ? '/edit' : ''}${window.location.search}`}
      replace
    />
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/cadastro" element={<Navigate to="/register" replace />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route index element={<RecipesPage />} />
                <Route path="recipes/new" element={<RecipeFormPage />} />
                <Route path="recipes/:id" element={<RecipeDetailPage />} />
                <Route path="recipes/:id/edit" element={<RecipeFormPage />} />
              </Route>
              <Route path="receitas/nova" element={<Navigate to="/recipes/new" replace />} />
              <Route path="receitas/:id/*" element={<LegacyRecipeRoutes />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
