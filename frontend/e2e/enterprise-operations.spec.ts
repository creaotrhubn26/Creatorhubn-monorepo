import { expect, test, type Page, type Route } from '@playwright/test';

const AUTH_USER = {
  id: 'enterprise-e2e-user',
  email: 'enterprise@creatorhub.test',
  firstName: 'Eline',
  lastName: 'Eier',
  name: 'Eline Eier',
  role: 'photographer',
  profession: 'photographer',
  verified_email: true,
};

const project = {
  id: 'enterprise-project',
  title: 'Nordlys-produksjonen',
  name: 'Nordlys-produksjonen',
  projectType: 'commercial',
  status: 'active',
  eventDate: '2026-10-12',
  location: 'Oslo',
  coverUrl: null,
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

function runtimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /TypeError|ReferenceError|React error|Rendered fewer hooks/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  return errors;
}

async function authenticate(page: Page) {
  await page.addInitScript(([token, user]) => {
    localStorage.clear();
    localStorage.setItem('creatorhub_auth_token', token as string);
    localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
  }, ['enterprise-e2e-token', AUTH_USER] as const);

  // Keep unrelated global providers deterministic while the product UI itself
  // continues to run from the built bundle.
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => json(route, {}));
  await page.route('**/api/auth/user', (route) => json(route, { authenticated: true, user: AUTH_USER }));
  await page.route('**/api/design/tokens*', (route) => json(route, {}));
  await page.route('**/api/realtime/user-events-ticket', (route) => json(route, {
    ticket: 'enterprise-events-ticket',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    websocketPath: '/api/ipad/ws/events',
    protocolVersion: 1,
  }, 201));
}

