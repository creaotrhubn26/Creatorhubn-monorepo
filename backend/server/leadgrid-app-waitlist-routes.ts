/**
 * leadgrid-app-waitlist-routes.ts
 *
 * Leadgrid-appen (iOS) er i TestFlight, ikke live på App Store ennå.
 * Header-lenken som før pekte "Logg inn" til creatorhubn.com peker nå til
 * en venteliste-modal — besøkende legger igjen e-post og varsles ved
 * App Store-lansering. Speiler leadgrid-demo-request-routes: lat
 * ensureSchema, offentlig endepunkt (landing har ingen sesjon).
 *
 * Lanserings-utsendelse (admin): POST /api/leadgrid/app-waitlist/notify-launch
 * med { appStoreUrl } sender "appen er live"-e-post til alle upvarslede i
 * ventelisten, én om gangen med kort pause (Gmail SMTP — unngå burst/spam-
 * flagging). At-most-once: delivery_started_at committes før SMTP. Uklare
 * leveringsutfall blir liggende for manuell avklaring og auto-retries aldri.
 */

import type { Express, NextFunction, Request, Response } from "express";
import type { Pool } from "pg";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { sendEmail, isEmailConfigured } from "./casting-reminder-sender.js";
import { resolveLeadgridPublicClientIp } from "./org-self-onboard-routes.js";

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,24}$/;
const clip = (v: unknown, n: number) =>
  String(v ?? "")
    .trim()
    .slice(0, n);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// `admin` is intentionally accepted only after requireAdminRoomAccess has
// verified the exact product-owner email. It must never become a general
// tenant-admin permission.
const GLOBAL_SEND_ROLES = new Set(["admin", "owner", "super_admin"]);
const NOTIFICATION_MAX_PER_REQUEST = 100;
const NOTIFICATION_CLAIM_LEASE_SECONDS = 30 * 60;
// Nodemailer får korte transport-timeouts. Timeout er operasjonell avgrensning,
// ikke idempotens: delivery_started_at er den autoritative at-most-once-grensen.
const NOTIFICATION_SMTP_TIMEOUT_MS = 2 * 60_000;
const NOTIFICATION_UNCERTAIN_AFTER_SECONDS =
  Math.ceil(NOTIFICATION_SMTP_TIMEOUT_MS / 1_000) + 60;
export const LEADGRID_APP_WAITLIST_BODY_LIMIT_BYTES = 2 * 1024;

export function requireLeadgridAppWaitlistJsonEnvelope(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");

  if (!req.is(["application/json", "application/*+json"])) {
    res.status(415).json({ error: "content_type_must_be_json" });
    return;
  }

  const rawContentLength = req.get("content-length")?.trim();
  if (rawContentLength) {
    if (!/^\d+$/.test(rawContentLength)) {
      res.status(400).json({ error: "invalid_content_length" });
      return;
    }
    const contentLength = Number(rawContentLength);
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength > LEADGRID_APP_WAITLIST_BODY_LIMIT_BYTES
    ) {
      res.status(413).json({ error: "request_body_too_large" });
      return;
    }
  }

  next();
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeAppStoreUrl(value: unknown): string | null {
  const raw = clip(value, 500);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname.toLowerCase() !== "apps.apple.com" ||
      parsed.username ||
      parsed.password ||
      parsed.port
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Samme visuelle språk som leadgrid-drips-routes.ts (mørk bg #0a0512,
// lilla #a78bfa branding, gradient-CTA) — så alle Leadgrid-transaksjons-
// e-poster føles som samme avsender.
function launchEmailHtml(appStoreUrl: string): string {
  const safeAppStoreUrl = escapeHtmlAttribute(appStoreUrl);
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0512;color:#fff;">
      <h1 style="color:#a78bfa;font-size:24px;margin:0 0 16px;">Leadgrid</h1>
      <p>Hei!</p>
      <p>Leadgrid for iPhone/iPad er nå live på App Store — takk for at du ventet på ventelisten.</p>
      <div style="background:rgba(255,255,255,0.04);padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 8px;"><strong>📍 Kartbasert prospektering</strong></p>
        <p style="margin:0 0 12px;color:rgba(255,255,255,0.7);font-size:14px;">Finn og organiser leads rett fra kartet i felten</p>
        <p style="margin:0 0 8px;"><strong>🔄 Synkronisert med web</strong></p>
        <p style="margin:0;color:rgba(255,255,255,0.7);font-size:14px;">Samme data som Leadgrid-kontoen din på nett</p>
      </div>
      <p>
        <a href="${safeAppStoreUrl}" style="background:#a78bfa;color:#0a0512;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
          Last ned på App Store
        </a>
      </p>
      <p style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:32px;">
        Du får denne e-posten fordi du meldte deg på venteliste for Leadgrid-appen på leadgrid.no.
      </p>
    </div>`;
}

type SessionData = { userId: string; role?: string; email?: string };
type AdminRoomSession = { userId: string; email: string };
type AuthoritativeSessionResolution =
  | { status: "authenticated"; session: SessionData }
  | { status: "unauthenticated" }
  | { status: "unavailable" };

let schemaReadyPromise: Promise<void> | null = null;
async function ensureSchema(pool: Pool): Promise<void> {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS leadgrid_app_waitlist (
          id UUID PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          notified_at TIMESTAMPTZ,
          notification_claim_id UUID,
          notification_claim_expires_at TIMESTAMPTZ,
          notification_delivery_started_at TIMESTAMPTZ,
          notification_delivery_uncertain_at TIMESTAMPTZ,
          notification_delivery_error TEXT,
          notification_message_id TEXT
        )
      `);
      // Additive self-migration for installations created before claims were
      // introduced. A failed migration is retryable on the next request.
      await pool.query(`
        ALTER TABLE leadgrid_app_waitlist
          ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS notification_claim_id UUID,
          ADD COLUMN IF NOT EXISTS notification_claim_expires_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS notification_delivery_started_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS notification_delivery_uncertain_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS notification_delivery_error TEXT,
          ADD COLUMN IF NOT EXISTS notification_message_id TEXT
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_leadgrid_app_waitlist_pending_delivery_v2
          ON leadgrid_app_waitlist (created_at, notification_claim_expires_at)
          WHERE notified_at IS NULL
            AND notification_delivery_started_at IS NULL
      `);
    })();
  }

  try {
    await schemaReadyPromise;
  } catch (error) {
    schemaReadyPromise = null;
    throw error;
  }
}

