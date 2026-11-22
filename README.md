# Meu Caderno de Receitas

Aplicação **Full Stack** desenvolvida para o desafio técnico **RG Receitas Culinárias**. Cada usuário tem seu próprio caderno digital para cadastrar, organizar, pesquisar, editar e imprimir receitas.

![Lista de receitas](frontend/screenshots/02-recipe-list.png)

## Aplicação online

| Serviço | Acesso |
| --- | --- |
| **Frontend (aplicação)** | [Abrir Meu Caderno de Receitas](https://rg-receitas-culinarias-oai3.vercel.app/login) |
| **Backend (API REST)** | [Healthcheck da API](https://rg-receitas-culinarias.vercel.app/api/health) |
| **Documentação da API** | [Swagger / OpenAPI](https://rg-receitas-culinarias.vercel.app/api/docs) |
| **Código-fonte** | [GitHub](https://github.com/filipe-fragallo/RG-Receitas-Culinarias) |

Para avaliar o sistema, abra a aplicação, crie uma conta e cadastre sua primeira receita. Não há conta ou senha de demonstração fixa no repositório.

## Funcionalidades

- Cadastro de usuário, login, restauração de sessão e logout.
- CRUD completo de receitas, com acesso restrito ao proprietário.
- Pesquisa por nome, filtros por categoria, ordenação e paginação.
- Estatísticas pessoais, detalhes de ingredientes e modo de preparo.
- Impressão em formato A4 e interface responsiva.
- Autenticação via cookie `HttpOnly`, proteção CSRF e revogação persistente de sessões.
- Validação de formulários, estados de carregamento e tratamento de erros.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Frontend | React, TypeScript, Vite, React Router e Tailwind CSS |
| Backend | Node.js, NestJS, TypeScript, Sequelize e `mysql2` |
| Banco | MySQL 8.4 (desenvolvimento), TiDB Cloud Starter (produção) |
| Persistência | Migrations e seeders com Umzug |
| Infraestrutura | Docker Compose (local), Vercel (frontend e backend) |
| Testes | Jest, Supertest, Vitest, Testing Library e Playwright |

## Arquitetura

O projeto é um **monorepositório** com aplicações independentes:

```text
RG-Receitas-Culinarias/
├── backend/             # API NestJS, models, migrations, seeders, Docker e testes
├── frontend/            # SPA React/Vite, estilos, testes e capturas de tela
├── .github/workflows/   # Workflow manual de produção
└── README.md            # Visão geral e links de execução
```

Em produção, o navegador acessa o frontend na Vercel. As requisições para `/api` são encaminhadas pelo `frontend/vercel.json` à API NestJS, hospedada em outro projeto Vercel, que utiliza o TiDB Cloud por conexão TLS verificada. O frontend mantém a API em um caminho relativo para preservar os cookies de sessão.

Documentação detalhada:

- [Backend — API, configuração, migrations, segurança e testes](backend/README.md)
- [Frontend — interface, execução, testes e impressão](frontend/README.md)

## Executar localmente

**Pré-requisitos:** Node.js 22+, npm 10+ e Docker com Compose v2.

Clone o repositório:

```bash
git clone https://github.com/filipe-fragallo/RG-Receitas-Culinarias.git
cd RG-Receitas-Culinarias
```

### 1. Backend e MySQL

No primeiro terminal:

```bash
cd backend
npm ci
cp .env.example .env
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
docker compose up -d
npm run db:migrate
npm run db:status
npm run dev
```

A API estará em `http://localhost:3000/api` e o Swagger em `http://localhost:3000/api/docs`. As migrations são controladas e o seed inicial contém **13 categorias**.

### 2. Frontend

Em outro terminal, a partir da raiz do repositório:

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

Acesse **http://localhost:5173**. O `frontend/.env` utiliza `VITE_API_URL=/api` e `VITE_PROXY_TARGET=http://localhost:3000` para desenvolvimento. Se mudar a porta do backend, atualize também `VITE_PROXY_TARGET`.

Também é possível subir a stack inteira com Docker Compose; consulte o [README do backend](backend/README.md#8-mysql-com-docker-compose).

## Testes e qualidade

Os projetos possuem comandos independentes:

| Verificação | Backend (em `backend/`) | Frontend (em `frontend/`) |
| --- | --- | --- |
| Testes unitários | `npm test` | `npm test` |
| Testes de integração/E2E | `npm run test:integration` / `npm run test:e2e` | `npm run test:e2e` |
| Lint | `npm run lint:check` | `npm run lint` |
| Build | `npm run build` | `npm run build` |

**Atenção:** testes que utilizam banco de dados devem rodar com uma instância MySQL **descartável**, seguindo os procedimentos e as verificações de segurança descritos nos READMEs de cada aplicação. Não execute testes de banco contra o TiDB de produção.

## Publicação em produção

- **Frontend:** Vercel, diretório raiz `frontend/`, framework Vite e `VITE_API_URL=/api`.
- **Backend:** Vercel, diretório raiz `backend/`, framework NestJS e variáveis de banco configuradas no painel.
- **Banco:** TiDB Cloud Starter, schema `teste_receitas_rg_sistemas`, com **4 migrations, 1 seeder, 13 categorias e 0 inconsistências** confirmados no provisionamento.
- **API/proxy:** `frontend/vercel.json` redireciona `/api` ao domínio real do backend.
- **Deploy:** integração dos projetos Vercel com a branch `main` do GitHub.

O runtime do backend **não executa migrations automaticamente**. Alterações futuras no banco exigem uma etapa explícita e autorizada, antes da publicação da versão que depende delas. O arquivo [`.github/workflows/production.yml`](.github/workflows/production.yml) contém um workflow manual; suas etapas de publicação do frontend ainda pressupõem o placeholder antigo do proxy e devem ser ajustadas antes de serem utilizadas. O deploy atual utiliza a integração GitHub–Vercel.

**Segredos:** `.env`, `DB_PASSWORD`, `JWT_SECRET` e certificados/configurações privadas pertencem apenas ao ambiente apropriado. Use os arquivos `.env.example` como referência, sem versionar credenciais.

---

Desenvolvido para o desafio técnico **RG Receitas Culinárias**.
