import express from "express";
import type { Pool } from "pg";
import {
  fetchClientDashboard,
  resolveClientPortalSession,
} from "./role-room-client-portal.js";
import { persistAuthSession } from "./auth-session-store.js";

export interface ClientPortalRoutesDeps {
  app: express.Application;
  pool: Pool;
  activeSessions: Map<string, any>;
}

export function setupClientPortalRoutes(
  deps: ClientPortalRoutesDeps,
): void {
  const { app, pool, activeSessions } = deps;
  type ActiveSessionData = any;

  app.get("/api/client/portal/requests", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).json({ error: "missing_token" });
    const session = await resolveClientPortalSession(pool, token);
    if (!session) return res.status(404).json({ error: "invalid_or_expired_token" });
    try {
      const requests = await (await import("./role-room-client-request-service.js"))
        .listClientRequestsForClient(pool, session.projectId, session.clientEmail);
      return res.json({
        status: "ok",
        clientName: session.clientName,
        requests: requests.map((r) => ({
          id: r.id,
          kind: r.kind,
          title: r.title,
          bodyMarkdown: r.bodyMarkdown,
          contextArea: r.contextArea,
          contextKey: r.contextKey,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          answeredAt: r.answeredAt,
          bookingUrl: r.bookingUrl,
        })),
      });
    } catch (error) {
      console.error("[client/portal/requests] failed", error);
      return res.status(500).json({ error: "failed_to_list_requests" });
    }
  });

  // Hent meldings-tråd for en spesifikk request — guarded slik at
  // klienten bare kan se requests scoped til sin session.
  app.get("/api/client/portal/requests/:id/messages", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).json({ error: "missing_token" });
    const session = await resolveClientPortalSession(pool, token);
    if (!session) return res.status(404).json({ error: "invalid_or_expired_token" });
    const id = String(req.params.id || "").trim();
    try {
      const svc = await import("./role-room-client-request-service.js");
      const request = await svc.getClientRequest(pool, id);
      if (!request) return res.status(404).json({ error: "not_found" });
      // Scope-sjekk: må matche session sin project + email
      if (request.projectId !== session.projectId ||
          request.clientEmail.toLowerCase() !== session.clientEmail.toLowerCase()) {
        return res.status(403).json({ error: "forbidden" });
      }
      const messages = await svc.listClientRequestMessages(pool, id);
      return res.json({
        status: "ok",
        request: {
          id: request.id,
          kind: request.kind,
          title: request.title,
          bodyMarkdown: request.bodyMarkdown,
          status: request.status,
          bookingUrl: request.bookingUrl,
          createdAt: request.createdAt,
          answeredAt: request.answeredAt,
        },
        messages,
      });
    } catch (error) {
      console.error("[client/portal/requests/messages] failed", error);
      return res.status(500).json({ error: "failed" });
    }
  });

  // Klient svarer på en request. Samme scope-sjekk som GET.
  app.post("/api/client/portal/requests/:id/reply", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).json({ error: "missing_token" });
    const session = await resolveClientPortalSession(pool, token);
    if (!session) return res.status(404).json({ error: "invalid_or_expired_token" });
    const id = String(req.params.id || "").trim();
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const bodyMarkdown = typeof body.bodyMarkdown === "string" ? body.bodyMarkdown : "";
    if (!bodyMarkdown.trim()) {
      return res.status(400).json({ error: "missing_body" });
    }
    try {
      const svc = await import("./role-room-client-request-service.js");
      const request = await svc.getClientRequest(pool, id);
      if (!request) return res.status(404).json({ error: "not_found" });
      if (request.projectId !== session.projectId ||
          request.clientEmail.toLowerCase() !== session.clientEmail.toLowerCase()) {
        return res.status(403).json({ error: "forbidden" });
      }
      if (request.status === "closed") {
        return res.status(400).json({ error: "request_closed" });
      }
      const message = await svc.addClientRequestMessage({
        pool,
        requestId: id,
        sender: "client",
        senderLabel: session.clientName ?? request.clientEmail,
        bodyMarkdown,
        markAnswered: true,
      });
      return res.json({ status: "ok", message });
    } catch (error) {
      console.error("[client/portal/requests/reply] failed", error);
      return res.status(500).json({ error: "failed" });
    }
  });

  // Klient-portal: registrer en ekte bruker-konto fra innsiden av
  //   portalen. E-posten er bundet til portal-session og kan ikke
  //   endres — vi vil ikke at en lekk magic-link skal kunne brukes til
  //   å lage en bruker for en helt annen e-post. Etter registrering kan
  //   klienten logge inn på vanlig /login med e-post + passord; magic-
  //   linken fortsetter å fungere som backup.
  app.post("/api/client/portal/register", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).json({ error: "missing_token" });
    const session = await resolveClientPortalSession(pool, token);
    if (!session) return res.status(404).json({ error: "invalid_or_expired_token" });

    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const password = typeof body.password === "string" ? body.password : "";
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";

    if (password.length < 8) {
      return res.status(400).json({ error: "weak_password", message: "Passord må være minst 8 tegn." });
    }

    // Krev at klienten har bekreftet e-posten med kode først.
    // Dette stopper en evt. lekkasje av magic-linken fra å brukes til å
    // sette passord — angriperen trenger også tilgang til e-post-innboksen.
    try {
      const verifSvc = await import("./email-verification-service.js");
      const hasVerified = await verifSvc.hasRecentlyVerifiedCode(pool, {
        email: session.clientEmail,
        purpose: "client_portal_register",
        withinMinutes: 30,
      });
      if (!hasVerified) {
        return res.status(403).json({
          error: "email_not_verified",
          message: "Du må bekrefte e-posten din med en kode først. Be om en bekreftelseskode og fyll den inn.",
        });
      }
    } catch (error) {
      console.error("[client/portal/register] verification check failed", error);
      return res.status(500).json({ error: "verification_check_failed" });
    }

    try {
      const bcrypt = await import("bcrypt");
      const hashed = await bcrypt.default.hash(password, 10);
      const email = session.clientEmail.toLowerCase();
      const firstName = (fullName.split(/\s+/)[0] || session.clientName || email.split("@")[0]).slice(0, 64);
      const lastName = fullName.split(/\s+/).slice(1).join(" ").slice(0, 64) || null;
      const username = (email.split("@")[0] || "klient")
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 64);

      // ON CONFLICT: hvis brukeren allerede finnes (kanskje samme e-post
      // ble brukt fra et tidligere prosjekt), oppdater bare passord +
      // navn — vi vil ikke at registrering skal silently feile.
      const result = await pool.query(
        `INSERT INTO users (email, username, first_name, last_name, role, password, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'user', $5, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE
           SET password = EXCLUDED.password,
               first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), users.first_name),
               last_name  = COALESCE(NULLIF(EXCLUDED.last_name, ''), users.last_name),
               updated_at = NOW()
         RETURNING id, email, first_name, last_name`,
        [email, username, firstName, lastName, hashed],
      );

      // Mint en regulær auth-session så klienten kan bruke 2FA-setup og
      // andre innloggede endpoints UTEN å måtte logge ut + inn igjen.
      // Bruker minimal session-data — vi gir klient 'user'-rolle for nå.
      const dbUser = result.rows[0];
      const sessionToken = crypto.randomUUID();
      const fullDisplayName = [dbUser.first_name, dbUser.last_name].filter(Boolean).join(" ") || dbUser.email;
      const sessionData: ActiveSessionData = {
        userId: String(dbUser.id),
        email: dbUser.email,
        name: fullDisplayName,
        role: "user",
        roleLabel: "Klient",
        permissions: [],
        displayName: fullDisplayName,
        isAdmin: false,
        loginAt: new Date().toISOString(),
      };
      activeSessions.set(sessionToken, sessionData);
      await persistAuthSession(pool, sessionToken, sessionData);

      return res.json({
        status: "ok",
        userId: dbUser.id ?? null,
        email,
        sessionToken,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: fullDisplayName,
          role: "user",
          display_name: fullDisplayName,
        },
        message: "Brukeren din er opprettet. Du kan nå logge inn med e-post og passord neste gang.",
      });
    } catch (error) {
      console.error("[client/portal/register] failed", error);
      return res.status(500).json({ error: "registration_failed" });
    }
  });

  // Sjekk om en bruker allerede er registrert for portal-sessionens e-post —
  //   brukes for å vise/skjule "Opprett bruker"-banner i portalen.
  app.get("/api/client/portal/register/status", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).json({ error: "missing_token" });
    const session = await resolveClientPortalSession(pool, token);
    if (!session) return res.status(404).json({ error: "invalid_or_expired_token" });
    try {
      const r = await pool.query(
        `SELECT id, password IS NOT NULL AND password <> '' AS has_password
           FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [session.clientEmail],
      );
      return res.json({
        status: "ok",
        email: session.clientEmail,
        isRegistered: r.rows[0]?.has_password === true,
      });
    } catch (error) {
      console.error("[client/portal/register/status] failed", error);
      return res.status(500).json({ error: "failed" });
    }
  });

  // Public — magic-link-auth via session_token query param. Returns the
  // marketing plan dashboard data scoped to the session's project.
  app.get("/api/client/portal/marketing-plan", async (req, res) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return res.status(400).json({ error: "missing_token" });
    const session = await resolveClientPortalSession(pool, token);
    if (!session) return res.status(404).json({ error: "invalid_or_expired_token" });
    const dashboard = await fetchClientDashboard(pool, session);
    if (!dashboard) {
      return res.status(200).json({
        status: "no_plan_yet",
        project: { id: session.projectId, title: null },
        clientName: session.clientName,
        sessionExpiresAt: session.expiresAt.toISOString(),
      });
    }
    return res.json({
      status: "ok",
      clientName: session.clientName,
      ...dashboard,
    });
  });

  // Klient godkjenner eller ber om endring på en spesifikk
  // marketing-plan-post. Status logges på posten + en editor_comment
  // opprettes for sporing slik at Bjarne ser hvem som reviewet og
  // hvilken note som ble lagt ved.
  app.post("/api/client/portal/marketing-plan-posts/:postId/review",
    async (req, res) => {
      const token = typeof req.query.token === "string" ? req.query.token : "";
      if (!token) return res.status(400).json({ error: "missing_token" });
      const session = await resolveClientPortalSession(pool, token);
      if (!session) return res.status(404).json({ error: "invalid_or_expired_token" });

      const postId = String(req.params.postId || "").trim();
      const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
      const status = typeof body.status === "string" ? body.status : "";
      const note = typeof body.note === "string" ? body.note.trim() : "";

      if (status !== "approved" && status !== "changes_requested") {
        return res.status(400).json({ error: "invalid_status" });
      }
      if (status === "changes_requested" && !note) {
        return res.status(400).json({ error: "missing_note_for_changes" });
      }

      // Eier-sjekk: posten må tilhøre prosjektet sesjonen er bundet til
      const { rows: postRows } = await pool.query<{ projectId: string }>(
        `SELECT mp.project_id AS "projectId"
           FROM role_room_marketing_plan_posts p
           JOIN role_room_marketing_plans mp ON mp.id = p.plan_id
          WHERE p.id = $1`,
        [postId],
      );
      const projectId = postRows[0]?.projectId;
      if (!projectId) return res.status(404).json({ error: "post_not_found" });
      if (projectId !== session.projectId) {
        return res.status(403).json({ error: "forbidden" });
      }

      await pool.query(
        `UPDATE role_room_marketing_plan_posts
            SET client_review_status = $1,
                client_review_at = now(),
                client_review_session_id = $2,
                client_review_note = $3,
                updated_at = now()
          WHERE id = $4`,
        [status, session.id, note || null, postId],
      );

      // Sporbarhet — opprett en editor_comment slik at status-endring
      // dukker opp i Bjarnes CollaborationSidebar med samme historikk
      // som vanlige kommentarer.
      const commentText = status === "approved"
        ? `Klient godkjente posten${note ? `: ${note}` : ""}`
        : `Klient ba om endring: ${note}`;
      try {
        await pool.query(
          `INSERT INTO role_room_editor_comments
             (project_id, anchor_type, anchor_ref, comment_text,
              author_display_name, status, priority)
           VALUES ($1, 'marketing_plan_post', $2, $3, $4, 'open',
                   $5)`,
          [
            projectId, postId, commentText,
            session.clientName ?? session.clientEmail,
            status === "changes_requested" ? "high" : "normal",
          ],
        );
      } catch (e) {
        // Audit-comment skal aldri blokkere review-flowen.
        console.warn("[client-portal/review] kunne ikke logge editor_comment", e);
      }

      // Email-notify producer i bakgrunnen
      void (async () => {
        try {
          const mod = await import("./marketing-preview-email-service.js");
          await mod.notifyProducerOfClientComment({
            pool, projectId, postId,
            commentText: status === "approved"
              ? `Godkjente posten${note ? `: ${note}` : ""}`
              : `Be om endring: ${note}`,
            clientName: session.clientName,
            reviewStatus: status as 'approved' | 'changes_requested',
          });
        } catch (e) {
          console.warn("[client-portal/review] producer-email feilet", e);
        }
      })();

      return res.json({
        ok: true,
        postId,
        status,
        reviewedAt: new Date().toISOString(),
      });
    },
  );
}