type ClaimedWaitlistRow = { id: string; email: string };

function stableNotificationMessageId(rowId: string): string {
  return `<leadgrid-app-launch-${rowId.toLowerCase()}@creatorhubn.com>`;
}

async function claimNextPendingNotification(pool: Pool): Promise<{
  claimId: string;
  row: ClaimedWaitlistRow | null;
}> {
  const claimId = globalThis.crypto.randomUUID();
  const claimed = await pool.query<ClaimedWaitlistRow>(
    `WITH claimable AS (
       SELECT id
         FROM leadgrid_app_waitlist
        WHERE notified_at IS NULL
          AND notification_delivery_started_at IS NULL
          AND (
            notification_claim_id IS NULL
            OR notification_claim_expires_at IS NULL
            OR notification_claim_expires_at <= now()
          )
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
     )
     UPDATE leadgrid_app_waitlist AS waitlist
        SET notification_claim_id = $1::uuid,
            notification_claim_expires_at = now() + ($2::int * interval '1 second')
       FROM claimable
      WHERE waitlist.id = claimable.id
      RETURNING waitlist.id, waitlist.email`,
    [claimId, NOTIFICATION_CLAIM_LEASE_SECONDS],
  );
  return { claimId, row: claimed.rows[0] ?? null };
}

async function startNotificationDelivery(
  pool: Pool,
  rowId: string,
  claimId: string,
): Promise<(ClaimedWaitlistRow & { message_id: string }) | null> {
  const messageId = stableNotificationMessageId(rowId);
  // Dette er at-most-once-grensen: delivery_started_at committes FØR SMTP.
  // En startet rad er aldri auto-claimbar igjen, selv når claim-leasen utløper.
  // Claim-ID-en beskytter samtidig mot en worker som mistet raden før start.
  const started = await pool.query<
    ClaimedWaitlistRow & { message_id: string }
  >(
    `UPDATE leadgrid_app_waitlist
        SET notification_delivery_started_at = now(),
            notification_delivery_uncertain_at = NULL,
            notification_delivery_error = NULL,
            notification_message_id = COALESCE(notification_message_id, $3)
      WHERE id = $1
        AND notification_claim_id = $2::uuid
        AND notified_at IS NULL
        AND notification_delivery_started_at IS NULL
      RETURNING id, email, notification_message_id AS message_id`,
    [rowId, claimId, messageId],
  );
  return started.rows[0] ?? null;
}

