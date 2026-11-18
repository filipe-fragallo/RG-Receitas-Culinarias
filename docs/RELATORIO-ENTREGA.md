# Relatório de entrega — Meu Caderno de Receitas

**Desafio:** RG Receitas Culinárias
**Aplicação:** Meu Caderno de Receitas
**Data da verificação:** 18/11/2026
**Ambiente:** macOS 15.7.8 (arm64), Docker Compose v2.31, Node 22, Chromium via Playwright

---

## 1. Resumo executivo

A entrega implementa o desafio de ponta a ponta: frontend React responsivo, API REST em
NestJS/TypeScript, MySQL 8.4 com o schema original preservado, autenticação JWT com bcrypt,
CRUD de receitas isolado por usuário, pesquisa/filtros/ordenação no banco, impressão A4,
Docker Compose com três serviços e suíte de testes unitários, de integração e E2E.

Todos os requisitos obrigatórios e diferenciais solicitados estão presentes e foram executados
neste ambiente. Os resultados de build, lint, testes e containers estão na seção 6.

### URLs para avaliação

| Serviço | URL |
| --- | --- |
| Aplicação (Docker) | <http://localhost:8080> |
| Aplicação (dev) | <http://localhost:5173> |
| API | <http://localhost:3000/api> |
| Swagger | <http://localhost:3000/api/docs> |
| OpenAPI JSON | <http://localhost:3000/api/docs-json> |
| Healthcheck | <http://localhost:3000/api/health> |

### Avaliação em 3 comandos

```bash
cp .env.example .env
docker compose up -d --build
open http://localhost:8080
```

---

## 2. Requisitos e evidências

| Requisito | Status | Onde / evidência |
| --- | --- | --- |
| React no frontend | ✅ | `frontend/` (React 18 + Vite + TypeScript) |
| Backend NestJS/TypeScript | ✅ | `backend/src/` |
| MySQL | ✅ | serviço `mysql` (`mysql:8.4`) |
| TypeORM | ✅ | `backend/src/app.module.ts` com `synchronize: false` |
| JWT | ✅ | `backend/src/auth/` + guard global |
| bcrypt | ✅ | `AuthService.hashPassword` / `bcryptjs` |
| Tailwind CSS | ✅ | `frontend/tailwind.config.ts` |
| Swagger | ✅ | `/api/docs` via `src/config/swagger.ts` |
| Docker Compose | ✅ | `docker-compose.yml` (MySQL + API + Nginx) |
| Schema original preservado | ✅ | `database/init/01-schema.sql`, `referencias/script.sql` |
| 13 categorias originais | ✅ | seed no SQL; teste de integração confirma 13 |
| Sem `synchronize: true` | ✅ | `synchronize: false` explícito |
| Sem tabelas/colunas extras | ✅ | apenas `usuarios`, `categorias`, `receitas` |
| Senhas sem texto puro | ✅ | hash bcrypt; coluna `select: false` |
| Hash nunca exposto | ✅ | `PublicUser`/DTOs e testes unitários |
| Cadastro | ✅ | `/api/auth/register` + tela `/cadastro` |
| Login | ✅ | `/api/auth/login` + tela `/login` |
| Logout | ✅ | `/api/auth/logout` + descarte do token no cliente |
| Rotas protegidas | ✅ | guard JWT global; `/` redireciona ao login sem sessão |
| CRUD só do dono | ✅ | filtro por `id_usuarios` em todas as operações |
| Pesquisa | ✅ | `search` com `LOCATE` no banco |
| Filtro por categoria | ✅ | `categoriaId` |
| Ordenação | ✅ | `sortBy`/`order` (nome, criação, atualização) |
| Detalhes da receita | ✅ | `/api/recipes/:id` + tela de detalhe |
| Confirmação de exclusão | ✅ | `ConfirmDialog` acessível |
| Impressão A4 | ✅ | `@media print` + `print-recipe` |
| Swagger em `/api/docs` | ✅ | UI e JSON disponíveis |
| Testes unitários | ✅ | 23 testes Jest |
| Testes de integração | ✅ | 14 testes Supertest + MySQL real |
| Isolamento Usuário A/B | ✅ | teste dedicado: GET/PATCH/DELETE de B → 404 |
| E2E Playwright | ✅ | fluxo completo em Chromium |
| Loading / toasts / vazios | ✅ | skeletons, `ToastProvider`, `EmptyState` |
| Sessão expirada | ✅ | evento `session-expired` + limpeza do token |
| Responsivo | ✅ | layout mobile/desktop validado por captura |
| Acessibilidade básica | ✅ | skip link, foco visível, labels, `aria-*`, teclado |
| README | ✅ | `README.md` |
| Relatório final | ✅ | este documento |
| Arquivos recebidos preservados | ✅ | `referencias/` |
| Sem push/deploy | ✅ | apenas trabalho local |

