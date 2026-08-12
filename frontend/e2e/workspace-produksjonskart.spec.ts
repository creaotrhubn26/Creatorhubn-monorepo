/**
 * Produksjonskart (workspace-tab) — e2e for den omarbeidede Production Map:
 * tre EKTE visninger (Timeline / Board / Kart) via tab-pillene, dato-navigasjon
 * med chevroner, statusfilter via Filtre-menyen, ansvarlig-kolonne, «Se alle»-
 * navigasjon til shotlist/moodboard, hurtignotat-lås på sample, død bilde-tile
 * fjernet fra Dagens fokus og mobil-oppførsel (ingen horisontal page-overflow,
 * kart har intern scroll).
 *
 * Kjør: npx playwright test workspace-produksjonskart
 */
import { test, expect } from '@playwright/test';

const ROUTE = '/workspace/sample/produksjonskart';

async function openTab(page: import('@playwright/test').Page) {
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await expect(page.getByText('Production Map')).toBeVisible({ timeout: 90_000 });
}

test('rendrer topp-kort og 6 sample-rader i Timeline', async ({ page }) => {
  await openTab(page);

  await expect(page.getByText('Dagens fokus')).toBeVisible();
  await expect(page.getByText('Crew på location')).toBeVisible();
  await expect(page.getByText('Vær & logistikk')).toBeVisible();
  await expect(page.getByText('Team Sync')).toBeVisible();

  await expect(page.getByText('6 / 8')).toBeVisible();
  await expect(page.getByText('12:15 – 13:00').first()).toBeVisible();

  const moments = ['Forberedelser', 'First look', 'Vielse', 'Familiebilder', 'Golden hour', 'Taler'];
  for (const m of moments) {
    await expect(page.getByText(m).first()).toBeVisible();
  }
  await expect(page.getByText('Daniel (Foto)').first()).toBeVisible();

  await expect(page.locator('[role="tab"]')).toHaveText(['Timeline', 'Board', 'Kart']);
});

test('pillene bytter mellom tre EKTE visninger', async ({ page }) => {
  await openTab(page);

  await page.getByRole('tab', { name: 'Board' }).click();
  const cols = await page.locator('[data-ws-board]').evaluateAll((els) => els.map((e) => e.getAttribute('data-ws-board')));
  expect(cols).toEqual(['kritisk', 'pågår', 'planlagt', 'ferdig']);
  await expect(page.locator('[data-ws-board="kritisk"] [data-ws-board-card]')).toHaveCount(1);
  await expect(page.locator('[data-ws-board="pågår"] [data-ws-board-card]')).toHaveCount(1);
  await expect(page.locator('[data-ws-board="planlagt"] [data-ws-board-card]')).toHaveCount(2);
  await expect(page.locator('[data-ws-board="ferdig"] [data-ws-board-card]')).toHaveCount(2);
  await expect(page.locator('[data-ws-board-card]')).toHaveText([/Vielse/, /Familiebilder/, /Golden hour/, /Taler/, /Forberedelser/, /First look/]);

  await page.getByRole('tab', { name: 'Kart' }).click();
  await expect(page.locator('[data-ws-lane]')).toHaveText(['Hjemme', 'Privat location', 'Kirken', 'Location 2', 'Festsalen']);
  await expect(page.locator('[data-ws-kart-block]')).toHaveCount(6);
  await expect(page.locator('[data-ws-lane-track="Kirken"] [data-ws-kart-block]')).toHaveCount(2);

  await page.getByRole('tab', { name: 'Timeline' }).click();
  await expect(page.getByText('Forberedelser').first()).toBeVisible();
  await expect(page.locator('[data-ws-board-card]')).toHaveCount(0);
  await expect(page.locator('[data-ws-kart-block]')).toHaveCount(0);
});

test('chevronene navigerer dato forover og bakover', async ({ page }) => {
  await openTab(page);

  await expect(page.getByText('Lørdag 24. mai 2025')).toBeVisible();

  await page.getByRole('button', { name: 'Neste dag' }).click();
  await expect(page.getByText('Søndag 25. mai 2025')).toBeVisible();

  await page.getByRole('button', { name: 'Neste dag' }).click();
  await expect(page.getByText('Mandag 26. mai 2025')).toBeVisible();

  await page.getByRole('button', { name: 'Forrige dag' }).click();
  await expect(page.getByText('Søndag 25. mai 2025')).toBeVisible();

  await page.getByRole('button', { name: 'Forrige dag' }).click();
  await expect(page.getByText('Lørdag 24. mai 2025')).toBeVisible();
});

