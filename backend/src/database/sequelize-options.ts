import { SequelizeModuleOptions } from '@nestjs/sequelize';

import { AuthSession } from './models/auth-session.model';
import { Category } from './models/category.model';
import { Recipe } from './models/recipe.model';
import { User } from './models/user.model';

export interface DatabaseConnectionOptions {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  logging?: boolean;
}

/**
 * Configuração única do Sequelize usada pela aplicação. `synchronize` fica
 * permanentemente desligado: o schema é responsabilidade das migrations.
 */
export function buildSequelizeOptions(
  connection: DatabaseConnectionOptions,
): SequelizeModuleOptions {
  return {
    dialect: 'mysql',
    host: connection.host,
    port: connection.port,
    username: connection.username,
    password: connection.password,
    database: connection.database,
    models: [User, Category, Recipe, AuthSession],
    autoLoadModels: false,
    synchronize: false,
    logging: connection.logging ?? false,
    timezone: '+00:00',
    dialectOptions: {
      charset: 'utf8mb4',
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30_000,
      idle: 10_000,
    },
  };
}
