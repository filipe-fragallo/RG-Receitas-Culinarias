import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { setupSwagger } from './config/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  setupSwagger(app);

  const configService = app.get(ConfigService);
  const port = Number(configService.get<string>('PORT', '3000'));

  await app.listen(port, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`API disponível em http://localhost:${port}/api`);
  logger.log(`Swagger disponível em http://localhost:${port}/api/docs`);
}

void bootstrap();
