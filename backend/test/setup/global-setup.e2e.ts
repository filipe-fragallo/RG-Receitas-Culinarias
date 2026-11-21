import globalSetup from './global-setup';

// O suíte de API E2E usa um schema próprio para não competir com os testes de
// integração. O nome pode ser sobrescrito por E2E_DB_NAME.
process.env.DB_NAME = process.env.E2E_DB_NAME ?? 'teste_receitas_rg_sistemas_e2e';

export default globalSetup;
