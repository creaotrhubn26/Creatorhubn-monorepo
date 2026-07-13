import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { createPool } from '../db/pool.js';
import { buildNorwegianRuleRegister } from '../rules/no/rules.js';
import { LocalObjectStorage } from '../storage/local.js';
import { createApiServer } from './server.js';

const config = loadConfig();
const db = createPool(config.databaseUrl);
const rules = buildNorwegianRuleRegister();
const storage = new LocalObjectStorage(config.storageDir);
const webDistDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'dist');
const app = createApiServer({
  db,
  rules,
  storage,
  webDistDir: existsSync(webDistDir) ? webDistDir : undefined,
});

app.listen(config.port, () => {
  console.log(`${config.productName} API lytter på port ${config.port} (${config.environment})`);
});