async function quarantineNotificationDelivery(
  pool: Pool,
  rowId: string,
  claimId: string,
  error: string,
): Promise<void> {
  await pool.query(
    `UPDATE leadgrid_app_waitlist
        SET notification_delivery_uncertain_at = COALESCE(notification_delivery_uncertain_at, now()),
            notification_delivery_error = $3,
            notification_claim_expires_at = NULL
      WHERE id = $1
        AND notification_claim_id = $2::uuid
        AND notification_delivery_started_at IS NOT NULL
        AND notified_at IS NULL`,
    [rowId, claimId, clip(error, 500)],
  );
}

async function releaseDefinitePreDeliveryFailure(
  pool: Pool,
  rowId: string,
  claimId: string,
  error: string,
): Promise<void> {
  await pool.query(
    `UPDATE leadgrid_app_waitlist
        SET notification_claim_id = NULL,
            notification_claim_expires_at = NULL,
            notification_delivery_started_at = NULL,
            notification_delivery_uncertain_at = NULL,
            notification_delivery_error = $3
      WHERE id = $1
        AND notification_claim_id = $2::uuid
        AND notification_delivery_started_at IS NOT NULL
        AND notification_delivery_uncertain_at IS NULL
        AND notified_at IS NULL`,
    [rowId, claimId, clip(error, 500)],
  );
}

