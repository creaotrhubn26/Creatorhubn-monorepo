/**
 * role-room-marketing-cockpit-routes.ts — Marketing Cockpit summary for
 * The Role Room as a brand. Aggregates the 8 Meta Graph API permissions
 * we own into one response so the AdminRoom tab can render in one fetch.
 *
 * Per-section graceful degradation: if one Meta call fails (rate-limit,
 * permission-gate, missing token), only that section returns `{ok:false}`.
 * The other sections still ship. The UI is built to surface what works
 * even when the rest is degraded.
 *
 * Env (Render):
 *   THEROLERROOM_PAGE_ID            — FB Page ID for The Role Room
 *   THEROLERROOM_PAGE_ACCESS_TOKEN  — Long-lived Page-scoped token (permanent)
 *   THEROLERROOM_IG_USER_ID         — IG Business user_id linked to that Page
 *   THEROLERROOM_TRACKED_HASHTAGS   — comma-separated hashtags to monitor
 *                                     (default: norskcasting,castingdirector,norskfilm,theroleroom,nordiccasting)
 */

import type { Application, Request, Response } from "express";

export interface SetupMarketingCockpitDeps {
  app: Application;
  requireAdminOrDemoBypass: (req: Request, res: Response) => boolean;
}

const META_GRAPH_BASE = "https://graph.facebook.com/v21.0";

interface SectionOk<T> { ok: true; data: T; error?: undefined; }
interface SectionErr { ok: false; data: null; error: string; status?: number; }
type Section<T> = SectionOk<T> | SectionErr;

function ok<T>(data: T): SectionOk<T> { return { ok: true, data }; }
function fail(error: string, status?: number): SectionErr {
  return { ok: false, data: null, error, status };
}

async function metaGet(path: string, params: Record<string, string>): Promise<{
  ok: boolean; status: number; body: Record<string, unknown>;
}> {
  const qs = new URLSearchParams(params).toString();
  try {
    const resp = await fetch(`${META_GRAPH_BASE}/${path}?${qs}`);
    const body = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: resp.ok, status: resp.status, body };
  } catch (error) {
    return { ok: false, status: 0, body: { error: String(error) } };
  }
}

function extractErrorMessage(body: Record<string, unknown>): string {
  const err = body.error as Record<string, unknown> | undefined;
  if (err && typeof err.message === "string") return err.message;
  return "Meta Graph API failed";
}

async function loadProfile(pageId: string, pageToken: string) {
  if (!pageId || !pageToken) return fail("THEROLERROOM_PAGE_ID/TOKEN not configured");
  const r = await metaGet(pageId, {
    fields: "id,name,about,fan_count,category,website,picture,phone",
    access_token: pageToken,
  });
  if (!r.ok) return fail(extractErrorMessage(r.body), r.status);
  const b = r.body;
  return ok({
    id: String(b.id ?? pageId),
    name: typeof b.name === "string" ? b.name : null,
    about: typeof b.about === "string" ? b.about : null,
    fanCount: typeof b.fan_count === "number" ? b.fan_count : 0,
    category: typeof b.category === "string" ? b.category : null,
    website: typeof b.website === "string" ? b.website : null,
    phone: typeof b.phone === "string" ? b.phone : null,
    pictureUrl: (() => {
      const pic = b.picture as Record<string, unknown> | undefined;
      const d = pic?.data as Record<string, unknown> | undefined;
      return typeof d?.url === "string" ? d.url : null;
    })(),
  });
}