test('Filtre-menyen filtrerer rader på status', async ({ page }) => {
  await openTab(page);

  await page.getByRole('button', { name: /Filtre/ }).click();
  await page.getByRole('menuitem', { name: 'Ferdig' }).click();

  await expect(page.getByRole('button', { name: 'Filtre · Ferdig' })).toBeVisible();
  await expect(page.getByText('Forberedelser', { exact: true })).toBeVisible();
  await expect(page.getByText('First look', { exact: true })).toBeVisible();
  await expect(page.getByText('Familiebilder', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Taler', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Golden hour', { exact: true })).toHaveCount(1); // kun i «Kritiske øyeblikk»-kortet
  await expect(page.getByText('Vielse', { exact: true })).toHaveCount(2); // fokus-kort + «Kritiske øyeblikk»

  await page.getByRole('button', { name: 'Filtre · Ferdig' }).click();
  await page.getByRole('menuitem', { name: 'Alle' }).click();
  await expect(page.getByRole('button', { name: 'Filtre', exact: true })).toBeVisible();
  await expect(page.getByText('Taler', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Vielse', { exact: true })).toHaveCount(3);
});

test('filteret gjelder også i Board-visningen', async ({ page }) => {
  await openTab(page);
  await page.getByRole('tab', { name: 'Board' }).click();

  await page.getByRole('button', { name: /Filtre/ }).click();
  await page.getByRole('menuitem', { name: 'Planlagt' }).click();

  await expect(page.locator('[data-ws-board-card]')).toHaveCount(2);
  await expect(page.locator('[data-ws-board="planlagt"] [data-ws-board-card]')).toHaveCount(2);
  await expect(page.locator('[data-ws-board="ferdig"] [data-ws-board-card]')).toHaveCount(0);
  await expect(page.locator('[data-ws-board="kritisk"] [data-ws-board-card]')).toHaveCount(0);
});

test('«Se alle» navigerer til shotlist og moodboard', async ({ page }) => {
  await openTab(page);

  await page.getByRole('button', { name: 'Se alle' }).first().click();
  await page.waitForURL('**/workspace/sample/shotlist', { timeout: 30_000 });
  await page.goBack();
  await expect(page.getByText('Production Map')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Se alle' }).last().click();
  await page.waitForURL('**/workspace/sample/moodboard', { timeout: 30_000 });
  await page.goBack();
  await expect(page.getByText('Production Map')).toBeVisible({ timeout: 30_000 });
});

test('hurtignotat er låst på sample, og Dagens fokus har ingen død opplastings-tile', async ({ page }) => {
  await openTab(page);

  await expect(page.getByRole('textbox', { name: 'Skriv en rask notat…' })).toBeDisabled();
  await expect(page.locator('button', { hasText: 'Legg til' })).toBeDisabled();

  await expect(page.locator('button', { hasText: 'Bilde' })).toHaveCount(0); // ingen død tile
  await expect(page.getByText('Legg til').first()).toBeVisible(); // referanse-rutenettet har sin tile
});

test('mobil 390px: ingen page-overflow, kartet scroller internt', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openTab(page);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole('tab', { name: 'Kart' }).click();
  const scroller = await page.evaluate(() => {
    const el = document.querySelector('[data-ws-lane-track]');
    let node: HTMLElement | null = el;
    while (node) {
      if (node.scrollWidth > node.clientWidth + 50) return { internal: true, scrollable: node.scrollWidth - node.clientWidth };
      node = node.parentElement;
    }
    return { internal: false };
  });
  expect(scroller.internal).toBe(true);

  const pageOverflowKart = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(pageOverflowKart).toBeLessThanOrEqual(0);
});

test('status kan endres via pillen, og Board-kolonnen flytter kortet', async ({ page }) => {
  await openTab(page);

  await page.locator('[aria-label="Endre status for Familiebilder"]').click();
  await page.getByRole('menuitem', { name: 'Ferdig' }).click();
  await expect(page.locator('[aria-label="Endre status for Familiebilder"]')).toContainText('Ferdig');

  await page.getByRole('tab', { name: 'Board' }).click();
  await expect(page.locator('[data-ws-board="ferdig"] [data-ws-board-card]')).toHaveCount(3);
  await expect(page.locator('[data-ws-board="pågår"] [data-ws-board-card]')).toHaveCount(0);

  await page.locator('[data-ws-board="ferdig"] [aria-label="Endre status for Familiebilder"]').click();
  await page.getByRole('menuitem', { name: 'Pågår' }).click();
  await expect(page.locator('[data-ws-board="pågår"] [data-ws-board-card]')).toHaveCount(1);
  await expect(page.locator('[data-ws-board="ferdig"] [data-ws-board-card]')).toHaveCount(2);
});

test('ny hendelse dukker opp i alle tre visninger', async ({ page }) => {
  await openTab(page);

  await page.getByRole('button', { name: 'Ny hendelse' }).click();
  await page.getByLabel('Tittel').fill('Lydsjekk kirken');
  await page.getByLabel('Klokkeslett').fill('09:15');
  await page.getByLabel('Varighet').fill('30');
  await page.getByLabel('Sted').fill('Kirken');
  await page.getByRole('button', { name: 'Lagre' }).click();

  await expect(page.getByText('Lydsjekk kirken', { exact: true })).toBeVisible();
  await expect(page.getByText('09:15 – 09:45', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Board' }).click();
  await expect(page.locator('[data-ws-board="planlagt"] [data-ws-board-card]')).toHaveCount(3);

  await page.getByRole('tab', { name: 'Kart' }).click();
  await expect(page.locator('[data-ws-kart-block]')).toHaveCount(7);
  await expect(page.locator('[data-ws-lane-track="Kirken"] [data-ws-kart-block]')).toHaveCount(3);
});

test('radklikk åpner rediger-dialog, og hendelser kan slettes', async ({ page }) => {
  await openTab(page);

  await page.getByText('Golden hour', { exact: true }).first().click();
  await expect(page.getByRole('dialog')).toContainText('Rediger hendelse');
  await page.getByLabel('Tittel').fill('Golden hour v2');
  await page.getByRole('button', { name: 'Lagre' }).click();

  await expect(page.getByText('Golden hour v2', { exact: true })).toBeVisible();
  await expect(page.getByText('Golden hour', { exact: true })).toHaveCount(1); // kun «Kritiske øyeblikk»-kortet

  await page.getByText('Golden hour v2', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Slett hendelse' }).click();
  await expect(page.getByText('Golden hour v2', { exact: true })).toHaveCount(0);
  await expect(page.locator('[role="button"][aria-label^="Endre status for"]')).toHaveCount(5);
});

test('«Vær & logistikk»-kortet åpner modal med vær- og logistikkdetaljer', async ({ page }) => {
  await openTab(page);

  await page.getByRole('button', { name: 'Åpne vær- og logistikkdetaljer' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('Vær & logistikk');
  await expect(modal).toContainText('17 °C');
  await expect(modal).toContainText('Delvis skyet');
  await expect(modal).toContainText('De neste dagene');
  await expect(modal).toContainText('Logistikk');
  await expect(modal).toContainText('Vielse');
  await expect(modal).toContainText('Holmenkollveien 58'); // adresse til Kirken
  await expect(modal).toContainText('Crew: Mia Solberg (Fotograf)'); // crew på Kirken
  await expect(modal).toContainText('yr.no');

  await page.getByRole('button', { name: 'Lukk' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Team Sync-kortet åpner modal med framdrift og crew', async ({ page }) => {
  await openTab(page);

  await page.getByRole('button', { name: 'Åpne team-synk-detaljer' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('Team Sync');
  await expect(modal).toContainText('Framdrift');
  await expect(modal).toContainText('82%');
  await expect(modal).toContainText('Oppgaver fullført');
  await expect(modal).toContainText('Crew');
  await expect(modal).toContainText('Mia Solberg');
  await expect(modal).toContainText('online');
  await expect(modal).toContainText('sist innlogget for 22 t siden'); // Nora (sample-demo)
  await expect(modal).toContainText('sist innlogget aldri sett'); // Sander/Ola uten presence

  await page.getByRole('button', { name: 'Lukk' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});