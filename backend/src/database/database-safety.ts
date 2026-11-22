/**
 * Barreiras de segurança para operações destrutivas e para o setup de testes.
 *
 * Todas as funções são puras: recebem o alvo do banco e decidem antes de
 * qualquer conexão ou comando SQL. Assim é possível testar os bloqueios sem
 * apagar nenhum schema.
 */

export interface DatabaseTarget {
  host?: string;
  schema?: string;
  nodeEnv?: string;
  allowRemote?: boolean;
  allowedRemoteHost?: string;
  allowProductionMigrations?: boolean;
  migrationsAuto?: boolean;
  sslEnabled?: boolean;
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '::ffff:127.0.0.1']);

export const PRODUCTION_DB_SCHEMA = 'teste_receitas_rg_sistemas';
export const PRODUCTION_DB_HOST = 'gateway01.sa-east-1.prod.aws.tidbcloud.com';

const APP_SCHEMA = PRODUCTION_DB_SCHEMA;

/** Nomes que nunca são aceitos como alvo de escrita/deletes pelo projeto. */
const FORBIDDEN_SCHEMAS = new Set([
  'receitas',
  'receitas_rg_sistemas',
  'prod',
  'production',
  'producao',
]);

/** O schema da aplicação é válido para migrate, mas nunca para testes. */
const TEST_BLOCKED_SCHEMAS = new Set([...FORBIDDEN_SCHEMAS, APP_SCHEMA]);

/** Ex.: teste_receitas_rg_sistemas_test, teste_receitas_rg_sistemas_e2e. */
const TEST_SCHEMA_PATTERN = /^teste_receitas_rg_sistemas(?:_[a-z0-9]+)*_(test|e2e)$/i;

/** Schemas locais de desenvolvimento aceitos pela CLI (com confirmação). */
const DEV_SCHEMA_PATTERN = /^teste_receitas_rg_sistemas(?:_[a-z0-9]+)*$/i;

export function isLoopbackHost(host: string | undefined): boolean {
  return LOOPBACK_HOSTS.has((host ?? '').trim().toLowerCase());
}

function schemaOf(target: DatabaseTarget): string {
  return (target.schema ?? '').trim();
}

function assertRemoteHostAllowed(target: DatabaseTarget, purpose: string): void {
  const host = (target.host ?? '').trim();
  const allowedHost = (target.allowedRemoteHost ?? '').trim();
  const allowVar = purpose === 'Setup de teste' ? 'TEST_DB_ALLOW_REMOTE' : 'DB_ALLOW_REMOTE';
  const hostVar = purpose === 'Setup de teste' ? 'TEST_DB_ALLOWED_HOST' : 'DB_ALLOWED_HOST';

  if (!isLoopbackHost(host) && target.allowRemote !== true) {
    throw new Error(
      `${purpose}: host remoto "${host}" não autorizado. ` +
        `Use um MySQL local (127.0.0.1) ou defina ${allowVar}=true com ${hostVar}=${host}.`,
    );
  }

  // Um simples opt-in booleano não basta: o host nominal precisa conferir.
  // Isso impede que um DB_ALLOW_REMOTE=true acidental autorize outro servidor.
  if (!isLoopbackHost(host) && !allowedHost) {
    throw new Error(
      `${purpose}: host remoto "${host}" exige ${hostVar} com o nome exato do host autorizado.`,
    );
  }

  if (!isLoopbackHost(host) && allowedHost.toLowerCase() !== host.toLowerCase()) {
    throw new Error(
      `${purpose}: host "${host}" não confere com o host autorizado "${allowedHost}".`,
    );
  }
}

/**
 * Validação executada no globalSetup, antes de abrir conexão ou emitir DROP.
 */
export function assertTestDatabaseTarget(target: DatabaseTarget): void {
  if (target.nodeEnv !== 'test') {
    throw new Error(
      `Setup de teste recusado: NODE_ENV deve ser "test" (recebido: "${target.nodeEnv ?? 'vazio'}").`,
    );
  }

  const schema = schemaOf(target);

  if (!schema) {
    throw new Error('Setup de teste recusado: o schema de teste não foi informado.');
  }

  if (TEST_BLOCKED_SCHEMAS.has(schema.toLowerCase())) {
    throw new Error(`Setup de teste recusado: o schema "${schema}" é reservado para a aplicação.`);
  }

  if (!TEST_SCHEMA_PATTERN.test(schema)) {
    throw new Error(
      `Setup de teste recusado: o schema "${schema}" deve usar o prefixo ` +
        'teste_receitas_rg_sistemas e terminar em _test ou _e2e.',
    );
  }

  assertRemoteHostAllowed(target, 'Setup de teste');
}

/**
 * Validação para db:migrate e db:seed (escrita não destrutiva).
 */
