import { ArrowRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { PasswordField, TextField } from '../components/ui/TextField';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { getErrorDetails, getErrorMessage } from '../lib/errors';
import { hasErrors, validateLoginForm, type FormErrors } from '../lib/validation';

interface LocationState {
  from?: string;
}

export function LoginPage() {
  useDocumentTitle('Entrar');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from;
  const redirectTo =
    typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';

  const [values, setValues] = useState({ login: '', password: '' });
  const [errors, setErrors] = useState<FormErrors<'login' | 'password'>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverDetails, setServerDetails] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: 'login' | 'password', value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setServerError(null);
    setServerDetails([]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setServerError(null);
    setServerDetails([]);

    const validationErrors = validateLoginForm(values);
    setErrors(validationErrors);

    if (hasErrors(validationErrors)) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login({
        login: values.login.trim(),
        password: values.password,
      });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
      setServerDetails(getErrorDetails(error));

      if (error instanceof ApiError && error.status === 401) {
        setErrors({ password: 'Verifique seu login e sua senha.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Bem-vindo de volta"
      title="Entre no seu caderno"
      description="Acesse suas receitas, organize os próximos pratos e continue de onde parou."
      footer={
        <p>
          Ainda não tem um caderno?{' '}
          <Link
            to="/register"
            className="font-semibold text-olive-800 underline decoration-olive-300 decoration-2 underline-offset-4 transition hover:text-olive-950"
          >
            Criar minha conta
          </Link>
        </p>
      }
    >
      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="space-y-5">
        {serverError && (
          <div
            role="alert"
            className="rounded-xl border border-terracotta-200 bg-terracotta-50/80 px-4 py-3.5 text-sm text-terracotta-800"
          >
            <p className="font-semibold">{serverError}</p>
            {serverDetails.length > 0 && (
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-terracotta-700">
                {serverDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <TextField
          id="login"
          label="Login"
          value={values.login}
          onChange={(event) => handleChange('login', event.target.value)}
          error={errors.login}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="seu.login"
          required
        />

        <PasswordField
          id="password"
          label="Senha"
          value={values.password}
          onChange={(event) => handleChange('password', event.target.value)}
          error={errors.password}
          autoComplete="current-password"
          placeholder="Sua senha"
          required
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          icon={<ArrowRight size={18} aria-hidden />}
        >
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthLayout>
  );
}
