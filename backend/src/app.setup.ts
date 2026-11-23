import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';

import { getAllowedOrigins } from './config/app-origins';

/**
 * Configuração compartilhada entre o bootstrap real e os testes de integração,
 * garantindo que ambos exercitem o mesmo pipeline HTTP.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');

  const configService = app.get(ConfigService);
  const httpApp = app as NestExpressApplication;

  if (configService.get<boolean>('TRUST_PROXY', false)) {
    // Apenas o proxy imediato é confiável; evita aceitar X-Forwarded-For forjado.
    httpApp.set('trust proxy', Number(configService.get<string>('TRUST_PROXY_HOPS', '1')));
  }

  app.use(cookieParser());

  // Impede armazenamento de respostas privadas por caches intermediários,
  // incluindo rotas de autenticação, receitas e respostas de erro.
  app.use('/api', (_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use(
    helmet({
      // O Swagger UI usa scripts/estilos inline; a API não serve HTML próprio.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({
    origin: getAllowedOrigins(configService),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );

  app.enableShutdownHooks();
}
