/**
 * Spillstudio-team (Fase 7e-1): kapabilitetskatalog, eier-only, sete-grense 409,
 * og at capabilities for et team løses fail-closed.
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { createGameTeamRouter } from './game-team-routes.js';
import { ALL_CAPABILITY_KEYS, CAPABILITIES, DEFAULT_ROLE_TEMPLATES, getMaxTeamSeats, resolveUserCapabilitiesForTeam } from './game-team-service.js';

type Handler = { match: RegExp; rows: unknown[] | ((params: unknown[]) => unknown[]) };
function makePool(handlers: Handler[] = []) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    for (const h of handlers) if (h.match.test(sql)) { const rows = typeof h.rows === 'function' ? h.rows(params) : h.rows; return { rows, rowCount: rows.length }; }
    return { rows: [], rowCount: 0 };
  });
  return { query, connect: async () => ({ query, release: () => undefined }) } as unknown as Pool & { query: typeof query };
}
const OWNER = 'sess-owner'; const MEMBER = 'sess-member';
function createApp(pool: Pool) {
  const app = express();
  app.use(express.json());
  app.use('/api/game/teams', createGameTeamRouter(pool, {
    activeSessions: new Map([
      [OWNER, { userId: 'u-owner', email: 'o@x.test', name: 'Eier', role: 'user', loginAt: '' }],
      [MEMBER, { userId: 'u-member', email: 'm@x.test', name: 'Medlem', role: 'user', loginAt: '' }],
    ]),
  }));
  return app;
}
const roleRow = (over: Record<string, unknown> = {}) => ({ id: '11111111-1111-4111-8111-111111111111', team_organization_id: 'u-owner', label: 'Narrativ designer', capabilities: { 'story.edit': true, 'scenes.edit': true }, is_owner_role: false, is_default_for_invite: true, display_order: 2, created_at: new Date(), updated_at: new Date(), ...over });

describe('game team routes', () => {
  it('katalogen har spill-kapabiliteter og fire default-roller', async () => {
    const res = await request(createApp(makePool())).get('/api/game/teams/capabilities').set('Authorization', `Bearer ${OWNER}`);
    expect(res.status).toBe(200);
    expect(res.body.data.groups.story).toContain('scenes.delete');
    expect(res.body.data.all).toEqual(expect.arrayContaining(['review.decide', 'plan.edit', 'platform.edit']));
    expect(CAPABILITIES.review).toContain('review.decide');
    expect(DEFAULT_ROLE_TEMPLATES.map((r) => r.label)).toEqual(['Eier', 'Produsent', 'Narrativ designer', 'Reviewer']);
    expect(DEFAULT_ROLE_TEMPLATES.find((r) => r.label === 'Reviewer')!.capabilities).toEqual({ 'review.decide': true });
    expect(ALL_CAPABILITY_KEYS.has('dancer_profile.view_team')).toBe(false);
  });

  it('ikke-eier får 403 på rolle-opprettelse; ubekreftet → 401', async () => {
    const forbidden = await request(createApp(makePool())).post('/api/game/teams/u-owner/roles').set('Authorization', `Bearer ${MEMBER}`).send({ label: 'X', capabilities: {} });
    expect(forbidden.status).toBe(403);
    const anon = await request(createApp(makePool())).get('/api/game/teams/u-owner/roles');
    expect(anon.status).toBe(401);
  });

  it('invitasjon ved sete-grense → 409 seat_limit_reached (Studio: 5 seter fra game_plan.limits)', async () => {
    const pool = makePool([
      { match: /FROM game_team_role WHERE id = \$1/, rows: [roleRow()] },
      { match: /COUNT\(\*\) FILTER \(WHERE status IN \('active','pending'\)\) AS member_count/, rows: [{ member_count: 4, active_count: 4 }] },
      { match: /is_default_for_invite = TRUE/, rows: [{ id: roleRow().id }] },
      { match: /FROM game_subscription s\s+JOIN game_plan p/, rows: [{ limits: { seats: 5 } }] },
      { match: /COUNT\(\*\)::int AS n FROM game_team_invite/, rows: [{ n: 1 }] },
    ]);
    const res = await request(createApp(pool)).post('/api/game/teams/u-owner/invites').set('Authorization', `Bearer ${OWNER}`)
      .send({ invitedEmail: 'ny@x.test', invitedRoleId: roleRow().id });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('seat_limit_reached');
  });

  it('uten abonnement er sete-taket 1 (kun eier); Studio-limits.seats respekteres', async () => {
    expect(await getMaxTeamSeats(makePool(), 'u-owner')).toBe(1);
    expect(await getMaxTeamSeats(makePool([{ match: /FROM game_subscription s/, rows: [{ limits: { seats: 5 } }] }]), 'u-owner')).toBe(5);
  });

  it('resolveUserCapabilitiesForTeam: eier = alle, aktivt medlem = rollens, fremmed = tom (fail closed)', async () => {
    const owner = await resolveUserCapabilitiesForTeam(makePool(), 'u-owner', 'u-owner');
    expect(owner.has('scenes.delete')).toBe(true);
    const memberPool = makePool([{ match: /JOIN game_team_role r ON r\.id = m\.game_role_id/, rows: (p) => (p[0] === 'u-member' && p[1] === 'u-owner' ? [{ capabilities: { 'story.edit': true, 'review.decide': false }, is_owner_role: false }] : []) }]);
    const member = await resolveUserCapabilitiesForTeam(memberPool, 'u-member', 'u-owner');
    expect([...member]).toEqual(['story.edit']);
    const stranger = await resolveUserCapabilitiesForTeam(memberPool, 'u-stranger', 'u-owner');
    expect(stranger.size).toBe(0);
    const sql = String(memberPool.query.mock.calls[0]?.[0]);
    expect(sql).toMatch(/org_kind = 'game_studio'/);
    expect(sql).toMatch(/m\.organization_id = \$2/);
  });
});
