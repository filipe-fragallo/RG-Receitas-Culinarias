import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AuthenticatedSession } from '../../common/interfaces/authenticated-user.interface';
import { getAllowedOrigins } from '../../config/app-origins';
import { AuthService } from '../auth.service';
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  timingSafeEqualText,
} from '../auth-cookies';

interface RequestWithSession extends Request {
  cookies: Record<string, string | undefined>;
  user?: AuthenticatedSession;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Guard global: por padrão todas as rotas exigem uma sessão persistida no
 * cookie HttpOnly. Rotas @Public() ficam abertas, mas requisições que
 * modificam dados continuam sujeitas à verificação de origem e CSRF.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const token = request.cookies?.[AUTH_COOKIE_NAME];
    let session: AuthenticatedSession | null = null;

    if (!isPublic) {
      if (!token) {
        throw new UnauthorizedException('Sessão não informada. Entre novamente.');
      }
      session = await this.authService.validateToken(token);
      request.user = session;
    } else if (token) {
      // Sessão inválida em rota pública não bloqueia login/cadastro: apenas
      // impede que ela seja usada como base para o token CSRF.
      try {
        session = await this.authService.validateToken(token);
      } catch {
        session = null;
      }
    }

    if (!SAFE_METHODS.has(request.method)) {
      this.validateCsrf(request, session);
    }

    return true;
  }

  private validateCsrf(request: RequestWithSession, session: AuthenticatedSession | null): void {
    const origin = request.headers.origin;

    if (origin && !getAllowedOrigins(this.configService).includes(origin)) {
      throw new ForbiddenException('Origem não permitida.');
    }

    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = request.headers[CSRF_HEADER_NAME];

    if (
      typeof cookieToken !== 'string' ||
      typeof headerToken !== 'string' ||
      cookieToken.length < 32 ||
      !timingSafeEqualText(cookieToken, headerToken)
    ) {
      throw new ForbiddenException('Requisição inválida. Recarregue a página e tente novamente.');
    }

    if (session) {
      const expected = this.authService.csrfTokenFor(session.jti);
      if (!timingSafeEqualText(cookieToken, expected)) {
        throw new ForbiddenException('Requisição inválida. Recarregue a página e tente novamente.');
      }
    }
  }
}
