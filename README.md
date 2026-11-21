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
| Banco de dados | MySQL 8.4, migrations e seeders com Umzug |
| Infraestrutura | Docker e Docker Compose |
| Testes | Jest, Supertest, Vitest e Playwright |

## Estrutura do repositório

```text
.
├── backend/   # API REST, banco, migrations, Docker e testes
├── frontend/  # Interface React, testes e capturas de tela
└── README.md  # Apresentação do projeto
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

---

Projeto desenvolvido para o desafio técnico **RG Receitas Culinárias**.