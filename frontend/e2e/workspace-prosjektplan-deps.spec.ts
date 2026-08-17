/**
 * Prosjektplan (workspace-tab) — avhengighetslinjer (deps) e2e.
 *
 * Dekker depsopplevelsen som ble lagt til i ProsjektplanTab:
 * ortogonale albue-forbindelser med pilspiss + startsirkel per kilde,
 * statusfarging etter kildens fremdrift, hover-chip «kilde → mål» med
 * dimming av urelaterte barer, av/på-toggle via «Flere handlinger»-menyen,
 * radankring av linjene, zoom-følging og at bar-dragging fortsatt virker
 * med linje-overlayet aktivt (pointer-events-regresjon).
 *
 * Kjør: npx playwright test workspace-prosjektplan-deps
 */
import { test, expect, type Page } from '@playwright/test';

const PLAN_ROUTE = '/workspace/sample/prosjektplan';
const CONNECTION_COUNT = 14; // 15 oppgaver i kjede → 14 forbindelser i sample-data

type DepGeom = { x: number; y: number };

/** Ruller gantt-scrolleren (den med størst scrollWidth) og bekrefter at overlayet flyttet seg. */
async function scrollGantt(page: Page, px: number) {
  return page.evaluate((offset) => {
    const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('width') === '100%')!;
    const scrollers = [...document.querySelectorAll('div')]
      .filter((d) => d.scrollWidth > d.clientWidth + 100 && /auto|scroll/.test(getComputedStyle(d).overflowX))
      .sort((a, b) => b.scrollWidth - a.scrollWidth);
    for (const sc of scrollers) {
      sc.scrollLeft = offset;
      void sc.offsetWidth; // tving reflow
      const r = svg.getBoundingClientRect();
      if (r.x < Math.abs(offset) / 2 + 100) return { ok: true, svgX: Math.round(r.x) };
    }
    return { ok: false };
  }, px);
}

/** Matcher norsk/engelsk tekst på ett sted (locale-agnostisk). */
function reFor(no: string, en: string) {
  return new RegExp(`${no}|${en}`, 'i');
}

function depsOverlay(page: Page) {
  return page.locator('svg[width="100%"]');
}

async function openProsjektplan(page: Page) {
  await page.goto(PLAN_ROUTE, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await expect(depsOverlay(page)).toBeVisible({ timeout: 90_000 });
}

/**
 * Finner et punkt som ligger PÅ stien til forbindelse nummer `gIndex`,
 * som er innenfor viewporten OG faktisk treffes av hit-testing (elementFromPoint
 * → path). Baren til mål-oppgaven er ofte videre enn linjen og ligger under
 * overlayet, og det høyre milesteinpanelet kan dekke leg 2 — så kandidatene
 * prøves i prioritert rekkefølge, og gantten scrolles til høyre som «redning»
 * dersom ingen kandidat treffes:
 * 1) pilspiss-tuppen like venstre for mål-baren
 * 2) «leg 2» et stykke ut fra pilspissen
 * 3) midten av den vertikale delen
 * 4) leg 1 nær kilden
 */
async function pointOnStroke(page: Page, gIndex = 0): Promise<DepGeom> {
  for (const scroll of [0, 950, 1900]) {
    if (scroll) {
      const moved = await scrollGantt(page, scroll);
      if (!moved.ok) throw new Error(`Gantt-scroll til ${scroll}px slo ikke an`);
    }
    const info = await page.evaluate((idx) => {
      const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('width') === '100%');
      if (!svg) return null;
      const g = svg.querySelectorAll('g')[idx];
      const path = g ? g.querySelector('path') : null;
      if (!path) return null;
      const r = svg.getBoundingClientRect();
      const m = /M ([\d.]+) ([\d.]+) H ([\d.]+) V ([\d.]+) H ([\d.]+)/.exec(path.getAttribute('d') || '');
      if (!m) return null;
      const [fromX, fromY, dropX, toY, toX] = [1, 2, 3, 4, 5].map((i) => parseFloat(m[i]));
      const onScreen = (x: number, y: number) => x > 2 && x < window.innerWidth - 2 && y > 2 && y < window.innerHeight - 2;
      return {
        rect: { x: r.x, y: r.y },
        candidates: [
          { x: toX - 2, y: toY },                                                      // pilspiss-tupp
          { x: toX + Math.min(140, (dropX - toX) / 2), y: toY },                       // leg 2-utløp
          { x: dropX, y: (fromY + toY) / 2 },                                          // vertikalen
          { x: fromX + 6, y: fromY },                                                  // leg 1
        ].filter((c) => onScreen(r.x + c.x, r.y + c.y)),
      };
    }, gIndex);
    if (!info) throw new Error(`Dep-overlay/path #${gIndex} ikke funnet`);
    for (const c of info.candidates) {
      const x = info.rect.x + c.x;
      const y = info.rect.y + c.y;
      const hit: string | null = await page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el ? el.tagName : null;
      }, { x, y });
      if (hit === 'path') return { x, y };
    }
  }
  throw new Error(`Fant ingen treffbart punkt på dep-sti #${gIndex}`);
}

