/**
 * nextrole-milestones.ts
 *
 * Milepæler (deadlines) per jobbsøknad. En søknad har typisk:
 *   • application_deadline  — søknadsfristen i annonsen
 *   • case_deadline         — frist for å levere take-home case
 *   • interview             — selve intervju-datoen (HR / fag / leder)
 *   • expected_response     — når arbeidsgiver lovet å svare
 *   • custom                — fri-tekst brukeren legger til selv
 *
 * Endepunkter:
 *   GET    /api/job-applications/:applicationId/milestones
 *   POST   /api/job-applications/:applicationId/milestones
 *   PATCH  /api/job-application-milestones/:id
 *   DELETE /api/job-application-milestones/:id
 *
 *   GET    /api/job-application-milestones/upcoming
 *     Kronologisk feed for "Mine deadlines"-widget.
 *
 *   GET    /api/job-application-milestones/calendar.ics?token=...
 *     iCal-feed brukeren kan abonnere på fra Google/Apple Calendar.
 */

import { createHash } from "crypto";
import type express from "express";
import type { Pool } from "pg";

export interface NextRoleMilestonesDeps {
  app: express.Application;
  pool: Pool;
  getActiveSessionFromRequest: (
    req: express.Request,
  ) => { userId: string } | null;
}

const VALID_KINDS = [
  "application_deadline",
  "case_deadline",
  "interview",
  "expected_response",
  "custom",
] as const;
type MilestoneKind = (typeof VALID_KINDS)[number];

interface MilestoneRow {
  id: string;
  application_id: string;
  user_id: string;
  kind: MilestoneKind;
  title: string;
  due_at: Date;
  reminder_at: Date[] | null;
  reminders_sent: Date[] | null;
  completed_at: Date | null;
  notes: string | null;
  artifact_url: string | null;
  created_at: Date;
  updated_at: Date;
}

