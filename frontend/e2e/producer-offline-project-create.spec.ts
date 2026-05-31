import { expect, test, type Page } from '@playwright/test';

/**
 * Regresjonsvern for offline-opprettelse av innholdsprodusent-prosjekt.
 *
 * Dekker to data-tap-bugs som tidligere brøt hele content-producer-flyten når
 * backend var utilgjengelig (utløpt token / nedetid / offline):
 *
 *  1. NewProjectCreationModal POSTet direkte til /api/casting/projects og kastet
 *     ved 401 uten lokal fallback — en utfylt brief gikk tapt med kun en rød toast.
 *     Fix: faller tilbake til castingService.saveProject (lokal lagring + synk-kø).
 *
 *  2. castingService.saveProject bevarte kun eier-felter fra det eksisterende
 *     lagrede prosjektet. Et påfølgende delvis save (panelet skriver
 *     userRoles / producerWorkflowStatus rett etter at prosjektet åpnes)
 *     nullstilte navn, status, klientdata og lister. Fix: full merge av
 *     eksisterende felter før innkommende felter spres på.
 *
 * Testen tvinger backend til 401 på ALLE casting/settings-kall slik at den ekte
 * offline-stien kjøres, og verifiserer at prosjektet både opprettes OG beholder
 * navnet sitt i lokal lagring.
 */

const HARNESS = '/e2e-casting-test.html?session=content-producer&mode=content_producer';
const DEMO_PROJECT_NAME = 'Northwind Drilling - Sikker start';
const CASTING_PROJECTS_STORAGE_KEY =
  'app_settings_cache:e2e-test-user::casting-projects';

/** Tving alle backend-kall til å feile, slik at offline-fallbacken trigges. */
async function forceBackendOffline(page: Page) {
  await page.route('**/api/casting/projects**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'auth_required' }),
    });
  });
  await page.route('**/api/settings**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'auth_required' }),
    });
  });
  await page.route('**/api/role-room/**', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'auth_required' }),
    });
  });
}

async function openHarness(page: Page) {
  await page.goto(HARNESS, { waitUntil: 'load', timeout: 60_000 });
  await expect(
    page.getByRole('button', { name: 'Nytt prosjekt' }),
  ).toBeVisible({ timeout: 30_000 });
}

async function createDemoProjectOffline(page: Page) {
  await page.getByRole('button', { name: 'Nytt prosjekt' }).click();
  // Last det fiktive bedriftsprosjektet (klient, team, lokasjon).
  await page.getByRole('button', { name: 'Last demo' }).click();
  // Telefon er påkrevd og fylles ikke av demoen.
  await page.getByRole('textbox', { name: 'Telefon *' }).fill('+47 51 99 00 00');
  await page.getByRole('button', { name: 'Fortsett til oppsummering' }).click();
  await page.getByRole('button', { name: 'Opprett prosjekt' }).click();
  await page.getByRole('button', { name: 'Bekreft og opprett' }).click();
}

test.describe('Innholdsprodusent — offline prosjektopprettelse', () => {
  test('oppretter prosjekt lokalt og beholder navnet når backend er nede', async ({
    page,
  }) => {
    await forceBackendOffline(page);
    await openHarness(page);
    await createDemoProjectOffline(page);

    // 1) Fallbacken må ha persistert prosjektet i lokal lagring — MED navn.
    //    (Tidligere ble navnet nullstilt av et påfølgende delvis save.)
    await expect
      .poll(
        async () =>
          page.evaluate((storageKey) => {
            try {
              const raw = window.localStorage.getItem(storageKey);
              const projects = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
              const created = projects.find(
                (p) =>
                  typeof p.id === 'string' &&
                  p.id.startsWith('northwind-drilling-sikker-start-'),
              );
              return created?.name ?? null;
            } catch {
              return null;
            }
          }, CASTING_PROJECTS_STORAGE_KEY),
        { timeout: 15_000, message: 'Prosjektet skal være lokalt lagret med navn' },
      )
      .toBe(DEMO_PROJECT_NAME);

    // 2) Den aktive prosjekt-headeren skal vise navnet, ikke «Uten navn».
    await expect(
      page.getByRole('button', { name: new RegExp(DEMO_PROJECT_NAME) }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Uten navn')).toHaveCount(0);
  });

  test('navnet overlever en reload (lokal lagring er kilden offline)', async ({
    page,
  }) => {
    await forceBackendOffline(page);
    await openHarness(page);
    await createDemoProjectOffline(page);

    const nameSurvivesInStorage = (storageKey: string, name: string) =>
      page.evaluate(
        ({ storageKey: key, name: expectedName }) => {
          const raw = window.localStorage.getItem(key);
          const projects = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
          return projects.some(
            (p) =>
              typeof p.id === 'string' &&
              p.id.startsWith('northwind-drilling-sikker-start-') &&
              p.name === expectedName,
          );
        },
        { storageKey, name },
      );

    // Vent til prosjektet er skrevet til lokal lagring før reload.
    await expect
      .poll(async () => nameSurvivesInStorage(CASTING_PROJECTS_STORAGE_KEY, DEMO_PROJECT_NAME))
      .toBe(true);

    await page.reload({ waitUntil: 'load' });

    // Etter reload skal navnet fortsatt være i lokal lagring.
    expect(await nameSurvivesInStorage(CASTING_PROJECTS_STORAGE_KEY, DEMO_PROJECT_NAME)).toBe(true);
  });
});
