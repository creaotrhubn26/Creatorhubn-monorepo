/**
 * role-room-whatsapp-routes.ts
 *
 * Setup-funksjon for /api/role-room/whatsapp/* endpoints — Meta WhatsApp
 * Business API-integrasjon for The Role Room (team-invite, kunde-
 * kommunikasjon, webhook-events).
 *
 * 18 endpoints:
 *   - GET/POST /whatsapp/webhook                          (Meta verify + events)
 *   - GET/PUT/DELETE /whatsapp/config                     (org config CRUD)
 *   - GET    /whatsapp/health                             (sjekk + event-tellinger)
 *   - PUT    /whatsapp/group-defaults                     (org default group)
 *   - GET/PUT /whatsapp/group/:projectId                  (per-project group)
 *   - POST   /whatsapp/team-invite/sweep                  (manuell invite-sweep)
 *   - GET    /whatsapp/team-invite/status                 (sweep status)
 *   - POST   /whatsapp/test-send                          (test outbound message)
 *   - POST   /whatsapp/inject-test-inbound                (test inbound)
 *   - GET    /whatsapp/events-debug                       (siste events for debug)
 *   - GET    /whatsapp/inbox                              (innkommende meldinger)
 *   - POST   /whatsapp/create-template                    (template-registrering)
 *   - GET    /whatsapp/team-invite/by-project/:projectId  (invite-status for prosjekt)
 *   - POST   /whatsapp/team-invite/resend/:projectId/:crewId (resend invite)
 *
 * Auth: De fleste endpoints krever requireAdminSession; webhook-endpoints
 * er public (verify token + signatur-sjekk inne i handler).
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupRoleRoomWhatsAppRoutes } from "./role-room-whatsapp-routes";
 *
 *   setupRoleRoomWhatsAppRoutes({
 *     app, pool, requireAdminSession,
 *   });
 *
 * Mode-noter: ingen Role Room-mode-branching.
 */

import express from "express";
import type { Pool } from "pg";

import {
  validateAndUpsertWhatsAppOrgConfig,
  getWhatsAppOrgConfigSafe,
  deleteWhatsAppOrgConfig,
  pingWhatsAppPhoneNumber,
  updateOrgGroupDefaults,
} from "./role-room-whatsapp-config-service.js";
import { persistWebhookEvents } from "./role-room-whatsapp-events-service.js";
import {
  readTeamInviteSweepStatus,
  runTeamInviteSweep,
  upsertProjectGroupConfig,
  getProjectGroupConfig,
  dispatchTeamWhatsAppInvite,
} from "./casting-team-whatsapp-invite-service.js";
import { verifyMetaWebhookSignature } from "./role-room-instagram-webhook.js";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomWhatsAppRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
  requireAdminOrDemoBypass: (
    req: express.Request,
    res: express.Response,
  ) => boolean;
}

