/**
 * E2E: Role Room GA4-events
 *
 * Verifiserer at alle viktige Role Room-handlinger fyrer riktige
 * GA4-events med riktige parametere. Bruker `addInitScript` for å
 * stubbe `window.gtag` og fange opp alle kall i `window.__gtagCalls`.
 *
 * Hvert event er en separat test som:
 *   1. Kjører minimum brukerflyt for å trigge handlingen
 *   2. Asserter at riktig event-navn + nøkkelparametere er pushet
 *
 * Test-spec er sannheten for event-taksonomien — `roleRoomAnalytics.ts`
 * er kanonisk implementasjon.
 */

import { test, expect, type Page } from '@playwright/test';

const TEST_PAGE = '/e2e-test.html';

interface GtagCall {
  command: string;
  eventName?: string;
  params?: Record<string, unknown>;
}

declare global {
  interface Window {
    __gtagCalls?: unknown[][];
  }
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Installer gtag-stub før bundle laster — fanger alle kall i
 * `window.__gtagCalls`.
 */
async function installGtagStub(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __gtagCalls: unknown[][] }).__gtagCalls = [];
    (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag = (
      ...args: unknown[]
    ) => {
      (window as unknown as { __gtagCalls: unknown[][] }).__gtagCalls.push(args);
      (window as unknown as { dataLayer: unknown[] }).dataLayer.push(args);
    };
  });
}

async function gotoRoleRoom(page: Page) {
  await installGtagStub(page);
  await page.goto(TEST_PAGE, { waitUntil: 'load', timeout: 60_000 });
  await expect(
    page.getByText('Casting, crew & produksjonsplanlegging')
  ).toBeVisible({ timeout: 30_000 });
}

/**
 * Hent alle gtag-event-kall som matcher et eventName fra siden.
 */
async function getGtagEvents(page: Page, eventName: string): Promise<GtagCall[]> {
  const calls = await page.evaluate(() => window.__gtagCalls ?? []);
  return calls
    .filter(
      (args) =>
        Array.isArray(args) && args[0] === 'event' && args[1] === eventName,
    )
    .map((args) => ({
      command: String(args[0]),
      eventName: String(args[1]),
      params: (args[2] ?? {}) as Record<string, unknown>,
    }));
}

/**
 * Poll opptil 5s for at et event har blitt fyrt.
 */
async function expectGA4Event(
  page: Page,
  eventName: string,
  expectedParams?: Partial<Record<string, unknown>>,
): Promise<GtagCall> {
  let lastEvents: GtagCall[] = [];
  for (let i = 0; i < 25; i += 1) {
    lastEvents = await getGtagEvents(page, eventName);
    if (lastEvents.length > 0) {
      const match = expectedParams
        ? lastEvents.find((ev) =>
            Object.entries(expectedParams).every(
              ([key, val]) => ev.params?.[key] === val,
            ),
          )
        : lastEvents[0];
      if (match) return match;
    }
    await page.waitForTimeout(200);
  }
  throw new Error(
    `Event "${eventName}" ${
      expectedParams ? `with params ${JSON.stringify(expectedParams)} ` : ''
    }not fired. Captured ${lastEvents.length} call(s) with this name: ${JSON.stringify(
      lastEvents,
    )}`,
  );
}

// ═══════════════════════════════════════════════════════════════
// SANITY: gtag-stub fungerer
// ═══════════════════════════════════════════════════════════════

test.describe('GA4 stub sanity', () => {
  test('gtag-stub fanger event-kall', async ({ page }) => {
    await gotoRoleRoom(page);

    await page.evaluate(() => {
      (window as unknown as { gtag: (...args: unknown[]) => void }).gtag(
        'event',
        'sanity_check',
        { foo: 'bar' },
      );
    });

    const events = await getGtagEvents(page, 'sanity_check');
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].params).toMatchObject({ foo: 'bar' });
  });
});

// ═══════════════════════════════════════════════════════════════
// P0 — Core conversion funnel
// ═══════════════════════════════════════════════════════════════

test.describe('P0: Role Room core events', () => {
  test('role_room_project_created — fires when "Nytt prosjekt" submitted', async ({
    page,
  }) => {
    await gotoRoleRoom(page);

    const newProjectBtn = page.getByRole('button', { name: /Nytt prosjekt/i });
    await newProjectBtn.click();

    // Fyll inn minimum-felter i modal
    const titleField = page.getByLabel(/Tittel|Prosjektnavn|Navn/i).first();
    await titleField.fill(`E2E GA4 Test ${Date.now()}`);

    // Submit
    const submitBtn = page
      .getByRole('button', { name: /Opprett|Lagre|Bekreft/i })
      .last();
    await submitBtn.click();

    await expectGA4Event(page, 'role_room_project_created');
  });

  test('role_room_tab_changed — fires when switching tab', async ({ page }) => {
    await gotoRoleRoom(page);

    // Forventer at det finnes ihvertfall noen tabs. Klikk en av dem.
    const castingTab = page
      .getByRole('tab', { name: /Casting/i })
      .first();
    if (await castingTab.isVisible().catch(() => false)) {
      await castingTab.click();
      await expectGA4Event(page, 'role_room_tab_changed');
    } else {
      test.skip(true, 'Casting-tab ikke synlig i harness');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// P1 — Engagement (skeleton — utvides etter hvert som instrumenteringen er på plass)
// ═══════════════════════════════════════════════════════════════

test.describe('P1: Role Room engagement events', () => {
  test('role_room_audition_view_toggled — fires when audition view-mode toggled', async ({
    page,
  }) => {
    await gotoRoleRoom(page);

    // Vi navigerer til Audition-seksjonen hvis tilgjengelig
    const auditionTab = page
      .getByRole('tab', { name: /Audition/i })
      .first();
    if (!(await auditionTab.isVisible().catch(() => false))) {
      test.skip(true, 'Audition-tab ikke synlig i harness');
    }
    await auditionTab.click();

    const toggle = page
      .getByRole('button', { name: /Audition-gruppert|Synthetisk|Schedule-visning/i })
      .first();
    if (!(await toggle.isVisible().catch(() => false))) {
      test.skip(true, 'Audition view toggle ikke funnet');
    }
    await toggle.click();

    await expectGA4Event(page, 'role_room_audition_view_toggled');
  });
});