async function dimmedBarCounts(page: Page) {
  return page.evaluate(() => {
    const bars = [...document.querySelectorAll('[role="slider"]')];
    const dimmed = bars.filter((b) => getComputedStyle(b).opacity === '0.3');
    const labels = dimmed.map((b) => b.getAttribute('aria-label'));
    return { total: bars.length, dimmed: dimmed.length, dimmedLabels: labels, opacities: bars.map((b) => getComputedStyle(b).opacity) };
  });
}

/**
 * Antall legend-prikker (Ferdig / I gang / Kommende) i verktøylinjen.
 * De tre prikkene står på samme y-rad; grupperer runde 8px-dots etter y og
 * finner gruppen på 3. Andre 8px-dots (f.eks. prosjektstatus i headeren)
 * står på andre rader.
 */
async function legendDotCount(page: Page) {
  return page.evaluate(() => {
    const dots = [...document.querySelectorAll('div')].filter((d) => {
      const r = d.getBoundingClientRect();
      const cs = getComputedStyle(d);
      return r.width === 8 && r.height === 8 && cs.borderRadius === '50%' && r.y < 300;
    });
    const byY = new Map<number, number>();
    for (const d of dots) {
      const y = Math.round(d.getBoundingClientRect().y);
      byY.set(y, (byY.get(y) || 0) + 1);
    }
    for (const count of byY.values()) {
      if (count >= 3) return 3;
    }
    return 0;
  });
}

