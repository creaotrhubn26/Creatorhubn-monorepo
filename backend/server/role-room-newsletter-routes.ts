/**
 * role-room-newsletter-routes.ts
 *
 * Public newsletter-endpoint for "Norwegian Casting Brief" på theroleroom.com.
 *
 * - POST /api/newsletter/role-room — påmelding fra landingssider + content-sider
 * - GET  /api/admin-room/newsletter/role-room/stats — aggregat for Admin Room
 * - GET  /api/admin-room/newsletter/role-room/signups — recent signups for admin
 *
 * Public-endpoint krever ikke auth. Admin-endpoints gates via
 * requireAdminRoomAccess (samme mønster som øvrige admin-room-routes).
 */

import crypto from "node:crypto";
import type express from "express";
import type { Pool } from "pg";
import type { AdminRoomRoutesDeps } from "./_shared";
import { asString } from "./_shared";
import {
  markdownToHtml,
  renderBlocksToHtml,
  sendNewsletterConfirmEmail,
  sendNewsletterIssueToRecipient,
  type NewsletterBlock,
} from "./role-room-newsletter-email-service";
import { archiveToRoleRoomB2, newsletterIssueKey } from "./b2-archive-helper.js";

function asBlocks(value: unknown): NewsletterBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter((b): b is NewsletterBlock => {
    if (!b || typeof b !== "object") return false;
    const obj = b as Record<string, unknown>;
    return typeof obj.id === "string" && typeof obj.type === "string";
  });
}

interface NewsletterRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminRoomAccess: AdminRoomRoutesDeps["requireAdminRoomAccess"];
}

