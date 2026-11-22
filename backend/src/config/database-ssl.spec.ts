import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assertDatabaseSslHost,
  buildDatabaseSslOptions,
  databaseSslOptionsFromSequelize,
  DB_SSL_CA_REQUIRED_MESSAGE,
  DB_SSL_HOST_MESSAGE,
  parseDatabaseSslFlag,
  readDatabaseSslSettings,
} from './database-ssl';

const CA_PATH = join(__dirname, '../../test/fixtures/test-ca.pem');

describe('configuração TLS compartilhada do banco', () => {
  it('preserva a conexão local sem TLS quando DB_SSL não é true', () => {
    const settings = readDatabaseSslSettings({ DB_HOST: '127.0.0.1' });

    expect(settings).toEqual({ enabled: false, caPath: undefined });
    expect(buildDatabaseSslOptions(settings, '127.0.0.1')).toBeUndefined();
    expect(buildDatabaseSslOptions(settings, undefined)).toBeUndefined();
  });

  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['0', false],
    ['true', true],
    ['1', true],
    [true, true],
  ])('interpreta DB_SSL=%p como %p', (value, expected) => {
    expect(parseDatabaseSslFlag(value)).toBe(expected);
  });

  it('rejeita um valor ambíguo para DB_SSL', () => {
    expect(() => parseDatabaseSslFlag('maybe')).toThrow('DB_SSL deve ser true ou false.');
  });

  it('exige CA quando DB_SSL=true', () => {
    expect(() =>
      readDatabaseSslSettings({ DB_SSL: 'true', DB_HOST: 'gateway.tidbcloud.com' }),
    ).toThrow(DB_SSL_CA_REQUIRED_MESSAGE);
  });

  it('rejeita CA inexistente', () => {
    expect(() =>
      buildDatabaseSslOptions(
        { enabled: true, caPath: join(tmpdir(), 'ca-que-nao-existe.pem') },
        'gateway.tidbcloud.com',
      ),
    ).toThrow(/Falha ao ler DB_SSL_CA_PATH/);
  });

  it('aceita CA inline com verificação integral habilitada (Vercel)', () => {
    const ca = readFileSync(CA_PATH, 'utf8');
    const settings = readDatabaseSslSettings({ DB_SSL: 'true', DB_SSL_CA: ca });
    const options = buildDatabaseSslOptions(settings, 'gateway.tidbcloud.com');

    expect(settings.ca).toContain('-----BEGIN CERTIFICATE-----');
    expect(settings.caPath).toBeUndefined();
    expect(options).toMatchObject({
      rejectUnauthorized: true,
      verifyIdentity: true,
      minVersion: 'TLSv1.2',
    });
  });

  it('aceita CA inline com quebras de linha literais vindas de um secret', () => {
    const ca = readFileSync(CA_PATH, 'utf8').replace(/\n/g, '\\n');
    const options = buildDatabaseSslOptions(
      readDatabaseSslSettings({ DB_SSL: 'true', DB_SSL_CA: ca }),
      'gateway.tidbcloud.com',
    );

    expect(options?.ca).toContain('\n-----END CERTIFICATE-----');
  });

  it('rejeita CA inline com conteúdo inválido', () => {
    expect(() =>
      buildDatabaseSslOptions(
        readDatabaseSslSettings({ DB_SSL: 'true', DB_SSL_CA: 'isto nao e um certificado' }),
        'gateway.tidbcloud.com',
      ),
    ).toThrow(/DB_SSL_CA não contém um certificado PEM válido/);
  });

  it('rejeita CA com conteúdo inválido', () => {
    const directory = mkdtempSync(join(tmpdir(), 'rg-ca-invalida-'));
    const invalidPath = join(directory, 'invalid.pem');
    writeFileSync(invalidPath, 'isto nao e um certificado PEM');

    try {
      expect(() =>
        buildDatabaseSslOptions({ enabled: true, caPath: invalidPath }, 'gateway.tidbcloud.com'),
      ).toThrow(/não contém um certificado PEM válido/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('aceita uma CA PEM válida com verificação integral habilitada', () => {
    const options = buildDatabaseSslOptions(
      { enabled: true, caPath: CA_PATH },
      'gateway01.sa-east-1.prod.aws.tidbcloud.com',
    );

    expect(options?.ca).toContain('-----BEGIN CERTIFICATE-----');
    expect(options).toMatchObject({
      rejectUnauthorized: true,
      verifyIdentity: true,
      minVersion: 'TLSv1.2',
    });
  });

  it('rejeita IP como host quando TLS está ativo', () => {
    expect(() => assertDatabaseSslHost('127.0.0.1')).toThrow(DB_SSL_HOST_MESSAGE);
    expect(() => assertDatabaseSslHost('::1')).toThrow(DB_SSL_HOST_MESSAGE);
    expect(() => buildDatabaseSslOptions({ enabled: true, caPath: CA_PATH }, '10.0.0.5')).toThrow(
      DB_SSL_HOST_MESSAGE,
    );
  });

  it('rejeita host vazio quando TLS está ativo', () => {
    expect(() => assertDatabaseSslHost(undefined)).toThrow(/DB_HOST não definido/);
  });

  it('reutiliza somente opções com rejectUnauthorized e verifyIdentity true', () => {
    const valid = buildDatabaseSslOptions(
      { enabled: true, caPath: CA_PATH },
      'gateway.tidbcloud.com',
    );
    const sequelize = {
      config: { dialectOptions: { ssl: valid } },
    };

    expect(databaseSslOptionsFromSequelize(sequelize)).toEqual(valid);
    expect(() =>
      databaseSslOptionsFromSequelize({
        config: {
          dialectOptions: {
            ssl: { ...valid, rejectUnauthorized: false, verifyIdentity: false },
          },
        },
      }),
    ).toThrow(/rejectUnauthorized e verifyIdentity precisam ser true/);
  });
});
