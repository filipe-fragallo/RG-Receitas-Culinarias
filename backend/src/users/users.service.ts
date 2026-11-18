import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PublicUser } from './user.types';
import { User } from './user.entity';

interface CreateUserData {
  nome: string;
  login: string;
  senha: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /** Busca por login. O hash só é selecionado quando explicitamente necessário. */
  async findByLogin(login: string, includePassword = false): Promise<User | null> {
    const query = this.usersRepository
      .createQueryBuilder('usuario')
      .where('usuario.login = :login', { login });

    if (includePassword) {
      query.addSelect('usuario.senha');
    }

    return query.getOne();
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(data: CreateUserData): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  toPublic(user: User): PublicUser {
    return {
      id: user.id,
      nome: user.nome,
      login: user.login,
      criadoEm: user.criadoEm,
    };
  }
}
