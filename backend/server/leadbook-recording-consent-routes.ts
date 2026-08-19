/**
 * leadbook-recording-consent-routes.ts
 *
 * Leadbook lydopptak fase 2 — samtykke, sletting, org-compliance.
 * Se docs/leadgrid-gdpr-lydopptak.md. Ingen rå lyd persisteres noe sted
 * (transkripsjon skjer on-device i appen, kun teksten sendes videre som
 * et vanlig leadbook_examples-utkast via POST /leadbook/examples).
 *
 * Prefix: /api/leadgrid/leadbook/* + /api/leadgrid/admin/leadbook/* +
 *         /api/leadgrid/org/leadbook-lydopptak-compliance
 *
 * Mønster speilet fra wedding-assistant-gdpr-routes.ts (samtykke/
 * request-deletion/anonymize/deletion-queue — samme fire-endepunkt-form).
 *
 * Endepunkter (6):
 *   POST /leadbook/recording-consent
 *   POST /leadbook/examples/:id/request-deletion
 *   POST /admin/leadbook/examples/:id/approve-deletion
 *   GET  /admin/leadbook/deletion-queue
 *   POST /org/leadbook-lydopptak-compliance   (§7/§8 — åpner entitlementet)
 *   GET  /org/leadbook-lydopptak-compliance   (status for onboarding-skjermen)
 */

import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";
import { LEADBOOK_LYDOPPTAK_FEATURE_KEY } from "./leadgrid-entitlement-guard.js";
import { anonymizeText, anonymizeTranscript } from "./leadgrid-leadbook-examples-routes.js";

type SessionUser = { userId: string; email: string; name: string; role: string };
const ADMIN_ROLES = new Set(["admin", "super_admin"]);
const LEADER_ROLES = new Set(["admin", "salgssjef", "teamleder"]);

export interface LeadbookRecordingConsentRoutesDeps {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => SessionUser | null;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

async function orgRole(pool: Pool, orgId: string, userId: string): Promise<string | null> {
  try {
    const r = await pool.query<{ role: string }>(
      `SELECT role FROM organization_members WHERE organization_id = $1::uuid AND user_id = $2 LIMIT 1`,
      [orgId, userId],
    );
    return r.rows[0]?.role ?? null;
  } catch {
    return null;
  }
}

/** Fail-CLOSED (motsatt av standard entitlement-guard): manglende/locked
 *  rad = nektet. Samme mønster som leadbookAIStrukturering-sjekken. */
async function assertLydopptakEnabled(
  pool: Pool, orgId: string, res: Response,
): Promise<boolean> {
  try {
    const r = await pool.query<{ state: string }>(
      `SELECT state FROM leadgrid_org_entitlements
        WHERE organization_id = $1 AND feature_key = $2 LIMIT 1`,
      [orgId, LEADBOOK_LYDOPPTAK_FEATURE_KEY],
    );
    const state = r.rows[0]?.state ?? null;
    if (state == null || state === "locked") {
      res.status(403).json({ error: "entitlement_locked", features: [LEADBOOK_LYDOPPTAK_FEATURE_KEY] });
      return false;
    }
    return true;
  } catch (e) {
    console.error("[leadbook-recording] entitlement check failed (fail-closed):", e);
    res.status(403).json({ error: "entitlement_locked", features: [LEADBOOK_LYDOPPTAK_FEATURE_KEY] });
    return false;
  }
}

export function registerLeadbookRecordingConsentRoutes(
  deps: LeadbookRecordingConsentRoutesDeps,
): void {
  const { app, pool, requireUserSession } = deps;

  // ── POST /leadbook/recording-consent ─────────────────────────────
  // Selger logger at kunden muntlig bekreftet samtykke, FØR mikrofonen
  // startes (§4). Returnerer id — appen sender denne som source_consent_id
  // når/hvis transkriptet lagres som et Eksempler-utkast.
  app.post("/api/leadgrid/leadbook/recording-consent", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "ingen_org" });
    if (!(await assertLydopptakEnabled(pool, orgId, res))) return;

    const b = (req.body ?? {}) as Record<string, unknown>;
    const consentVersion = str(b.consent_version).trim();
    if (!consentVersion) return res.status(400).json({ error: "mangler_consent_version" });
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;

