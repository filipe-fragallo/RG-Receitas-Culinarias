import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { AuthSessionsService, hashSessionIdentifier } from './auth-sessions.service';
import { deriveCsrfToken } from './auth-cookies';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from '../common/interfaces/authenticated-user.interface';
import { User } from '../database/models/user.model';
import { UsersService } from '../users/users.service';

interface CreateUserInput {
  name: string;
  login: string;
  passwordHash: string;
}

interface UsersServiceMock {
  findByLogin: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock<Promise<User>, [CreateUserInput]>;
  toPublic: jest.Mock;
}

interface JwtServiceMock {
  signAsync: jest.Mock<Promise<string>, [JwtPayload, { expiresIn: number }]>;
  verifyAsync: jest.Mock<Promise<JwtPayload>, [string]>;
}

interface ConfigServiceMock {
  get: jest.Mock;
  getOrThrow: jest.Mock;
}

interface SessionsServiceMock {
  create: jest.Mock<Promise<string>, [number, string, Date]>;
  findValid: jest.Mock<Promise<unknown>, [string]>;
  revoke: jest.Mock<Promise<boolean>, [string]>;
  cleanupExpiredIfDue: jest.Mock<Promise<void>, [number?]>;
}

const JWT_SECRET = 'test-only-secret-with-at-least-32-characters-long';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 1,
    name: 'Maria Silva',
    login: 'maria.silva',
    passwordHash: '$2a$10$hash-de-referencia',
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-01T10:00:00.000Z'),
    ...overrides,
  }) as User;