export function setupRoleRoomWhatsAppRoutes(
  deps: RoleRoomWhatsAppRoutesDeps,
): void {
  const { app, pool, requireAdminSession, requireAdminOrDemoBypass } = deps;

  // Meta POSTs events: outbound message status updates (delivered, read,
  // failed), incoming messages from candidates, template status changes.
  // Same X-Hub-Signature-256 pattern as Instagram webhook. Verify-token
  // separat fra IG så de kan roteres uavhengig.

  app.get("/api/role-room/whatsapp/webhook", (req, res) => {
    const expectedToken =
      (process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN || "").trim() ||
      (process.env.META_WEBHOOK_VERIFY_TOKEN || "").trim();
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && expectedToken && token === expectedToken) {
      return res.status(200).send(String(challenge ?? ""));
    }
    return res.status(403).send("verify token mismatch");
  });

  app.post(
    "/api/role-room/whatsapp/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      const appSecret = process.env.META_APP_SECRET;
      if (!appSecret) {
        if (process.env.NODE_ENV === "production") {
          console.error(
            "[wa-webhook] META_APP_SECRET unset — cannot verify signature",
          );
          return res.status(503).send("webhook not configured");
        }
        console.warn(
          "[wa-webhook] accepting unsigned event (META_APP_SECRET unset, non-prod)",
        );
      }

      const rawBody: Buffer = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(String(req.body ?? ""), "utf8");

      if (appSecret) {
        const signatureHeader = req.headers["x-hub-signature-256"];
        const valid = verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret);
        if (!valid) {
          console.warn("[wa-webhook] signature mismatch — rejecting");
          return res.status(401).send("invalid signature");
        }
      }

      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
      } catch {
        console.warn("[wa-webhook] body was not valid JSON");
        return res.status(200).send("ok");
      }

      // Persister + dispatch til domain-handlers for ALLE 13 field-typer.
      // Hver entry.changes-element blir én rad i role_room_whatsapp_events
      // for audit + BSP-review-bevis. Domain-handlers oppdaterer
      // casting_whatsapp_usage og casting_team_whatsapp_invites.
      if (parsed?.object === "whatsapp_business_account") {
        try {
          const summary = await persistWebhookEvents(pool, parsed);
          if (summary.totalRows > 0) {
            const fields = Object.entries(summary.byField)
              .map(([f, n]) => `${f}=${n}`)
              .join(" ");
            console.log(`[wa-webhook] persisted ${summary.totalRows} rows: ${fields}`);
          }
          if (summary.errors.length) {
            console.warn(
              `[wa-webhook] ${summary.errors.length} persistence errors:`,
              summary.errors.slice(0, 3),
            );
          }
        } catch (error) {
          console.warn("[wa-webhook] persist failed", error);
        }
      }

      return res.status(200).send("ok");
    },
  );

  // ── WhatsApp config + team-invite-admin ────────────────────────────────

  app.get("/api/role-room/whatsapp/config", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const orgKey = String(req.query?.orgKey || "").trim();
    if (!orgKey) return res.status(400).json({ error: "orgKey er påkrevd." });
    try {
      const safe = await getWhatsAppOrgConfigSafe(pool, orgKey);
      return res.json({ success: true, config: safe });
    } catch (error) {
      console.error("WhatsApp config GET failed:", error);
      return res.status(500).json({ error: "Kunne ikke lese WhatsApp-config." });
    }
  });

  app.put("/api/role-room/whatsapp/config", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const orgKey = String(body.orgKey || "").trim();
    const businessAccountId = String(body.businessAccountId || "").trim();
    const phoneNumberId = String(body.phoneNumberId || "").trim();
    const accessToken = String(body.accessToken || "").trim();
    const displayName = String(body.displayName || "").trim();
    if (!orgKey || !businessAccountId || !phoneNumberId || !accessToken || !displayName) {
      return res.status(400).json({
        error:
          "orgKey, businessAccountId, phoneNumberId, accessToken og displayName er påkrevd.",
      });
    }
    try {
      const result = await validateAndUpsertWhatsAppOrgConfig(pool, {
        orgKey,
        businessAccountId,
        phoneNumberId,
        accessToken,
        displayName,
        templateLanguage:
          typeof body.templateLanguage === "string" ? body.templateLanguage : undefined,
        template24hName:
          typeof body.template24hName === "string" ? body.template24hName : undefined,
        template1hName:
          typeof body.template1hName === "string" ? body.template1hName : undefined,
        configuredByUserId:
          typeof body.configuredByUserId === "string"
            ? body.configuredByUserId
            : null,
      });
      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }
      const safe = await getWhatsAppOrgConfigSafe(pool, orgKey);
      return res.json({ success: true, config: safe });
    } catch (error) {
      console.error("WhatsApp config PUT failed:", error);
      return res.status(500).json({ error: "Kunne ikke lagre WhatsApp-config." });
    }
  });

  app.get("/api/role-room/whatsapp/health", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const orgKey = String(req.query?.orgKey || "").trim();
    if (!orgKey) return res.status(400).json({ error: "orgKey er påkrevd." });
    try {
      const safe = await getWhatsAppOrgConfigSafe(pool, orgKey);
      const eventCountResult = await pool.query<{ events_last_24h: string | number }>(
        `SELECT COUNT(*)::bigint AS events_last_24h
           FROM role_room_whatsapp_events
          WHERE received_at >= NOW() - INTERVAL '24 hours'`,
      );
      const lastEventResult = await pool.query<{ received_at: string | null }>(
        `SELECT received_at FROM role_room_whatsapp_events
          ORDER BY received_at DESC LIMIT 1`,
      );
      const qualityResult = await pool.query<{
        event_subtype: string | null;
        received_at: string;
      }>(
        `SELECT event_subtype, received_at
           FROM role_room_whatsapp_events
          WHERE event_field = 'phone_number_quality_update'
          ORDER BY received_at DESC LIMIT 1`,
      );
      const templateStatusResult = await pool.query<{
        template_name: string | null;
        event_subtype: string | null;
        received_at: string;
      }>(
        `SELECT template_name, event_subtype, received_at
           FROM role_room_whatsapp_events
          WHERE event_field = 'message_template_status_update'
          ORDER BY received_at DESC LIMIT 1`,
      );

      return res.json({
        success: true,
        health: {
          hasConfig: safe.hasConfig,
          eventsLast24h: Number(eventCountResult.rows[0]?.events_last_24h) || 0,
          qualityRating: qualityResult.rows[0]?.event_subtype ?? null,
          lastEventAt: lastEventResult.rows[0]?.received_at ?? null,
          lastTemplateStatusEvent: templateStatusResult.rows[0]
            ? {
                templateName: templateStatusResult.rows[0].template_name,
                status: templateStatusResult.rows[0].event_subtype,
                at: templateStatusResult.rows[0].received_at,
              }
            : null,
        },
      });
    } catch (error) {
      console.error("WhatsApp health failed:", error);
      return res.status(500).json({ error: "Kunne ikke hente WhatsApp-helse." });
    }
  });

  app.put("/api/role-room/whatsapp/group-defaults", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const orgKey = String(body.orgKey || "").trim();
    if (!orgKey) return res.status(400).json({ error: "orgKey er påkrevd." });
    const groupStrategy =
      body.groupStrategy === "per_project" || body.groupStrategy === "workspace"
        ? body.groupStrategy
        : undefined;
    const defaultGroupInviteLink =
      body.defaultGroupInviteLink === null
        ? null
        : typeof body.defaultGroupInviteLink === "string"
          ? body.defaultGroupInviteLink
          : undefined;
    const defaultGroupName =
      body.defaultGroupName === null
        ? null
        : typeof body.defaultGroupName === "string"
          ? body.defaultGroupName
          : undefined;
    const defaultGroupAdminEmail =
      body.defaultGroupAdminEmail === null
        ? null
        : typeof body.defaultGroupAdminEmail === "string"
          ? body.defaultGroupAdminEmail
          : undefined;
    try {
      await updateOrgGroupDefaults(pool, {
        orgKey,
        groupStrategy,
        defaultGroupInviteLink,
        defaultGroupName,
        defaultGroupAdminEmail,
      });
      const safe = await getWhatsAppOrgConfigSafe(pool, orgKey);
      return res.json({ success: true, config: safe });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === "invalid_invite_link") {
        return res.status(400).json({
          error: "Ugyldig invite-lenke. Forventer https://chat.whatsapp.com/<kode>.",
        });
      }
      console.error("WhatsApp group-defaults PUT failed:", error);
      return res.status(500).json({ error: "Kunne ikke lagre gruppe-standard." });
    }
  });

  app.delete("/api/role-room/whatsapp/config", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const orgKey = String(req.query?.orgKey || "").trim();
    if (!orgKey) return res.status(400).json({ error: "orgKey er påkrevd." });
    try {
      await deleteWhatsAppOrgConfig(pool, orgKey);
      return res.json({ success: true });
    } catch (error) {
      console.error("WhatsApp config DELETE failed:", error);
      return res.status(500).json({ error: "Kunne ikke slette WhatsApp-config." });
    }
  });

  app.get("/api/role-room/whatsapp/group/:projectId", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const config = await getProjectGroupConfig(pool, req.params.projectId);
      return res.json({ success: true, config });
    } catch (error) {
      console.error("WhatsApp group GET failed:", error);
      return res.status(500).json({ error: "Kunne ikke lese gruppe-config." });
    }
  });

  app.put("/api/role-room/whatsapp/group/:projectId", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const groupInviteLink = String(body.groupInviteLink || "").trim();
    if (!groupInviteLink) {
      return res.status(400).json({ error: "groupInviteLink er påkrevd." });
    }
    try {
      const config = await upsertProjectGroupConfig(pool, {
        projectId: req.params.projectId,
        groupInviteLink,
        groupName: typeof body.groupName === "string" ? body.groupName : null,
        adminUserId: typeof body.adminUserId === "string" ? body.adminUserId : null,
        adminEmail: typeof body.adminEmail === "string" ? body.adminEmail : null,
        orgKey: typeof body.orgKey === "string" ? body.orgKey : null,
        autoInviteEnabled:
          typeof body.autoInviteEnabled === "boolean"
            ? body.autoInviteEnabled
            : true,
      });
      return res.json({ success: true, config });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg === "invalid_invite_link") {
        return res.status(400).json({
          error:
            "Ugyldig invite-lenke. Forventer https://chat.whatsapp.com/<kode>.",
        });
      }
      console.error("WhatsApp group PUT failed:", error);
      return res.status(500).json({ error: "Kunne ikke lagre gruppe-config." });
    }
  });

  app.post("/api/role-room/whatsapp/team-invite/sweep", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const summary = await runTeamInviteSweep("manual", { pool });
      return res.json({ success: true, summary });
    } catch (error) {
      console.error("Team-invite sweep failed:", error);
      return res
        .status(500)
        .json({ error: "Kunne ikke trigge team-invite-sweep." });
    }
  });

  app.get("/api/role-room/whatsapp/team-invite/status", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    return res.json({ success: true, summary: readTeamInviteSweepStatus() });
  });

  // App Review demo — Role Room sender en hello_world-template via
  // Meta Cloud API for å demonstrere whatsapp_business_messaging-bruk.
  // Krever admin-session, tar phone + accessToken + phoneNumberId i body
  // så reviewer ser at appen vår er det som faktisk kaller Meta.
  app.post("/api/role-room/whatsapp/test-send", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const to = String(body.to || "").trim();
    const accessToken =
      (typeof body.accessToken === "string" && body.accessToken.trim()) ||
      (process.env.META_APP_ACCESS_TOKEN || "").trim();
    const phoneNumberId =
      (typeof body.phoneNumberId === "string" && body.phoneNumberId.trim()) ||
      (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
    const templateName = String(body.templateName || "hello_world").trim();
    const languageCode = String(body.languageCode || "en_US").trim();
    if (!to) return res.status(400).json({ error: "to (telefonnummer) er påkrevd." });
    if (!accessToken || !phoneNumberId) {
      return res.status(503).json({
        error:
          "WhatsApp API ikke konfigurert. Sett META_APP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID.",
      });
    }

    const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {}
      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          status: response.status,
          body: parsed,
        });
      }
      return res.json({
        success: true,
        messageId:
          Array.isArray(parsed.messages) &&
          parsed.messages[0] &&
          typeof (parsed.messages[0] as Record<string, unknown>).id === "string"
            ? (parsed.messages[0] as Record<string, string>).id
            : null,
        response: parsed,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Debug: ALLE events (ikke bare inbound). Brukes for å sjekke at
  // webhook fyrer ved status-updates / template-events / etc.
  // Inject syntetisk inbound-event for demo. Brukes når Meta sandbox-
  // test-nummer ikke fyrer webhooks. Henter samme persistensvei som ekte
  // webhook → inbox-side viser samme UI uten endring av handler-koden.
  app.post("/api/role-room/whatsapp/inject-test-inbound", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const fromNumber = String(body.from || "4797959294").trim();
    const messageText = String(body.text || "Tusen takk for innkallingen — jeg kommer på audition!").trim();
    // WABA-ID + phone-number-id leses fra env hvis ikke spesifisert i body.
    // Tidligere hardkodet, men det knyttet endepunktet til én spesifikk
    // WABA — env-vars gjør det portabelt mellom dev/staging/prod.
    const phoneNumberId =
      (typeof body.phoneNumberId === "string" && body.phoneNumberId.trim()) ||
      (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
    const wabaId =
      (typeof body.wabaId === "string" && body.wabaId.trim()) ||
      (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "").trim();
    if (!phoneNumberId || !wabaId) {
      return res.status(400).json({
        error:
          "phoneNumberId og wabaId er påkrevd (kan settes i body, eller via WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_BUSINESS_ACCOUNT_ID env-vars).",
      });
    }
    const messageId = `wamid.demo${Date.now().toString(36)}`;

    try {
      await pool.query(
        `INSERT INTO role_room_whatsapp_events
           (event_field, event_subtype, waba_id, phone_number_id,
            message_id, template_name, payload)
         VALUES ('messages', 'inbound', $1, $2, $3, NULL, $4::jsonb)`,
        [
          wabaId,
          phoneNumberId,
          messageId,
          JSON.stringify({
            from: fromNumber,
            id: messageId,
            timestamp: String(Math.floor(Date.now() / 1000)),
            type: "text",
            text: { body: messageText },
          }),
        ],
      );
      return res.json({ success: true, messageId, text: messageText });
    } catch (error) {
      console.error("Inject inbound failed:", error);
      return res.status(500).json({ error: "Kunne ikke injecte event." });
    }
  });

  app.get("/api/role-room/whatsapp/events-debug", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    try {
      const limit = Math.min(Number(req.query?.limit) || 25, 100);
      const result = await pool.query<{
        id: string;
        received_at: string;
        event_field: string;
        event_subtype: string | null;
        phone_number_id: string | null;
        message_id: string | null;
        template_name: string | null;
      }>(
        `SELECT id, received_at, event_field, event_subtype,
                phone_number_id, message_id, template_name
           FROM role_room_whatsapp_events
          ORDER BY received_at DESC
          LIMIT $1`,
        [limit],
      );
      return res.json({
        success: true,
        total: result.rows.length,
        events: result.rows,
      });
    } catch (error) {
      console.error("Events debug fetch failed:", error);
      return res.status(500).json({ error: "Kunne ikke hente events." });
    }
  });

  app.get("/api/role-room/whatsapp/inbox", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    try {
      const limit = Math.min(Number(req.query?.limit) || 25, 100);
      const result = await pool.query<{
        id: string;
        received_at: string;
        phone_number_id: string | null;
        message_id: string | null;
        payload: Record<string, unknown>;
      }>(
        `SELECT id, received_at, phone_number_id, message_id, payload
           FROM role_room_whatsapp_events
          WHERE event_field = 'messages' AND event_subtype = 'inbound'
          ORDER BY received_at DESC
          LIMIT $1`,
        [limit],
      );
      return res.json({
        success: true,
        messages: result.rows.map((row) => ({
          id: row.id,
          receivedAt: row.received_at,
          phoneNumberId: row.phone_number_id,
          messageId: row.message_id,
          from:
            (row.payload?.from as string | undefined) ??
            (row.payload?.contacts as Array<Record<string, unknown>> | undefined)?.[0]?.wa_id ??
            null,
          type:
            (row.payload?.type as string | undefined) ?? null,
          text:
            ((row.payload?.text as Record<string, unknown> | undefined)?.body as string | undefined) ?? null,
        })),
      });
    } catch (error) {
      console.error("Inbox fetch failed:", error);
      return res.status(500).json({ error: "Kunne ikke hente innboks." });
    }
  });

  // App Review demo: create-template-API som POST'er til Meta Graph API.
  // Brukes av Playwright-recordingen for whatsapp_business_management.
  app.post("/api/role-room/whatsapp/create-template", async (req, res) => {
    if (!requireAdminOrDemoBypass(req, res)) return;
    const body = (req.body || {}) as Record<string, unknown>;
    const wabaId =
      (typeof body.wabaId === "string" && body.wabaId.trim()) ||
      (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "").trim();
    const accessToken =
      (typeof body.accessToken === "string" && body.accessToken.trim()) ||
      (process.env.META_APP_ACCESS_TOKEN || "").trim();
    const name = String(body.name || "").trim();
    const category = String(body.category || "UTILITY").trim();
    const language = String(body.language || "en_US").trim();
    const bodyText = String(body.bodyText || "").trim();

    if (!wabaId || !accessToken || !name || !bodyText) {
      return res.status(400).json({
        error:
          "wabaId, accessToken, name og bodyText er påkrevd " +
          "(wabaId/accessToken kan også settes via WHATSAPP_BUSINESS_ACCOUNT_ID + META_APP_ACCESS_TOKEN env-vars).",
      });
    }

    const url = `https://graph.facebook.com/v22.0/${wabaId}/message_templates`;
    const payload = {
      name,
      category,
      language,
      components: [
        {
          type: "BODY",
          text: bodyText,
        },
      ],
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const text = await response.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {}
      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          status: response.status,
          body: parsed,
        });
      }
      return res.json({ success: true, response: parsed });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.get(
    "/api/role-room/whatsapp/team-invite/by-project/:projectId",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      try {
        const result = await pool.query<{
          crew_id: string;
          recipient_phone_e164: string | null;
          recipient_email: string | null;
          invited_at: string;
          whatsapp_message_id: string | null;
          delivery_status: string;
          delivery_error: string | null;
          retry_count: number;
        }>(
          `SELECT crew_id, recipient_phone_e164, recipient_email, invited_at,
                  whatsapp_message_id, delivery_status, delivery_error, retry_count
             FROM casting_team_whatsapp_invites
            WHERE project_id = $1`,
          [req.params.projectId],
        );
        return res.json({
          success: true,
          invites: result.rows.map((row) => ({
            crewId: row.crew_id,
            recipientPhone: row.recipient_phone_e164,
            recipientEmail: row.recipient_email,
            invitedAt: row.invited_at,
            whatsappMessageId: row.whatsapp_message_id,
            deliveryStatus: row.delivery_status,
            deliveryError: row.delivery_error,
            retryCount: row.retry_count,
          })),
        });
      } catch (error) {
        console.error("Team-invite status fetch failed:", error);
        return res
          .status(500)
          .json({ error: "Kunne ikke hente team-invite-status." });
      }
    },
  );

  app.post(
    "/api/role-room/whatsapp/team-invite/resend/:projectId/:crewId",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      try {
        const crewResult = await pool.query<{
          name: string | null;
          phone: string | null;
          email: string | null;
        }>(
          `SELECT name, phone, email FROM casting_crew WHERE id = $1 AND project_id = $2 LIMIT 1`,
          [req.params.crewId, req.params.projectId],
        );
        const crew = crewResult.rows[0];
        if (!crew) return res.status(404).json({ error: "Crew-medlem ikke funnet." });
        const result = await dispatchTeamWhatsAppInvite({
          pool,
          projectId: req.params.projectId,
          crewId: req.params.crewId,
          recipientName: crew.name?.trim() || "Crew-medlem",
          recipientPhone: crew.phone,
          recipientEmail: crew.email,
        });
        return res.json({ success: true, result });
      } catch (error) {
        console.error("Team-invite resend failed:", error);
        return res
          .status(500)
          .json({ error: "Kunne ikke sende team-invitasjon på nytt." });
      }
    },
  );

}
