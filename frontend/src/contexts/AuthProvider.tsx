import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ApiError, clearCsrfToken, removeLegacyToken, SESSION_EXPIRED_EVENT } from '../api/client';
import { authApi } from '../api/services';
import { useToast } from '../hooks/useToast';
import type { LoginInput, RegisterInput, User } from '../types/api';
import { AuthContext, type AuthStatus } from './auth-context';

function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? '';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const toast = useToast();
  const isLoggingOut = useRef(false);
  const isAuthRequestInFlight = useRef(false);

  const clearSession = useCallback(() => {
    removeLegacyToken();
    clearCsrfToken();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const retryRestore = useCallback(() => {
    setStatus('loading');
    setRestoreAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      // Migração pontual: remove somente a chave antiga de autenticação.
      const hadLegacyToken = removeLegacyToken();

      try {
        const currentUser = await authApi.me();

        if (active) {
          setUser(currentUser);
          setStatus('authenticated');
        }
      } catch (error) {
        if (!active) return;

        // Uma resposta 401 comprova ausência/expiração da sessão.
        // Falhas de rede ou 5xx não invalidam o cookie: oferecemos retry.
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          if (hadLegacyToken) {
            toast.info('Sua sessão anterior foi encerrada. Entre novamente para continuar.');
          }
        } else {
          setStatus('error');
        }
      }
    };

    void restoreSession();

    return () => {
      active = false;
    };
  }, [clearSession, toast, restoreAttempt]);

  useEffect(() => {
    const handleSessionExpired = () => {
      // Respostas 401 de requisições antigas podem chegar após o logout.
      if (isLoggingOut.current || status === 'anonymous') return;

      clearSession();
      toast.error('Sua sessão expirou. Entre novamente para continuar.');
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);

    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [clearSession, status, toast]);

  const login = useCallback(
    async (input: LoginInput) => {
      if (isAuthRequestInFlight.current) return;
      isAuthRequestInFlight.current = true;

      try {
        const response = await authApi.login(input);
        setUser(response.user);
        setStatus('authenticated');
        toast.success(
          `Bem-vindo de volta${firstName(response.user.name) ? `, ${firstName(response.user.name)}` : ''}!`,
        );
      } finally {
        isAuthRequestInFlight.current = false;
      }
    },
    [toast],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      if (isAuthRequestInFlight.current) return;
      isAuthRequestInFlight.current = true;

      try {
        const response = await authApi.register(input);
        setUser(response.user);
        setStatus('authenticated');
        toast.success('Conta criada com sucesso. Seu caderno está pronto!');
      } finally {
        isAuthRequestInFlight.current = false;
      }
    },
    [toast],
  );

  const logout = useCallback(async () => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;

    try {
      await authApi.logout();
      // Só limpa o estado local depois que o servidor confirmou a revogação.
      // O cookie HttpOnly permanece válido se a chamada falhar: fingir logout
      // aqui faria a próxima recarga restaurar a sessão silenciosamente.
      clearSession();
      toast.success('Você saiu da sua conta.');
    } catch {
      toast.error('Não foi possível encerrar a sessão no servidor. Tente novamente.');
    } finally {
      isLoggingOut.current = false;
    }
  }, [clearSession, toast]);

  const value = useMemo(
    () => ({ status, user, login, register, logout, retryRestore }),
    [status, user, login, register, logout, retryRestore],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
