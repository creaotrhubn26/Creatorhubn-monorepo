/**
 * cockpit-b2b-routes.ts
 *
 * B2B-akkvisisjons-utvidelse til Marketing Cockpit.
 * 9 features samlet i én fil for å holde wire-up i index.ts enkel.
 *
 * Endepunkter (alle krever Admin Room-auth):
 *   1. POST   /api/admin-room/cockpit/linkedin/publish/:draftId
 *   2. GET    /api/admin-room/cockpit/b2b/funnel
 *   3. POST   /api/admin-room/cockpit/leads/:id/score        (Claude scorer)
 *   4. PR:    /api/admin-room/cockpit/pr/{releases,journalists,distribute}
 *   5. POST   /api/admin-room/cockpit/webinars + registrations
 *   6. REF:   /api/admin-room/cockpit/referrals (+ public claim)
 *   7. POST   /api/admin-room/cockpit/competitors/:id/refresh-pricing
 *   8. CRON-trigger: /api/admin-room/cockpit/nurture/run-due
 *   9. POST   /api/admin-room/cockpit/case-studies/generate
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";

import { sendTransactionalEmail } from "./transactional-email-service.js";
import { composeEmail } from "./email-design-system.js";
import { resolveDefaultLinkedInOrg } from "./linkedin-oauth-routes.js";

interface SessionLike { userId: string; email?: string }

export interface CockpitB2BRoutesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSession: (req: express.Request) => SessionLike | null;
  isAdminEmail: (email: string | null | undefined) => boolean;
}

const PUBLIC_URL = process.env.ROLE_ROOM_PUBLIC_URL ?? "https://theroleroom.com";

export function setupCockpitB2BRoutes(deps: CockpitB2BRoutesDeps): void {
  const { app, pool, getActiveSession, isAdminEmail } = deps;

  const guard = (req: express.Request, res: express.Response): SessionLike | null => {
    const session = getActiveSession(req);
    if (!session?.userId) { res.status(401).json({ error: "Innlogging kreves" }); return null; }
    if (!isAdminEmail(session.email)) { res.status(403).json({ error: "Admin Room kreves" }); return null; }
    return session;
  };

  // ── 1. LinkedIn Company auto-publish ─────────────────────────────
  app.post("/api/admin-room/cockpit/linkedin/publish/:draftId", async (req, res) => {
    const session = guard(req, res); if (!session) return;
    // Override via body, ellers bruk default-orgen fra linkedin_org_config
    const override = (req.body as { organization_urn?: string })?.organization_urn;
    const resolved = await resolveDefaultLinkedInOrg(pool);
    if (!resolved && !override) {
      return res.status(503).json({
        error: "LinkedIn er ikke koblet. Klikk «Koble LinkedIn» i Cockpit først.",
      });
    }
    const accessToken = resolved?.accessToken;
    const companyUrn = override ?? resolved?.organizationUrn;
    if (!accessToken || !companyUrn) {
      return res.status(503).json({ error: "Token eller URN mangler" });
    }

    try {
      const r = await pool.query(
        `SELECT id::text, caption, hashtags, cta_text, cta_link, platform, status
           FROM marketing_post_drafts WHERE id = $1::uuid LIMIT 1`,
        [req.params.draftId],
      );
      const draft = r.rows[0];
      if (!draft) return res.status(404).json({ error: "Draft ikke funnet" });
      if (draft.platform !== "linkedin") {
        return res.status(400).json({ error: "Drafts platform er ikke LinkedIn" });
      }

      // Bygg LinkedIn UGC-post-body
      const text = [
        draft.caption ?? "",
        draft.hashtags ? `\n\n${draft.hashtags}` : "",
        draft.cta_link ? `\n\n${draft.cta_text ?? "Les mer"}: ${draft.cta_link}` : "",
      ].join("").slice(0, 3000); // LinkedIn max 3000 chars

      const visibility = (req.body as { visibility?: string })?.visibility ?? "PUBLIC";
      const liResp = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          author: companyUrn,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text },
              shareMediaCategory: "NONE",
            },
          },
          visibility: { "com.linkedin.ugc.MemberNetworkVisibility": visibility },
        }),
      });

      if (!liResp.ok) {
        const errText = await liResp.text().catch(() => "");
        return res.status(502).json({
          error: "LinkedIn-publish feilet",
          detail: `${liResp.status} ${errText.slice(0, 400)}`,
        });
      }
      const data = await liResp.json() as { id?: string };
      const postUrn = data.id ?? null;

      await pool.query(
        `UPDATE marketing_post_drafts
            SET status = 'published',
                published_at = now(),
                external_post_id = COALESCE($1, external_post_id),
                linkedin_post_urn = $1,
                linkedin_company_urn = $2,
                linkedin_visibility = $3
          WHERE id = $4::uuid`,
        [postUrn, companyUrn, visibility, draft.id],
      );

      return res.json({ ok: true, post_urn: postUrn });
    } catch (err) {
      console.error("[cockpit/linkedin publish] failed", err);
      return res.status(500).json({ error: "Publish feilet", detail: String(err) });
    }
  });

  // ── 2. B2B-funnel-panel ──────────────────────────────────────────
  app.get("/api/admin-room/cockpit/b2b/funnel", async (req, res) => {
    if (!guard(req, res)) return;
    try {
      // Funnel-stats per status
      const funnel = await pool.query(
        `SELECT status, COUNT(*)::int AS n
           FROM agency_leads
          GROUP BY status`,
      );
      const counts = Object.fromEntries(funnel.rows.map((r) => [r.status, r.n]));

      // Per segment
      const bySegment = await pool.query(
        `SELECT segment, status, COUNT(*)::int AS n
           FROM agency_leads
          GROUP BY segment, status
          ORDER BY segment`,
      );

      // Funnel-konvertering siste 30 dager
      const last30 = await pool.query(
        `SELECT
            COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS new_30d,
            COUNT(*) FILTER (WHERE contacted_at > now() - interval '30 days')::int AS contacted_30d,
            COUNT(*) FILTER (WHERE status IN ('demo_booked','trial','customer'))::int AS qualified,
            COUNT(*) FILTER (WHERE customer_at > now() - interval '30 days')::int AS won_30d
          FROM agency_leads`,
      );

      // Score-fordeling
      const scores = await pool.query(
        `SELECT score_tier, COUNT(*)::int AS n
           FROM agency_leads
          WHERE score_tier IS NOT NULL
          GROUP BY score_tier`,
      );

      // Topp 10 nyeste
      const recent = await pool.query(
        `SELECT id::text, agency_name, contact_name, email, segment, status,
                score_total, score_tier, created_at
           FROM agency_leads
          ORDER BY created_at DESC
          LIMIT 10`,
      );

      return res.json({
        funnel: counts,
        by_segment: bySegment.rows,
        last_30d: last30.rows[0],
        score_distribution: Object.fromEntries(scores.rows.map((s) => [s.score_tier, s.n])),
        recent: recent.rows,
      });
    } catch (err) {
      console.error("[cockpit/b2b/funnel] failed", err);
      return res.status(500).json({ error: "Funnel-stats feilet" });
    }
  });

  // ── 3. Lead-scoring via Claude ───────────────────────────────────
  app.post("/api/admin-room/cockpit/leads/:id/score", async (req, res) => {
    const session = guard(req, res); if (!session) return;
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: "ANTHROPIC_API_KEY mangler" });
    }
    try {
      const r = await pool.query(
        `SELECT id::text, agency_name, contact_name, email, phone, roster_size,
                segment, message, status, source, utm_campaign
           FROM agency_leads WHERE id = $1::uuid LIMIT 1`,
        [req.params.id],
      );
      const lead = r.rows[0];
      if (!lead) return res.status(404).json({ error: "Lead ikke funnet" });

      const modelId = process.env.LEAD_SCORING_MODEL ?? "claude-opus-4-7";
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const systemPrompt = [
        "Du er en B2B-SaaS-sales-evaluator for The Role Room (casting-CRM for norske byråer).",
        "Du scorer leads på 0-100 og kategoriserer dem som 'hot' | 'warm' | 'cold' | 'disqualified'.",
        "Returner KUN ren JSON: { total: 0-100, tier: 'hot|warm|cold|disqualified', reasoning: string, signals: { fit, intent, size, timing }, recommendations: string[] }",
        "Vekt: fit 30%, intent 25%, size 25%, timing 20%.",
      ].join("\n");

      const userPrompt = [
        `Byrå: ${lead.agency_name}`,
        `Kontakt: ${lead.contact_name} <${lead.email}>${lead.phone ? ` ${lead.phone}` : ""}`,
        `Segment: ${lead.segment}`,
        `Antall talents: ${lead.roster_size ?? "(ikke oppgitt)"}`,
        `Status: ${lead.status}`,
        `Source: ${lead.source}${lead.utm_campaign ? ` (${lead.utm_campaign})` : ""}`,
        lead.message ? `\nMelding:\n${lead.message}` : "",
        "",
        "Vurder denne leaden. Norsk innhold der det er naturlig.",
      ].join("\n");

      const aiResp = await client.messages.create({
        model: modelId,
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      const textBlock = aiResp.content.find((b) => b.type === "text");
      const responseText = textBlock?.type === "text" ? textBlock.text : "";
      const json = responseText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed: { total?: number; tier?: string; reasoning?: string; signals?: unknown; recommendations?: unknown };
      try { parsed = JSON.parse(json); } catch { parsed = {}; }

      const total = Math.max(0, Math.min(100, Number(parsed.total ?? 0)));
      const tier = ["hot","warm","cold","disqualified"].includes(parsed.tier ?? "")
        ? parsed.tier : (total >= 75 ? "hot" : total >= 50 ? "warm" : total >= 25 ? "cold" : "disqualified");

      const upd = await pool.query(
        `UPDATE agency_leads
            SET lead_score = $1::jsonb,
                score_total = $2,
                score_tier = $3,
                scored_at = now(),
                scored_model = $4
          WHERE id = $5::uuid
          RETURNING id::text, score_total, score_tier, scored_at`,
        [JSON.stringify(parsed), total, tier, modelId, req.params.id],
      );
      return res.json({ lead: upd.rows[0], score: parsed });
    } catch (err) {
      console.error("[cockpit/leads score] failed", err);
      return res.status(500).json({ error: "Scoring feilet", detail: String(err) });
    }
  });

  // ── 4. PR: pressemeldinger + journalist-DB ───────────────────────
  // 4a. Press releases CRUD
  app.get("/api/admin-room/cockpit/pr/releases", async (req, res) => {
    if (!guard(req, res)) return;
    const r = await pool.query(
      `SELECT id::text, headline, subheadline, milestone, status,
              generated_at, sent_at, embargo_until, distributed_to_journalist_count
         FROM pr_press_releases
        ORDER BY created_at DESC LIMIT 100`,
    );
    return res.json({ releases: r.rows });
  });

  app.post("/api/admin-room/cockpit/pr/releases/generate", async (req, res) => {
    const session = guard(req, res); if (!session) return;
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: "ANTHROPIC_API_KEY mangler" });
    }
    const { milestone, context, cta_url } = (req.body ?? {}) as {
      milestone?: string; context?: string; cta_url?: string;
    };
    if (!milestone) return res.status(400).json({ error: "milestone er påkrevd" });

    try {
      const modelId = process.env.PR_GENERATION_MODEL ?? "claude-opus-4-7";
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const ai = await client.messages.create({
        model: modelId,
        max_tokens: 2500,
        system: [
          "Du skriver pressemeldinger for The Role Room (casting-CRM for norske byråer).",
          "Returnér KUN ren JSON: { headline, subheadline, body_markdown }.",
          "Norsk innhold. Headline maks 80 tegn. Body 250-450 ord, markdown.",
          "Inkluder 1-2 sitat (Daniel Qazi, founder). Inkluder relevant data.",
        ].join("\n"),
        messages: [{ role: "user", content: `Milestone: ${milestone}\n\nKontext:\n${context ?? "(ingen)"}` }],
      });
      const textBlock = ai.content.find((b) => b.type === "text");
      const json = (textBlock?.type === "text" ? textBlock.text : "")
        .replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed: { headline?: string; subheadline?: string; body_markdown?: string };
      try { parsed = JSON.parse(json); } catch { parsed = {}; }
      if (!parsed.headline || !parsed.body_markdown) {
        return res.status(502).json({ error: "AI returnerte ugyldig output" });
      }
      const r = await pool.query(
        `INSERT INTO pr_press_releases (
           headline, subheadline, body_markdown, cta_url, milestone,
           generated_with_model, generated_by_user_id, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
         RETURNING id::text, headline, subheadline, status, generated_at`,
        [parsed.headline, parsed.subheadline ?? null, parsed.body_markdown,
         cta_url ?? null, milestone, modelId, session.userId],
      );
      return res.status(201).json({ release: r.rows[0], generated: parsed });
    } catch (err) {
      console.error("[cockpit/pr generate] failed", err);
      return res.status(500).json({ error: "Generering feilet" });
    }
  });

  // 4b. Journalists DB CRUD
  app.get("/api/admin-room/cockpit/pr/journalists", async (req, res) => {
    if (!guard(req, res)) return;
    const r = await pool.query(
      `SELECT id::text, full_name, outlet, role, email, beat, status,
              last_contacted_at, last_response_at, response_rate
         FROM pr_journalists
        WHERE status != 'archived'
        ORDER BY outlet, full_name`,
    );
    return res.json({ journalists: r.rows });
  });

  app.post("/api/admin-room/cockpit/pr/journalists", async (req, res) => {
    const session = guard(req, res); if (!session) return;
    const body = (req.body ?? {}) as {
      full_name?: string; outlet?: string; role?: string;
      email?: string; phone?: string; beat?: string; notes?: string;
    };
    if (!body.full_name || !body.outlet) {
      return res.status(400).json({ error: "full_name + outlet påkrevd" });
    }
    try {
      const r = await pool.query(
        `INSERT INTO pr_journalists (full_name, outlet, role, email, phone, beat, notes, added_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (email) DO UPDATE
           SET full_name = EXCLUDED.full_name,
               outlet = EXCLUDED.outlet,
               role = EXCLUDED.role
         RETURNING id::text, full_name, outlet, email`,
        [body.full_name, body.outlet, body.role ?? null, body.email ?? null,
         body.phone ?? null, body.beat ?? null, body.notes ?? null, session.userId],
      );
      return res.status(201).json({ journalist: r.rows[0] });
    } catch (err) {
      console.error("[cockpit/journalists POST] failed", err);
      return res.status(500).json({ error: "Lagring feilet" });
    }
  });

  // 4c. Distribute release to journalists
  app.post("/api/admin-room/cockpit/pr/releases/:id/distribute", async (req, res) => {
    const session = guard(req, res); if (!session) return;
    const { journalist_ids } = (req.body ?? {}) as { journalist_ids?: string[] };
    if (!Array.isArray(journalist_ids) || journalist_ids.length === 0) {
      return res.status(400).json({ error: "journalist_ids[] påkrevd" });
    }
    try {
      const rel = await pool.query(
        `SELECT id::text, headline, subheadline, body_markdown, cta_url
           FROM pr_press_releases WHERE id = $1::uuid LIMIT 1`,
        [req.params.id],
      );
      const release = rel.rows[0];
      if (!release) return res.status(404).json({ error: "Pressemelding ikke funnet" });

      let sent = 0;
      for (const journalistId of journalist_ids) {
        try {
          const j = await pool.query(
            `SELECT id::text, full_name, email, outlet, role FROM pr_journalists WHERE id = $1::uuid LIMIT 1`,
            [journalistId],
          );
          const jr = j.rows[0];
          if (!jr?.email) continue;

          const composed = composeEmail({
            category: "general",
            subject: release.headline,
            preheader: release.subheadline?.slice(0, 140),
            headline: release.headline,
            subhead: release.subheadline,
            body: release.body_markdown,
            cta: release.cta_url ? { label: "Les mer", href: release.cta_url } : undefined,
            footer: {
              reason: `Sendt til ${jr.outlet}. Si fra om du vil ut av distribusjonslisten.`,
              preferencesUrl: `${PUBLIC_URL}/pr/unsubscribe`,
            },
          });
          await sendTransactionalEmail({
            to: jr.email,
            subject: release.headline,
            html: composed.html,
            text: composed.text,
            kind: "pr_release",
            fromLabel: "The Role Room — Pressekontakt",
            pool,
          });
          await pool.query(
            `INSERT INTO pr_release_distributions (release_id, journalist_id, sent_at)
             VALUES ($1::uuid, $2::uuid, now())
             ON CONFLICT (release_id, journalist_id) DO UPDATE SET sent_at = now()`,
            [req.params.id, journalistId],
          );
          await pool.query(
            `UPDATE pr_journalists SET last_contacted_at = now() WHERE id = $1::uuid`,
            [journalistId],
          );
          sent++;
        } catch (err) {
          console.warn("[cockpit/pr distribute] journalist failed", err);
        }
      }
      await pool.query(
        `UPDATE pr_press_releases
            SET status = 'sent', sent_at = COALESCE(sent_at, now()),
                distributed_to_journalist_count = distributed_to_journalist_count + $1
          WHERE id = $2::uuid`,
        [sent, req.params.id],
      );
      return res.json({ ok: true, sent });
    } catch (err) {
      console.error("[cockpit/pr distribute] failed", err);
      return res.status(500).json({ error: "Distribusjon feilet" });
    }
  });

  // ── 5. Webinarer ─────────────────────────────────────────────────
  app.get("/api/admin-room/cockpit/webinars", async (req, res) => {
    if (!guard(req, res)) return;
    const r = await pool.query(
      `SELECT w.id::text, w.slug, w.title, w.scheduled_at, w.duration_minutes,
              w.status, w.capacity, w.zoom_join_url,
              COUNT(reg.id)::int AS registration_count
         FROM webinars w
         LEFT JOIN webinar_registrations reg ON reg.webinar_id = w.id
        GROUP BY w.id
        ORDER BY w.scheduled_at DESC LIMIT 50`,
    );
    return res.json({ webinars: r.rows });
  });

  app.post("/api/admin-room/cockpit/webinars", async (req, res) => {
    const session = guard(req, res); if (!session) return;
    const body = (req.body ?? {}) as {
      slug?: string; title?: string; description_markdown?: string;
      scheduled_at?: string; duration_minutes?: number;
      zoom_join_url?: string; capacity?: number;
    };
    if (!body.slug || !body.title || !body.scheduled_at) {
      return res.status(400).json({ error: "slug + title + scheduled_at påkrevd" });
    }
    try {
      const r = await pool.query(
        `INSERT INTO webinars (
           slug, title, description_markdown, scheduled_at, duration_minutes,
           zoom_join_url, capacity, host_user_id
         ) VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7, $8)
         RETURNING id::text, slug, title, scheduled_at`,
        [body.slug, body.title, body.description_markdown ?? null,
         body.scheduled_at, body.duration_minutes ?? 30,
         body.zoom_join_url ?? null, body.capacity ?? null, session.userId],
      );
      return res.status(201).json({ webinar: r.rows[0] });
    } catch (err) {
      console.error("[cockpit/webinars POST] failed", err);
      return res.status(500).json({ error: "Lagring feilet" });
    }
  });

  // Public registration
  app.post("/api/public/webinars/:slug/register", async (req, res) => {
    const { name, email, agency, role, utm_source, utm_medium, utm_campaign } = (req.body ?? {}) as {
      name?: string; email?: string; agency?: string; role?: string;
      utm_source?: string; utm_medium?: string; utm_campaign?: string;
    };
    if (!name || !email) return res.status(400).json({ error: "name + email påkrevd" });
    try {
      const w = await pool.query(
        `SELECT id::text, title, scheduled_at, zoom_join_url, status, capacity, registration_open
           FROM webinars WHERE slug = $1 LIMIT 1`,
        [req.params.slug],
      );
      const webinar = w.rows[0];
      if (!webinar) return res.status(404).json({ error: "Webinar ikke funnet" });
      if (!webinar.registration_open || webinar.status !== "scheduled") {
        return res.status(410).json({ error: "Registreringen er stengt" });
      }
      const r = await pool.query(
        `INSERT INTO webinar_registrations (
           webinar_id, name, email, agency, role,
           utm_source, utm_medium, utm_campaign, referrer
         ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (webinar_id, email) DO UPDATE
           SET name = EXCLUDED.name, agency = EXCLUDED.agency
         RETURNING id::text`,
        [webinar.id, name, email, agency ?? null, role ?? null,
         utm_source ?? null, utm_medium ?? null, utm_campaign ?? null,
         req.headers.referer?.toString().slice(0, 500) ?? null],
      );

      // Send bekreftelses-mail
      void (async () => {
        try {
          const composed = composeEmail({
            category: "welcome",
            subject: `Påmeldt: ${webinar.title}`,
            preheader: `${new Date(webinar.scheduled_at).toLocaleString("nb-NO")} — Zoom-link inkludert.`,
            headline: "Du er påmeldt",
            subhead: `Vi sees ${new Date(webinar.scheduled_at).toLocaleString("nb-NO", {
              dateStyle: "long", timeStyle: "short",
            })}. Du får påminnelse 24t og 1t før start.`,
            table: [
              { label: "Webinar", value: webinar.title },
              { label: "Tidspunkt", value: new Date(webinar.scheduled_at).toLocaleString("nb-NO") },
              ...(webinar.zoom_join_url ? [{ label: "Zoom-link", value: webinar.zoom_join_url }] : []),
            ],
            cta: webinar.zoom_join_url
              ? { label: "Legg til i kalender", href: webinar.zoom_join_url }
              : undefined,
            footer: { reason: "Du registrerte deg via theroleroom.com." },
          });
          await sendTransactionalEmail({
            to: email,
            subject: `Påmeldt: ${webinar.title}`,
            html: composed.html,
            text: composed.text,
            kind: "webinar_registration",
            fromLabel: "The Role Room",
            pool,
          });
        } catch { /* best-effort */ }
      })();

      return res.status(201).json({ ok: true, registration_id: r.rows[0].id });
    } catch (err) {
      console.error("[public/webinar register] failed", err);
      return res.status(500).json({ error: "Registrering feilet" });
    }
  });

  // ── 6. Referral-program ──────────────────────────────────────────
  app.post("/api/admin-room/cockpit/referrals", async (req, res) => {
    const session = guard(req, res); if (!session) return;
    const body = (req.body ?? {}) as {
      referrer_email?: string; referrer_name?: string;
      reward_type?: string; reward_value?: number;
    };
    if (!body.referrer_email) return res.status(400).json({ error: "referrer_email påkrevd" });
    const code = crypto.randomBytes(6).toString("base64url");
    try {
      const r = await pool.query(
        `INSERT INTO referrals (
           referrer_email, referrer_name, referral_code,
           reward_type, reward_value, expires_at
         ) VALUES ($1, $2, $3, $4, $5, now() + interval '365 days')
         RETURNING id::text, referral_code, reward_type, reward_value`,
        [body.referrer_email, body.referrer_name ?? null, code,
         body.reward_type ?? "free_month", body.reward_value ?? 1],
      );
      return res.status(201).json({
        referral: r.rows[0],
        share_url: `${PUBLIC_URL}/for-byraer?ref=${code}`,
      });
    } catch (err) {
      console.error("[cockpit/referrals POST] failed", err);
      return res.status(500).json({ error: "Lagring feilet" });
    }
  });

  app.get("/api/admin-room/cockpit/referrals", async (req, res) => {
    if (!guard(req, res)) return;
    const r = await pool.query(
      `SELECT id::text, referrer_email, referrer_name, referral_code,
              reward_type, reward_value, status, click_count,
              referred_email, referred_agency_name,
              signed_up_at, became_customer_at,
              created_at, expires_at
         FROM referrals
        ORDER BY created_at DESC LIMIT 200`,
    );
    return res.json({ referrals: r.rows });
  });

  // Public claim — øker click_count + setter cookie ved første besøk
  app.get("/api/public/referrals/:code/click", async (req, res) => {
    try {
      const r = await pool.query(
        `UPDATE referrals SET click_count = click_count + 1, last_click_at = now()
          WHERE referral_code = $1
          RETURNING id::text, referral_code`,
        [req.params.code],
      );
      if (!r.rowCount) return res.status(404).json({ error: "Ugyldig kode" });
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: "Klikk-tracking feilet" });
    }
  });

  // ── 7. B2B-konkurrent pricing+features refresh ───────────────────
  // Best-effort scrape — feiler graceful.
  app.post("/api/admin-room/cockpit/competitors/:id/refresh-pricing", async (req, res) => {
    const session = guard(req, res); if (!session) return;
    try {
      const c = await pool.query(
        `SELECT id::text, page_id, nickname, notes
           FROM marketing_competitor_pages WHERE id = $1::uuid LIMIT 1`,
        [req.params.id],
      );
      const competitor = c.rows[0];
      if (!competitor) return res.status(404).json({ error: "Konkurrent ikke funnet" });

      // Heuristisk: hvis notes inneholder URL, prøv å hente pricing-side
      const urlMatch = String(competitor.notes ?? "").match(/(https?:\/\/[^\s)]+)/);
      const targetUrl = urlMatch?.[0];
      let pricingJson: Record<string, unknown> | null = null;
      let featuresJson: Record<string, unknown> | null = null;
      let websiteMetaJson: Record<string, unknown> | null = null;

      if (targetUrl) {
        try {
          const resp = await fetch(targetUrl, {
            headers: { "User-Agent": "Mozilla/5.0 TheRoleRoom-Bot/1.0" },
          });
          if (resp.ok) {
            const html = await resp.text();
            // Enkel meta-tag-extraksjon
            const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
            const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
            websiteMetaJson = {
              title: titleMatch?.[1]?.slice(0, 200) ?? null,
              description: descMatch?.[1]?.slice(0, 400) ?? null,
              url: targetUrl,
              fetched_at: new Date().toISOString(),
            };
            // Heuristisk pris-extraksjon (NOK, USD, EUR + nummer)
            const priceMatches = Array.from(html.matchAll(/(NOK|USD|EUR|\$|€|kr)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/gi));
            if (priceMatches.length) {
              pricingJson = {
                detected_prices: priceMatches.slice(0, 10).map((m) => `${m[1]} ${m[2]}`),
                fetched_at: new Date().toISOString(),
              };
            }
            // Featur-extraksjon: <li>-tags som inneholder "ja"/"nei"/"included"/"unlimited"
            const featMatches = Array.from(html.matchAll(/<li[^>]*>([^<]{8,180})<\/li>/gi));
            if (featMatches.length) {
              featuresJson = {
                features: featMatches.slice(0, 25).map((m) => m[1].trim()),
                fetched_at: new Date().toISOString(),
              };
            }
          }
        } catch (err) {
          console.warn("[cockpit/competitors fetch]", err);
        }
      }

      // Lagre snapshot
      const ins = await pool.query(
        `INSERT INTO marketing_competitor_snapshots (
           competitor_id, snapshot_at,
           pricing_json, features_json, website_meta_json
         ) VALUES ($1::uuid, now(), $2::jsonb, $3::jsonb, $4::jsonb)
         RETURNING id::text, snapshot_at`,
        [competitor.id,
         pricingJson ? JSON.stringify(pricingJson) : null,
         featuresJson ? JSON.stringify(featuresJson) : null,
         websiteMetaJson ? JSON.stringify(websiteMetaJson) : null],
      );

      return res.json({
        snapshot: ins.rows[0],
        pricing: pricingJson,
        features: featuresJson,
        meta: websiteMetaJson,
      });
    } catch (err) {
      console.error("[cockpit/competitors refresh-pricing] failed", err);
      return res.status(500).json({ error: "Refresh feilet" });
    }
  });

  // ── 8. Email-nurture-automation ──────────────────────────────────
  // Schedule 5-step nurture for en lead
  app.post("/api/admin-room/cockpit/leads/:id/start-nurture", async (req, res) => {
    if (!guard(req, res)) return;
    try {
      const steps = [
        { step: 1, template_key: "nurture_day1_value", offset_hours: 1 },
        { step: 2, template_key: "nurture_day3_social_proof", offset_hours: 24 * 3 },
        { step: 3, template_key: "nurture_day7_resource", offset_hours: 24 * 7 },
        { step: 4, template_key: "nurture_day14_case", offset_hours: 24 * 14 },
        { step: 5, template_key: "nurture_day21_demo_offer", offset_hours: 24 * 21 },
      ];
      const now = Date.now();
      for (const s of steps) {
        await pool.query(
          `INSERT INTO agency_lead_nurture_events
             (lead_id, step, template_key, scheduled_at, status)
           VALUES ($1::uuid, $2, $3, $4::timestamptz, 'pending')
           ON CONFLICT (lead_id, step) DO NOTHING`,
          [req.params.id, s.step, s.template_key,
           new Date(now + s.offset_hours * 3600 * 1000).toISOString()],
        );
      }
      return res.json({ ok: true, steps: steps.length });
    } catch (err) {
      console.error("[cockpit/nurture start] failed", err);
      return res.status(500).json({ error: "Schedulering feilet" });
    }
  });

  // CRON-target — kjør alle due nurture-eventer (aksepterer x-cron-trigger-token)
  app.post("/api/admin-room/cockpit/nurture/run-due", async (req, res) => {
    const tokenHeader = req.headers["x-cron-trigger-token"];
    const presentedToken = typeof tokenHeader === "string" ? tokenHeader.trim() : "";
    const expectedToken = (process.env.CRON_TRIGGER_TOKEN ?? "").trim();
    const isCronAuth = presentedToken && expectedToken && presentedToken === expectedToken;
    if (!isCronAuth && !guard(req, res)) return;
    try {
      const due = await pool.query(
        `SELECT e.id::text, e.lead_id::text, e.step, e.template_key,
                l.email, l.contact_name, l.agency_name
           FROM agency_lead_nurture_events e
           JOIN agency_leads l ON l.id = e.lead_id
          WHERE e.status = 'pending'
            AND e.scheduled_at <= now()
            AND l.status NOT IN ('customer','disqualified','archived')
          ORDER BY e.scheduled_at
          LIMIT 50`,
      );
      let sent = 0;
      for (const ev of due.rows) {
        try {
          const composed = nurtureTemplate(ev.template_key, {
            firstName: String(ev.contact_name).split(" ")[0],
            agencyName: ev.agency_name,
          });
          await sendTransactionalEmail({
            to: ev.email,
            subject: composed.subject,
            html: composed.html,
            text: composed.text,
            kind: `nurture_${ev.template_key}`,
            fromLabel: "The Role Room",
            pool,
          });
          await pool.query(
            `UPDATE agency_lead_nurture_events SET status = 'sent', sent_at = now() WHERE id = $1::uuid`,
            [ev.id],
          );
          sent++;
        } catch (err) {
          console.warn("[nurture/run-due] event failed", err);
        }
      }
      return res.json({ ok: true, sent, queued: due.rowCount });
    } catch (err) {
      console.error("[cockpit/nurture run-due] failed", err);
      return res.status(500).json({ error: "Cron feilet" });
    }
  });

  // ── 9. Case study generator ──────────────────────────────────────
  app.post("/api/admin-room/cockpit/case-studies/generate", async (req, res) => {
    const session = guard(req, res); if (!session) return;
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: "ANTHROPIC_API_KEY mangler" });
    }
    const { agency_name, customer_lead_id, context_markdown, metrics } = (req.body ?? {}) as {
      agency_name?: string;
      customer_lead_id?: string;
      context_markdown?: string;
      metrics?: Array<{ label: string; value: string; delta_pct?: number }>;
    };
    if (!agency_name) return res.status(400).json({ error: "agency_name påkrevd" });
    try {
      const modelId = process.env.CASE_STUDY_MODEL ?? "claude-opus-4-7";
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const ai = await client.messages.create({
        model: modelId,
        max_tokens: 2500,
        system: [
          "Du skriver case studies for The Role Room (casting-CRM for norske byråer).",
          "Returner KUN ren JSON: { headline, challenge_markdown, solution_markdown, results_markdown, quote_text, quote_author, quote_role }",
          "Norsk innhold. Headline 50-80 tegn. Hver markdown-seksjon 80-200 ord.",
          "Quote skal være naturlig og spesifikk, ikke generisk.",
        ].join("\n"),
        messages: [{
          role: "user",
          content: [
            `Kunde: ${agency_name}`,
            context_markdown ? `\nKontekst:\n${context_markdown}` : "",
            metrics?.length ? `\nMetrics:\n${metrics.map((m) => `- ${m.label}: ${m.value}${m.delta_pct ? ` (${m.delta_pct > 0 ? "+" : ""}${m.delta_pct}%)` : ""}`).join("\n")}` : "",
          ].join(""),
        }],
      });
      const textBlock = ai.content.find((b) => b.type === "text");
      const json = (textBlock?.type === "text" ? textBlock.text : "")
        .replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
      let parsed: Record<string, string | undefined>;
      try { parsed = JSON.parse(json); } catch { parsed = {}; }
      if (!parsed.headline) return res.status(502).json({ error: "AI returnerte ugyldig output" });

      const slug = agency_name.toLowerCase()
        .replace(/[^a-z0-9æøå]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 100);

      const r = await pool.query(
        `INSERT INTO case_studies (
           agency_name, customer_lead_id, slug,
           headline, challenge_markdown, solution_markdown, results_markdown,
           quote_text, quote_author, quote_role,
           metric_set, generated_with_model, generated_at, generated_by_user_id,
           status
         ) VALUES (
           $1, $2::uuid, $3,
           $4, $5, $6, $7,
           $8, $9, $10,
           $11::jsonb, $12, now(), $13,
           'draft'
         ) RETURNING id::text, slug, headline, status`,
        [
          agency_name, customer_lead_id ?? null, slug,
          parsed.headline, parsed.challenge_markdown ?? null,
          parsed.solution_markdown ?? null, parsed.results_markdown ?? null,
          parsed.quote_text ?? null, parsed.quote_author ?? null, parsed.quote_role ?? null,
          JSON.stringify(metrics ?? []), modelId, session.userId,
        ],
      );
      return res.status(201).json({ case_study: r.rows[0], generated: parsed });
    } catch (err) {
      console.error("[cockpit/case-studies generate] failed", err);
      return res.status(500).json({ error: "Generering feilet" });
    }
  });

  app.get("/api/admin-room/cockpit/case-studies", async (req, res) => {
    if (!guard(req, res)) return;
    const r = await pool.query(
      `SELECT id::text, agency_name, slug, headline, status,
              published_at, generated_at, hero_image_url
         FROM case_studies
        ORDER BY created_at DESC LIMIT 100`,
    );
    return res.json({ case_studies: r.rows });
  });
}

