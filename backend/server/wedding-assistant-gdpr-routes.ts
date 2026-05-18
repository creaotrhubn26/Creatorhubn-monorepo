/**
 * wedding-assistant-gdpr-routes.ts
 *
 * Slice 9X.50 — GDPR-flyt for assistent.
 *
 *   GET  /api/wedding/assistant-invite/:token/gdpr-info
 *        — Hva som lagres + samtykke-tekst (public)
 *   POST /api/wedding/assistant-invite/:token/consent
 *        — Registrer samtykke (kan kombineres med /sign og /accept)
 *   POST /api/wedding/assistant-invite/:token/request-deletion
 *        ELLER POST /api/photographer/assistants/:assistantId/request-deletion
 *        — Trigger sletting (anonymisering). Tilgjengelig både for
 *          assistenten via token og hovedfotograf via auth.
 *   POST /api/admin/assistants/:assistantId/anonymize
 *        — Faktisk utfør anonymisering (admin gjennomgår først).
 *
 * Anonymiserings-strategi: NULL alle personlige felter, sett en
 * `[anonymisert YYYY-MM-DD]`-placeholder i navn-feltet for revisjon.
 */

import type express from "express";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WeddingAssistantGdprDeps {
  app: express.Application;
  pool: any;
  getPricingUserId: (req: any) => string;
  requireAdminSession?: (req: any, res: any) => any;
}

const GDPR_DATA_DESCRIPTION_NB = {
  whatWeStore: [
    "E-postadresse, navn og telefon (kontakt og signering)",
    "Din rolle og avtalte kompensasjon",
    "Tidspunkt for samtykke og signering, samt IP-adresse ved signering",
    "Eventuelle siste 4 sifre av fødselsnummer (kun hvis du frivillig oppgir det ved signering)",
    "Notater fra brief-møtet (hvis hovedfotograf skriver om deg)",
    "Lenke til delt Drive-mappe der du har lastet opp bilder",
  ],
  whyWeStore: [
    "For å oppfylle avtalen om foto-oppdrag",
    "For å beregne og dokumentere honorar-utbetaling",
    "For å oppfylle norske regnskaps- og dokumentasjonskrav",
  ],
  retention: [
    "Faktureringsgrunnlag oppbevares i 5 år (norsk regnskapslovgivning).",
    "Personlige kontaktdata kan slettes på forespørsel — vi anonymiserer raden, men beholder struktur og beløp for revisjon.",
  ],
  yourRights: [
    "Innsyn: be om hvilke data vi har om deg",
    "Retting: korriger feil informasjon",
    "Sletting: be om anonymisering når avtalen er ferdig",
    "Dataportabilitet: få utlevert dine data i lesbart format",
  ],
};

async function ensureSchema(pool: any): Promise<void> {
  for (const col of [
    "gdpr_consent_at TIMESTAMPTZ",
    "gdpr_consent_ip TEXT",
    "gdpr_delete_requested_at TIMESTAMPTZ",
    "gdpr_anonymized_at TIMESTAMPTZ",
  ]) {
    await pool.query(`ALTER TABLE wedding_assistants ADD COLUMN IF NOT EXISTS ${col}`).catch(() => undefined);
  }
}

async function anonymizeAssistant(pool: any, assistantId: string): Promise<boolean> {
  const r = await pool.query(
    `UPDATE wedding_assistants
       SET assistant_email = NULL,
           assistant_name = '[anonymisert ' || TO_CHAR(NOW(), 'YYYY-MM-DD') || ']',
           assistant_phone = NULL,
           subcontract_signer_name = NULL,
           subcontract_signer_id_last4 = NULL,
           subcontract_signer_ip = NULL,
           gdpr_consent_ip = NULL,
           brief_notes = NULL,
           brief_transcript_url = NULL,
           brief_summary = NULL,
           gdpr_anonymized_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 RETURNING id`,
    [assistantId],
  );
  return (r.rowCount ?? 0) > 0;
}

