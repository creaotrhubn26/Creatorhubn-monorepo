import { expect, test, type Page } from '@playwright/test';

/**
 * Lokasjonsanalysen ved telefonbredde. @mobile
 *
 * Overleveringen 14. september 2026 meldte «horisontal overflow og avkuttet
 * innhold» ved 390 px i den åpne lokasjonsanalysen. Dette er flaten en
 * location scout åpner stående ute, på det eneste apparatet hun har med seg,
 * så en side som må dras sidelengs for å leses er ikke en detalj.
 *
 * Testen måler faktisk layout, ikke CSS-intensjoner, og går gjennom hver
 * tilstand dialogen kan stå i: hvert analysefilter og redigeringsmodus.
 * Tabeller og diagrammer får stikke ut inne i sin egen `overflow-x`-beholder,
 * slik normal responsiv praksis tillater; alt annet skal holde seg innenfor.
 */

const PRESETS = ['Alle', 'Tech Scout', 'Tillatelser', 'Vær-risiko', 'Tilgang'];

async function assertFitsViewport(page: Page, state: string): Promise<void> {
  const result = await page.evaluate(() => {
    const scrollable = (element: Element): boolean => {
      for (let node: Element | null = element; node; node = node.parentElement) {
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') return true;
      }
      return false;
    };
    const limit = window.innerWidth + 1;
    const offenders = [...document.querySelectorAll('[role="dialog"] *')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.right > limit && !scrollable(element);
      })
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        right: Math.round(element.getBoundingClientRect().right),
        text: (element.textContent || '').trim().slice(0, 60),
      }));
    return {
      offenders,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    };
  });

  expect(result.offenders, `${state}: elementer utenfor skjermen`).toEqual([]);
  // 1 px slingringsmonn for avrunding mot devicePixelRatio.
  expect(result.scrollWidth, `${state}: siden kan dras sidelengs`)
    .toBeLessThanOrEqual(result.clientWidth + 1);
}

test.describe('@mobile lokasjonsanalyse', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e-location-analysis.html', { waitUntil: 'load', timeout: 60_000 });
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
    // Scorene kommer først når analysen er regnet ut; uten dem måler vi en
    // tommere flate enn den scouten faktisk ser.
    await expect(page.getByText('KLARHETS-SCORE')).toBeVisible({ timeout: 30_000 });
  });

  test('holder seg innenfor skjermen i hvert analysefilter', async ({ page }) => {
    for (const preset of PRESETS) {
      await page.getByRole('button', { name: preset, exact: true }).first().click();
      await page.waitForTimeout(250);
      await assertFitsViewport(page, `filter «${preset}»`);
    }
  });

  test('holder seg innenfor skjermen i redigeringsmodus', async ({ page }) => {
    await page.getByRole('button', { name: 'Rediger analyse' }).click();
    await expect(page.getByRole('button', { name: 'Lukk redigering' })).toBeVisible({ timeout: 15_000 });
    await assertFitsViewport(page, 'redigering åpen');
  });

  test('gir hver knapp et treffområde på minst 44 px', async ({ page }) => {
    // Samme bruker, samme situasjon: hansker, vind og en telefon i én hånd.
    const tooSmall = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')]
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.height < 44;
      })
      .slice(0, 8)
      .map((button) => ({
        tekst: (button.textContent || button.getAttribute('aria-label') || '').trim().slice(0, 40),
        hoyde: Math.round(button.getBoundingClientRect().height),
      })));
    expect(tooSmall, 'knapper under 44 px høyde').toEqual([]);
  });
});
