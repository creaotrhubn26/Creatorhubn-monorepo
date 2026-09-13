import { expect, test, type Page } from '@playwright/test';
import { openCastingPlanner, selectFirstProject } from './helpers/role-room';

const projectId = 'e2e-troll-production';
const locationId = 'troll-location-forest';

const initialOperations = {
  stage: 'recce', decisionStatus: 'primary',
  ownerCommunication: { status: 'awaiting_reply', contactName: 'Kari Grunneier' },
  dateAvailability: { status: 'requested', confirmedDates: [], holdExpiresAt: '2026-09-16T12:00' },
  recce: { status: 'scheduled', scheduledAt: '2026-09-15T08:00', attendees: ['DoP', '1st AD'] },
  clearanceGates: [
    { id: 'owner-permission', category: 'owner', title: 'Eieravtale og signatur', status: 'requested', mandatory: true },
    { id: 'public-permit', category: 'permit', title: 'Myndighetstillatelser', status: 'blocked', mandatory: true },
    { id: 'insurance', category: 'insurance', title: 'Forsikring og ansvar', status: 'verified', mandatory: true },
    { id: 'technical-recce', category: 'technical', title: 'Teknisk recce godkjent', status: 'in_progress', mandatory: true },
    { id: 'access-plan', category: 'access', title: 'Adkomst, parkering og unit base', status: 'verified', mandatory: true },
    { id: 'safety-plan', category: 'safety', title: 'Sikkerhet og nødadkomst', status: 'requested', mandatory: true },
  ],
  logistics: { unitBase: 'Sørporten', crewParking: 'P2', loadInRoute: 'Skogsbilvei nord', nearestHospital: 'Oslo legevakt' },
  finance: { currency: 'NOK', locationFee: 18000, permitFees: 2500, restorationReserve: 4000, status: 'quoted' },
  risks: [{ id: 'weather', title: 'Kraftig vind', severity: 'high', status: 'mitigating', mitigation: 'Ny måling kl. 05:00' }],
  scoutCapture: {
    conditions: { ambientNoise: 'unknown', mobileSignal: 'unknown', power: 'unknown' },
    checks: [
      { id: 'access-load-in', title: 'Adkomst og load-in', status: 'unchecked' },
      { id: 'sound', title: 'Støy og lydforhold', status: 'unchecked' },
    ],
  },
  weatherPlan: 'Flytt nærbilder til studio ved rødt farevarsel.',
  nextAction: 'Avklar sperring med kommunen før hold utløper.',
  activity: [],
};