---

## 3. Arquitetura

```text
Navegador
  │
  ├─ React/Vite (dev: 5173 | Docker: Nginx 8080)
  │    ├─ AuthProvider (token em localStorage, sessão expirada)
  │    ├─ ToastProvider
  │    ├─ React Router (rotas públicas e privadas)
  │    └─ fetch wrapper → /api
  │
  └─ NestJS (3000)
       ├─ Helmet + CORS configurável
       ├─ ValidationPipe (whitelist + forbidNonWhitelisted)
       ├─ JwtAuthGuard global (@Public para register/login/health)
       ├─ AllExceptionsFilter (envelope padronizado)
       ├─ Swagger /api/docs
       └─ TypeORM (synchronize: false)
            └─ MySQL 8.4 (3306)
```

### Camadas do backend

- **Auth:** cadastro, login, `/me`, logout, hash bcrypt, emissão de JWT.
- **Users:** consulta por login/id, projeção pública sem senha.
- **Categories:** listagem das 13 categorias em ordem alfabética.
- **Recipes:** CRUD, paginação, pesquisa, filtro, ordenação, estatísticas e escopo por dono.
- **Common:** guard JWT, decorators (`@Public`, `@CurrentUser`), filtro global, validação de DTOs.

### Frontend

- **Páginas:** login, cadastro, lista, formulário (criar/editar), detalhe, 404.
- **Componentes:** layout autenticado, cartões, filtros, estatísticas, modais, campos, skeletons.
- **Estado:** Context API para autenticação/toasts; URL como fonte de verdade dos filtros.
- **API:** `src/api/client.ts` (token, erros, sessão expirada) e `services.ts`.
- **UX:** validação de formulário, mensagens de erro por campo, estados de carregamento, confirmação
  de exclusão e layout de impressão.

---

## 4. Segurança e privacidade

1. **Senhas:** bcrypt com 10 rounds; comparação com hash; nenhum texto puro é gravado.
2. **Hash nunca retorna:** coluna `senha` tem `select: false`; DTOs públicos não incluem o campo.
3. **JWT:** segredo validado com mínimo de 32 caracteres; expiração padrão de 1 hora.
4. **Rotas privadas por padrão:** guard global `APP_GUARD`; somente rotas anotadas com `@Public`
   ficam abertas.
5. **Ownership:** as consultas incluem `id_usuarios`; receitas alheias retornam **404**.
6. **Criação não confia no cliente:** `idUsuarios` enviado no corpo é rejeitado pelo
   `forbidNonWhitelisted`; o dono vem do token.
7. **Validação de entrada:** `class-validator` com limites alinhados ao schema (45 caracteres no nome,
   5000 nos ingredientes, 10000 no modo de preparo etc.).
8. **Busca segura:** `LOCATE` em vez de concatenação em `LIKE`.
9. **CORS:** origens explícitas por ambiente.
10. **Helmet:** cabeçalhos de segurança habilitados; CSP desativada apenas por causa do Swagger UI.

### Limitação conhecida: logout JWT

O JWT é stateless. O endpoint de logout orienta o cliente a descartar o token, mas o token
tecnicamente continua válido até expirar. Uma revogação imediata exigiria refresh tokens ou
blacklist, deliberadamente fora do escopo do desafio. A limitação está documentada no Swagger e no
README.

---

## 5. Banco de dados

Schema original preservado em `database/init/01-schema.sql`:

- `usuarios` com `login` único e hash de senha.
- `categorias` com `nome` único.
- `receitas` com FKs `fk_receitas_1` e `fk_receitas_2`, índices e collation original.
- 13 categorias semeadas.
- Nenhuma tabela ou coluna adicional.
- `synchronize: false`.

Ajuste técnico documentado: o schema original usa `DATETIME NOT NULL` sem default. Como não é
permitido alterar o schema, o backend preenche `criado_em`/`alterado_em` via hooks
`@BeforeInsert`/`@BeforeUpdate`. Os testes de integração validam a gravação e a atualização das datas.

---

## 6. Resultados de testes e qualidade

Executados neste ambiente em 17 e 18/11/2026.

### 6.1 Backend — unitários

