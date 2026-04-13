import { expect, test, type Page } from '@playwright/test';

const TEST_PAGE = '/e2e-producer-review-test.html';
const PROJECT_ID = 'e2e-review-project';

const reviewItems = [
  {
    id: 'review-pending-newest',
    project_id: PROJECT_ID,
    review_type: 'shotlist',
    title: 'Shotlist må godkjennes',
    description: 'Klienten må godkjenne shotlisten før produksjon.',
    target_entity_type: 'shotlist',
    target_entity_id: 'shotlist-1',
    requested_at: '2026-04-13T10:00:00.000Z',
    status: 'pending',
    created_at: '2026-04-13T10:00:00.000Z',
    updated_at: '2026-04-13T10:00:00.000Z',
    comments: [],
  },
  {
    id: 'review-changes',
    project_id: PROJECT_ID,
    review_type: 'manuscript',
    title: 'Manus krever endringer',
    description: 'Klienten har bedt om en tydeligere CTA.',
    target_entity_type: 'manuscript',
    target_entity_id: 'manus-1',
    requested_at: '2026-04-12T12:00:00.000Z',
    decision_at: '2026-04-12T16:00:00.000Z',
    decision_reason: 'CTA må spisses.',
    status: 'changes_requested',
    created_at: '2026-04-12T12:00:00.000Z',
    updated_at: '2026-04-12T16:00:00.000Z',
    comments: [],
  },
  {
    id: 'review-approved',
    project_id: PROJECT_ID,
    review_type: 'storyboard',
    title: 'Storyboard er godkjent',
    description: 'Klienten har signert av storyboard.',
    target_entity_type: 'storyboard',
    target_entity_id: 'storyboard-1',
    requested_at: '2026-04-11T09:00:00.000Z',
    decision_at: '2026-04-11T13:00:00.000Z',
    status: 'approved',
    created_at: '2026-04-11T09:00:00.000Z',
    updated_at: '2026-04-11T13:00:00.000Z',
    comments: [],
  },
  {
    id: 'review-rejected',
    project_id: PROJECT_ID,
    review_type: 'scene_notes',
    title: 'Referanse er avslått',
    description: 'Klienten vil ikke bruke denne retningen.',
    target_entity_type: 'reference',
    target_entity_id: 'reference-1',
    requested_at: '2026-04-10T08:00:00.000Z',
    decision_at: '2026-04-10T11:00:00.000Z',
    status: 'rejected',
    created_at: '2026-04-10T08:00:00.000Z',
    updated_at: '2026-04-10T11:00:00.000Z',
    comments: [],
  },
];

async function routeProducerReviewApis(page: Page) {
  await page.route('**/api/settings**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ settings: [] }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
  await page.route('**/api/casting/projects/e2e-review-project', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(null),
    });
  });
  await page.route('**/api/role-room/projects/e2e-review-project/producer/reviews', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: reviewItems }),
    });
  });
  await page.route('**/api/role-room/projects/e2e-review-project/project-agreements', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ agreements: [] }),
    });
  });
  await page.route('**/api/role-room/projects/e2e-review-project/producer/client-intake', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ intake: null }),
    });
  });
  await page.route('**/api/role-room/projects/e2e-review-project/producer/client-materials', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  });
}

async function expectVisibleReviewTitles(page: Page, titles: string[]) {
  const cards = page.getByTestId('producer-review-card');
  await expect(cards).toHaveCount(titles.length);
  for (const [index, title] of titles.entries()) {
    await expect(cards.nth(index)).toContainText(title);
  }
}

test.describe('Producer client review overview', () => {
  test('summarizes, sorts, and filters client approvals', async ({ page }) => {
    await routeProducerReviewApis(page);
    await page.goto(TEST_PAGE, { waitUntil: 'load', timeout: 60_000 });

    await expect(page.getByText('Klientgodkjenning')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('producer-review-summary-open')).toContainText('2');
    await expect(page.getByTestId('producer-review-summary-changes')).toContainText('2');
    await expect(page.getByTestId('producer-review-summary-approved')).toContainText('1');
    await expect(page.getByTestId('producer-review-summary-total')).toContainText('4');

    await expectVisibleReviewTitles(page, [
      'Shotlist må godkjennes',
      'Manus krever endringer',
    ]);

    await page.getByTestId('producer-review-filter-approved').click();
    await expectVisibleReviewTitles(page, ['Storyboard er godkjent']);

    await page.getByTestId('producer-review-filter-changes').click();
    await expectVisibleReviewTitles(page, [
      'Manus krever endringer',
      'Referanse er avslått',
    ]);

    await page.getByTestId('producer-review-filter-all').click();
    await expectVisibleReviewTitles(page, [
      'Shotlist må godkjennes',
      'Manus krever endringer',
      'Storyboard er godkjent',
      'Referanse er avslått',
    ]);
  });
});
