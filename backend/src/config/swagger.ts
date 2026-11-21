import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Meu Caderno de Receitas — API')
    .setDescription(
      [
        'API REST para cadastro de usuários e gestão de receitas culinárias.',
        '',
        '**Autenticação:** o JWT é definido pelo servidor no cookie HttpOnly `rg_auth` ' +
          'em `/api/auth/login` e `/api/auth/register`. O cliente não lê nem envia o JWT.',
        '',
        '**CSRF:** requisições POST/PATCH/DELETE devem enviar o header `X-CSRF-Token` ' +
          'com o valor devolvido por `/api/auth/csrf`, `/api/auth/login`, ' +
          '`/api/auth/register` ou `/api/auth/me`.',
        '',
        '**Sessão:** o logout revoga a sessão no banco; tokens revogados retornam 401.',
        '',
        '**Isolamento:** todas as consultas de receitas são filtradas pelo usuário da sessão.',
        '',
        '**Nomes:** os identificadores públicos são em inglês; os nomes físicos do MySQL permanecem originais.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'rg_auth',
        description: 'Cookie HttpOnly definido no login/cadastro.',
      },
      'auth-cookie',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-CSRF-Token',
        description: 'Token CSRF vinculado à sessão.',
      },
      'csrf-token',
    )
    .addTag('Auth', 'Cadastro, login, sessão e logout')
    .addTag('Categories', 'Categorias pré-cadastradas no banco')
    .addTag('Recipes', 'CRUD de receitas do usuário autenticado')
    .addTag('Health', 'Verificação de disponibilidade da API')
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
