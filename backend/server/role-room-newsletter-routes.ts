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
      console.error("[role-room-newsletter] stats error", err);
      res.status(500).json({ error: "Kunne ikke hente newsletter-statistikk" });
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
      console.error("[role-room-newsletter] signups error", err);
      res.status(500).json({ error: "Kunne ikke hente påmeldinger" });
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
      console.error("[newsletter-issues] list error", err);
      res.status(500).json({ error: "Kunne ikke hente utgaver" });
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

      const subscribersRes = await pool.query(
        `SELECT id, email, unsubscribe_token
           FROM role_room_newsletter_signups
          WHERE status = 'confirmed' AND unsubscribed_at IS NULL`,
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
}

function htmlPage(title: string, message: string): string {
  return `<!DOCTYPE html><html lang="no"><head><meta charset="UTF-8"><title>${title}</title>
<style>body{font-family:-apple-system,sans-serif;background:#0a0a0f;color:#e5e7eb;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
.box{max-width:480px;text-align:center;padding:32px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(255,255,255,0.03)}
h1{color:#fff;margin:0 0 12px}p{color:rgba(229,231,235,0.75);line-height:1.6;margin:0}a{color:#a78bfa}</style>
</head><body><div class="box"><h1>${title}</h1><p>${message}</p><p style="margin-top:24px"><a href="https://theroleroom.com">← Tilbake til The Role Room</a></p></div></body></html>`;
}
