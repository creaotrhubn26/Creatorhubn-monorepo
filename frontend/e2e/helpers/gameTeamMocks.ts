/**
 * gameTeamMocks — page.route()-installer for /api/game/teams og /api/game/invites
 * (Story Graph, Fase 7e-1). In-memory roller/medlemmer/invitasjoner med
 * sete-håndhevelse (409 seat_limit_reached) og PIN-flyt (PIN 123456).
 */
import type { Page, Route } from '@playwright/test';

type Rec = Record<string, unknown>;
const now = () => new Date().toISOString();
const ok = (data: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
const err = (status: number, error: string) => ({ status, contentType: 'application/json', body: JSON.stringify({ error }) });

export const GAME_TEAM_ORG = 'u-e2e';
export const GAME_TEAM_CAPABILITY_GROUPS = {
  team: ['team.invite_members', 'team.manage_roles', 'team.remove_members'],
  billing: ['billing.view', 'billing.manage'],
  story: ['story.edit', 'scenes.edit', 'scenes.delete'],
  review: ['review.request', 'review.decide'],
  production: ['plan.edit', 'platform.edit', 'exports.use'],
};

export async function installGameTeamMocks(page: Page, opts: { seatLimit?: number | null; members?: number } = {}): Promise<void> {
  const seatLimit = opts.seatLimit === undefined ? 5 : opts.seatLimit;
  const all = Object.values(GAME_TEAM_CAPABILITY_GROUPS).flat();
  const caps = (keys: string[]) => Object.fromEntries(all.map((k) => [k, keys.includes(k)]));
  const roles: Rec[] = [
    { id: 'role-owner', teamOrganizationId: GAME_TEAM_ORG, label: 'Eier', capabilities: caps(all), isOwnerRole: true, isDefaultForInvite: false, displayOrder: 0, createdAt: now(), updatedAt: now() },
    { id: 'role-producer', teamOrganizationId: GAME_TEAM_ORG, label: 'Produsent', capabilities: caps(['team.invite_members', 'story.edit', 'scenes.edit', 'scenes.delete', 'review.request', 'review.decide', 'plan.edit', 'platform.edit', 'exports.use']), isOwnerRole: false, isDefaultForInvite: false, displayOrder: 1, createdAt: now(), updatedAt: now() },
    { id: 'role-designer', teamOrganizationId: GAME_TEAM_ORG, label: 'Narrativ designer', capabilities: caps(['story.edit', 'scenes.edit', 'review.request', 'exports.use']), isOwnerRole: false, isDefaultForInvite: true, displayOrder: 2, createdAt: now(), updatedAt: now() },
    { id: 'role-reviewer', teamOrganizationId: GAME_TEAM_ORG, label: 'Reviewer', capabilities: caps(['review.decide']), isOwnerRole: false, isDefaultForInvite: false, displayOrder: 3, createdAt: now(), updatedAt: now() },
  ];
  const members: Rec[] = [
    { memberRowId: 'mem-owner', teamOrganizationId: GAME_TEAM_ORG, userId: GAME_TEAM_ORG, email: 'daniel@studio.test', status: 'active', enterpriseRole: 'admin', gameRoleId: 'role-owner', gameRoleLabel: 'Eier', invitedAt: now(), joinedAt: now() },
    { memberRowId: 'mem-kari', teamOrganizationId: GAME_TEAM_ORG, userId: 'u-kari', email: 'kari@studio.test', status: 'active', enterpriseRole: 'member', gameRoleId: 'role-designer', gameRoleLabel: 'Narrativ designer', invitedAt: now(), joinedAt: now() },
  ];
  for (let i = members.length; i < (opts.members ?? members.length); i += 1) members.push({ memberRowId: `mem-${i}`, teamOrganizationId: GAME_TEAM_ORG, userId: `u-${i}`, email: `m${i}@studio.test`, status: 'active', enterpriseRole: 'member', gameRoleId: 'role-designer', gameRoleLabel: 'Narrativ designer', invitedAt: now(), joinedAt: now() });
  const invites: Rec[] = [];
  const summary = () => {
    const pending = invites.filter((i) => !i.acceptedAt && !i.revokedAt).length;
    const used = members.length + pending;
    return { teamOrganizationId: GAME_TEAM_ORG, ownerUserId: GAME_TEAM_ORG, memberCount: members.length, activeMemberCount: members.length, seatLimit, seatRemaining: seatLimit == null ? null : Math.max(0, seatLimit - used), defaultInviteRoleId: 'role-designer' };
  };

  await page.route('**/api/game/teams/**', async (route: Route) => {
    const req = route.request();
    const method = req.method();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/game\/teams/, '');
    const body = (method === 'POST' || method === 'PATCH') ? (req.postDataJSON() as Rec | null) ?? {} : {};
    if (path === '/capabilities') return route.fulfill(ok({ groups: GAME_TEAM_CAPABILITY_GROUPS, all }));
    if (path === '/me' && method === 'GET') return route.fulfill(ok({ team: summary(), member: members[0], role: roles[0] }));
    if (path === '/me/capabilities') return route.fulfill(ok({ capabilities: all }));
    if (path === '/me/all') return route.fulfill(ok([{ team: summary(), member: members[0], role: roles[0], upgradeOfferSeenAt: null }]));
    if ((path === '/' || path === '') && method === 'POST') return route.fulfill(ok(summary()));
    let m = path.match(/^\/([^/]+)\/roles\/?$/);
    if (m && method === 'GET') return route.fulfill(ok(roles));
    if (m && method === 'POST') { const r = { id: `role-new-${roles.length}`, teamOrganizationId: GAME_TEAM_ORG, label: body.label, capabilities: body.capabilities ?? {}, isOwnerRole: false, isDefaultForInvite: !!body.isDefaultForInvite, displayOrder: roles.length, createdAt: now(), updatedAt: now() }; roles.push(r); return route.fulfill(ok(r, 201)); }
    m = path.match(/^\/([^/]+)\/roles\/([^/]+)$/);
    if (m && method === 'PATCH') { const r = roles.find((x) => x.id === m![2]); if (!r) return route.fulfill(err(404, 'not_found')); Object.assign(r, body, { updatedAt: now() }); return route.fulfill(ok(r)); }
    if (m && method === 'DELETE') { const i = roles.findIndex((x) => x.id === m![2]); if (i >= 0) roles.splice(i, 1); return route.fulfill(ok({})); }
    m = path.match(/^\/([^/]+)\/members\/?$/);
    if (m && method === 'GET') return route.fulfill(ok(members));
    m = path.match(/^\/([^/]+)\/members\/([^/]+)$/);
    if (m && method === 'PATCH') { const mem = members.find((x) => x.memberRowId === m![2]); if (!mem) return route.fulfill(err(404, 'not_found')); const r = roles.find((x) => x.id === body.gameRoleId); Object.assign(mem, { gameRoleId: body.gameRoleId, gameRoleLabel: r?.label ?? null }); return route.fulfill(ok(mem)); }
    if (m && method === 'DELETE') { const i = members.findIndex((x) => x.memberRowId === m![2]); if (i >= 0) members.splice(i, 1); return route.fulfill(ok({})); }
    m = path.match(/^\/([^/]+)\/invites\/?$/);
    if (m && method === 'GET') return route.fulfill(ok(invites));
    if (m && method === 'POST') {
      if (seatLimit != null && members.length + invites.filter((i) => !i.acceptedAt && !i.revokedAt).length >= seatLimit) return route.fulfill(err(409, 'seat_limit_reached'));
      const r = roles.find((x) => x.id === body.invitedRoleId);
      const inv = { token: `gti_${invites.length + 1}`, teamOrganizationId: GAME_TEAM_ORG, invitedEmail: body.invitedEmail, invitedRoleId: body.invitedRoleId, invitedRoleLabel: r?.label ?? null, invitedByUserId: GAME_TEAM_ORG, expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(), acceptedAt: null, acceptedUserId: null, revokedAt: null, createdAt: now() };
      invites.push(inv);
      return route.fulfill(ok({ invite: inv, seatRemaining: summary().seatRemaining }, 201));
    }
    m = path.match(/^\/([^/]+)\/invites\/([^/]+)$/);
    if (m && method === 'DELETE') { const inv = invites.find((x) => x.token === m![2]); if (inv) inv.revokedAt = now(); return route.fulfill(ok({})); }
    return route.fulfill(err(404, 'not_found'));
  });

  await page.route('**/api/game/invites/**', async (route: Route) => {
    const req = route.request();
    const method = req.method();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/game\/invites/, '');
    const body = method === 'POST' ? (req.postDataJSON() as Rec | null) ?? {} : {};
    let m = path.match(/^\/([^/]+)\/info$/);
    if (m) {
      if (m[1] === 'gti_expired') return route.fulfill(err(410, 'expired'));
      if (m[1] !== 'gti_ok') return route.fulfill(err(404, 'not_found'));
      return route.fulfill(ok({ token: 'gti_ok', invitedEmailMasked: 'ka***@studio.test', invitedRoleLabel: 'Narrativ designer', teamOrganizationId: GAME_TEAM_ORG, expiresAt: new Date(Date.now() + 86_400_000).toISOString(), pinSentAt: null, pinLockedAt: null, status: 'pending' }));
    }
    m = path.match(/^\/([^/]+)\/request-pin$/);
    if (m && method === 'POST') return route.fulfill(ok({ sent: true }));
    m = path.match(/^\/([^/]+)\/accept-with-pin$/);
    if (m && method === 'POST') {
      if (body.pin !== '123456') return route.fulfill(err(401, 'pin_invalid'));
      return route.fulfill(ok({ sessionToken: 'sess-new', user: { userId: 'u-new', email: 'kari@studio.test', name: body.fullName ?? 'Ny', role: 'user', loginAt: now() }, teamOrganizationId: GAME_TEAM_ORG, gameRoleId: 'role-designer' }));
    }
    return route.fulfill(err(404, 'not_found'));
  });
}
