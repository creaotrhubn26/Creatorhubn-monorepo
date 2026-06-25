import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

export interface PrototypeTestingRoutesDeps {
  app: express.Application;
  requireUserSession: (req: any, res: any) => any;
  pool: Pool;
  isMissingRelationError: (error: unknown) => boolean;
  // Non-blokkerende sesjons-oppslag (skriver IKKE til res) + admin-rollesett, så
  // GET kan personvern-scopes: admin ser alt, innlogget ser KUN sin egen feedback.
  getActiveSessionFromRequest: (req: any) =>
    | { userId?: string; email?: string; role?: string }
    | null
    | undefined;
  adminRoles: Set<string>;
}

export function setupPrototypeTestingRoutes(
  deps: PrototypeTestingRoutesDeps,
): void {
  const {
    app,
    requireUserSession,
    pool,
    isMissingRelationError,
    getActiveSessionFromRequest,
    adminRoles,
  } = deps;

  app.get("/api/prototype-testing/feedback", async (req, res) => {
    try {
      // Personvern: feedback inneholder e-post + fritekst fra testere. Admin ser
      // alt (triage-flatene); innlogget ikke-admin ser KUN sin egen ("du sa → vi
      // gjorde"-sløyfen); uinnlogget ser ingenting.
      const session = getActiveSessionFromRequest(req);
      const sessionRole = String((session as any)?.role || "")
        .trim()
        .toLowerCase();
      const isAdmin = !!session && adminRoles.has(sessionRole);
      const sessUserId = session ? String((session as any).userId || "").trim() : "";
      const sessEmail = session
        ? String((session as any).email || "").trim().toLowerCase()
        : "";

      const statusFilter =
        typeof req.query.status === "string"
          ? req.query.status.trim()
          : "";
      const professionFilter =
        typeof req.query.profession === "string"
          ? req.query.profession.trim()
          : "";
      const dashboardTypeFilter =
        typeof req.query.dashboardType === "string"
          ? req.query.dashboardType.trim()
          : "";
      const parsedLimit = Number.parseInt(
        String(req.query.limit ?? "100"),
        10,
      );
      const limit = Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(parsedLimit, 200))
        : 100;

      const params: Array<string | number> = [];
      const conditions: string[] = [];

      if (!isAdmin) {
        // Uinnlogget → ingen kryss-bruker-data.
        if (!sessUserId && !sessEmail) {
          return res.json({ success: true, feedback: [], count: 0 });
        }
        const ownConds: string[] = [];
        if (sessUserId) {
          params.push(sessUserId);
          ownConds.push(`user_id = $${params.length}`);
        }
        if (sessEmail) {
          params.push(sessEmail);
          ownConds.push(`lower(user_email) = $${params.length}`);
        }
        conditions.push(`(${ownConds.join(" OR ")})`);
      }

      if (statusFilter) {
        params.push(statusFilter);
        conditions.push(`status = $${params.length}`);
      }
      if (professionFilter) {
        params.push(professionFilter);
        conditions.push(`profession = $${params.length}`);
      }
      if (dashboardTypeFilter) {
        params.push(dashboardTypeFilter);
        conditions.push(`dashboard_type = $${params.length}`);
      }

      params.push(limit);
      const whereClause =
        conditions.length > 0
          ? `WHERE ${conditions.join(" AND ")}`
          : "";
      const limitParam = `$${params.length}`;

      const result = await pool.query(
        `SELECT id, user_id, user_email, user_name, profession, dashboard_type, feedback_type, title,
                description, rating, priority, component, tags, is_anonymous, status, admin_notes,
                screenshot_url, created_at, updated_at
         FROM prototype_feedback
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT ${limitParam}`,
        params,
      );

      const feedback = result.rows.map((row: any) => ({
        id: String(row.id),
        userId: String(row.user_id || ""),
        userEmail: row.user_email ? String(row.user_email) : null,
        userName: row.user_name ? String(row.user_name) : null,
        profession: String(row.profession || "general"),
        dashboardType: String(row.dashboard_type || "general"),
        feedbackType: String(row.feedback_type || "general"),
        title: String(row.title || ""),
        description: String(row.description || ""),
        rating: Number(row.rating || 5),
        priority: String(row.priority || "medium"),
        component: row.component ? String(row.component) : null,
        tags: Array.isArray(row.tags)
          ? row.tags.filter(
              (tag: unknown): tag is string => typeof tag === "string",
            )
          : [],
        isAnonymous: Boolean(row.is_anonymous),
        status: String(row.status || "open"),
        adminNotes: row.admin_notes ? String(row.admin_notes) : null,
        screenshotUrl: row.screenshot_url
          ? String(row.screenshot_url)
          : null,
        createdAt: String(row.created_at || new Date().toISOString()),
        updatedAt: String(row.updated_at || new Date().toISOString()),
      }));

      res.json({
        success: true,
        feedback,
        count: feedback.length,
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(200).json({
          success: true,
          feedback: [],
          count: 0,
          message: "prototype_feedback table not available",
        });
      }
      console.error("Failed to fetch prototype feedback:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to fetch feedback" });
    }
  });

  app.post("/api/prototype-testing/feedback", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const description =
        typeof body.description === "string"
          ? body.description.trim()
          : "";

      if (!title || !description) {
        return res.status(400).json({
          success: false,
          error: "title and description are required",
        });
      }

      const feedbackTypeInput =
        typeof body.feedbackType === "string"
          ? body.feedbackType
          : typeof body.category === "string"
            ? body.category
            : "general";
      const normalizedFeedbackType = (() => {
        const normalized = feedbackTypeInput.trim().toLowerCase();
        if (normalized === "bug" || normalized === "technical_issue")
          return "bug";
        if (normalized === "feature_request" || normalized === "feature")
          return "feature";
        if (normalized === "ui_ux" || normalized === "design") return "ui_ux";
        if (normalized === "usability") return "usability";
        return "general";
      })();

      const priorityInput =
        typeof body.priority === "string"
          ? body.priority.trim().toLowerCase()
          : "medium";
      const normalizedPriority = [
        "low",
        "medium",
        "high",
        "critical",
      ].includes(priorityInput)
        ? priorityInput
        : "medium";

      const tags = Array.isArray(body.tags)
        ? body.tags.filter(
            (tag): tag is string =>
              typeof tag === "string" && tag.trim().length > 0,
          )
        : [];

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const userId =
        typeof body.userId === "string" && body.userId.trim().length > 0
          ? body.userId.trim()
          : "anonymous";
      const userEmail =
        typeof body.userEmail === "string" &&
        body.userEmail.trim().length > 0
          ? body.userEmail.trim()
          : null;
      const userName =
        typeof body.userName === "string" && body.userName.trim().length > 0
          ? body.userName.trim()
          : null;
      const profession =
        typeof body.profession === "string" &&
        body.profession.trim().length > 0
          ? body.profession.trim()
          : "general";
      const dashboardType =
        typeof body.dashboardType === "string" &&
        body.dashboardType.trim().length > 0
          ? body.dashboardType.trim()
          : "chat-widget";
      const rating = Number.isFinite(Number(body.rating))
        ? Number(body.rating)
        : 5;
      const component =
        typeof body.component === "string" &&
        body.component.trim().length > 0
          ? body.component.trim()
          : null;
      const screenshotUrl =
        typeof body.screenshotUrl === "string" &&
        body.screenshotUrl.trim().length > 0
          ? body.screenshotUrl.trim()
          : null;
      const isAnonymous =
        userId === "anonymous" || Boolean(body.isAnonymous);

      await pool.query(
        `INSERT INTO prototype_feedback (
          id, user_id, user_email, user_name, profession, dashboard_type, feedback_type,
          title, description, rating, priority, component, tags, is_anonymous, status,
          screenshot_url, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13::jsonb, $14, $15,
          $16, $17, $18
        )`,
        [
          id,
          userId,
          userEmail,
          userName,
          profession,
          dashboardType,
          normalizedFeedbackType,
          title,
          description,
          rating,
          normalizedPriority,
          component,
          JSON.stringify(tags),
          isAnonymous,
          "open",
          screenshotUrl,
          now,
          now,
        ],
      );

      res.status(201).json({
        success: true,
        feedback: {
          id,
          userId,
          userEmail,
          userName,
          profession,
          dashboardType,
          feedbackType: normalizedFeedbackType,
          title,
          description,
          rating,
          priority: normalizedPriority,
          component,
          tags,
          isAnonymous,
          status: "open",
          screenshotUrl,
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({
          success: false,
          error: "prototype_feedback table not available",
        });
      }
      console.error("Failed to create prototype feedback:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to create feedback" });
    }
  });

  app.put("/api/prototype-testing/feedback/:id", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    try {
      const feedbackId =
        typeof req.params.id === "string" ? req.params.id.trim() : "";
      if (!feedbackId) {
        return res
          .status(400)
          .json({ success: false, error: "feedback id is required" });
      }

      const body = (req.body || {}) as Record<string, unknown>;
      const statusInput =
        typeof body.status === "string"
          ? body.status.trim().toLowerCase()
          : "";
      const status = [
        "open",
        "in_progress",
        "resolved",
        "closed",
      ].includes(statusInput)
        ? statusInput
        : null;
      const adminNotes =
        typeof body.adminNotes === "string" ? body.adminNotes : null;
      const adminUpdatedBy =
        typeof req.headers["x-user-email"] === "string"
          ? req.headers["x-user-email"]
          : "system";

      if (!status && adminNotes === null) {
        return res.status(400).json({
          success: false,
          error: "status or adminNotes must be provided",
        });
      }

      const result = await pool.query(
        `UPDATE prototype_feedback
         SET
           status = COALESCE($1, status),
           admin_notes = COALESCE($2, admin_notes),
           admin_updated_by = $3,
           updated_at = NOW(),
           resolved_at = CASE
             WHEN COALESCE($1, status) IN ('resolved', 'closed') THEN COALESCE(resolved_at, NOW())
             ELSE resolved_at
           END
         WHERE id = $4
         RETURNING id, user_id, user_email, user_name, profession, dashboard_type, feedback_type, title,
                   description, rating, priority, component, tags, is_anonymous, status, admin_notes,
                   screenshot_url, created_at, updated_at`,
        [status, adminNotes, adminUpdatedBy, feedbackId],
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, error: "feedback not found" });
      }

      const row = result.rows[0];
      res.json({
        success: true,
        feedback: {
          id: String(row.id),
          userId: String(row.user_id || ""),
          userEmail: row.user_email ? String(row.user_email) : null,
          userName: row.user_name ? String(row.user_name) : null,
          profession: String(row.profession || "general"),
          dashboardType: String(row.dashboard_type || "general"),
          feedbackType: String(row.feedback_type || "general"),
          title: String(row.title || ""),
          description: String(row.description || ""),
          rating: Number(row.rating || 5),
          priority: String(row.priority || "medium"),
          component: row.component ? String(row.component) : null,
          tags: Array.isArray(row.tags)
            ? row.tags.filter(
                (tag: unknown): tag is string => typeof tag === "string",
              )
            : [],
          isAnonymous: Boolean(row.is_anonymous),
          status: String(row.status || "open"),
          adminNotes: row.admin_notes ? String(row.admin_notes) : null,
          screenshotUrl: row.screenshot_url
            ? String(row.screenshot_url)
            : null,
          createdAt: String(row.created_at || new Date().toISOString()),
          updatedAt: String(row.updated_at || new Date().toISOString()),
        },
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(503).json({
          success: false,
          error: "prototype_feedback table not available",
        });
      }
      console.error("Failed to update prototype feedback:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to update feedback" });
    }
  });

  // Improvement D — AI-temaklynging for admin. Tar åpen feedback og lar Claude
  // gruppere den i temaer med alvorlighet + foreslått tiltak, så admin ser
  // mønstre i stedet for å lese hundre enkeltrader. Admin-only; degraderer trygt
  // hvis ANTHROPIC_API_KEY mangler eller tabellen ikke finnes.
  app.post("/api/prototype-testing/cluster", async (req, res) => {
    const session = getActiveSessionFromRequest(req);
    const role = String((session as any)?.role || "")
      .trim()
      .toLowerCase();
    if (!session || !adminRoles.has(role)) {
      return res
        .status(403)
        .json({ success: false, error: "Admin-tilgang kreves" });
    }

    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const parsedLimit = Number.parseInt(String(body.limit ?? "200"), 10);
      const limit = Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(parsedLimit, 300))
        : 200;

      const result = await pool.query(
        `SELECT id, title, description, feedback_type, component, rating, priority,
                profession, dashboard_type, status, tags, created_at
         FROM prototype_feedback
         WHERE status IS NULL
            OR lower(status) NOT IN ('resolved', 'closed', 'completed', 'done')
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit],
      );

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          clusters: [],
          count: 0,
          message: "Ingen åpen feedback å klynge.",
        });
      }

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.json({
          success: true,
          clusters: [],
          count: result.rows.length,
          degraded: true,
          message:
            "ANTHROPIC_API_KEY mangler — AI-klynging er deaktivert. Sett nøkkelen for å aktivere.",
        });
      }

      const items = result.rows.map((row: any) => ({
        id: String(row.id),
        title: String(row.title || "").slice(0, 160),
        description: String(row.description || "").slice(0, 400),
        type: String(row.feedback_type || "general"),
        component: row.component ? String(row.component) : null,
        rating: Number(row.rating ?? 0),
        priority: String(row.priority || "medium"),
        profession: String(row.profession || "general"),
        surface: String(row.dashboard_type || "general"),
      }));

      const prompt = `Du er produktanalytiker for Creatorhub. Under er ${items.length} prototype-tilbakemeldinger (JSON). Grupper dem i 3-8 distinkte TEMAER basert på det underliggende problemet/ønsket — ikke på overflatiske ord.

${JSON.stringify(items, null, 0)}

Returner KUN valid JSON på formen:
{"clusters":[{"theme":"kort tittel","summary":"1-2 setninger om mønsteret","severity":"low|medium|high|critical","count":<antall i klyngen>,"feedbackIds":["<id>", ...],"suggestedAction":"konkret neste steg for teamet"}]}

Sorter klyngene etter alvorlighet (critical først). severity reflekterer brukerpåvirkning + frekvens. Hver feedback skal høre til nøyaktig én klynge.`;

      let clusters: unknown[] = [];
      let modelUsed = "claude-opus-4-7";
      try {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: modelUsed,
            max_tokens: 4096,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: AbortSignal.timeout(90_000),
        });
        if (!r.ok) throw new Error(`Claude API ${r.status}`);
        const data = (await r.json()) as { content?: { text?: string }[] };
        const text = data.content?.[0]?.text ?? "{}";
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}");
        const slice =
          jsonStart >= 0 && jsonEnd > jsonStart
            ? text.slice(jsonStart, jsonEnd + 1)
            : "{}";
        const parsed = JSON.parse(slice);
        clusters = Array.isArray(parsed.clusters) ? parsed.clusters : [];
      } catch (err) {
        console.error("[prototype-cluster] Claude API error", err);
        return res.status(502).json({
          success: false,
          error: "AI-klynging feilet",
          detail: String(err).slice(0, 200),
        });
      }

      res.json({
        success: true,
        clusters,
        count: result.rows.length,
        model: modelUsed,
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.json({
          success: true,
          clusters: [],
          count: 0,
          message: "prototype_feedback table not available",
        });
      }
      console.error("Failed to cluster prototype feedback:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to cluster feedback" });
    }
  });
}
