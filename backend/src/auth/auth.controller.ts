import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PublicUserDto } from '../users/dto/public-user.dto';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Cria uma conta',
    description: 'Cria o usuário, armazena a senha com bcrypt e devolve um token JWT.',
  })
  @ApiCreatedResponse({ description: 'Conta criada e autenticada.', type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos.' })
  @ApiConflictResponse({ description: 'Login já cadastrado.' })
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica com login e senha' })
  @ApiOkResponse({ description: 'Login realizado.', type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos.' })
  @ApiUnauthorizedResponse({ description: 'Credenciais inválidas.' })
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Retorna o usuário autenticado' })
  @ApiOkResponse({ description: 'Usuário da sessão.', type: PublicUserDto })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<PublicUserDto> {
    return this.authService.me(user.id);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Encerra a sessão no cliente',
    description:
      'Como o JWT é stateless, o servidor não revoga o token. O cliente deve descartá-lo; ' +
      'o token continua válido tecnicamente até expirar.',
  })
  @ApiOkResponse({ description: 'Instrução de logout retornada.' })
  @ApiUnauthorizedResponse({ description: 'Token ausente, inválido ou expirado.' })
  logout(): { message: string } {
    return this.authService.logout();
  }
}