const ALLOWED_SOURCES = new Set([
  "casting-scam-signs",
  "child-consent-film",
  "casting-report-2026",
  "landing",
  "footer",
  "unknown",
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

const SIGNUP_RATE_LIMIT_PER_HOUR = 8;

/** Stable sha256-hash av IP slik at vi kan rate-limite uten å lagre rå IP. */
function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.NEWSLETTER_IP_SALT ?? "role-room-newsletter-default-salt";
  return crypto.createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function extractClientIp(req: express.Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim();
  }
  return req.socket?.remoteAddress ?? undefined;
}

export function setupRoleRoomNewsletterRoutes(deps: NewsletterRoutesDeps): void {
  const { app, pool, requireAdminRoomAccess } = deps;

  app.post("/api/newsletter/role-room", async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = asString(body.email);
    if (!email || !EMAIL_PATTERN.test(email)) {
      res.status(400).json({ ok: false, message: "Ugyldig e-postadresse." });
      return;
    }
    const requestedSource = asString(body.source, "unknown") ?? "unknown";
    const source = ALLOWED_SOURCES.has(requestedSource) ? requestedSource : "unknown";
    const locale = asString(body.locale, "no");

    const ip = extractClientIp(req);
    const ipHash = hashIp(ip);
    const userAgent = (req.headers["user-agent"] ?? "").toString().slice(0, 480);

    try {
      if (ipHash) {
        const recent = await pool.query(
          `SELECT COUNT(*)::int AS count
             FROM role_room_newsletter_signups
            WHERE ip_hash = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
          [ipHash],
        );
        if ((recent.rows[0]?.count ?? 0) >= SIGNUP_RATE_LIMIT_PER_HOUR) {
          res.status(429).json({
            ok: false,
            message: "Du har sendt mange påmeldinger nylig. Prøv igjen om en time.",
          });
          return;
        }
      }

      // Generer fresh tokens for nye signups; behold eksisterende ved re-signup.
      const newConfirmToken = crypto.randomBytes(24).toString("hex");
      const newUnsubscribeToken = crypto.randomBytes(24).toString("hex");

      const result = await pool.query(
        `INSERT INTO role_room_newsletter_signups
           (email, source, ip_hash, user_agent, locale, status, metadata, confirm_token, unsubscribe_token)
         VALUES ($1, $2, $3, $4, $5, 'pending_double_optin', $6::jsonb, $7, $8)
         ON CONFLICT ((LOWER(email)))
         DO UPDATE SET
             source = EXCLUDED.source,
             status = CASE
               WHEN role_room_newsletter_signups.unsubscribed_at IS NOT NULL
                 THEN 'pending_double_optin'
               ELSE role_room_newsletter_signups.status
             END,
             unsubscribed_at = NULL,
             confirm_token = COALESCE(role_room_newsletter_signups.confirm_token, EXCLUDED.confirm_token),
             unsubscribe_token = COALESCE(role_room_newsletter_signups.unsubscribe_token, EXCLUDED.unsubscribe_token),
             updated_at = NOW()
         RETURNING id, status, created_at, confirm_token, unsubscribe_token`,
        [
          email.toLowerCase(),
          source,
          ipHash,
          userAgent,
          locale ?? "no",
          JSON.stringify({}),
          newConfirmToken,
          newUnsubscribeToken,
        ],
      );

      const row = result.rows[0];

      // Send confirm-mail asynkront — ikke blokker HTTP-respons hvis SMTP er
      // treig. Hvis SMTP feiler er signup-en likevel lagret og kan re-trigges.
      if (row?.status === "pending_double_optin" && row?.confirm_token && row?.unsubscribe_token) {
        sendNewsletterConfirmEmail({
          to: email.toLowerCase(),
          confirmToken: row.confirm_token,
          unsubscribeToken: row.unsubscribe_token,
          source,
        }).catch((err) => console.error("[role-room-newsletter] confirm-mail error", err));
      }

      res.status(201).json({
        ok: true,
        id: row?.id,
        status: row?.status,
        message: "Takk! Sjekk innboksen for bekreftelse.",
      });
    } catch (err) {
      console.error("[role-room-newsletter] signup error", err);
      res.status(500).json({ ok: false, message: "Påmeldingen feilet. Prøv igjen om litt." });
    }
  });

  app.get("/api/admin-room/newsletter/role-room/stats", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const totals = await pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
           COUNT(*) FILTER (WHERE status = 'pending_double_optin')::int AS pending,
           COUNT(*) FILTER (WHERE unsubscribed_at IS NOT NULL)::int AS unsubscribed,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS new_last_7d,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS new_last_30d
         FROM role_room_newsletter_signups`,
      );
      const bySource = await pool.query(
        `SELECT source, COUNT(*)::int AS count
           FROM role_room_newsletter_signups
          WHERE created_at > NOW() - INTERVAL '90 days'
          GROUP BY source
          ORDER BY count DESC`,
      );
      res.json({
        totals: totals.rows[0] ?? { total: 0, confirmed: 0, pending: 0, unsubscribed: 0, new_last_7d: 0, new_last_30d: 0 },
        bySource: bySource.rows,
      });
    } catch (err) {
      // Graceful: role_room_newsletter_signups mangler → tomme stats.
      console.warn("[role-room-newsletter] stats failed:", (err as Error).message);
      res.json({
        totals: { total: 0, confirmed: 0, pending: 0, unsubscribed: 0, new_last_7d: 0, new_last_30d: 0 },
        bySource: [],
      });
    }
  });

  app.get("/api/admin-room/newsletter/role-room/signups", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const limitRaw = Number.parseInt((req.query.limit as string) ?? "50", 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200 ? limitRaw : 50;
    try {
      const result = await pool.query(
        `SELECT id, email, source, status, locale, consented_at, confirmed_at,
                unsubscribed_at, created_at
           FROM role_room_newsletter_signups
          ORDER BY created_at DESC
          LIMIT $1`,
        [limit],
      );
      res.json({ items: result.rows });
    } catch (err) {
      // Graceful: tabell mangler → tom liste.
      console.warn("[role-room-newsletter] signups failed:", (err as Error).message);
      res.json({ items: [] });
    }
  });

  // ── PUBLIC: confirm + unsubscribe via token ────────────────────────────

  app.get("/api/newsletter/role-room/confirm", async (req, res) => {
    const token = asString(req.query.token);
    if (!token) {
      res.status(400).send(htmlPage("Ugyldig lenke", "Lenken mangler token."));
      return;
    }
    try {
      const result = await pool.query(
        `UPDATE role_room_newsletter_signups
            SET status = 'confirmed',
                confirmed_at = COALESCE(confirmed_at, NOW()),
                unsubscribed_at = NULL,
                updated_at = NOW()
          WHERE confirm_token = $1
          RETURNING email`,
        [token],
      );
      if (result.rows.length === 0) {
        res.status(404).send(htmlPage("Lenken er ugyldig", "Bekreftelseslenken er ugyldig eller utløpt."));
        return;
      }
      res.send(htmlPage("Påmelding bekreftet", `Takk! ${result.rows[0].email} mottar Norwegian Casting Brief hver fredag.`));
    } catch (err) {
      console.error("[role-room-newsletter] confirm error", err);
      res.status(500).send(htmlPage("Feil", "Noe gikk galt. Prøv igjen senere."));
    }
  });

  app.get("/api/newsletter/role-room/unsubscribe", async (req, res) => {
    const token = asString(req.query.token);
    if (!token) {
      res.status(400).send(htmlPage("Ugyldig lenke", "Lenken mangler token."));
      return;
    }
    try {
      const result = await pool.query(
        `UPDATE role_room_newsletter_signups
            SET unsubscribed_at = NOW(),
                unsubscribe_reason = COALESCE($2, unsubscribe_reason),
                updated_at = NOW()
          WHERE unsubscribe_token = $1
          RETURNING email`,
        [token, asString(req.query.reason)],
      );
      if (result.rows.length === 0) {
        res.status(404).send(htmlPage("Allerede avmeldt", "Du er ikke i listen eller har allerede meldt deg av."));
        return;
      }
      res.send(htmlPage("Avmeldt", `${result.rows[0].email} er nå avmeldt. Du kan melde deg på igjen når som helst.`));
    } catch (err) {
      console.error("[role-room-newsletter] unsubscribe error", err);
      res.status(500).send(htmlPage("Feil", "Noe gikk galt. Prøv igjen senere."));
    }
  });

  // 1×1 transparent gif for open-tracking
  const TRANSPARENT_GIF = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );

  app.get("/api/newsletter/role-room/track/open.gif", async (req, res) => {
    const issueId = asString(req.query.issue);
    const signupId = asString(req.query.signup);
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.send(TRANSPARENT_GIF);
    // Log etter respons så vi ikke blokkerer pixel-load
    if (!issueId || !signupId) return;
    void (async () => {
      try {
        const ipHash = (() => {
          const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.socket?.remoteAddress;
          if (!ip) return null;
          return crypto.createHash("sha256").update(`${process.env.NEWSLETTER_IP_SALT ?? "salt"}:${ip}`).digest("hex");
        })();
        const ua = (req.headers["user-agent"] ?? "").toString().slice(0, 80);
        await pool.query(
          `INSERT INTO role_room_newsletter_issue_opens (issue_id, signup_id, ip_hash, user_agent_short)
           VALUES ($1, $2, $3, $4)`,
          [issueId, signupId, ipHash, ua],
        );
        await pool.query(
          `UPDATE role_room_newsletter_issues SET
             open_count = open_count + 1,
             unique_open_count = (SELECT COUNT(DISTINCT signup_id) FROM role_room_newsletter_issue_opens WHERE issue_id = $1)
           WHERE id = $1`,
          [issueId],
        );
      } catch (err) {
        console.error("[newsletter-tracking] open log failed", err);
      }
    })();
  });

  app.get("/api/newsletter/role-room/track/click", async (req, res) => {
    const issueId = asString(req.query.issue);
    const signupId = asString(req.query.signup);
    const destination = asString(req.query.to);
    if (!destination) {
      res.status(400).send("Missing destination");
      return;
    }
    // Sjekk at destinasjonen er en gyldig URL — beskytt mot open-redirect-attack.
    try {
      const url = new URL(destination);
      if (!["http:", "https:"].includes(url.protocol)) {
        res.status(400).send("Invalid destination");
        return;
      }
    } catch {
      res.status(400).send("Invalid destination");
      return;
    }
    res.redirect(302, destination);
    if (!issueId || !signupId) return;
    void (async () => {
      try {
        const ipHash = (() => {
          const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.socket?.remoteAddress;
          if (!ip) return null;
          return crypto.createHash("sha256").update(`${process.env.NEWSLETTER_IP_SALT ?? "salt"}:${ip}`).digest("hex");
        })();
        const ua = (req.headers["user-agent"] ?? "").toString().slice(0, 80);
        await pool.query(
          `INSERT INTO role_room_newsletter_issue_clicks (issue_id, signup_id, destination_url, ip_hash, user_agent_short)
           VALUES ($1, $2, $3, $4, $5)`,
          [issueId, signupId, destination, ipHash, ua],
        );
        await pool.query(
          `UPDATE role_room_newsletter_issues SET
             click_count = click_count + 1,
             unique_click_count = (SELECT COUNT(DISTINCT signup_id) FROM role_room_newsletter_issue_clicks WHERE issue_id = $1)
           WHERE id = $1`,
          [issueId],
        );
      } catch (err) {
        console.error("[newsletter-tracking] click log failed", err);
      }
    })();
  });

  // Også POST for one-click-unsubscribe (RFC 8058)
  app.post("/api/newsletter/role-room/unsubscribe", async (req, res) => {
    const token = asString(req.query.token) || asString((req.body as Record<string, unknown> | undefined)?.token);
    if (!token) {
      res.status(400).json({ ok: false });
      return;
    }
    try {
      await pool.query(
        `UPDATE role_room_newsletter_signups
            SET unsubscribed_at = NOW(), updated_at = NOW()
          WHERE unsubscribe_token = $1`,
        [token],
      );
      res.json({ ok: true });
    } catch {
      res.status(500).json({ ok: false });
    }
  });

  // ── ADMIN: issues CRUD + send ──────────────────────────────────────────

  app.get("/api/admin-room/newsletter/role-room/issues", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT id, slug, title, subject, preheader, status, scheduled_for, sent_at,
                sent_count, failed_count, created_at, updated_at,
                LENGTH(body_markdown) AS body_length
           FROM role_room_newsletter_issues
          WHERE user_id = $1
          ORDER BY updated_at DESC`,
        [session.userId],
      );
      res.json({ items: result.rows });
    } catch (err) {
      // Graceful: tabell mangler → tom liste (iPad: "Ingen issues").
      console.warn("[newsletter-issues] list failed:", (err as Error).message);
      res.json({ items: [] });
    }
  });

  app.get("/api/admin-room/newsletter/role-room/issues/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT * FROM role_room_newsletter_issues WHERE id = $1 AND user_id = $2`,
        [req.params.id, session.userId],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Utgave ikke funnet" });
        return;
      }
      res.json({ item: result.rows[0] });
    } catch (err) {
      console.error("[newsletter-issues] get error", err);
      res.status(500).json({ error: "Kunne ikke hente utgave" });
    }
  });

  app.post("/api/admin-room/newsletter/role-room/issues", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = asString(body.title);
    if (!title) {
      res.status(400).json({ error: "title er påkrevd" });
      return;
    }
    const slug = (asString(body.slug) || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || `issue-${Date.now()}`);
    const subject = asString(body.subject) ?? `Norwegian Casting Brief — ${title}`;
    const preheader = asString(body.preheader);
    const markdown = asString(body.bodyMarkdown) ?? "";
    const blocks = asBlocks(body.bodyBlocks);
    const renderedHtml = blocks.length > 0 ? renderBlocksToHtml(blocks) : markdownToHtml(markdown);
    try {
      const result = await pool.query(
        `INSERT INTO role_room_newsletter_issues
           (user_id, slug, title, subject, preheader, body_markdown, body_html, body_blocks, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'draft')
         RETURNING *`,
        [session.userId, slug, title, subject, preheader, markdown, renderedHtml, JSON.stringify(blocks)],
      );
      res.status(201).json({ item: result.rows[0] });
    } catch (err) {
      console.error("[newsletter-issues] create error", err);
      res.status(500).json({ error: "Kunne ikke opprette utgave" });
    }
  });

  app.patch("/api/admin-room/newsletter/role-room/issues/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: string[] = [];
    const params: unknown[] = [];
    function set(col: string, val: unknown, cast?: string) {
      params.push(val);
      const placeholder = cast ? `$${params.length}::${cast}` : `$${params.length}`;
      updates.push(`${col} = ${placeholder}`);
    }
    if (body.title !== undefined) set("title", asString(body.title));
    if (body.subject !== undefined) set("subject", asString(body.subject));
    if (body.preheader !== undefined) set("preheader", asString(body.preheader));
    if (body.bodyBlocks !== undefined) {
      const blocks = asBlocks(body.bodyBlocks);
      set("body_blocks", JSON.stringify(blocks), "jsonb");
      set("body_html", renderBlocksToHtml(blocks));
    } else if (body.bodyMarkdown !== undefined) {
      const md = asString(body.bodyMarkdown) ?? "";
      set("body_markdown", md);
      set("body_html", markdownToHtml(md));
    }
    if (body.scheduledFor !== undefined) set("scheduled_for", asString(body.scheduledFor));
    if (body.audienceFilter !== undefined) {
      const f = asString(body.audienceFilter, "all") ?? "all";
      set("audience_filter", f);
    }
    if (updates.length === 0) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }
    updates.push("updated_at = NOW()");
    params.push(session.userId);
    params.push(req.params.id);
    try {
      const result = await pool.query(
        `UPDATE role_room_newsletter_issues
            SET ${updates.join(", ")}
          WHERE user_id = $${params.length - 1} AND id = $${params.length}
          RETURNING *`,
        params,
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Utgave ikke funnet" });
        return;
      }
      res.json({ item: result.rows[0] });
    } catch (err) {
      console.error("[newsletter-issues] patch error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere utgave" });
    }
  });

  app.delete("/api/admin-room/newsletter/role-room/issues/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM role_room_newsletter_issues WHERE user_id = $1 AND id = $2 RETURNING slug`,
        [session.userId, req.params.id],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Utgave ikke funnet" });
        return;
      }
      res.status(204).end();
    } catch (err) {
      console.error("[newsletter-issues] delete error", err);
      res.status(500).json({ error: "Kunne ikke slette utgave" });
    }
  });

  app.post("/api/admin-room/newsletter/role-room/issues/:id/send-test", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const testEmail = asString(body.email) ?? session.email;
    try {
      const issueRes = await pool.query(
        `SELECT * FROM role_room_newsletter_issues WHERE user_id = $1 AND id = $2`,
        [session.userId, req.params.id],
      );
      const issue = issueRes.rows[0];
      if (!issue) {
        res.status(404).json({ error: "Utgave ikke funnet" });
        return;
      }
      // Bruk en throwaway token for test-send slik at unsubscribe-lenken peker
      // til en gyldig (men irrelevant) verdi.
      const testToken = crypto.randomBytes(24).toString("hex");
      const result = await sendNewsletterIssueToRecipient({
        to: testEmail,
        subject: `[TEST] ${issue.subject}`,
        preheader: issue.preheader ?? "",
        bodyHtml: issue.body_html ?? markdownToHtml(issue.body_markdown),
        unsubscribeToken: testToken,
      });
      if (!result.sent) {
        res.status(500).json({ error: result.error || "Kunne ikke sende test" });
        return;
      }
      res.json({ ok: true, sentTo: testEmail });
    } catch (err) {
      console.error("[newsletter-issues] send-test error", err);
      res.status(500).json({ error: "Kunne ikke sende test" });
    }
  });

  app.post("/api/admin-room/newsletter/role-room/issues/:id/send", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const issueRes = await pool.query(
        `SELECT * FROM role_room_newsletter_issues WHERE user_id = $1 AND id = $2`,
        [session.userId, req.params.id],
      );
      const issue = issueRes.rows[0];
      if (!issue) {
        res.status(404).json({ error: "Utgave ikke funnet" });
        return;
      }
      if (issue.status === "sending" || issue.status === "sent") {
        res.status(409).json({ error: `Utgaven er allerede ${issue.status}` });
        return;
      }

      // Audience-filtrering: 'all' (default), 'tier1-advocates' (kun advocates
      // fra industry_targets), 'source-*' (signups med spesifikk pillar-source)
      const filter = issue.audience_filter ?? "all";
      let whereClause = "status = 'confirmed' AND unsubscribed_at IS NULL";
      const params: unknown[] = [];
      if (filter === "tier1-advocates") {
        // Send kun til signups som har e-post som matcher en T1 advocate
        whereClause += ` AND LOWER(email) IN (SELECT LOWER(email) FROM role_room_industry_targets WHERE tier = 'T1' AND status = 'advocate' AND email IS NOT NULL)`;
      } else if (filter === "tier1-engaged") {
        whereClause += ` AND LOWER(email) IN (SELECT LOWER(email) FROM role_room_industry_targets WHERE tier = 'T1' AND status IN ('engaged','advocate') AND email IS NOT NULL)`;
      } else if (typeof filter === "string" && filter.startsWith("source-")) {
        params.push(filter.replace(/^source-/, ""));
        whereClause += ` AND source = $${params.length}`;
      }

      const subscribersRes = await pool.query(
        `SELECT id, email, unsubscribe_token
           FROM role_room_newsletter_signups
          WHERE ${whereClause}`,
        params,
      );
      const subscribers = subscribersRes.rows as { id: string; email: string; unsubscribe_token: string | null }[];

      await pool.query(`UPDATE role_room_newsletter_issues SET status='sending', updated_at=NOW() WHERE id=$1`, [issue.id]);

      // Async fire — returnerer raskt til admin, batch-sender i bakgrunnen.
      // Hver send er stand-alone slik at en feil ikke stopper resten.
      void (async () => {
        let sentCount = 0;
        let failedCount = 0;
        for (const sub of subscribers) {
          if (!sub.unsubscribe_token) {
            failedCount += 1;
            continue;
          }
          try {
            const result = await sendNewsletterIssueToRecipient({
              to: sub.email,
              subject: issue.subject,
              preheader: issue.preheader ?? "",
              bodyHtml: issue.body_html ?? markdownToHtml(issue.body_markdown),
              unsubscribeToken: sub.unsubscribe_token,
              issueId: issue.id,
              signupId: sub.id,
            });
            if (result.sent) {
              sentCount += 1;
              await pool.query(
                `INSERT INTO role_room_newsletter_issue_sends (issue_id, signup_id, email, status, sent_at)
                 VALUES ($1, $2, $3, 'sent', NOW())
                 ON CONFLICT (issue_id, signup_id) DO UPDATE
                   SET status='sent', sent_at=NOW(), error_message=NULL`,
                [issue.id, sub.id, sub.email],
              );
            } else {
              failedCount += 1;
              await pool.query(
                `INSERT INTO role_room_newsletter_issue_sends (issue_id, signup_id, email, status, error_message)
                 VALUES ($1, $2, $3, 'failed', $4)
                 ON CONFLICT (issue_id, signup_id) DO UPDATE
                   SET status='failed', error_message=EXCLUDED.error_message`,
                [issue.id, sub.id, sub.email, result.error ?? "unknown"],
              );
            }
          } catch (err) {
            failedCount += 1;
            await pool.query(
              `INSERT INTO role_room_newsletter_issue_sends (issue_id, signup_id, email, status, error_message)
               VALUES ($1, $2, $3, 'failed', $4)
               ON CONFLICT (issue_id, signup_id) DO UPDATE
                 SET status='failed', error_message=EXCLUDED.error_message`,
              [issue.id, sub.id, sub.email, (err as Error).message],
            );
          }
        }
        await pool.query(
          `UPDATE role_room_newsletter_issues
              SET status = 'sent',
                  sent_at = NOW(),
                  sent_count = $1,
                  failed_count = $2,
                  updated_at = NOW()
            WHERE id = $3`,
          [sentCount, failedCount, issue.id],
        );

        // ── B2-arkivering (fire-and-forget) ─────────────────────────────
        // Lagrer rendert HTML + block-struktur + meta til
        // the-role-room-prod/newsletters/issues/YYYY-MM/{issueId}.{html|json|meta.json}
        // for langtidsarkiv. Feiler stille hvis B2 ikke konfigurert.
        try {
          const renderedHtml = issue.body_html ?? markdownToHtml(issue.body_markdown ?? "");
          const blocks = asBlocks(issue.blocks);
          const meta = {
            issueId: issue.id,
            subject: issue.subject,
            preheader: issue.preheader,
            audienceFilter: issue.audience_filter ?? "all",
            sentAt: new Date().toISOString(),
            sentCount,
            failedCount,
            recipientCount: subscribers.length,
            archivedAt: new Date().toISOString(),
          };
          await Promise.all([
            archiveToRoleRoomB2(newsletterIssueKey(issue.id, "html"), renderedHtml, "text/html; charset=utf-8"),
            archiveToRoleRoomB2(
              newsletterIssueKey(issue.id, "blocks.json"),
              JSON.stringify(blocks, null, 2),
              "application/json; charset=utf-8",
            ),
            archiveToRoleRoomB2(
              newsletterIssueKey(issue.id, "meta.json"),
              JSON.stringify(meta, null, 2),
              "application/json; charset=utf-8",
            ),
          ]);
        } catch (err) {
          // archive-feil må aldri propageres — sending er allerede ferdig
          console.warn("[newsletter-issues] B2-arkivering feilet", (err as Error).message);
        }
      })().catch((err) => console.error("[newsletter-issues] async send error", err));

      res.status(202).json({
        ok: true,
        message: `Sending startet til ${subscribers.length} mottakere. Poll /issues/${issue.id} for status.`,
        recipientCount: subscribers.length,
      });
    } catch (err) {
      console.error("[newsletter-issues] send error", err);
      res.status(500).json({ error: "Kunne ikke starte sending" });
    }
  });

  // ── Public web-arkiv ──────────────────────────────────────────────

  app.get("/api/newsletter/role-room/brief", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT slug, title, subject, preheader, published_at, seo_description,
                COALESCE(audience_count_estimate, sent_count) AS reach
           FROM role_room_newsletter_issues
          WHERE published_to_web = TRUE AND status = 'sent'
          ORDER BY published_at DESC NULLS LAST, sent_at DESC NULLS LAST
          LIMIT 100`,
      );
      res.json({ issues: result.rows });
    } catch (err) {
      console.error("[newsletter-brief] list error", err);
      res.status(500).json({ error: "Kunne ikke hente brief-arkiv" });
    }
  });

  app.get("/api/newsletter/role-room/brief/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      const result = await pool.query(
        `SELECT id, slug, title, subject, preheader, body_html, body_blocks,
                published_at, seo_description, sent_count
           FROM role_room_newsletter_issues
          WHERE published_to_web = TRUE AND status = 'sent' AND slug = $1`,
        [slug],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Utgave ikke funnet eller ikke publisert" });
        return;
      }
      // Inkrement view-count async
      void pool.query(`UPDATE role_room_newsletter_issues SET web_view_count = web_view_count + 1 WHERE id = $1`, [result.rows[0].id]);
      res.json({ issue: result.rows[0] });
    } catch (err) {
      console.error("[newsletter-brief] get error", err);
      res.status(500).json({ error: "Kunne ikke hente utgave" });
    }
  });

  app.post("/api/admin-room/newsletter/role-room/issues/:id/publish", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const seoDescription = asString(body.seoDescription);
    try {
      const result = await pool.query(
        `UPDATE role_room_newsletter_issues
            SET published_to_web = TRUE,
                published_at = COALESCE(published_at, NOW()),
                seo_description = COALESCE($1, seo_description, preheader),
                updated_at = NOW()
          WHERE id = $2 AND user_id = $3 AND status = 'sent'
          RETURNING *`,
        [seoDescription, req.params.id, session.userId],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Utgave ikke funnet eller ikke sendt enda — kun sendte utgaver kan publiseres" });
        return;
      }
      res.json({ ok: true, item: result.rows[0] });
    } catch (err) {
      console.error("[newsletter-publish] error", err);
      res.status(500).json({ error: "Kunne ikke publisere" });
    }
  });

  app.post("/api/admin-room/newsletter/role-room/issues/:id/unpublish", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `UPDATE role_room_newsletter_issues
            SET published_to_web = FALSE, updated_at = NOW()
          WHERE id = $1 AND user_id = $2
          RETURNING *`,
        [req.params.id, session.userId],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Utgave ikke funnet" });
        return;
      }
      res.json({ ok: true, item: result.rows[0] });
    } catch (err) {
      console.error("[newsletter-unpublish] error", err);
      res.status(500).json({ error: "Kunne ikke avpublisere" });
    }
  });

  // ── Templates CRUD ────────────────────────────────────────────────

  app.get("/api/admin-room/newsletter/role-room/templates", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT id, slug, name, description, preheader, is_default, use_count, body_blocks, updated_at
           FROM role_room_newsletter_templates
          WHERE user_id IS NULL OR user_id = $1
          ORDER BY is_default DESC, updated_at DESC`,
        [session.userId],
      );
      res.json({ items: result.rows });
    } catch (err) {
      console.error("[newsletter-templates] list error", err);
      res.status(500).json({ error: "Kunne ikke hente maler" });
    }
  });

  app.post("/api/admin-room/newsletter/role-room/templates", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = asString(body.name);
    const slug = asString(body.slug) || (name ? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) : null);
    if (!name || !slug) {
      res.status(400).json({ error: "name er påkrevd" });
      return;
    }
    const blocks = asBlocks(body.bodyBlocks);
    try {
      const result = await pool.query(
        `INSERT INTO role_room_newsletter_templates
           (user_id, slug, name, description, preheader, body_blocks)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING *`,
        [session.userId, slug, name, asString(body.description), asString(body.preheader), JSON.stringify(blocks)],
      );
      res.status(201).json({ item: result.rows[0] });
    } catch (err) {
      console.error("[newsletter-templates] create error", err);
      res.status(500).json({ error: "Kunne ikke opprette mal" });
    }
  });

  app.delete("/api/admin-room/newsletter/role-room/templates/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `DELETE FROM role_room_newsletter_templates WHERE id = $1 AND user_id = $2 RETURNING name`,
        [req.params.id, session.userId],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Mal ikke funnet (system-maler kan ikke slettes)" });
        return;
      }
      res.status(204).end();
    } catch (err) {
      console.error("[newsletter-templates] delete error", err);
      res.status(500).json({ error: "Kunne ikke slette mal" });
    }
  });

  // ── Per-link click-rapport ────────────────────────────────────────

  app.get("/api/admin-room/newsletter/role-room/issues/:id/clicks", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      // Verifiser at issuen tilhører user
      const issueRes = await pool.query(
        `SELECT id, sent_count FROM role_room_newsletter_issues WHERE id = $1 AND user_id = $2`,
        [req.params.id, session.userId],
      );
      if (issueRes.rows.length === 0) {
        res.status(404).json({ error: "Utgave ikke funnet" });
        return;
      }
      const linksRes = await pool.query(
        `SELECT
           destination_url,
           COUNT(*)::int AS total_clicks,
           COUNT(DISTINCT signup_id)::int AS unique_clicks
         FROM role_room_newsletter_issue_clicks
        WHERE issue_id = $1
        GROUP BY destination_url
        ORDER BY total_clicks DESC
        LIMIT 50`,
        [req.params.id],
      );
      res.json({ links: linksRes.rows, sentCount: issueRes.rows[0].sent_count });
    } catch (err) {
      console.error("[newsletter-clicks] error", err);
      res.status(500).json({ error: "Kunne ikke hente click-rapport" });
    }
  });

  // ── Schedule + cron-loop ──────────────────────────────────────────

  app.post("/api/admin-room/newsletter/role-room/issues/:id/schedule", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const scheduledFor = asString(body.scheduledFor);
    if (!scheduledFor) {
      res.status(400).json({ error: "scheduledFor (ISO datetime) er påkrevd" });
      return;
    }
    const parsedDate = new Date(scheduledFor);
    if (!Number.isFinite(parsedDate.getTime())) {
      res.status(400).json({ error: "scheduledFor må være gyldig ISO datetime" });
      return;
    }
    if (parsedDate.getTime() < Date.now() - 60_000) {
      res.status(400).json({ error: "scheduledFor må være i fremtiden" });
      return;
    }
    try {
      const result = await pool.query(
        `UPDATE role_room_newsletter_issues
            SET status = 'scheduled', scheduled_for = $1, updated_at = NOW()
          WHERE id = $2 AND user_id = $3 AND status IN ('draft', 'scheduled')
          RETURNING *`,
        [parsedDate.toISOString(), req.params.id, session.userId],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Utgave ikke funnet eller kan ikke planlegges (allerede sendt?)" });
        return;
      }
      res.json({ ok: true, item: result.rows[0] });
    } catch (err) {
      console.error("[newsletter-issues] schedule error", err);
      res.status(500).json({ error: "Kunne ikke planlegge utgaven" });
    }
  });

  app.post("/api/admin-room/newsletter/role-room/issues/:id/unschedule", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `UPDATE role_room_newsletter_issues
            SET status = 'draft', scheduled_for = NULL, updated_at = NOW()
          WHERE id = $1 AND user_id = $2 AND status = 'scheduled'
          RETURNING *`,
        [req.params.id, session.userId],
      );
      if (result.rows.length === 0) {
        res.status(404).json({ error: "Utgave ikke funnet eller ikke planlagt" });
        return;
      }
      res.json({ ok: true, item: result.rows[0] });
    } catch (err) {
      console.error("[newsletter-issues] unschedule error", err);
      res.status(500).json({ error: "Kunne ikke avbryte planlegging" });
    }
  });

  // In-process scheduler: hvert minutt sjekker vi om noen scheduled issues
  // har scheduled_for <= NOW. Hvis ja, plukker vi opp én og kaller send-logikken
  // ved å oppdatere status til 'sending' og kjøre send-loopen.
  // Idempotent: status='sending' låser issuen så parallelle workers ikke
  // dobbeltsender (UPDATE ... WHERE status='scheduled' RETURNING).
  async function runScheduledDispatch(): Promise<void> {
    try {
      const claimed = await pool.query(
        `UPDATE role_room_newsletter_issues
            SET status = 'sending', updated_at = NOW()
          WHERE id IN (
            SELECT id FROM role_room_newsletter_issues
             WHERE status = 'scheduled' AND scheduled_for IS NOT NULL AND scheduled_for <= NOW()
             ORDER BY scheduled_for ASC
             LIMIT 1
             FOR UPDATE SKIP LOCKED
          )
          RETURNING *`,
      );
      const issue = claimed.rows[0];
      if (!issue) return;
      console.info(`[newsletter-scheduler] dispatching ${issue.id} (${issue.slug})`);

      // Filter-spec — samme logikk som /send-endpoint
      const filter = issue.audience_filter ?? "all";
      let whereClause = "status = 'confirmed' AND unsubscribed_at IS NULL";
      const params: unknown[] = [];
      if (filter === "tier1-advocates") {
        whereClause += ` AND LOWER(email) IN (SELECT LOWER(email) FROM role_room_industry_targets WHERE tier = 'T1' AND status = 'advocate' AND email IS NOT NULL)`;
      } else if (filter === "tier1-engaged") {
        whereClause += ` AND LOWER(email) IN (SELECT LOWER(email) FROM role_room_industry_targets WHERE tier = 'T1' AND status IN ('engaged','advocate') AND email IS NOT NULL)`;
      } else if (typeof filter === "string" && filter.startsWith("source-")) {
        params.push(filter.replace(/^source-/, ""));
        whereClause += ` AND source = $${params.length}`;
      }
      const subscribersRes = await pool.query(
        `SELECT id, email, unsubscribe_token FROM role_room_newsletter_signups WHERE ${whereClause}`,
        params,
      );
      const subscribers = subscribersRes.rows as { id: string; email: string; unsubscribe_token: string | null }[];

      let sentCount = 0;
      let failedCount = 0;
      for (const sub of subscribers) {
        if (!sub.unsubscribe_token) { failedCount += 1; continue; }
        try {
          const result = await sendNewsletterIssueToRecipient({
            to: sub.email,
            subject: issue.subject,
            preheader: issue.preheader ?? "",
            bodyHtml: issue.body_html ?? markdownToHtml(issue.body_markdown),
            unsubscribeToken: sub.unsubscribe_token,
            issueId: issue.id,
            signupId: sub.id,
          });
          if (result.sent) {
            sentCount += 1;
            await pool.query(
              `INSERT INTO role_room_newsletter_issue_sends (issue_id, signup_id, email, status, sent_at)
               VALUES ($1, $2, $3, 'sent', NOW())
               ON CONFLICT (issue_id, signup_id) DO UPDATE SET status='sent', sent_at=NOW(), error_message=NULL`,
              [issue.id, sub.id, sub.email],
            );
          } else {
            failedCount += 1;
            await pool.query(
              `INSERT INTO role_room_newsletter_issue_sends (issue_id, signup_id, email, status, error_message)
               VALUES ($1, $2, $3, 'failed', $4)
               ON CONFLICT (issue_id, signup_id) DO UPDATE SET status='failed', error_message=EXCLUDED.error_message`,
              [issue.id, sub.id, sub.email, result.error ?? "unknown"],
            );
          }
        } catch (err) {
          failedCount += 1;
          await pool.query(
            `INSERT INTO role_room_newsletter_issue_sends (issue_id, signup_id, email, status, error_message)
             VALUES ($1, $2, $3, 'failed', $4)
             ON CONFLICT (issue_id, signup_id) DO UPDATE SET status='failed', error_message=EXCLUDED.error_message`,
            [issue.id, sub.id, sub.email, (err as Error).message],
          );
        }
      }
      await pool.query(
        `UPDATE role_room_newsletter_issues
            SET status = 'sent', sent_at = NOW(), sent_count = $1, failed_count = $2, updated_at = NOW()
          WHERE id = $3`,
        [sentCount, failedCount, issue.id],
      );
      console.info(`[newsletter-scheduler] ${issue.id} sent: ${sentCount} ok, ${failedCount} failed`);
    } catch (err) {
      console.error("[newsletter-scheduler] tick error", err);
    }
  }

  // Start scheduler hvis ikke explicitly disabled
  if (process.env.NEWSLETTER_SCHEDULER_ENABLED !== "false") {
    const interval = setInterval(() => { void runScheduledDispatch(); }, 60_000);
    interval.unref();
    // Første tick rett etter boot (etter 10 sek så DB er klar)
    setTimeout(() => { void runScheduledDispatch(); }, 10_000).unref();
    console.info("[newsletter-scheduler] started — polling every 60s");
  }
}

function htmlPage(title: string, message: string): string {
  return `<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8"><title>${title}</title>
<style>body{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#e5e7eb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
.box{max-width:480px;text-align:center;padding:32px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(255,255,255,0.03)}
h1{color:#fff;margin:0 0 12px}p{color:rgba(229,231,235,0.75);line-height:1.6;margin:0}a{color:#a78bfa}</style>
</head><body><div class="box"><h1>${title}</h1><p>${message}</p><p style="margin-top:24px"><a href="https://theroleroom.com">← Tilbake til The Role Room</a></p></div></body></html>`;
}
