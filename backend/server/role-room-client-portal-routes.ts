/**
 * role-room-client-portal-routes.ts
 *
 * Setup-funksjon for /api/role-room/client-portal/* endpoints — admin-side
 * av klient-portalen. Lar produsenter invitere, liste og revokere
 * klient-tilganger for et prosjekt. Klient-siden (magic-link-auth via
 * session_token) ligger fortsatt i index.ts som /api/client/portal/*.
 *
 * 3 endpoints:
 *   - POST /invite (oppretter invitasjon + magic-link)
 *   - GET /invites/:projectId (lister alle for prosjektet)
 *   - POST /invites/:inviteId/revoke (revokerer)
 *
 * Wire opp i backend/server/index.ts ved å legge til:
 *
 *   import { setupRoleRoomClientPortalRoutes } from "./role-room-client-portal-routes";
 *
 *   setupRoleRoomClientPortalRoutes({ app, pool, requireAdminSession });
 *
 * Mode-noter: ingen direkte mode-branching, men feature er primært
 * relevant for Produksjonsteam og Innholdsprodusent (klient-godkjenning
 * av prosjekter). Utdanningsinstitusjon og Dansestudio bruker den
 * sjeldnere men feature er ikke skjult per mode.
 */

import type express from "express";
import type { Pool } from "pg";

import {
  createClientPortalInvite,
  listClientPortalSessionsForProject,
  revokeClientPortalSession,
} from "./role-room-client-portal.js";
import { sendTransactionalEmail } from "./transactional-email-service.js";
import { composeEmail } from "./email-design-system.js";
import {
  PLATFORM_LABELS,
  PLATFORM_ORDER,
  DEFAULT_HIDDEN_PLATFORMS,
  loadClientPortalHiddenPlatforms,
  setClientPortalHiddenPlatforms,
  type PlatformKey,
} from "./client-portal-connected-platforms.js";

interface AdminSession {
  userId: string;
  email: string;
  name: string;
  role: string;
  loginAt: string;
}

export interface RoleRoomClientPortalRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => AdminSession | null;
}

