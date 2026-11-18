import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

/**
 * Configuração compartilhada entre o bootstrap real e os testes de integração,
 * garantindo que ambos exercitem o mesmo pipeline HTTP.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');

  app.use(
    helmet({
      // O Swagger UI usa scripts/estilos inline; a API não serve HTML próprio.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const configService = app.get(ConfigService);
  const configuredOrigins = configService
    .get<string>('CORS_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: configuredOrigins.includes('*') ? true : configuredOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
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