const makeRegisterDto = (overrides: Partial<RegisterDto> = {}): RegisterDto => ({
  name: 'Maria Silva',
  login: 'maria.silva',
  password: 'Senha@123',
  confirmPassword: 'Senha@123',
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersServiceMock;
  let jwtService: JwtServiceMock;
  let configService: ConfigServiceMock;
  let sessionsService: SessionsServiceMock;

  beforeEach(() => {
    usersService = {
      findByLogin: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      create: jest.fn<Promise<User>, [CreateUserInput]>(),
      toPublic: jest.fn((user: User) => ({
        id: user.id,
        name: user.name,
        login: user.login,
        createdAt: user.createdAt,
      })),
    };
    jwtService = {
      signAsync: jest
        .fn<Promise<string>, [JwtPayload, { expiresIn: number }]>()
        .mockResolvedValue('token-assinado'),
      verifyAsync: jest.fn<Promise<JwtPayload>, [string]>(),
    };
    configService = {
      get: jest.fn().mockReturnValue('3600'),
      getOrThrow: jest.fn().mockReturnValue(JWT_SECRET),
    };
    sessionsService = {
      create: jest
        .fn<Promise<string>, [number, string, Date]>()
        .mockResolvedValue('hash-da-sessao'),
      findValid: jest.fn<Promise<unknown>, [string]>(),
      revoke: jest.fn<Promise<boolean>, [string]>().mockResolvedValue(true),
      cleanupExpiredIfDue: jest.fn<Promise<void>, [number?]>().mockResolvedValue(undefined),
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      sessionsService as unknown as AuthSessionsService,
    );
  });

  describe('register', () => {
    it('hashes the password, persists a session and never returns the JWT', async () => {
      const user = makeUser();
      usersService.create.mockResolvedValue(user);

      const result = await service.register(
        makeRegisterDto({ name: '  Maria Silva  ', login: ' MARIA.SILVA ' }),
      );

      expect(usersService.findByLogin).toHaveBeenCalledWith('maria.silva');
      const createArgument = usersService.create.mock.calls[0][0];
      expect(createArgument.name).toBe('Maria Silva');
      expect(createArgument.login).toBe('maria.silva');
      expect(createArgument.passwordHash).not.toBe('Senha@123');
      expect(await bcrypt.compare('Senha@123', createArgument.passwordHash)).toBe(true);

      const [, jti] = sessionsService.create.mock.calls[0];
      expect(jti).toMatch(/^[a-f0-9]{32}$/);
      const signedPayload = jwtService.signAsync.mock.calls[0][0];
      expect(signedPayload.jti).toBe(jti);
      expect(result.token).toBe('token-assinado');
      expect(result).not.toHaveProperty('accessToken');
      expect(result.csrfToken).toBe(deriveCsrfToken(JWT_SECRET, jti));
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.expiresIn).toBe(3600);
    });

    it('rejects an already registered login with 409', async () => {
      usersService.findByLogin.mockResolvedValue(makeUser());

      await expect(service.register(makeRegisterDto())).rejects.toBeInstanceOf(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('validates the password and issues a session-bound token', async () => {
      const passwordHash = await bcrypt.hash('Senha@123', 4);
      usersService.findByLogin.mockResolvedValue(makeUser({ passwordHash }));

      const dto = { login: ' MARIA.SILVA ', password: 'Senha@123' };
      const result = await service.login(dto);

      expect(usersService.findByLogin).toHaveBeenCalledWith('maria.silva', true);
      const jti = jwtService.signAsync.mock.calls[0][0].jti;
      expect(sessionsService.create).toHaveBeenCalledWith(1, jti, expect.any(Date) as Date);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 1, login: 'maria.silva', name: 'Maria Silva', jti },
        { expiresIn: 3600 },
      );
      expect(result.user.id).toBe(1);
      expect(result.csrfToken).toBe(deriveCsrfToken(JWT_SECRET, jti));
    });

    it('rejects an incorrect password without revealing which field failed', async () => {
      const passwordHash = await bcrypt.hash('Senha@123', 4);
      usersService.findByLogin.mockResolvedValue(makeUser({ passwordHash }));

      await expect(
        service.login({ login: 'maria.silva', password: 'SenhaErrada' }),
      ).rejects.toThrow('Login ou senha inválidos.');
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('rejects a nonexistent login with the same message', async () => {
      usersService.findByLogin.mockResolvedValue(null);

      await expect(
        service.login({ login: 'nao.existe', password: 'Senha@123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('validateToken', () => {
    it('accepts a token whose persisted session is valid', async () => {
      const payload = { sub: 1, login: 'maria.silva', name: 'Maria Silva', jti: 'jti-valido' };
      jwtService.verifyAsync.mockResolvedValue(payload);
      sessionsService.findValid.mockResolvedValue({
        id: 9,
        userId: 1,
        tokenIdentifierHash: hashSessionIdentifier(payload.jti),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2026-01-01T01:00:00.000Z'),
        revokedAt: null,
      });
      usersService.findById.mockResolvedValue(makeUser());

      const session = await service.validateToken('token-valido');

      expect(sessionsService.findValid).toHaveBeenCalledWith(hashSessionIdentifier(payload.jti));
      expect(session).toMatchObject({
        id: 1,
        login: 'maria.silva',
        jti: payload.jti,
        tokenIdentifierHash: hashSessionIdentifier(payload.jti),
      });
    });

    it('rejects a revoked or missing session', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 1,
        login: 'maria.silva',
        name: 'Maria Silva',
        jti: 'jti-revogado',
      });
      sessionsService.findValid.mockResolvedValue(null);

      await expect(service.validateToken('token-revogado')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a token without jti (legacy shape)', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 1,
        login: 'maria.silva',
        name: 'Maria Silva',
      } as unknown as JwtPayload);

      await expect(service.validateToken('token-legado')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(sessionsService.findValid).not.toHaveBeenCalled();
    });

    it('rejects a tampered token when signature verification fails', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

      await expect(service.validateToken('token-adulterado')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a deleted user even when the session row still exists', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 1,
        login: 'maria.silva',
        name: 'Maria Silva',
        jti: 'jti-valido',
      });
      sessionsService.findValid.mockResolvedValue({ userId: 1 });
      usersService.findById.mockResolvedValue(null);

      await expect(service.validateToken('token-valido')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes only the current session hash', async () => {
      await expect(service.logout('hash-atual')).resolves.toEqual({
        message: 'Sessão encerrada com sucesso.',
      });
      expect(sessionsService.revoke).toHaveBeenCalledWith('hash-atual');
    });
  });

  describe('me', () => {
    it('returns the authenticated user and the CSRF token without the password', async () => {
      usersService.findById.mockResolvedValue(makeUser());

      const result = await service.me({
        id: 1,
        login: 'maria.silva',
        name: 'Maria Silva',
        jti: 'jti-valido',
        tokenIdentifierHash: 'hash',
        expiresAt: new Date('2026-01-01T01:00:00.000Z'),
      });

      expect(result.user.login).toBe('maria.silva');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.csrfToken).toBe(deriveCsrfToken(JWT_SECRET, 'jti-valido'));
    });

    it('treats a deleted user as an invalid session', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.me({
          id: 1,
          login: 'maria.silva',
          name: null,
          jti: 'jti',
          tokenIdentifierHash: 'hash',
          expiresAt: new Date('2026-01-01T01:00:00.000Z'),
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
