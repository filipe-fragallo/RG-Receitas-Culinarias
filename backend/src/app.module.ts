import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { SequelizeModule } from '@nestjs/sequelize';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { buildDatabaseSslOptions, readDatabaseSslSettings } from './config/database-ssl';
import { envValidationSchema } from './config/env.validation';
import { buildThrottlerOptions } from './config/throttler.config';
import { buildSequelizeOptions } from './database/sequelize-options';
import { RecipesModule } from './recipes/recipes.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildThrottlerOptions,
    }),
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.getOrThrow<string>('DB_HOST');
        // A mesma função usada pela CLI e pelo comando de checagem. O PEM pode
        // vir de arquivo (local) ou de variável de ambiente (Vercel); a
        // aplicação nunca usa TLS sem validação de certificado e hostname.
        const ssl = buildDatabaseSslOptions(
          readDatabaseSslSettings({
            DB_SSL: configService.get<string>('DB_SSL'),
            DB_SSL_CA: configService.get<string>('DB_SSL_CA'),
            DB_SSL_CA_PATH: configService.get<string>('DB_SSL_CA_PATH'),
          }),
          host,
        );

        return buildSequelizeOptions({
          host,
          port: Number(configService.getOrThrow<string>('DB_PORT')),
          username: configService.getOrThrow<string>('DB_USER'),
          password: configService.getOrThrow<string>('DB_PASSWORD'),
          database: configService.getOrThrow<string>('DB_NAME'),
          logging: configService.get<boolean>('DB_LOGGING', false),
          ssl,
          pool: {
            max: configService.get<number>('DB_POOL_MAX', 10),
            min: configService.get<number>('DB_POOL_MIN', 0),
            acquire: configService.get<number>('DB_POOL_ACQUIRE_MS', 30_000),
            idle: configService.get<number>('DB_POOL_IDLE_MS', 10_000),
          },
        });
      },
    }),
    UsersModule,
    AuthModule,
    CategoriesModule,
    RecipesModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
