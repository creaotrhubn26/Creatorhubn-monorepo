/**
 * nextrole-gdpr.ts
 *
 * Brukerinitierte GDPR-handlinger for NextRole-data:
 *
 *   GET  /api/users/me/nextrole-data-export
 *     Returnerer ZIP-fil med all brukerens NextRole-data som JSON-filer:
 *       cvs.json, cover_letters.json, job_applications.json,
 *       milestones.json, interview_sessions.json, video_presentations.json,
 *       referrals.json, training_artifacts.json, profile.json.
 *
 *   POST /api/users/me/nextrole-data-delete
 *     To-stegs-sletting:
 *       Steg 1: body = { request: true }  → returnerer confirmToken
 *                                            (UUID, gyldig 5 min)
 *       Steg 2: body = { confirmToken }   → utfører kaskadesletting
 *                                            av alle NextRole-tabeller
 *
 * Sletting er hard delete på NextRole-data (CV, søknadsbrev,
 * intervjuer, video-sesjoner, etc), MEN selve brukerkontoen
 * (users-tabellen) berøres ikke — det krever separat handling
 * fra hovedplattformens kontoinnstillinger.
 */

import { randomUUID, createHash } from "crypto";
import type express from "express";
import type { Pool } from "pg";
// @ts-expect-error — adm-zip mangler @types-pakke i node_modules
import AdmZip from "adm-zip";

export interface NextRoleGdprDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => { userId: string } | null;
}

// Confirm-tokens lagres i minne med utløp 5 min. Bruker
// userId+token → opprettetAt slik at brukeren ikke kan sende fra
// én sesjon og bekrefte fra en annen.
const deleteTokens: Map<string, { userId: string; createdAt: number }> = new Map();
const DELETE_TOKEN_TTL_MS = 5 * 60 * 1000;

function issueDeleteToken(userId: string): string {
  const token = createHash("sha256")
    .update(`${userId}:${randomUUID()}:${Date.now()}`)
    .digest("hex")
    .slice(0, 32);
  deleteTokens.set(token, { userId, createdAt: Date.now() });
  // Rydd gamle tokens som er utløpt
  const now = Date.now();
  for (const [k, v] of deleteTokens.entries()) {
    if (now - v.createdAt > DELETE_TOKEN_TTL_MS) deleteTokens.delete(k);
  }
  return token;
}

function consumeDeleteToken(token: string, userId: string): boolean {
  const entry = deleteTokens.get(token);
  if (!entry) return false;
  if (entry.userId !== userId) return false;
  if (Date.now() - entry.createdAt > DELETE_TOKEN_TTL_MS) {
    deleteTokens.delete(token);
    return false;
  }
  deleteTokens.delete(token);
  return true;
}