function toApi(row: MilestoneRow) {
  return {
    id: row.id,
    applicationId: row.application_id,
    kind: row.kind,
    title: row.title,
    dueAt: row.due_at.toISOString(),
    reminderAt: (row.reminder_at ?? []).map((d) => d.toISOString()),
    remindersSent: (row.reminders_sent ?? []).map((d) => d.toISOString()),
    completedAt: row.completed_at?.toISOString() ?? null,
    notes: row.notes,
    artifactUrl: row.artifact_url,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function isMilestoneKind(s: unknown): s is MilestoneKind {
  return typeof s === "string" && (VALID_KINDS as readonly string[]).includes(s);
}

/**
 * Default-påminnelser: 48 t / 24 t / 2 t før due. Brukeren kan
 * overstyre via reminderAt-feltet i POST/PATCH.
 */
function defaultReminders(dueAt: Date): Date[] {
  const reminders: Date[] = [];
  for (const hoursBefore of [48, 24, 2]) {
    const t = new Date(dueAt.getTime() - hoursBefore * 60 * 60 * 1000);
    if (t.getTime() > Date.now()) reminders.push(t);
  }
  return reminders;
}

// ── iCal-token (deterministisk per user) ────────────────────────────
function deriveCalendarToken(userId: string): string {
  const salt = process.env.NEXTROLE_CRON_SECRET ?? "nextrole-ics-fallback";
  return createHash("sha256")
    .update(`nextrole-ics:${userId}:${salt}`)
    .digest("hex")
    .slice(0, 32);
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatIcsDate(d: Date): string {
  // ICS format: 20260520T143000Z (UTC)
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// ── Routes ──────────────────────────────────────────────────────────

export function setupNextRoleMilestonesRoutes(
  deps: NextRoleMilestonesDeps,
): void {
  const { app, pool, getActiveSessionFromRequest } = deps;

  const requireSession = (req: express.Request, res: express.Response) => {
    const session = getActiveSessionFromRequest(req);
    if (!session?.userId) {
      res.status(401).json({ error: "auth_required" });
      return null;
    }
    return session;
  };

  // GET — milepæler for én søknad
  app.get(
    "/api/job-applications/:applicationId/milestones",
    async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;
      const applicationId = String(req.params.applicationId);

      const own = await pool.query<{ id: string }>(
        `SELECT id FROM job_applications WHERE id = $1 AND user_id = $2`,
        [applicationId, session.userId],
      );
      if (!own.rowCount) {
        res.status(404).json({ error: "application_not_found" });
        return;
      }

      const r = await pool.query<MilestoneRow>(
        `SELECT * FROM job_application_milestones
          WHERE application_id = $1
          ORDER BY due_at ASC`,
        [applicationId],
      );
      res.json({ milestones: r.rows.map(toApi) });
    },
  );

  // POST — opprett milepæl
  app.post(
    "/api/job-applications/:applicationId/milestones",
    async (req, res) => {
      const session = requireSession(req, res);
      if (!session) return;
      const applicationId = String(req.params.applicationId);
      const body = (req.body ?? {}) as Record<string, unknown>;

      const own = await pool.query<{ id: string }>(
        `SELECT id FROM job_applications WHERE id = $1 AND user_id = $2`,
        [applicationId, session.userId],
      );
      if (!own.rowCount) {
        res.status(404).json({ error: "application_not_found" });
        return;
      }

      const kind = body.kind;
      const title = String(body.title ?? "").trim();
      const dueAtRaw = String(body.dueAt ?? "");
      if (!isMilestoneKind(kind) || !title || !dueAtRaw) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }
      const dueAt = new Date(dueAtRaw);
      if (Number.isNaN(dueAt.getTime())) {
        res.status(400).json({ error: "invalid_due_at" });
        return;
      }
      const reminders = Array.isArray(body.reminderAt)
        ? (body.reminderAt as unknown[])
            .map((v) => new Date(String(v)))
            .filter((d) => !Number.isNaN(d.getTime()))
        : defaultReminders(dueAt);

      try {
        const r = await pool.query<MilestoneRow>(
          `INSERT INTO job_application_milestones (
             application_id, user_id, kind, title, due_at,
             reminder_at, notes, artifact_url
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            applicationId,
            session.userId,
            kind,
            title,
            dueAt,
            reminders.length ? reminders : null,
            body.notes ? String(body.notes) : null,
            body.artifactUrl ? String(body.artifactUrl) : null,
          ],
        );
        res.status(201).json({ milestone: toApi(r.rows[0]) });
      } catch (err) {
        console.error("[nextrole-milestones] create failed", err);
        res.status(500).json({ error: "internal_error" });
      }
    },
  );

  // PATCH — oppdater
  app.patch("/api/job-application-milestones/:id", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const id = String(req.params.id);
    const body = (req.body ?? {}) as Record<string, unknown>;

    // Bygg dynamisk SET-uttrykk
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (typeof body.title === "string") {
      sets.push(`title = $${i++}`);
      vals.push(body.title.trim());
    }
    if (typeof body.dueAt === "string") {
      const d = new Date(body.dueAt);
      if (Number.isNaN(d.getTime())) {
        res.status(400).json({ error: "invalid_due_at" });
        return;
      }
      sets.push(`due_at = $${i++}`);
      vals.push(d);
    }
    if (typeof body.notes === "string" || body.notes === null) {
      sets.push(`notes = $${i++}`);
      vals.push(body.notes);
    }
    if (typeof body.artifactUrl === "string" || body.artifactUrl === null) {
      sets.push(`artifact_url = $${i++}`);
      vals.push(body.artifactUrl);
    }
    if (body.completed === true) {
      sets.push(`completed_at = NOW()`);
    } else if (body.completed === false) {
      sets.push(`completed_at = NULL`);
    }
    if (Array.isArray(body.reminderAt)) {
      const parsed = (body.reminderAt as unknown[])
        .map((v) => new Date(String(v)))
        .filter((d) => !Number.isNaN(d.getTime()));
      sets.push(`reminder_at = $${i++}`);
      vals.push(parsed.length ? parsed : null);
    }
    if (isMilestoneKind(body.kind)) {
      sets.push(`kind = $${i++}`);
      vals.push(body.kind);
    }
    if (!sets.length) {
      res.status(400).json({ error: "no_fields" });
      return;
    }
    sets.push(`updated_at = NOW()`);
    vals.push(id, session.userId);

    const sql = `UPDATE job_application_milestones
                    SET ${sets.join(", ")}
                  WHERE id = $${i++} AND user_id = $${i}
                  RETURNING *`;
    try {
      const r = await pool.query<MilestoneRow>(sql, vals);
      if (!r.rowCount) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ milestone: toApi(r.rows[0]) });
    } catch (err) {
      console.error("[nextrole-milestones] patch failed", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // DELETE
  app.delete("/api/job-application-milestones/:id", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const r = await pool.query(
      `DELETE FROM job_application_milestones
        WHERE id = $1 AND user_id = $2`,
      [String(req.params.id), session.userId],
    );
    if (!r.rowCount) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ deleted: true });
  });

  // GET upcoming — for "Mine deadlines"-widget
  app.get("/api/job-application-milestones/upcoming", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const days = Math.min(Math.max(Number(req.query.days ?? 14), 1), 90);
    const r = await pool.query<
      MilestoneRow & { job_title: string; company: string }
    >(
      `SELECT m.*, a.job_title, a.company
         FROM job_application_milestones m
         JOIN job_applications a ON a.id = m.application_id
        WHERE m.user_id = $1
          AND m.completed_at IS NULL
          AND m.due_at BETWEEN NOW() - INTERVAL '6 hours'
                          AND NOW() + INTERVAL '${days} days'
        ORDER BY m.due_at ASC
        LIMIT 50`,
      [session.userId],
    );
    res.json({
      milestones: r.rows.map((row) => ({
        ...toApi(row),
        jobTitle: row.job_title,
        company: row.company,
      })),
    });
  });

  // GET min iCal-feed-info
  app.get("/api/job-application-milestones/calendar-info", async (req, res) => {
    const session = requireSession(req, res);
    if (!session) return;
    const token = deriveCalendarToken(session.userId);
    const baseUrl = (
      process.env.CREATORHUB_PUBLIC_URL ?? "https://app.creatorhubn.com"
    ).replace(/\/$/, "");
    res.json({
      icsUrl: `${baseUrl}/api/job-application-milestones/calendar.ics?token=${token}&u=${session.userId}`,
      webcalUrl: `webcal://${baseUrl.replace(/^https?:\/\//, "")}/api/job-application-milestones/calendar.ics?token=${token}&u=${session.userId}`,
    });
  });

  // GET .ics-feed — token-autentisering så Google/Apple Calendar kan polle
  app.get("/api/job-application-milestones/calendar.ics", async (req, res) => {
    const userId = String(req.query.u ?? "");
    const token = String(req.query.token ?? "");
    if (!userId || token !== deriveCalendarToken(userId)) {
      res.status(401).type("text/plain").send("invalid_token");
      return;
    }

    const r = await pool.query<
      MilestoneRow & { job_title: string; company: string }
    >(
      `SELECT m.*, a.job_title, a.company
         FROM job_application_milestones m
         JOIN job_applications a ON a.id = m.application_id
        WHERE m.user_id = $1
          AND m.due_at > NOW() - INTERVAL '60 days'
        ORDER BY m.due_at ASC`,
      [userId],
    );

    const now = new Date();
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//NextRole//Deadlines//NO",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:NextRole — Jobbsøknads-deadlines",
      "X-WR-TIMEZONE:Europe/Oslo",
    ];
    for (const row of r.rows) {
      const start = row.due_at;
      const end = new Date(start.getTime() + 60 * 60 * 1000); // 1t default
      const summary = `${row.title} — ${row.company}`;
      const desc = [
        `Stilling: ${row.job_title}`,
        row.notes ? `Notater: ${row.notes}` : "",
        row.artifact_url ? `Lenke: ${row.artifact_url}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${row.id}@nextrole`,
        `DTSTAMP:${formatIcsDate(now)}`,
        `DTSTART:${formatIcsDate(start)}`,
        `DTEND:${formatIcsDate(end)}`,
        `SUMMARY:${escapeIcs(summary)}`,
        `DESCRIPTION:${escapeIcs(desc)}`,
        `STATUS:${row.completed_at ? "COMPLETED" : "CONFIRMED"}`,
        "BEGIN:VALARM",
        "TRIGGER:-PT24H",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeIcs("Påminnelse: " + summary)}`,
        "END:VALARM",
        "END:VEVENT",
      );
    }
    lines.push("END:VCALENDAR");

    res
      .status(200)
      .type("text/calendar; charset=utf-8")
      .header(
        "Content-Disposition",
        'inline; filename="nextrole-deadlines.ics"',
      )
      .header("Cache-Control", "no-store")
      .send(lines.join("\r\n"));
  });
}
