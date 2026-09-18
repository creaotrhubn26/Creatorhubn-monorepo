import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { createGameBillingRouter } from './game-billing-routes.js';
import { resolveGamePlanForProject } from './game-plan-gate.js';
import { SOLO_FALLBACK_PLAN } from './game-billing-service.js';

type Handler = { match: RegExp; rows: unknown[] | ((params: unknown[]) => unknown[]) };
function makePool(handlers: Handler[] = []) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    for (const h of handlers) {
      if (h.match.test(sql)) {
        const rows = typeof h.rows === 'function' ? h.rows(params) : h.rows;
        return { rows, rowCount: rows.length };
      }
    }
    return { rows: [], rowCount: 0 };
  });
  return { query } as unknown as Pool & { query: typeof query };
}

const USER = 'sess-user';
const ADMIN = 'sess-admin';
function createApp(pool: Pool) {
  const app = express();
  app.use(express.json());
  app.use('/api/game/billing', createGameBillingRouter(pool, {
    activeSessions: new Map([
      [USER, { userId: 'u1', email: 'u1@example.com', name: 'U1', role: 'user', loginAt: '' }],
      [ADMIN, { userId: 'a1', email: 'a1@example.com', name: 'A1', role: 'admin', loginAt: '' }],
    ]),
  }));
  return app;
}

const planRow = (over: Record<string, unknown> = {}) => ({
  slug: 'pro', name: 'Pro', description: null, monthly_price_kr: 149, yearly_price_kr: 1490,
  stripe_monthly_price_id: null, stripe_yearly_price_id: null,
  features: ['play', 'share_links'], limits: {}, trial_days: 14, is_active: true, is_featured: true, display_order: 20,
  created_at: new Date(), updated_at: new Date(), ...over,
});

describe('game billing routes', () => {
  it('GET plans uten token → 401; med token → aktive planer (uten persona-felt)', async () => {
    const app = createApp(makePool([{ match: /FROM game_plan/, rows: [planRow()] }]));
    expect((await request(app).get('/api/game/billing/plans')).status).toBe(401);
    const res = await request(app).get('/api/game/billing/plans').set('Authorization', `Bearer ${USER}`);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ slug: 'pro', monthlyPriceKr: 149, features: ['play', 'share_links'] });
    expect(res.body.data[0]).not.toHaveProperty('persona');
  });

  it('GET me uten abonnement → solo-fallback (fra DB når raden finnes)', async () => {
    const app = createApp(makePool([{ match: /FROM game_plan WHERE slug = \$1/, rows: (p) => (p[0] === 'solo' ? [planRow({ slug: 'solo', name: 'Solo', features: ['play'], limits: { maxElements: 200 } })] : []) }]));
    const res = await request(app).get('/api/game/billing/me').set('Authorization', `Bearer ${USER}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ subscription: null, active: false, plan: { slug: 'solo', limits: { maxElements: 200 } } });
  });

  it('GET me med aktivt abonnement → abonnementets plan; utløpt comp → solo', async () => {
    const future = new Date(Date.now() + 86_400_000);
    const pool = makePool([
      { match: /FROM game_subscription WHERE user_id/, rows: [{ user_id: 'u1', plan_slug: 'pro', billing_period: 'comp', status: 'comp', comp_expires_at: future, cancel_at_period_end: false, created_at: new Date(), updated_at: new Date() }] },
      { match: /FROM game_plan WHERE slug = \$1/, rows: (p) => [planRow({ slug: String(p[0]) })] },
    ]);
    const res = await request(createApp(pool)).get('/api/game/billing/me').set('Authorization', `Bearer ${USER}`);
    expect(res.body.data).toMatchObject({ active: true, plan: { slug: 'pro' } });

    const expired = makePool([
      { match: /FROM game_subscription WHERE user_id/, rows: [{ user_id: 'u1', plan_slug: 'pro', billing_period: 'comp', status: 'comp', comp_expires_at: new Date(Date.now() - 1000), cancel_at_period_end: false, created_at: new Date(), updated_at: new Date() }] },
      { match: /FROM game_plan WHERE slug = \$1/, rows: (p) => [planRow({ slug: String(p[0]) })] },
    ]);
    const res2 = await request(createApp(expired)).get('/api/game/billing/me').set('Authorization', `Bearer ${USER}`);
    expect(res2.body.data).toMatchObject({ active: false, plan: { slug: 'solo' } });
  });

  it('admin-ruter krever admin-rolle; POST admin/plans → 201', async () => {
    const pool = makePool([{ match: /INSERT INTO game_plan/, rows: (p) => [planRow({ slug: p[0], name: p[1] })] }]);
    const app = createApp(pool);
    expect((await request(app).get('/api/game/billing/admin/plans').set('Authorization', `Bearer ${USER}`)).status).toBe(403);
    const res = await request(app).post('/api/game/billing/admin/plans').set('Authorization', `Bearer ${ADMIN}`)
      .send({ slug: 'team', name: 'Team', features: ['play'], monthlyPriceKr: 990 });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('team');
    const insert = pool.query.mock.calls.find(([sql]) => /INSERT INTO game_plan/.test(String(sql)));
    expect(String(insert?.[0])).not.toMatch(/persona/);
  });

  it('checkout uten Stripe-konfig → 503 stripe_not_configured', async () => {
    const res = await request(createApp(makePool())).post('/api/game/billing/checkout-session').set('Authorization', `Bearer ${USER}`)
      .send({ planSlug: 'pro', billingPeriod: 'monthly', successUrl: 'https://x.test/ok', cancelUrl: 'https://x.test/no' });
    expect(res.status).toBe(503);
  });
});

describe('game-plan-gate — prosjekteierens plan', () => {
  it('bruker created_by på casting_projects og faller tilbake til solo når DB feiler', async () => {
    const pool = makePool([
      { match: /SELECT created_by FROM casting_projects/, rows: [{ created_by: 'owner-1' }] },
      { match: /FROM game_subscription WHERE user_id/, rows: (p) => (p[0] === 'owner-1' ? [{ user_id: 'owner-1', plan_slug: 'studio', billing_period: 'monthly', status: 'active', cancel_at_period_end: false, created_at: new Date(), updated_at: new Date() }] : []) },
      { match: /FROM game_plan WHERE slug = \$1/, rows: (p) => [planRow({ slug: String(p[0]), features: ['play', 'runtime_packages'] })] },
    ]);
    const pp = await resolveGamePlanForProject(pool, 'proj-1');
    expect(pp).toMatchObject({ ownerUserId: 'owner-1', active: true, plan: { slug: 'studio' } });

    const broken = { query: vi.fn(async () => { throw new Error('relation does not exist'); }) } as unknown as Pool;
    const fallback = await resolveGamePlanForProject(broken, 'proj-1');
    expect(fallback.plan).toBe(SOLO_FALLBACK_PLAN);
    expect(fallback.active).toBe(false);
  });
});