```text
PASS src/common/dto-validation.spec.ts
PASS src/recipes/recipes.service.spec.ts
PASS src/auth/auth.service.spec.ts

Test Suites: 3 passed, 3 total
Tests:       23 passed, 23 total
```

Cobertura funcional: bcrypt, normalização de login, conflito 409, credenciais inválidas, `/me`,
validação de DTOs, criação de receita, categoria inexistente, ownership, update, delete e corpo vazio.

### 6.2 Backend — integração com MySQL real

```text
PASS test/integration/recipes.integration.spec.ts

Tests: 14 passed, 14 total
```

Cenários:

- rota privada sem token → 401 padronizado;
- senha gravada apenas como hash bcrypt (verificado direto na tabela `usuarios`);
- cadastro duplicado (case-insensitive) → 409;
- validação de cadastro/senhas → 400;
- login válido e inválido;
- listagem das 13 categorias;
- criação com dono do token e rejeição de `idUsuarios` forjado;
- validação de campos e categoria inexistente;
- pesquisa, filtro e ordenação no banco;
- `%`, `_` e tentativa de injeção SQL na busca não retornam registros indevidos;
- identificador não numérico retorna 400 com mensagem em português;
- detalhe e edição da própria receita;
- **Usuário B recebe 404 em GET, PATCH e DELETE da receita do Usuário A**;
- exclusão e estatísticas zeradas;
- logout e token inválido.

O banco de teste (`teste_receitas_rg_sistemas_test`) é recriado pelo mesmo SQL do Docker em
`globalSetup`, preservando constraints e seed.

### 6.3 Frontend — E2E Playwright

```text
Running 1 test using 1 worker
✓ cadastro, login, CRUD, pesquisa, impressão e logout (3.7s)
1 passed
```

O mesmo teste foi executado contra o pacote Docker/Nginx:

```text
E2E_BASE_URL=http://localhost:8080
✓ cadastro, login, CRUD, pesquisa, impressão e logout
1 passed
```

Fluxo coberto: cadastro → login automático → criação → pesquisa com resultado → busca sem
resultado → limpar filtros → página fora do intervalo → detalhe → edição → acionamento de
`window.print()` → exclusão com confirmação → logout → acesso a rota privada redirecionando ao login.

### 6.4 Build, lint e formatação

| Comando | Resultado |
| --- | --- |
| `backend npm run build` | ✅ |
| `frontend npm run build` | ✅ |
| `backend npm run lint:check` | ✅ sem erros |
| `frontend npm run lint` | ✅ sem erros |
| `backend npm run format:check` | ✅ |
| `frontend npm run format:check` | ✅ |

### 6.5 Docker

```text
receitas_mysql      healthy
receitas_backend    healthy
receitas_frontend   healthy
```

Verificações HTTP:

```text
GET /api/health          → 200 {"status":"ok","database":"up"}
GET /api/docs            → 200 text/html
GET /api/docs-json       → 200 OpenAPI 3.0
GET /                    → 200 text/html
GET /receitas/nova       → 200 (fallback SPA)
GET /api/health (proxy)  → 200
```

---

## 7. Decisões técnicas e justificativas

| Decisão | Justificativa |
| --- | --- |
| React em vez de Vue | Orientação atual do desafio; UI refeita sem alterar schema/API. |
| SQL de init em vez de migrations | Preserva exatamente o schema original, sem risco de drift. |
| `synchronize: false` | Evita alterações automáticas no banco; exigência explícita. |
| Datas via hooks | Schema não tem defaults e não pode ser alterado. |
| Ownership no `WHERE` | Impede carregar dados alheios; 404 evita vazamento de existência. |
| JWT stateless | Simplicidade e aderência ao escopo; logout no cliente documentado. |
| `LOCATE` para busca | Sem injeção de curingas de `LIKE`. |
| camelCase na API | Contrato limpo para o frontend, colunas originais no banco. |
| Categoria obrigatória | Regra de negócio sem alterar a nulabilidade original. |
| Context API + fetch | Menos dependências, comportamento previsível. |
| Nginx com proxy `/api` | Evita CORS no pacote Docker e unifica a origem. |
| Fontes auto-hospedadas | Visual consistente sem depender de CDN. |

---

## 8. Estrutura entregue

```text
.
├── README.md
├── .env.example
├── docker-compose.yml
├── database/init/01-schema.sql
├── docs/
│   ├── RELATORIO-ENTREGA.md
│   └── screenshots/ (5 capturas reais)
├── referencias/ (script.sql, model.pdf, diagrama DER.mwb)
├── backend/ (NestJS, testes unitários e de integração)
└── frontend/ (React, Playwright, Dockerfile, nginx.conf)
```

