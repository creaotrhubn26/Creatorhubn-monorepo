import { loadConfig } from '../config.js';
import { createPool } from '../db/pool.js';
import { buildNorwegianRuleRegister } from '../rules/no/rules.js';
import { createApiServer } from './server.js';

const config = loadConfig();
const db = createPool(config.databaseUrl);
const rules = buildNorwegianRuleRegister();
const app = createApiServer({ db, rules });

app.listen(config.port, () => {
  console.log(`${config.productName} API lytter på port ${config.port} (${config.environment})`);
});