export function setupWeddingAssistantGdprRoutes(deps: WeddingAssistantGdprDeps): void {
  const { app, pool, getPricingUserId, requireAdminSession } = deps;

  // ─── GET gdpr-info (public — vises i accept-flyten) ─────────
  app.get("/api/wedding/assistant-invite/:token/gdpr-info", async (_req, res) => {
    res.json(GDPR_DATA_DESCRIPTION_NB);
  });

  // ─── POST consent ───────────────────────────────────────────
  app.post("/api/wedding/assistant-invite/:token/consent", async (req, res) => {
    try {
      await ensureSchema(pool);
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;
      const r = await pool.query(
        `UPDATE wedding_assistants
           SET gdpr_consent_at = NOW(), gdpr_consent_ip = $1, updated_at = NOW()
           WHERE invite_token = $2 AND gdpr_consent_at IS NULL
         RETURNING id`,
        [ip, req.params.token],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Invitasjon finnes ikke eller samtykke er allerede registrert" });
      res.json({ consented: true, consentedAt: new Date().toISOString() });
    } catch (err) {
      console.error("POST /consent:", err);
      res.status(500).json({ error: "Kunne ikke registrere samtykke" });
    }
  });

  // ─── POST request-deletion (assistent via token) ────────────
  app.post("/api/wedding/assistant-invite/:token/request-deletion", async (req, res) => {
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `UPDATE wedding_assistants
           SET gdpr_delete_requested_at = NOW(), updated_at = NOW()
           WHERE invite_token = $1 OR id::text = $1
         RETURNING id, primary_photographer_id`,
        [req.params.token],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      // I prod: send e-post til hovedfotograf og admin om at sletting er forespurt
      res.json({
        requested: true,
        note: "Forespørsel registrert. Anonymisering utføres av admin innen 30 dager (regnskapsloven krever oppbevaring).",
      });
    } catch (err) {
      console.error("POST /request-deletion:", err);
      res.status(500).json({ error: "Kunne ikke registrere forespørsel" });
    }
  });

  // ─── POST request-deletion (hovedfotograf via auth) ─────────
  app.post("/api/photographer/assistants/:assistantId/request-deletion", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `UPDATE wedding_assistants
           SET gdpr_delete_requested_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND primary_photographer_id = $2
         RETURNING id`,
        [req.params.assistantId, uid],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      res.json({ requested: true });
    } catch (err) {
      console.error("POST /request-deletion (photographer):", err);
      res.status(500).json({ error: "Kunne ikke registrere forespørsel" });
    }
  });

  // ─── POST admin anonymize ───────────────────────────────────
  // Faktisk utfør anonymiseringen (admin gjennomgår + verifiserer at
  // ingen aktive faktureringer er åpne).
  app.post("/api/admin/assistants/:assistantId/anonymize", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const ok = await anonymizeAssistant(pool, req.params.assistantId);
      if (!ok) return res.status(404).json({ error: "Ikke funnet" });
      res.json({ anonymized: true });
    } catch (err) {
      console.error("POST /admin/anonymize:", err);
      res.status(500).json({ error: "Anonymisering feilet" });
    }
  });

  // ─── GET admin deletion-queue ───────────────────────────────
  app.get("/api/admin/assistants/deletion-queue", async (req, res) => {
    if (requireAdminSession && !requireAdminSession(req, res)) return;
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT id, wedding_id, primary_photographer_id, assistant_email, assistant_name,
                gdpr_delete_requested_at, gdpr_anonymized_at
           FROM wedding_assistants
           WHERE gdpr_delete_requested_at IS NOT NULL AND gdpr_anonymized_at IS NULL
           ORDER BY gdpr_delete_requested_at ASC`,
      );
      res.json({ pendingDeletions: r.rows });
    } catch (err) {
      console.error("GET /admin/deletion-queue:", err);
      res.status(500).json({ error: "Kunne ikke hente kø" });
    }
  });
}