export function setupRoleRoomClientPortalRoutes(
  deps: RoleRoomClientPortalRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  app.post("/api/role-room/client-portal/invite", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    const clientEmail = typeof body.clientEmail === "string" ? body.clientEmail.trim() : "";
    const clientName = typeof body.clientName === "string" ? body.clientName : null;
    const expiresInDays = typeof body.expiresInDays === "number" ? body.expiresInDays : undefined;
    if (!projectId || !clientEmail) {
      return res.status(400).json({ success: false, error: "projectId og clientEmail er påkrevd." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
      return res.status(400).json({ success: false, error: "clientEmail ser ikke ut som en gyldig e-post." });
    }
    const invite = await createClientPortalInvite(pool, {
      projectId,
      invitedByUserId: session.userId,
      clientEmail,
      clientName,
      expiresInDays,
    });
    if (!invite) {
      return res.status(500).json({ success: false, error: "Klarte ikke å opprette invitasjonen." });
    }
    // Klientportalen lever på theroleroom.com, ikke creatorhubn.com.
    // CREATORHUB_PUBLIC_URL peker til admin-room-domenet og skulle ikke
    // brukes for klient-portal-lenker. Bruk role-room-spesifikke
    // env-variabler først; fall til theroleroom.com som default.
    const base = process.env.ROLE_ROOM_CLIENT_PORTAL_ORIGIN
      || process.env.ROLE_ROOM_PUBLIC_ORIGIN
      || process.env.ROLE_ROOM_FRONTEND_ORIGIN
      || "https://theroleroom.com";
    const magicLinkUrl = `${base.replace(/\/$/, "")}/client/portal/${encodeURIComponent(invite.sessionToken)}`;

    // Send invitasjons-e-post med magic-link til klienten. Best-effort:
    // invitasjonen er allerede opprettet, så e-post-feil skal ikke feile kallet.
    // (Tidligere ble KUN lenken returnert — ingen e-post ble faktisk sendt.)
    let emailed = false;
    try {
      const greetingName = (clientName || clientEmail.split("@")[0] || "der").trim();
      const composed = composeEmail({
        category: "welcome",
        subject: "Du er invitert til å se prosjektet i The Role Room",
        preheader: "Åpne klient-lenken for å se og godkjenne prosjektet.",
        headline: "Du er invitert til prosjektet",
        subhead: `Hei ${greetingName} — du har fått tilgang til å se og godkjenne et prosjekt i The Role Room. Trykk under for å åpne din private klient-lenke. Lenken er personlig og utløper ${invite.expiresAt.toLocaleDateString("nb-NO")}.`,
        cta: { label: "Åpne prosjektet", href: magicLinkUrl },
        footer: {
          reason: "Du får denne e-posten fordi en produsent inviterte deg til et prosjekt i The Role Room.",
        },
      });
      await sendTransactionalEmail({
        to: clientEmail,
        subject: "Du er invitert til å se prosjektet i The Role Room",
        kind: "client_invite",
        fromLabel: "The Role Room",
        pool,
        text: composed.text,
        html: composed.html,
      });
      emailed = true;
    } catch (err) {
      console.warn("[client-portal] invite-e-post feilet", err);
    }

    return res.json({
      success: true,
      emailed,
      invite: {
        id: invite.id,
        clientEmail: invite.clientEmail,
        clientName: invite.clientName,
        projectId: invite.projectId,
        expiresAt: invite.expiresAt.toISOString(),
        status: invite.status,
        createdAt: invite.createdAt.toISOString(),
      },
      magicLinkUrl,
    });
  });

  app.get("/api/role-room/client-portal/invites/:projectId", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || "").trim();
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId er påkrevd." });
    }
    const invites = await listClientPortalSessionsForProject(pool, projectId, session.userId);
    return res.json({
      success: true,
      invites: invites.map((i) => ({
        id: i.id,
        clientEmail: i.clientEmail,
        clientName: i.clientName,
        projectId: i.projectId,
        status: i.status,
        expiresAt: i.expiresAt.toISOString(),
        createdAt: i.createdAt.toISOString(),
        lastSeenAt: i.lastSeenAt?.toISOString() ?? null,
      })),
    });
  });

  app.post("/api/role-room/client-portal/invites/:inviteId/revoke", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const inviteId = String(req.params.inviteId || "").trim();
    if (!inviteId) {
      return res.status(400).json({ success: false, error: "inviteId er påkrevd." });
    }
    const ok = await revokeClientPortalSession(pool, inviteId, session.userId);
    if (!ok) {
      return res.status(404).json({ success: false, error: "Fant ingen aktiv invitasjon å revokere." });
    }
    return res.json({ success: true });
  });

  // ── Plattform-synlighet i klientportalen (produsent-styrt) ──────────────
  // Produsenten velger hvilke «Koblede kontoer» klienten ser/kan koble.
  // Lagrer SKJULTE plattformer; Google Workspace skjult som standard.
  app.get("/api/role-room/client-portal/platform-prefs/:projectId", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || "").trim();
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId er påkrevd." });
    }
    const hidden = await loadClientPortalHiddenPlatforms(pool, projectId);
    return res.json({
      success: true,
      hiddenPlatforms: Array.from(hidden),
      defaultHidden: DEFAULT_HIDDEN_PLATFORMS,
      // Alle plattformer produsenten kan vise/skjule, med visningsnavn.
      available: PLATFORM_ORDER
        .filter((key) => key !== "facebook") // FB avledes av Instagram — ikke egen toggle
        .map((key) => ({ key, label: PLATFORM_LABELS[key] })),
    });
  });

  app.put("/api/role-room/client-portal/platform-prefs/:projectId", async (req, res) => {
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || "").trim();
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId er påkrevd." });
    }
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const raw = Array.isArray(body.hiddenPlatforms) ? body.hiddenPlatforms : [];
    const hidden = raw.filter(
      (p): p is PlatformKey => typeof p === "string" && p in PLATFORM_LABELS,
    );
    await setClientPortalHiddenPlatforms(pool, projectId, hidden, session.userId);
    return res.json({ success: true, hiddenPlatforms: hidden });
  });
}
