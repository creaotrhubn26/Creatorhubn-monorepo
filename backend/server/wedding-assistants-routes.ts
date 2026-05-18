/**
 * wedding-assistants-routes.ts
 *
 * Slice 9X.44 — Assistent-fotografer på bryllup.
 *
 * Endpoints:
 *   GET    /api/wedding/:weddingId/assistants
 *   POST   /api/wedding/:weddingId/assistants
 *          { assistantEmail | assistantUserId, role, compensationType, compensationValue, sharePct? }
 *   DELETE /api/wedding/:weddingId/assistants/:assistantId
 *   PUT    /api/wedding/:weddingId/assistants/:assistantId
 *          (oppdater kompensasjon, rolle, status)
 *   GET    /api/wedding/assistant-invite/:token — invite-detaljer (public)
 *   POST   /api/wedding/assistant-invite/:token/accept
 *   POST   /api/wedding/assistant-invite/:token/decline
 *   GET    /api/wedding/:weddingId/profit-split — beregn fordeling fra faktura
 */

import type express from "express";
import crypto from "crypto";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WeddingAssistantsRoutesDeps {
  app: express.Application;
  pool: any;
  getPricingUserId: (req: any) => string;
}

const VALID_ROLES = ["primary", "assistant", "second_shooter", "video", "misc"];
const VALID_COMP_TYPES = ["hourly", "fixed", "percentage"];

async function ensureSchema(pool: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wedding_assistants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wedding_id VARCHAR(64) NOT NULL,
      primary_photographer_id TEXT NOT NULL,
      assistant_user_id TEXT,
      assistant_email TEXT,
      assistant_name TEXT,
      assistant_phone TEXT,
      role TEXT NOT NULL DEFAULT 'assistant',
      compensation_type TEXT NOT NULL DEFAULT 'fixed',
      compensation_value NUMERIC(10,2),
      share_pct NUMERIC(5,2),
      status TEXT NOT NULL DEFAULT 'invited',
      invite_token TEXT,
      invited_at TIMESTAMPTZ DEFAULT NOW(),
      accepted_at TIMESTAMPTZ,
      declined_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => undefined);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_wedding_assistants_wedding ON wedding_assistants (wedding_id)`,
  ).catch(() => undefined);
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_wedding_assistants_token ON wedding_assistants (invite_token) WHERE invite_token IS NOT NULL`,
  ).catch(() => undefined);
  // Slice 9X.51 — Creatorhubn-referral
  for (const col of [
    "referral_invite_sent_at TIMESTAMPTZ",
    "referral_clicked_at TIMESTAMPTZ",
    "referral_signed_up_user_id TEXT",
    "referral_signed_up_at TIMESTAMPTZ",
  ]) {
    await pool.query(`ALTER TABLE wedding_assistants ADD COLUMN IF NOT EXISTS ${col}`).catch(() => undefined);
  }
}

