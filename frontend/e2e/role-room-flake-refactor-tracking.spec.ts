/**
 * I1 / I2 / I3 — Flake-tracker.
 *
 * Dette er IKKE en e2e-test som kjører UI, men en *kodelinje-assertion* som
 * voktes mot tilbakefall. Kjør med `npx playwright test role-room-flake-refactor-tracking`.
 *
 * Hver gang noen reintroduserer `page.waitForTimeout(N)` eller
 * `{ force: true }` i role-room-comprehensive eller role-room-full, faler
 * dette specet — så den dårlige vanen ikke sniker seg tilbake.
 *
 * Du må fjerne forekomster fra de to specene før denne testen blir grønn —
 * det er hele poenget. Når antallet er = 0 oppdaterer du EXPECTED-tallene.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPECS = [
  path.resolve(HERE, 'role-room-comprehensive.spec.ts'),
  path.resolve(HERE, 'role-room-full.spec.ts'),
];

// Ved start av refactor-arbeid: comprehensive=61 + full=62. Mål: ned mot 0.
// Senk taket gradvis etter hvert som du refactorer.
const EXPECTED_MAX_TIMEOUTS_TOTAL = 120;
const EXPECTED_MAX_FORCE_CLICKS = 10;
const EXPECTED_MAX_IS_VISIBLE_CATCH = 12;

test.describe('flake tracker — role-room specs', () => {
  test('total waitForTimeout-forekomster faller monotont', () => {
    let total = 0;
    for (const file of SPECS) {
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(/page\.waitForTimeout\(/g) ?? [];
      total += matches.length;
    }
    console.log(`waitForTimeout total: ${total}`);
    expect(total).toBeLessThanOrEqual(EXPECTED_MAX_TIMEOUTS_TOTAL);
  });

  test('total { force: true }-clicks faller monotont', () => {
    let total = 0;
    for (const file of SPECS) {
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(/\.click\([^)]*force:\s*true/g) ?? [];
      total += matches.length;
    }
    console.log(`force: true clicks: ${total}`);
    expect(total).toBeLessThanOrEqual(EXPECTED_MAX_FORCE_CLICKS);
  });

  test('total .isVisible().catch(...) faller monotont', () => {
    let total = 0;
    for (const file of SPECS) {
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(/\.isVisible\(\)\.catch/g) ?? [];
      total += matches.length;
    }
    console.log(`isVisible().catch: ${total}`);
    expect(total).toBeLessThanOrEqual(EXPECTED_MAX_IS_VISIBLE_CATCH);
  });
});
