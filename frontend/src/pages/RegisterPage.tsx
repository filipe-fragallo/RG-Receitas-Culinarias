import { UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Button } from '../components/ui/Button';
import { PasswordField, TextField } from '../components/ui/TextField';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { getErrorDetails, getErrorMessage } from '../lib/errors';
import { hasErrors, validateRegisterForm, type FormErrors } from '../lib/validation';

type RegisterField = 'name' | 'login' | 'password' | 'confirmPassword';

export function RegisterPage() {
  useDocumentTitle('Criar conta');
  const { register } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState({
    name: '',
    login: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors<RegisterField>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverDetails, setServerDetails] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: RegisterField, value: string) => {
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

    const validationErrors = validateRegisterForm(values);
    setErrors(validationErrors);

    if (hasErrors(validationErrors)) {
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        name: values.name.trim(),
        login: values.login.trim().toLowerCase(),
        password: values.password,
        confirmPassword: values.confirmPassword,
      });
      navigate('/', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
      setServerDetails(getErrorDetails(error));

      if (error instanceof ApiError && error.status === 409) {
        setErrors({ login: 'Este login já está em uso. Escolha outro.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Comece por aqui"
      title="Crie seu caderno"
      description="Em poucos segundos você terá um espaço só seu para guardar e encontrar suas receitas."
      footer={
        <p>
          Já tem uma conta?{' '}
          <Link
            to="/login"
            className="font-semibold text-olive-800 underline decoration-olive-300 decoration-2 underline-offset-4 transition hover:text-olive-950"
          >
            Entrar no caderno
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
          id="name"
          label="Nome"
          value={values.name}
          onChange={(event) => handleChange('name', event.target.value)}
          error={errors.name}
          autoComplete="name"
          placeholder="Como você quer ser chamado?"
          maxLength={100}
          required
        />

        <TextField
          id="login"
          label="Login"
          value={values.login}
          onChange={(event) => handleChange('login', event.target.value)}
          error={errors.login}
          hint="Letras, números, ponto, hífen ou sublinhado. Será sempre minúsculo."
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="maria.silva"
          maxLength={100}
          required
        />

        <PasswordField
          id="password"
          label="Senha"
          value={values.password}
          onChange={(event) => handleChange('password', event.target.value)}
          error={errors.password}
          hint="Use pelo menos 8 caracteres."
          autoComplete="new-password"
          placeholder="Crie uma senha"
          maxLength={72}
          required
        />

        <PasswordField
          id="confirmPassword"
          label="Confirmar senha"
          value={values.confirmPassword}
          onChange={(event) => handleChange('confirmPassword', event.target.value)}
          error={errors.confirmPassword}
          autoComplete="new-password"
          placeholder="Repita a senha"
          maxLength={72}
          required
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          icon={<UserPlus size={18} aria-hidden />}
        >
          {isSubmitting ? 'Criando conta…' : 'Criar minha conta'}
        </Button>

        <p className="text-center text-xs leading-relaxed text-ink-muted">
          Sua senha é protegida com bcrypt e nunca é exibida pela API.
        </p>
      </form>
    </AuthLayout>
  );
}
