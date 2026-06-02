/**
 * Demo-opptak (ikke en assertion-test) — kjører gjennom content-producer-flyten
 * og spiller inn video + screenshots, etter docs/role-room/marketing-plan-demo-script.md.
 *
 * Kjør: npx playwright test e2e/marketing-plan-demo-recording.spec.ts --project=chromium
 * Video havner i test-results/…/video.webm; screenshots i demo-artifacts/.
 *
 * NB: harnessen er backend-fri, så ekte AI-generering + thumbnails (som krever
 * innlogget backend) vises ikke. Opptaket dekker UI-flatene: stepper,
 * fase-fullføring, Markedsplan-fane og tom-tilstand.
 */
import { test, type Page } from '@playwright/test';

test.use({
  viewport: { width: 1280, height: 720 },
  video: { mode: 'on', size: { width: 1280, height: 720 } },
});

const HARNESS = '/e2e-casting-test.html?session=content-producer&mode=content_producer';
const SHOTS = 'demo-artifacts';

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

async function pause(page: Page, ms = 1200) {
  await page.waitForTimeout(ms);
}

test('demo-opptak: content-producer markedsplan-flyt', async ({ page }) => {
  test.setTimeout(120_000);

  // Scene 1 — åpne harness + opprett demo-prosjektet
  await page.goto(HARNESS, { waitUntil: 'load', timeout: 60_000 });
  await page.getByRole('button', { name: 'Nytt prosjekt' }).waitFor({ timeout: 30_000 });
  await shot(page, '01-harness');
  await pause(page);

  await page.getByRole('button', { name: 'Nytt prosjekt' }).click();
  await page.getByRole('button', { name: 'Last demo' }).click();
  await pause(page, 800);
  await page.getByRole('textbox', { name: 'Telefon *' }).fill('+47 51 99 00 00');
  await shot(page, '02-demo-utfylt');
  await page.getByRole('button', { name: 'Fortsett til oppsummering' }).click();
  await page.getByRole('button', { name: 'Opprett prosjekt' }).click();
  await page.getByRole('button', { name: 'Bekreft og opprett' }).click();
  await pause(page, 2500);
  await shot(page, '03-prosjekt-opprettet');

  // Scene 2 — workflow-stepperen + fase-fullføring (#23)
  const leveringStep = page.getByRole('button', { name: /Levering/ }).first();
  if (await leveringStep.isVisible().catch(() => false)) {
    await leveringStep.click();
    // Vent eksplisitt på fullføring-baren så den fanges pålitelig.
    const markComplete = page.getByRole('button', { name: /Marker levering som fullført/i }).first();
    await markComplete.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
    await pause(page, 1200);
    await shot(page, '04-levering-fullforing-bar');
    if (await markComplete.isVisible().catch(() => false)) {
      await markComplete.click();
      await page.getByRole('button', { name: /^Angre$/ }).first()
        .waitFor({ state: 'visible', timeout: 6_000 }).catch(() => undefined);
      await pause(page, 1000);
      await shot(page, '05-levering-markert-fullfort');
    }
  }

  // Scene 3 — naviger inn i Prosjektrom (der workspace-nav-en med Markedsføring-
  // seksjonen + Markedsplan-siden bor) og åpne Markedsplan-fanen.
  const prosjektrom = page.getByText('Prosjektrom', { exact: true }).first();
  if (await prosjektrom.isVisible().catch(() => false)) {
    await prosjektrom.click().catch(() => undefined);
    await pause(page, 1800);
    await shot(page, '06-prosjektrom');
  }

  // Logg hvilke nav-etiketter som faktisk er synlige (hjelper feilsøking).
  const navLabels = await page.evaluate(() => {
    const texts = new Set<string>();
    document.querySelectorAll('button, [role="tab"], a').forEach((el) => {
      const t = (el.textContent ?? '').trim();
      if (t && t.length < 30) texts.add(t);
    });
    return Array.from(texts);
  });
  console.log('NAV-LABELS:', JSON.stringify(navLabels));

  // Markedsføring-seksjonen kan måtte utvides først.
  const marketingSection = page.getByText('Markedsføring', { exact: false }).first();
  if (await marketingSection.isVisible().catch(() => false)) {
    await marketingSection.click().catch(() => undefined);
    await pause(page, 800);
    await shot(page, '07-markedsforing-seksjon');
  }

  const markedsplanTab = page.getByText('Markedsplan', { exact: true }).first();
  if (await markedsplanTab.isVisible().catch(() => false)) {
    await markedsplanTab.click().catch(() => undefined);
    await pause(page, 1800);
    await shot(page, '08-markedsplan-fane');

    // Tom-tilstand → trigg generering for å vise fremdrifts-komponenten.
    const generate = page.getByRole('button', { name: /Generer (en )?plan|Generer 30/i }).first();
    if (await generate.isVisible().catch(() => false)) {
      await generate.click().catch(() => undefined);
      await pause(page, 1500);
      await shot(page, '09-generering-fremdrift');
    }
  }

  // Sluttbilde
  await pause(page, 800);
  await shot(page, '10-slutt');
});
