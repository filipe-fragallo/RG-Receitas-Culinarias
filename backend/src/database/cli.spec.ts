import { assertCliSafety } from './cli';

const ENV_KEYS = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'NODE_ENV',
  'DB_ALLOW_REMOTE',
  'DB_ALLOW_PRODUCTION_MIGRATIONS',
] as const;

type SavedEnv = Record<(typeof ENV_KEYS)[number], string | undefined>;

describe('CLI baseline', () => {
  let saved: SavedEnv;

  beforeEach(() => {
    saved = {} as SavedEnv;
    for (const key of ENV_KEYS) saved[key] = process.env[key];

    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = '3306';
    process.env.DB_USER = 'receitas';
    process.env.DB_PASSWORD = 'receitas_dev';
    process.env.DB_NAME = 'teste_receitas_rg_sistemas';
    process.env.NODE_ENV = 'development';
    delete process.env.DB_ALLOW_REMOTE;
    delete process.env.DB_ALLOW_PRODUCTION_MIGRATIONS;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('recusa baseline sem confirmação explícita', () => {
    expect(() => assertCliSafety('baseline')).toThrow(/--yes/);
    expect(() => assertCliSafety('baseline', ['sim'])).toThrow(/--yes/);
  });

  it('aceita baseline somente com --yes após as barreiras de ambiente', () => {
    expect(() => assertCliSafety('baseline', ['--yes'])).not.toThrow();

    process.env.NODE_ENV = 'production';
    expect(() => assertCliSafety('baseline', ['--yes'])).toThrow(/produção/);
  });
});
