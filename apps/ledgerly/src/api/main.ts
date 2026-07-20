import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Sentry from '@sentry/node';
import { loadConfig } from '../config.js';
import { initSentry } from '../ops/sentry.js';
import { createPool } from '../db/pool.js';
import { DeterministicTextExtractor } from '../pipeline/extract.js';
import { isOcrAvailable, OcrExtractor } from '../pipeline/ocr.js';
import { buildNorwegianRuleRegister } from '../rules/no/rules.js';
import { BrregVatRegisterClient } from '../integrations/brreg.js';
import { LovdataApiClient } from '../integrations/lovdata.js';
import { MaskinportenClient } from '../integrations/maskinporten.js';
import { SkatteetatenVatSubmissionClient } from '../integrations/vat-submission.js';
import { LocalObjectStorage } from '../storage/local.js';
import { createApiServer } from './server.js';

const config = loadConfig();
// Feilovervåking initialiseres tidligst mulig (fanger også oppstartsfeil).
// No-op uten SENTRY_DSN — status rapporteres ærlig.
const errorMonitor = initSentry(
  { dsn: config.sentryDsn, environment: config.environment, release: config.sentryRelease },
  Sentry,
);
const db = createPool(config.databaseUrl);
const rules = buildNorwegianRuleRegister();
const storage = new LocalObjectStorage(config.storageDir);
const webDistDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'dist');
const ocrStatus = await isOcrAvailable();
const app = createApiServer({
  db,
  rules,
  storage,
  webDistDir: existsSync(webDistDir) ? webDistDir : undefined,
  extractor: ocrStatus.tesseract ? new OcrExtractor() : new DeterministicTextExtractor(),
  ocrStatus,
  // Åpne data fra Brønnøysundregistrene — ekte klient, ingen nøkkel kreves.
  vatRegister: new BrregVatRegisterClient(),
  // Lovdata: åpne bulk-datasett uten nøkkel; per-paragraf lovtekst krever
  // X-API-Key (LEDGERLY_LOVDATA_API_KEY). Status rapporteres ærlig.
  legalText: new LovdataApiClient(config.lovdataApiKey),
  // MVA-melding-innsending via Maskinporten. Uten MASKINPORTEN_*-legitimasjon
  // er den ikke aktiv (rapporteres ærlig); MVA-rapporten forblir kladd.
  vatSubmission: new SkatteetatenVatSubmissionClient(new MaskinportenClient(config.maskinporten)),
  // Feilovervåking (Sentry). No-op uten SENTRY_DSN.
  errorMonitor,
});
console.log(errorMonitor.active ? 'Sentry: feilovervåking aktiv' : 'Sentry: ikke aktiv (SENTRY_DSN mangler)');
console.log(
  ocrStatus.tesseract
    ? 'OCR: Tesseract aktiv (nor+eng)'
    : 'OCR: tesseract-ocr mangler — kun tekstbaserte dokumenter tolkes',
);

app.listen(config.port, () => {
  console.log(`${config.productName} API lytter på port ${config.port} (${config.environment})`);
});