async function installAuthenticatedLocationManagerApi(page: Page) {
  let storedProject: Record<string, unknown> | null = null;
  const projectWrites: Record<string, unknown>[] = [];
  let locationOperation = { locationId, operations: structuredClone(initialOperations), version: 0 };
  let scoutMedia: Array<Record<string, unknown>> = [];
  const authenticatedRequests: string[] = [];
  const savedVersions: number[] = [];

  await page.route('**/api/casting/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/casting/health') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'healthy' }) });
      return;
    }
    if (path === '/api/casting/projects' && request.method() === 'POST') {
      storedProject = request.postDataJSON() as Record<string, unknown>;
      projectWrites.push(storedProject);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      return;
    }
    if (path === '/api/casting/projects' && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(storedProject ? [storedProject] : []) });
      return;
    }
    if (path === `/api/casting/projects/${projectId}` && request.method() === 'GET') {
      await route.fulfill({ status: storedProject ? 200 : 404, contentType: 'application/json', body: JSON.stringify(storedProject ?? {}) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.route(`**/api/role-room/projects/${projectId}/location-operations`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ locationOperations: [locationOperation] }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/locations/${locationId}/operations`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    const body = route.request().postDataJSON() as { expectedVersion: number; operations: typeof initialOperations };
    expect(body.expectedVersion).toBe(locationOperation.version);
    locationOperation = {
      locationId,
      operations: {
        ...body.operations,
        activity: [{ id: `activity-${locationOperation.version + 1}`, type: 'workspace_saved', message: 'Oppdaterte lokasjonens beredskap og feltplan.', actorUserId: 'e2e-test-user', createdAt: '2026-09-13T12:00:00Z' }],
      },
      version: locationOperation.version + 1,
    };
    savedVersions.push(locationOperation.version);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ locationOperation }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/locations/${locationId}/media`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    if (route.request().method() === 'POST') {
      const item = {
        id: '3d1357e0-7fe8-4c11-b5f1-0b1fe4c586d2', projectId, locationId, uploadedBy: 'e2e-test-user',
        displayName: 'troll-scout.png', contentType: 'image/png', sizeBytes: 33, checksumSha256: 'a'.repeat(64), createdAt: '2026-09-13T12:00:00.000Z',
      };
      scoutMedia = [item, ...scoutMedia];
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ media: item }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ media: scoutMedia }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/roles`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    const role = { id: 'troll-location-manager-role', projectId, userId: 'e2e-test-user', role: 'location_manager' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(route.request().method() === 'GET' ? [role] : { role }) });
  });
  await page.route(`**/api/role-room/projects/${projectId}/my-tabs`, async (route) => {
    authenticatedRequests.push(route.request().headers().authorization ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tabAccess: null, source: 'default', role: 'location_manager', tabValues: null }) });
  });
  await page.route('**/api/role-room/casting-roles/*/selftapes', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/presence/heartbeat', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));

  return {
    authenticatedRequests,
    savedVersions,
    get operation() { return locationOperation; },
    get project() { return storedProject; },
    get projectWrites() { return projectWrites; },
    get scoutMedia() { return scoutMedia; },
  };
}

test.describe('Autentisert Troll-flyt · location manager', () => {
  test('prioriterer blokkeringer, lagrer atomisk og beholder feltplanen etter reload', async ({ page }) => {
    const runtimeErrors: string[] = [];
    const targetedApiFailures: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /TypeError|ReferenceError|Rendered fewer hooks|Minified React error/i.test(message.text())) runtimeErrors.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && /\/api\/presence\/heartbeat|\/selftapes(?:[/?#]|$)/i.test(response.url())) targetedApiFailures.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', (request) => {
      if (/\/api\/presence\/heartbeat|\/selftapes(?:[/?#]|$)/i.test(request.url())) targetedApiFailures.push(`FAILED ${request.url()}`);
    });
    const api = await installAuthenticatedLocationManagerApi(page);

    await openCastingPlanner(page, {
      urlFlags: { seed: 'production-manager-troll', session: 'location-manager', lens: 'location-management' },
    });
    await selectFirstProject(page);

    await expect(page.getByTestId('location-manager-workspace')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Troll', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Klareringsporter' })).toBeVisible();
    await expect(page.getByText('Myndighetstillatelser er blokkert')).toBeVisible();
    await expect(page.getByText('Hold < 72 t')).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get('lens')).toBe('location-management');

    await page.getByTestId('location-manager-workspace').locator('input[type="file"]').setInputFiles({
      name: 'troll-scout.png',
      mimeType: 'image/png',
      buffer: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(25)]),
    });
    await expect(page.getByText('troll-scout.png er lagret privat i Role Room S3.')).toBeVisible();
    expect(api.scoutMedia).toHaveLength(1);

    await page.getByLabel('Neste kritiske handling').fill('Ring kommunen og send revidert trafikkplan kl. 09:00.');
    await page.getByRole('button', { name: 'Lagre beredskap' }).click();
    await expect(page.getByText('Lokasjonsberedskapen er lagret som versjon 1.')).toBeVisible();
    expect(api.savedVersions).toEqual([1]);
    expect(api.operation.operations.nextAction).toBe('Ring kommunen og send revidert trafikkplan kl. 09:00.');

    await page.reload();
    await expect(page.getByTestId('location-manager-workspace')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel('Neste kritiske handling')).toHaveValue('Ring kommunen og send revidert trafikkplan kl. 09:00.');
    expect(api.authenticatedRequests.length).toBeGreaterThan(0);
    expect(api.authenticatedRequests.every((header) => header === 'Bearer dev-admin-local-session')).toBe(true);
    expect(runtimeErrors).toEqual([]);
    expect(targetedApiFailures).toEqual([]);
  });

  test('@mobile beholder prioritering, touchmål og feltredigering i stående visning', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await installAuthenticatedLocationManagerApi(page);

    await openCastingPlanner(page, {
      urlFlags: { seed: 'production-manager-troll', session: 'location-manager', lens: 'location-management' },
    });
    await selectFirstProject(page);

    const workspace = page.getByTestId('location-manager-workspace');
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Troll', exact: true })).toBeVisible();
    await expect(page.getByText('Myndighetstillatelser er blokkert')).toBeVisible();

    const clearanceSection = page.getByRole('button', { name: /Klareringsporter/ });
    await expect(clearanceSection).toHaveAttribute('aria-expanded', 'false');
    const sectionTouchTarget = await clearanceSection.boundingBox();
    expect(sectionTouchTarget?.height ?? 0).toBeGreaterThanOrEqual(44);
    await clearanceSection.tap();
    await expect(clearanceSection).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('Myndighetstillatelser status')).toBeVisible();

    const mapButton = page.getByRole('button', { name: 'Kart og lokasjonsbase' });
    await expect(mapButton).toBeVisible();
    const touchTarget = await mapButton.boundingBox();
    expect(touchTarget?.height ?? 0).toBeGreaterThanOrEqual(44);

    const nextAction = page.getByLabel('Neste kritiske handling');
    await nextAction.tap();
    await nextAction.fill('Mobil: avklar kommunal sperring før holdet utløper.');
    await expect(page.getByText('Ulagrede endringer')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lagre beredskap' })).toBeEnabled();

    await page.setViewportSize({ width: 852, height: 393 });
    await expect(page.getByText('Scout Capture', { exact: true }).first()).toBeVisible();
    await expect(nextAction).toBeVisible();
  });

  test('kjører kildebevisst lokasjonsanalyse, lagrer resultatet og viser det igjen', async ({ page }) => {
    const runtimeErrors: string[] = [];
    const analysisRequests: string[] = [];
    const targetedApiFailures: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /TypeError|ReferenceError|Rendered fewer hooks|Minified React error/i.test(message.text())) runtimeErrors.push(message.text());
    });
    page.on('response', (response) => {
      if (
        response.status() >= 400
        && /\/api\/role-room\/locations\/analysis|\/api\/external-data\/kartverket|\/api\/casting\/projects/i.test(response.url())
      ) targetedApiFailures.push(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', (request) => {
      if (/\/api\/role-room\/locations\/analysis|\/api\/external-data\/kartverket|\/api\/casting\/projects/i.test(request.url())) {
        targetedApiFailures.push(`FAILED ${request.url()}`);
      }
    });
    const api = await installAuthenticatedLocationManagerApi(page);

    await page.route('**/api/role-room/locations/analysis/analyze', async (route) => {
      analysisRequests.push(route.request().headers().authorization ?? '');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true,
        data: {
          query: 'Skogveien 1, Oslo',
          geocoded: { adressetekst: 'Skogveien 1', kommunenavn: 'Oslo', kommunenummer: '0301', postnummer: '0001', poststed: 'OSLO', representasjonspunkt: { lat: 59.91, lon: 10.75 } },
          permitInfo: { kommune: 'Oslo', kommunenummer: '0301', filmingPermitUrl: 'https://www.oslo.kommune.no/byutvikling/film-og-tv/' },
          recommendations: [],
          source: 'kartverket',
          confidence: 'verified_address',
          permitDataSource: 'curated_directory',
          analyzedAt: '2026-09-13T12:00:00.000Z',
          warnings: ['Kontaktinformasjon må verifiseres før planen låses.'],
        },
      }) });
    });
    await page.route('**/api/external-data/kartverket/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.includes('/property/')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {
          propertyId: '0301-1-1', address: 'Skogveien 1, Oslo', coordinates: { lat: 59.91, lng: 10.75 }, area: 1200,
          boundaries: [], elevation: 42, landUse: 'skog', restrictions: [], accessRights: [], ownership: { owner: '', ownershipType: 'ukjent', registrationDate: '' }, source: 'kartverket',
        } }) });
        return;
      }
      if (path.includes('/elevation/')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { coordinates: { lat: 59.91, lng: 10.75 }, elevation: 42, accuracy: 1, source: 'kartverket' } }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {
        address: 'Skogveien 1, Oslo', coordinates: { lat: 59.91, lng: 10.75 }, municipality: 'Oslo', county: 'Oslo', postalCode: '0001', propertyId: '0301-1-1', source: 'kartverket',
      } }) });
    });

    await openCastingPlanner(page, {
      urlFlags: { seed: 'production-manager-troll', session: 'location-manager', lens: 'location-management' },
    });
    await selectFirstProject(page);
    await page.getByRole('button', { name: 'Kart og lokasjonsbase' }).click();
    const analyzeButton = page.getByRole('button', { name: 'Analyser Trollskogen' }).first();
    await expect(analyzeButton).toBeVisible({ timeout: 20_000 });
    await analyzeButton.click();

    await expect(page.getByRole('heading', { name: 'Lokasjonsanalyse', exact: true })).toBeVisible();
    await expect(page.getByTestId('location-analysis-evidence')).toContainText('Adressetreff bekreftet: Skogveien 1, Oslo');
    await expect(page.getByTestId('location-analysis-evidence')).toContainText('ikke bekreftet før en kilde eller scout har dokumentert dem');
    await expect.poll(() => api.projectWrites.length).toBeGreaterThan(1);
    await expect.poll(() => {
      const locations = api.project?.locations as Array<{ id: string; propertyAnalysis?: unknown }> | undefined;
      return Boolean(locations?.find((location) => location.id === locationId)?.propertyAnalysis);
    }).toBe(true);
    await expect(page.getByText('Operative scorer og tekniske konklusjoner holdes tilbake.')).toBeVisible();

    await page.getByRole('button', { name: 'Lukk', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Lokasjonsanalyse', exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'Analyser Trollskogen' }).first().click();
    await expect(page.getByTestId('location-analysis-evidence')).toContainText('Adressetreff bekreftet: Skogveien 1, Oslo');
    await expect(page.getByText('Operative scorer og tekniske konklusjoner holdes tilbake.')).toBeVisible();

    // Reopening uses the persisted analysis; it must not silently recalculate
    // or overwrite the result with another external request.
    await expect.poll(() => analysisRequests.length).toBe(1);
    expect(analysisRequests).toEqual(['Bearer dev-admin-local-session']);
    expect(runtimeErrors).toEqual([]);
    expect(targetedApiFailures).toEqual([]);
  });

  test('viser en tydelig, ikke-antatt tilstand når adressen er for upresis', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /TypeError|ReferenceError|Rendered fewer hooks|Minified React error/i.test(message.text())) {
        runtimeErrors.push(message.text());
      }
    });
    await installAuthenticatedLocationManagerApi(page);

    await page.route('**/api/role-room/locations/analysis/analyze', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true,
        data: {
          query: 'Dovre, Innlandet',
          geocoded: null,
          permitInfo: null,
          recommendations: [],
          source: 'fallback',
          confidence: 'unverified',
          permitDataSource: 'none',
          analyzedAt: '2026-09-13T12:00:00.000Z',
          warnings: ['Kunne ikke geocode adressen via Kartverket. Sjekk at adressen er fullstendig (gateadresse + nummer + postnummer + sted).'],
        },
      }) });
    });
    await page.route('**/api/external-data/kartverket/address/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        success: false,
        error: 'Adressen kunne ikke verifiseres',
      }) });
    });

    await openCastingPlanner(page, {
      urlFlags: { seed: 'production-manager-troll', session: 'location-manager', lens: 'location-management' },
    });
    await selectFirstProject(page);
    await page.getByRole('button', { name: 'Kart og lokasjonsbase' }).click();
    await page.getByRole('button', { name: 'Analyser Trollskogen' }).first().click();

    const evidence = page.getByTestId('location-analysis-evidence');
    await expect(evidence).toContainText('Adressen er ikke verifisert');
    await expect(evidence).toContainText('Kartverket fant ikke et presist adressetreff');
    await expect(evidence).not.toContainText('Kartverket bekrefter adressetreffet');
    await expect(page.getByRole('heading', { name: 'Adressen må presiseres' })).toBeVisible();
    await expect(page.getByText('Legg inn gateadresse, nummer, postnummer og sted')).toBeVisible();
    await expect(page.getByText('Kunne ikke laste analyse', { exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Start analyse' })).toBeHidden();
    expect(runtimeErrors).toEqual([]);
  });
});
