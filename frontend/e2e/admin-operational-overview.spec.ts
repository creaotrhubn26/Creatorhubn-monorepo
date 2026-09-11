import { expect, test, type Route } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const AUTH_TOKEN = 'admin-operational-overview-e2e';
const ADMIN_USER = {
  id: 'admin-operational-overview',
  email: 'admin@local.dev',
  name: 'Local Super Admin',
  firstName: 'Local',
  lastName: 'Admin',
  role: 'super_admin',
  roleLabel: 'Super Admin',
  profession: 'photographer',
  userType: 'photographer',
  permissions: [
    'users:read',
    'users:write',
    'roles:write',
    'academy:admin',
    'billing:admin',
    'impersonate',
  ],
  isAdmin: true,
  verified_email: true,
};

const json = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

test('viser operativ adminoversikt uten å miste eksisterende adminfunksjoner', async ({ page }) => {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('creatorhub_auth_token', token);
    localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
    localStorage.setItem('userId', user.id);
    localStorage.setItem('userEmail', user.email);
  }, { token: AUTH_TOKEN, user: ADMIN_USER });

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const boundaryErrors: string[] = [];
  const requestedPaths = new Set<string>();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
    if (message.text().includes('Component error caught by boundary')) {
      boundaryErrors.push(message.text());
      console.warn(message.text());
    }
  });

  await page.route(/^https?:\/\/[^/]+\/api\//, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    requestedPaths.add(pathname);

    if (pathname === '/api/auth/user') {
      await json(route, { authenticated: true, user: ADMIN_USER });
      return;
    }
    if (pathname === '/api/admin/dashboard') {
      await json(route, {
        dashboard: {
          quickStats: {
            totalCustomers: 12,
            totalRevenue: 45000,
            activeSubscriptions: 8,
            activeDeals: 6,
            subscriptionBreakdown: [{ plan: 'solo_pro', count: 8 }],
          },
        },
      });
      return;
    }
    if (pathname === '/api/admin/pending-counts') {
      await json(route, {
        total: 9,
        inviteRequests: 2,
        prototypeFeedback: 3,
        bugReports: 4,
      });
      return;
    }
    if (pathname === '/api/admin/inbound-alerts/count') {
      await json(route, { unread: 5 });
      return;
    }
    if (pathname === '/api/admin/audit/recent') {
      await json(route, [{
        id: 'audit-1',
        title: 'Verifisert administrasjonshendelse',
        timestamp: '2026-09-12T08:30:00.000Z',
        priority: 'medium',
      }]);
      return;
    }
    if (pathname === '/api/admin/system/health') {
      await json(route, { database: { status: 'healthy' } });
      return;
    }
    if (pathname === '/api/admin/integrations/status') {
      await json(route, { environment: { stripeConfigured: true } });
      return;
    }
    if (pathname === '/api/admin/security/status') {
      await json(route, { unreadCriticalAlerts: 1 });
      return;
    }
    if (pathname === '/api/admin/platform-stats') {
      await json(route, {
        totalUsers: { current: 12, previous: 10 },
        activeProjects: { current: 6, previous: 5 },
        totalRevenue: { current: 45000, previous: 40000 },
        newSignups: { current: 2, previous: 1 },
        professionBreakdown: {
          photographer: 4,
          videographer: 3,
          musicproducer: 3,
          vendor: 2,
        },
        systemHealth: {
          dbStatus: 'healthy',
          uptimeHours: 24,
          responseTime: 42,
          errorRate: 0,
          activeSessions: 3,
          measuredAt: '2026-09-12T08:30:00.000Z',
        },
      });
      return;
    }
    if (pathname === '/api/admin/profession-stats') {
      await json(route, { photographer: 4, videographer: 3, musicproducer: 3, vendor: 2 });
      return;
    }
    if (pathname === '/api/academy/admin/revenue/overview') {
      await json(route, {
        totalStudents: 10,
        totalEnrollments: 12,
        totalInstructors: 2,
        activeCourses: 3,
        totalRevenue: 10000,
        totalPlatformRevenue: 2000,
        totalInstructorRevenue: 8000,
        pendingPayouts: 0,
        pendingPayoutAmount: 0,
      });
      return;
    }
    if (pathname === '/api/admin/academy/analytics/overview') {
      await json(route, { totalCourses: 3, publishedCourses: 3, totalEnrollments: 12, totalInstructors: 2 });
      return;
    }
    if (pathname === '/api/admin/email-conversion-stats') {
      await json(route, { totalSent: 10, avgOpenRate: 60, avgClickRate: 30, avgConversionRate: 20 });
      return;
    }
    if (pathname === '/api/role-room/admin/stats') {
      await json(route, {
        kreative: 4,
        produksjoner: 2,
        rollerBesatt: 3,
        kandidater: 6,
        marketplaceInstalls: 1,
        activeApiKeys: 1,
        recentProjects: [],
        professionBreakdown: [],
      });
      return;
    }
    if (pathname === '/api/analytics/overview') {
      const metric = { current: 1, previous: 1, change: 0 };
      await json(route, {
        range: {
          key: '90daysAgo',
          label: '90 dager',
          days: 90,
          startDate: '2026-06-14',
          endDateExclusive: '2026-09-13',
        },
        freshness: {
          latestEventAt: '2026-09-12T08:30:00.000Z',
          latestUserLoginAt: '2026-09-12T08:30:00.000Z',
          daysSinceLatestEvent: 0,
          hasDataInRange: true,
          isStale: false,
        },
        summary: {
          totalUsers: metric,
          newUsers: metric,
          activeCreators: metric,
          totalEvents: metric,
          pageViews: metric,
          bookings: metric,
          invitationsSent: metric,
          acceptedInvitations: metric,
          inviteAcceptanceRate: metric,
        },
        eventTypes: [],
        topPages: [],
        sources: [],
        roles: [],
        generatedAt: '2026-09-12T08:30:00.000Z',
      });
      return;
    }
    if (pathname === '/api/analytics/timeseries') {
      await json(route, {
        metric: 'totalEvents',
        label: 'Hendelser',
        range: { key: '90daysAgo', label: '90 dager', days: 90 },
        series: [{ date: '2026-09-12', value: 1 }],
        totals: { current: 1, previous: 1, change: 0 },
        generatedAt: '2026-09-12T08:30:00.000Z',
      });
      return;
    }
    if (pathname === '/api/admin/academy/summary') {
      await json(route, { pendingPayoutsCount: 2, pendingPayoutsAmount: 3200 });
      return;
    }
    if (pathname === '/api/admin/academy/payouts') {
      await json(route, { payouts: [] });
      return;
    }
    if (pathname === '/api/admin/academy/instructors') {
      await json(route, { instructors: [] });
      return;
    }
    if (pathname === '/api/admin/academy/transfers') {
      await json(route, { transfers: [] });
      return;
    }
    if (pathname === '/api/admin/academy/refunds') {
      await json(route, { refunds: [] });
      return;
    }
    if (pathname === '/api/admin/activity-feed') {
      await json(route, {
        activities: [{
          id: 'activity-1',
          type: 'invite_request',
          title: 'Testaktivitet',
          description: 'Ny tilgangsforespørsel mottatt',
          user: {
            name: 'Testbruker',
            email: 'tester@example.com',
            profession: 'Fotograf',
          },
          timestamp: '2026-09-12T08:30:00.000Z',
          status: 'pending',
          priority: 'medium',
        }],
        total: 1,
        hasMore: false,
      });
      return;
    }
    if (pathname === '/api/admin/users') {
      await json(route, { users: [] });
      return;
    }
    if (pathname === '/api/admin/roles') {
      await json(route, { roles: [] });
      return;
    }
    if (pathname === '/api/admin/config-check') {
      await json(route, {
        status: 'ready',
        checks: {
          stripe: {
            secretKey: true,
            webhookSecret: true,
            enterprisePriceMonthly: true,
            enterprisePriceYearly: true,
          },
          mail: { gmailUser: true, gmailPass: true },
          ai: { anthropic: true },
          schema: {},
        },
        missing: [],
        checkedAt: '2026-09-12T08:30:00.000Z',
      });
      return;
    }
    if (pathname === '/api/admin/stripe/payment-status') {
      await json(route, {
        configured: true,
        webhookConfigured: true,
        recentRevenue: { last24h: 0, last7d: 0, last30d: 0 },
        activeSubscriptions: 8,
        counts: { succeeded: 0, failed: 0, refunded: 0 },
        events: [],
      });
      return;
    }
    if (pathname === '/api/invites/admin/requests') {
      await json(route, { invitations: [] });
      return;
    }
    if (pathname === '/api/prototype-tester-invites') {
      await json(route, { invites: [] });
      return;
    }
    if (pathname === '/api/admin/role-room/affiliates/overview') {
      await json(route, {
        config: {
          payoutsEnabled: false,
          stripeConfigured: true,
          connectWebhookConfigured: true,
          oneTiBCheckoutEnabled: false,
          maturityHoldDays: 30,
          currency: 'nok',
          agreementRegistryAvailable: true,
        },
        summary: {
          totalPartners: 0,
          activePartners: 0,
          connectReadyPartners: 0,
          partnersNeedingKyc: 0,
          availableMinor: 0,
          accruedMinor: 0,
          transferredMinor: 0,
          failedPayouts: 0,
        },
        partners: [],
        organizations: [],
        payouts: [],
        connectedBankPayouts: [],
      });
      return;
    }
    if (pathname === '/api/professions/all') {
      await json(route, { professions: [] });
      return;
    }
    if (pathname.startsWith('/api/user/kv/')) {
      await json(route, { value: null });
      return;
    }

    await json(route, {});
  });

  await page.goto('/admin', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('Trenger oppfølging', { exact: true })).toBeVisible({ timeout: 60_000 });
  for (const label of [
    '2 ventende søknader',
    '5 uleste varsler',
    '1 kritiske varsler',
    '4 feilrapporter',
    '3 tilbakemeldinger',
  ]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(/2 utbetalinger · 3[\s\u00a0\u202f]?200 kr/)).toBeVisible();
  await expect(page.getByText('Systemhelse', { exact: true })).toBeVisible();
  await expect(page.getByText('Verifisert administrasjonshendelse', { exact: true })).toBeVisible();

  // Funksjoner som allerede lå i main skal fortsatt være tilgjengelige.
  await expect(page.getByText('Customer Success-snapshot', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kjør CS-snapshot nå' })).toBeVisible();
  const workspaceCard = page
    .getByText('Workspace Control', { exact: true })
    .locator('xpath=ancestor::*[contains(@class,"MuiCard-root")]')
    .first();
  for (const action of ['Brukere & roller', 'Abonnementer', 'E-postmaler', 'Drift']) {
    await expect(workspaceCard.getByRole('button', { name: new RegExp(`^${action}`) })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /Affiliate & utbetalinger/ })).toBeVisible();
  await page.getByText('Lab', { exact: true }).click();
  await expect(page.getByRole('button', { name: /Prototype Feedback/ })).toBeVisible();

  await workspaceCard.getByRole('button', { name: /^Brukere & roller/ }).click();
  await expect(page.getByRole('heading', { name: 'Brukere & Roller' })).toBeVisible();
  await page.getByRole('button', { name: /^Overblikk/ }).click();

  await page.getByRole('button', { name: 'Statistikk', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Plattformstatistikk' })).toBeVisible();

  await page.getByRole('button', { name: 'Aktivitet', exact: true }).click();
  await expect(page.getByText('Testaktivitet', { exact: true })).toBeVisible();
  const pendingChip = page.locator('.MuiChip-root', { hasText: 'Venter' }).first();
  await expect(pendingChip).toBeVisible();
  expect(await pendingChip.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe('rgba(0, 0, 0, 0)');

  await page.getByRole('button', { name: 'Tilgangsforespørsler', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Prototype-testere' })).toBeVisible();

  await page.getByRole('button', { name: 'Affiliate & utbetalinger', exact: true }).click();
  await expect(page.getByTestId('role-room-affiliate-admin-panel')).toBeVisible();

  await page.getByRole('button', { name: 'Overblikk', exact: true }).click();
  await page.getByRole('button', { name: 'Sammendrag', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText('Trenger oppfølging', { exact: true })).toBeVisible();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  for (const pathname of [
    '/api/admin/dashboard',
    '/api/admin/pending-counts',
    '/api/admin/inbound-alerts/count',
    '/api/admin/activity-feed',
    '/api/prototype-tester-invites',
    '/api/admin/role-room/affiliates/overview',
  ]) {
    expect(requestedPaths.has(pathname), `${pathname} skal være kalt`).toBe(true);
  }
  expect(pageErrors).toEqual([]);
  expect(boundaryErrors).toEqual([]);
  expect(consoleErrors.filter((message) => message.includes('validateDOMNesting'))).toEqual([]);
});
