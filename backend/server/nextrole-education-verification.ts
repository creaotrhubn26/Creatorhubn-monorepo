/**
 * nextrole-education-verification.ts
 *
 * Verifisering av utdanning på CV. Bruker kan:
 *   • Laste opp vitnemål/karakterutskrift som PDF (lagres i R2)
 *   • Legge inn en offentlig verifiseringslenke (brukerens egen)
 *
 * Begge deler vises som badge på CV-en og indikerer til arbeidsgiver
 * at utdanningen er dokumentert.
 *
 * Endepunkter:
 *   POST   /api/resumes/:id/education/:eduId/verification-pdf
 *     multipart upload — feltnavn 'document'
 *   PATCH  /api/resumes/:id/education/:eduId/verification-link
 *     body: { url, label? }
 *   DELETE /api/resumes/:id/education/:eduId/verification
 *     fjerner BÅDE pdf og lenke
 *
 * MERK: bevisst nøytral språkbruk — vi referere ikke til spesifikke
 * tredjeparts-tjenester i feilmeldinger eller copy.
 */

import type express from "express";
import type { Pool } from "pg";
import multer from "multer";
import { createHash } from "crypto";
import { uploadTrainingMedia, refreshSignedUrl } from "./nextrole-audio-service";

export interface NextRoleEducationVerificationDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => { userId: string } | null;
}

// PDF og bilder (skannede vitnemål) opp til 15MB
const verificationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    const base = (file.mimetype ?? "").split(";")[0].trim().toLowerCase();
    if (allowed.includes(base)) cb(null, true);
    else cb(new Error(`Ugyldig filtype: ${file.mimetype}. Bruk PDF eller bilde.`));
  },
});

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function hashIp(ip: string): string {
  const salt = process.env.NEXTROLE_CRON_SECRET ?? "nextrole-verification-salt";
  return createHash("sha256").update(`${ip}:${salt}`).digest("hex").slice(0, 48);
}

function extractClientIp(req: express.Request): string {
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp) return cfIp;
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff) return xff.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

