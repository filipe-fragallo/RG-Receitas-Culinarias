import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { AuthenticatedSession } from '../interfaces/authenticated-user.interface';

/** Recupera a sessão autenticada anexada à requisição pelo JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedSession => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedSession }>();

    if (!request.user) {
      throw new UnauthorizedException('Autenticação necessária.');
    }

    return request.user;
  },
);