async function loadMentions(pageId: string, pageToken: string, limit = 10) {
  if (!pageId || !pageToken) return fail("THEROLERROOM_PAGE_ID/TOKEN not configured");
  const r = await metaGet(`${pageId}/tagged`, {
    fields: "id,from,message,created_time,permalink_url",
    limit: String(limit),
    access_token: pageToken,
  });
  if (!r.ok) return fail(extractErrorMessage(r.body), r.status);
  const data = Array.isArray(r.body.data) ? r.body.data as Array<Record<string, unknown>> : [];
  return ok({
    count: data.length,
    recent: data.map((m) => ({
      id: String(m.id ?? ""),
      fromName: (m.from as Record<string, unknown> | undefined)?.name ?? null,
      fromId: (m.from as Record<string, unknown> | undefined)?.id ?? null,
      message: typeof m.message === "string" ? m.message : "",
      createdTime: typeof m.created_time === "string" ? m.created_time : null,
      permalinkUrl: typeof m.permalink_url === "string" ? m.permalink_url : null,
    })),
  });
}

async function loadCurrentCta(pageId: string, pageToken: string) {
  if (!pageId || !pageToken) return fail("THEROLERROOM_PAGE_ID/TOKEN not configured");
  const r = await metaGet(pageId, {
    fields: "id,phone,website",
    access_token: pageToken,
  });
  if (!r.ok) return fail(extractErrorMessage(r.body), r.status);
  const phone = typeof r.body.phone === "string" ? r.body.phone : null;
  const website = typeof r.body.website === "string" ? r.body.website : null;
  return ok({
    inferred: phone
      ? { type: "CALL_NOW", link: `tel:${phone}` }
      : (website ? { type: "LEARN_MORE", link: website } : null),
    rawFields: { phone, website },
  });
}

async function loadIg(igUserId: string, accessToken: string) {
  if (!igUserId || !accessToken) return fail("THEROLERROOM_IG_USER_ID/TOKEN not configured");
  const r = await metaGet(igUserId, {
    fields: "id,username,followers_count,media_count,name,biography,website",
    access_token: accessToken,
  });
  if (!r.ok) return fail(extractErrorMessage(r.body), r.status);
  const b = r.body;
  // Also fetch upcoming events; failure here doesn't bring the whole section down.
  const eventsR = await metaGet(`${igUserId}/upcoming_events`, {
    fields: "id,title,start_time,end_time,description,venue",
    limit: "10",
    access_token: accessToken,
  });
  const events = eventsR.ok && Array.isArray(eventsR.body.data)
    ? (eventsR.body.data as Array<Record<string, unknown>>).map((e) => ({
        id: String(e.id ?? ""),
        title: typeof e.title === "string" ? e.title : "(no title)",
        startTime: typeof e.start_time === "string" ? e.start_time : null,
        endTime: typeof e.end_time === "string" ? e.end_time : null,
      }))
    : [];
  return ok({
    userId: String(b.id ?? igUserId),
    username: typeof b.username === "string" ? b.username : null,
    name: typeof b.name === "string" ? b.name : null,
    biography: typeof b.biography === "string" ? b.biography : null,
    website: typeof b.website === "string" ? b.website : null,
    followersCount: typeof b.followers_count === "number" ? b.followers_count : 0,
    mediaCount: typeof b.media_count === "number" ? b.media_count : 0,
    upcomingEvents: events,
    upcomingEventsOk: eventsR.ok,
  });
}

