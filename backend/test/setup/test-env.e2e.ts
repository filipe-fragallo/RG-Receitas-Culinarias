import { applyTestEnvironment } from './test-environment';

process.env.DB_NAME = process.env.E2E_DB_NAME ?? 'teste_receitas_rg_sistemas_e2e';

applyTestEnvironment();
