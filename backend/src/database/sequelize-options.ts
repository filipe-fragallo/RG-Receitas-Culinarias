import { SequelizeModuleOptions } from '@nestjs/sequelize';

import { DB_SSL_REJECT_MESSAGE, type DatabaseSslOptions } from '../config/database-ssl';
import { AuthSession } from './models/auth-session.model';
import { Category } from './models/category.model';
import { Recipe } from './models/recipe.model';
import { User } from './models/user.model';

export interface DatabasePoolOptions {
  max: number;
  min: number;
  acquire: number;
  idle: number;
}

export interface DatabaseConnectionOptions {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  logging?: boolean;
  /** Já validado; `undefined` preserva a conexão local sem TLS. */
  ssl?: DatabaseSslOptions;
  /** Sobrescreve os padrões quando o ambiente pede um pool menor. */
  pool?: Partial<DatabasePoolOptions>;
}

/**
 * Configuração única do Sequelize usada pela aplicação. `synchronize` fica
 * permanentemente desligado: o schema é responsabilidade das migrations.
 */
export function buildSequelizeOptions(
  connection: DatabaseConnectionOptions,
): SequelizeModuleOptions {
  if (
    connection.ssl &&
    (connection.ssl.rejectUnauthorized !== true || connection.ssl.verifyIdentity !== true)
  ) {
    throw new Error(DB_SSL_REJECT_MESSAGE);
  }

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
      ...(connection.ssl ? { ssl: connection.ssl } : {}),
    },
    pool: {
      max: connection.pool?.max ?? 10,
      min: connection.pool?.min ?? 0,
      acquire: connection.pool?.acquire ?? 30_000,
      idle: connection.pool?.idle ?? 10_000,
    },
  };
}
