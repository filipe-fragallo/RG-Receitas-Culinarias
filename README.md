# Meu Caderno de Receitas

Aplicação Full Stack desenvolvida para o desafio técnico **RG Receitas Culinárias**. Um caderno digital em que cada usuário pode cadastrar, organizar, pesquisar e imprimir suas próprias receitas.

![Tela de listagem de receitas](frontend/screenshots/02-recipe-list.png)

## Funcionalidades

- Cadastro de usuários, login e logout.
- Criação, visualização, edição e exclusão de receitas.
- Pesquisa, filtros por categoria, ordenação e paginação.
- Receitas privadas, vinculadas ao usuário autenticado.
- Impressão de receitas em formato A4 e interface responsiva.
- Autenticação com cookies HttpOnly, proteção CSRF e revogação de sessões.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Frontend | React, TypeScript, Vite e Tailwind CSS |
| Backend | Node.js, NestJS, TypeScript e Sequelize |
| Banco de dados | MySQL 8.4 (local), TiDB Cloud Starter (produção), migrations e seeders com Umzug |
| Infraestrutura | Docker e Docker Compose (local), Vercel (produção) |
| Testes | Jest, Supertest, Vitest e Playwright |

## Estrutura do repositório

```text
.
├── backend/    # API REST, banco, migrations, Docker e testes
├── frontend/   # Interface React, testes e capturas de tela
├── .github/    # workflow manual de produção
└── README.md   # Apresentação do projeto
```

Os projetos possuem configurações e documentação próprias:

- **[Backend — instalação, banco e API](backend/README.md)**
- **[Frontend — instalação, interface e execução](frontend/README.md)**

## Como executar

**Pré-requisitos:** Node.js 22+, npm 10+ e Docker com Compose v2.

Clone o repositório:

```bash
git clone https://github.com/filipe-fragallo/RG-Receitas-Culinarias.git
cd RG-Receitas-Culinarias
```

Em seguida, siga as instruções do **[README do backend](backend/README.md)** para configurar o MySQL e iniciar a API. Depois, utilize o **[README do frontend](frontend/README.md)** para iniciar a interface.

Também é possível executar a aplicação completa com Docker Compose, conforme documentado no backend.

**Observação:** os arquivos `.env` contêm configurações locais e segredos; utilize os respectivos `.env.example` e não versione credenciais.

## Produção

A API e a SPA são projetos Vercel separados (Root Directory `backend/` e `frontend/`), usando TiDB
Cloud Starter em modo TLS verificado. O provisionamento inicial é manual e idempotente:

```bash
cd backend
npm run db:setup:prod -- --yes
```

O comando cria o schema apenas se ele não existir, aplica as migrations e o seeder pendentes e
confere 4 migrations, 1 seeder e 13 categorias. Ele nunca executa `db:down`/`db:reset` e exige host,
schema, TLS e confirmação explícitos. Em runtime, o backend não cria schema nem roda migrations.

O deploy é feito pelo workflow manual **Produção (manual)** em `.github/workflows/production.yml`,
com operações separadas para provisionar, migrar e publicar. Ele não dispara em `push` e exige
confirmação na execução. Consulte os READMEs de
[backend](backend/README.md#18-produção-vercel--tidb-cloud) e
[frontend](frontend/README.md#20-deploy-na-vercel) para a lista de secrets, variáveis e o placeholder
de rewrite que deve receber a URL real do backend após a criação do projeto.

---

Projeto desenvolvido para o desafio técnico **RG Receitas Culinárias**.