test.describe('CreatorHub Enterprise operations', () => {
  test('ansatt fører tid, sender inn og leder godkjenner og låser perioden', async ({ page }, testInfo) => {
    const errors = runtimeErrors(page);
    await authenticate(page);

    let status: 'draft' | 'submitted' | 'approved' | 'locked' = 'draft';
    let entries: Array<Record<string, unknown>> = [];
    const period = () => ({
      id: 'period-1', organizationId: 'org-1', projectId: project.id,
      participantId: 'participant-1', employeeUserId: AUTH_USER.id,
      employeeName: AUTH_USER.name, employeeEmail: AUTH_USER.email,
      periodStart: '2026-09-21', periodEnd: '2026-09-27', status, version: 1,
      employeeNote: null, reviewerNote: null,
      totalMinutes: entries.reduce((sum, entry) => sum + Number(entry.netMinutes || 0), 0),
      billableMinutes: entries.filter((entry) => entry.billable).reduce((sum, entry) => sum + Number(entry.netMinutes || 0), 0),
      entryCount: entries.length,
      submittedAt: status === 'draft' ? null : '2026-09-25T10:00:00.000Z',
      reviewedAt: status === 'approved' || status === 'locked' ? '2026-09-25T10:05:00.000Z' : null,
      lockedAt: status === 'locked' ? '2026-09-25T10:06:00.000Z' : null,
      settlement: status === 'locked' ? {
        id: 'settlement-1', totalMinutes: 105, hourlyRate: 850, amount: 1487.5,
        currency: 'NOK', agreementStatus: 'signed', splitSheetId: 'split-1',
      } : null,
      createdAt: '2026-09-21T08:00:00.000Z', updatedAt: '2026-09-25T10:06:00.000Z',
    });

    await page.route('**/api/projects/*/workspace-bootstrap', (route) => json(route, {
      project, workspaceCategory: 'visual', access: { canRead: true, canEdit: true, isOwner: true },
      owner: { userId: AUTH_USER.id, name: AUTH_USER.name, email: AUTH_USER.email }, members: [],
    }));
    await page.route(/\/api\/projects\/enterprise-project$/, (route) => json(route, { project }));
    await page.route('**/api/projects/enterprise-project/team/members', (route) => json(route, { owner: null, members: [] }));
    await page.route('**/api/projects/enterprise-project/participants', (route) => json(route, {
      participants: [{ id: 'participant-1', displayName: AUTH_USER.name, email: AUTH_USER.email, compensation: { compensationType: 'hourly' } }],
    }));
    await page.route('**/api/projects/enterprise-project/timesheets', async (route) => {
      if (route.request().method() === 'GET') return json(route, { periods: [period()] });
      return route.fallback();
    });
    await page.route('**/api/projects/enterprise-project/timesheets/period-1', (route) => json(route, {
      period: period(), entries, access: { canReview: true, role: 'owner' },
    }));
    await page.route('**/api/projects/enterprise-project/timesheets/period-1/entries', async (route) => {
      const input = route.request().postDataJSON();
      entries = [{
        id: 'entry-1', periodId: 'period-1', workDate: input.workDate,
        activity: input.activity, description: input.description, taskId: null,
        startedAt: null, endedAt: null, durationMinutes: input.durationMinutes,
        breakMinutes: input.breakMinutes, netMinutes: input.durationMinutes - input.breakMinutes,
        billable: input.billable, source: input.source, version: 1,
        createdAt: '2026-09-25T09:00:00.000Z', updatedAt: '2026-09-25T09:00:00.000Z',
      }];
      await json(route, { entry: entries[0] }, 201);
    });
    await page.route(/\/api\/projects\/enterprise-project\/timesheets\/period-1\/(submit|approve|lock)$/, async (route) => {
      const action = new URL(route.request().url()).pathname.split('/').pop();
      status = action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : 'locked';
      await json(route, { period: period() });
    });

    await page.goto('/workspace/enterprise-project/timer');
    await expect(page.getByText('Timer & godkjenning', { exact: true }).last()).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Før tid' }).click();
    const entryDialog = page.getByRole('dialog', { name: 'Før arbeidstid' });
    await entryDialog.getByLabel('Aktivitet').fill('Kamera og lysrigg');
    await entryDialog.getByLabel('Beskrivelse').fill('Rigging før opptak');
    await entryDialog.getByLabel('Minutter').fill('120');
    await entryDialog.getByLabel('Pause').fill('15');
    await entryDialog.getByRole('button', { name: 'Lagre', exact: true }).click();
    await expect(page.getByText('Kamera og lysrigg')).toBeVisible();
    await expect(page.getByText('1 t 45 min', { exact: true }).last()).toBeVisible();

    await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/submit')),
      page.getByRole('button', { name: 'Send inn' }).click(),
    ]);
    await expect(page.getByRole('button', { name: 'Godkjenn', exact: true })).toBeVisible();
    await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/approve')),
      page.getByRole('button', { name: 'Godkjenn', exact: true }).click(),
    ]);
    await expect(page.getByRole('button', { name: 'Lås periode' })).toBeVisible();
    await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/lock')),
      page.getByRole('button', { name: 'Lås periode' }).click(),
    ]);
    await expect(page.getByText(/Oppgjørsgrunnlag:.*NOK.*signert avtale/)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('timesheet-locked.png'), fullPage: true });
    expect(status).toBe('locked');
    expect(entries).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('enterprise-eier publiserer bookingside og oppretter en tjeneste', async ({ page }) => {
    const errors = runtimeErrors(page);
    await authenticate(page);
    let savedProfile: Record<string, unknown> | null = null;
    let services: Array<Record<string, unknown>> = [];

    await page.route('**/api/creatorhub/booking', (route) => json(route, {
      profile: savedProfile, services, bookings: [], availability: [],
    }));
    await page.route('**/api/creatorhub/booking/profile', async (route) => {
      savedProfile = route.request().postDataJSON();
      await json(route, { profile: savedProfile });
    });
    await page.route('**/api/creatorhub/booking/services', async (route) => {
      const input = route.request().postDataJSON();
      services = [{ id: 'service-1', ...input }];
      await json(route, { service: services[0] }, 201);
    });

    await page.goto('/booking');
    await expect(page.getByRole('heading', { name: 'Booking', exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByLabel('Firmanavn').fill('Nordlys Foto');
    await page.getByLabel('Adressekode').fill('nordlys-foto');
    await page.getByLabel('Overskrift').fill('Fotografering med ro og kvalitet');
    await page.getByLabel('Publiser bookingsiden').check();
    await page.getByRole('button', { name: 'Lagre profil' }).click();
    await expect(page.getByText('Bookingsiden er lagret.')).toBeVisible();
    expect(savedProfile?.isPublished).toBe(true);

    await page.getByRole('button', { name: 'Ny' }).click();
    const dialog = page.getByRole('dialog', { name: 'Ny tjeneste' });
    await dialog.getByLabel('Navn').fill('Familiefotografering');
    await dialog.getByLabel('Pris').fill('4900');
    await dialog.getByRole('button', { name: 'Opprett', exact: true }).click();
    await expect(page.getByText('Familiefotografering')).toBeVisible();
    expect(services).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test('kunde reserverer en konkret tid på den offentlige bookingsiden', async ({ page }) => {
    const errors = runtimeErrors(page);
    let bookingPayload: Record<string, unknown> | null = null;
    const slot = '2026-10-12T10:00:00.000Z';
    await page.route((url) => url.pathname.startsWith('/api/'), (route) => json(route, {}));
    await page.route('**/api/public/booking/nordlys-foto', (route) => json(route, {
      profile: {
        organizationId: 'org-1', slug: 'nordlys-foto', businessName: 'Nordlys Foto',
        headline: 'Fotografering med ro og kvalitet', description: null, profession: 'Fotograf',
        timezone: 'Europe/Oslo', currency: 'NOK', logoUrl: null, coverUrl: null,
        locationLabel: 'Oslo', contactEmail: 'hei@nordlys.test', minimumNoticeHours: 24,
        maximumAdvanceDays: 180, slotIntervalMinutes: 30, isPublished: true,
      },
      services: [{
        id: 'service-1', name: 'Familiefotografering', description: 'En rolig familietime',
        durationMinutes: 60, priceAmount: 4900, depositAmount: 1000,
        bufferBeforeMinutes: 0, bufferAfterMinutes: 0, locationMode: 'provider', isActive: true, sortOrder: 0,
      }],
    }));
    await page.route('**/api/public/booking/nordlys-foto/availability?*', (route) => json(route, { slots: [slot] }));
    await page.route('**/api/public/booking/nordlys-foto/bookings', async (route) => {
      bookingPayload = route.request().postDataJSON();
      await json(route, { booking: { id: 'booking-1', bookingReference: 'CH-2026-001', status: 'pending' } }, 201);
    });

    await page.goto('/book/nordlys-foto');
    await expect(page.getByRole('heading', { name: 'Nordlys Foto' })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /man\. 12\. okt\..*12:00/i }).click();
    await page.getByLabel('Navn').fill('Kari Kunde');
    await page.getByLabel('E-post').fill('kari@example.no');
    await page.getByLabel('Hva ønsker du hjelp med?').fill('Familiebilder ute i høstlyset.');
    await page.getByRole('button', { name: 'Send bookingforespørsel' }).click();
    await expect(page.getByText('Forespørselen er mottatt')).toBeVisible();
    await expect(page.getByText(/CH-2026-001/)).toBeVisible();
    expect(bookingPayload).toMatchObject({
      serviceId: 'service-1', startsAt: slot, customerName: 'Kari Kunde', customerEmail: 'kari@example.no', privacyConsent: true,
    });
    expect(errors).toEqual([]);
  });
});
