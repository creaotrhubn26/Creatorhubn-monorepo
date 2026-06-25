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

  // Improvement C — atferdssignaler. Tabellen opprettes lazily fordi
  // start-scriptet (`node server.js`) ikke kjører migrate.sh på hver deploy;
  // migrasjon 0344 dekker det reproduserbart, denne garanterer runtime.
  let activityTableReady: Promise<void> | null = null;
  const ensureActivityTable = (): Promise<void> => {
    if (!activityTableReady) {
      activityTableReady = pool
        .query(
          `CREATE TABLE IF NOT EXISTS prototype_activity_signals (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR(255) NOT NULL,
            user_email VARCHAR(320),
            event_type VARCHAR(64) NOT NULL,
            surface VARCHAR(64),
            detail JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`,
        )
        .then(() =>
          pool.query(
            `CREATE INDEX IF NOT EXISTS idx_prototype_activity_user
               ON prototype_activity_signals (user_id, created_at DESC)`,
          ),
        )
        .then(() =>
          pool.query(
            `CREATE INDEX IF NOT EXISTS idx_prototype_activity_created
               ON prototype_activity_signals (created_at DESC)`,
          ),
        )
        .then(() => undefined)
        .catch((e) => {
          activityTableReady = null; // la neste forsøk prøve igjen
          console.error("[prototype-activity] ensureTable failed", e);
        });
    }
    return activityTableReady;
  };

  // Lett beacon — registrerer hva testeren faktisk gjør. Aldri-blokkerende:
  // svarer 204 uansett, slik at en feil her aldri forstyrrer arbeidsflyten.
  app.post("/api/prototype-testing/signal", async (req, res) => {
    const session = getActiveSessionFromRequest(req);
    if (!session) return res.status(204).end();
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const eventType =
        typeof body.eventType === "string"
          ? body.eventType.trim().slice(0, 64)
          : "";
      if (!eventType) return res.status(204).end();
      const surface =
        typeof body.surface === "string" && body.surface.trim().length > 0
          ? body.surface.trim().slice(0, 64)
          : null;
      let detail: Record<string, unknown> = {};
      if (
        body.detail &&
        typeof body.detail === "object" &&
        !Array.isArray(body.detail)
      ) {
        const serialized = JSON.stringify(body.detail);
        if (serialized.length <= 2000) {
          detail = body.detail as Record<string, unknown>;
        }
      }
      const userId = String((session as any).userId || "");
      const email = (session as any).email
        ? String((session as any).email)
        : null;
      if (!userId) return res.status(204).end();
      await ensureActivityTable();
      await pool.query(
        `INSERT INTO prototype_activity_signals (user_id, user_email, event_type, surface, detail)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [userId, email, eventType, surface, JSON.stringify(detail)],
      );
      res.status(204).end();
    } catch {
      res.status(204).end();
    }
  });

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

  // ─── Trådet feedback-SAMTALE ────────────────────────────────────────────
  // Hver tilbakemelding blir en toveis-dialog. Vendor svarer, Creatorhub svarer
  // tilbake (admin = menneske, eller en varm system-kvittering). Tabellen
  // opprettes lazily (start-scriptet kjører ikke migrate.sh på hver deploy).
  let messagesTableReady: Promise<void> | null = null;
  const ensureMessagesTable = (): Promise<void> => {
    if (!messagesTableReady) {
      messagesTableReady = pool
        .query(
          `CREATE TABLE IF NOT EXISTS prototype_feedback_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            feedback_id VARCHAR(64) NOT NULL,
            sender_role VARCHAR(16) NOT NULL,
            sender_user_id VARCHAR(255),
            sender_name VARCHAR(255),
            body TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )`,
        )
        .then(() =>
          pool.query(
            `CREATE INDEX IF NOT EXISTS idx_pf_messages_feedback
               ON prototype_feedback_messages (feedback_id, created_at)`,
          ),
        )
        .then(() => undefined)
        .catch((e) => {
          messagesTableReady = null;
          console.error("[prototype-messages] ensureTable failed", e);
        });
    }
    return messagesTableReady;
  };

  // FALLBACK-kjernen: varme, kontekst-valgte kvitteringer som IKKE krever AI.
  // Rotert deterministisk på en seed (msg-id) så det ikke gjentas. Dette er
  // standard-veien — AI er bare en valgfri forbedring oppå.
  const warmAck = (feedbackType: string, rating: number, locale: "no" | "en", seed: string): string => {
    const t = String(feedbackType || "").toLowerCase();
    let key = "general";
    if (t.includes("bug")) key = "bug";
    else if (t.includes("feature")) key = "feature";
    else if (rating && rating <= 2) key = "low";
    else if (rating && rating >= 5) key = "high";

    const bankNo: Record<string, string[]> = {
      bug: [
        "Takk for at du fanget dette 👏 Slike rapporter er gull — vi ser på det.",
        "Skarpt fanget! Bug-meldinger som denne gjør produktet bedre for alle. Takk.",
        "Notert — takk for at du tok deg tid til å melde fra. Vi graver i det.",
      ],
      feature: [
        "Elsker dette innspillet 🙌 Akkurat sånn former vi produktet sammen.",
        "For et godt forslag — takk! Det er testere som deg som peker ut veien.",
        "Solid idé. Takk for at du deler den — vi tar den med oss videre.",
      ],
      low: [
        "Beklager at det skurret — takk for at du sier ifra. Det hjelper oss å fikse det.",
        "Det skal ikke kjennes sånn. Takk for ærligheten — vi tar tak i det.",
        "Leit å høre. Innspillet ditt går rett til teamet — takk for at du gir oss sjansen til å rette det.",
      ],
      high: [
        "Så godt å høre! 🎉 Takk for at du tar deg tid til å fortelle oss det.",
        "Det varmer — takk! Slike tilbakemeldinger gir oss energi til å fortsette.",
        "Gleder oss stort. Takk for at du deler det med oss.",
      ],
      general: [
        "Takk for innspillet 🙏 Vi leser alt — og du former produktet med dette.",
        "Mottatt med takk! Hver tilbakemelding fra deg gjør Creatorhub bedre.",
        "Takk for at du tok deg tid — dette betyr noe for oss.",
      ],
    };
    const bankEn: Record<string, string[]> = {
      bug: [
        "Thanks for catching this 👏 Reports like this are gold — we're on it.",
        "Sharp catch! Bug reports like this make the product better for everyone. Thank you.",
        "Noted — thanks for taking the time to flag it. We're digging in.",
      ],
      feature: [
        "Love this input 🙌 This is exactly how we shape the product together.",
        "What a good suggestion — thank you! Testers like you point the way.",
        "Solid idea. Thanks for sharing it — we're taking it with us.",
      ],
      low: [
        "Sorry that felt off — thanks for saying so. It helps us fix it.",
        "It shouldn't feel that way. Thanks for the honesty — we'll get on it.",
        "Sorry to hear that. Your input goes straight to the team — thanks for giving us the chance to put it right.",
      ],
      high: [
        "So good to hear! 🎉 Thank you for taking the time to tell us.",
        "That means a lot — thank you! Feedback like this keeps us going.",
        "Made our day. Thanks for sharing it with us.",
      ],
      general: [
        "Thanks for the input 🙏 We read everything — and you're shaping the product with this.",
        "Received with thanks! Every piece of feedback from you makes Creatorhub better.",
        "Thanks for taking the time — this matters to us.",
      ],
    };
    const bank = locale === "en" ? bankEn : bankNo;
    const list = bank[key] || bank.general;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return list[h % list.length];
  };

  // AI-kvittering NÅR den hjelper; ellers (ingen nøkkel / for lite credits /
  // feil / dårlig svar) faller vi tilbake til warmAck. Aldri lastbærende.
  const generateAck = async (args: {
    feedbackType: string;
    rating: number;
    locale: "no" | "en";
    title: string;
    body: string;
    seed: string;
  }): Promise<string> => {
    const fallback = warmAck(args.feedbackType, args.rating, args.locale, args.seed);
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return fallback;
    try {
      const en = args.locale === "en";
      const prompt = en
        ? `You are the Creatorhub team replying to a prototype tester who just sent this input. Write ONE short, warm, specific message (max 2 sentences) that shows you understood the point, sincerely applauds the contribution, and makes them feel looked after. Do NOT promise specific fixes or timelines. Input — ${args.feedbackType}, rating ${args.rating}/5: "${args.title}: ${args.body}". Reply with ONLY the message text, no quotes.`
        : `Du er Creatorhub-teamet som svarer en prototype-tester som nettopp sendte dette innspillet. Skriv ÉN kort, varm, spesifikk melding (maks 2 setninger) som viser at du forstod poenget, anerkjenner bidraget oppriktig, og får dem til å føle seg ivaretatt. IKKE lov konkrete fikser eller tidsfrister. Innspill — ${args.feedbackType}, vurdering ${args.rating}/5: «${args.title}: ${args.body}». Svar KUN med meldingsteksten, uten anførselstegn.`;
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.PROTOTYPE_ACK_MODEL || "claude-haiku-4-5-20251001",
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) return fallback; // dekker også 429/credit-feil
      const data = (await r.json()) as { content?: { text?: string }[] };
      let text = (data.content?.[0]?.text || "").trim();
      text = text.replace(/^["'«»\s]+|["'«»\s]+$/g, "").trim();
      const bad =
        !text ||
        text.length > 400 ||
        /\b(I cannot|I can't|I'm sorry,? but|as an AI|som en AI|jeg kan ikke|kan dessverre ikke)\b/i.test(text);
      return bad ? fallback : text;
    } catch {
      return fallback;
    }
  };

  const resolveThreadAccess = (
    session: { userId?: string; email?: string; role?: string } | null | undefined,
    fb: { user_id?: unknown; user_email?: unknown },
  ): { isAdmin: boolean; owns: boolean } => {
    const role = String((session as any)?.role || "").trim().toLowerCase();
    const isAdmin = !!session && adminRoles.has(role);
    const sessUserId = session ? String((session as any).userId || "") : "";
    const sessEmail = session ? String((session as any).email || "").trim().toLowerCase() : "";
    const owns =
      (!!sessUserId && String(fb.user_id || "") === sessUserId) ||
      (!!sessEmail && String(fb.user_email || "").toLowerCase() === sessEmail);
    return { isAdmin, owns };
  };

  // Hent tråden (eier eller admin).
  app.get("/api/prototype-testing/feedback/:id/messages", async (req, res) => {
    const session = getActiveSessionFromRequest(req);
    if (!session) return res.status(401).json({ success: false, error: "Innlogging kreves" });
    try {
      const fb = (
        await pool.query(
          `SELECT id, user_id, user_email, user_name, title, description, status, admin_notes,
                  rating, feedback_type, created_at, updated_at
             FROM prototype_feedback WHERE id = $1`,
          [req.params.id],
        )
      ).rows[0];
      if (!fb) return res.status(404).json({ success: false, error: "Ikke funnet" });
      const { isAdmin, owns } = resolveThreadAccess(session as any, fb);
      if (!isAdmin && !owns) return res.status(403).json({ success: false, error: "Ingen tilgang" });

      await ensureMessagesTable();
      const msgs = (
        await pool.query(
          `SELECT id, sender_role, sender_name, body, created_at
             FROM prototype_feedback_messages WHERE feedback_id = $1 ORDER BY created_at ASC`,
          [req.params.id],
        )
      ).rows;

      res.json({
        success: true,
        feedback: {
          id: String(fb.id),
          title: String(fb.title || ""),
          description: String(fb.description || ""),
          status: String(fb.status || "open"),
          adminNotes: fb.admin_notes ? String(fb.admin_notes) : null,
          rating: Number(fb.rating || 0),
          feedbackType: String(fb.feedback_type || "general"),
          vendorName: fb.user_name ? String(fb.user_name) : null,
          createdAt: String(fb.created_at || ""),
          updatedAt: String(fb.updated_at || ""),
        },
        messages: msgs.map((m: any) => ({
          id: String(m.id),
          senderRole: String(m.sender_role),
          senderName: m.sender_name ? String(m.sender_name) : null,
          body: String(m.body || ""),
          createdAt: String(m.created_at || ""),
        })),
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.json({ success: true, feedback: null, messages: [] });
      }
      console.error("Failed to load feedback messages:", error);
      res.status(500).json({ success: false, error: "Failed to load messages" });
    }
  });

  // Post et svar i tråden (eier eller admin). Vendor-svar får en varm kvittering.
  app.post("/api/prototype-testing/feedback/:id/messages", async (req, res) => {
    const session = getActiveSessionFromRequest(req);
    if (!session) return res.status(401).json({ success: false, error: "Innlogging kreves" });
    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const text = typeof body.body === "string" ? body.body.trim() : "";
      if (!text) return res.status(400).json({ success: false, error: "Tom melding" });
      if (text.length > 4000) return res.status(400).json({ success: false, error: "Meldingen er for lang" });

      const fb = (
        await pool.query(
          `SELECT pf.id, pf.user_id, pf.user_email, pf.user_name, pf.title, pf.status,
                  pf.rating, pf.feedback_type, u.language AS user_language
             FROM prototype_feedback pf
             LEFT JOIN users u ON u.id = pf.user_id
            WHERE pf.id = $1`,
          [req.params.id],
        )
      ).rows[0];
      if (!fb) return res.status(404).json({ success: false, error: "Ikke funnet" });
      const { isAdmin, owns } = resolveThreadAccess(session as any, fb);
      if (!isAdmin && !owns) return res.status(403).json({ success: false, error: "Ingen tilgang" });

      await ensureMessagesTable();
      const sessName = (session as any).name ? String((session as any).name) : null;
      const senderRole = isAdmin ? "admin" : "vendor";
      const senderName = isAdmin
        ? sessName || "Creatorhub"
        : fb.user_name
          ? String(fb.user_name)
          : sessName || "Partner";
      const sessUserId = String((session as any).userId || "");

      const inserted = (
        await pool.query(
          `INSERT INTO prototype_feedback_messages (feedback_id, sender_role, sender_user_id, sender_name, body)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, sender_role, sender_name, body, created_at`,
          [req.params.id, senderRole, sessUserId || null, senderName, text],
        )
      ).rows[0];

      // Admin-svar på en åpen sak → flytt til 'in_progress'. Ellers bump updated_at.
      if (isAdmin) {
        await pool
          .query(
            `UPDATE prototype_feedback
                SET status = CASE WHEN lower(coalesce(status,'open')) IN ('open','')
                                  THEN 'in_progress' ELSE status END,
                    updated_at = now()
              WHERE id = $1`,
            [req.params.id],
          )
          .catch(() => {});
      } else {
        await pool.query(`UPDATE prototype_feedback SET updated_at = now() WHERE id = $1`, [req.params.id]).catch(() => {});
      }

      const out: Record<string, unknown> = {
        success: true,
        message: {
          id: String(inserted.id),
          senderRole: String(inserted.sender_role),
          senderName: inserted.sender_name ? String(inserted.sender_name) : null,
          body: String(inserted.body || ""),
          createdAt: String(inserted.created_at || ""),
        },
      };

      // Vendor-svar → varm kvittering (AI når den hjelper, ellers mal).
      if (!isAdmin) {
        const locale = String(fb.user_language || "").toLowerCase().startsWith("en") ? "en" : "no";
        const ackText = await generateAck({
          feedbackType: String(fb.feedback_type || "general"),
          rating: Number(fb.rating || 0),
          locale,
          title: String(fb.title || ""),
          body: text,
          seed: String(inserted.id),
        });
        const ack = (
          await pool.query(
            `INSERT INTO prototype_feedback_messages (feedback_id, sender_role, sender_name, body)
             VALUES ($1, 'system', 'Creatorhub', $2)
             RETURNING id, sender_role, sender_name, body, created_at`,
            [req.params.id, ackText],
          )
        ).rows[0];
        out.ack = {
          id: String(ack.id),
          senderRole: String(ack.sender_role),
          senderName: ack.sender_name ? String(ack.sender_name) : null,
          body: String(ack.body || ""),
          createdAt: String(ack.created_at || ""),
        };
      }

      res.json(out);
    } catch (error) {
      console.error("Failed to post feedback message:", error);
      res.status(500).json({ success: false, error: "Failed to post message" });
    }
  });
}
