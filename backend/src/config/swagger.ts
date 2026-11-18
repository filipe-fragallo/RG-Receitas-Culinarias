import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Meu Caderno de Receitas — API')
    .setDescription(
      [
        'API REST para cadastro de usuários e gestão de receitas culinárias.',
        '',
        '**Autenticação:** envie `Authorization: Bearer <accessToken>` nas rotas protegidas.',
        'O token é obtido em `POST /api/auth/login` ou `POST /api/auth/register`.',
        '',
        '**Isolamento:** todas as consultas de receitas são filtradas pelo usuário do token.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token retornado por /api/auth/login',
      },
      'access-token',
    )
    .addTag('Auth', 'Cadastro, login, sessão e logout')
    .addTag('Categorias', 'Categorias pré-cadastradas no banco')
    .addTag('Receitas', 'CRUD de receitas do usuário autenticado')
    .addTag('Saúde', 'Verificação de disponibilidade da API')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Meu Caderno de Receitas — API',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });
}