function rowToAssistant(r: any): any {
  return {
    id: r.id,
    weddingId: r.wedding_id,
    primaryPhotographerId: r.primary_photographer_id,
    assistantUserId: r.assistant_user_id,
    assistantEmail: r.assistant_email,
    assistantName: r.assistant_name,
    assistantPhone: r.assistant_phone,
    role: r.role,
    compensationType: r.compensation_type,
    compensationValue: r.compensation_value != null ? Number(r.compensation_value) : null,
    sharePct: r.share_pct != null ? Number(r.share_pct) : null,
    status: r.status,
    invitedAt: r.invited_at,
    acceptedAt: r.accepted_at,
    declinedAt: r.declined_at,
    completedAt: r.completed_at,
    notes: r.notes,
    // Drive-status (9X.45)
    driveFolderId: r.drive_folder_id ?? null,
    driveFolderUrl: r.drive_folder_url ?? null,
    driveFolderSetupAt: r.drive_folder_setup_at ?? null,
    lastKnownFileCount: r.last_known_file_count != null ? Number(r.last_known_file_count) : null,
    newFilesSinceViewed: r.new_files_since_viewed != null ? Number(r.new_files_since_viewed) : 0,
    lastNewFilesAt: r.last_new_files_at ?? null,
    // Sub-kontrakt (9X.46)
    subcontractSignedAt: r.subcontract_signed_at ?? null,
    subcontractSignerName: r.subcontract_signer_name ?? null,
    // Brief-møte (9X.48) + notater (9X.49)
    briefMeetingUrl: r.brief_meeting_url ?? null,
    briefMeetingAt: r.brief_meeting_at ?? null,
    briefMeetingDurationMin: r.brief_meeting_duration_min ?? null,
    briefSummarizedAt: r.brief_summarized_at ?? null,
    // GDPR (9X.50)
    gdprConsentAt: r.gdpr_consent_at ?? null,
    gdprDeleteRequestedAt: r.gdpr_delete_requested_at ?? null,
    gdprAnonymizedAt: r.gdpr_anonymized_at ?? null,
    // Creatorhubn-referral (9X.51 Fase A)
    referralInviteSentAt: r.referral_invite_sent_at ?? null,
    referralClickedAt: r.referral_clicked_at ?? null,
    referralSignedUpAt: r.referral_signed_up_at ?? null,
    // Token returneres KUN i POST-response til primær fotograf — ikke i GET-list
    // for å hindre at det lekker via felles UI.
  };
}

