import { expect, test, type Page, type Route } from '@playwright/test';

type Product = {
  id: string; name: string; vendor: string; category: string; version: string;
  price: number; currency: string; downloads: number; rating: number;
  status: 'active' | 'inactive' | 'pending'; description: string; tags: string[];
};

function runtimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /TypeError|ReferenceError|React error|Rendered fewer hooks/i.test(message.text())) errors.push(message.text());
  });
  return errors;
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockVendorApis(page: Page) {
  let products: Product[] = [];
  let keys: Array<Record<string, unknown>> = [];
  await page.addInitScript(() => {
    localStorage.setItem('creatorhub_auth_token', 'vendor-e2e-session');
    localStorage.setItem('creatorhub_auth_user', JSON.stringify({ id: 'vendor-e2e', email: 'vendor@example.no', name: 'Nordlys Print', displayName: 'Nordlys Print', businessName: 'Nordlys Print', role: 'vendor', profession: 'vendor', verified_email: true }));
  });
  // Match only server API requests. `/src/api/*` contains real application
  // modules and must keep loading through Vite.
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => json(route, {}));
  await page.route('**/api/vendor-types/general/categories', (route) => json(route, { categories: [{ id: 'album', label: 'Album', color: '#ff8c00' }] }));
  await page.route('**/api/vendor/analytics/vendor-e2e', (route) => json(route, { totalDownloads: 0, totalRevenue: 0, averageRating: 0 }));
  await page.route('**/api/vendor/products/vendor-e2e?vendorType=general', (route) => json(route, products));
  await page.route('**/api/vendor/products', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const input = route.request().postDataJSON();
    const product: Product = { id: 'product-1', name: input.name, vendor: 'vendor-e2e', category: input.category, version: input.version, price: input.price, currency: input.currency, downloads: 0, rating: 0, status: 'pending', description: input.description, tags: input.tags };
    products = [product]; await json(route, product, 201);
  });
  await page.route('**/api/vendor/products/product-1', async (route) => {
    const method = route.request().method();
    if (method === 'DELETE') { products = []; return json(route, {}); }
    if (method === 'PUT' || method === 'PATCH') {
      const input = route.request().postDataJSON(); products = [{ ...products[0], ...input }]; return json(route, products[0]);
    }
    return route.fallback();
  });
  await page.route('**/api/vendor/products/product-1/publish', async (route) => { products = [{ ...products[0], status: 'active' }]; await json(route, products[0]); });
  await page.route('**/api/vendor/products/product-1/unpublish', async (route) => { products = [{ ...products[0], status: 'inactive' }]; await json(route, products[0]); });
  await page.route('**/api/vendor/api-keys', async (route) => {
    if (route.request().method() === 'GET') return json(route, { keys });
    const input = route.request().postDataJSON();
    const created = { id: 'key-1', name: input.name, key: `chv_live_${'x'.repeat(36)}`, prefix: 'chv_live_xxxxxxxx', scopes: input.scopes, createdAt: new Date().toISOString(), revokedAt: null };
    keys = [created]; await json(route, created, 201);
  });
  await page.route('**/api/vendor/api-keys/key-1', async (route) => { keys = keys.map((key) => ({ ...key, revokedAt: new Date().toISOString() })); await json(route, {}); });
}

test.describe('Vendor i CreatorHub Workspace', () => {
  test('oppretter, redigerer, publiserer og arkiverer et produkt i Workspace-designet', async ({ page }, testInfo) => {
    const errors = runtimeErrors(page); await mockVendorApis(page); await page.goto('/vendor-dashboard');
    await expect(page.getByRole('heading', { name: 'Produktkatalog' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Vendor Workspace')).toBeVisible();
    await expect(page.getByRole('main', { name: 'Produkthåndtering' })).toBeVisible();

    await page.getByRole('button', { name: 'Legg til nytt produkt' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Produktnavn').fill('Premium bryllupsalbum');
    await dialog.getByLabel('Pris (NOK)').fill('3490');
    await dialog.getByLabel('Beskrivelse').fill('Håndbundet album med arkivpapir.');
    await dialog.getByLabel('Tags (komma-separert)').fill('bryllup, album');
    await dialog.getByRole('button', { name: 'Legg til', exact: true }).click();
    await expect(page.getByText('Premium bryllupsalbum')).toBeVisible();
    await expect(page.getByLabel('Status: Venter')).toBeVisible();

    await page.getByRole('button', { name: 'Rediger Premium bryllupsalbum' }).click();
    await page.getByRole('dialog').getByLabel('Pris (NOK)').fill('3790');
    await page.getByRole('dialog').getByRole('button', { name: 'Oppdater' }).click();
    await expect(page.getByLabel('Pris: 3790 NOK')).toBeVisible();

    await page.getByRole('button', { name: 'Publiser Premium bryllupsalbum' }).click();
    await expect(page.getByLabel('Status: Aktiv')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('vendor-workspace-published.png'), fullPage: true });
    await page.getByRole('button', { name: 'Slett Premium bryllupsalbum' }).click();
    await expect(page.getByText('Premium bryllupsalbum')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('oppretter og tilbakekaller en API-nøkkel som bare vises én gang', async ({ page }) => {
    const errors = runtimeErrors(page); await mockVendorApis(page); await page.goto('/vendor-dashboard');
    await page.getByRole('button', { name: 'API-tilgang' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Navn på integrasjon').fill('Nettbutikk produksjon');
    await dialog.getByRole('button', { name: 'Opprett nøkkel' }).click();
    await expect(dialog.getByText(/chv_live_/)).toBeVisible();
    await expect(dialog.getByText('Nettbutikk produksjon')).toBeVisible();
    await dialog.getByRole('button', { name: 'Tilbakekall' }).click();
    await expect(dialog.getByText('Tilbakekalt')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('@tablet beholder Workspace-navigasjon, katalog og 48px handlinger tilgjengelige', async ({ page }) => {
    await mockVendorApis(page); await page.goto('/vendor-dashboard');
    await expect(page.getByRole('heading', { name: 'Produktkatalog' })).toBeVisible({ timeout: 20_000 });
    const add = page.getByRole('button', { name: 'Legg til nytt produkt' });
    await expect(add).toBeVisible();
    const box = await add.boundingBox();
    expect(box?.height || 0).toBeGreaterThanOrEqual(48);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('main', { name: 'Produkthåndtering' })).toBeVisible();
  });
});
