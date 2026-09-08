/**
 * Ende-til-ende for Marketing Cockpit.
 *
 * Denne suiten finnes fordi cockpiten var full av `data-testid` uten at
 * noe faktisk klikket på dem. Alt vi visste var at panelene RENDRET —
 * ikke at fanene byttet, at tallene kom fra Graph, eller at de to
 * handlingene som faktisk endrer Facebook-siden sendte noe som helst.
 *
 * Kjøres mot en levende stack: Vite (5001) → Express (3003) → Postgres,
 * med META_GRAPH_BASE_URL pekt på en lokal Graph-stand-in. Da er alt
 * unntatt Metas egne servere ekte kode.
 *
 * Forutsetninger (se docs/evidence/2026-09-08-marketing-cockpit-e2e.md):
 *   THEROLERROOM_PAGE_ID=page-1, IG_USER_ID=ig-1,
 *   META_GRAPH_BASE_URL=http://127.0.0.1:4010
 * Uten dem hopper suiten over seg selv i stedet for å feile falskt.
 */

import { test, expect, type Page } from '@playwright/test';

const COCKPIT_URL = 'http://localhost:5001/admin-workspace?view=marketing-cockpit';
const AUTH_TOKEN = 'dev-admin-local-session';
// AdminWorkspace er gated på produkteierens e-post (AdminWorkspace.tsx:1562),
// mens API-ene bare krever admin-rollen bearer-tokenet allerede gir. Derfor
// seedes eier-e-posten lokalt — ellers møter testen gate-skjermen, ikke
// cockpiten.
const OWNER_EMAIL = 'daniel@creatorhubn.com';
const AUTH_USER = {
  id: 'local-admin', email: OWNER_EMAIL, name: 'Local Admin',
  displayName: 'Local Admin', role: 'admin', roleLabel: 'Admin',
  profession: 'photographer', userType: 'photographer',
  permissions: ['users:read', 'users:write', 'roles:write'],
  isAdmin: true, verified_email: true,
};

/** Fanene slik de er definert i MarketingCockpitTab.tsx:374-380. */
const TABS = [
  { value: 'oversikt', label: 'Oversikt' },
  { value: 'innhold', label: 'Innhold & kampanjer' },
  { value: 'konkurrenter', label: 'Konkurrenter' },
  { value: 'b2b', label: 'B2B & kunder' },
  { value: 'leads', label: 'Leads & territorier' },
  { value: 'anbud', label: 'Anbud' },
  { value: 'mi', label: 'Markedsintelligens' },
];

/** Verdiene Graph-stand-in-en serverer. Hardkodet her med vilje: en test
 *  som leser fasiten fra samme kilde som koden beviser ingenting. */
const EXPECTED = { fans: '2481', igFollowers: '1893', leadForms: '1', pageName: 'The Role Room' };