test.describe('prosjektplan dependencies', () => {
  test('rendrer 14 forbindelser med statusfargede stier + startsirkler', async ({ page }) => {
    await openProsjektplan(page);

    const groups = depsOverlay(page).locator('g');
    await expect(groups).toHaveCount(CONNECTION_COUNT, { timeout: 30_000 });

    const stats = await page.evaluate(() => {
      const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('width') === '100%')!;
      const gs = [...svg.querySelectorAll('g')];
      const strokes = new Set<string>();
      let circles = 0;
      let malformed = 0;
      for (const g of gs) {
        const [main, arrow] = g.querySelectorAll('path');
        if (!main || !arrow.getAttribute('d')) malformed++;
        stroke: for (const p of g.querySelectorAll('path')) {
          const s = p.getAttribute('stroke');
          if (s) strokes.add(s);
        }
        circles += g.querySelectorAll('circle').length;
      }
      return { distinctStrokes: [...strokes], circles, malformed, gCount: gs.length };
    });

    expect(stats.malformed).toBe(0);
    expect(stats.circles).toBe(CONNECTION_COUNT);

    // Fargene skal matche legend-prikkene i verktøylinjen (→ samme tokens).
    // Normaliserer stroke-attributtet (hex) til computed-format (rgb/rgba).
    const { legendColors, normStrokes } = await page.evaluate(() => {
      const norm = (value: string) => {
        const probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        probe.style.stroke = value;
        document.body.appendChild(probe);
        const c = getComputedStyle(probe).stroke;
        probe.remove();
        return c;
      };
      const dots = [...document.querySelectorAll('div')].filter((d) => {
        const r = d.getBoundingClientRect();
        const cs = getComputedStyle(d);
        return r.width === 8 && r.height === 8 && cs.borderRadius === '50%' && r.y < 300;
      });
      const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('width') === '100%')!;
      const strokes = new Set<string>();
      for (const p of svg.querySelectorAll('g path')) {
        const s = p.getAttribute('stroke');
        if (s) strokes.add(norm(s));
      }
      return { legendColors: [...new Set(dots.map((d) => getComputedStyle(d).backgroundColor))], normStrokes: [...strokes] };
    });
    expect(legendColors.length).toBeGreaterThanOrEqual(3);
    for (const stroke of normStrokes) {
      expect(legendColors).toContain(stroke);
    }
    // Kickoff & brief er 100 % → første forbindelse skal ha «ferdig»-fargen
    expect(normStrokes[0]).toBe(legendColors[0]);
  });

  test('hover på linje viser chip «kilde → mål» og dimmer 13 av 15 barer', async ({ page }) => {
    await openProsjektplan(page);

    // Forbindelsen Kickoff & brief → Location scout har en lang synlig horisontal leg
    const pt = await pointOnStroke(page, 0);
    await page.mouse.move(pt.x, pt.y);
    await page.waitForTimeout(600);

    const chip = page.getByText('Kickoff & brief → Location scout', { exact: true }).first();
    await expect(chip).toBeVisible({ timeout: 5_000 });

    // 13 av 15 barer dimmes; kilde + mål holder seg lyse
    const { total, dimmed, dimmedLabels } = await dimmedBarCounts(page);
    expect(total).toBe(15);
    expect(dimmed).toBe(13);
    expect(dimmedLabels).not.toContain('Kickoff & brief');
    expect(dimmedLabels).not.toContain('Location scout');

    // Hovered sti får strokeWidth 2.6; urelatert linje (Location → Shotlist) fades til 0.12
    const widths = await page.evaluate(() => {
      const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('width') === '100%')!;
      const gs = svg.querySelectorAll('g');
      const hovered = getComputedStyle(gs[0].querySelector('path')).strokeWidth;
      const unrelated = getComputedStyle(gs[1].querySelector('path')).strokeOpacity;
      return { hovered, unrelated };
    });
    expect(widths.hovered).toBe('2.6px');
    expect(widths.unrelated).toBe('0.12');
  });

  test('mus ut — chip forsvinner og alle barer gjenopprettes', async ({ page }) => {
    await openProsjektplan(page);

    const pt = await pointOnStroke(page, 0);
    await page.mouse.move(pt.x, pt.y);
    await page.waitForTimeout(500);
    await page.mouse.move(4, 4);
    await page.waitForTimeout(500);

    const { dimmed } = await dimmedBarCounts(page);
    expect(dimmed).toBe(0);

    const width0 = await page.evaluate(() => {
      const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('width') === '100%')!;
      return getComputedStyle(svg.querySelectorAll('g')[0].querySelector('path')).strokeWidth;
    });
    expect(width0).toBe('1.8px');
  });

  test('av/på-toggle via «Flere handlinger» skjuler og viser linjer + legend', async ({ page }) => {
    await openProsjektplan(page);

    await page.getByRole('button', { name: reFor('Flere handlinger', 'More actions') })
      .first()
      .click();

    // Legend (Ferdig / I gang / Kommende) er synlig i toolbar når deps er på
    expect(await legendDotCount(page)).toBe(3);

    await page.getByText(reFor('Vis avhengigheter', 'Show dependencies')).click();

    await expect(depsOverlay(page)).toHaveCount(0, { timeout: 10_000 });
    expect(await legendDotCount(page)).toBe(0);

    // Skru på igjen
    await page.getByRole('button', { name: reFor('Flere handlinger', 'More actions') })
      .first()
      .click();
    await page.getByText(reFor('Vis avhengigheter', 'Show dependencies')).click();
    await expect(depsOverlay(page)).toHaveCount(1, { timeout: 10_000 });
    await expect(depsOverlay(page).locator('g')).toHaveCount(CONNECTION_COUNT);
    expect(await legendDotCount(page)).toBe(3);
  });

  test('linjene er radankret — leg 2 y = midten av mål-oppgavens rad', async ({ page }) => {
    await openProsjektplan(page);

    const { legYViewport, labelMid } = await page.evaluate(() => {
      const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('width') === '100%')!;
      const r = svg.getBoundingClientRect();
      const m = /M [\d.]+ [\d.]+ H [\d.]+ V ([\d.]+) H [\d.]+/.exec(svg.querySelectorAll('g')[0].querySelector('path').getAttribute('d') || '');
      const legY = r.y + parseFloat(m![1]);
      const label = [...document.querySelectorAll('div')].find((d) => d.textContent?.trim() === 'Location scout');
      const lr = label!.getBoundingClientRect();
      return { legYViewport: legY, labelMid: lr.y + lr.height / 2 };
    });

    expect(Math.abs(legYViewport - labelMid)).toBeLessThanOrEqual(1.5);
  });

  test('zoom til Måned — geometri følger med og hover fungerer fortsatt', async ({ page }) => {
    await openProsjektplan(page);

    await page.getByRole('button', { name: reFor('Måned', 'Month'), exact: true }).click();
    await expect(depsOverlay(page).locator('g')).toHaveCount(CONNECTION_COUNT, { timeout: 15_000 });

    const pt = await pointOnStroke(page, 0);
    await page.mouse.move(pt.x, pt.y);
    await page.waitForTimeout(600);

    const chip = page.getByText('Kickoff & brief → Location scout', { exact: true }).first();
    await expect(chip).toBeVisible({ timeout: 5_000 });
  });

  test('bar-dragging fortsatt mulig med linje-overlay aktivt', async ({ page }) => {
    await openProsjektplan(page);

    // «Location scout»-baren er bred og ligger under leg 2 til Kickoff-linjen.
    // Ruller gantten litt til høyre og drar fra et punkt som er på baren,
    // men utenfor alle dep-strekene (og utenfor milesteinpanelet til høyre).
    const moved = await scrollGantt(page, 1000);
    if (!moved.ok) throw new Error('Gantt-scroll slo ikke an');

    const dragStart = await page.evaluate(() => {
      const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('width') === '100%')!;
      const r = svg.getBoundingClientRect();
      const m = /H ([\d.]+) V ([\d.]+) H ([\d.]+)/.exec(svg.querySelectorAll('g')[0].querySelector('path').getAttribute('d') || '');
      const toY = r.y + parseFloat(m![2]);
      const legEndX = r.x + parseFloat(m![1]); // dropX — høyre ende av leg 2
      return { y: toY, x: legEndX + 40 };
    });

    // Bekreft at startpunktet faktisk ligger på mål-baren
    const onBar = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? Boolean(el.closest('[aria-label="Location scout"]')) : false;
    }, dragStart);
    expect(onBar).toBe(true);

    const bar = page.getByRole('slider', { name: 'Location scout' });
    const before = await bar.boundingBox();
    if (!before) throw new Error('Bar ikke funnet');

    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    await page.mouse.move(dragStart.x + 40, dragStart.y, { steps: 6 });
    await page.waitForTimeout(300);

    // Sample-prosjektet lagrer ikke onUpdate → baren snapper tilbake ved pointerup.
    // Derfor måler vi forflytningen mens draget er aktivt (live-posisjon).
    const duringDrag = await bar.boundingBox();
    expect(duringDrag).not.toBeNull();
    expect((duringDrag as { x: number }).x - before.x).toBeGreaterThanOrEqual(22);

    await page.mouse.up();
    await page.waitForTimeout(400); // left-transition 0.18s
  });
});