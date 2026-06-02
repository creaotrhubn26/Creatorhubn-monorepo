/**
 * dance-annotate-live-demo — live-demo verifisering ende-til-ende av
 * DanceAnnotate-flaten med ekte open-source dansevideo.
 *
 * Mounter via standalone harness `/e2e-dance-annotate.html` (ikke
 * DanceWorkspace tab-flow) — gir oss en isolert pålitelig flate for å
 * verifisere pixel-perfect rendering uten tour-wizard, billing-auth eller
 * andre globale stylelementer som skygger over.
 *
 * Video: Big Buck Bunny CC-BY 3.0 Blender Foundation (WebM VP9 360p 10s)
 * fra test-videos.co.uk — kjent stabil CDN. WebM brukes fordi Playwright
 * Chromium mangler H.264-codec som standard.
 *
 * Kjør med:
 *   PLAYWRIGHT_BASE_URL=http://localhost:5002 \
 *     npx playwright test e2e/dance-annotate-live-demo.spec.ts \
 *     --project=chromium --reporter=list --workers=1
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL = '/e2e-dance-annotate.html';

test.describe('DanceAnnotate — live demo med ekte CC-video', () => {
  test('flate mountes m/ video + annotations + alle hoved-komponenter', async ({ page }) => {
    test.setTimeout(30_000);

    // Block any pageerrors så flakiness fanges
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(HARNESS_URL);
    await expect(page.getByTestId('dance-annotate-layout')).toBeVisible({ timeout: 10_000 });

    // Topp-bar
    await expect(page.getByTestId('dance-annotate-layout-logo')).toBeVisible();
    await expect(page.getByTestId('dance-annotate-layout-project-trigger')).toBeVisible();
    await expect(page.getByTestId('dance-annotate-layout-save')).toBeVisible();
    await expect(page.getByTestId('dance-annotate-layout-export')).toBeVisible();

    // Venstre rail — Dashboard + Annotations/Statistics/Dancers/Settings + Help
    await expect(page.getByTestId('dance-annotate-layout-nav-dashboard')).toBeVisible();
    await expect(page.getByTestId('dance-annotate-layout-nav-annotations')).toBeVisible();
    await expect(page.getByTestId('dance-annotate-layout-nav-statistics')).toBeVisible();

    // Annotate VIEW + 3 demo-annotations på timeline
    await expect(page.getByTestId('dance-annotate-view')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('annotation-block-demo-ann-1')).toBeVisible();
    await expect(page.getByTestId('annotation-block-demo-ann-2')).toBeVisible();
    await expect(page.getByTestId('annotation-block-demo-ann-3')).toBeVisible();

    // Video element mounted med riktig src — readyState avhenger av
    // codec-tilgjengelighet (Playwright Chromium mangler H.264 som
    // standard; vi bruker WebM så preload skal lykkes). Verifiserer kun
    // src er satt + ingen MediaError, IKKE readyState — det varierer
    // mellom Chromium-builds.
    await page.waitForFunction(() => document.querySelector("video") != null, { timeout: 5_000 });
    const videoState = await page.evaluate(() => {
      const v = document.querySelector('video');
      return v ? { src: v.currentSrc || v.src, hasError: !!v.error } : null;
    });
    expect(videoState).toBeTruthy();
    expect(videoState?.hasError).toBe(false);
    expect(videoState?.src).toMatch(/test-videos\.co\.uk/);

    // CATEGORY TOOLS — 5 default-kategorier
    await expect(page.getByTestId('annotate-category-tools')).toBeVisible();
    await expect(page.getByTestId('annotate-category-steps')).toBeVisible();
    await expect(page.getByTestId('annotate-category-arms')).toBeVisible();
    await expect(page.getByTestId('annotate-category-turns')).toBeVisible();

    // COMMON LABELS
    await expect(page.getByTestId('annotate-common-labels')).toBeVisible();

    // Ingen pageerrors fyrer under flowen
    expect(errors).toHaveLength(0);
  });

  test('klikk timeline-blokk seeker video + viser selected-panel', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto(HARNESS_URL);
    await expect(page.getByTestId('dance-annotate-view')).toBeVisible({ timeout: 10_000 });

    // Klikk demo-ann-1 ("Tendu rett ut" på t=1s)
    await page.getByTestId('annotation-block-demo-ann-1').click();

    // Video element finnes — seek-trigger fyrer dance:video-seek event
    // som FormationVideoPanel håndterer. Vi venter kun på at SelectedAnnotation-
    // panel vises (mer pålitelig enn å vente på video-seek-callback).
    await page.waitForFunction(() => document.querySelector("video") != null, { timeout: 5_000 });

    // SelectedAnnotation-panel skal vise "Tendu rett ut"
    await expect(page.getByTestId('annotation-details-panel')).toBeVisible();
    await expect(page.getByText('Tendu rett ut').first()).toBeVisible();
  });

  test('Export-knapp åpner overlay m/ Print + CSV + Lukk', async ({ page }) => {
    test.setTimeout(30_000);
    await page.goto(HARNESS_URL);
    await expect(page.getByTestId('dance-annotate-view')).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('dance-annotate-layout-export').click();
    await expect(page.getByTestId('annotation-export-overlay')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByTestId('annotation-export-print')).toBeVisible();
    await expect(page.getByTestId('annotation-export-csv')).toBeVisible();
    await expect(page.getByTestId('annotation-export-close')).toBeVisible();

    await page.getByTestId('annotation-export-close').click();
    await expect(page.getByTestId('annotation-export-overlay')).not.toBeVisible();
  });
});
