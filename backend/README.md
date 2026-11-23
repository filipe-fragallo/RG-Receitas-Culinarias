# Backend — Meu Caderno de Receitas

API REST do desafio **RG Receitas Culinárias**. Cadastro e autenticação de usuários, categorias e
CRUD de receitas isolado por dono, com JWT em cookie HttpOnly, CSRF, revogação persistente de sessão,
MySQL 8.4 e Sequelize.

> Este projeto é independente do frontend: possui `package.json`, lockfile, `.env.example`,
> `.gitignore`, `.dockerignore`, `Dockerfile`, `docker-compose.yml` e este README. O frontend React
> está em `../frontend`. A raiz do monorepositório contém também `.github/` e o `README.md` geral.

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Tecnologias](#2-tecnologias)
3. [Arquitetura e estrutura real de diretórios](#3-arquitetura-e-estrutura-real-de-diretórios)
4. [Decisões técnicas](#4-decisões-técnicas)
5. [Pré-requisitos](#5-pré-requisitos)
6. [Instalação e primeira execução local](#6-instalação-e-primeira-execução-local)
7. [Variáveis de ambiente](#7-variáveis-de-ambiente)
8. [MySQL com Docker Compose](#8-mysql-com-docker-compose)
9. [Sequelize, migrations e seeders](#9-sequelize-migrations-e-seeders)
10. [Inicialização do backend](#10-inicialização-do-backend)
11. [Endpoints e Swagger](#11-endpoints-e-swagger)
12. [Autenticação e autorização](#12-autenticação-e-autorização)
13. [Testes](#13-testes)
14. [Lint, Prettier e build](#14-lint-prettier-e-build)
15. [Segurança do banco e comandos destrutivos](#15-segurança-do-banco-e-comandos-destrutivos)
16. [Problemas comuns](#16-problemas-comuns)
17. [Limitações conhecidas](#17-limitações-conhecidas)
18. [Produção: Vercel + TiDB Cloud](#18-produção-vercel--tidb-cloud)
19. [Auditoria de dependências](#19-auditoria-de-dependências)

---

## 1. Visão geral

A API expõe:

- cadastro, login, consulta da sessão (`/me`), emissão de CSRF e logout com revogação persistente;
- criação de receitas vinculadas ao usuário da sessão;
- listagem paginada com pesquisa, filtro por categoria e ordenação no banco;
- detalhe, edição e exclusão restritos ao dono;
- estatísticas do caderno e as 13 categorias originais do desafio.

As tabelas de negócio (`usuarios`, `categorias`, `receitas`) preservam os tipos, índices, chaves
estrangeiras e a collation `utf8mb4_0900_ai_ci` do schema original. `auth_sessions` é uma tabela
técnica acrescentada para revogação; `SequelizeMeta` e `SequelizeData` são apenas tabelas de controle
do Umzug.

**Política de nomes.** Os nomes físicos do MySQL — schemas, tabelas, colunas, índices e FKs —
permanecem exatamente como no desafio original. O código TypeScript, as respostas JSON e os
parâmetros de consulta usam identificadores em inglês. Os models Sequelize fazem o mapeamento
explícito (por exemplo, `name` → `nome`, `passwordHash` → `senha`, `userId` → `id_usuarios` e
`createdAt` → `criado_em`). Os nomes persistidos das migrations e seeders também não foram
alterados.

## 2. Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Runtime | Node.js 22+ e npm 10+ |
| Framework | NestJS 11 |
| Linguagem | TypeScript 5.9 (modo estrito) |
| ORM | Sequelize 6 + `sequelize-typescript` + `@nestjs/sequelize` |
| Migrations/seeders | Umzug |
| Banco | MySQL 8.4 via `mysql2` |
| Autenticação | JWT (`@nestjs/jwt`) em cookie HttpOnly, bcryptjs e sessões persistidas |
| Validação | `class-validator` / `class-transformer` |
| Documentação | Swagger / OpenAPI |
| Segurança HTTP | Helmet, CORS estrito, cookies, CSRF e `@nestjs/throttler` |
| Testes | Jest, Supertest, MySQL real |
| Qualidade | ESLint (flat config) e Prettier |

## 3. Arquitetura e estrutura real de diretórios

```text
backend/
├── src/
│   ├── auth/                  # cadastro, login, cookies, CSRF, sessões, guard, DTOs
│   ├── users/                 # consulta de usuários e projeção pública
│   ├── categories/            # listagem das 13 categorias
│   ├── recipes/               # CRUD, busca, filtros, estatísticas
│   ├── common/                # filtro global, decorators, interfaces
│   ├── config/                # validação de env e Swagger
│   ├── database/
│   │   ├── models/            # User, Category, Recipe e AuthSession (Sequelize)
│   │   ├── migrations/        # 3 tabelas originais + auth_sessions
│   │   ├── seeders/           # 13 categorias iniciais
│   │   ├── database-safety.ts # barreiras para operações destrutivas
│   │   ├── migrator.ts        # runner Umzug com lock distribuído
│   │   ├── sequelize-options.ts
│   │   └── cli.ts             # comandos db:*
│   ├── app.module.ts
│   ├── app.setup.ts
│   └── main.ts
├── test/
│   ├── integration/           # API + MySQL real (Jest/Supertest)
│   ├── e2e/                   # API E2E (HTTP, Swagger, segurança)
│   └── setup/                 # variáveis de teste e recriação controlada do schema
├── docker-compose.yml         # MySQL no padrão; API + frontend no profile full
├── Dockerfile
├── .env.example
├── eslint.config.mjs
├── tsconfig.json
└── package.json
```

Fluxo: `Controller → Service → Model (Sequelize) → MySQL`. `configureApp` concentra prefixo `/api`,
`cookie-parser`, `trust proxy` explícito, Helmet, CORS com credenciais, `ValidationPipe` e o filtro
global de exceções; testes e runtime usam o mesmo pipeline. O guard global valida sessão a cada
requisição e o guard de throttling limita login/cadastro.

## 4. Decisões técnicas

1. **Sequelize em vez de TypeORM.** Esta é uma decisão técnica deste projeto, não uma
   exigência da empresa contratante. A API e o schema foram preservados.
2. **Migrations como fonte executável do schema.** `synchronize`/`sync({ force })`/`sync({ alter })`
   nunca são usados. Docker, bootstrap e testes executam as mesmas migrations e seeders.
3. **Bootstrap controlado.** Em desenvolvimento local, `main.ts` aplica pendências de forma
   idempotente para manter `docker compose up -d && npm run dev` simples. O bootstrap usa a
   mesma política de schema da CLI e **não** aplica nada em produção, host remoto sem autorização
   nominal ou schema desconhecido: use `npm run db:migrate` explicitamente.
4. **Lock distribuído.** `GET_LOCK`/`RELEASE_LOCK` do MySQL serializa bootstrap, `db:migrate`,
   `db:seed`, `db:down` e `db:reset` pelo mesmo nome de lock.
5. **Datas preenchidas pelo Sequelize.** O schema original não tem `DEFAULT CURRENT_TIMESTAMP`; os
   timestamps são mapeados para `criado_em`/`alterado_em` sem alterar colunas.
6. **Hash de senha protegido.** `defaultScope` do model `User` exclui `passwordHash` (coluna física
   `senha`); somente o login usa `unscoped()` para validar o hash.
7. **Autorização na cláusula `WHERE`.** Toda consulta filtra por `userId` do token. Recurso alheio
   retorna 404, sem revelar existência.
8. **Busca com `LOCATE`.** `%` e `_` não viram curingas de `LIKE`.
9. **Contratos em camelCase e identificadores em inglês.** Models, DTOs e JSON público usam nomes em
   inglês; o banco mantém os nomes originais via `field`, `tableName`, `createdAt` e `updatedAt` dos
   models.
10. **Compose com profiles.** O comando padrão sobe somente MySQL; `--profile full` sobe a stack
    completa sem conflitar com a porta 3000 do desenvolvimento local.
11. **JWT apenas em cookie HttpOnly.** `rg_auth` é definido no login/cadastro com `Path=/api`, sem
    `Domain`, `SameSite=lax|strict` e `Secure` obrigatório em produção. O JSON não contém token.
12. **CSRF em defesa profunda.** Origem é comparada com `CORS_ORIGIN`; toda requisição que modifica
    dados exige `X-CSRF-Token` igual ao cookie `rg_csrf`. Após autenticação, o token é derivado por
    HMAC do `jti` da sessão, portanto troca de sessão invalida o token antigo.
13. **Revogação real.** Cada JWT carrega um `jti`; apenas `SHA-256(jti)` é gravado em `auth_sessions`.
    O guard consulta a sessão em todas as requisições, e logout marca `revoked_at`. O efeito
    sobrevive a reinício da API, e sessões diferentes do mesmo usuário são independentes.
14. **Throttling configurável.** Login e cadastro usam policies separadas por IP e por login
    normalizado, com resposta 429 em português. Cada rota desativa explicitamente as policies da
    outra, portanto tentativas de login não consomem a cota de cadastro e vice-versa. `TRUST_PROXY`
    é desligado por padrão; no Compose, apenas o Nginx imediato é confiável, evitando spoof de
    `X-Forwarded-For`.
15. **Compatibilidade de nomes.** As tabelas originais e a migration `004` não alteram colunas,
    índices, FKs ou constraints das tabelas de negócio; os contratos HTTP permanecem em inglês.
16. **Reconciliação antes do histórico.** Tabelas físicas preexistentes só entram no
    `SequelizeMeta` depois de comparação integral de colunas, índices, FKs, engine e collation.
    Lacunas não destrutivas são reparadas após validação dos dados; divergências ambíguas falham
    sem escrita e sem registro parcial.

Os arquivos originais recebidos (`script.sql`, PDF e DER) e o SQL de referência não são executados
nem versionados neste repositório; uma cópia para auditoria foi mantida fora dele. A equivalência
com as migrations foi verificada por comparação de colunas, tipos, índices, FKs, collation e das
13 categorias.

## 5. Pré-requisitos

- Node.js 22+ e npm 10+
- Docker Desktop ou Docker Engine com Compose v2
- Portas `3306` (MySQL) e `3000` (API local) livres; `3001` e `8080` apenas para o profile `full`

Não é necessário instalar MySQL no sistema operacional.

## 6. Instalação e primeira execução local

```bash
cd backend
npm ci
cp .env.example .env
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
docker compose up -d
npm run db:migrate
npm run db:status
npm run db:seed
npm run db:status
npm run dev
```

O `.env.example` não contém segredo fixo: o comando acima gera um valor único, obrigatório também
no desenvolvimento. Em desenvolvimento, `npm install` também funciona; `npm ci` é o caminho usado
em CI e em instalação limpa. `npm run dev` é alias de `npm run start:dev`.

O backend local escuta em `3000`. O backend do Compose publica `3001` no host e mantém `3000` apenas
na rede interna; o Nginx usa `backend:3000`. Se `3000` estiver ocupada, a API falha antes de abrir
conexões ou aplicar migrations, informa a porta e sugere `lsof -nP -iTCP:3000 -sTCP:LISTEN`.
Defina `PORT` no `backend/.env` e `VITE_PROXY_TARGET` no `frontend/.env` para usar outra porta.

## 7. Variáveis de ambiente

| Variável | Padrão / exemplo | Uso |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` ou `production` |
| `PORT` | `3000` | Porta da API |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` | Conexão do backend local |
| `DB_NAME` | `teste_receitas_rg_sistemas` | Schema da aplicação |
| `DB_USER` / `DB_PASSWORD` | `receitas` / `receitas_dev` | Credenciais da aplicação |
| `MYSQL_ROOT_PASSWORD` | `root` | Senha root do container |
| `MYSQL_HOST_PORT` | `3306` | Porta publicada do MySQL, vinculada a `127.0.0.1` |
| `BACKEND_HOST_PORT` | `3001` | Porta publicada da API no Docker, vinculada a `127.0.0.1` |
| `FRONTEND_HOST_PORT` | `8080` | Porta publicada do Nginx no Docker |
| `JWT_SECRET` | gerado com `openssl rand -hex 32` | Obrigatório, mínimo de 32 caracteres; Compose `full` não usa fallback; também deriva o CSRF |
| `JWT_EXPIRES_IN_SECONDS` | `3600` | Validade do JWT e do cookie de sessão |
| `COOKIE_SECURE` | `false` | `true` obrigatório em produção/HTTPS; `false` só com origens loopback |
| `COOKIE_SAME_SITE` | `lax` | `lax` ou `strict` para ambos os cookies |
| `TRUST_PROXY` | `false` | Confia no proxy imediato para obter o IP real; Compose usa `true` |
| `TRUST_PROXY_HOPS` | `1` | Número de saltos confiáveis (1–10) |
| `LOGIN_RATE_LIMIT_LIMIT` | `5` | Tentativas de login por janela, por IP e por login |
| `LOGIN_RATE_LIMIT_TTL_MS` | `60000` | Janela de login em milissegundos |
| `REGISTER_RATE_LIMIT_LIMIT` | `3` | Cadastros por janela, por IP e por login |
| `REGISTER_RATE_LIMIT_TTL_MS` | `3600000` | Janela de cadastro em milissegundos |
| `CORS_ORIGIN` | `http://localhost:3000,http://localhost:5173,http://localhost:8080` | Origens explícitas; inclui o Swagger na API e `*` é recusado com cookies |
| `DB_LOGGING` | `false` | Loga SQL quando `true` |
| `DB_SSL` | `false` | `true` ativa TLS verificada (certificado **e** hostname); `false` preserva o MySQL local sem TLS |
| `DB_SSL_CA` | vazio | PEM inline da CA no Vercel; um dos dois (`DB_SSL_CA` ou `DB_SSL_CA_PATH`) é obrigatório com TLS |
| `DB_SSL_CA_PATH` | vazio | Caminho do PEM da CA fora do Vercel; obrigatório se `DB_SSL_CA` não for usado |
| `DB_POOL_MAX` / `DB_POOL_MIN` | `10` / `0` | Tamanho do pool do Sequelize; use `1` no Vercel |
| `DB_POOL_ACQUIRE_MS` / `DB_POOL_IDLE_MS` | `30000` / `10000` | Tempos de espera e ociosidade do pool |
| `DB_MIGRATIONS_AUTO` | não definido | `false` desativa a automação local |
| `DB_ALLOW_REMOTE` | `false` | Autoriza escrita em host remoto (ainda exige `DB_ALLOWED_HOST`) |
| `DB_ALLOWED_HOST` | vazio | Host remoto nominalmente autorizado; obrigatório se `DB_ALLOW_REMOTE=true` |
| `DB_ALLOW_PRODUCTION_MIGRATIONS` | `false` | Autoriza `db:migrate`/`db:seed` em produção |
| `TEST_DB_ALLOW_REMOTE` | `false` | Autoriza suítes de teste contra host remoto (ainda exige `TEST_DB_ALLOWED_HOST`) |
| `TEST_DB_ALLOWED_HOST` | vazio | Host remoto permitido pelas suítes; obrigatório se `TEST_DB_ALLOW_REMOTE=true` |

Mantenha `DB_PORT` igual a `MYSQL_HOST_PORT` quando o MySQL estiver no Docker.

No Compose, MySQL (`3306`) e API (`3001`) são publicados somente em `127.0.0.1`;
o frontend/Nginx usa `8080`. A API ainda usa `TRUST_PROXY=true` com
`TRUST_PROXY_HOPS=1` porque o Nginx é o proxy imediato; a porta direta existe
apenas para depuração local e não é alcançável pela rede. Assim, um cliente
remoto não consegue forjar `X-Forwarded-For` para burlar o rate limiting pela
porta direta da API. O frontend/Nginx continua acessando `backend:3000` na rede
interna, sem publicação adicional.

`DB_SSL=true` exige `DB_SSL_CA` (PEM inline) ou `DB_SSL_CA_PATH` (arquivo PEM) e `DB_HOST` como
hostname DNS — um IP é recusado porque não permite validar o certificado. As mesmas opções são
usadas pelo Sequelize, pelo comando `db:check`, pela CLI e pela conexão `mysql2` dedicada ao
`GET_LOCK`. Nunca é emitido
`rejectUnauthorized: false`; no `mysql2` também é ativado `verifyIdentity: true` e TLS mínimo 1.2.
Nenhuma senha é gravada em código ou documentação: forneça `DB_PASSWORD` somente no ambiente.

## 8. MySQL com Docker Compose

```bash
cd backend
docker compose up -d
```

Isso sobe **somente** o serviço `mysql`, com healthcheck e volume persistente.

```bash
docker compose ps
docker compose logs -f mysql
docker compose down        # para e preserva o volume
```

Stack completa (MySQL + one-shot `migrate` + API + frontend/Nginx). Se `JWT_SECRET` ainda não
estiver em `backend/.env`, gere um valor único antes de subir a stack:

```bash
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
docker compose --profile full up -d --build
docker compose --profile full down
```

O profile `full` roda a API com `NODE_ENV=production` e **não** possui fallback para `JWT_SECRET`:
se o segredo estiver ausente, vazio ou com um valor de exemplo conhecido, a validação falha e o
container não sobe. O comando padrão (somente MySQL) não exige esse segredo. Defina o valor no
`backend/.env` (ou no ambiente) antes do comando acima; não versionar `.env`.

O serviço `migrate` aplica migrations/seeders uma única vez e a API só inicia após sua conclusão;
assim o bootstrap de produção permanece sem escrita automática de schema. As portas de host são
configuráveis (`3306`, `3001` e `8080` por padrão); as internas permanecem `3306`, `3000` e `80`.

No profile `full`, a API roda com `COOKIE_SECURE=true`, `TRUST_PROXY=true` e
`TRUST_PROXY_HOPS=1`: o Nginx encaminha `/api` sem alterar o host, define `X-Forwarded-For` e o
navegador recebe cookies sem `Domain`, vinculados ao host do frontend. Para HTTPS atrás de outro
proxy, ajuste `CORS_ORIGIN` com a origem pública exata e mantenha `COOKIE_SECURE=true`. O limite de
saltos deve refletir apenas proxies sob seu controle.

## 9. Sequelize, migrations e seeders

Arquivos executáveis:

- `src/database/migrations/001-create-usuarios.ts`
- `src/database/migrations/002-create-categorias.ts`
- `src/database/migrations/003-create-receitas.ts`
- `src/database/migrations/004-create-auth-sessions.ts` (técnica; índice único em `token_identifier_hash`)
- `src/database/seeders/001-categorias.ts`

O Umzug registra o estado em `SequelizeMeta` e `SequelizeData`. Antes de delegar ao Umzug,
`runMigrations()` compara o schema físico com a definição declarada em `schema-expectations.ts`:

- tabela equivalente e ausente do histórico: é registrada como baseline, sem recriar índices ou FKs;
- índice/FK ausente: é criado depois de validar duplicatas e registros órfãos, sem excluir dados;
- divergência em tipo, nulabilidade, collation, colunas, regras de FK ou objeto duplicado: a
  operação falha com diagnóstico específico e não grava histórico parcial.

As próprias migrations também chamam essa verificação: uma tabela já válida nunca é recriada.
`db:baseline` valida, repara apenas lacunas não destrutivas e registra o que já existe, sem criar
tabelas. Exige confirmação explícita: `npm run db:baseline -- --yes`.
`004-create-auth-sessions` pode continuar pendente em
um banco legado até `db:migrate` ser executado; `db:seed` bloqueia enquanto houver qualquer
migration pendente.

O seeder insere somente IDs ausentes das 13 categorias originais. IDs ou nomes originais
divergentes são informados como conflito e interrompem a carga, sem sobrescrever nada. O rollback
do seeder é **não destrutivo**: não emite `DELETE`, pois a tabela original não tem colunas de
auditoria que provem a origem de uma categoria e a FK de `receitas` usa `ON DELETE CASCADE`.
Assim nenhuma categoria preexistente é removida e nenhuma receita é apagada por cascata. A remoção
completa do schema continua disponível apenas em `db:down`/`db:reset`, com confirmação explícita,
por meio das migrations.

Comandos:

```bash
npm run db:migrate                 # reconcilia, aplica migrations e seeders pendentes
npm run db:seed                    # exige migrations em dia e schema completo
npm run db:status                  # relatório somente leitura
npm run db:baseline -- --yes       # valida e registra tabelas equivalentes já existentes
npm run db:setup:prod -- --yes     # provisionamento inicial de produção (idempotente)
npm run db:down -- --yes           # reversão local (destrutivo)
npm run db:reset -- --yes          # recria o schema local (destrutivo)
```

`db:status` não escreve: mostra schema, host/porta sem credenciais, migrations e seeders
aplicados/pendentes, estado físico de cada tabela, inconsistências entre estrutura e histórico e
orientação de baseline/reparo. No perfil `full` do Compose, o serviço `migrate` executa o mesmo
caminho de forma autorizada e idempotente antes de iniciar a API. `db:down` e `db:reset` exigem
`--yes`, host local e schema conhecido do projeto. Nunca funcionam em produção.

### 9.1. TiDB Cloud Starter (compatível com MySQL)

Configure somente por variáveis de ambiente, por exemplo na seção `[Service]` do Render/Railway ou
exportando no shell; nunca commite o `.env`:

```bash
export DB_HOST='gateway01.sa-east-1.prod.aws.tidbcloud.com'
export DB_PORT=4000
export DB_USER='<usuario>.root'
export DB_NAME='teste_receitas_rg_sistemas'
export DB_SSL=true
export DB_SSL_CA_PATH='/etc/ssl/cert.pem'
export DB_PASSWORD='<fornecida pelo ambiente>'
```

Teste a conexão antes de qualquer escrita:

```bash
npm run db:check
```

`db:check` é somente leitura: executa apenas `SELECT 1`, `VERSION()`, `DATABASE()` e
`SHOW SESSION STATUS LIKE 'Ssl_cipher'`. Não roda migrations, seeders, DDL ou DML, não exige
`DB_ALLOW_REMOTE`, omite credenciais na saída e falha se `DB_SSL=true` mas a sessão não negociou TLS.
Use `db:status` para o relatório estrutural completo.

O schema precisa existir antes de `db:status`/`db:migrate` (o TiDB Cloud não cria databases
automaticamente). Use `npm run db:setup:prod -- --yes` para criá-lo e prepará-lo de uma vez; a
aplicação em runtime nunca cria schema. Veja a [seção 18](#18-produção-vercel--tidb-cloud).

**Nenhuma migration é aplicada automaticamente em host remoto**, mesmo com
`DB_MIGRATIONS_AUTO=true` e `DB_ALLOW_REMOTE=true`. Para o TiDB Cloud, execute explicitamente, com
autorização e após o `db:check`:

```bash
DB_ALLOW_REMOTE=true DB_ALLOWED_HOST='gateway01.sa-east-1.prod.aws.tidbcloud.com' npm run db:migrate
DB_ALLOW_REMOTE=true DB_ALLOWED_HOST='gateway01.sa-east-1.prod.aws.tidbcloud.com' npm run db:seed
```

Compatibilidade verificada com TiDB 8.5: `utf8mb4_0900_ai_ci` (padrão e explícito), InnoDB,
`GET_LOCK`/`RELEASE_LOCK`, índices únicos e FKs com `ON DELETE/UPDATE CASCADE`. As quatro migrations
e o seeder das 13 categorias aplicam sem inconsistências. A `004-create-auth-sessions` declara a FK
com nome explícito **após** a criação do índice de `user_id`: o TiDB nomeia FKs inline como `fk_1` e
cria um índice extra, enquanto o MySQL usa `auth_sessions_ibfk_1`. O schema final produzido é
idêntico nos dois bancos; nenhuma tabela ou coluna original foi alterada para contornar a diferença.

## 10. Inicialização do backend

```bash
cd backend
npm ci
cp .env.example .env
docker compose up -d
npm run dev
```

`npm run start:dev` continua disponível; `npm run dev` é apenas o alias. A API escuta em
`http://localhost:3000`. A checagem de porta ocorre antes de qualquer conexão com o banco. Em
desenvolvimento, migrations/seeders pendentes são aplicadas no bootstrap. Se o host for remoto ou
`NODE_ENV=production`, o bootstrap registra um aviso e não altera o banco; execute
`npm run db:migrate` de forma explícita.

Build compilado:

```bash
npm run build
npm run start:prod
```

## 11. Endpoints e Swagger

| Recurso | URL |
| --- | --- |
| API | <http://localhost:3000/api> |
| Swagger UI | <http://localhost:3000/api/docs> |
| OpenAPI JSON | <http://localhost:3000/api/docs-json> |
| Healthcheck | <http://localhost:3000/api/health> |

Na stack Docker completa, o Nginx também encaminha `/api` e `/api/docs` para a API.

### Auth

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/auth/csrf` | Emite cookie CSRF e devolve o valor para `X-CSRF-Token` (200) |
| `POST` | `/auth/register` | Cria conta, define cookies e devolve usuário + CSRF (201) |
| `POST` | `/auth/login` | Autentica, define cookies e devolve usuário + CSRF (200) |
| `GET` | `/auth/me` | Usuário da sessão e CSRF vigente, sem senha |
| `POST` | `/auth/logout` | Revoga a sessão no banco e remove os cookies (200) |

Nenhuma resposta contém `accessToken`, `tokenType` ou Bearer. Login e cadastro podem devolver 429
com a mensagem `Muitas tentativas. Aguarde um momento e tente novamente.`; as demais rotas
autenticadas podem devolver 401 quando a sessão foi revogada, expirou ou foi adulterada.

### Categorias, saúde e receitas

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/categories` | 13 categorias em ordem alfabética |
| `GET` | `/health` | Verificação de MySQL (público) |
| `GET` | `/recipes` | Lista paginada do usuário |
| `GET` | `/recipes/stats` | Totais do caderno |
| `GET` | `/recipes/:id` | Detalhe do usuário |
| `POST` | `/recipes` | Cria receita (201) |
| `PATCH` | `/recipes/:id` | Atualiza campos enviados |
| `DELETE` | `/recipes/:id` | Exclui receita (204) |

Parâmetros de `/recipes`: `page` (≥1), `limit` (1–50), `search` (até 100), `categoryId` (≥1),
`sortBy` (`name`, `createdAt`, `updatedAt`) e `order` (`asc`, `desc`).

Erros usam um envelope único com `statusCode`, `error`, `message`, `errors`, `path` e `timestamp`.

## 12. Autenticação e autorização

- Login é normalizado para minúsculas; senha mínima de 8 caracteres com confirmação.
- Senha gravada somente como hash bcrypt; o hash nunca é retornado.
- O servidor assina o JWT com `JWT_SECRET` e o grava apenas no cookie `rg_auth` (`HttpOnly`,
  `Path=/api`, sem `Domain`, `SameSite` configurável e `Secure` em produção). Expiração do JWT e do
  cookie são iguais.
- Rotas públicas: `health`, `auth/csrf`, `auth/register` e `auth/login`. Mesmo nessas rotas,
  requisições que modificam dados exigem origem permitida e CSRF.
- O cliente lê o CSRF no JSON (`csrfToken`) e envia `X-CSRF-Token`; o cookie `rg_csrf` também é
  `HttpOnly`. Depois do login, o token passa a ser HMAC do `jti` da sessão.
- Cada JWT possui `jti`. A tabela `auth_sessions` guarda apenas `SHA-256(jti)`, `user_id`, datas e
  `revoked_at`, com índice único e índices para consulta/limpeza. Nenhum token é gravado ou logado.
- Guard global valida assinatura, expiração, sessão persistida, revogação e existência do usuário em
  **toda** requisição autenticada. Tokens legados sem `jti` ou sem sessão são rejeitados com 401.
- Logout marca somente a sessão atual como revogada: ela retorna 401 mesmo antes de expirar e após
  reinício da API; outras sessões do mesmo usuário continuam válidas.
- Sessões expiradas são removidas oportunisticamente no login/cadastro, no máximo uma vez por hora.
- O dono da receita vem da sessão validada; `userId` enviado no corpo é rejeitado (`400`).
- Login/cadastro são limitados por IP (`req.ip`, sem confiar em cabeçalho do cliente quando
  `TRUST_PROXY=false`) e por login normalizado; excesso retorna 429 em português.

## 13. Testes

```bash
npm test                 # unitários (sem banco)
npm run test:integration # integração com MySQL real
npm run test:e2e         # E2E da API com MySQL real
npm run test:all         # sequência completa
```

A suíte de integração recria `teste_receitas_rg_sistemas_test` e a E2E usa
`teste_receitas_rg_sistemas_e2e`. Antes de qualquer `DROP`, o `globalSetup` valida `NODE_ENV=test`,
sufixo `_test`/`_e2e`, host local (ou remoto autorizado) e nome de schema. Configurações perigosas são
rejeitadas por testes automatizados sem tocar em nenhum banco real.

Use um MySQL descartável em `tmpfs`, separado da porta `3306` do desenvolvimento:

```bash
docker run -d --name receitas_tests_mysql --rm --tmpfs /var/lib/mysql \
  -e MYSQL_ROOT_PASSWORD=root -p 3310:3306 mysql:8.4

DB_HOST=127.0.0.1 DB_PORT=3310 DB_USER=root DB_PASSWORD=root npm run test:integration
DB_HOST=127.0.0.1 DB_PORT=3310 DB_USER=root DB_PASSWORD=root npm run test:e2e

docker rm -f receitas_tests_mysql
```

O volume de desenvolvimento é nomeado pelo Compose como `<projeto>_mysql_data` (por padrão,
`receitas-rg-sistemas_mysql_data`) e não é utilizado pelos testes. Não há `container_name` nem nome
fixo de volume: o `-p <projeto>` substitui o nome padrão e isola containers, rede e volume mesmo ao
validar cópias paralelas. As suítes
de integração e API E2E continuam com nomes `_test`/`_e2e` e validação própria; o Playwright usa
`_playwright`, conforme `../frontend/README.md`.

Cobertura relevante: autenticação, DTOs, serviços de receita, constraints e collation via
`information_schema`, 13 categorias, isolamento entre usuários A/B, rollback não destrutivo do
seeder com receitas e categoria preexistente presentes, barreiras de comandos destrutivos, Swagger
(cookie + CSRF, sem Bearer), CORS com credenciais, Helmet, cookies `HttpOnly`/`Path`, CSRF e Origem,
sessão persistida com hash, revogação isolada e após reinício da API, token expirado/adulterado/legado
e limite 429 com recuperação após a janela.

## 14. Lint, Prettier e build

```bash
npm run lint          # ESLint com --fix
npm run lint:check    # ESLint sem alterar arquivos
npm run format        # Prettier --write
npm run format:check  # Prettier --check
npm run build         # nest build → dist/
```

## 15. Segurança do banco e comandos destrutivos

| Situação | Comportamento |
| --- | --- |
| Bootstrap em produção | Nenhuma migration/seeder automático |
| Bootstrap em qualquer host remoto (inclui TiDB Cloud) | Nenhuma migration/seeder automático, mesmo com todos os opt-ins |
| `npm run db:check` | Somente `SELECT`/`SHOW STATUS`; nunca escreve, mesmo em host remoto |
| Bootstrap com schema desconhecido | Nenhuma migration/seeder automático |
| `DB_ALLOW_REMOTE=true` sem `DB_ALLOWED_HOST` conferindo | Escrita remota recusada |
| `npm run db:migrate` em produção sem `DB_ALLOW_PRODUCTION_MIGRATIONS=true` | Recusado |
| `db:setup:prod` sem `--yes`, com outro host/schema ou sem TLS | Recusado antes de conectar |
| `db:setup:prod` repetido | Preserva dados; aplica só pendências e valida 4/1/13 |
| `db:baseline` sem `--yes` | Recusado |
| `db:down` / `db:reset` sem `--yes` | Recusado |
| `db:down` / `db:reset` em produção ou host remoto | Recusado sem exceção |
| Schema de teste fora do prefixo do projeto ou sem sufixo `_test`/`_e2e` | `globalSetup` falha antes do `DROP` |
| Duas instâncias aplicando migrations | Lock `GET_LOCK` serializa o acesso |

Mensagens de recusa são explícitas e indicam qual variável ou argumento falta. Nenhuma operação
destrutiva altera o banco antes dessas verificações.

## 16. Problemas comuns

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| `Please install mysql2 package manually` no Vercel | Driver dinâmico ausente do bundle serverless | Confirme `mysql2` em `dependencies` e `dialectModule: mysql2` em `src/database/sequelize-options.ts`; gere novo deploy |
| `EADDRINUSE` na 3000 | Outro processo já escuta na porta local | A API aborta antes do bootstrap; use `lsof -nP -iTCP:3000 -sTCP:LISTEN`, encerre manualmente ou defina `PORT` e ajuste `VITE_PROXY_TARGET`. O container publica `3001` por padrão |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL não iniciou | `docker compose up -d` e aguarde o healthcheck |
| `Access denied for user` | Credenciais divergentes | Confira `DB_USER`/`DB_PASSWORD` |
| `DB_SSL=true exige DB_SSL_CA_PATH...` | TLS ativo sem CA informada | Informe o PEM da autoridade em `DB_SSL_CA_PATH` |
| `DB_SSL=true exige DB_HOST como hostname DNS` | IP usado como host | Use o gateway DNS do TiDB Cloud para validar o certificado |
| `Falha ao ler DB_SSL_CA_PATH` / `CA inválida` | Arquivo ausente ou PEM corrompido | Confira o caminho e o conteúdo do certificado |
| `a sessão não negociou TLS` | Gateway/porta ou CA incorretos | Rode `npm run db:check`; confira `DB_PORT=4000` e `DB_SSL_CA_PATH` |
| `Unknown database` | Schema ainda não existe | Suba o MySQL e rode `npm run db:migrate` |
| `Duplicate key name 'login_UNIQUE'` ou `Table already exists` | Tabela criada pelo SQL original sem registro no `SequelizeMeta` | `npm run db:status`; a reconciliação compara a estrutura antes de registrar. Não use `db:reset` em dados existentes |
| `divergência não reparável` | Índice/FK/coluna com definição diferente da migration | Corrija manualmente e repita `npm run db:status`; nada foi gravado no histórico |
| `db:seed` recusado por migrations pendentes | Schema incompleto ou tabela técnica ainda não aplicada | `npm run db:migrate` e depois `npm run db:seed` |
| Porta 3306 ocupada | Outro MySQL no host | Ajuste juntos `MYSQL_HOST_PORT` e `DB_PORT` |
| CORS bloqueado | Origem não listada | Ajuste `CORS_ORIGIN` e reinicie |
| `403 Requisição inválida` ao criar/editar | CSRF ausente ou desatualizado | Recarregue a página para obter um novo `X-CSRF-Token` |
| Login cai em 401 após reutilizar token antigo | Token legado sem sessão persistida | Entre novamente; tokens antigos não são aceitos |
| `429 Muitas tentativas` | Limite por IP/login atingido | Aguarde a janela configurada |
| Cookie não é enviado | `COOKIE_SECURE=true` sobre HTTP não-loopback | Use HTTPS ou ajuste apenas em desenvolvimento local |
| Testes falham por permissão | Usuário sem poder criar schema | Use um MySQL descartável com usuário administrador |
| Mensagem de lock de migrations | Outra instância aplicando mudanças | Aguarde e repita `npm run db:migrate` |

## 17. Limitações conhecidas

- **Rate limiting em memória:** o store do `@nestjs/throttler` é local a cada processo. Com várias
  instâncias atrás de um balanceador, os contadores não são compartilhados; use um store distribuído
  (por exemplo, Redis) se isso for necessário. Nenhum serviço novo foi adicionado nesta versão.
- **Sem rotação de refresh token:** a sessão expira junto com o JWT; não há renovação silenciosa.
- **CSRF depende de origem/cookie:** clientes que não sejam navegadores precisam buscar
  `/api/auth/csrf` e enviar `X-CSRF-Token`; chamadas diretas via Swagger devem informar o header.
- **Categorias fixas:** não há CRUD de categorias.
- **Sem upload de imagens** nem recuperação de senha.
- **Migrations em produção** devem ser executadas como etapa explícita de deploy, nunca pelo
  bootstrap; em ambientes com réplicas, o `GET_LOCK` no MySQL serializa as instâncias que compartilham
  o banco, mas não substitui um job de deploy coordenado.
- **Tabelas de controle** `SequelizeMeta`/`SequelizeData` são metadados; as tabelas de negócio
  permanecem equivalentes ao schema original.

## 18. Produção: Vercel + TiDB Cloud

**Ambiente publicado:**

| Componente | Endereço / configuração |
| --- | --- |
| API NestJS | [rg-receitas-culinarias.vercel.app](https://rg-receitas-culinarias.vercel.app) |
| Healthcheck | [GET /api/health](https://rg-receitas-culinarias.vercel.app/api/health) |
| Swagger | [Documentação interativa](https://rg-receitas-culinarias.vercel.app/api/docs) |
| Frontend | [Meu Caderno de Receitas](https://rg-receitas-culinarias-oai3.vercel.app/login) |
| Banco | TiDB Cloud Starter, schema `teste_receitas_rg_sistemas` |

O backend é publicado em um projeto Vercel com **Root Directory = `backend/`** e
framework NestJS. O entrypoint é `src/main.ts`. Em Functions (`VERCEL=1`),
o bootstrap não chama `app.listen()`, não verifica a porta local e **não executa
migrations/seeders**. A aplicação reutiliza o mesmo pipeline HTTP dos testes e
do desenvolvimento.

### 18.1. Variáveis de ambiente da API

Configure no projeto **Vercel → Settings → Environment Variables → Production**.
Não envie um arquivo `.env` com credenciais para o GitHub.

| Variável | Valor / orientação |
| --- | --- |
| `NODE_ENV` | `production` |
| `DB_HOST` | `gateway01.sa-east-1.prod.aws.tidbcloud.com` |
| `DB_PORT` | `4000` |
| `DB_NAME` | `teste_receitas_rg_sistemas` |
| `DB_USER` | usuário fornecido pelo TiDB Cloud |
| `DB_PASSWORD` | senha privada, configurada somente no ambiente |
| `DB_SSL` | `true` |
| `DB_SSL_CA` | PEM completo da CA confiável (ISRG Root X1), com quebras de linha |
| `DB_POOL_MAX` / `DB_POOL_MIN` | `1` / `0` |
| `DB_MIGRATIONS_AUTO` | `false` |
| `DB_ALLOW_REMOTE` | `false` no runtime (autorizações de migração são separadas) |
| `DB_ALLOW_PRODUCTION_MIGRATIONS` | `false` no runtime |
| `JWT_SECRET` | segredo novo de no mínimo 32 caracteres; gere com `openssl rand -hex 32` |
| `JWT_EXPIRES_IN_SECONDS` | `3600` |
| `COOKIE_SECURE` / `COOKIE_SAME_SITE` | `true` / `lax` |
| `CORS_ORIGIN` | `https://rg-receitas-culinarias-oai3.vercel.app` |
| `TRUST_PROXY` / `TRUST_PROXY_HOPS` | `true` / `1` |

As variáveis de rate limiting (`LOGIN_RATE_LIMIT_*`, `REGISTER_RATE_LIMIT_*`)
continuam configuráveis. `DB_SSL_CA_PATH=/etc/ssl/cert.pem` é usado apenas
quando existe esse arquivo no host local; no Vercel, use o PEM inline em
`DB_SSL_CA`. A conexão verifica a cadeia e o hostname do certificado;
não desative `rejectUnauthorized`.

O pacote `mysql2` é dependência de produção. Em
`src/database/sequelize-options.ts`, o driver é informado explicitamente
ao Sequelize com `dialectModule: mysql2` para compatibilidade com o bundle
serverless da Vercel.

### 18.2. Schema, migrations e seeders

O provisionamento inicial **já foi concluído** no TiDB Cloud e validado:

| Verificação | Resultado |
| --- | --- |
| Migrations aplicadas | 4 |
| Migrations pendentes | 0 |
| Seeders aplicados | 1 |
| Seeders pendentes | 0 |
| Categorias | 13 |
| Inconsistências | 0 |

O schema é `teste_receitas_rg_sistemas` (não o schema de sistema `sys`).
Sua criação utiliza `utf8mb4` e collation `utf8mb4_0900_ai_ci`.

Para **um ambiente de produção ainda não provisionado**, após configurar
as credenciais, `NODE_ENV=production`, TLS verificado e o nome do schema,
execute explicitamente no diretório `backend/`:

```bash
DB_ALLOW_REMOTE=true \
DB_ALLOWED_HOST=gateway01.sa-east-1.prod.aws.tidbcloud.com \
DB_ALLOW_PRODUCTION_MIGRATIONS=true \
npm run db:setup:prod -- --yes
```

Esse comando é idempotente, cria o schema apenas se ausente, executa
pendências via Umzug e verifica o resultado. Ele não executa
`db:down` nem `db:reset`. Para conferir um banco já preparado sem alterar
dados, use:

```bash
npm run db:check
npm run db:status
```

Qualquer nova migration deve ser aplicada **explicitamente**, com as
autorizações necessárias e antes do deploy da API correspondente.
Nunca execute as suítes de teste de banco contra o schema de produção.

### 18.3. Publicação dos projetos Vercel

O projeto do backend e o projeto do frontend foram importados do mesmo
repositório GitHub, cada um com seu próprio diretório raiz. As publicações
atuais usam a **integração GitHub–Vercel** (branch `main`), e as variáveis
de ambiente ficam nos respectivos projetos Vercel.

O frontend faz requisições relativas para `/api`; `frontend/vercel.json`
encaminha esse caminho para `https://rg-receitas-culinarias.vercel.app`.
O proxy mantém os cookies `HttpOnly` no host da SPA. A origem HTTPS do
frontend deve permanecer autorizada pelo backend em `CORS_ORIGIN`.

### 18.4. Workflow manual legado

O arquivo `.github/workflows/production.yml` oferece operações
`provision-database`, `migrate-database`, `deploy-backend`,
`deploy-frontend` e `deploy-all`, com confirmação explícita.

O workflow utiliza os rewrites já definidos em `frontend/vercel.json`, sem
substituir placeholders no runner. Para executar `deploy-frontend` ou
`deploy-all`, configure previamente `VERCEL_TOKEN`, `VERCEL_ORG_ID` e os
IDs dos projetos da Vercel como secrets do GitHub Actions. A publicação
atual utiliza a integração direta GitHub–Vercel.

As operações de banco exigem segredos próprios no GitHub Actions, host
autorizado e permissões explícitas. Nenhuma publicação comum da API ou SPA
deve executar provisionamento automaticamente.

## 19. Auditoria de dependências

`npm audit` e `npm audit --omit=dev` terminam com **0 vulnerabilidades** no backend. O frontend
também está em 0 nos dois modos. Nenhuma auditoria foi desativada e `npm audit fix --force` não foi
usado.

Os findings anteriores eram `uuid@8.3.2` (GHSA-w5hq-g745-h8pq / CVE-2026-41907, via Sequelize) e
`glob@13.0.6`/`minimatch@10.2.6` (GHSA-3g3m-2fjr-6pw4 e GHSA-g3hv-75wg-m249, via `@nestjs/cli`).
Foram aplicados apenas overrides compatíveis: `uuid@11.1.1` mantém `require()` CommonJS e `glob@14.0.2`
preserva a API usada pelo CLI 11. Sequelize 6, NestJS 11 e a configuração de Node 22 permanecem
inalterados.

---

Desenvolvido para o desafio técnico **RG Receitas Culinárias**.
