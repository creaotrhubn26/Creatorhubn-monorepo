import { expect, test } from '@playwright/test';

test.describe('Academy Presentation Overlay E2E', () => {
  test('semantic search and design plan endpoints are wired in UI flow', async ({ page }) => {
    test.setTimeout(240_000);

    await page.goto('/academy/presentation-overlay', { waitUntil: 'domcontentloaded' });

    const newDeckButton = page.getByRole('button', { name: /Ny presentasjon|New deck/i });
    await expect(newDeckButton).toBeVisible({ timeout: 30_000 });
    await newDeckButton.click();

    const searchInput = page.getByPlaceholder(/Sok i presentasjon og slides|Search presentations and slides/i);
    await expect(searchInput).toBeVisible();

    const semanticResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes('/api/academy/presentation/semantic-search') &&
        response.request().method() === 'POST' &&
        response.status() === 200
      );
    }, { timeout: 60_000 });

    await searchInput.fill('sales milestones q3');

    const semanticResponse = await semanticResponsePromise;
    const semanticPayload = await semanticResponse.json();
    expect(semanticPayload?.success).toBeTruthy();
    expect(Array.isArray(semanticPayload?.data?.ranking)).toBeTruthy();

    const generatePlanButton = page.getByRole('button', { name: /Generer plan|Generate plan/i });
    await expect(generatePlanButton).toBeVisible({ timeout: 30_000 });

    // Ensure at least one deck exists and button can be used.
    if (await generatePlanButton.isDisabled()) {
      await newDeckButton.click();
      await expect(generatePlanButton).toBeEnabled({ timeout: 15_000 });
    }

    const designPlanResponsePromise = page.waitForResponse((response) => {
      return (
        response.url().includes('/api/academy/presentation/design-plan') &&
        response.request().method() === 'POST' &&
        response.status() === 200
      );
    }, { timeout: 120_000 });

    await generatePlanButton.click();

    const designPlanResponse = await designPlanResponsePromise;
    const designPlanPayload = await designPlanResponse.json();
    expect(designPlanPayload?.success).toBeTruthy();
    expect(Array.isArray(designPlanPayload?.data?.slides)).toBeTruthy();
    expect((designPlanPayload?.data?.slides || []).length).toBeGreaterThan(0);

    const sourceChip = page.getByText(/Kilde: AI-modell|Kilde: Regelmotor|Source: AI model|Source: Rule engine/i);
    await expect(sourceChip).toBeVisible({ timeout: 30_000 });

    const applyAllButton = page.getByRole('button', { name: /Apply all/i });
    await expect(applyAllButton).toBeEnabled({ timeout: 10_000 });
  });
});
