import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { config as loadEnv } from 'dotenv';
import { Sequelize } from 'sequelize-typescript';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { PortInUseError, assertPortAvailable } from './config/port-preflight';
import { setupSwagger } from './config/swagger';
import { shouldRunMigrationsOnBootstrap } from './database/database-safety';
import { runMigrationsAndSeeders } from './database/migrator';

// A pré-verificação de porta precisa ler .env antes de NestFactory carregar o
// ConfigModule. A ordem de precedência é a mesma usada pelo AppModule.
loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const logger = new Logger('Bootstrap');

function requestedPort(): number {
  return Number(process.env.PORT ?? '3000');
}

async function bootstrap(): Promise<void> {
  const port = requestedPort();

  // Falha antes de criar o módulo, abrir conexões ou aplicar migrations.
  if (Number.isInteger(port) && port > 0 && port <= 65535) {
    await assertPortAvailable(port);
  }

  const app = await NestFactory.create(AppModule);
  configureApp(app);
  setupSwagger(app);

  const configService = app.get(ConfigService);

  // Em desenvolvimento local o schema é criado por migrations + seeders, sem
  // passo manual. Em produção ou host remoto a aplicação NUNCA executa essa
  // etapa automaticamente: use `npm run db:migrate` com autorização explícita.
  if (
    shouldRunMigrationsOnBootstrap({
      host: configService.get<string>('DB_HOST'),
      schema: configService.get<string>('DB_NAME'),
      nodeEnv: configService.get<string>('NODE_ENV'),
      allowRemote: configService.get<boolean>('DB_ALLOW_REMOTE', false),
      allowedRemoteHost: configService.get<string>('DB_ALLOWED_HOST', ''),
      migrationsAuto: configService.get<boolean | undefined>('DB_MIGRATIONS_AUTO'),
    })
  ) {
    try {
      const executed = await runMigrationsAndSeeders(app.get(Sequelize));
      logger.log(
        `Banco preparado (${executed.migrations.length} migration(s) e ` +
          `${executed.seeders.length} seeder(s) aplicados).`,
      );
    } catch (error) {
      logger.error(
        'Falha ao preparar o banco. Verifique se o MySQL está no ar ' +
          '(cd backend && docker compose up -d) e as variáveis DB_* do backend/.env.',
        error instanceof Error ? error.stack : String(error),
      );
      process.exit(1);
    }
  } else {
    logger.warn(
      'Migrations automáticas desativadas (produção, host remoto, schema não autorizado ou DB_MIGRATIONS_AUTO=false). ' +
        'Aplique as migrations explicitamente com npm run db:migrate.',
    );
  }

  try {
    await app.listen(port, '0.0.0.0');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      throw new PortInUseError(port);
    }
    throw error;
  }

  logger.log(`API disponível em http://localhost:${port}/api`);
  logger.log(`Swagger disponível em http://localhost:${port}/api/docs`);
}

void bootstrap().catch((error: unknown) => {
  if (error instanceof PortInUseError) {
    logger.error(error.message);
  } else {
    logger.error(
      'Falha na inicialização da API.',
      error instanceof Error ? error.stack : String(error),
    );
  }
  process.exit(1);
});
