/**
 * Produksjonskart — EKTE prosjekt (e2e mot dev-DB og ekte API).
 *
 * Krever: backend på :3003 (npm run dev i backend/), vite på :5001 og en
 * session for prosjekteieren i creatorhub_auth_sessions (se NOTAT nederst).
 * Token/prosjekt kan overstyres med E2E_REAL_TOKEN / E2E_REAL_PROJECT.
 *
 * Kjør: npx playwright test workspace-produksjonskart-real
 */
import { test, expect } from '@playwright/test';

const PROJECT_ID = process.env.E2E_REAL_PROJECT || '1e9d8333-f892-4643-8694-0eb727f32615';
const SESSION_TOKEN =
  process.env.E2E_REAL_TOKEN ||
  '4e0161b08c464151a42b9e01e3129d48b12bd09584338e6fed371fa40a153bf8';
const OWNER = {
  id: '43724096-0b81-4f0b-b819-a52c24e1bfeb',
  email: 'qazifotoreel@gmail.com',
  name: 'Qazi Foto',
  role: 'photographer',
  profession: 'photographer',
};
const UNIQUE_TITLE = `E2E Testhendelse ${Date.now() % 100000}`;

async function openRealTab(page: import('@playwright/test').Page) {
  await page.addInitScript(
    ([tok, user]) => {
      window.localStorage.setItem('creatorhub_auth_token', tok);
      window.localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
    },
    [SESSION_TOKEN, OWNER],
  );
  await page.goto(`/workspace/${PROJECT_ID}/produksjonskart`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await expect(page.getByText('Production Map')).toBeVisible({ timeout: 90_000 });
}

test('ekte hendelser rendres fra API-et i alle tre visninger', async ({ page }) => {
  await openRealTab(page);

  await expect(page.getByText('Forberedelser brud', { exact: true }).first()).toBeVisible();
  const total = await page.locator('[role="button"][aria-label^="Endre status for"]').count();
  expect(total).toBeGreaterThanOrEqual(23);
  await expect(page.getByText('Holmenkollen Kapell', { exact: true }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Board' }).click();
  await expect(page.locator('[data-ws-board-card]')).toHaveCount(total);

  await page.getByRole('tab', { name: 'Kart' }).click();
  await expect(page.locator('[data-ws-kart-block]')).toHaveCount(total);
  await expect(page.locator('[data-ws-lane="Holmenkollen Kapell"]')).toHaveCount(1);
});

test('status-endring persisteres via PUT og reverteres', async ({ page }) => {
  await openRealTab(page);

  const pill = page.locator('[aria-label="Endre status for Forberedelser brud"]');
  await expect(pill).toContainText('Planlagt');

  await pill.click();
  await page.getByRole('menuitem', { name: 'Pågår' }).click();
  await expect(pill).toContainText('Pågår', { timeout: 20_000 });

  await pill.click();
  await page.getByRole('menuitem', { name: 'Planlagt' }).click();
  await expect(pill).toContainText('Planlagt', { timeout: 20_000 });
});

test('Vær & logistikk-modalen henter YR-data og viser logistikk', async ({ page }) => {
  await openRealTab(page);

  await page.getByRole('button', { name: 'Åpne vær- og logistikkdetaljer' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('Vær & logistikk');
  await expect(modal).toContainText('Vær nå');
  await expect(modal).toContainText(/°C|Kunne ikke hente værdata/);
  await expect(modal).toContainText('De neste dagene');
  await expect(modal).toContainText('Logistikk');
  await expect(modal).toContainText('Forberedelser brud');
  await expect(modal).toContainText(/Kongeveien 26|Holmenkollveien 58|Rådhusplassen 1/); // ekte adresse fra wedding_locations
  await expect(modal).toContainText(/Crew: Jonas Vik \(Videograf\)|Crew: Emilie Strand \(Lydtekniker\)|Crew: Nora Berg \(Editor\)/); // crew fra wedding_location_crew
  await expect(modal).toContainText('yr.no');

  await page.getByRole('button', { name: 'Lukk' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Team Sync-modalen henter ekte crew og framdrift', async ({ page }) => {
  await openRealTab(page);

  await page.getByRole('button', { name: 'Åpne team-synk-detaljer' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('Team Sync');
  await expect(modal).toContainText('Framdrift');
  await expect(modal).toContainText('Crew');
  await expect(modal).toContainText(/Mia Solberg|Jonas Vik|Emilie Strand|Nora Berg/); // ekte teammedlemmer fra project_team_members
  await expect(modal).toContainText('Qazi FotoReel'); // eier fra projects
  await expect(modal).toContainText('sist innlogget'); // lastSeen fra user_presence
  await expect(modal).toContainText('sist innlogget aldri sett'); // medlemmer uten presence

  await page.getByRole('button', { name: 'Lukk' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('ny hendelse → rediger → slett (full CRUD-løkke mot ekte API)', async ({ page }) => {
  await openRealTab(page);

  const baseline = await page.locator('[role="button"][aria-label^="Endre status for"]').count();

  // Legg til
  await page.getByRole('button', { name: 'Ny hendelse' }).click();
  await page.getByLabel('Tittel').fill(UNIQUE_TITLE);
  await page.getByLabel('Klokkeslett').fill('09:15');
  await page.getByLabel('Varighet').fill('30');
  await page.getByLabel('Sted').fill('Teststed');
  await page.getByRole('button', { name: 'Lagre' }).click();

  const rowByTitle = (t: string) =>
    page.getByRole('button', { name: `Endre status for ${t}`, exact: true }).locator('xpath=ancestor::div[@data-ws-table-row]');

  const row = rowByTitle(UNIQUE_TITLE);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[role="button"][aria-label^="Endre status for"]')).toHaveCount(baseline + 1);

  await page.getByRole('tab', { name: 'Board' }).click();
  await expect(page.locator('[data-ws-board-card]')).toHaveCount(baseline + 1);
  await page.getByRole('tab', { name: 'Kart' }).click();
  await expect(page.locator('[data-ws-kart-block]')).toHaveCount(baseline + 1);
  await page.getByRole('tab', { name: 'Timeline' }).click();

  // Rediger
  await row.click();
  await expect(page.getByRole('dialog')).toContainText('Rediger hendelse');
  await page.getByLabel('Tittel').fill(`${UNIQUE_TITLE} v2`);
  await page.getByLabel('Sted').fill('Teststed 2');
  await page.getByRole('button', { name: 'Lagre' }).click();

  const row2 = rowByTitle(`${UNIQUE_TITLE} v2`);
  await expect(row2).toBeVisible({ timeout: 20_000 });
  await expect(rowByTitle(UNIQUE_TITLE)).toHaveCount(0);

  // Slett
  await row2.click();
  await page.getByRole('button', { name: 'Slett hendelse' }).click();
  await expect(row2).toHaveCount(0, { timeout: 20_000 });
  await expect(page.locator('[role="button"][aria-label^="Endre status for"]')).toHaveCount(baseline);
});

/*
 * NOTAT (dev-oppsett): sessionen for prosjekteieren opprettes med:
 *   INSERT INTO creatorhub_auth_sessions (token, session_data, updated_at, expires_at)
 *   VALUES ('<32-byte hex>',
 *     '{"userId":"43724096-0b81-4f0b-b819-a52c24e1bfeb","email":"qazifotoreel@gmail.com",
 *       "name":"Qazi Foto","role":"photographer","profession":"photographer",...}',
 *     NOW(), NOW() + INTERVAL '1 day');
 * og backend restartes så tokenet hydreres inn i activeSessions.
 */