    try {
      const id = randomUUID();
      await pool.query(
        `INSERT INTO leadbook_recording_consents
           (id, organization_id, user_id, consent_version, customer_label, consented_at, ip)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
        [id, orgId, session.userId, consentVersion, str(b.customer_label), ip],
      );
      res.status(201).json({ id, consentedAt: new Date().toISOString() });
    } catch (err) {
      console.error("[leadbook-recording] consent failed:", err);
      res.status(500).json({ error: "consent_failed" });
    }
  });

  // ── POST /leadbook/examples/:id/request-deletion ─────────────────
  // Eier (selger) eller leder ber om sletting. Kladd (aldri delt) slettes
  // umiddelbart. Publisert (delt med teamet) flagges + varsler ledere —
  // §4.4: forblir hvis alt anonymisert, ellers anonymiseres+arkiveres av
  // leder via approve-deletion.
  app.post("/api/leadgrid/leadbook/examples/:id/request-deletion", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "ingen_org" });
    const role = await orgRole(pool, orgId, session.userId);
    const isLeader = role != null && LEADER_ROLES.has(role);

    try {
      const row = await pool.query<{ status: string; seller_user_id: string | null }>(
        `SELECT status, seller_user_id FROM leadbook_examples
          WHERE id = $1::uuid AND organization_id = $2 LIMIT 1`,
        [req.params.id, orgId],
      );
      const ex = row.rows[0];
      if (!ex) return res.status(404).json({ error: "ikke_funnet" });
      const isOwner = ex.seller_user_id === session.userId;
      if (!isOwner && !isLeader) return res.status(403).json({ error: "ikke_eier" });

      if (ex.status === "draft") {
        await pool.query(
          `DELETE FROM leadbook_examples WHERE id = $1::uuid AND organization_id = $2`,
          [req.params.id, orgId],
        );
        return res.json({ deleted: true });
      }

      await pool.query(
        `UPDATE leadbook_examples SET delete_requested_at = NOW(), updated_at = NOW()
          WHERE id = $1::uuid AND organization_id = $2`,
        [req.params.id, orgId],
      );
      const leaders = await pool.query<{ user_id: string }>(
        `SELECT user_id FROM organization_members
          WHERE organization_id = $1::uuid AND role = ANY($2::text[])`,
        [orgId, Array.from(LEADER_ROLES)],
      );
      for (const l of leaders.rows) {
        await pool.query(
          `INSERT INTO notification_events
             (recipient_user_id, organization_id, event_type, title, body, triggered_by_user_id, deep_link, meta, email_sent)
           VALUES ($1, $2, 'leadbook_deletion_requested', 'Sletteforespørsel — Leadbook',
                   'En selger har bedt om at et publisert eksempel fjernes.', $3,
                   $4, $5::jsonb, FALSE)`,
          [l.user_id, orgId, session.userId, `leadgrid://leadbook/examples/${req.params.id}`,
            JSON.stringify({ example_id: req.params.id })],
        ).catch((e) => console.warn("[leadbook-recording] notify feilet:", (e as Error).message));
      }
      res.json({
        requested: true,
        note: "Forespørsel registrert. Leder anonymiserer/arkiverer innen 30 dager.",
      });
    } catch (err) {
      console.error("[leadbook-recording] request-deletion failed:", err);
      res.status(500).json({ error: "request_deletion_failed" });
    }
  });

  // ── POST /admin/leadbook/examples/:id/approve-deletion ────────────
  // Leder/admin behandler en sletteforespørsel: anonymiser (hvis ikke
  // alt gjort) + arkiver. Rader slettes ALDRI hardt her (anonymisert
  // struktur består for revisjon/leder-kontinuitet, jf. wedding-mønsteret).
  app.post("/api/leadgrid/admin/leadbook/examples/:id/approve-deletion", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "ingen_org" });
    const role = await orgRole(pool, orgId, session.userId);
    if (!ADMIN_ROLES.has(session.role) && !(role != null && LEADER_ROLES.has(role))) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    try {
      const row = await pool.query<{ transcript: unknown; customer_label: string }>(
        `SELECT transcript, customer_label FROM leadbook_examples
          WHERE id = $1::uuid AND organization_id = $2 LIMIT 1`,
        [req.params.id, orgId],
      );
      const ex = row.rows[0];
      if (!ex) return res.status(404).json({ error: "ikke_funnet" });
      const r = await pool.query(
        `UPDATE leadbook_examples
            SET status = 'archived', transcript = $1::jsonb, customer_label = $2,
                anonymized_at = COALESCE(anonymized_at, NOW()),
                delete_requested_at = NULL, updated_at = NOW()
          WHERE id = $3::uuid AND organization_id = $4
          RETURNING id`,
        [JSON.stringify(anonymizeTranscript(ex.transcript)), anonymizeText(ex.customer_label ?? ""),
          req.params.id, orgId],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "ikke_funnet" });
      res.json({ anonymized: true, archived: true });
    } catch (err) {
      console.error("[leadbook-recording] approve-deletion failed:", err);
      res.status(500).json({ error: "approve_deletion_failed" });
    }
  });

  // ── GET /admin/leadbook/deletion-queue ─────────────────────────────
  app.get("/api/leadgrid/admin/leadbook/deletion-queue", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "ingen_org" });
    const role = await orgRole(pool, orgId, session.userId);
    if (!ADMIN_ROLES.has(session.role) && !(role != null && LEADER_ROLES.has(role))) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    try {
      const r = await pool.query(
        `SELECT id, title, seller_name, delete_requested_at, anonymized_at
           FROM leadbook_examples
          WHERE organization_id = $1 AND delete_requested_at IS NOT NULL AND status != 'archived'
          ORDER BY delete_requested_at ASC`,
        [orgId],
      );
      res.json({ pendingDeletions: r.rows });
    } catch (err) {
      console.error("[leadbook-recording] deletion-queue failed:", err);
      res.status(500).json({ error: "deletion_queue_failed" });
    }
  });

  // ── GET/POST /org/leadbook-lydopptak-compliance ────────────────────
  // §7/§8: org-admin bekrefter compliance-sjekklisten. Bekreftelsen ER
  // det som åpner leadbookLydopptak-entitlementet — ingen egen «skru på»-
  // knapp et annet sted, for å hindre at nøkkelen åpnes uten at §7 er
  // gjennomgått.
  app.get("/api/leadgrid/org/leadbook-lydopptak-compliance", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "ingen_org" });
    try {
      const r = await pool.query(
        `SELECT acknowledged_by_name, acknowledged_at, checklist
           FROM leadbook_recording_compliance_ack WHERE organization_id = $1`,
        [orgId],
      );
      res.json({ acknowledged: r.rowCount! > 0, ack: r.rows[0] ?? null });
    } catch (err) {
      console.error("[leadbook-recording] compliance GET failed:", err);
      res.status(500).json({ error: "compliance_check_failed" });
    }
  });

  app.post("/api/leadgrid/org/leadbook-lydopptak-compliance", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const orgId = await resolveOrgIdForUser(pool, session.userId);
    if (!orgId) return res.status(400).json({ error: "ingen_org" });
    const role = await orgRole(pool, orgId, session.userId);
    if (!ADMIN_ROLES.has(session.role) && !(role != null && LEADER_ROLES.has(role))) {
      return res.status(403).json({ error: "krever_leder_rolle" });
    }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const checklist = (b.checklist && typeof b.checklist === "object") ? b.checklist : {};
    // Alle 4 §7-punktene må være bekreftet — ellers avvist, ikke lagret
    // delvis (delvis bekreftelse ville åpnet nøkkelen på falskt grunnlag).
    const required = ["drofting", "rutine", "infoskriv", "innsyn"];
    const c = checklist as Record<string, unknown>;
    if (!required.every((k) => c[k] === true)) {
      return res.status(400).json({ error: "sjekkliste_ikke_fullfoert", required });
    }
    try {
      await pool.query(
        `INSERT INTO leadbook_recording_compliance_ack
           (organization_id, acknowledged_by, acknowledged_by_name, acknowledged_at, checklist)
         VALUES ($1, $2, $3, NOW(), $4::jsonb)
         ON CONFLICT (organization_id) DO UPDATE
           SET acknowledged_by = EXCLUDED.acknowledged_by,
               acknowledged_by_name = EXCLUDED.acknowledged_by_name,
               acknowledged_at = NOW(),
               checklist = EXCLUDED.checklist`,
        [orgId, session.userId, session.name ?? "", JSON.stringify(checklist)],
      );
      await pool.query(
        `INSERT INTO leadgrid_org_entitlements
           (organization_id, feature_key, state, updated_by, updated_at)
         VALUES ($1::uuid, $2, 'included', $3, NOW())
         ON CONFLICT (organization_id, feature_key) DO UPDATE
           SET state = 'included', updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        [orgId, LEADBOOK_LYDOPPTAK_FEATURE_KEY, session.userId],
      );
      res.json({ acknowledged: true, entitlementOpened: true });
    } catch (err) {
      console.error("[leadbook-recording] compliance POST failed:", err);
      res.status(500).json({ error: "compliance_ack_failed" });
    }
  });
}
