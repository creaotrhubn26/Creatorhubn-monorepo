/**
 * role-room-agent-recommendations-routes.ts
 *
 * Agent-anbefalinger: AI-innsikt-kort fra The Role Room Agent. Eier
 * role_room_agent_recommendation (mig 284). Talenten/produsenten ser åpne
 * anbefalinger, kan «Utfør» (done) eller avvise (dismissed).
 *
 *   GET    /api/role-room/agent/recommendations?projectId=&status=
 *   PATCH  /api/role-room/agent/recommendations/:id   body: { status }
 *   POST   /api/role-room/agent/recommendations/generate  body: { projectId? }
 *     → henter ekte signaler (innlegg, engasjement, DM-er, budsjett …) og lar
 *       Claude lage skreddersydde anbefalinger. Faller tilbake til en kuratert
 *       katalog hvis Claude ikke er konfigurert eller kallet feiler.
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

interface SessionLike {
  userId: string;
  email?: string;
  name?: string;
}

export interface RoleRoomAgentRecommendationsRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
}

type RecStatus = "new" | "done" | "dismissed";

interface RecommendationRow {
  id: string;
  owner_user_id: string;
  project_id: string | null;
  type: string;
  title: string;
  insight: string | null;
  stat_value: string | null;
  stat_label: string | null;
  cta_label: string | null;
  icon: string | null;
  status: RecStatus;
  created_at: string;
  updated_at: string;
}

function mapRow(r: Record<string, unknown>): RecommendationRow {
  return {
    id: String(r.id),
    owner_user_id: String(r.owner_user_id),
    project_id: r.project_id == null ? null : String(r.project_id),
    type: String(r.type),
    title: String(r.title),
    insight: r.insight == null ? null : String(r.insight),
    stat_value: r.stat_value == null ? null : String(r.stat_value),
    stat_label: r.stat_label == null ? null : String(r.stat_label),
    cta_label: r.cta_label == null ? null : String(r.cta_label),
    icon: r.icon == null ? null : String(r.icon),
    status: (["new", "done", "dismissed"].includes(String(r.status)) ? r.status : "new") as RecStatus,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

// Kuratert v1-katalog (rr-agent-in-*). Ekte Claude-generering kommer senere.
const SEED_CATALOG: Array<Omit<RecommendationRow, "id" | "owner_user_id" | "project_id" | "status" | "created_at" | "updated_at">> = [
  { type: "publiser_naa", title: "Publiser nå", insight: "Beste publiseringstidspunkt er akkurat nå — rekkevidden topper seg.", stat_value: "19:30", stat_label: "optimal tid", cta_label: "Utfør", icon: "schedule" },
  { type: "quiz", title: "Quiz-idé", insight: "Kjør en quiz i Story for å løfte engasjementet blant følgerne dine.", stat_value: "+38%", stat_label: "snitt engasjement", cta_label: "Utfør · Lag quiz", icon: "quiz" },
  { type: "boost", title: "Boost innlegg", insight: "Ett innlegg presterer langt over snittet — boost det mens det er varmt.", stat_value: "3,2×", stat_label: "over snittet", cta_label: "Utfør · Boost", icon: "trending_up" },
  { type: "svar_lead", title: "Svar på lead", insight: "En varm lead venter på svar — følg opp innen en time for best konvertering.", stat_value: "1t", stat_label: "ideell responstid", cta_label: "Utfør · Svar", icon: "contact_page" },
  { type: "budsjett", title: "Juster budsjett", insight: "Flytt annonsebudsjett til kanalen som gir lavest kost per lead.", stat_value: "−24%", stat_label: "kost per lead", cta_label: "Utfør", icon: "payments" },
  { type: "viral", title: "Viral-mulighet", insight: "Et innlegg har uvanlig høy delingsrate — lag oppfølging mens momentet varer.", stat_value: "+212%", stat_label: "deling siste 7d", cta_label: "Utfør · Følg opp", icon: "bolt" },
  { type: "reels", title: "Reels-anbefaling", insight: "Reels gir mest rekkevidde for kontoen din nå — lag en kort om dette temaet.", stat_value: "4,1×", stat_label: "rekkevidde vs foto", cta_label: "Utfør · Lag Reel", icon: "movie" },
  { type: "merch", title: "Merch-idé", insight: "Produksjonen har et engasjert publikum — vurder branded merch som inntektskanal.", stat_value: "3", stat_label: "leverandører klare", cta_label: "Utfør · Se merch", icon: "storefront" },
  { type: "poll", title: "Poll-idé", insight: "Kjør en avstemning i Story — polls gir høy interaksjon og verdifull innsikt.", stat_value: "+46%", stat_label: "interaksjon i Story", cta_label: "Utfør · Lag poll", icon: "poll" },
  { type: "livestream", title: "Livestream-idé", insight: "Gå live om dette temaet — direktesendinger bygger nærhet og prioriteres i feeden.", stat_value: "2,7×", stat_label: "visningstid live", cta_label: "Utfør · Planlegg live", icon: "sensors" },
  { type: "giveaway", title: "Giveaway", insight: "En konkurranse kan gi et hopp i følgere og rekkevidde foran lanseringen.", stat_value: "+1 200", stat_label: "snitt nye følgere", cta_label: "Utfør · Sett opp", icon: "card_giftcard" },
  { type: "testimonial", title: "Kunde-testimonial", insight: "Del en kundeomtale — sosialt bevis konverterer bedre enn egen markedsføring.", stat_value: "+31%", stat_label: "konvertering", cta_label: "Utfør · Del", icon: "format_quote" },
  { type: "story_serie", title: "Story-serie", insight: "Lag en flerdelt Story-serie — sekvenser holder følgerne lenger i Story-ringen.", stat_value: "5 deler", stat_label: "anbefalt lengde", cta_label: "Utfør · Bygg serie", icon: "auto_stories" },
  { type: "beste_tid", title: "Beste-tid-skift", insight: "Publikum er mest aktivt på et nytt tidspunkt — flytt fast publisering dit.", stat_value: "07:30", stat_label: "ny topp-tid", cta_label: "Utfør", icon: "schedule" },
  { type: "samarbeid_merke", title: "Merke-samarbeid", insight: "Et merke med overlappende publikum passer for et co-branding-samarbeid.", stat_value: "82%", stat_label: "publikum-overlapp", cta_label: "Utfør · Ta kontakt", icon: "handshake" },
  { type: "partner", title: "Partner-mulighet", insight: "Agenten fant en relevant samarbeidspartner basert på din profil og marked.", stat_value: "1", stat_label: "foreslått partner", cta_label: "Utfør · Se partner", icon: "diversity_3" },
  { type: "konkurrent", title: "Konkurrent-trekk", insight: "En konkurrent gjorde nylig et trekk verdt å reagere på i din strategi.", stat_value: "Nytt", stat_label: "oppdaget i dag", cta_label: "Utfør · Se analyse", icon: "insights" },
  { type: "ny_pillar", title: "Ny content-pillar", insight: "Et tema mangler i planen — en ny pillar kan balansere innholdsmiksen.", stat_value: "+1", stat_label: "foreslått pillar", cta_label: "Utfør · Legg til", icon: "category" },
  { type: "kommentar_vinn", title: "Vinn kommentarfeltet", insight: "Svar raskt på nye kommentarer — rask respons gir mer rekkevidde og lojalitet.", stat_value: "< 1t", stat_label: "ideell responstid", cta_label: "Utfør · Svar nå", icon: "forum" },
  { type: "dm_oppfolging", title: "DM-oppfølging", insight: "Du har ubesvarte DM-er fra engasjerte følgere — følg opp før de blir kalde.", stat_value: "7", stat_label: "ventende DM-er", cta_label: "Utfør · Åpne innboks", icon: "mark_chat_unread" },
  { type: "ugc", title: "UGC-mulighet", insight: "En følger har laget innhold om deg — del det som sosialt bevis (med kreditering).", stat_value: "Nytt", stat_label: "UGC funnet", cta_label: "Utfør · Del", icon: "photo_library" },
  { type: "hashtag", title: "Hashtag-forslag", insight: "Nye relevante hashtags er i vekst i din nisje — legg dem til neste innlegg.", stat_value: "5", stat_label: "foreslåtte tags", cta_label: "Utfør · Bruk", icon: "tag" },
  { type: "sesong_kampanje", title: "Sesong-kampanje", insight: "En sesong nærmer seg — planlegg en kampanje mens interessen bygger seg opp.", stat_value: "3 uker", stat_label: "til topp", cta_label: "Utfør · Planlegg", icon: "calendar_month" },
  { type: "webinar", title: "Webinar-idé", insight: "Publikummet ditt stiller gjentatte spørsmål — et webinar kan svare og konvertere.", stat_value: "Høy", stat_label: "etterspørsel", cta_label: "Utfør · Sett opp", icon: "co_present" },
  { type: "pr", title: "PR-mulighet", insight: "En journalist dekker temaet ditt — ta kontakt mens saken er aktuell.", stat_value: "1", stat_label: "relevant journalist", cta_label: "Utfør · Kontakt", icon: "newspaper" },
  { type: "henvisning", title: "Henvisnings-program", insight: "Fornøyde kunder er din beste vekstkanal — sett opp et henvisningsprogram.", stat_value: "+18%", stat_label: "vekst-potensial", cta_label: "Utfør · Aktiver", icon: "group_add" },
  { type: "case_study", title: "Case-study", insight: "Et nylig prosjekt gjorde det svært bra — gjør det til en case-study.", stat_value: "Klar", stat_label: "for publisering", cta_label: "Utfør · Lag", icon: "auto_stories" },
  { type: "gjenbruk", title: "Gjenbruk innhold", insight: "Et topp-innlegg kan gjenbrukes i nytt format for å nå flere uten ekstra arbeid.", stat_value: "3", stat_label: "format-ideer", cta_label: "Utfør · Gjenbruk", icon: "recycling" },
  { type: "konsistens", title: "Hold konsistensen", insight: "Postefrekvensen din har sunket — jevn posting holder rekkevidden oppe.", stat_value: "3×/uke", stat_label: "anbefalt takt", cta_label: "Utfør · Planlegg", icon: "event_repeat" },
];

// Tillatte MUI-ikon-navn Claude kan velge mellom (matcher AgentRecommendationCard).
const ALLOWED_ICONS = new Set<string>([
  ...SEED_CATALOG.map((c) => c.icon).filter((x): x is string => typeof x === "string"),
  "auto_awesome", "lightbulb", "campaign", "favorite", "visibility", "share",
  "people", "rocket_launch", "analytics", "edit_calendar", "celebration",
]);

type GeneratedRec = Pick<RecommendationRow, "type" | "title" | "insight" | "stat_value" | "stat_label" | "cta_label" | "icon">;

/**
 * Henter ekte signaler for en bruker (+ valgfritt prosjekt). Hver spørring er
 * defensiv: feiler én (mangler tabell/kolonne) hoppes den bare over, slik at
 * generering aldri kollapser på et enkelt signal.
 */
