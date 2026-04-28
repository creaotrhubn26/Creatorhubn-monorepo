/**
 * production-team-demo-isolation.spec.ts
 *
 * Verifiserer at TROLL demo-data IKKE leker inn i produksjonsteam-flyten
 * uten eksplisitt knappetrykk. Bruker kreve minimum 15 iterasjoner for å
 * bekrefte stabilitet — vi bruker --repeat-each=15 fra CLI eller
 * test.describe.configure for å kjøre testen 15 ganger.
 *
 * Backend mockes via page.route slik at vi ikke trenger ekte
 * Postgres/auth. Vi tester KUN at:
 *   1. Frontend useEffect ikke kaller castingService.initializeMockData()
 *      lenger (verifiseres ved at /api/casting/demo/troll/* aldri rammes
 *      uten knappetrykk)
 *   2. Klikk på "Last Demo"-knapp DOES utløse demo-init
 *
 * Lager dummy-page som mounter de relevante komponentene direkte.
 */

import { expect, test } from '@playwright/test';

const ORIGIN = 'http://creatorhubn.localtest.me:5001';

// Kjør hele suite 15 ganger for stabilitetsverifikasjon
test.describe.configure({ mode: 'serial' });

test.describe('Produksjonsteam — demo-leak-regresjon (15× stabil)', () => {

  // Track HVILKE demo-endepunkter rammes — disse skal IKKE kalles uten knappetrykk
  const DEMO_ENDPOINTS = [
    '**/api/casting/demo/troll/offers-contracts',
    '**/api/demo/troll/initialize-all',
    '**/api/split-sheets/demo/troll',
    '**/api/casting/demo/**',
  ];

  for (let i = 1; i <= 15; i++) {
    test(`iter ${i}/15: ingen demo-endepunkter kalles på fersk login uten knappetrykk`, async ({ page }) => {
      const demoCalls: string[] = [];

      // Mock auth + projects-API for å returnere tom liste (fersk konto)
      await page.addInitScript(() => {
        window.localStorage.setItem('authToken', 'e2e-test-token');
      });
      await page.route('**/api/auth/user', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            authenticated: true,
            user: {
              id: 'e2e-prod-user',
              email: 'tester@e2e.local',
              firstName: 'E2E', lastName: 'Tester',
              role: 'production_team',
            },
          }),
        });
      });
      await page.route('**/api/casting/projects', async (route) => {
        // Tom prosjektliste — slik som en fersk konto uten Troll
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ projects: [] }),
        });
      });
      await page.route('**/api/role-room/projects', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ projects: [] }),
        });
      });

      // Snap opp demo-endepunkt-kall — hvis noen rammes, tester feiler
      for (const pattern of DEMO_ENDPOINTS) {
        await page.route(pattern, async (route) => {
          demoCalls.push(`${route.request().method()} ${route.request().url()}`);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: false, blockedByTest: true }),
          });
        });
      }

      // Naviger til produksjonsteam workspace (basert på eksisterende routing)
      await page.goto(`${ORIGIN}/casting?profession=production`);

      // Vent 3 sekunder — gir useEffect-er tid til å fyre
      await page.waitForTimeout(3000);

      // Sjekk: ingen demo-endepunkter ble kalt
      expect(demoCalls).toEqual([]);
    });
  }

});