export function setupWeddingAssistantsRoutes(deps: WeddingAssistantsRoutesDeps): void {
  const { app, pool, getPricingUserId } = deps;

  // ─── GET /api/wedding/:weddingId/assistants ────────────────────
  app.get("/api/wedding/:weddingId/assistants", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      // Primær eier eller assistent som selv er invitert kan se listen
      const r = await pool.query(
        `SELECT * FROM wedding_assistants
           WHERE wedding_id = $1
             AND (primary_photographer_id = $2 OR assistant_user_id = $2)
           ORDER BY created_at`,
        [req.params.weddingId, uid],
      );
      res.json({ assistants: r.rows.map(rowToAssistant) });
    } catch (err) {
      console.error("GET /assistants:", err);
      res.status(500).json({ error: "Kunne ikke hente assistenter" });
    }
  });

  // ─── POST /api/wedding/:weddingId/assistants ──────────────────
  app.post("/api/wedding/:weddingId/assistants", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });

      const {
        assistantUserId,
        assistantEmail,
        assistantName,
        assistantPhone,
        role,
        compensationType,
        compensationValue,
        sharePct,
        notes,
        inviteToCreatorhubn,
      } = req.body || {};

      if (!assistantUserId && !assistantEmail) {
        return res.status(400).json({ error: "Mangler assistantUserId eller assistantEmail" });
      }
      const finalRole = role && VALID_ROLES.includes(role) ? role : "assistant";
      const finalCompType =
        compensationType && VALID_COMP_TYPES.includes(compensationType) ? compensationType : "fixed";

      // Verifiser at uid eier dette bryllupet
      const own = await pool.query(
        `SELECT photographer_id FROM wedding_timelines WHERE id = $1 LIMIT 1`,
        [req.params.weddingId],
      );
      if (own.rowCount === 0 || own.rows[0].photographer_id !== uid) {
        return res.status(403).json({ error: "Du eier ikke dette bryllupet" });
      }

      // Hvis intern user_id, hent navn/email fra users-tabell
      let resolvedName = assistantName || null;
      let resolvedEmail = assistantEmail || null;
      let resolvedPhone = assistantPhone || null;
      if (assistantUserId) {
        const u = await pool.query(
          `SELECT email, first_name, last_name, phone_number FROM users WHERE id = $1 LIMIT 1`,
          [assistantUserId],
        );
        if (u.rowCount > 0) {
          resolvedEmail = u.rows[0].email || resolvedEmail;
          resolvedName = [u.rows[0].first_name, u.rows[0].last_name].filter(Boolean).join(" ") || resolvedName;
          resolvedPhone = u.rows[0].phone_number || resolvedPhone;
        }
      }

      // Ekstern → generer invite-token
      const inviteToken = !assistantUserId
        ? crypto.randomBytes(24).toString("base64url")
        : null;

      const ins = await pool.query(
        `INSERT INTO wedding_assistants
           (wedding_id, primary_photographer_id, assistant_user_id, assistant_email,
            assistant_name, assistant_phone, role, compensation_type, compensation_value,
            share_pct, status, invite_token, notes, referral_invite_sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                 CASE WHEN $3 IS NOT NULL THEN 'invited' ELSE 'invited' END,
                 $11, $12, $13)
         RETURNING *`,
        [
          req.params.weddingId,
          uid,
          assistantUserId || null,
          resolvedEmail,
          resolvedName,
          resolvedPhone,
          finalRole,
          finalCompType,
          compensationValue != null ? Number(compensationValue) : null,
          sharePct != null ? Number(sharePct) : null,
          inviteToken,
          notes || null,
          inviteToCreatorhubn ? new Date() : null,
        ],
      );

      const row = ins.rows[0];
      res.status(201).json({
        assistant: rowToAssistant(row),
        inviteToken, // returneres KUN i POST så primær kan dele lenken
        inviteUrl: inviteToken
          ? `/wedding/assistant-invite/${inviteToken}`
          : null,
      });
    } catch (err) {
      console.error("POST /assistants:", err);
      res.status(500).json({ error: "Kunne ikke invitere" });
    }
  });

  // ─── PUT /api/wedding/:weddingId/assistants/:assistantId ──────
  app.put("/api/wedding/:weddingId/assistants/:assistantId", async (req, res) => {
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const fields: any = {};
      if (req.body?.role && VALID_ROLES.includes(req.body.role)) fields.role = req.body.role;
      if (req.body?.compensationType && VALID_COMP_TYPES.includes(req.body.compensationType)) {
        fields.compensation_type = req.body.compensationType;
      }
      if (req.body?.compensationValue != null) fields.compensation_value = Number(req.body.compensationValue);
      if (req.body?.sharePct != null) fields.share_pct = Number(req.body.sharePct);
      if (typeof req.body?.notes === "string") fields.notes = req.body.notes;
      if (Object.keys(fields).length === 0) return res.status(400).json({ error: "Ingen felter å oppdatere" });

      const setClauses: string[] = [];
      const values: any[] = [];
      for (const [col, val] of Object.entries(fields)) {
        values.push(val);
        setClauses.push(`${col} = $${values.length}`);
      }
      values.push(req.params.assistantId, req.params.weddingId, uid);
      const r = await pool.query(
        `UPDATE wedding_assistants
           SET ${setClauses.join(", ")}, updated_at = NOW()
           WHERE id = $${values.length - 2}
             AND wedding_id = $${values.length - 1}
             AND primary_photographer_id = $${values.length}
         RETURNING *`,
        values,
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Assistent finnes ikke" });
      res.json({ assistant: rowToAssistant(r.rows[0]) });
    } catch (err) {
      console.error("PUT /assistants/:id:", err);
      res.status(500).json({ error: "Kunne ikke oppdatere" });
    }
  });

  // ─── DELETE /api/wedding/:weddingId/assistants/:assistantId ──
  app.delete("/api/wedding/:weddingId/assistants/:assistantId", async (req, res) => {
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `DELETE FROM wedding_assistants
           WHERE id = $1 AND wedding_id = $2 AND primary_photographer_id = $3
           RETURNING id`,
        [req.params.assistantId, req.params.weddingId, uid],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Assistent finnes ikke" });
      res.json({ success: true });
    } catch (err) {
      console.error("DELETE /assistants/:id:", err);
      res.status(500).json({ error: "Kunne ikke slette" });
    }
  });

  // ─── GET /api/wedding/assistant-invite/:token ────────────────
  // Public: viser invite-detaljer for accept-side. Ingen auth.
  app.get("/api/wedding/assistant-invite/:token", async (req, res) => {
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `SELECT a.id, a.wedding_id, a.assistant_name, a.assistant_email,
                a.role, a.compensation_type, a.compensation_value, a.share_pct,
                a.status, a.invited_at, a.referral_invite_sent_at,
                w.couple_name, w.wedding_date,
                u.first_name AS primary_first_name, u.last_name AS primary_last_name,
                u.company_name AS primary_company
           FROM wedding_assistants a
           JOIN wedding_timelines w ON w.id = a.wedding_id
           LEFT JOIN users u ON u.id = a.primary_photographer_id
           WHERE a.invite_token = $1 LIMIT 1`,
        [req.params.token],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Invitasjon finnes ikke eller er ferdigbehandlet" });
      const row = r.rows[0];
      res.json({
        invite: {
          id: row.id,
          weddingId: row.wedding_id,
          assistantName: row.assistant_name,
          assistantEmail: row.assistant_email,
          role: row.role,
          compensationType: row.compensation_type,
          compensationValue: row.compensation_value != null ? Number(row.compensation_value) : null,
          sharePct: row.share_pct != null ? Number(row.share_pct) : null,
          status: row.status,
          invitedAt: row.invited_at,
          coupleName: row.couple_name,
          weddingDate: row.wedding_date,
          primaryPhotographer: [row.primary_first_name, row.primary_last_name].filter(Boolean).join(" ") || row.primary_company || "Fotograf",
          referralInviteSent: !!row.referral_invite_sent_at,
        },
      });
    } catch (err) {
      console.error("GET /assistant-invite/:token:", err);
      res.status(500).json({ error: "Kunne ikke hente invitasjon" });
    }
  });

  // ─── POST /api/wedding/assistant-invite/:token/accept ────────
  app.post("/api/wedding/assistant-invite/:token/accept", async (req, res) => {
    try {
      const uid = getPricingUserId(req);
      const r = await pool.query(
        `UPDATE wedding_assistants
           SET status = 'accepted',
               accepted_at = NOW(),
               assistant_user_id = COALESCE($1, assistant_user_id),
               invite_token = NULL,
               updated_at = NOW()
           WHERE invite_token = $2 AND status = 'invited'
         RETURNING *`,
        [uid || null, req.params.token],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Invitasjon finnes ikke eller er allerede behandlet" });
      res.json({ assistant: rowToAssistant(r.rows[0]) });
    } catch (err) {
      console.error("POST /assistant-invite/accept:", err);
      res.status(500).json({ error: "Kunne ikke godta" });
    }
  });

  // ─── POST /api/wedding/assistant-invite/:token/referral-clicked ───
  // Slice 9X.51 Fase A — Assistent klikket "Prøv Creatorhubn"-CTA på
  // accept-success-skjermen. Token kan være null hvis kalt etter sign,
  // så vi støtter også assistant.id som fallback i path-param.
  app.post("/api/wedding/assistant-invite/:token/referral-clicked", async (req, res) => {
    try {
      await ensureSchema(pool);
      const r = await pool.query(
        `UPDATE wedding_assistants
           SET referral_clicked_at = COALESCE(referral_clicked_at, NOW()),
               updated_at = NOW()
           WHERE (invite_token = $1 OR id::text = $1)
             AND referral_invite_sent_at IS NOT NULL
         RETURNING id`,
        [req.params.token],
      );
      // Idempotent: returner success uansett (frontend bryr seg ikke
      // om vi traff en eksisterende rad, bare at vi ikke krasjet).
      res.json({ tracked: (r.rowCount ?? 0) > 0 });
    } catch (err) {
      console.error("POST /referral-clicked:", err);
      res.json({ tracked: false });
    }
  });

  // ─── POST /api/wedding/assistant-invite/:token/decline ───────
  app.post("/api/wedding/assistant-invite/:token/decline", async (req, res) => {
    try {
      const r = await pool.query(
        `UPDATE wedding_assistants
           SET status = 'declined', declined_at = NOW(), invite_token = NULL, updated_at = NOW()
           WHERE invite_token = $1 AND status = 'invited'
         RETURNING id`,
        [req.params.token],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Invitasjon finnes ikke" });
      res.json({ success: true });
    } catch (err) {
      console.error("POST /assistant-invite/decline:", err);
      res.status(500).json({ error: "Kunne ikke avslå" });
    }
  });

  // ─── GET /api/wedding/:weddingId/profit-split ────────────────
  // Beregn fordeling: assistent får sin compensation (hourly × t, fixed,
  // eller share_pct av netto). Stine får resten.
  app.get("/api/wedding/:weddingId/profit-split", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });

      // Hent siste lagrede invoice for å bruke som "total"
      const invR = await pool.query(
        `SELECT subtotal_kr, mva_kr, total_kr, lines
           FROM wedding_invoices
           WHERE wedding_id = $1 AND photographer_id = $2
           ORDER BY created_at DESC LIMIT 1`,
        [req.params.weddingId, uid],
      );
      const invoice = invR.rows[0];

      const assistants = await pool.query(
        `SELECT * FROM wedding_assistants
           WHERE wedding_id = $1 AND primary_photographer_id = $2
             AND status IN ('accepted', 'completed')`,
        [req.params.weddingId, uid],
      );

      if (!invoice) {
        return res.json({
          message: "Ingen faktura lagret ennå — lagre faktura først for å beregne fordeling.",
          assistants: assistants.rows.map(rowToAssistant),
        });
      }

      // Subtotal eks MVA = beregningsgrunnlag for prosent (samme som ren netto)
      const totalNetto = Number(invoice.subtotal_kr);

      let totalAssigned = 0;
      const splits = assistants.rows.map((a: any) => {
        let assignedKr = 0;
        const compType = a.compensation_type;
        const compValue = a.compensation_value != null ? Number(a.compensation_value) : 0;
        const pct = a.share_pct != null ? Number(a.share_pct) : 0;
        let basis = "";
        if (compType === "fixed") {
          assignedKr = compValue;
          basis = `Fast sum ${compValue} kr`;
        } else if (compType === "hourly") {
          // For hourly trenger vi dokumentert tid. MVP: bruk contracted_hours
          // fra wedding_timelines som proxy. Senere kan vi koble til en
          // separat "assistant_hours_logged"-tabell.
          assignedKr = compValue * 6; // placeholder 6t
          basis = `${compValue} kr/t × 6t (estimat)`;
        } else if (compType === "percentage") {
          assignedKr = Math.round(totalNetto * (pct / 100) * 100) / 100;
          basis = `${pct}% av netto (${totalNetto.toFixed(0)} kr)`;
        }
        totalAssigned += assignedKr;
        return {
          assistantId: a.id,
          assistantName: a.assistant_name,
          role: a.role,
          compensationType: compType,
          basis,
          shareKr: assignedKr,
        };
      });

      res.json({
        invoiceTotalKr: Number(invoice.total_kr),
        invoiceSubtotalKr: totalNetto,
        assistantSplits: splits,
        primaryPhotographerKr: Math.round((totalNetto - totalAssigned) * 100) / 100,
        primaryPhotographerNote: "Stines netto andel (subtotal minus assistent-utbetalinger). Husk å trekke MVA + egne utlegg/kjøregodtg.",
      });
    } catch (err) {
      console.error("GET /profit-split:", err);
      res.status(500).json({ error: "Kunne ikke beregne fordeling" });
    }
  });
}
