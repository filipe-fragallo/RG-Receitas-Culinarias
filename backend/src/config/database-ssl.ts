import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { createSecureContext } from 'node:tls';

/**
 * Configuração TLS compartilhada por Sequelize, CLI, lock de migrations e
 * validação de ambiente. A aplicação nunca usa `rejectUnauthorized: false`.
 */

export interface DatabaseSslSettings {
  enabled: boolean;
  caPath?: string;
  /** PEM inline, usado quando o filesystem não é persistente (Vercel). */
  ca?: string;
}

export interface DatabaseSslOptions {
  ca: string;
  rejectUnauthorized: true;
  verifyIdentity: true;
  minVersion: 'TLSv1.2';
}

export const DB_SSL_CA_REQUIRED_MESSAGE =
  'DB_SSL=true exige DB_SSL_CA com o PEM da autoridade certificadora ou DB_SSL_CA_PATH com um arquivo PEM.';
export const DB_SSL_HOST_MESSAGE =
  'DB_SSL=true exige DB_HOST como hostname DNS para validar certificado e hostname; use o gateway do TiDB Cloud, não um endereço IP.';
export const DB_SSL_REJECT_MESSAGE =
  'Configuração TLS inválida: rejectUnauthorized e verifyIdentity precisam ser true.';

export function parseDatabaseSslFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return false;
  if (typeof value !== 'string') {
    throw new Error('DB_SSL deve ser true ou false.');
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === '' || normalized === 'false' || normalized === '0') return false;
  if (normalized === 'true' || normalized === '1') return true;

  throw new Error('DB_SSL deve ser true ou false.');
}

/** Seeds de GitHub/Vercel frequentemente guardam o PEM com `\n` literal. */
function normalizePem(value: string): string {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

function validatePem(pem: string, source: string): string {
  if (!/-----BEGIN CERTIFICATE-----/.test(pem) || !/-----END CERTIFICATE-----/.test(pem)) {
    throw new Error(`${source} não contém um certificado PEM válido.`);
  }

  try {
    createSecureContext({ ca: pem });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`CA inválida em ${source}: ${reason}`);
  }

  return pem;
}

export function readDatabaseSslSettings(env: NodeJS.ProcessEnv = process.env): DatabaseSslSettings {
  const enabled = parseDatabaseSslFlag(env.DB_SSL);
  const caPath = env.DB_SSL_CA_PATH?.trim() || undefined;
  const ca = env.DB_SSL_CA?.trim() ? normalizePem(env.DB_SSL_CA.trim()) : undefined;

  if (enabled && !caPath && !ca) {
    throw new Error(DB_SSL_CA_REQUIRED_MESSAGE);
  }

  return ca ? { enabled, ca } : { enabled, caPath };
}

export function assertDatabaseSslHost(host: string | undefined | null): void {
  const normalized = (host ?? '').trim();
  if (!normalized) {
    throw new Error('DB_HOST não definido; não é possível validar o hostname do TLS.');
  }
  if (isIP(normalized)) {
    throw new Error(`${DB_SSL_HOST_MESSAGE} Recebido: "${normalized}".`);
  }
}

export function readDatabaseSslCa(settings: DatabaseSslSettings): string {
  const inline = settings.ca?.trim();
  if (inline) return validatePem(normalizePem(inline), 'DB_SSL_CA');

  const path = settings.caPath?.trim();
  if (!path) throw new Error(DB_SSL_CA_REQUIRED_MESSAGE);

  let pem: string;
  try {
    pem = readFileSync(path, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Falha ao ler DB_SSL_CA_PATH "${path}": ${reason}`);
  }

  return validatePem(pem, `DB_SSL_CA_PATH "${path}"`);
}

/**
 * Opções passadas ao mysql2 por Sequelize e pela conexão dedicada do GET_LOCK.
 * `verifyIdentity` é necessário no mysql2: sem ele a biblioteca desativa a
 * verificação do hostname mesmo quando `rejectUnauthorized` é `true`.
 */
export function buildDatabaseSslOptions(
  settings: DatabaseSslSettings,
  host: string | undefined,
): DatabaseSslOptions | undefined {
  if (!settings.enabled) return undefined;

  assertDatabaseSslHost(host);
  return {
    ca: readDatabaseSslCa(settings),
    rejectUnauthorized: true,
    verifyIdentity: true,
    minVersion: 'TLSv1.2',
  };
}

/** Reusa exatamente as opções já validadas na conexão Sequelize existente. */
export function databaseSslOptionsFromSequelize(sequelize: {
  config: unknown;
}): DatabaseSslOptions | undefined {
  const dialectOptions = (sequelize.config as { dialectOptions?: { ssl?: DatabaseSslOptions } })
    ?.dialectOptions;
  const ssl = dialectOptions?.ssl;
  if (!ssl) return undefined;
  if (ssl.rejectUnauthorized !== true || ssl.verifyIdentity !== true) {
    throw new Error(DB_SSL_REJECT_MESSAGE);
  }
  return ssl;
}
