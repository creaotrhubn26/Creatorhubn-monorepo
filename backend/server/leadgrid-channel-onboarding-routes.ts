/**
 * leadgrid-channel-onboarding-routes.ts
 *
 * Kunde-onboarding for varslings-kanaler (e-post + WhatsApp).
 * Brukes av kundens admin (ikke super-admin) til å sette opp deres
 * varslings-strategi: delt nummer eller eget WABA.
 *
 *   GET    /api/leadgrid/onboarding/channels/state
 *   PUT    /api/leadgrid/onboarding/channels/model     (velg shared/own_waba)
 *   POST   /api/leadgrid/onboarding/channels/advance   (gå til neste steg)
 *   POST   /api/leadgrid/onboarding/channels/test-send (send test-melding)
 *   POST   /api/leadgrid/onboarding/channels/activate  (marker som aktivert)
 *
 * Auth: vanlig innlogget bruker (ikke super-admin). User må være tilknyttet en org.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { notifyClient } from "./client-notification-service.js";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps { app: Express; pool: Pool; activeSessions: Map<string, SessionData>; }

function getSession(req: Request, sessions: Map<string, SessionData>): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return sessions.get(auth.substring(7)) ?? null;
  const t = (req as any).cookies?.sessionToken;
  return t ? sessions.get(t) ?? null : null;
}

async function getUserOrgKey(pool: Pool, userId: string): Promise<string | null> {
  const r = await pool.query<{ organization_id: string }>(
    `SELECT om.organization_id::text
       FROM organization_members om
      WHERE om.user_id = $1
        AND om.role IN ('owner', 'admin', 'markedssjef')
      ORDER BY om.role = 'owner' DESC, om.role = 'admin' DESC
      LIMIT 1`,
    [userId],
  );
  return r.rows[0]?.organization_id ?? null;
}

export function registerLeadgridChannelOnboardingRoutes({
  app, pool, activeSessions,
}: Deps): void {

  // ============================================================
  // STATE
  // ============================================================
  app.get("/api/leadgrid/onboarding/channels/state", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });

    const orgKey = await getUserOrgKey(pool, s.userId);
    if (!orgKey) return res.status(403).json({ error: "Du er ikke admin i noen org" });

    let state = (await pool.query(
      `SELECT * FROM leadgrid_channel_onboarding_state WHERE org_key = $1`,
      [orgKey],
    )).rows[0];

    if (!state) {
      await pool.query(
        `INSERT INTO leadgrid_channel_onboarding_state (org_key, started_by_user_id)
         VALUES ($1, $2) ON CONFLICT (org_key) DO NOTHING`,
        [orgKey, s.userId],
      );
      state = (await pool.query(
        `SELECT * FROM leadgrid_channel_onboarding_state WHERE org_key = $1`,
        [orgKey],
      )).rows[0];
    }

    // Hent også email-branding og WA-config-status
    const eb = await pool.query(
      `SELECT brand_name, sender_full_name IS NOT NULL AS has_sender
         FROM leadgrid_email_branding_config WHERE org_key = $1`,
      [orgKey],
    );
    const wa = await pool.query(
      `SELECT phone_number_id, last_validated_at, last_validation_error
         FROM role_room_org_whatsapp_config WHERE org_key = $1`,
      [orgKey],
    );

    res.json({
      state,
      org_key: orgKey,
      email_branding_exists: eb.rows.length > 0,
      email_branding_has_sender: eb.rows[0]?.has_sender ?? false,
      waba_config_exists: wa.rows.length > 0,
      waba_validated: !!wa.rows[0]?.last_validated_at && !wa.rows[0]?.last_validation_error,
      waba_validation_error: wa.rows[0]?.last_validation_error ?? null,
    });
  });

  // ============================================================
  // VELG MODELL
  // ============================================================
  app.put("/api/leadgrid/onboarding/channels/model", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const orgKey = await getUserOrgKey(pool, s.userId);
    if (!orgKey) return res.status(403).json({ error: "Du er ikke admin i noen org" });

    const { model } = req.body ?? {};
    if (!["shared", "own_waba"].includes(model)) {
      return res.status(400).json({ error: "model må være 'shared' eller 'own_waba'" });
    }

    await pool.query(
      `UPDATE leadgrid_channel_onboarding_state
          SET delivery_model = $1,
              current_step = 'email_branding',
              steps_completed = ARRAY[]::TEXT[] || 'choose_model',
              updated_at = now()
        WHERE org_key = $2`,
      [model, orgKey],
    );
    res.json({ ok: true });
  });

  // ============================================================
  // GÅ TIL NESTE STEG
  // ============================================================
  app.post("/api/leadgrid/onboarding/channels/advance", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const orgKey = await getUserOrgKey(pool, s.userId);
    if (!orgKey) return res.status(403).json({ error: "Du er ikke admin i noen org" });

    const { from_step } = req.body ?? {};
    if (!from_step) return res.status(400).json({ error: "from_step påkrevd" });

    // Definer steg-sekvens basert på modell
    const r = await pool.query<{ delivery_model: string }>(
      `SELECT delivery_model FROM leadgrid_channel_onboarding_state WHERE org_key = $1`,
      [orgKey],
    );
    const model = r.rows[0]?.delivery_model;

    const steps_shared = ["choose_model", "email_branding", "verify_email", "activate"];
    const steps_own = ["choose_model", "email_branding", "waba_credentials",
                       "validate_waba", "sync_templates", "test_send", "activate"];
    const steps = model === "own_waba" ? steps_own : steps_shared;

    const curIdx = steps.indexOf(from_step);
    if (curIdx < 0 || curIdx >= steps.length - 1) {
      return res.status(400).json({ error: "Ugyldig from_step" });
    }
    const next = steps[curIdx + 1];

    await pool.query(
      `UPDATE leadgrid_channel_onboarding_state
          SET current_step = $1,
              steps_completed = ARRAY(SELECT DISTINCT UNNEST(steps_completed || ARRAY[$2])),
              updated_at = now()
        WHERE org_key = $3`,
      [next, from_step, orgKey],
    );
    res.json({ ok: true, next_step: next });
  });

  // ============================================================
  // TEST-SEND (sender en test via samme notifyClient-pipeline)
  // ============================================================
  app.post("/api/leadgrid/onboarding/channels/test-send", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const orgKey = await getUserOrgKey(pool, s.userId);
    if (!orgKey) return res.status(403).json({ error: "Du er ikke admin i noen org" });

    const { phone, email, name } = req.body ?? {};
    if (!phone && !email) {
      return res.status(400).json({ error: "phone eller email påkrevd" });
    }

    // Opprett midlertidig kunde + prefs + portal-token
    const cId = (await pool.query<{ id: string }>(
      `SELECT gen_random_uuid() AS id`,
    )).rows[0].id;

    try {
      // Hent et hvilket som helst prosjekt for org-en
      const projR = await pool.query<{ id: string }>(
        `SELECT id FROM casting_projects WHERE organization_id::text = $1 LIMIT 1`,
        [orgKey],
      );
      if (projR.rows.length === 0) {
        return res.status(400).json({
          error: "Ingen prosjekter i org-en — opprett ett først",
        });
      }
      const projectId = projR.rows[0].id;

      await pool.query(
        `INSERT INTO crm_customers (id, project_id, name, email, phone, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'qualified', now())`,
        [cId, projectId, name ?? "Test-mottaker",
         email ?? "no-reply@invalid", phone ?? null],
      );

      const tokenR = await pool.query<{ token: string }>(
        `SELECT encode(gen_random_bytes(16), 'hex') AS token`,
      );
      const portalToken = tokenR.rows[0].token;

      await pool.query(
        `INSERT INTO client_portal_tokens
           (organization_id, project_id, customer_id, token, invited_email,
            invited_name, invited_role)
         VALUES ($1, $2, $3, $4, $5, $6, 'client')`,
        [orgKey, projectId, cId, portalToken,
         email ?? "no-reply@invalid", name ?? "Test"],
      );

      await pool.query(
        `INSERT INTO client_notification_prefs
           (customer_id, contact_name, contact_email, contact_phone,
            notify_email, notify_sms, notify_whatsapp,
            notify_new_finding, consent_given_at, consent_ip)
         VALUES ($1, $2, $3, $4, $5, FALSE, $6, TRUE, now(), '127.0.0.1')`,
        [cId, name ?? "Test", email ?? null, phone ?? null,
         !!email, !!phone],
      );

      // Trigger via notifyClient
      const result = await notifyClient(pool, {
        customerId: cId,
        event: "new_finding",
        findingTitle: "Test-melding fra onboarding-wizard",
        portalToken,
      });

      // Oppdater state
      await pool.query(
        `UPDATE leadgrid_channel_onboarding_state
            SET last_test_phone = $1, last_test_at = now(),
                last_test_error = $2, test_message_sent = $3,
                updated_at = now()
          WHERE org_key = $4`,
        [phone ?? email, result.sent === 0 ? "Ingen kanaler levert" : null,
         result.sent > 0, orgKey],
      );

      // Cleanup
      await pool.query(`DELETE FROM crm_customers WHERE id = $1`, [cId]);

      res.json({
        ok: result.sent > 0,
        attempted: result.attempted,
        sent: result.sent,
        channels: result.channels,
      });
    } catch (e: any) {
      // Cleanup at fail
      await pool.query(`DELETE FROM crm_customers WHERE id = $1`, [cId])
        .catch(() => {});
      await pool.query(
        `UPDATE leadgrid_channel_onboarding_state
            SET last_test_error = $1, updated_at = now()
          WHERE org_key = $2`,
        [e?.message ?? String(e), orgKey],
      );
      res.status(500).json({ error: "test_failed", details: e?.message });
    }
  });

  // ============================================================
  // AKTIVER
  // ============================================================
  app.post("/api/leadgrid/onboarding/channels/activate", async (req, res) => {
    const s = getSession(req, activeSessions);
    if (!s) return res.status(401).json({ error: "Ikke innlogget" });
    const orgKey = await getUserOrgKey(pool, s.userId);
    if (!orgKey) return res.status(403).json({ error: "Du er ikke admin i noen org" });

    await pool.query(
      `UPDATE leadgrid_channel_onboarding_state
          SET activated = TRUE, activated_at = now(),
              current_step = 'completed',
              steps_completed = ARRAY(SELECT DISTINCT UNNEST(
                steps_completed || ARRAY['activate', 'completed'])),
              updated_at = now()
        WHERE org_key = $1`,
      [orgKey],
    );
    res.json({ ok: true });
  });
}
