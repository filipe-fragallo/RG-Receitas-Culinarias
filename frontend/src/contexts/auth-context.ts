import { createContext } from 'react';

import type { LoginInput, RegisterInput, User } from '../types/api';

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'error';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  retryRestore: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
