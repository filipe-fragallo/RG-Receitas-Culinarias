export interface AuthenticatedUser {
  id: number;
  login: string;
  nome: string | null;
}

export interface JwtPayload {
  sub: number;
  login: string;
  nome: string | null;
}