async function gatherSignals(pool: Pool, ownerUserId: string, projectId: string | null): Promise<Record<string, unknown>> {
  const signals: Record<string, unknown> = {};
  const safe = async (fn: () => Promise<void>): Promise<void> => { try { await fn(); } catch { /* signal utilgjengelig */ } };

  // Innlegg + engasjement siste 60 dager
  await safe(async () => {
    const r = await pool.query(
      `SELECT
         count(*) FILTER (WHERE status = 'draft')                      AS drafts,
         count(*) FILTER (WHERE status = 'scheduled')                  AS scheduled,
         count(*) FILTER (WHERE status IN ('posted','published'))      AS posted,
         count(*) FILTER (WHERE scheduled_for > now())                 AS upcoming,
         coalesce(sum(likes),0)        AS likes,
         coalesce(sum(comments),0)     AS comments,
         coalesce(sum(shares),0)       AS shares,
         coalesce(sum(impressions),0)  AS impressions,
         coalesce(sum(engagements),0)  AS engagements,
         max(coalesce(posted_at, scheduled_for, created_at)) AS last_activity
       FROM social_media_posts
       WHERE author_user_id = $1 AND coalesce(posted_at, created_at) > now() - interval '60 days'`,
      [ownerUserId],
    );
    if (r.rows[0]) signals.posts = r.rows[0];
  });

  // Topp-innlegg etter engasjement
  await safe(async () => {
    const r = await pool.query(
      `SELECT platform, left(coalesce(caption,''), 120) AS caption, likes, comments, shares, impressions, engagements
         FROM social_media_posts
        WHERE author_user_id = $1 AND status IN ('posted','published')
        ORDER BY coalesce(engagements,0) DESC NULLS LAST LIMIT 1`,
      [ownerUserId],
    );
    if (r.rows[0]) signals.topPost = r.rows[0];
  });

  // Uleste Instagram-DM-er
  await safe(async () => {
    const r = await pool.query(
      `SELECT coalesce(sum(unread_count),0)::int AS unread, count(*)::int AS conversations
         FROM role_room_instagram_conversations WHERE user_id = $1`,
      [ownerUserId],
    );
    if (r.rows[0]) signals.instagramDms = r.rows[0];
  });

  // Leads (defensiv — kolonnenavn kan variere)
  await safe(async () => {
    const r = await pool.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'new')::int AS new_leads
         FROM leads WHERE user_id = $1`,
      [ownerUserId],
    );
    if (r.rows[0]) signals.leads = r.rows[0];
  });

  // Annonsebudsjett for prosjektet (siste periode)
  if (projectId) {
    await safe(async () => {
      const r = await pool.query(
        `SELECT period, max_spend_nok FROM role_room_ads_budgets WHERE project_id = $1 ORDER BY period DESC LIMIT 1`,
        [projectId],
      );
      if (r.rows[0]) signals.adsBudget = r.rows[0];
    });
  }

  return signals;
}

/**
 * Lar Claude lage skreddersydde anbefalinger ut fra signalene. Returnerer null
 * hvis Claude ikke er konfigurert eller kallet/parsing feiler → caller faller
 * tilbake til katalogen. Følger samme lazy-import-mønster som feed-strategy.
 */
async function generateWithClaude(signals: Record<string, unknown>): Promise<GeneratedRec[] | null> {
  if (process.env.ROLE_ROOM_AGENT_CLAUDE_ENABLED !== "true" || !process.env.ANTHROPIC_API_KEY) {
    return null;
  }
  let client: any;
  try {
    // @ts-ignore — optional SDK
    const mod: any = await import("@anthropic-ai/sdk");
    const AnthropicCtor = mod.default ?? mod.Anthropic;
    client = new AnthropicCtor({ apiKey: process.env.ANTHROPIC_API_KEY });
  } catch {
    return null;
  }

  const iconList = Array.from(ALLOWED_ICONS).join(", ");
  const prompt = `Du er The Role Room Agent — en norsk vekst- og innholdsstrateg for skapere og produksjoner.
Under er EKTE signaler fra brukerens konto (JSON). Lag 5–7 konkrete, handlingsrettede anbefalinger basert på disse tallene.

SIGNALER:
${JSON.stringify(signals, null, 2)}

Regler:
- Forankre "stat_value" i ekte tall fra signalene der det er mulig (f.eks. faktisk antall uleste DM-er, faktisk engasjement). Ikke dikt opp tall som motsier signalene.
- Hvis et signal mangler, gi en generell, fortsatt nyttig anbefaling — men ikke påstå falske tall.
- "title": kort (1–4 ord). "insight": én konkret setning på norsk. "stat_label": kort enhet/kontekst.
- "cta_label" skal starte med "Utfør" (f.eks. "Utfør · Svar nå").
- "icon" MÅ være ett av: ${iconList}.
- "type": kort snake_case-slug som beskriver anbefalingen.

Svar KUN med gyldig JSON, ingen markdown:
{"recommendations":[{"type":"...","title":"...","insight":"...","stat_value":"...","stat_label":"...","cta_label":"...","icon":"..."}]}`;

  try {
    const response = await client.messages.create({
      model: process.env.ROLE_ROOM_AGENT_CLAUDE_MODEL || "claude-sonnet-4-5",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    let text = "";
    for (const block of response.content ?? []) {
      if (block.type === "text" && typeof block.text === "string") text += block.text;
    }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1));
    const raw = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    const recs: GeneratedRec[] = raw
      .filter((x: unknown): x is Record<string, unknown> => Boolean(x && typeof x === "object" && typeof (x as any).title === "string"))
      .slice(0, 8)
      .map((x: Record<string, unknown>) => {
        const str = (v: unknown, max: number): string | null =>
          typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
        const icon = str(x.icon, 40);
        return {
          type: (str(x.type, 60) || "innsikt").replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
          title: str(x.title, 80) as string,
          insight: str(x.insight, 280),
          stat_value: str(x.stat_value, 40),
          stat_label: str(x.stat_label, 60),
          cta_label: str(x.cta_label, 60) || "Utfør",
          icon: icon && ALLOWED_ICONS.has(icon) ? icon : "auto_awesome",
        };
      });
    return recs.length ? recs : null;
  } catch (err) {
    console.error("[agent/recommendations Claude] failed", err);
    return null;
  }
}

// Plukk et pseudo-tilfeldig delsett av katalogen (fallback når Claude er av).
function pickFromCatalog(n: number): GeneratedRec[] {
  const pool = [...SEED_CATALOG];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

export function setupRoleRoomAgentRecommendationsRoutes(
  deps: RoleRoomAgentRecommendationsRoutesDeps,
): void {
  const { app, pool, getActiveSession } = deps;

  // ── GET — list anbefalinger ──────────────────────────────────────────
  app.get("/api/role-room/agent/recommendations", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    try {
      const projectId = typeof req.query.projectId === "string" && req.query.projectId.trim() ? req.query.projectId.trim() : null;
      const status = typeof req.query.status === "string" && ["new", "done", "dismissed"].includes(req.query.status) ? req.query.status : "new";
      const params: unknown[] = [session.userId, status];
      let where = "owner_user_id = $1 AND status = $2";
      if (projectId) { params.push(projectId); where += ` AND (project_id = $${params.length} OR project_id IS NULL)`; }
      const r = await pool.query(
        `SELECT * FROM role_room_agent_recommendation WHERE ${where} ORDER BY created_at DESC LIMIT 100`,
        params,
      );
      return res.json({ recommendations: r.rows.map(mapRow) });
    } catch (err) {
      console.error("[agent/recommendations GET] failed", err);
      return res.status(500).json({ error: "Klarte ikke å hente anbefalinger" });
    }
  });

  // ── PATCH — marker som utført / avvist ───────────────────────────────
  app.patch("/api/role-room/agent/recommendations/:id", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const status = (req.body || {}).status;
    if (status !== "done" && status !== "dismissed" && status !== "new") {
      return res.status(400).json({ error: "Ugyldig status" });
    }
    try {
      const r = await pool.query(
        `UPDATE role_room_agent_recommendation
            SET status = $3, updated_at = now()
          WHERE id = $1 AND owner_user_id = $2 RETURNING *`,
        [req.params.id, session.userId, status],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Ikke funnet" });
      return res.json({ recommendation: mapRow(r.rows[0]) });
    } catch (err) {
      console.error("[agent/recommendations PATCH] failed", err);
      return res.status(500).json({ error: "Klarte ikke å oppdatere" });
    }
  });

  // ── POST /generate — ekte Claude-generering m/ signaler (fallback: katalog) ──
  app.post("/api/role-room/agent/recommendations/generate", async (req, res) => {
    const session = getActiveSession(req);
    if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
    const projectId = typeof (req.body || {}).projectId === "string" && req.body.projectId.trim() ? req.body.projectId.trim() : null;
    try {
      // 1) Hent ekte signaler og la Claude lage skreddersydde anbefalinger.
      const signals = await gatherSignals(pool, session.userId, projectId);
      const claudeRecs = await generateWithClaude(signals);
      const source = claudeRecs ? "claude" : "catalog";
      const recs: GeneratedRec[] = claudeRecs ?? pickFromCatalog(6);

      // 2) Rydd vekk eksisterende åpne anbefalinger i samme scope (unngå duplikater).
      await pool.query(
        `DELETE FROM role_room_agent_recommendation
          WHERE owner_user_id = $1 AND status = 'new' AND project_id IS NOT DISTINCT FROM $2`,
        [session.userId, projectId],
      );

      // 3) Sett inn de nye anbefalingene.
      const values: string[] = [];
      const params: unknown[] = [session.userId, projectId];
      recs.forEach((c) => {
        const base = params.length;
        params.push(crypto.randomUUID(), c.type, c.title, c.insight, c.stat_value, c.stat_label, c.cta_label, c.icon);
        values.push(`($${base + 1}, $1, $2, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, 'new')`);
      });
      const r = await pool.query(
        `INSERT INTO role_room_agent_recommendation
           (id, owner_user_id, project_id, type, title, insight, stat_value, stat_label, cta_label, icon, status)
         VALUES ${values.join(", ")}
         RETURNING *`,
        params,
      );
      return res.json({ recommendations: r.rows.map(mapRow), created: r.rowCount, source });
    } catch (err) {
      console.error("[agent/recommendations generate] failed", err);
      return res.status(500).json({ error: "Klarte ikke å generere anbefalinger" });
    }
  });
}