// ──────────────────────────────────────────────────────────────────
// Nurture-templates — komposisjon med email-design-systemet
// ──────────────────────────────────────────────────────────────────
function nurtureTemplate(
  key: string,
  args: { firstName: string; agencyName: string },
): { subject: string; html: string; text: string } {
  const { firstName, agencyName } = args;
  const baseUrl = PUBLIC_URL;

  const templates: Record<string, { subject: string; headline: string; subhead: string; body: string; ctaLabel: string; ctaHref: string }> = {
    nurture_day1_value: {
      subject: `Hvordan The Role Room hjelper ${agencyName}`,
      headline: "Velkommen til The Role Room",
      subhead: `Hei ${firstName}, takk for at du tok deg tid til å sende inn forespørselen.`,
      body: "På de neste 21 dagene sender vi 5 korte e-poster med konkret innsikt for casting-byråer: GDPR, self-tape, partnership-flyt, AI-feedback og en demo-tilbud. Du kan trekke deg fra sekvensen når som helst.",
      ctaLabel: "Se priser",
      ctaHref: `${baseUrl}/pricing`,
    },
    nurture_day3_social_proof: {
      subject: "Stella + Skuespillersenter bruker oss",
      headline: "Hvem bygger vi sammen med",
      subhead: `${firstName} — vi nevner navn vi tror gir gjenklang hos ${agencyName}.`,
      body: "Stella Casting og Skuespillersenter er våre to demo-partnere i utviklingsfasen. De gir oss konkret input på hva norske byråer faktisk trenger — ikke det amerikanske casting-software-leverandørene mener. Du kan bli den tredje pilot-partneren.",
      ctaLabel: "Les mer om partnerskap",
      ctaHref: `${baseUrl}/for-byraer#book-demo`,
    },
    nurture_day7_resource: {
      subject: "GDPR-sjekkliste for skuespillerbyråer",
      headline: "12 punkter for trygg talent-administrasjon",
      subhead: `${firstName} — vi har skrevet en kort guide som passer for ${agencyName}.`,
      body: "Schrems II + GDPR har gjort talent-administrasjon mer komplekst. Vi har samlet en 12-punkts sjekkliste som dekker consent-registry, audit-trail, EU-hosting og rett-til-å-bli-glemt. Gratis å lese, ingen nedlasting eller registrering kreves.",
      ctaLabel: "Les sjekklisten",
      ctaHref: `${baseUrl}/faq`,
    },
    nurture_day14_case: {
      subject: "Northern Lights-casting på 18 timer",
      headline: "Slik gjorde vi det",
      subhead: "Real example fra demo-data: brief → shortlist på 18 timer.",
      body: "Med Self-Tape Studio + Partnership-flyt: 08:14 brief mottatt, 08:38 talents varslet, 21:02 første take lastet opp, 07:15 produksjonsteamet ser alle 5 takes med 📹-badge, 09:30 talent shortlistet. Det er forskjellen mellom et byrå med riktige verktøy og et som jager e-poster.",
      ctaLabel: "Se hele flyten",
      ctaHref: `${baseUrl}/for-byraer`,
    },
    nurture_day21_demo_offer: {
      subject: "Klar for 30 min demo?",
      headline: "Vi setter opp en demo med deres data",
      subhead: `${firstName} — siste mail i sekvensen. Vil dere se hvordan det fungerer for ${agencyName}?`,
      body: "Vi forhåndsfyller en demo med navnet til dine talents, en av deres casting-roller fra et offentlig prosjekt, og et eksempel-partnership. 30 minutter på Zoom. Hvis det ikke virker for dere, ingen oppfølging.",
      ctaLabel: "Book demo",
      ctaHref: `${baseUrl}/for-byraer#book-demo`,
    },
  };

  const t = templates[key] ?? templates.nurture_day1_value;
  const composed = composeEmail({
    category: "general",
    subject: t.subject,
    preheader: t.subhead.slice(0, 140),
    headline: t.headline,
    subhead: t.subhead,
    body: t.body,
    cta: { label: t.ctaLabel, href: t.ctaHref },
    footer: {
      reason: "Du mottar denne fordi du sendte inn forespørsel via /for-byraer. Si fra hvis du vil ut av sekvensen.",
      preferencesUrl: `${PUBLIC_URL}/unsubscribe`,
    },
  });
  return { subject: t.subject, html: composed.html, text: composed.text };
}
