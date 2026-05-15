/**
 * danceMocks — sentral page.route()-installer for hele /api/dance/* surfacen.
 *
 * Bruksmønster i en spec:
 *
 *   import { installDanceMocks } from './helpers/danceMocks';
 *
 *   test.beforeEach(async ({ page }) => {
 *     await installDanceMocks(page);              // defaults
 *   });
 *
 *   test('expired invite', async ({ page }) => {
 *     await installDanceMocks(page, {
 *       overrides: { invites: { 'invite-token-pending-abc': { status: 'expired' } } },
 *     });
 *     // ...
 *   });
 *
 * Designvalg:
 *  - Alle endepunkter wrapper data i { success: true, data: ... } siden det
 *    er kontrakten dance-services forventer (se readJson i service-filene).
 *  - Ukjente PATCH/POST returnerer 200 med en plausibel record så specs ikke
 *    crasher på sideeffekter — om du trenger eksplisitt avvisning, sett
 *    `rejectUnknownWrites: true` eller bruk per-test page.route() over denne.
 *  - Hver mock teller kall i `getCallCounts(page)` så assertions kan verifisere
 *    at f.eks. PATCH bare ble fyrt én gang (autosave-debounce).
 */
import type { Page, Route, Request as PWRequest } from '@playwright/test';
import { fx } from '../fixtures/dance';

// ─── Call-counters (per page) ───────────────────────────────────────────

const COUNTERS = new WeakMap<Page, Map<string, number>>();

function bumpCounter(page: Page, key: string): void {
  const map = COUNTERS.get(page) ?? new Map();
  map.set(key, (map.get(key) ?? 0) + 1);
  COUNTERS.set(page, map);
}

export function getCallCounts(page: Page): Record<string, number> {
  const map = COUNTERS.get(page) ?? new Map();
  return Object.fromEntries(map);
}

export function getCallCount(page: Page, key: string): number {
  return COUNTERS.get(page)?.get(key) ?? 0;
}

export function resetCallCounts(page: Page): void {
  COUNTERS.set(page, new Map());
}

// ─── Options ────────────────────────────────────────────────────────────

export interface DanceMockOverrides {
  /** Erstatt status / pinSentAt / etc på en spesifikk invite. */
  invites?: Record<string, Partial<(typeof fx.invites)[number]>>;
  /** Erstatt aktiv subscription. */
  subscription?: Partial<typeof fx.subscription>;
  /** Forced HTTP-status for et endpoint-mønster. F.eks. { 'POST /api/dance/invites/.+/accept-with-pin': 401 } */
  forceStatus?: Record<string, number>;
}

export interface DanceMockOptions {
  overrides?: DanceMockOverrides;
  /** Hvis true: PATCH/POST mot ukjente paths gir 404 i stedet for 200. */
  rejectUnknownWrites?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function ok<T>(data: T, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data }),
  };
}

function err(status: number, error: string, detail?: string) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, error, detail }),
  };
}

function matchForce(opts: DanceMockOptions | undefined, method: string, url: string): number | null {
  const forced = opts?.overrides?.forceStatus;
  if (!forced) return null;
  for (const pattern of Object.keys(forced)) {
    const [m, p] = pattern.split(' ', 2);
    if (m === method && new RegExp(`^${p}$`).test(url)) return forced[pattern];
  }
  return null;
}

// Standard error-reasons som InviteLandingPage og andre UI-er kjenner igjen.
// Når mock returnerer en av disse i `error`-feltet får brukeren en pen melding.
const ERROR_REASON_BY_STATUS: Record<number, string> = {
  401: 'wrong_pin',
  409: 'already_accepted',
  410: 'expired',
  423: 'pin_locked',
  503: 'mailer_not_configured',
};

function matchInviteOverride(opts: DanceMockOptions | undefined, token: string) {
  return opts?.overrides?.invites?.[token];
}

// ─── Main installer ─────────────────────────────────────────────────────