export function setupNextRoleGdprRoutes(deps: NextRoleGdprDeps): void {
  const { app, pool, getActiveSessionFromRequest } = deps;

  const requireSession = (req: express.Request, res: express.Response) => {
    const session = getActiveSessionFromRequest(req);
    if (!session?.userId) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    return session;
  };

  // ── EKSPORT ────────────────────────────────────────────────────
  app.get("/api/users/me/nextrole-data-export", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    try {
      // Hent alt parallelt
      const [
        userRow, cvs, coverLetters, jobApps, milestones,
        interviewSessions, interviewMessages, videoPresentations,
        referralCodes, referralsAsReferrer, referralsAsRedeemer,
        installations,
      ] = await Promise.all([
        pool.query(
          `SELECT id, email, name, first_name, created_at
             FROM users WHERE id = $1`,
          [session.userId],
        ),
        pool.query(
          `SELECT * FROM resumes WHERE user_id = $1 ORDER BY created_at DESC`,
          [session.userId],
        ),
        pool.query(
          `SELECT * FROM cover_letters WHERE user_id = $1 ORDER BY created_at DESC`,
          [session.userId],
        ),
        pool.query(
          `SELECT * FROM job_applications WHERE user_id = $1 ORDER BY created_at DESC`,
          [session.userId],
        ),
        pool.query(
          `SELECT * FROM job_application_milestones WHERE user_id = $1 ORDER BY due_at ASC`,
          [session.userId],
        ),
        pool.query(
          `SELECT * FROM interview_sessions WHERE user_id = $1 ORDER BY created_at DESC`,
          [session.userId],
        ),
        pool.query(
          `SELECT m.* FROM interview_messages m
             JOIN interview_sessions s ON s.id = m.session_id
            WHERE s.user_id = $1
            ORDER BY m.created_at ASC`,
          [session.userId],
        ),
        pool.query(
          `SELECT * FROM nextrole_video_presentations WHERE user_id = $1 ORDER BY created_at DESC`,
          [session.userId],
        ),
        pool.query(
          `SELECT * FROM nextrole_referral_codes WHERE user_id = $1`,
          [session.userId],
        ),
        pool.query(
          `SELECT * FROM nextrole_referrals WHERE referrer_user_id = $1`,
          [session.userId],
        ),
        pool.query(
          `SELECT * FROM nextrole_referrals WHERE redeemed_by_user_id = $1`,
          [session.userId],
        ),
        pool.query(
          `SELECT * FROM marketplace_installations
            WHERE user_id = $1 AND app_id = 'next-role'`,
          [session.userId],
        ),
      ]);

      // README som forklarer hva hver fil inneholder
      const readme = [
        "# NextRole — eksport av dine data",
        "",
        `Eksport-tidspunkt: ${new Date().toISOString()}`,
        `Bruker-ID: ${session.userId}`,
        "",
        "## Innhold",
        "",
        "- profile.json — Din konto-info (e-post, navn, opprettet)",
        "- cvs.json — Alle dine CV-er",
        "- cover_letters.json — AI-genererte søknadsbrev",
        "- job_applications.json — Jobbsøknader fra Kanban",
        "- milestones.json — Deadlines og milepæler",
        "- interview_sessions.json — Mock interview-sesjoner",
        "- interview_messages.json — Spørsmål/svar/feedback fra sesjonene",
        "- video_presentations.json — Video-presentasjon-treninger",
        "- referrals.json — Din invitasjons-kode og innløsninger",
        "- subscription.json — Abonnements-status (NextRole-marketplace)",
        "",
        "## Format",
        "",
        "JSON, kodet UTF-8. Snake_case-kolonner matcher database-skjemaet.",
        "",
        "## Rettigheter",
        "",
        "Dette er din personlige eksport iht. GDPR Artikkel 20 (rett til dataportabilitet).",
        "Spørsmål? Kontakt hello@creatorhubn.com",
      ].join("\n");

      const zip = new AdmZip();
      zip.addFile("README.md", Buffer.from(readme, "utf-8"));
      zip.addFile(
        "profile.json",
        Buffer.from(JSON.stringify(userRow.rows[0] ?? {}, null, 2), "utf-8"),
      );
      zip.addFile(
        "cvs.json",
        Buffer.from(JSON.stringify(cvs.rows, null, 2), "utf-8"),
      );
      zip.addFile(
        "cover_letters.json",
        Buffer.from(JSON.stringify(coverLetters.rows, null, 2), "utf-8"),
      );
      zip.addFile(
        "job_applications.json",
        Buffer.from(JSON.stringify(jobApps.rows, null, 2), "utf-8"),
      );
      zip.addFile(
        "milestones.json",
        Buffer.from(JSON.stringify(milestones.rows, null, 2), "utf-8"),
      );
      zip.addFile(
        "interview_sessions.json",
        Buffer.from(JSON.stringify(interviewSessions.rows, null, 2), "utf-8"),
      );
      zip.addFile(
        "interview_messages.json",
        Buffer.from(JSON.stringify(interviewMessages.rows, null, 2), "utf-8"),
      );
      zip.addFile(
        "video_presentations.json",
        Buffer.from(JSON.stringify(videoPresentations.rows, null, 2), "utf-8"),
      );
      zip.addFile(
        "referrals.json",
        Buffer.from(
          JSON.stringify(
            {
              myCode: referralCodes.rows[0] ?? null,
              redemptionsBySomeoneElseUsingMyCode: referralsAsReferrer.rows,
              myRedemptionOfSomeoneElsesCode: referralsAsRedeemer.rows,
            },
            null,
            2,
          ),
          "utf-8",
        ),
      );
      zip.addFile(
        "subscription.json",
        Buffer.from(JSON.stringify(installations.rows, null, 2), "utf-8"),
      );

      const buf = zip.toBuffer();
      const filename = `nextrole-export-${session.userId}-${new Date().toISOString().slice(0, 10)}.zip`;
      res
        .setHeader("Content-Type", "application/zip")
        .setHeader("Content-Disposition", `attachment; filename="${filename}"`)
        .setHeader("Cache-Control", "no-store")
        .send(buf);
    } catch (err) {
      console.error("[nextrole-gdpr] export failed", err);
      res.status(500).json({ error: "export_failed" });
    }
  });

  // ── SLETTING (to-stegs) ─────────────────────────────────────────
  app.post("/api/users/me/nextrole-data-delete", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const body = (req.body ?? {}) as Record<string, unknown>;

    // Steg 1 — be om bekreftelse
    if (body.request === true && !body.confirmToken) {
      // Tell opp hva som vil slettes
      const counts = await pool.query<{
        cvs: string; cover_letters: string; apps: string;
        milestones: string; sessions: string; videos: string;
      }>(
        `SELECT
           (SELECT COUNT(*) FROM resumes WHERE user_id = $1)::text AS cvs,
           (SELECT COUNT(*) FROM cover_letters WHERE user_id = $1)::text AS cover_letters,
           (SELECT COUNT(*) FROM job_applications WHERE user_id = $1)::text AS apps,
           (SELECT COUNT(*) FROM job_application_milestones WHERE user_id = $1)::text AS milestones,
           (SELECT COUNT(*) FROM interview_sessions WHERE user_id = $1)::text AS sessions,
           (SELECT COUNT(*) FROM nextrole_video_presentations WHERE user_id = $1)::text AS videos`,
        [session.userId],
      );
      const c = counts.rows[0];
      const token = issueDeleteToken(session.userId);
      res.json({
        confirmToken: token,
        ttlSec: Math.round(DELETE_TOKEN_TTL_MS / 1000),
        willDelete: {
          cvs: Number(c.cvs),
          coverLetters: Number(c.cover_letters),
          jobApplications: Number(c.apps),
          milestones: Number(c.milestones),
          interviewSessions: Number(c.sessions),
          videoPresentations: Number(c.videos),
        },
      });
      return;
    }

    // Steg 2 — utfør sletting med token
    const token = String(body.confirmToken ?? "");
    if (!token || !consumeDeleteToken(token, session.userId)) {
      res.status(400).json({ error: "invalid_or_expired_token" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Slett i avhengighets-rekkefølge (CASCADE-konstraktene tar
      // mye, men vi er eksplisitte for synlighet)
      await client.query(
        `DELETE FROM interview_messages WHERE session_id IN
           (SELECT id FROM interview_sessions WHERE user_id = $1)`,
        [session.userId],
      );
      await client.query(
        `DELETE FROM interview_sessions WHERE user_id = $1`,
        [session.userId],
      );
      await client.query(
        `DELETE FROM nextrole_video_presentations WHERE user_id = $1`,
        [session.userId],
      );
      await client.query(
        `DELETE FROM job_application_milestones WHERE user_id = $1`,
        [session.userId],
      );
      await client.query(
        `DELETE FROM job_applications WHERE user_id = $1`,
        [session.userId],
      );
      await client.query(
        `DELETE FROM cover_letters WHERE user_id = $1`,
        [session.userId],
      );
      // Resume children (skills, experiences, education, etc) bør ha
      // FK ON DELETE CASCADE — vi sletter parent og lar DB rydde resten.
      await client.query(
        `DELETE FROM resumes WHERE user_id = $1`,
        [session.userId],
      );
      // Referrals — slett som referrer OG redeemer
      await client.query(
        `DELETE FROM nextrole_referrals
          WHERE referrer_user_id = $1 OR redeemed_by_user_id = $1`,
        [session.userId],
      );
      await client.query(
        `DELETE FROM nextrole_referral_codes WHERE user_id = $1`,
        [session.userId],
      );
      // Drip-log
      await client.query(
        `DELETE FROM nextrole_email_drip_log WHERE user_id = $1`,
        [session.userId],
      );
      // Marketplace-installasjon for NextRole (men IKKE for andre apper)
      await client.query(
        `DELETE FROM marketplace_installations
          WHERE user_id = $1 AND app_id = 'next-role'`,
        [session.userId],
      );

      await client.query("COMMIT");

      // Logg slettingen (best-effort)
      console.info("[nextrole-gdpr] user deleted their NextRole data", {
        userId: session.userId,
        at: new Date().toISOString(),
      });

      res.json({
        deleted: true,
        message:
          "All NextRole-data slettet. Selve CreatorHub-kontoen din er fortsatt intakt — slett den fra hovedinnstillingene hvis ønskelig.",
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[nextrole-gdpr] delete failed", err);
      res.status(500).json({ error: "delete_failed" });
    } finally {
      client.release();
    }
  });
}