export function registerLeadgridAppWaitlistRoutes(deps: {
  app: Express;
  pool: Pool;
  resolveAuthoritativeSessionFromRequest: (
    req: Request,
  ) => Promise<AuthoritativeSessionResolution>;
  requireAdminRoomAccess: (
    req: Request,
    res: Response,
  ) => AdminRoomSession | null;
}) {
  const {
    app,
    pool,
    resolveAuthoritativeSessionFromRequest,
    requireAdminRoomAccess,
  } = deps;

  // Høy-konsekvensrutene krever en autoritativ produksjonslesing fra det
  // persistente session-lageret på hvert kall. Resolveren oppdaterer/evikter
  // minnecache før den synkrone owner-guard-en leser den. Session.role er
  // aldri autoritet her.
  async function requireCanonicalAdminRoomAccess(
    req: Request,
    res: Response,
  ): Promise<AdminRoomSession | null> {
    const resolution = await resolveAuthoritativeSessionFromRequest(req);
    if (resolution.status === "unavailable") {
      res.status(503).json({ error: "session_verification_unavailable" });
      return null;
    }
    if (resolution.status === "unauthenticated") {
      res.status(401).json({ error: "ikke_innlogget" });
      return null;
    }
    const resolved = resolution.session;
    const adminRoomSession = requireAdminRoomAccess(req, res);
    if (!adminRoomSession) return null;

    if (
      adminRoomSession.userId !== resolved.userId ||
      normalizeEmail(adminRoomSession.email) !== normalizeEmail(resolved.email)
    ) {
      res.status(403).json({ error: "admin_session_mismatch" });
      return null;
    }
    return adminRoomSession;
  }

  // Offentlig skjema: 10 forsøk per 15 minutter per Express-resolvert IP.
  // Gjenbruker repoets installerte express-rate-limit i stedet for en ny
  // ubegrenset in-memory map. Samme JSON-feil brukes av andre public forms.
  const publicSignupRateLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) =>
      ipKeyGenerator(resolveLeadgridPublicClientIp(req)),
    handler: (_req, res) =>
      res.status(429).json({ error: "too_many_requests" }),
  });

  app.post(
    "/api/leadgrid/app-waitlist",
    publicSignupRateLimit,
    requireLeadgridAppWaitlistJsonEnvelope,
    async (req, res) => {
      try {
        const email = clip(req.body?.email, 320).toLowerCase();
        if (!EMAIL_RE.test(email))
          return res.status(400).json({ error: "invalid_email" });
        await ensureSchema(pool);

        const inserted = await pool.query(
          `INSERT INTO leadgrid_app_waitlist (id, email) VALUES ($1, $2)
         ON CONFLICT (email) DO NOTHING`,
          [(globalThis.crypto as any).randomUUID(), email],
        );

        const notify =
          process.env.LEADGRID_SIGNUP_NOTIFY_EMAIL || "daniel@creatorhubn.com";
        // ON CONFLICT gir samme offentlige svar for ny/eksisterende e-post, men
        // adminvarsling skjer bare ved en faktisk ny rad (ingen duplicate spam).
        if ((inserted.rowCount ?? 0) > 0 && notify && isEmailConfigured()) {
          const safeEmail = escapeHtmlAttribute(email);
          void sendEmail({
            to: notify,
            subject: `Ny app-venteliste-påmelding: ${email}`,
            html: `<p>Ny påmelding til <b>Leadgrid App Store-venteliste</b>: ${safeEmail}</p>`,
            fromName: "Leadgrid",
          }).catch(() => {
            /* varsling er best-effort — påmeldingen er lagret */
          });
        }
        return res.json({ ok: true });
      } catch (err) {
        console.warn("[leadgrid-app-waitlist] failed:", (err as Error).message);
        return res.status(500).json({ error: "waitlist_failed" });
      }
    },
  );

  // ── Status (admin) — antall totalt / upvarslet, for å sjekke før man trigger. ──
  app.get("/api/leadgrid/app-waitlist/status", async (req, res) => {
    if (!(await requireCanonicalAdminRoomAccess(req, res))) return;
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT count(*)::int AS total,
                count(*) FILTER (
                  WHERE notified_at IS NULL
                    AND notification_delivery_started_at IS NULL
                )::int AS pending,
                count(*) FILTER (
                  WHERE notified_at IS NULL
                    AND notification_delivery_started_at IS NOT NULL
                    AND (
                      notification_delivery_uncertain_at IS NOT NULL
                      OR notification_delivery_started_at <= now() - ($1::int * interval '1 second')
                    )
                )::int AS uncertain,
                count(*) FILTER (
                  WHERE notified_at IS NULL
                    AND notification_delivery_started_at IS NOT NULL
                    AND notification_delivery_uncertain_at IS NULL
                    AND notification_delivery_started_at > now() - ($1::int * interval '1 second')
                )::int AS in_progress
           FROM leadgrid_app_waitlist`,
        [NOTIFICATION_UNCERTAIN_AFTER_SECONDS],
      );
      return res.json({
        total: r.rows[0].total,
        pending: r.rows[0].pending,
        uncertain: r.rows[0].uncertain,
        in_progress: r.rows[0].in_progress,
      });
    } catch (err) {
      console.warn(
        "[leadgrid-app-waitlist] status failed:",
        (err as Error).message,
      );
      return res.status(500).json({ error: "status_failed" });
    }
  });

  // ── Lanserings-utsendelse (admin) ──────────────────────────────────
  app.post("/api/leadgrid/app-waitlist/notify-launch", async (req, res) => {
    const session = await requireCanonicalAdminRoomAccess(req, res);
    if (!session) return;

    // Global utsendelse er en høy-konsekvenshandling. Bekreft rollen fra
    // users-tabellen på hvert kall; en stale/forfalsket in-memory session.role
    // kan aldri autorisere den. `admin` gjelder bare fordi den eksakte
    // produkteier-e-posten allerede er bekreftet over. Feil failer lukket.
    try {
      const account = await pool.query<{ role: string }>(
        `SELECT LOWER(COALESCE(role, '')) AS role
           FROM users
          WHERE id::text = $1
            AND LOWER(COALESCE(email, '')) = LOWER($2)
          LIMIT 1`,
        [session.userId, session.email],
      );
      const dbRole = String(account.rows[0]?.role ?? "")
        .trim()
        .toLowerCase();
      if (!GLOBAL_SEND_ROLES.has(dbRole)) {
        return res.status(403).json({ error: "krever_superadmin_eller_eier" });
      }
    } catch (err) {
      console.warn(
        "[leadgrid-app-waitlist] admin role verification failed:",
        (err as Error).message,
      );
      return res.status(503).json({ error: "admin_verification_unavailable" });
    }

    const appStoreUrl = normalizeAppStoreUrl(req.body?.appStoreUrl);
    if (!appStoreUrl) {
      return res.status(400).json({ error: "invalid_app_store_url" });
    }
    if (!isEmailConfigured()) {
      return res.status(503).json({ error: "email_not_configured" });
    }
    try {
      await ensureSchema(pool);
      let sent = 0;
      let failed = 0;
      let uncertain = 0;
      let total = 0;
      const retryableAttempts: Array<{
        rowId: string;
        claimId: string;
        error: string;
      }> = [];

      try {
        // Claim kun raden som faktisk skal sendes nå. Dermed eldes ikke 99
        // ventende claims mens SMTP behandler de første mottakerne, og
        // parallelle admin-kall kan trygt dele køen mellom seg.
        while (total < NOTIFICATION_MAX_PER_REQUEST) {
          const pending = await claimNextPendingNotification(pool);
          if (!pending.row) break;

          total += 1;
          if (total > 1) await sleep(250);

          const row = await startNotificationDelivery(
            pool,
            pending.row.id,
            pending.claimId,
          );
          if (!row) {
            failed += 1;
            console.warn(
              "[leadgrid-app-waitlist] claim lost before send for",
              pending.row.email,
            );
            continue;
          }

          let result: Awaited<ReturnType<typeof sendEmail>>;
          try {
            result = await sendEmail({
              to: row.email,
              subject: "Leadgrid er nå på App Store 🚀",
              html: launchEmailHtml(appStoreUrl),
              text: `Leadgrid for iPhone/iPad er nå live på App Store — takk for at du ventet.\n\nLast ned: ${appStoreUrl}`,
              fromName: "Leadgrid",
              smtpTimeoutMs: NOTIFICATION_SMTP_TIMEOUT_MS,
              messageId: row.message_id,
            });
          } catch (error) {
            result = {
              success: false,
              provider: "gmail",
              error: (error as Error).message,
              // Once sendEmail was invoked, an unexpected throw cannot prove
              // that SMTP did not accept the message.
              failureCertainty: "uncertain",
            };
          }

          if (result.success) {
            let completed;
            try {
              completed = await pool.query(
                `UPDATE leadgrid_app_waitlist
                    SET notified_at = now(),
                        notification_claim_id = NULL,
                        notification_claim_expires_at = NULL,
                        notification_delivery_uncertain_at = NULL,
                        notification_delivery_error = NULL,
                        notification_message_id = COALESCE(notification_message_id, $3)
                  WHERE id = $1
                    AND notification_claim_id = $2::uuid
                    AND notification_delivery_started_at IS NOT NULL
                    AND notified_at IS NULL`,
                [row.id, pending.claimId, result.messageId ?? row.message_id],
              );
            } catch (error) {
              // SMTP har bekreftet levering, men kvitteringen kunne ikke
              // persisteres. delivery_started_at blir stående og gjør raden
              // permanent ikke-auto-claimbar; quarantine er best-effort.
              failed += 1;
              uncertain += 1;
              console.warn(
                "[leadgrid-app-waitlist] delivery receipt persist failed for",
                row.id,
                (error as Error).message,
              );
              await quarantineNotificationDelivery(
                pool,
                row.id,
                pending.claimId,
                `delivery_receipt_persist_failed: ${(error as Error).message}`,
              ).catch(() => {
                // delivery_started_at was committed before SMTP and is itself
                // sufficient to keep the row out of automatic retries.
              });
              continue;
            }

            if ((completed.rowCount ?? 0) === 1) {
              sent += 1;
            } else {
              failed += 1;
              uncertain += 1;
              console.warn(
                "[leadgrid-app-waitlist] claim lost after send for",
                row.id,
              );
              await quarantineNotificationDelivery(
                pool,
                row.id,
                pending.claimId,
                "delivery_receipt_not_persisted",
              ).catch(() => {
                /* delivery_started_at remains the at-most-once guard */
              });
            }
          } else {
            failed += 1;
            console.warn(
              "[leadgrid-app-waitlist] send failed for",
              row.id,
              result.error,
            );
            if (result.failureCertainty === "definite_pre_delivery") {
              // Hold raden startet gjennom resten av requesten, så samme løkke
              // ikke tar den igjen. Først i finally blir den retrybar.
              retryableAttempts.push({
                rowId: row.id,
                claimId: pending.claimId,
                error: result.error ?? "definite_pre_delivery_failure",
              });
            } else {
              uncertain += 1;
              await quarantineNotificationDelivery(
                pool,
                row.id,
                pending.claimId,
                `smtp_outcome_uncertain: ${result.error ?? "unknown"}`,
              ).catch((quarantineError) => {
                console.warn(
                  "[leadgrid-app-waitlist] quarantine persist failed for",
                  row.id,
                  (quarantineError as Error).message,
                );
              });
            }
          }
        }
      } finally {
        for (const attempt of retryableAttempts) {
          await releaseDefinitePreDeliveryFailure(
            pool,
            attempt.rowId,
            attempt.claimId,
            attempt.error,
          ).catch((releaseError) => {
            console.warn(
              "[leadgrid-app-waitlist] definite failure release failed for",
              attempt.rowId,
              (releaseError as Error).message,
            );
          });
        }
      }
      return res.json({ ok: true, sent, failed, uncertain, total });
    } catch (err) {
      console.warn(
        "[leadgrid-app-waitlist] notify launch failed:",
        (err as Error).message,
      );
      return res.status(500).json({ error: "notify_launch_failed" });
    }
  });
}