export async function installDanceMocks(page: Page, opts: DanceMockOptions = {}): Promise<void> {
  // Backend-uavhengige stubs — vite-proxy kan ikke nå localhost:3000 i e2e,
  // så vi fyller hullene før de blokkerer.
  await page.route(/\/api\/branding\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) }),
  );
  await page.route(/\/api\/professions\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }),
  );
  await page.route(/\/api\/auth\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) }),
  );

  // Fellesregel for hele /api/dance/* — vi forgrener internt.
  await page.route(/\/api\/dance\/.*/, async (route: Route) => {
    const req: PWRequest = route.request();
    const method = req.method();
    const urlPath = new URL(req.url()).pathname;
    bumpCounter(page, `${method} ${urlPath}`);

    const forced = matchForce(opts, method, urlPath);
    if (forced !== null) {
      const reason = ERROR_REASON_BY_STATUS[forced] ?? `forced_${forced}`;
      return route.fulfill(err(forced, reason, `Forced status ${forced}`));
    }

    // ─── Teams ────────────────────────────────────────────────────────
    if (urlPath === '/api/dance/teams/me' && method === 'GET') {
      const team = fx.teams[0];
      const member = fx.members.find((m) => m.memberRowId === 'mem-1');
      const role = fx.roles.find((r) => r.id === 'role-owner');
      return route.fulfill(ok({ team, member, role }));
    }
    if (urlPath === '/api/dance/teams/me/all' && method === 'GET') {
      const memberships = fx.teams.map((team) => {
        const member = fx.members.find((m) => m.teamOrganizationId === team.teamOrganizationId && m.enterpriseRole === 'owner') ?? fx.members[0];
        const role = fx.roles.find((r) => r.id === member.danceRoleId) ?? null;
        return { team, member, role, upgradeOfferSeenAt: null };
      });
      return route.fulfill(ok(memberships));
    }
    if (urlPath === '/api/dance/teams/me/capabilities' && method === 'GET') {
      // Owner — full capability-set
      const ownerRole = fx.roles.find((r) => r.isOwnerRole);
      const caps = ownerRole ? Object.keys(ownerRole.capabilities).filter((k) => ownerRole.capabilities[k]) : [];
      return route.fulfill(ok({ capabilities: caps }));
    }
    if (urlPath === '/api/dance/teams/' && method === 'POST') {
      return route.fulfill(ok(fx.teams[0]));
    }

    // /api/dance/teams/:teamId/roles
    const rolesMatch = urlPath.match(/^\/api\/dance\/teams\/([^/]+)\/roles\/?$/);
    if (rolesMatch && method === 'GET') {
      const teamId = decodeURIComponent(rolesMatch[1]);
      return route.fulfill(ok(fx.roles.filter((r) => r.teamOrganizationId === teamId)));
    }
    if (rolesMatch && method === 'POST') {
      const body = req.postDataJSON?.() ?? {};
      const newRole = {
        id: `role-new-${Date.now()}`,
        teamOrganizationId: decodeURIComponent(rolesMatch[1]),
        label: body.label ?? 'Ny rolle',
        capabilities: body.capabilities ?? {},
        isOwnerRole: false,
        isDefaultForInvite: body.isDefaultForInvite ?? false,
        displayOrder: body.displayOrder ?? 99,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return route.fulfill(ok(newRole));
    }

    const roleIdMatch = urlPath.match(/^\/api\/dance\/teams\/([^/]+)\/roles\/([^/]+)$/);
    if (roleIdMatch && method === 'PATCH') {
      const teamId = decodeURIComponent(roleIdMatch[1]);
      const roleId = decodeURIComponent(roleIdMatch[2]);
      const body = req.postDataJSON?.() ?? {};
      const role = fx.roles.find((r) => r.id === roleId && r.teamOrganizationId === teamId);
      if (!role) return route.fulfill(err(404, 'role_not_found'));
      return route.fulfill(ok({ ...role, ...body, updatedAt: new Date().toISOString() }));
    }
    if (roleIdMatch && method === 'DELETE') {
      return route.fulfill(ok({}, 200));
    }

    // /api/dance/teams/:teamId/members
    const membersMatch = urlPath.match(/^\/api\/dance\/teams\/([^/]+)\/members\/?$/);
    if (membersMatch && method === 'GET') {
      const teamId = decodeURIComponent(membersMatch[1]);
      return route.fulfill(ok(fx.members.filter((m) => m.teamOrganizationId === teamId)));
    }

    const memberIdMatch = urlPath.match(/^\/api\/dance\/teams\/([^/]+)\/members\/([^/]+)$/);
    if (memberIdMatch && method === 'PATCH') {
      const memberId = decodeURIComponent(memberIdMatch[2]);
      const body = req.postDataJSON?.() ?? {};
      const member = fx.members.find((m) => m.memberRowId === memberId);
      if (!member) return route.fulfill(err(404, 'member_not_found'));
      const role = fx.roles.find((r) => r.id === body.danceRoleId);
      return route.fulfill(ok({ ...member, danceRoleId: body.danceRoleId, danceRoleLabel: role?.label ?? null }));
    }
    if (memberIdMatch && method === 'DELETE') {
      return route.fulfill(ok({}, 200));
    }

    // /api/dance/teams/:teamId/invites
    const invitesMatch = urlPath.match(/^\/api\/dance\/teams\/([^/]+)\/invites\/?$/);
    if (invitesMatch && method === 'GET') {
      const teamId = decodeURIComponent(invitesMatch[1]);
      return route.fulfill(ok(fx.invites.filter((i) => i.teamOrganizationId === teamId)));
    }
    if (invitesMatch && method === 'POST') {
      const teamId = decodeURIComponent(invitesMatch[1]);
      const body = req.postDataJSON?.() ?? {};
      const role = fx.roles.find((r) => r.id === body.invitedRoleId);
      const newInvite = {
        token: `invite-token-new-${Date.now()}`,
        teamOrganizationId: teamId,
        invitedEmail: body.invitedEmail,
        invitedEmailMasked: body.invitedEmail?.replace(/^(.).*(@)/, '$1***$2'),
        invitedRoleId: body.invitedRoleId,
        invitedRoleLabel: role?.label ?? null,
        invitedByUserId: 'user-owner-1',
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        acceptedAt: null,
        acceptedUserId: null,
        revokedAt: null,
        createdAt: new Date().toISOString(),
        status: 'pending',
        pinSentAt: null,
        pinLockedAt: null,
      };
      return route.fulfill(ok({ invite: newInvite, seatRemaining: fx.teams[0].seatRemaining! - 1 }));
    }
    const inviteTokenMatch = urlPath.match(/^\/api\/dance\/teams\/([^/]+)\/invites\/([^/]+)$/);
    if (inviteTokenMatch && method === 'DELETE') {
      return route.fulfill(ok({}, 200));
    }

    // ─── Invites (public) ─────────────────────────────────────────────
    // /api/dance/invites/:token/info
    const inviteInfoMatch = urlPath.match(/^\/api\/dance\/invites\/([^/]+)\/info$/);
    if (inviteInfoMatch && method === 'GET') {
      const token = decodeURIComponent(inviteInfoMatch[1]);
      const base = fx.invites.find((i) => i.token === token);
      if (!base) return route.fulfill(err(404, 'invite_not_found'));
      const override = matchInviteOverride(opts, token);
      const merged = { ...base, ...override };
      if (merged.status === 'expired') {
        return route.fulfill(err(410, 'invite_expired', 'Invitasjonen er utløpt — be om en ny.'));
      }
      if (merged.status === 'revoked') {
        return route.fulfill(err(410, 'invite_revoked', 'Invitasjonen er trukket tilbake.'));
      }
      if (merged.status === 'pin_locked') {
        return route.fulfill(err(423, 'pin_locked', 'PIN er låst — kontakt Studio-eier for ny invitasjon.'));
      }
      return route.fulfill(ok({
        token: merged.token,
        invitedEmailMasked: merged.invitedEmailMasked,
        invitedRoleLabel: merged.invitedRoleLabel,
        teamOrganizationId: merged.teamOrganizationId,
        expiresAt: merged.expiresAt,
        pinSentAt: merged.pinSentAt,
        pinLockedAt: merged.pinLockedAt,
        status: merged.status,
      }));
    }

    // /api/dance/invites/:token/request-pin
    const requestPinMatch = urlPath.match(/^\/api\/dance\/invites\/([^/]+)\/request-pin$/);
    if (requestPinMatch && method === 'POST') {
      return route.fulfill(ok({ sent: true, sentAt: new Date().toISOString() }));
    }

    // /api/dance/invites/:token/accept-with-pin
    const acceptPinMatch = urlPath.match(/^\/api\/dance\/invites\/([^/]+)\/accept-with-pin$/);
    if (acceptPinMatch && method === 'POST') {
      const token = decodeURIComponent(acceptPinMatch[1]);
      const body = req.postDataJSON?.() ?? {};
      if (body.pin !== '123456') {
        return route.fulfill(err(401, 'wrong_pin', 'Feil PIN. Sjekk e-posten og prøv igjen.'));
      }
      const invite = fx.invites.find((i) => i.token === token);
      const role = fx.roles.find((r) => r.id === invite?.invitedRoleId);
      return route.fulfill(ok({
        sessionToken: 'mock-session-token',
        user: {
          userId: 'user-new-' + Date.now(),
          email: invite?.invitedEmail ?? 'new@example.com',
          name: body.fullName ?? 'Ny Bruker',
          role: 'member',
          loginAt: new Date().toISOString(),
        },
        teamOrganizationId: invite?.teamOrganizationId ?? fx.teams[0].teamOrganizationId,
        danceRoleId: role?.id ?? 'role-dancer',
      }));
    }

    // ─── Choreography ─────────────────────────────────────────────────
    if (urlPath === '/api/dance/choreography' && method === 'GET') {
      // List-endpoint returnerer ChoreographyHeader[] (uten segments).
      const url = new URL(req.url());
      const projId = url.searchParams.get('projectId');
      let list = fx.choreographies as Array<Record<string, unknown> & { projectId: string | null }>;
      if (projId) list = list.filter((c) => c.projectId === projId || c.projectId === null);
      const headers = list.map((c) => ({
        id: c.id,
        ownerUserId: c.ownerUserId,
        projectId: c.projectId,
        title: c.title,
        choreographer: c.choreographer ?? null,
        totalDurationSec: c.totalDurationSec ?? 0,
        segmentCount: Array.isArray((c as Record<string, unknown>).segments) ? (c as { segments: unknown[] }).segments.length : 0,
        updatedAt: c.updatedAt,
      }));
      return route.fulfill(ok(headers));
    }
    if (urlPath === '/api/dance/choreography' && method === 'POST') {
      const body = req.postDataJSON?.() ?? {};
      const created = {
        id: `cho-new-${Date.now()}`,
        teamOrganizationId: fx.teams[0].teamOrganizationId,
        title: body.title ?? 'Untitled',
        projectId: body.projectId ?? null,
        musicTitle: null,
        musicSignedUrl: null,
        durationSec: 0,
        bpm: body.bpm ?? 120,
        segments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return route.fulfill(ok(created));
    }

    const choMatch = urlPath.match(/^\/api\/dance\/choreography\/([^/]+)$/);
    if (choMatch && method === 'GET') {
      const id = decodeURIComponent(choMatch[1]);
      const c = fx.choreographies.find((c) => c.id === id);
      if (!c) return route.fulfill(err(404, 'choreography_not_found'));
      // Fixturer har musicTitle uten en signedUrl; gi tilbake en blob-stub
      // slik at <audio>-elementet i ChoreographyBuilder får et src og
      // play-toggle ikke blir disabled i e2e.
      const withAudio = (c as Record<string, unknown>).musicTitle && !(c as Record<string, unknown>).musicSignedUrl
        ? { ...c, musicSignedUrl: `blob:mock-music-${c.id}` }
        : c;
      return route.fulfill(ok(withAudio));
    }
    if (choMatch && method === 'PATCH') {
      const id = decodeURIComponent(choMatch[1]);
      const body = req.postDataJSON?.() ?? {};
      const c = fx.choreographies.find((c) => c.id === id);
      if (!c) return route.fulfill(err(404, 'choreography_not_found'));
      return route.fulfill(ok({ ...c, ...body, updatedAt: new Date().toISOString() }));
    }
    if (choMatch && method === 'DELETE') {
      return route.fulfill(ok({}, 200));
    }

    const choSegMatch = urlPath.match(/^\/api\/dance\/choreography\/([^/]+)\/segments$/);
    if (choSegMatch && method === 'PUT') {
      const body = req.postDataJSON?.() ?? {};
      return route.fulfill(ok({ segments: body.segments ?? [] }));
    }

    const choMusicMatch = urlPath.match(/^\/api\/dance\/choreography\/([^/]+)\/music$/);
    if (choMusicMatch && method === 'POST') {
      const id = decodeURIComponent(choMusicMatch[1]);
      const c = fx.choreographies.find((c) => c.id === id);
      return route.fulfill(ok({
        ...c,
        musicTitle: 'mock-upload.mp3',
        musicSignedUrl: `blob:mock-music-${id}`,
        updatedAt: new Date().toISOString(),
      }));
    }

    // ─── Video clips ──────────────────────────────────────────────────
    if (urlPath === '/api/dance/video-clips' && method === 'GET') {
      const url = new URL(req.url());
      let list = fx.videoClips;
      const choreoId = url.searchParams.get('choreographyId');
      const projId = url.searchParams.get('projectId');
      const kind = url.searchParams.get('kind');
      if (choreoId) list = list.filter((c) => c.choreographyId === choreoId);
      if (projId) list = list.filter((c) => c.projectId === projId);
      if (kind) list = list.filter((c) => c.kind === kind);
      return route.fulfill(ok(list));
    }
    if (urlPath === '/api/dance/video-clips' && method === 'POST') {
      const created = {
        id: `clip-new-${Date.now()}`,
        ownerUserId: 'user-owner-1',
        projectId: null,
        choreographyId: null,
        segmentId: null,
        kind: 'rehearsal',
        title: 'Ny opplasting',
        storageKey: `mock/clip-new-${Date.now()}.mp4`,
        signedUrl: `blob:mock-clip-new-${Date.now()}`,
        durationSec: 60,
        mime: 'video/mp4',
        sourceUserId: 'user-owner-1',
        capturedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return route.fulfill(ok(created));
    }

    const clipMatch = urlPath.match(/^\/api\/dance\/video-clips\/([^/]+)$/);
    if (clipMatch && method === 'GET') {
      const id = decodeURIComponent(clipMatch[1]);
      const c = fx.videoClips.find((c) => c.id === id);
      return c ? route.fulfill(ok(c)) : route.fulfill(err(404, 'clip_not_found'));
    }
    if (clipMatch && method === 'PATCH') {
      const id = decodeURIComponent(clipMatch[1]);
      const body = req.postDataJSON?.() ?? {};
      const c = fx.videoClips.find((c) => c.id === id);
      if (!c) return route.fulfill(err(404, 'clip_not_found'));
      return route.fulfill(ok({ ...c, ...body, updatedAt: new Date().toISOString() }));
    }
    if (clipMatch && method === 'DELETE') {
      return route.fulfill(ok({}, 200));
    }

    const clipAnnMatch = urlPath.match(/^\/api\/dance\/video-clips\/([^/]+)\/annotations$/);
    if (clipAnnMatch && method === 'GET') {
      const clipId = decodeURIComponent(clipAnnMatch[1]);
      const list = fx.annotations
        .filter((a) => a.clipId === clipId)
        .map((a) => ({
          // Legacy fixtures mangler category/confidence; inject defaults.
          category: null,
          confidence: null,
          ...a,
        }));
      return route.fulfill(ok(list));
    }
    if (clipAnnMatch && method === 'POST') {
      const clipId = decodeURIComponent(clipAnnMatch[1]);
      const body = req.postDataJSON?.() ?? {};
      const created = {
        id: `ann-new-${Date.now()}`,
        ownerUserId: 'user-owner-1',
        clipId,
        parentId: body.parentId ?? null,
        authorUserId: 'user-owner-1',
        body: body.body ?? '',
        timestampSec: body.timestampSec ?? 0,
        endSec: body.endSec ?? null,
        countNumber: body.countNumber ?? null,
        segmentId: body.segmentId ?? null,
        targetDancerIds: body.targetDancerIds ?? [],
        isDirectorPin: body.isDirectorPin ?? false,
        status: 'open',
        drawing: body.drawing ?? null,
        voiceNoteSignedUrl: null,
        drawingKeyframes: body.drawingKeyframes ?? null,
        category: body.category ?? null,
        confidence: body.confidence ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return route.fulfill(ok(created));
    }

    const annIdMatch = urlPath.match(/^\/api\/dance\/video-annotations\/([^/]+)$/);
    if (annIdMatch && method === 'PATCH') {
      const id = decodeURIComponent(annIdMatch[1]);
      const body = req.postDataJSON?.() ?? {};
      const a = fx.annotations.find((a) => a.id === id);
      if (!a) return route.fulfill(err(404, 'annotation_not_found'));
      return route.fulfill(ok({
        category: null,
        confidence: null,
        ...a,
        ...body,
        updatedAt: new Date().toISOString(),
      }));
    }
    if (annIdMatch && method === 'DELETE') {
      return route.fulfill(ok({}, 200));
    }

    const voiceMatch = urlPath.match(/^\/api\/dance\/video-clips\/([^/]+)\/voice-note$/);
    if (voiceMatch && method === 'POST') {
      return route.fulfill(ok({ storageKey: 'mock/voice.webm', signedUrl: 'blob:mock-voice' }));
    }

    const eventsMatch = urlPath.match(/^\/api\/dance\/video-clips\/([^/]+)\/events$/);
    if (eventsMatch && method === 'GET') {
      // EventSource — return empty stream that closes immediately.
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: { 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        body: ': ping\n\n',
      });
    }

    // ─── Studio ops (classes / instructors / rooms / movement vocab) ──
    // Real service base: /api/dance/studio/...
    const studioOpsMatch = urlPath.match(/^\/api\/dance\/studio\/(classes|instructors|rooms|movement-vocab)(?:\/([^/]+))?$/);
    if (studioOpsMatch) {
      const entity = studioOpsMatch[1];
      const id = studioOpsMatch[2] ? decodeURIComponent(studioOpsMatch[2]) : null;
      const collection = (
        entity === 'classes' ? fx.classes :
        entity === 'instructors' ? fx.instructors :
        entity === 'rooms' ? fx.rooms :
        fx.movementVocab
      );
      if (method === 'GET' && !id) return route.fulfill(ok(collection));
      if (method === 'POST') {
        const body = req.postDataJSON?.() ?? {};
        return route.fulfill(ok({ id: `${entity}-new-${Date.now()}`, ...body }));
      }
      if (method === 'PATCH' && id) {
        const body = req.postDataJSON?.() ?? {};
        const existing = (collection as Array<{ id: string }>).find((x) => x.id === id);
        return route.fulfill(ok({ ...(existing ?? { id }), ...body }));
      }
      if (method === 'DELETE' && id) return route.fulfill(ok({}, 200));
    }

    // Class enrollments + room bookings (studio-ops sub-entities)
    const studioSubMatch = urlPath.match(/^\/api\/dance\/studio\/(class-enrollments|room-bookings)(?:\/([^/]+))?$/);
    if (studioSubMatch) {
      if (method === 'GET' && !studioSubMatch[2]) return route.fulfill(ok([]));
      if (method === 'POST') {
        const body = req.postDataJSON?.() ?? {};
        return route.fulfill(ok({ id: `${studioSubMatch[1]}-new-${Date.now()}`, ...body }));
      }
      if (method === 'DELETE') return route.fulfill(ok({}, 200));
    }

    // ─── Admin ops (performances / music / reel / grants / invoices / union) ─
    // Real service base: /api/dance/ops/...
    const adminOpsMatch = urlPath.match(/^\/api\/dance\/ops\/(performances|music|reel|grants|invoices|union)(?:\/([^/]+))?$/);
    if (adminOpsMatch) {
      const entity = adminOpsMatch[1];
      const id = adminOpsMatch[2] ? decodeURIComponent(adminOpsMatch[2]) : null;
      // No fixtures for admin-ops yet — return empty list. Hver POST returnerer
      // det innsendte body-et med en autogenerert id.
      if (method === 'GET' && !id) return route.fulfill(ok([]));
      if (method === 'POST') {
        const body = req.postDataJSON?.() ?? {};
        return route.fulfill(ok({ id: `${entity}-new-${Date.now()}`, ...body }));
      }
      if (method === 'PATCH' && id) {
        const body = req.postDataJSON?.() ?? {};
        return route.fulfill(ok({ id, ...body }));
      }
      if (method === 'DELETE' && id) return route.fulfill(ok({}, 200));
    }

    // ─── Rehearsals ────────────────────────────────────────────────────
    if (urlPath === '/api/dance/rehearsals' && method === 'GET') {
      const url = new URL(req.url());
      let list = fx.rehearsals;
      const choreoId = url.searchParams.get('choreographyId');
      if (choreoId) list = list.filter((r) => r.choreographyId === choreoId);
      return route.fulfill(ok(list));
    }
    if (urlPath === '/api/dance/rehearsals' && method === 'POST') {
      const body = req.postDataJSON?.() ?? {};
      return route.fulfill(ok({ id: `reh-new-${Date.now()}`, ...body }));
    }
    const rehMatch = urlPath.match(/^\/api\/dance\/rehearsals\/([^/]+)$/);
    if (rehMatch && (method === 'PATCH' || method === 'PUT')) {
      const id = decodeURIComponent(rehMatch[1]);
      const body = req.postDataJSON?.() ?? {};
      const existing = fx.rehearsals.find((r) => r.id === id);
      return route.fulfill(ok({ ...(existing ?? { id }), ...body }));
    }

    // ─── Profiles ──────────────────────────────────────────────────────
    if (urlPath === '/api/dance/profiles' && method === 'GET') {
      return route.fulfill(ok(fx.dancers));
    }
    const profMatch = urlPath.match(/^\/api\/dance\/profiles\/([^/]+)$/);
    if (profMatch && method === 'GET') {
      const id = decodeURIComponent(profMatch[1]);
      const d = fx.dancers.find((d) => d.id === id);
      return d ? route.fulfill(ok(d)) : route.fulfill(err(404, 'profile_not_found'));
    }
    if (profMatch && method === 'PUT') {
      const body = req.postDataJSON?.() ?? {};
      return route.fulfill(ok(body));
    }

    // ─── Injuries ──────────────────────────────────────────────────────
    if (urlPath === '/api/dance/injuries' && method === 'GET') {
      return route.fulfill(ok(fx.injuries));
    }
    if (urlPath === '/api/dance/injuries' && method === 'POST') {
      const body = req.postDataJSON?.() ?? {};
      return route.fulfill(ok({ id: `inj-new-${Date.now()}`, ...body }));
    }

    // ─── Billing & addons ──────────────────────────────────────────────
    if (urlPath === '/api/dance/billing/plans' && method === 'GET') {
      return route.fulfill(ok(fx.plans));
    }
    if (urlPath === '/api/dance/billing/subscription' && method === 'GET') {
      const merged = { ...fx.subscription, ...(opts.overrides?.subscription ?? {}) };
      // Fixture lagrer plan-referansen som `planId`; service-laget bruker
      // `planSlug`. Aliaser slik at useDancePlanGate kan resolve planen.
      const planRef = (merged as { planId?: string; planSlug?: string }).planSlug
        ?? (merged as { planId?: string }).planId
        ?? null;
      return route.fulfill(ok({ ...merged, planId: planRef, planSlug: planRef }));
    }
    if (urlPath === '/api/dance/billing/checkout' && method === 'POST') {
      return route.fulfill(ok({ url: 'https://checkout.stripe.com/mock-session' }));
    }
    if (urlPath === '/api/dance/addons' && method === 'GET') {
      return route.fulfill(ok(fx.addons));
    }
    const addonMatch = urlPath.match(/^\/api\/dance\/addons\/([^/]+)(?:\/(trial|cancel))?$/);
    if (addonMatch && method === 'POST') {
      const slug = decodeURIComponent(addonMatch[1]);
      const a = fx.addons.find((a) => a.slug === slug);
      return route.fulfill(ok({ ...a, active: addonMatch[2] !== 'cancel' }));
    }

    // ─── Formations ────────────────────────────────────────────────────
    if (urlPath.startsWith('/api/dance/formations') && method === 'GET') {
      return route.fulfill(ok([]));
    }
    if (urlPath.startsWith('/api/dance/formations') && method === 'PUT') {
      const body = req.postDataJSON?.() ?? {};
      const arr = Array.isArray((body as { formations?: unknown }).formations)
        ? (body as { formations: Array<Record<string, unknown>> }).formations
        : [];
      const now = new Date().toISOString();
      const records = arr.map((f, i) => ({
        id: typeof f.id === 'string' && f.id.length > 0 ? f.id : `fmt-${Date.now()}-${i}`,
        ownerUserId: 'user-owner-1',
        projectId: (body as { projectId?: string | null }).projectId ?? null,
        label: typeof f.label === 'string' ? f.label : 'Formasjon',
        notes: (f.notes as string | null | undefined) ?? null,
        stageWidthM: (f.stageWidthM as number | undefined) ?? 12,
        stageDepthM: (f.stageDepthM as number | undefined) ?? 8,
        positions: Array.isArray(f.positions) ? f.positions : [],
        transitionFromId: (f.transitionFromId as string | null | undefined) ?? null,
        displayOrder: (f.displayOrder as number | undefined) ?? i,
        startSec: (f.startSec as number | null | undefined) ?? null,
        endSec: (f.endSec as number | null | undefined) ?? null,
        transitionNote: (f.transitionNote as string | null | undefined) ?? null,
        tags: Array.isArray(f.tags) ? f.tags : [],
        transitionPaths: Array.isArray(f.transitionPaths) ? f.transitionPaths : [],
        createdAt: now,
        updatedAt: now,
      }));
      return route.fulfill(ok(records));
    }
    if (urlPath.startsWith('/api/dance/formations') && (method === 'POST' || method === 'PATCH')) {
      const body = req.postDataJSON?.() ?? {};
      const now = new Date().toISOString();
      return route.fulfill(ok({
        id: `fmt-${Date.now()}`,
        ownerUserId: 'user-owner-1',
        projectId: null,
        label: 'Formasjon',
        notes: null,
        stageWidthM: 12,
        stageDepthM: 8,
        positions: [],
        transitionFromId: null,
        displayOrder: 0,
        startSec: null,
        endSec: null,
        transitionNote: null,
        tags: [],
        transitionPaths: [],
        createdAt: now,
        updatedAt: now,
        ...body,
      }));
    }

    // ─── Studio (legacy alias) ─────────────────────────────────────────
    if (urlPath.startsWith('/api/dance/studio') && method === 'GET') {
      return route.fulfill(ok({}));
    }

    // ─── Unknown ──────────────────────────────────────────────────────
    if (opts.rejectUnknownWrites && method !== 'GET') {
      return route.fulfill(err(404, 'mock_not_handled', `Ingen mock for ${method} ${urlPath}`));
    }
    // Permissive default — empty success
    return route.fulfill(ok([]));
  });

  // Portretter eksponert via /__fixtures/dance/portraits/*.jpg.
  // Vite-dev-serveren server filer fra public/, så vi viderelednings-mapper
  // via page.route i stedet for å kopiere filer inn i public/.
  await page.route(/\/__fixtures\/dance\/portraits\/(.+)/, async (route) => {
    const url = route.request().url();
    const filename = url.split('/').pop()!;
    const path = require('path');
    const fs = require('fs');
    const filepath = path.resolve(__dirname, '..', 'fixtures', 'dance', 'portraits', filename);
    if (!fs.existsSync(filepath)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({
      status: 200,
      contentType: 'image/jpeg',
      body: fs.readFileSync(filepath),
    });
  });

  resetCallCounts(page);
}
