import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";
import { readNumber } from "./_shared";
import { sendTransactionalEmail } from "./transactional-email-service";

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
  getUserIdFromAuth: (req: any) => string | null;
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
    getUserIdFromAuth,
    readString,
  } = deps;

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
    };
  }

  app.post("/api/submissions", async (req, res) => {
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

      const result = await pool.query(
        `INSERT INTO client_submissions
          (id, name, email, phone, company, project_type, event_date, location,
           budget, description, special_requests, contact_preference, timeframe,
           referral_source, vendor_id, vendor_email, priority, category,
           status, submission_type, data, submitted_at, created_at, updated_at)
         VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
                 'new','inquiry','{}',NOW(),NOW(),NOW())
         RETURNING *`,
        [
          name,
          email,
          phone || null,
          company || null,
          projectType || "wedding",
          eventDate || null,
          location || null,
          budget || null,
          description,
          specialRequests || null,
          contactPreference || "email",
          timeframe || null,
          referralSource || null,
          vendorId || null,
          vendorEmail || null,
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
        `📩 Ny forespørsel fra ${name} (${email}) → vendor ${vendorEmail || vendorId || "ukjent"}`,
      );

      recordAnalyticsEvent("submission.received", {
        entityType: "submission",
        entityId: String(submission.id),
        actorUserId: vendorId || null,
        metadata: {
          clientEmail: email,
          clientName: name,
          projectType: projectType || null,
          budget: budget || null,
          vendorEmail: vendorEmail || null,
          priority: priority || "medium",
        },
      });

      if (vendorId) {
        void (async () => {
          try {
            const { fireWorkflowTrigger } = await import(
              "./workflow-triggers.js"
            );
            await fireWorkflowTrigger({
              pool,
              eventType: "submission.received",
              userId: vendorId,
              payload: {
                submission_id: String(submission.id),
                project_type: projectType || null,
                budget: budget || null,
                priority: priority || "medium",
                client_email: email,
                client_name: name,
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
          let toEmail: string | null = (vendorEmail && String(vendorEmail).trim()) || null;
          if (!toEmail && vendorId) {
            const u = await pool.query(`SELECT email FROM users WHERE id = $1 LIMIT 1`, [vendorId]).catch(() => ({ rows: [] as any[] }));
            toEmail = u.rows[0]?.email || null;
          }
          if (!toEmail) return;
          const rows = [
            projectType ? ["Type", projectType] : null,
            eventDate ? ["Dato", eventDate] : null,
            (budget != null && budget !== "") ? ["Budsjett", `${budget}`] : null,
            location ? ["Sted", location] : null,
            phone ? ["Telefon", phone] : null,
          ].filter(Boolean) as [string, string][];
          const table = rows.map(([k, v]) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666">${escH(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600">${escH(v)}</td></tr>`).join("");
          const html = `<div style="font-family:-apple-system,sans-serif;max-width:540px;margin:0 auto;padding:24px"><h2 style="margin:0 0 12px;color:#1a1a1a">Ny forespørsel 🎉</h2><p style="font-size:15px;color:#333;line-height:1.6"><b>${escH(name)}</b> (${escH(email)}) har sendt deg en forespørsel.</p>${table ? `<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px">${table}</table>` : ""}${description ? `<blockquote style="border-left:3px solid #ff8c00;margin:12px 0;padding:8px 16px;color:#333">«${escH(description)}»</blockquote>` : ""}<div style="margin:20px 0"><a href="${APP_URL}" style="display:inline-block;background:#ff8c00;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">Se forespørselen</a></div><p style="font-size:12px;color:#999">Du finner den under «Forespørsler» i workspacet og «Kundeforespørsler» på dashbordet.</p></div>`;
          const text = `Ny forespørsel fra ${name} (${email}).` + rows.map(([k, v]) => ` ${k}: ${v}.`).join("") + (description ? ` «${description}»` : "") + ` Se den i CreatorHub: ${APP_URL}`;
          await sendTransactionalEmail({
            to: toEmail,
            subject: `Ny forespørsel fra ${name}${projectType ? " – " + projectType : ""}`,
            html, text, fromLabel: "CreatorHub", kind: "inquiry_received",
            projectId: null, pool,
          });
        } catch (e: any) { console.warn("[submission] vendor-notify failed:", e?.message); }
      })();

      res.status(201).json({
        success: true,
        submission,
        message: "Forespørselen din er sendt til leverandøren!",
      });
    } catch (error) {
      console.error(
        "Error creating submission, using compatibility store:",
        error,
      );
      const nowIso = new Date().toISOString();
      const fallbackSubmission = {
        id: crypto.randomUUID(),
        name: req.body?.name || "Unknown",
        email: req.body?.email || "",
        phone: req.body?.phone || null,
        company: req.body?.company || null,
        projectType: req.body?.projectType || "wedding",
        eventDate: req.body?.eventDate || null,
        location: req.body?.location || "",
        budget: readNumber(req.body?.budget),
        description: req.body?.description || "",
        specialRequests: req.body?.specialRequests || "",
        contactPreference: req.body?.contactPreference || "email",
        timeframe: req.body?.timeframe || "",
        referralSource: req.body?.referralSource || "",
        status: "new",
        priority: req.body?.priority || "medium",
        category: req.body?.category || "inquiry",
        submittedAt: nowIso,
        updatedAt: nowIso,
        vendorId: req.body?.vendorId || null,
        vendorEmail: req.body?.vendorEmail || null,
        quoteSent: false,
        quoteAmount: null,
        contractSent: false,
        depositReceived: false,
      };
      compatSubmissionsStore.set(
        String(fallbackSubmission.id),
        fallbackSubmission,
      );
      void compatStoreSet(
        dbCompatSubmissionKey(String(fallbackSubmission.id)),
        fallbackSubmission,
      );
      res.status(201).json({
        success: true,
        submission: fallbackSubmission,
        message: "Forespørselen din er sendt til leverandøren!",
        source: "compat-store",
      });
    }
  });

  app.get("/api/submissions", async (req, res) => {
    try {
      const profession =
        typeof req.query.profession === "string"
          ? req.query.profession
          : null;
      const vendorId =
        typeof req.query.vendorId === "string" ? req.query.vendorId : null;
      const vendorEmail =
        typeof req.query.vendorEmail === "string"
          ? req.query.vendorEmail
          : null;
      const status =
        typeof req.query.status === "string" ? req.query.status : null;

      let query = "SELECT * FROM client_submissions WHERE 1=1";
      const params: any[] = [];
      let paramIdx = 1;

      if (vendorId) {
        query += ` AND vendor_id = $${paramIdx++}`;
        params.push(vendorId);
      }
      if (vendorEmail) {
        query += ` AND vendor_email = $${paramIdx++}`;
        params.push(vendorEmail);
      }
      if (profession) {
        query += ` AND (project_type = $${paramIdx} OR submission_type = $${paramIdx++})`;
        params.push(profession);
      }
      if (status) {
        query += ` AND status = $${paramIdx++}`;
        params.push(status);
      }
      query += " ORDER BY submitted_at DESC";

      const result = await pool.query(query, params);
      const dbRows = result.rows.map(mapSubmissionRow);
      const compatRows = Array.from(
        compatSubmissionsStore.values(),
      ) as Array<Record<string, unknown>>;
      const merged = [...dbRows];
      for (const fallback of compatRows) {
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
      const profession =
        typeof req.query.profession === "string"
          ? req.query.profession
          : null;
      const vendorId =
        typeof req.query.vendorId === "string" ? req.query.vendorId : null;
      const vendorEmail =
        typeof req.query.vendorEmail === "string"
          ? req.query.vendorEmail
          : null;
      const status =
        typeof req.query.status === "string" ? req.query.status : null;
      const rows = (
        Array.from(compatSubmissionsStore.values()) as Array<
          Record<string, unknown>
        >
      ).filter((row) => {
        if (vendorId && String(row.vendorId || "") !== vendorId) return false;
        if (vendorEmail && String(row.vendorEmail || "") !== vendorEmail)
          return false;
        if (profession) {
          const projectType = String(
            row.projectType || row.submissionType || "",
          ).toLowerCase();
          if (projectType !== profession.toLowerCase()) return false;
        }
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
    try {
      const vendorId =
        typeof req.query.vendorId === "string" ? req.query.vendorId : null;
      const vendorEmail =
        typeof req.query.vendorEmail === "string"
          ? req.query.vendorEmail
          : null;

      let whereClause = "";
      const params: any[] = [];
      if (vendorId) {
        whereClause = " WHERE vendor_id = $1";
        params.push(vendorId);
      } else if (vendorEmail) {
        whereClause = " WHERE vendor_email = $1";
        params.push(vendorEmail);
      }

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
        FROM client_submissions${whereClause}
      `,
        params,
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

  app.post("/api/submissions/:id/mark-converted", async (req, res) => {
    try {
      const { id } = req.params;
      const { projectId } = req.body ?? {};
      if (!projectId) {
        return res.status(400).json({ error: "project_id_required" });
      }
      const result = await pool.query(
        `UPDATE client_submissions
         SET status = 'converted',
             internal_notes = COALESCE(internal_notes, '') || E'\nKonvertert til prosjekt: ' || $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [projectId, id],
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
           WHERE id = $2`,
          [String(id), String(projectId)],
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
        actorUserId: readString(getUserIdFromAuth(req)) ?? null,
        metadata: {
          projectId: String(projectId),
          clientEmail: (updated as Record<string, unknown>).email ?? null,
        },
      });
      res.json({ success: true, submission: updated });
    } catch (error) {
      console.error("Error marking submission converted:", error);
      res.status(500).json({ error: "Kunne ikke markere som konvertert" });
    }
  });

  app.put("/api/submissions/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, internalNotes, followUpDate } = req.body;

      const result = await pool.query(
        `UPDATE client_submissions
         SET status = COALESCE($1, status),
             internal_notes = COALESCE($2, internal_notes),
             follow_up_date = COALESCE($3, follow_up_date),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [status, internalNotes || null, followUpDate || null, id],
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Forespørsel ikke funnet" });
      }
      const updated = mapSubmissionRow(result.rows[0]);
      if (status) {
        recordAnalyticsEvent("submission.status_changed", {
          entityType: "submission",
          entityId: String(id),
          actorUserId: readString(getUserIdFromAuth(req)) ?? null,
          metadata: {
            newStatus: status,
            clientEmail: (updated as Record<string, unknown>).email ?? null,
            projectType:
              (updated as Record<string, unknown>).projectType ?? null,
          },
        });
      }
      res.json({ success: true, submission: updated });
    } catch (error) {
      console.error("Error updating submission:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere forespørsel" });
    }
  });

  app.post(
    "/api/submissions/:submissionId/send-email",
    async (req, res) => {
      try {
        const { submissionId } = req.params;
        const { responseType, estimatedPrice } = req.body;

        const updates: string[] = [
          "last_contacted_at = NOW()",
          "updated_at = NOW()",
        ];
        if (responseType === "quote") {
          updates.push("quote_sent = true");
          if (estimatedPrice)
            updates.push(`quote_amount = ${parseFloat(estimatedPrice)}`);
          updates.push("status = 'quote_sent'");
        } else {
          updates.push("status = 'contacted'");
        }

        const result = await pool.query(
          `UPDATE client_submissions SET ${updates.join(", ")} WHERE id = $1 RETURNING *`,
          [submissionId],
        );

        if (result.rowCount === 0) {
          return res.status(404).json({ error: "Forespørsel ikke funnet" });
        }

        console.log(
          `📧 Svar sendt til ${result.rows[0].email} (${responseType})`,
        );
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