async function gotoCockpit(page: Page) {
  await page.goto(COCKPIT_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await expect(page.getByTestId('marketing-cockpit-root')).toBeVisible({ timeout: 60_000 });
  // Summary-kallet aggregerer seks Graph-seksjoner; vent til spinneren er borte.
  await expect(page.getByTestId('cockpit-loading')).toHaveCount(0, { timeout: 60_000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('Marketing Cockpit — ende-til-ende mot levende stack', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(
      ({ token, user }) => {
        window.localStorage.setItem('creatorhub_auth_token', token);
        window.localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
        window.localStorage.setItem('userId', user.id);
        window.localStorage.setItem('userEmail', user.email);
      },
      { token: AUTH_TOKEN, user: AUTH_USER },
    );
    // useAuth henter /api/auth/user ved boot og overskriver den seedede
    // brukeren i localStorage. Dev-sesjonen på serveren er admin@local.dev,
    // så uten dette vinner serveren og gate-skjermen kommer tilbake. Samme
    // mønster som admin-tabs-smoke.spec.ts. Kun IDENTITET mockes — alle
    // cockpit-kall går ekte mot Express.
    await context.route('**/api/auth/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, user: AUTH_USER }),
      });
    });

    page = await context.newPage();
    await gotoCockpit(page);
  });

  test('summary er konfigurert — ellers er resten av suiten meningsløs', async () => {
    // Hopp heller over enn å feile falskt når Graph-stand-in-en ikke kjører.
    const notConfigured = await page.getByTestId('cockpit-not-configured').count();
    test.skip(notConfigured > 0, 'META_GRAPH_BASE_URL/THEROLERROOM_* ikke satt — se filhodet');
    await expect(page.getByTestId('cockpit-error')).toHaveCount(0);
  });

  test('topp-metrikkene viser TALL fra Graph, ikke plassholdere', async () => {
    const metrics = page.getByTestId('cockpit-top-metrics');
    await expect(metrics).toBeVisible();
    await expect(page.getByTestId('metric-fans')).toContainText(EXPECTED.fans);
    await expect(page.getByTestId('metric-ig-followers')).toContainText(EXPECTED.igFollowers);
    await expect(page.getByTestId('metric-leads')).toContainText(EXPECTED.leadForms);
    // '?' er verdien koden viser når en seksjon feilet. Ingen skal ha den.
    await expect(metrics).not.toContainText('?');
  });

  test('profilpanelet viser den ekte sidens navn', async () => {
    await expect(page.getByTestId('panel-profile')).toContainText(EXPECTED.pageName);
  });

  test('seksjonene er merket LIVE, ikke DEGRADED', async () => {
    // SectionHeader-testid-ene (MarketingCockpitTab.tsx:547-691) — merk at
    // de IKKE har panel-prefiks; kortet og headeren har hver sin id.
    for (const t of ['profile', 'cta', 'mentions', 'leads', 'ig', 'events', 'hashtags']) {
      await expect(page.getByTestId(`${t}-status`)).toHaveText('LIVE');
    }
  });

  for (const tab of TABS) {
    test(`fane «${tab.label}» bytter innhold og ingen panel krasjer`, async () => {
      await page.getByTestId('cockpit-tabs').getByRole('tab', { name: tab.label }).click();
      // Fanen skal faktisk bli valgt — ikke bare klikkbar.
      await expect(
        page.getByTestId('cockpit-tabs').getByRole('tab', { name: tab.label }),
      ).toHaveAttribute('aria-selected', 'true');

      // Per-panel ErrorBoundary rendrer panel-crashed-<navn> når et panel
      // kaster. Ingen skal være synlig, og faneraden skal overleve.
      await expect(page.locator('[data-testid^="panel-crashed-"]')).toHaveCount(0);
      await expect(page.getByTestId('cockpit-tabs')).toBeVisible();
      await expect(page.getByTestId('marketing-cockpit-root')).toBeVisible();
    });
  }

  test('koblingsstatus viser Facebook og Instagram som konfigurert', async () => {
    await page.getByTestId('cockpit-tabs').getByRole('tab', { name: 'Oversikt' }).click();
    const panel = page.getByTestId('panel-social-connections');
    await expect(panel).toBeVisible({ timeout: 30_000 });
    // Regresjonsvernet for den doble feilen: `configured` ble lest fra
    // seksjonene i stedet for toppnivå, så Facebook og Instagram sto som
    // «Ikke tilkoblet» mens 2481 følgere sto rett over på samme skjerm.
    // Per rad, ikke på sammenslått korttekst: LinkedIn og TikTok SKAL stå
    // som «Ikke tilkoblet» her (ingen credentials satt lokalt), så en
    // blank sjekk på hele kortet ville vært både feil og verdiløs.
    await expect(page.getByTestId('connection-facebook-status')).toHaveText('Konfigurert');
    await expect(page.getByTestId('connection-instagram-status')).toHaveText('Konfigurert');
    // LinkedIn-ruta som ga 404 før fiksen svarer nå ekte; uten credentials
    // er «Ikke tilkoblet» det korrekte svaret — poenget er at den ikke
    // lenger stille feiler.
    await expect(page.getByTestId('connection-linkedin-status')).toHaveText('Ikke tilkoblet');
  });

  test('set-cta sender faktisk til Graph og kvitterer', async () => {
    // CampaignActionsPanel ligger på «Innhold & kampanjer» (linje 727),
    // ikke på Oversikt.
    await page.getByTestId('cockpit-tabs').getByRole('tab', { name: 'Innhold & kampanjer' }).click();
    const cta = page.getByTestId('panel-cta-action');
    // .locator('input'): MUI TextField setter data-testid på FormControl-
    // wrapperen, så testid-en alene peker på en <div> og fill() feiler.
    await expect(cta).toBeVisible();
    await page.getByTestId('cta-url-input').locator('input').fill('https://theroleroom.no/audition');
    await page.getByTestId('cta-apply-button').click();
    const notice = page.getByTestId('cta-notice');
    await expect(notice).toBeVisible({ timeout: 30_000 });
    await expect(notice).not.toContainText('Feil');
  });

  test('publish-event sender faktisk til Graph og kvitterer', async () => {
    await page.getByTestId('event-title-input').locator('input').fill('Open Call Oslo');
    await page.getByTestId('event-start-input').locator('input').fill('2026-10-01T10:00');
    await page.getByTestId('event-venue-input').locator('input').fill('Sentralen');
    await page.getByTestId('event-publish-button').click();
    const notice = page.getByTestId('event-notice');
    await expect(notice).toBeVisible({ timeout: 30_000 });
    await expect(notice).not.toContainText('Feil');
  });

  test('refresh henter på nytt uten å tømme skjermen', async () => {
    // Metrikkene rendres bare på Oversikt, og forrige test forlot oss på
    // «Innhold & kampanjer».
    await page.getByTestId('cockpit-tabs').getByRole('tab', { name: 'Oversikt' }).click();
    await page.getByTestId('cockpit-refresh').click();
    await expect(page.getByTestId('cockpit-loading')).toHaveCount(0, { timeout: 60_000 });
    await expect(page.getByTestId('metric-fans')).toContainText(EXPECTED.fans);
    await expect(page.locator('[data-testid^="panel-crashed-"]')).toHaveCount(0);
  });
});
