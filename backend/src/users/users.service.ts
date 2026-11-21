import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';

import { User } from '../database/models/user.model';
import { PublicUser } from './user.types';

interface CreateUserData {
  name: string;
  login: string;
  passwordHash: string;
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User) private readonly userModel: typeof User) {}

  /**
   * Busca por login. O hash só é carregado quando `includePassword` é true:
   * o escopo padrão do model exclui a coluna `senha`.
   */
  async findByLogin(login: string, includePassword = false): Promise<User | null> {
    if (includePassword) {
      return this.userModel.unscoped().findOne({ where: { login } });
    }

    return this.userModel.findOne({ where: { login } });
  }

  async findById(id: number): Promise<User | null> {
    return this.userModel.findByPk(id);
  }

  async create(data: CreateUserData): Promise<User> {
    return this.userModel.create({ ...data });
  }

  toPublic(user: User): PublicUser {
    return {
      id: user.id,
      name: user.name,
      login: user.login,
      createdAt: user.createdAt,
    };
  }
}
