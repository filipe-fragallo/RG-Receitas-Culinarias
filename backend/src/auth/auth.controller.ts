import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedSession } from '../common/interfaces/authenticated-user.interface';
import { AuthService } from './auth.service';
import {
  AUTH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CookieSettings,
  authCookieOptions,
  csrfCookieOptions,
} from './auth-cookies';
import { AuthResponseDto } from './dto/auth-response.dto';
import { CsrfResponseDto } from './dto/csrf-response.dto';
import { LoginDto } from './dto/login.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { RegisterDto } from './dto/register.dto';

const CSRF_HEADER_DOC = {
  name: 'X-CSRF-Token',
  description: 'Token CSRF devolvido por /api/auth/csrf, /auth/login, /auth/register ou /auth/me.',
  required: true,
};

interface RequestWithCookies extends Request {
  cookies: Record<string, string | undefined>;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get('csrf')
  @ApiOperation({
    summary: 'Obtém o token CSRF inicial',
    description:
      'Define o cookie CSRF e devolve o valor para o header X-CSRF-Token. ' +
      'Quando existe sessão válida, o token é vinculado a ela.',
  })
  @ApiOkResponse({ description: 'Token CSRF emitido.', type: CsrfResponseDto })
  async csrf(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CsrfResponseDto> {
    const settings = this.cookieSettings();
    const token = request.cookies?.[AUTH_COOKIE_NAME];
    let csrfToken = this.authService.createPreAuthCsrfToken();
    let session: AuthenticatedSession | null = null;

    if (token) {
      try {
        session = await this.authService.validateToken(token);
        csrfToken = this.authService.csrfTokenFor(session.jti);
      } catch {
        // Cookie antigo/inválido não impede a emissão de um token pré-auth.
        session = null;
      }
    }

    response.cookie(
      CSRF_COOKIE_NAME,
      csrfToken,
      csrfCookieOptions({ ...settings, maxAgeSeconds: this.csrfMaxAgeSeconds(session) }),
    );
    return { csrfToken };
  }

  @Public()
  @Post('register')
  @UseGuards(ThrottlerGuard)
  // O guard evalua todas as políticas globais. Sem este skip, o cadastro
  // também consumiria os contadores de login (e vice-versa).
  @SkipThrottle({ 'login-ip': true, 'login-identity': true })
  @Throttle({ 'register-ip': {}, 'register-identity': {} })
  @ApiOperation({
    summary: 'Cria uma conta',
    description:
      'Cria o usuário com senha bcrypt e define a sessão em cookie HttpOnly. ' +
      'O JWT não é devolvido no corpo da resposta.',
  })
  @ApiHeader(CSRF_HEADER_DOC)
  @ApiCreatedResponse({ description: 'Conta criada e autenticada.', type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos.' })
  @ApiConflictResponse({ description: 'Login já cadastrado.' })
  @ApiTooManyRequestsResponse({
    description: 'Muitas tentativas. Aguarde um momento e tente novamente.',
  })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const issued = await this.authService.register(dto);
    this.applySessionCookies(response, issued.token, issued.csrfToken, issued.expiresIn);
    return { expiresIn: issued.expiresIn, csrfToken: issued.csrfToken, user: issued.user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ 'register-ip': true, 'register-identity': true })
  @Throttle({ 'login-ip': {}, 'login-identity': {} })
  @ApiOperation({
    summary: 'Autentica com login e senha',
    description: 'Define a sessão em cookie HttpOnly; o JWT não é devolvido no JSON.',
  })
  @ApiHeader(CSRF_HEADER_DOC)
  @ApiOkResponse({ description: 'Login realizado.', type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos.' })
  @ApiUnauthorizedResponse({ description: 'Credenciais inválidas.' })
  @ApiTooManyRequestsResponse({
    description: 'Muitas tentativas. Aguarde um momento e tente novamente.',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const issued = await this.authService.login(dto);
    this.applySessionCookies(response, issued.token, issued.csrfToken, issued.expiresIn);
    return { expiresIn: issued.expiresIn, csrfToken: issued.csrfToken, user: issued.user };
  }

  @Get('me')
  @ApiCookieAuth('auth-cookie')
  @ApiOperation({
    summary: 'Retorna o usuário autenticado e o CSRF vigente',
    description:
      'Sincroniza o cookie HttpOnly rg_csrf quando a restauração da página o perdeu, ' +
      'mantendo o cookie alinhado ao tempo restante da sessão.',
  })
  @ApiOkResponse({ description: 'Usuário da sessão.', type: MeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Sessão ausente, revogada, inválida ou expirada.' })
  async me(
    @CurrentUser() session: AuthenticatedSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MeResponseDto> {
    const result = await this.authService.me(session);
    const settings = this.cookieSettings();

    response.cookie(
      CSRF_COOKIE_NAME,
      result.csrfToken,
      csrfCookieOptions({ ...settings, maxAgeSeconds: this.csrfMaxAgeSeconds(session) }),
    );

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('auth-cookie')
  @ApiHeader(CSRF_HEADER_DOC)
  @ApiOperation({
    summary: 'Revoga a sessão atual',
    description:
      'Marca a sessão como revogada no banco e remove os cookies. ' +
      'O JWT revogado passa a retornar 401 mesmo antes de expirar.',
  })
  @ApiOkResponse({ description: 'Sessão encerrada.' })
  @ApiUnauthorizedResponse({ description: 'Sessão ausente, revogada, inválida ou expirada.' })
  async logout(
    @CurrentUser() session: AuthenticatedSession,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ message: string }> {
    const result = await this.authService.logout(session.tokenIdentifierHash);
    const settings = this.cookieSettings();
    response.clearCookie(AUTH_COOKIE_NAME, authCookieOptions({ ...settings, maxAgeSeconds: 0 }));
    response.clearCookie(CSRF_COOKIE_NAME, csrfCookieOptions({ ...settings, maxAgeSeconds: 0 }));
    return result;
  }

  private applySessionCookies(
    response: Response,
    token: string,
    csrfToken: string,
    expiresIn: number,
  ): void {
    const settings = this.cookieSettings();
    response.cookie(
      AUTH_COOKIE_NAME,
      token,
      authCookieOptions({ ...settings, maxAgeSeconds: expiresIn }),
    );
    response.cookie(
      CSRF_COOKIE_NAME,
      csrfToken,
      csrfCookieOptions({ ...settings, maxAgeSeconds: expiresIn }),
    );
  }

  /** Sessão válida: tempo restante. Pré-auth: validade padrão do JWT. */
  private csrfMaxAgeSeconds(session: AuthenticatedSession | null): number {
    if (session) {
      const remaining = Math.ceil((session.expiresAt.getTime() - Date.now()) / 1000);
      return Math.max(1, remaining);
    }

    const configured = Number(this.configService.get<string>('JWT_EXPIRES_IN_SECONDS'));
    return Number.isFinite(configured) && configured > 0 ? configured : 3600;
  }

  private cookieSettings(): CookieSettings {
    return {
      secure: this.configService.get<boolean>('COOKIE_SECURE', false),
      sameSite: this.configService.get<'lax' | 'strict'>('COOKIE_SAME_SITE', 'lax'),
    };
  }
}
