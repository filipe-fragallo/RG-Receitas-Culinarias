import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../../common/interfaces/authenticated-user.interface';

interface RequestWithUser {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
}

/**
 * Guard global: por padrão todas as rotas exigem JWT.
 * Rotas explicitamente anotadas com @Public() ficam abertas.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token de autenticação não informado.');
    }

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Sessão expirada ou token inválido.');
    }

    if (typeof payload.sub !== 'number' || typeof payload.login !== 'string') {
      throw new UnauthorizedException('Token inválido.');
    }

    request.user = {
      id: payload.sub,
      login: payload.login,
      nome: payload.nome ?? null,
    };

    return true;
  }
}
