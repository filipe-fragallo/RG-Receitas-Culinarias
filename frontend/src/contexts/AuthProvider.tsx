import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  clearStoredToken,
  getStoredToken,
  SESSION_EXPIRED_EVENT,
  setStoredToken,
} from '../api/client';
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
  const toast = useToast();
  const isLoggingOut = useRef(false);

  const clearSession = useCallback(() => {
    clearStoredToken();
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      const token = getStoredToken();

      if (!token) {
        if (active) setStatus('anonymous');
        return;
      }

      try {
        const currentUser = await authApi.me();

        if (active) {
          setUser(currentUser);
          setStatus('authenticated');
        }
      } catch {
        if (!active) return;
        clearSession();
      }
    };

    void restoreSession();

    return () => {
      active = false;
    };
  }, [clearSession]);

  useEffect(() => {
    const handleSessionExpired = () => {
      if (isLoggingOut.current) {
        return;
      }

      clearSession();
      toast.error('Sua sessão expirou. Entre novamente para continuar.');
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);

    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, [clearSession, toast]);

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await authApi.login(input);
      setStoredToken(response.accessToken);
      setUser(response.user);
      setStatus('authenticated');
      toast.success(
        `Bem-vindo de volta${firstName(response.user.nome) ? `, ${firstName(response.user.nome)}` : ''}!`,
      );
    },
    [toast],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const response = await authApi.register(input);
      setStoredToken(response.accessToken);
      setUser(response.user);
      setStatus('authenticated');
      toast.success('Conta criada com sucesso. Seu caderno está pronto!');
    },
    [toast],
  );

  const logout = useCallback(async () => {
    isLoggingOut.current = true;

    try {
      await authApi.logout();
    } catch {
      // Mesmo que o token já esteja expirado, a sessão local deve ser encerrada.
    } finally {
      clearSession();
      isLoggingOut.current = false;
      toast.success('Você saiu da sua conta.');
    }
  }, [clearSession, toast]);

  const value = useMemo(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
