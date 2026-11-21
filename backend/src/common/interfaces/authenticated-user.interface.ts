export interface AuthenticatedUser {
  id: number;
  login: string;
  name: string | null;
}

export interface AuthenticatedSession extends AuthenticatedUser {
  jti: string;
  tokenIdentifierHash: string;
  /** Usado para alinhar a validade do cookie CSRF ao restante da sessão. */
  expiresAt: Date;
}

export interface JwtPayload {
  sub: number;
  login: string;
  name: string | null;
  jti: string;
}
