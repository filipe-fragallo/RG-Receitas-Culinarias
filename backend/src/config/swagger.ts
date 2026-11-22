import { INestApplication } from '@nestjs/common';
import type { Express, Request, Response } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { isVercelRuntime } from './runtime';

/**
 * A Vercel Function não inclui automaticamente os assets estáticos do
 * swagger-ui-dist. Para evitar 404 em /api/docs/*.js e *.css, a página
 * serverless carrega uma versão fixa do Swagger UI por CDN e usa a
 * especificação OpenAPI já servida pelo próprio Nest em /api/docs-json.
 *
 * Localmente o @nestjs/swagger continua servindo a UI padrão, sem CDN.
 */
const VERCEL_SWAGGER_UI_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Meu Caderno de Receitas — API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.34.1/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.34.1/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.34.1/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: '/api/docs-json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
        persistAuthorization: true,
        displayRequestDuration: true
      });
    };
  </script>
</body>
</html>`;

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

  const serverless = isVercelRuntime();

  SwaggerModule.setup('api/docs', app, document, {
    // O servidor local usa os assets oficiais; na Vercel, apenas o JSON
    // precisa do @nestjs/swagger, sem dependência de arquivos estáticos.
    ui: !serverless,
    customSiteTitle: 'Meu Caderno de Receitas — API',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  });

  if (serverless) {
    const express = app.getHttpAdapter().getInstance() as Express;
    express.get('/api/docs', (_req: Request, res: Response) => {
      res.type('html').send(VERCEL_SWAGGER_UI_HTML);
    });
  }
}
