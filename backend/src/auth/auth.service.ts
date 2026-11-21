import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { DatabaseError, UniqueConstraintError } from 'sequelize';

import {
  AuthenticatedSession,
  JwtPayload,
} from '../common/interfaces/authenticated-user.interface';
import { PublicUser } from '../users/user.types';
import { UsersService } from '../users/users.service';
import { AuthSessionsService, hashSessionIdentifier } from './auth-sessions.service';
import { deriveCsrfToken } from './auth-cookies';
import { MeResponseDto } from './dto/me-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;

export interface IssuedAuth {
  token: string;
  csrfToken: string;
  expiresIn: number;
  user: PublicUser;
}

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
    private readonly sessionsService: AuthSessionsService,
  ) {}

  async register(dto: RegisterDto): Promise<IssuedAuth> {
    const login = dto.login.trim().toLowerCase();
    const name = dto.name.trim();
    const existingUser = await this.usersService.findByLogin(login);

    if (existingUser) {
      throw new ConflictException('Este login já está em uso.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const user = await this.usersService.create({
        name,
        login,
        passwordHash,
      });

      return this.issueSession(this.usersService.toPublic(user));
    } catch (error) {
      // Duas requisições simultâneas podem passar pela checagem acima;
      // o índice único do banco é a garantia final.
      if (this.isDuplicateEntryError(error)) {
        throw new ConflictException('Este login já está em uso.');
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<IssuedAuth> {
    const user = await this.usersService.findByLogin(dto.login.trim().toLowerCase(), true);
    const passwordMatches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? this.dummyPasswordHash,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Login ou senha inválidos.');
    }

    return this.issueSession(this.usersService.toPublic(user));
  }

  async me(session: AuthenticatedSession): Promise<MeResponseDto> {
    const user = await this.usersService.findById(session.id);

    if (!user) {
      throw new UnauthorizedException('Sessão inválida. Entre novamente.');
    }

    return {
      user: this.usersService.toPublic(user),
      csrfToken: this.csrfTokenFor(session.jti),
    };
  }

  createPreAuthCsrfToken(): string {
    return randomBytes(32).toString('base64url');
  }

  csrfTokenFor(jti: string): string {
    return deriveCsrfToken(this.configService.getOrThrow<string>('JWT_SECRET'), jti);
  }

  async logout(tokenIdentifierHash: string): Promise<{ message: string }> {
    await this.sessionsService.revoke(tokenIdentifierHash);
    return { message: 'Sessão encerrada com sucesso.' };
  }

  /** Valida assinatura, expiração, sessão persistida e existência do usuário. */
  async validateToken(token: string): Promise<AuthenticatedSession> {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Sessão expirada ou token inválido.');
    }

    if (
      typeof payload.sub !== 'number' ||
      typeof payload.login !== 'string' ||
      typeof payload.jti !== 'string' ||
      payload.jti.length === 0
    ) {
      throw new UnauthorizedException('Sessão inválida. Entre novamente.');
    }

    const tokenIdentifierHash = hashSessionIdentifier(payload.jti);
    const session = await this.sessionsService.findValid(tokenIdentifierHash);

    if (!session || session.userId !== payload.sub) {
      throw new UnauthorizedException('Sessão inválida. Entre novamente.');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Sessão inválida. Entre novamente.');
    }

    return {
      id: user.id,
      login: user.login,
      name: user.name,
      jti: payload.jti,
      tokenIdentifierHash,
      expiresAt: session.expiresAt,
    };
  }

  private async issueSession(user: PublicUser): Promise<IssuedAuth> {
    const expiresIn = Number(this.configService.get<string>('JWT_EXPIRES_IN_SECONDS') ?? 3600);
    const jti = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await this.sessionsService.create(user.id, jti, expiresAt);

    const payload: JwtPayload = {
      sub: user.id,
      login: user.login,
      name: user.name,
      jti,
    };

    const token = await this.jwtService.signAsync(payload, { expiresIn });

    return {
      token,
      csrfToken: this.csrfTokenFor(jti),
      expiresIn,
      user,
    };
  }

  private isDuplicateEntryError(error: unknown): boolean {
    if (error instanceof UniqueConstraintError) {
      return true;
    }

    if (error instanceof DatabaseError) {
      const driverError = error.parent as { code?: string } | undefined;
      return driverError?.code === 'ER_DUP_ENTRY';
    }

    return false;
  }
}
