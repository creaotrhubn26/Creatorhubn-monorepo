/**
 * Routes for Klient-forespørsler i CSW (alle paneler).
 *
 *   GET    /api/role-room/client-requests/:projectId
 *   POST   /api/role-room/client-requests/:projectId
 *   GET    /api/role-room/client-requests/by-id/:id/messages
 *   POST   /api/role-room/client-requests/by-id/:id/messages
 *   PATCH  /api/role-room/client-requests/by-id/:id/close
 *
 *   GET    /api/role-room/client-requests/public/:token       (no auth)
 *   POST   /api/role-room/client-requests/public/:token/reply (no auth)
 *
 * De to siste er offentlige fordi klienten ikke skal måtte lage konto
 * for å svare. Token er 32 chars cryptographic-ish (forutsigbart nok
 * til at vi ikke bør lagre sensitive data der — kun fritekst-svar).
 */

import type express from "express";
import type { Pool } from "pg";

import {
  addClientRequestMessage,
  closeClientRequest,
  createClientRequest,
  getClientRequest,
  listClientRequestMessages,
  listClientRequests,
  type ClientRequestKind,
  type ClientRequestStatus,
} from "./role-room-client-request-service.js";

interface AdminSession {
  userId: string;
  email: string;
  role?: string;
}

export interface ClientRequestsRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (req: express.Request, res: express.Response) => AdminSession | null;
  isCompatAdminFeatureEnabled: (featureId: string) => boolean;
}

const FEATURE_ID = "role-room-agent-producer";

const VALID_KINDS: ReadonlySet<ClientRequestKind> = new Set<ClientRequestKind>([
  "data_source_access",
  "brand_assets",
  "kpi_baseline",
  "approval",
  "general_info",
]);

export function setupRoleRoomClientRequestsRoutes(deps: ClientRequestsRoutesDeps): void {
  const { app, pool, requireAdminSession, isCompatAdminFeatureEnabled } = deps;

  // List for et prosjekt
  app.get("/api/role-room/client-requests/:projectId", async (req, res) => {
    if (!isCompatAdminFeatureEnabled(FEATURE_ID)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || "").trim();
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId er påkrevd." });
    }
    const status = typeof req.query.status === "string" ? (req.query.status as ClientRequestStatus) : undefined;
    const contextArea = typeof req.query.contextArea === "string" ? req.query.contextArea : undefined;

    try {
      const requests = await listClientRequests(pool, projectId, { status, contextArea });
      return res.json({
        success: true,
        requests,
        pendingCount: requests.filter((r) => r.status === "pending" || r.status === "in_progress").length,
        answeredCount: requests.filter((r) => r.status === "answered").length,
      });
    } catch (error) {
      console.error("[client-requests] list failed", error);
      return res.status(500).json({ success: false, error: "Kunne ikke laste forespørsler." });
    }
  });

  // Opprett ny request (sender e-post automatisk)
  app.post("/api/role-room/client-requests/:projectId", async (req, res) => {
    if (!isCompatAdminFeatureEnabled(FEATURE_ID)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const projectId = String(req.params.projectId || "").trim();
    if (!projectId) {
      return res.status(400).json({ success: false, error: "projectId er påkrevd." });
    }

    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const kind = typeof body.kind === "string" ? body.kind : "";
    if (!VALID_KINDS.has(kind as ClientRequestKind)) {
      return res.status(400).json({ success: false, error: `Ugyldig kind: ${kind}` });
    }
    const title = typeof body.title === "string" ? body.title : "";
    const bodyMarkdown = typeof body.bodyMarkdown === "string" ? body.bodyMarkdown : "";
    const contextArea = typeof body.contextArea === "string" ? body.contextArea : "general";
    const contextKey = typeof body.contextKey === "string" ? body.contextKey : null;
    const clientEmail = typeof body.clientEmail === "string" ? body.clientEmail : "";
    const clientName = typeof body.clientName === "string" ? body.clientName : null;
    const marketerEmail = typeof body.marketerEmail === "string" ? body.marketerEmail : session.email;
    const marketerName = typeof body.marketerName === "string" ? body.marketerName : null;
    const bookingUrl = typeof body.bookingUrl === "string" ? body.bookingUrl : null;
    const skipEmail = body.skipEmail === true;

    const result = await createClientRequest({
      pool,
      projectId,
      kind: kind as ClientRequestKind,
      title,
      bodyMarkdown,
      contextArea,
      contextKey,
      clientEmail,
      clientName,
      marketerUserId: session.userId,
      marketerEmail,
      marketerName,
      bookingUrl,
      skipEmail,
    });

    if (!result.ok) {
      return res.status(400).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      request: result.request,
      emailSent: result.emailSent,
      emailReason: result.emailReason ?? null,
    });
  });

  // Hent meldings-tråd
  app.get("/api/role-room/client-requests/by-id/:id/messages", async (req, res) => {
    if (!isCompatAdminFeatureEnabled(FEATURE_ID)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const id = String(req.params.id || "").trim();
    const request = await getClientRequest(pool, id);
    if (!request) {
      return res.status(404).json({ success: false, error: "Request ikke funnet." });
    }
    const messages = await listClientRequestMessages(pool, id);
    return res.json({ success: true, request, messages });
  });

  // Marketer legger til ny melding (purring eller utdyping)
  app.post("/api/role-room/client-requests/by-id/:id/messages", async (req, res) => {
    if (!isCompatAdminFeatureEnabled(FEATURE_ID)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const id = String(req.params.id || "").trim();
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const bodyMarkdown = typeof body.bodyMarkdown === "string" ? body.bodyMarkdown : "";
    if (!bodyMarkdown.trim()) {
      return res.status(400).json({ success: false, error: "bodyMarkdown er påkrevd." });
    }
    const message = await addClientRequestMessage({
      pool,
      requestId: id,
      sender: "marketer",
      senderLabel: session.email,
      bodyMarkdown,
    });
    if (!message) {
      return res.status(500).json({ success: false, error: "Kunne ikke lagre melding." });
    }
    return res.json({ success: true, message });
  });

  app.patch("/api/role-room/client-requests/by-id/:id/close", async (req, res) => {
    if (!isCompatAdminFeatureEnabled(FEATURE_ID)) {
      return res.status(403).json({ success: false, error: "The Role Room Agent er ikke aktivert." });
    }
    const session = requireAdminSession(req, res);
    if (!session) return;
    const id = String(req.params.id || "").trim();
    const ok = await closeClientRequest(pool, id);
    return res.json({ success: true, closed: ok });
  });

  // Klient-side endpoints (autentisert via client-portal session-token) er
  // registrert i index.ts som /api/client/portal/requests* — ikke her.
  // Holder admin-routes adskilt fra public-portal-routes.
}
