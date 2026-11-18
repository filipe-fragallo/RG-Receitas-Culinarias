import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/** Recupera o usuário autenticado anexado à requisição pelo JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();

    if (!request.user) {
      throw new UnauthorizedException('Autenticação necessária.');
    }

    return request.user;
  },
);
