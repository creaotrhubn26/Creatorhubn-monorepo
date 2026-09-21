import express from "express";
import { rateLimit } from "express-rate-limit";
import type { Pool } from "pg";
import { sendTransactionalEmail } from "./transactional-email-service";
import { sendCapturePush } from "./capture-push";
import { broadcastUserEvent } from "./realtime-user-events.js";

const APP_URL = (process.env.PUBLIC_APP_URL || "https://creatorhubn.com").replace(/\/+$/, "");

const escH = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface SubmissionsRoutesDeps {
  app: express.Application;
  pool: Pool;
  compatSubmissionsStore: Map<string, Record<string, unknown>>;
  compatStoreSet: (
    key: string,
    value: Record<string, unknown>,
  ) => Promise<void>;
  dbCompatSubmissionKey: (submissionId: string) => string;
  recordAnalyticsEvent: (eventType: string, opts: any) => void;
  compatResolveUserId: (req: any) => string;
  requireUserSession: (
    req: any,
    res: any,
  ) => { userId: string; email: string; name?: string; role?: string } | null;
  readString: (value: unknown) => string | null;
}

export function setupSubmissionsRoutes(deps: SubmissionsRoutesDeps): void {
  const {
    app,
    pool,
    compatSubmissionsStore,
    compatStoreSet,
    dbCompatSubmissionKey,
    recordAnalyticsEvent,
    requireUserSession,
  } = deps;

  const publicSubmissionRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "too_many_requests" },
  });

  function mapSubmissionRow(r: any) {
    return {
      id: r.id,
      name: r.name || r.client_name || "",
      email: r.email || r.client_email || "",
      phone: r.phone || "",
      company: r.company || "",
      projectType: r.project_type || r.submission_type || "wedding",
      eventDate: r.event_date || null,
      location: r.location || "",
      budget: r.budget ? parseFloat(r.budget) : null,
      description: r.description || "",
      specialRequests: r.special_requests || "",
      contactPreference: r.contact_preference || "email",
      timeframe: r.timeframe || "",
      referralSource: r.referral_source || "",
      attachments: r.attachments || [],
      status: r.status || "new",
      assignedPhotographer: r.assigned_photographer || null,
      priority: r.priority || "medium",
      internalNotes: r.internal_notes || "",
      clientNotes: r.client_notes || "",
      followUpDate: r.follow_up_date || null,
      quoteSent: r.quote_sent || false,
      quoteAmount: r.quote_amount ? parseFloat(r.quote_amount) : null,
      contractSent: r.contract_sent || false,
      depositReceived: r.deposit_received || false,
      submittedAt: r.submitted_at || r.created_at,
      lastContactedAt: r.last_contacted_at || null,
      updatedAt: r.updated_at,
      vendorId: r.vendor_id || null,
      vendorEmail: r.vendor_email || null,
      isRead: r.is_read || false,
      isStarred: r.is_starred || false,
      category: r.category || "inquiry",
      userId: r.user_id || null,
      ownerUserId: r.owner_user_id || r.vendor_id || r.assigned_photographer || null,
      projectId: r.project_id || null,
      sourceChannel: r.source_channel || "legacy",
      readAt: r.read_at || null,
      repliedAt: r.replied_at || null,
      convertedAt: r.converted_at || null,
      createdAt: r.created_at || r.submitted_at || null,
    };
  }

  const INQUIRY_STATUSES = new Set([
    "new", "contacted", "replied", "quote_sent", "booked", "converted",
    "completed", "declined", "archived", "spam", "lost",
  ]);
  const INQUIRY_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);

  function ownerPredicate(alias = ""): string {
    const p = alias ? `${alias}.` : "";
    return `(${p}owner_user_id = $1 OR ${p}vendor_id = $1 OR ${p}assigned_photographer = $1 OR LOWER(${p}vendor_email) = LOWER($2))`;
  }

  function inquiryResponse(row: any) {
    const mapped = mapSubmissionRow(row);
    return {
      ...mapped,
      title: row.project_type
        ? `${row.project_type} – ${row.name || row.client_name || "Henvendelse"}`
        : row.name || row.client_name || "Henvendelse",
      clientName: mapped.name,
      clientEmail: mapped.email,
      clientPhone: mapped.phone,
      eventType: mapped.projectType,
      amount: mapped.budget,
      venueName: mapped.location,
      note: mapped.description,
      createdAt: mapped.createdAt,
    };
  }

  function broadcastInquiryUpdated(
    ownerUserId: string,
    inquiryId: string,
    reason: "created" | "updated" | "replied" | "converted",
  ): void {
    broadcastUserEvent(ownerUserId, {
      kind: "inquiry.updated",
      inquiryId,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  app.post("/api/submissions", publicSubmissionRateLimit, async (req, res) => {
    try {
      const {
        name,
        email,
        phone,
        company,
        projectType,
        eventDate,
        location,
        budget,
        description,
        specialRequests,
        contactPreference,
        timeframe,
        referralSource,
        vendorId,
        vendorEmail,
        priority,
        category,
      } = req.body;

      if (!name || !email || !description) {
        return res
          .status(400)
          .json({ error: "Navn, e-post og beskrivelse er påkrevd" });
      }

      const normalizedName = String(name).trim().slice(0, 255);
      const normalizedEmail = String(email).trim().toLowerCase().slice(0, 320);
      const normalizedDescription = String(description).trim().slice(0, 20_000);
      if (!normalizedName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !normalizedDescription) {
        return res.status(400).json({ error: "invalid_contact_details" });
      }
      // CreatorHub user IDs predate the UUID-only schema and may be provider IDs.
      // Resolve the supplied value against users instead of guessing its format.
      const requestedVendorId = typeof vendorId === "string"
        ? vendorId.trim().slice(0, 255)
        : "";
      const requestedVendorEmail = typeof vendorEmail === "string"
        ? vendorEmail.trim().toLowerCase().slice(0, 320)
        : "";
      const target = await pool.query(
        `SELECT id::text AS id, email
           FROM users
          WHERE ($1::text IS NOT NULL AND id::text = $1)
             OR ($2::text IS NOT NULL AND LOWER(email) = LOWER($2))
          ORDER BY CASE WHEN id::text = $1 THEN 0 ELSE 1 END
          LIMIT 1`,
        [requestedVendorId || null, requestedVendorEmail || null],
      );
      if (!target.rows.length) {
        return res.status(400).json({ error: "unknown_vendor" });
      }
      const ownerUserId = String(target.rows[0].id);
      const ownerEmail = String(target.rows[0].email || "").trim().toLowerCase();

      const result = await pool.query(
        `INSERT INTO client_submissions
          (id, name, email, phone, company, project_type, event_date, location,
           budget, description, special_requests, contact_preference, timeframe,
           referral_source, owner_user_id, vendor_id, vendor_email, priority, category,
           status, submission_type, source_channel, data, submitted_at, created_at, updated_at)
         VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14,$15,$16,$17,
                 'new','inquiry','public_submission','{}',NOW(),NOW(),NOW())
         RETURNING *`,
        [
          normalizedName,
          normalizedEmail,
          phone || null,
          company || null,
          projectType || "wedding",
          eventDate || null,
          location || null,
          budget || null,
          normalizedDescription,
          specialRequests || null,
          contactPreference || "email",
          timeframe || null,
          referralSource || null,
          ownerUserId,
          ownerEmail,
          priority || "medium",
          category || "inquiry",
        ],
      );

      const submission = mapSubmissionRow(result.rows[0]);
      compatSubmissionsStore.set(
        String(submission.id),
        submission as Record<string, unknown>,
      );
      void compatStoreSet(
        dbCompatSubmissionKey(String(submission.id)),
        submission as Record<string, unknown>,
      );
      console.log(
        `📩 Ny forespørsel fra ${normalizedName} (${normalizedEmail}) → vendor ${ownerUserId}`,
      );

      recordAnalyticsEvent("submission.received", {
        entityType: "submission",
        entityId: String(submission.id),
        actorUserId: ownerUserId,
        metadata: {
          clientEmail: normalizedEmail,
          clientName: normalizedName,
          projectType: projectType || null,
          budget: budget || null,
          vendorEmail: ownerEmail,
          priority: priority || "medium",
        },
      });

      if (ownerUserId) {
        void (async () => {
          try {
            const { fireWorkflowTrigger } = await import(
              "./workflow-triggers.js"
            );
            await fireWorkflowTrigger({
              pool,
              eventType: "submission.received",
              userId: ownerUserId,
              payload: {
                submission_id: String(submission.id),
                project_type: projectType || null,
                budget: budget || null,
                priority: priority || "medium",
                client_email: normalizedEmail,
                client_name: normalizedName,
              },
            });
          } catch (e: any) {
            console.warn(
              "[workflow-triggers] submission.received fire failed:",
              e.message,
            );
          }
        })();
      }

      // Standard e-post-varsel til produsenten (via Resend) — sendes idet
      // forespørselen kommer inn, til e-posten den er rutet til (vendor_email),
      // ELLER produsentens konto-e-post (users.email via vendorId). Når produsenten
      // logger inn ser de i tillegg badgen på Forespørsler-fanen. Best-effort.
      void (async () => {
        try {
          const toEmail: string | null = ownerEmail || null;
          if (!toEmail) return;
          const rows = [
            projectType ? ["Type", projectType] : null,
            eventDate ? ["Dato", eventDate] : null,
            (budget != null && budget !== "") ? ["Budsjett", `${budget}`] : null,
            location ? ["Sted", location] : null,
            phone ? ["Telefon", phone] : null,
          ].filter(Boolean) as [string, string][];
          const table = rows.map(([k, v]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666">${escH(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${escH(v)}</td></tr>`).join("");
          const html = `<div style="font-family:-apple-system,sans-serif;max-width:540px;margin:0 auto;padding:24px"><h2 style="margin:0 0 12px;color:#1a1a1a">Ny forespørsel 🎉</h2><p style="font-size:15px;color:#333;line-height:1.6"><b>${escH(normalizedName)}</b> (${escH(normalizedEmail)}) har sendt deg en forespørsel.</p>${table ? `<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px">${table}</table>` : ""}<blockquote style="border-left:3px solid #ff8c00;margin:12px 0;padding:8px 16px;color:#333">«${escH(normalizedDescription)}»</blockquote><div style="margin:20px 0"><a href="${APP_URL}" style="display:inline-block;background:#ff8c00;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Se forespørselen</a></div><p style="font-size:12px;color:#999">Du finner den under «Forespørsler» i workspacet og «Kundeforespørsler» på dashbordet.</p></div>`;
          const text = `Ny forespørsel fra ${normalizedName} (${normalizedEmail}).` + rows.map(([k, v]) => ` ${k}: ${v}.`).join("") + ` «${normalizedDescription}» Se den i CreatorHub: ${APP_URL}`;
          await sendTransactionalEmail({
            to: toEmail,
            subject: `Ny forespørsel fra ${normalizedName}${projectType ? " – " + projectType : ""}`,
            html, text, fromLabel: "CreatorHub", kind: "inquiry_received",
            projectId: null, credentialScope: "creatorhub", pool,
          });
        } catch (e: any) { console.warn("[submission] vendor-notify failed:", e?.message); }
      })();
      void sendCapturePush(
        pool,
        ownerUserId,
        "Ny forespørsel",
        `${normalizedName}${projectType ? ` · ${projectType}` : ""}`,
        { type: "inquiry", inquiryId: String(submission.id) },
      ).catch((e) => console.warn("[submission] Capture push failed:", e));
      broadcastInquiryUpdated(ownerUserId, String(submission.id), "created");

      res.status(201).json({
        success: true,
        submission,
        message: "Forespørselen din er sendt til leverandøren!",
      });
    } catch (error) {
      console.error("Error creating durable submission:", error);
      res.status(503).json({
        error: "submission_not_persisted",
        message: "Forespørselen ble ikke lagret. Prøv igjen.",
      });
    }
  });

  app.get("/api/submissions", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const status =
        typeof req.query.status === "string" ? req.query.status : null;
      let query = `SELECT * FROM client_submissions WHERE ${ownerPredicate()}`;
      const params: any[] = [session.userId, session.email];
      if (status) {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }
      query += " ORDER BY submitted_at DESC LIMIT 500";

      const result = await pool.query(query, params);
      const dbRows = result.rows.map(mapSubmissionRow);
      const compatRows = Array.from(
        compatSubmissionsStore.values(),
      ) as Array<Record<string, unknown>>;
      const merged = [...dbRows];
      for (const fallback of compatRows) {
        const fallbackOwner = String(
          fallback.ownerUserId || fallback.vendorId || fallback.assignedPhotographer || "",
        );
        const fallbackEmail = String(fallback.vendorEmail || "").toLowerCase();
        if (
          fallbackOwner !== session.userId &&
          fallbackEmail !== session.email.toLowerCase()
        ) continue;
        if (status && String(fallback.status || "").toLowerCase() !== status.toLowerCase()) continue;
        if (
          !merged.some((item) => String(item.id) === String(fallback.id))
        ) {
          merged.push(fallback as any);
        }
      }
      res.json(merged);
    } catch (error) {
      console.error(
        "Error fetching submissions from DB, using compatibility store:",
        error,
      );
      const status =
        typeof req.query.status === "string" ? req.query.status : null;
      const rows = (
        Array.from(compatSubmissionsStore.values()) as Array<
          Record<string, unknown>
        >
      ).filter((row) => {
        const owner = String(row.ownerUserId || row.vendorId || row.assignedPhotographer || "");
        const email = String(row.vendorEmail || "").toLowerCase();
        if (owner !== session.userId && email !== session.email.toLowerCase()) return false;
        if (
          status &&
          String(row.status || "").toLowerCase() !== status.toLowerCase()
        )
          return false;
        return true;
      });
      res.json(rows);
    }
  });

  app.get("/api/submissions/stats", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'new') as new,
          COUNT(*) FILTER (WHERE status = 'contacted') as contacted,
          COUNT(*) FILTER (WHERE quote_sent = true) as "quoteSent",
          COUNT(*) FILTER (WHERE status = 'booked') as booked,
          COUNT(*) FILTER (WHERE submitted_at > NOW() - INTERVAL '24 hours') as "todayCount",
          COUNT(*) FILTER (WHERE priority = 'urgent' OR priority = 'high') as "urgentCount"
        FROM client_submissions
        WHERE ${ownerPredicate()}
      `,
        [session.userId, session.email],
      );

      const stats = result.rows[0];
      res.json({
        total: parseInt(stats.total),
        new: parseInt(stats.new),
        contacted: parseInt(stats.contacted),
        quoteSent: parseInt(stats.quoteSent),
        booked: parseInt(stats.booked),
        todayCount: parseInt(stats.todayCount),
        urgentCount: parseInt(stats.urgentCount),
      });
    } catch (error) {
      console.error("Error fetching submission stats:", error);
      res.status(500).json({ error: "Kunne ikke hente statistikk" });
    }
  });

  // Canonical inquiry contract used by WorkspaceShell and CaptureApp. Caller
  // supplied vendor ids/e-mails are never trusted for reads or mutations.
  app.get("/api/inquiries", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const requestedStatus = typeof req.query.status === "string" ? req.query.status.trim().toLowerCase() : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 120) : "";
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 200));
    try {
      const params: any[] = [session.userId, session.email];
      let where = ownerPredicate("s");
      if (requestedStatus === "open") {
        where += " AND COALESCE(s.status, 'new') NOT IN ('booked','converted','completed','declined','archived','spam','lost') AND s.project_id IS NULL";
      } else if (requestedStatus) {
        if (!INQUIRY_STATUSES.has(requestedStatus)) {
          return res.status(400).json({ error: "invalid_status" });
        }
        params.push(requestedStatus);
        where += ` AND s.status = $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        where += ` AND (s.name ILIKE $${params.length} OR s.email ILIKE $${params.length} OR s.company ILIKE $${params.length} OR s.description ILIKE $${params.length})`;
      }
      params.push(limit);
      const result = await pool.query(
        `SELECT s.*,
                COUNT(*) OVER()::int AS inquiry_total_count,
                COUNT(*) FILTER (WHERE s.is_read = FALSE) OVER()::int AS inquiry_unread_count
           FROM client_submissions s
          WHERE ${where}
          ORDER BY s.is_starred DESC, s.submitted_at DESC NULLS LAST, s.id DESC
          LIMIT $${params.length}`,
        params,
      );
      const items = result.rows.map(inquiryResponse);
      res.json({
        items,
        unreadCount: Number(result.rows[0]?.inquiry_unread_count || 0),
        total: Number(result.rows[0]?.inquiry_total_count || 0),
      });
    } catch (error) {
      console.error("GET /api/inquiries failed:", error);
      res.status(500).json({ error: "inquiries_unavailable" });
    }
  });

  app.patch("/api/inquiries/:id", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const updates: string[] = [];
    const values: any[] = [session.userId, session.email];
    const set = (column: string, value: unknown) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };
    if (typeof req.body?.isRead === "boolean") {
      set("is_read", req.body.isRead);
      updates.push(req.body.isRead ? "read_at = COALESCE(read_at, NOW())" : "read_at = NULL");
    }
    if (typeof req.body?.isStarred === "boolean") set("is_starred", req.body.isStarred);
    if (req.body?.status !== undefined) {
      const status = String(req.body.status).trim().toLowerCase();
      if (!INQUIRY_STATUSES.has(status)) return res.status(400).json({ error: "invalid_status" });
      set("status", status);
    }
    if (req.body?.priority !== undefined) {
      const priority = String(req.body.priority).trim().toLowerCase();
      if (!INQUIRY_PRIORITIES.has(priority)) return res.status(400).json({ error: "invalid_priority" });
      set("priority", priority);
    }
    if (req.body?.followUpDate !== undefined) {
      const raw = req.body.followUpDate;
      if (raw !== null && Number.isNaN(Date.parse(String(raw)))) {
        return res.status(400).json({ error: "invalid_follow_up_date" });
      }
      set("follow_up_date", raw === null ? null : new Date(String(raw)).toISOString());
    }
    if (req.body?.internalNotes !== undefined) {
      const notes = String(req.body.internalNotes ?? "").trim().slice(0, 10_000);
      set("internal_notes", notes || null);
    }
    if (!updates.length) return res.status(400).json({ error: "no_updates" });
    values.push(req.params.id);
    try {
      const result = await pool.query(
        `UPDATE client_submissions s
            SET ${updates.join(", ")}, updated_at = NOW()
          WHERE ${ownerPredicate("s")} AND s.id = $${values.length}
          RETURNING s.*`,
        values,
      );
      if (!result.rows.length) return res.status(404).json({ error: "inquiry_not_found" });
      broadcastInquiryUpdated(session.userId, req.params.id, "updated");
      res.json({ inquiry: inquiryResponse(result.rows[0]) });
    } catch (error) {
      console.error("PATCH /api/inquiries/:id failed:", error);
      res.status(500).json({ error: "inquiry_update_failed" });
    }
  });

  app.get("/api/inquiries/:id/replies", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const result = await pool.query(
        `SELECT r.id, r.recipient_email AS "recipientEmail", r.subject, r.body,
                r.delivery_status AS "deliveryStatus", r.sent_at AS "sentAt",
                r.created_at AS "createdAt"
           FROM client_submission_replies r
           JOIN client_submissions s ON s.id = r.submission_id
          WHERE ${ownerPredicate("s")} AND s.id = $3
          ORDER BY r.created_at ASC`,
        [session.userId, session.email, req.params.id],
      );
      res.json({ replies: result.rows });
    } catch (error) {
      console.error("GET inquiry replies failed:", error);
      res.status(500).json({ error: "inquiry_replies_unavailable" });
    }
  });

  app.post("/api/inquiries/:id/reply", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    const body = String(req.body?.body || "").trim();
    if (!body || body.length > 20_000) return res.status(400).json({ error: "invalid_body" });
    try {
      const owned = await pool.query(
        `SELECT s.* FROM client_submissions s WHERE ${ownerPredicate("s")} AND s.id = $3 LIMIT 1`,
        [session.userId, session.email, req.params.id],
      );
      if (!owned.rows.length) return res.status(404).json({ error: "inquiry_not_found" });
      const inquiry = owned.rows[0];
      const recipient = String(inquiry.email || inquiry.client_email || "").trim();
      if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        return res.status(400).json({ error: "recipient_email_missing" });
      }
      const defaultSubject = `Re: ${inquiry.project_type ? `Forespørsel om ${inquiry.project_type}` : "Din forespørsel"}`;
      const subject = String(req.body?.subject || defaultSubject).trim().slice(0, 500) || defaultSubject;
      const pending = await pool.query(
        `INSERT INTO client_submission_replies
           (submission_id, owner_user_id, recipient_email, subject, body, delivery_status)
         VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
        [req.params.id, session.userId, recipient, subject, body],
      );
      const replyId = pending.rows[0]?.id;
      let delivery: Awaited<ReturnType<typeof sendTransactionalEmail>>;
      try {
        delivery = await sendTransactionalEmail({
          to: recipient,
          subject,
          text: body,
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;white-space:pre-wrap">${escH(body).replace(/\n/g, "<br>")}</div>`,
          replyTo: session.email,
          fromLabel: session.name || "CreatorHub",
          credentialScope: "creatorhub",
          kind: "inquiry_reply",
          sentByUserId: session.userId,
          pool,
        });
      } catch (error) {
        console.error("Inquiry email delivery threw:", error);
        await pool.query(
          `UPDATE client_submission_replies
              SET delivery_status = 'failed', error_code = 'provider_exception'
            WHERE id = $1 AND owner_user_id = $2`,
          [replyId, session.userId],
        ).catch(() => undefined);
        broadcastInquiryUpdated(session.userId, req.params.id, "updated");
        return res.status(502).json({ error: "email_delivery_failed", reason: "provider_exception" });
      }
      await pool.query(
        `UPDATE client_submission_replies
            SET delivery_status = $1, provider_message_id = $2, error_code = $3,
                sent_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE NULL END
          WHERE id = $4 AND owner_user_id = $5`,
        [delivery.sent ? "sent" : "failed", delivery.messageId, delivery.reason, replyId, session.userId],
      );
      if (!delivery.sent) {
        broadcastInquiryUpdated(session.userId, req.params.id, "updated");
        return res.status(502).json({ error: "email_delivery_failed", reason: delivery.reason });
      }
      const updated = await pool.query(
        `UPDATE client_submissions s
            SET status = CASE WHEN status = 'new' THEN 'replied' ELSE status END,
                is_read = TRUE, read_at = COALESCE(read_at, NOW()),
                replied_at = NOW(), last_contacted_at = NOW(), updated_at = NOW()
          WHERE ${ownerPredicate("s")} AND s.id = $3
          RETURNING s.*`,
        [session.userId, session.email, req.params.id],
      );
      recordAnalyticsEvent("submission.replied", {
        entityType: "submission",
        entityId: req.params.id,
        actorUserId: session.userId,
        metadata: { provider: delivery.provider },
      });
      broadcastInquiryUpdated(session.userId, req.params.id, "replied");
      res.json({ inquiry: inquiryResponse(updated.rows[0]), messageId: delivery.messageId });
    } catch (error) {
      console.error("POST inquiry reply failed:", error);
      res.status(500).json({ error: "inquiry_reply_failed" });
    }
  });

  app.post("/api/submissions/:id/mark-converted", async (req, res) => {
    // Auth + eier-scope: endepunktet hadde INGEN auth og oppdaterte
    // client_submissions/legacy.projects kun på id → enhver (også
    // uautentisert) kunne markere en vilkårlig forespørsel som konvertert
    // og injisere submissionId i et vilkårlig prosjekt (cross-tenant
    // write-IDOR). Samme kontrakt som søster-ruten /:id/status.
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { id } = req.params;
      const { projectId } = req.body ?? {};
      if (!projectId) {
        return res.status(400).json({ error: "project_id_required" });
      }
      const canonicalProject = await pool.query(
        `SELECT 1 FROM projects WHERE id::text = $1 AND user_id = $2 LIMIT 1`,
        [String(projectId), session.userId],
      ).catch(() => ({ rows: [] as any[] }));
      let ownsProject = canonicalProject.rows.length > 0;
      if (!ownsProject) {
        const legacyProject = await pool.query(
          `SELECT 1 FROM legacy.projects WHERE id::text = $1 AND user_id = $2 LIMIT 1`,
          [String(projectId), session.userId],
        ).catch(() => ({ rows: [] as any[] }));
        ownsProject = legacyProject.rows.length > 0;
      }
      if (!ownsProject) {
        return res.status(404).json({ error: "project_not_found" });
      }
      const result = await pool.query(
        `UPDATE client_submissions
         SET status = 'converted',
             project_id = $3,
             converted_at = COALESCE(converted_at, NOW()),
             is_read = TRUE,
             read_at = COALESCE(read_at, NOW()),
             internal_notes = COALESCE(internal_notes, '') || E'\nKonvertert til prosjekt: ' || $3,
             updated_at = NOW()
         WHERE id = $4 AND ${ownerPredicate()}
         RETURNING *`,
        [session.userId, session.email, projectId, id],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Forespørsel ikke funnet" });
      }
      const updated = mapSubmissionRow(result.rows[0]);
      try {
        await pool.query(
          `UPDATE legacy.projects
           SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('submissionId', $1::text),
               updated_at = NOW()
           WHERE id = $2 AND user_id = $3`,
          [String(id), String(projectId), session.userId],
        );
      } catch (linkErr) {
        console.warn(
          "[submission-mark-converted] project-side link failed:",
          linkErr,
        );
      }
      recordAnalyticsEvent("submission.converted", {
        entityType: "submission",
        entityId: String(id),
        actorUserId: session.userId,
        metadata: {
          projectId: String(projectId),
          clientEmail: (updated as Record<string, unknown>).email ?? null,
        },
      });
      broadcastInquiryUpdated(session.userId, String(id), "converted");
      res.json({ success: true, submission: updated });
    } catch (error) {
      console.error("Error marking submission converted:", error);
      res.status(500).json({ error: "Kunne ikke markere som konvertert" });
    }
  });

  app.put("/api/submissions/:id/status", async (req, res) => {
    const session = requireUserSession(req, res);
    if (!session) return;
    try {
      const { id } = req.params;
      const { status, internalNotes, followUpDate } = req.body;
      if (status && !INQUIRY_STATUSES.has(String(status).toLowerCase())) {
        return res.status(400).json({ error: "invalid_status" });
      }

      const result = await pool.query(
        `UPDATE client_submissions
         SET status = COALESCE($3, status),
             internal_notes = COALESCE($4, internal_notes),
             follow_up_date = COALESCE($5, follow_up_date),
             updated_at = NOW()
         WHERE id = $6 AND ${ownerPredicate()}
         RETURNING *`,
        [session.userId, session.email, status, internalNotes || null, followUpDate || null, id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Forespørsel ikke funnet" });
      }
      const updated = mapSubmissionRow(result.rows[0]);
      if (status) {
        recordAnalyticsEvent("submission.status_changed", {
          entityType: "submission",
          entityId: String(id),
          actorUserId: session.userId,
          metadata: {
            newStatus: status,
            clientEmail: (updated as Record<string, unknown>).email ?? null,
            projectType:
              (updated as Record<string, unknown>).projectType ?? null,
          },
        });
      }
      broadcastInquiryUpdated(session.userId, String(id), "updated");
      res.json({ success: true, submission: updated });
    } catch (error) {
      console.error("Error updating submission:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere forespørsel" });
    }
  });

  app.post(
    "/api/submissions/:submissionId/send-email",
    async (req, res) => {
      const session = requireUserSession(req, res);
      if (!session) return;
      try {
        const { submissionId } = req.params;
        const responseType = String(req.body?.responseType || "response");
        const estimatedPrice = Number(req.body?.estimatedPrice);
        const owned = await pool.query(
          `SELECT s.* FROM client_submissions s WHERE ${ownerPredicate("s")} AND s.id = $3 LIMIT 1`,
          [session.userId, session.email, submissionId],
        );
        if (!owned.rows.length) {
          return res.status(404).json({ error: "Forespørsel ikke funnet" });
        }
        const inquiry = owned.rows[0];
        const recipient = String(inquiry.email || "").trim();
        const body = String(req.body?.message || (
          responseType === "quote" && Number.isFinite(estimatedPrice)
            ? `Takk for forespørselen. Vårt foreløpige prisestimat er ${estimatedPrice.toLocaleString("nb-NO")} kr. Ta gjerne kontakt dersom du har spørsmål.`
            : "Takk for forespørselen. Vi har mottatt den og tar kontakt så snart som mulig."
        )).trim();
        const subject = String(req.body?.subject || `Re: ${inquiry.project_type ? `Forespørsel om ${inquiry.project_type}` : "Din forespørsel"}`).slice(0, 500);
        const delivery = await sendTransactionalEmail({
          to: recipient,
          subject,
          text: body,
          html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;white-space:pre-wrap">${escH(body).replace(/\n/g, "<br>")}</div>`,
          replyTo: session.email,
          fromLabel: session.name || "CreatorHub",
          credentialScope: "creatorhub",
          kind: "inquiry_reply",
          sentByUserId: session.userId,
          pool,
        });
        await pool.query(
          `INSERT INTO client_submission_replies
             (submission_id, owner_user_id, recipient_email, subject, body,
              delivery_status, provider_message_id, error_code, sent_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $6 = 'sent' THEN NOW() ELSE NULL END)`,
          [submissionId, session.userId, recipient, subject, body, delivery.sent ? "sent" : "failed", delivery.messageId, delivery.reason],
        );
        if (!delivery.sent) return res.status(502).json({ error: "email_delivery_failed", reason: delivery.reason });

        const result = await pool.query(
          `UPDATE client_submissions s
              SET last_contacted_at = NOW(), replied_at = NOW(), is_read = TRUE,
                  read_at = COALESCE(read_at, NOW()), updated_at = NOW(),
                  quote_sent = CASE WHEN $3 THEN TRUE ELSE quote_sent END,
                  quote_amount = CASE WHEN $3 AND $4::numeric IS NOT NULL THEN $4::numeric ELSE quote_amount END,
                  status = CASE WHEN $3 THEN 'quote_sent' ELSE 'replied' END
            WHERE ${ownerPredicate("s")} AND s.id = $5
            RETURNING s.*`,
          [session.userId, session.email, responseType === "quote", Number.isFinite(estimatedPrice) ? estimatedPrice : null, submissionId],
        );
        broadcastInquiryUpdated(session.userId, submissionId, "replied");
        res.json({
          success: true,
          message: "Svar sendt til kunden",
          submission: mapSubmissionRow(result.rows[0]),
        });
      } catch (error) {
        console.error("Error sending submission email:", error);
        res.status(500).json({ error: "Kunne ikke sende svar" });
      }
    },
  );
}
