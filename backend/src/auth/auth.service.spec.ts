import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

interface CreateUserInput {
  nome: string;
  login: string;
  senha: string;
}

interface UsersServiceMock {
  findByLogin: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock<Promise<User>, [CreateUserInput]>;
  toPublic: jest.Mock;
}

interface JwtServiceMock {
  signAsync: jest.Mock;
}

interface ConfigServiceMock {
  get: jest.Mock;
}

const makeUser = (overrides: Partial<User> = {}): User =>
  Object.assign(new User(), {
    id: 1,
    nome: 'Maria Silva',
    login: 'maria.silva',
    senha: '$2a$10$hash-de-referencia',
    criadoEm: new Date('2026-01-01T10:00:00.000Z'),
    alteradoEm: new Date('2026-01-01T10:00:00.000Z'),
    receitas: [],
    ...overrides,
  });

const makeRegisterDto = (overrides: Partial<RegisterDto> = {}): RegisterDto => ({
  nome: 'Maria Silva',
  login: 'maria.silva',
  senha: 'Senha@123',
  confirmarSenha: 'Senha@123',
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersServiceMock;
  let jwtService: JwtServiceMock;
  let configService: ConfigServiceMock;

  beforeEach(() => {
    usersService = {
      findByLogin: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      create: jest.fn<Promise<User>, [CreateUserInput]>(),
      toPublic: jest.fn((user: User) => ({
        id: user.id,
        nome: user.nome,
        login: user.login,
        criadoEm: user.criadoEm,
      })),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('token-assinado'),
    };
    configService = {
      get: jest.fn().mockReturnValue('3600'),
    };

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  describe('register', () => {
    it('armazena a senha com bcrypt e não devolve o hash', async () => {
      const user = makeUser();
      usersService.create.mockResolvedValue(user);

      const result = await service.register(
        makeRegisterDto({ nome: '  Maria Silva  ', login: ' MARIA.SILVA ' }),
      );

      expect(usersService.findByLogin).toHaveBeenCalledWith('maria.silva');
      expect(usersService.create).toHaveBeenCalledTimes(1);

      const createArgument = usersService.create.mock.calls[0][0];

      expect(createArgument.nome).toBe('Maria Silva');
      expect(createArgument.login).toBe('maria.silva');
      expect(createArgument.senha).not.toBe('Senha@123');
      expect(await bcrypt.compare('Senha@123', createArgument.senha)).toBe(true);
      expect(result.accessToken).toBe('token-assinado');
      expect(result.user).not.toHaveProperty('senha');
      expect(result.expiresIn).toBe(3600);
    });

    it('rejeita login já cadastrado com 409', async () => {
      usersService.findByLogin.mockResolvedValue(makeUser());

      await expect(service.register(makeRegisterDto())).rejects.toBeInstanceOf(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('valida a senha e emite o token', async () => {
      const passwordHash = await bcrypt.hash('Senha@123', 4);
      usersService.findByLogin.mockResolvedValue(makeUser({ senha: passwordHash }));

      const dto = { login: ' MARIA.SILVA ', senha: 'Senha@123' };
      const result = await service.login(dto);

      expect(usersService.findByLogin).toHaveBeenCalledWith('maria.silva', true);
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 1, login: 'maria.silva', nome: 'Maria Silva' },
        { expiresIn: 3600 },
      );
      expect(result.user.id).toBe(1);
      expect(result.user).not.toHaveProperty('senha');
    });

    it('rejeita senha incorreta sem revelar qual campo falhou', async () => {
      const passwordHash = await bcrypt.hash('Senha@123', 4);
      usersService.findByLogin.mockResolvedValue(makeUser({ senha: passwordHash }));

      await expect(service.login({ login: 'maria.silva', senha: 'SenhaErrada' })).rejects.toThrow(
        'Login ou senha inválidos.',
      );
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('rejeita login inexistente com a mesma mensagem', async () => {
      usersService.findByLogin.mockResolvedValue(null);

      await expect(
        service.login({ login: 'nao.existe', senha: 'Senha@123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('me', () => {
    it('devolve o usuário autenticado sem senha', async () => {
      usersService.findById.mockResolvedValue(makeUser());
      const user = await service.me(1);

      expect(user.login).toBe('maria.silva');
      expect(user).not.toHaveProperty('senha');
    });

    it('trata usuário removido como sessão inválida', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.me(1)).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