export function assertDatabaseWriteAllowed(target: DatabaseTarget): void {
  const schema = schemaOf(target);

  if (FORBIDDEN_SCHEMAS.has(schema.toLowerCase())) {
    throw new Error(`Escrita recusada: o schema "${schema}" está na lista de bloqueio.`);
  }

  if (!DEV_SCHEMA_PATTERN.test(schema) && !TEST_SCHEMA_PATTERN.test(schema)) {
    throw new Error(
      `Escrita recusada: schema "${schema}" não é um schema conhecido do projeto. ` +
        'Use teste_receitas_rg_sistemas ou um sufixo _test/_e2e.',
    );
  }

  if (target.nodeEnv === 'production' && !target.allowProductionMigrations) {
    throw new Error(
      'Escrita recusada em produção. Defina DB_ALLOW_PRODUCTION_MIGRATIONS=true ' +
        'e execute o comando explicitamente (nunca no bootstrap).',
    );
  }

  assertRemoteHostAllowed(target, 'Comando de banco');
}

/**
 * Barreiras do provisionamento inicial de produção. Todas são avaliadas antes
 * de abrir conexão: host nominal, schema exato, TLS, NODE_ENV e confirmação.
 */
export function assertProductionSetupTarget(
  target: DatabaseTarget,
  confirmation: string | undefined,
): void {
  if (confirmation !== '--yes') {
    throw new Error(
      'Setup de produção recusado: confirme explicitamente com --yes. ' +
        'Exemplo: npm run db:setup:prod -- --yes',
    );
  }

  if (target.nodeEnv !== 'production') {
    throw new Error(
      `Setup de produção recusado: NODE_ENV deve ser "production" (recebido: "${target.nodeEnv ?? 'vazio'}").`,
    );
  }

  if (schemaOf(target) !== PRODUCTION_DB_SCHEMA) {
    throw new Error(
      `Setup de produção recusado: DB_NAME deve ser "${PRODUCTION_DB_SCHEMA}" ` +
        `(recebido: "${schemaOf(target) || 'vazio'}").`,
    );
  }

  const host = (target.host ?? '').trim().toLowerCase();
  if (host !== PRODUCTION_DB_HOST) {
    throw new Error(
      `Setup de produção recusado: DB_HOST deve ser "${PRODUCTION_DB_HOST}" ` +
        `(recebido: "${target.host || 'vazio'}").`,
    );
  }

  if (target.sslEnabled !== true) {
    throw new Error(
      'Setup de produção recusado: DB_SSL=true é obrigatório para conectar ao TiDB Cloud.',
    );
  }

  // Reaproveita a política de escrita: exige DB_ALLOW_REMOTE com host nominal e
  // DB_ALLOW_PRODUCTION_MIGRATIONS, sem permitir nomes de schema desconhecidos.
  assertDatabaseWriteAllowed(target);
}

/**
 * Validação para db:down e db:reset.
 */
export function assertDestructiveDatabaseAction(
  target: DatabaseTarget,
  confirmation: string | undefined,
): void {
  const schema = schemaOf(target);

  if (target.nodeEnv === 'production') {
    throw new Error(
      'Operação destrutiva recusada em produção. db:down e db:reset são exclusivos de desenvolvimento/teste.',
    );
  }

  if (FORBIDDEN_SCHEMAS.has(schema.toLowerCase()) || !DEV_SCHEMA_PATTERN.test(schema)) {
    throw new Error(
      `Operação destrutiva recusada: schema "${schema}" não é um schema local conhecido do projeto.`,
    );
  }

  if (!isLoopbackHost(target.host)) {
    throw new Error(
      `Operação destrutiva recusada: o host "${target.host}" não é local. ` +
        'Nunca reverta migrations em bancos remotos ou compartilhados.',
    );
  }

  if (confirmation !== '--yes') {
    throw new Error(
      'Operação destrutiva recusada: confirme explicitamente com --yes. ' +
        'Exemplo: npm run db:reset -- --yes',
    );
  }

  assertRemoteHostAllowed(target, 'Operação destrutiva');
}

/**
 * Decide se o bootstrap pode aplicar migrations automaticamente.
 *
 * Reutiliza `assertDatabaseWriteAllowed`: além de produção/host remoto, o schema
 * precisa seguir a mesma política da CLI (prefixo do projeto, sufixo de teste
 * conhecido e nomes proibidos). Assim o bootstrap nunca escreve em um schema
 * desconhecido só porque o host é local.
 *
 * - produção: nunca (use db:migrate explícito e autorizado);
 * - desenvolvimento local: sim, com schema válido;
 * - host remoto (inclui TiDB Cloud): nunca, independentemente de
 *   DB_MIGRATIONS_AUTO ou DB_ALLOW_REMOTE. Migrations remotas exigem comando
 *   explícito e autorização nominal.
 */
export function shouldRunMigrationsOnBootstrap(target: DatabaseTarget): boolean {
  if (target.nodeEnv === 'production') return false;
  if (target.migrationsAuto === false) return false;

  // Barreira incondicional: nenhum host remoto recebe DDL no bootstrap.
  if (!isLoopbackHost(target.host)) return false;

  try {
    assertDatabaseWriteAllowed(target);
  } catch {
    return false;
  }

  return true;
}