---

## 9. Pendências e melhorias futuras

Não há pendências bloqueantes. Itens fora do escopo, conscientemente não implementados:

1. Revogação de JWT/refresh token.
2. Rate limiting em login/cadastro.
3. Recuperação de senha.
4. Upload de imagens das receitas.
5. CRUD de categorias.
6. Cookies `HttpOnly` + CSRF em vez de `localStorage`.
7. Testes de impressão visual com snapshot em múltiplos navegadores.

---

## 10. Roteiro de demonstração (5 minutos)

| Tempo | Ação |
| --- | --- |
| 0:00 | Abrir <http://localhost:8080> e apresentar login/identidade visual. |
| 0:30 | Criar conta; destacar validação, bcrypt e login automático. |
| 1:15 | Criar receita completa (categoria, tempo, porções, ingredientes, preparo). |
| 2:00 | Voltar à lista; pesquisar, filtrar e limpar filtros. |
| 2:45 | Abrir detalhe, editar e salvar. |
| 3:30 | Clicar em Imprimir e mostrar a prévia A4 sem menus. |
| 4:00 | Excluir com confirmação, sair e tentar abrir `/` (rota protegida). |
| 4:30 | Abrir Swagger `/api/docs`, autenticar e executar `GET /api/recipes`. |
| 5:00 | Mostrar rapidamente os testes: unitários, integração (A/B) e E2E. |

---

## 11. Revisão técnica final

Antes da entrega foi feita uma revisão adversarial com leitura completa do código, testes manuais de
segurança contra a API em execução, geração de PDFs de impressão, inspeção visual em desktop, tablet
e celular, e reinstalação total do Docker (`down -v` + `up --build`).

### Correções aplicadas

| Severidade | Problema encontrado | Correção |
| --- | --- | --- |
| Importante | O skip link "Pular para o conteúdo" aparecia no PDF impresso, sobre a lista de ingredientes. | Aplicada a classe `no-print` ao link no `AppShell`. Validado em PDF real de 1 e 4 páginas. |
| Importante | Uma URL com página fora do intervalo (ex.: `?pagina=99`) exibia "Seu caderno está em branco" mesmo havendo receitas. | Efeito de página em `RecipesPage` redireciona para a última página válida; coberto no E2E. |
| Importante | No tablet (768 px), a data de "Última atualização" era truncada com reticências. | Removido `truncate`; o valor quebra linha com `leading-tight` e fonte responsiva. |
| Importante | `MYSQL_DATABASE` era configurável no Compose, mas o SQL de init e o `DB_NAME` usam o nome fixo do desafio; alterar a variável apontaria o backend para um banco vazio. | Nome do banco fixado em `teste_receitas_rg_sistemas` no Compose e removido do `.env.example`, com comentário explicativo. |
| Opcional | O Swagger dizia que `idUsuarios` era "ignorado", mas a API o rejeita com 400. | Descrição corrigida para refletir o comportamento real. |
| Opcional | ID não numérico retornava mensagem em inglês do `ParseIntPipe`. | Pipe customizado com "Identificador da receita inválido.", coberto por teste de integração. |

### Verificações destrutivas e de comportamento

- Instalação limpa: volume removido, `docker compose up -d --build` recriou 3 tabelas, 13 categorias
  e nenhum usuário.
- Persistência: `docker compose restart` e `docker compose down`/`up` mantiveram usuários, receitas
  e categorias, sem reexecutar o seed.
- Segurança: 26 verificações manuais (IDOR A/B, token expirado/forjado/`alg:none`, hash não exposto,
  campo `idUsuarios` rejeitado, curingas e injeção SQL na busca, limites de paginação, JSON malformado)
  passaram sem falhas.
- Impressão: receita curta gerou 1 página; receita com 34 ingredientes e 20 etapas gerou 4 páginas,
  com todo o conteúdo extraído do PDF, sem cortes e sem elementos de interface.
- Responsividade: sem overflow horizontal em 390 px nas telas de lista, formulário e detalhe.
- Sessão expirada: token inválido limpa o `localStorage`, redireciona ao login e exibe toast.

## 12. Considerações finais

A entrega prioriza fidelidade ao schema original, isolamento de dados por usuário e uma experiência
de uso cuidada. O código está organizado por domínio, com validação consistente no cliente e no
servidor, tratamento centralizado de erros e documentação viva no Swagger. A suíte cobre o caminho
feliz, erros de autenticação, validação, pesquisa/filtros, autorização entre usuários e o fluxo
completo de interface, incluindo impressão e logout.
