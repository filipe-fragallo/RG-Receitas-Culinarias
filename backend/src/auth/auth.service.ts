import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { QueryFailedError } from 'typeorm';

import { JwtPayload } from '../common/interfaces/authenticated-user.interface';
import { PublicUser } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  /**
   * Hash de referência para manter um custo de comparação semelhante quando
   * o login não existe, reduzindo a diferença de tempo entre os dois casos.
   */
  private readonly dummyPasswordHash = bcrypt.hashSync('referencia-timing-auth', BCRYPT_ROUNDS);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const login = dto.login.trim().toLowerCase();
    const nome = dto.nome.trim();
    const existingUser = await this.usersService.findByLogin(login);

    if (existingUser) {
      throw new ConflictException('Este login já está em uso.');
    }

    const passwordHash = await bcrypt.hash(dto.senha, BCRYPT_ROUNDS);

    try {
      const user = await this.usersService.create({
        nome,
        login,
        senha: passwordHash,
      });

      return this.buildAuthResponse(this.usersService.toPublic(user));
    } catch (error) {
      // Duas requisições simultâneas podem passar pela checagem acima;
      // o índice único do banco é a garantia final.
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException('Este login já está em uso.');
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByLogin(dto.login.trim().toLowerCase(), true);
    const passwordMatches = await bcrypt.compare(dto.senha, user?.senha ?? this.dummyPasswordHash);

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Login ou senha inválidos.');
    }

    return this.buildAuthResponse(this.usersService.toPublic(user));
  }

  async me(userId: number): Promise<PublicUser> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Sessão inválida. Entre novamente.');
    }

    return this.usersService.toPublic(user);
  }

  logout(): { message: string } {
    return {
      message:
        'Logout realizado no cliente. O token JWT deixa de ser utilizado e expira automaticamente.',
    };
  }

  private async buildAuthResponse(user: PublicUser): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      login: user.login,
      nome: user.nome,
    };

    const expiresIn = Number(this.configService.get<string>('JWT_EXPIRES_IN_SECONDS') ?? 3600);

    const accessToken = await this.jwtService.signAsync(payload, { expiresIn });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user,
    };
  }

  private isDuplicateEntryError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string } | undefined;
    return driverError?.code === 'ER_DUP_ENTRY';
  }
}