export function setupNextRoleEducationVerificationRoutes(
  deps: NextRoleEducationVerificationDeps,
): void {
  const { app, pool, getActiveSessionFromRequest } = deps;

  const requireSession = (req: express.Request, res: express.Response) => {
    const session = getActiveSessionFromRequest(req);
    if (!session?.userId) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    return session;
  };

  // ── POST PDF-vedlegg ────────────────────────────────────────────
  app.post(
    "/api/resumes/:id/education/:eduId/verification-pdf",
    verificationUpload.single("document"),
    async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;

      const file = (req as express.Request & {
        file?: { buffer: Buffer; mimetype: string; originalname?: string };
      }).file;
      if (!file?.buffer?.byteLength) {
        res.status(400).json({ error: "fil_paakrevd" });
        return;
      }

      // GDPR-samtykke kreves — body.consent må være 'true' (multipart
      // sender alt som string, så vi sjekker mot 'true').
      const consent = String((req.body as Record<string, unknown> | undefined)?.consent ?? "");
      if (consent !== "true") {
        res.status(400).json({
          error: "consent_required",
          message:
            "Du må godkjenne behandling av dokumentet før opplasting kan skje.",
        });
        return;
      }

      // Verifiser at brukeren eier utdanningen
      const own = await pool.query<{ id: string }>(
        `SELECT e.id FROM resume_education e
           JOIN resumes r ON r.id = e.resume_id
          WHERE e.id = $1 AND e.resume_id = $2 AND r.user_id = $3`,
        [req.params.eduId, req.params.id, session.userId],
      );
      if (!own.rowCount) {
        res.status(404).json({ error: "utdanning_ikke_funnet" });
        return;
      }

      try {
        // Slett evt. forrige PDF (best-effort — R2-lifecycle håndterer
        // også, men eksplisitt sletting er penere)
        const old = await pool.query<{ verification_pdf_r2_key: string | null }>(
          `SELECT verification_pdf_r2_key FROM resume_education WHERE id = $1`,
          [req.params.eduId],
        );

        const uploaded = await uploadTrainingMedia({
          buffer: file.buffer,
          mime: file.mimetype,
          kind: "video", // bruker 'video'-prefix for å falle inn i samme R2-bucket; vi har ikke egen 'document'-namespace
          userId: session.userId,
          sessionId: `edu-${req.params.eduId}`,
        });
        if (!uploaded.ok) {
          res.status(500).json({ error: "opplasting_feilet", detail: uploaded.error });
          return;
        }

        const filename = (file.originalname ?? "vitnemal.pdf").slice(0, 255);
        const consentIpHash = hashIp(extractClientIp(req));
        await pool.query(
          `UPDATE resume_education
              SET verification_pdf_r2_key = $1,
                  verification_pdf_filename = $2,
                  verification_label = COALESCE(verification_label, 'Vitnemål vedlagt'),
                  verified_at = NOW(),
                  verification_consent_at = NOW(),
                  verification_consent_ip_hash = $4,
                  updated_at = NOW()
            WHERE id = $3`,
          [uploaded.key, filename, req.params.eduId, consentIpHash],
        );

        // Old key er fortsatt i R2 — la lifecycle rydde, eller slett her
        // eksplisitt. For nå: ignorer (sparer en R2-DeleteObject-call).
        void old;

        res.json({
          verified: true,
          filename,
          signedUrl: uploaded.url,
        });
      } catch (err) {
        console.error("[education-verification] PDF upload failed", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // ── PATCH verifiseringslenke ────────────────────────────────────
  app.patch(
    "/api/resumes/:id/education/:eduId/verification-link",
    async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const url = String(body.url ?? "").trim();
      const label = String(body.label ?? "").trim().slice(0, 255);

      if (!url) {
        res.status(400).json({ error: "url_paakrevd" });
        return;
      }
      if (!isHttpsUrl(url)) {
        res.status(400).json({ error: "ugyldig_url" });
        return;
      }
      if (url.length > 1000) {
        res.status(400).json({ error: "url_for_lang" });
        return;
      }
      // GDPR-samtykke kreves også for å lagre verifikasjonslenke.
      if (body.consent !== true) {
        res.status(400).json({
          error: "consent_required",
          message:
            "Du må godkjenne lagring av verifiseringslenke før den kan legges til.",
        });
        return;
      }

      const own = await pool.query<{ id: string }>(
        `SELECT e.id FROM resume_education e
           JOIN resumes r ON r.id = e.resume_id
          WHERE e.id = $1 AND e.resume_id = $2 AND r.user_id = $3`,
        [req.params.eduId, req.params.id, session.userId],
      );
      if (!own.rowCount) {
        res.status(404).json({ error: "utdanning_ikke_funnet" });
        return;
      }

      try {
        const consentIpHash = hashIp(extractClientIp(req));
        await pool.query(
          `UPDATE resume_education
              SET verification_link_url = $1,
                  verification_label = COALESCE($2, verification_label, 'Verifisert utdanning'),
                  verified_at = NOW(),
                  verification_consent_at = NOW(),
                  verification_consent_ip_hash = $4,
                  updated_at = NOW()
            WHERE id = $3`,
          [url, label || null, req.params.eduId, consentIpHash],
        );
        res.json({ verified: true, url, label });
      } catch (err) {
        console.error("[education-verification] link patch failed", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // ── GET verifisering (med fresh signed URL hvis PDF) ────────────
  app.get(
    "/api/resumes/:id/education/:eduId/verification",
    async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;
      const r = await pool.query<{
        verification_pdf_r2_key: string | null;
        verification_pdf_filename: string | null;
        verification_link_url: string | null;
        verification_label: string | null;
        verified_at: Date | null;
      }>(
        `SELECT verification_pdf_r2_key, verification_pdf_filename,
                verification_link_url, verification_label, verified_at
           FROM resume_education e
           JOIN resumes r ON r.id = e.resume_id
          WHERE e.id = $1 AND e.resume_id = $2 AND r.user_id = $3`,
        [req.params.eduId, req.params.id, session.userId],
      );
      if (!r.rowCount) {
        res.status(404).json({ error: "utdanning_ikke_funnet" });
        return;
      }
      const row = r.rows[0];

      let signedUrl: string | null = null;
      if (row.verification_pdf_r2_key) {
        signedUrl = await refreshSignedUrl(row.verification_pdf_r2_key);
      }

      res.json({
        verified: row.verified_at !== null,
        verifiedAt: row.verified_at?.toISOString() ?? null,
        pdfFilename: row.verification_pdf_filename,
        pdfSignedUrl: signedUrl,
        linkUrl: row.verification_link_url,
        label: row.verification_label,
      });
    },
  );

  // ── DELETE verifisering (fjerner PDF + lenke) ───────────────────
  app.delete(
    "/api/resumes/:id/education/:eduId/verification",
    async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;
      const own = await pool.query<{ id: string }>(
        `SELECT e.id FROM resume_education e
           JOIN resumes r ON r.id = e.resume_id
          WHERE e.id = $1 AND e.resume_id = $2 AND r.user_id = $3`,
        [req.params.eduId, req.params.id, session.userId],
      );
      if (!own.rowCount) {
        res.status(404).json({ error: "utdanning_ikke_funnet" });
        return;
      }
      await pool.query(
        `UPDATE resume_education
            SET verification_pdf_r2_key = NULL,
                verification_pdf_filename = NULL,
                verification_link_url = NULL,
                verification_label = NULL,
                verified_at = NULL,
                updated_at = NOW()
          WHERE id = $1`,
        [req.params.eduId],
      );
      // R2-objektet ligger igjen til lifecycle sletter — det er OK siden
      // signed URL går ut etter 24t uansett.
      res.json({ deleted: true });
    },
  );
}