async function loadHashtagStats(igUserId: string, accessToken: string, tags: string[]) {
  if (!igUserId || !accessToken) return fail("THEROLERROOM_IG_USER_ID/TOKEN not configured");
  if (tags.length === 0) return ok({ tracked: [] });
  const results = await Promise.all(tags.map(async (tag) => {
    const cleanTag = tag.replace(/^#/, "").trim();
    if (!cleanTag) return { tag, ok: false, error: "empty tag", hashtagId: null, recentMediaCount: 0 };
    const searchR = await metaGet("ig_hashtag_search", {
      q: cleanTag, user_id: igUserId, access_token: accessToken,
    });
    if (!searchR.ok) return {
      tag: cleanTag, ok: false, error: extractErrorMessage(searchR.body),
      hashtagId: null, recentMediaCount: 0,
    };
    const data = Array.isArray(searchR.body.data) ? searchR.body.data as Array<Record<string, unknown>> : [];
    const hashtagId = data.length > 0 ? String(data[0]?.id ?? "") : null;
    if (!hashtagId) return { tag: cleanTag, ok: true, hashtagId: null, recentMediaCount: 0 };
    // Count recent posts (limit=50 enough for trend signal)
    const mediaR = await metaGet(`${hashtagId}/recent_media`, {
      user_id: igUserId, fields: "id", limit: "50", access_token: accessToken,
    });
    const recentMediaCount = mediaR.ok && Array.isArray(mediaR.body.data)
      ? (mediaR.body.data as unknown[]).length : 0;
    return { tag: cleanTag, ok: true, hashtagId, recentMediaCount };
  }));
  return ok({ tracked: results });
}

async function loadLeads(pageId: string, pageToken: string) {
  if (!pageId || !pageToken) return fail("THEROLERROOM_PAGE_ID/TOKEN not configured");
  const r = await metaGet(`${pageId}/leadgen_forms`, {
    fields: "id,name,status,leads_count,created_time", access_token: pageToken,
  });
  if (!r.ok) return fail(extractErrorMessage(r.body), r.status);
  const data = Array.isArray(r.body.data) ? r.body.data as Array<Record<string, unknown>> : [];
  return ok({
    formCount: data.length,
    forms: data.map((f) => ({
      id: String(f.id ?? ""),
      name: typeof f.name === "string" ? f.name : null,
      status: typeof f.status === "string" ? f.status : null,
      leadsCount: typeof f.leads_count === "number" ? f.leads_count : 0,
      createdTime: typeof f.created_time === "string" ? f.created_time : null,
    })),
  });
}

function defaultHashtags(): string[] {
  const raw = (process.env.THEROLERROOM_TRACKED_HASHTAGS || "").trim();
  if (raw) return raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ["norskcasting", "castingdirector", "norskfilm", "theroleroom", "nordiccasting"];
}

export function setupMarketingCockpitRoutes(deps: SetupMarketingCockpitDeps): void {
  const { app, requireAdminOrDemoBypass } = deps;

  app.get("/api/role-room/marketing-cockpit/summary", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;

    const pageId = (process.env.THEROLERROOM_PAGE_ID || "").trim();
    const pageToken = (process.env.THEROLERROOM_PAGE_ACCESS_TOKEN || "").trim();
    const igUserId = (process.env.THEROLERROOM_IG_USER_ID || "").trim();
    const hashtags = defaultHashtags();
    const t0 = Date.now();

    // Run all 6 sections in parallel; any failure is captured in its own section.
    const [profile, mentions, cta, ig, leads] = await Promise.all([
      loadProfile(pageId, pageToken),
      loadMentions(pageId, pageToken, 10),
      loadCurrentCta(pageId, pageToken),
      loadIg(igUserId, pageToken),
      loadLeads(pageId, pageToken),
    ]);
    // Hashtags depends on IG token — run after IG resolves so we can pass the right token.
    const hashtagStats = await loadHashtagStats(igUserId, pageToken, hashtags);

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      configured: {
        pageId: !!pageId,
        pageToken: !!pageToken,
        igUserId: !!igUserId,
        trackedHashtags: hashtags,
      },
      profile,
      mentions,
      cta,
      ig,
      leads,
      hashtags: hashtagStats,
    });
  });

  // Health-probe — fast yes/no whether at least profile is reachable.
  app.get("/api/role-room/marketing-cockpit/health", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const pageId = (process.env.THEROLERROOM_PAGE_ID || "").trim();
    const pageToken = (process.env.THEROLERROOM_PAGE_ACCESS_TOKEN || "").trim();
    if (!pageId || !pageToken) {
      res.json({ ok: false, reason: "env_missing", configured: { pageId: !!pageId, pageToken: !!pageToken } });
      return;
    }
    const profile = await loadProfile(pageId, pageToken);
    res.json({
      ok: profile.ok,
      reason: profile.ok ? undefined : profile.error,
      pageName: profile.ok ? profile.data.name : null,
    });
  });
}
