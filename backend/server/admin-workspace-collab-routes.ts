/**
 * admin-workspace-collab-routes.ts
 *
 * De to AdminWorkspace-flatene som manglet datamodell helt, pluss
 * kundeprosjekt-aggregatet:
 *
 *   Teamchat (migrasjon 0350):
 *     GET    /api/admin-room/workspace/channels
 *     POST   /api/admin-room/workspace/channels
 *     GET    /api/admin-room/workspace/channels/:id/messages
 *     POST   /api/admin-room/workspace/channels/:id/messages
 *     DELETE /api/admin-room/workspace/messages/:id
 *
 *   HR / team (migrasjon 0350):
 *     GET    /api/admin-room/workspace/team
 *     POST   /api/admin-room/workspace/team
 *     PATCH  /api/admin-room/workspace/team/:id
 *     DELETE /api/admin-room/workspace/team/:id
 *     POST   /api/admin-room/workspace/team/:id/absences
 *     DELETE /api/admin-room/workspace/absences/:id
 *
 *   Kundeprosjekt (aggregat over eksisterende tabeller):
 *     GET    /api/admin-room/workspace/client-projects
 *
 * Alt er scoped på innlogget eier (requireAdminRoomAccess), på samme
 * mønster som cases-rutene.
 */

import type { AdminRoomRoutesDeps } from "./_shared";

const ENGAGEMENT_TYPES = new Set([
  "employee",
  "freelancer",
  "contractor",
  "advisor",
  "intern",
]);
const MEMBER_STATUSES = new Set(["active", "onboarding", "paused", "ended"]);
const ABSENCE_TYPES = new Set(["vacation", "sick", "parental", "unavailable", "other"]);
const PRODUCT_KEYS = new Set(["role_room", "leadgrid"]);

function normalizeProductKey(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (v === "roleroom") return "role_room";
  return PRODUCT_KEYS.has(v) ? v : null;
}

function asTrimmed(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  return v.slice(0, max);
}

function asDateOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export function setupAdminWorkspaceCollabRoutes(
  deps: Pick<
    AdminRoomRoutesDeps,
    "app" | "pool" | "requireAdminRoomAccess" | "logAdminActivity"
  >,
): void {
  const { app, pool, requireAdminRoomAccess, logAdminActivity } = deps;

  // ══════════════════════════════════════════════════════════════
  // Teamchat
  // ══════════════════════════════════════════════════════════════

  /**
   * Sørger for at eieren alltid har en «Generelt»-kanal. Kjøres ved
   * listing slik at flaten aldri møter deg med null kanaler og et
   * tomt tekstfelt — det var nettopp den tilstanden som gjorde det
   * gamle panelet ubrukelig.
   */
  async function ensureDefaultChannel(userId: string): Promise<void> {
    await pool.query(
      `INSERT INTO admin_workspace_channels (user_id, channel_key, name, description)
       VALUES ($1, 'general', 'Generelt', 'Workspace-bred kanal på tvers av produkter')
       ON CONFLICT (user_id, channel_key) WHERE channel_key IS NOT NULL
       DO NOTHING`,
      [userId],
    );
  }

  app.get("/api/admin-room/workspace/channels", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    try {
      await ensureDefaultChannel(session.userId);
      const r = await pool.query(
        `SELECT c.id::text        AS id,
                c.channel_key     AS channel_key,
                c.name            AS name,
                c.description     AS description,
                c.product_key     AS product_key,
                c.created_at      AS created_at,
                (SELECT COUNT(*) FROM admin_workspace_messages m
                  WHERE m.channel_id = c.id AND m.deleted_at IS NULL)   AS message_count,
                (SELECT MAX(m.created_at) FROM admin_workspace_messages m
                  WHERE m.channel_id = c.id AND m.deleted_at IS NULL)   AS last_message_at
           FROM admin_workspace_channels c
          WHERE c.user_id = $1
            AND c.is_archived = FALSE
          ORDER BY (c.channel_key = 'general') DESC, c.created_at ASC`,
        [session.userId],
      );
      res.json({
        items: r.rows.map((row) => ({
          id: row.id,
          channelKey: row.channel_key,
          name: row.name,
          description: row.description,
          productKey: row.product_key,
          createdAt: row.created_at,
          messageCount: Number(row.message_count ?? 0),
          lastMessageAt: row.last_message_at,
        })),
      });
    } catch (err) {
      console.error("[workspace/channels] error", err);
      res.status(500).json({ error: "Kunne ikke hente kanaler" });
    }
  });

  app.post("/api/admin-room/workspace/channels", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const name = asTrimmed(req.body?.name, 120);
    if (!name) {
      res.status(400).json({ error: "Kanalen må ha et navn" });
      return;
    }

    try {
      const r = await pool.query(
        `INSERT INTO admin_workspace_channels (user_id, name, description, product_key)
         VALUES ($1, $2, $3, $4)
         RETURNING id::text AS id, channel_key, name, description, product_key, created_at`,
        [
          session.userId,
          name,
          asTrimmed(req.body?.description, 500),
          normalizeProductKey(req.body?.productKey),
        ],
      );
      const row = r.rows[0];
      res.status(201).json({
        item: {
          id: row.id,
          channelKey: row.channel_key,
          name: row.name,
          description: row.description,
          productKey: row.product_key,
          createdAt: row.created_at,
          messageCount: 0,
          lastMessageAt: null,
        },
      });
    } catch (err) {
      console.error("[workspace/channels POST] error", err);
      res.status(500).json({ error: "Kunne ikke opprette kanalen" });
    }
  });

  app.get("/api/admin-room/workspace/channels/:id/messages", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const limitRaw = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 200
      ? Math.round(limitRaw)
      : 100;

    try {
      // Join mot kanalen sikrer at du bare leser dine egne kanaler.
      const r = await pool.query(
        `SELECT m.id::text     AS id,
                m.user_id      AS user_id,
                m.author_name  AS author_name,
                m.body         AS body,
                m.created_at   AS created_at,
                m.edited_at    AS edited_at
           FROM admin_workspace_messages m
           JOIN admin_workspace_channels c ON c.id = m.channel_id
          WHERE m.channel_id = $1
            AND c.user_id = $2
            AND m.deleted_at IS NULL
          ORDER BY m.created_at DESC
          LIMIT $3`,
        [req.params.id, session.userId, limit],
      );
      // Eldste først i UI — snu her så klienten slipper.
      res.json({
        items: r.rows.reverse().map((row) => ({
          id: row.id,
          userId: row.user_id,
          authorName: row.author_name,
          body: row.body,
          createdAt: row.created_at,
          editedAt: row.edited_at,
          isMine: row.user_id === session.userId,
        })),
      });
    } catch (err) {
      console.error("[workspace/messages GET] error", err);
      res.status(500).json({ error: "Kunne ikke hente meldinger" });
    }
  });

  app.post("/api/admin-room/workspace/channels/:id/messages", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!body) {
      res.status(400).json({ error: "Meldingen kan ikke være tom" });
      return;
    }
    if (body.length > 8000) {
      res.status(400).json({ error: "Meldingen er for lang (maks 8000 tegn)" });
      return;
    }

    try {
      const owns = await pool.query(
        `SELECT 1 FROM admin_workspace_channels WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [req.params.id, session.userId],
      );
      if (owns.rowCount === 0) {
        res.status(404).json({ error: "Kanalen finnes ikke" });
        return;
      }

      const r = await pool.query(
        `INSERT INTO admin_workspace_messages (channel_id, user_id, author_name, body)
         VALUES ($1, $2, $3, $4)
         RETURNING id::text AS id, user_id, author_name, body, created_at, edited_at`,
        [req.params.id, session.userId, session.email ?? null, body],
      );
      const row = r.rows[0];
      res.status(201).json({
        item: {
          id: row.id,
          userId: row.user_id,
          authorName: row.author_name,
          body: row.body,
          createdAt: row.created_at,
          editedAt: row.edited_at,
          isMine: true,
        },
      });
    } catch (err) {
      console.error("[workspace/messages POST] error", err);
      res.status(500).json({ error: "Kunne ikke sende meldingen" });
    }
  });

  app.delete("/api/admin-room/workspace/messages/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    try {
      const r = await pool.query(
        `UPDATE admin_workspace_messages m
            SET deleted_at = NOW()
           FROM admin_workspace_channels c
          WHERE m.channel_id = c.id
            AND m.id = $1
            AND c.user_id = $2
            AND m.deleted_at IS NULL
          RETURNING m.id`,
        [req.params.id, session.userId],
      );
      if (r.rowCount === 0) {
        res.status(404).json({ error: "Meldingen finnes ikke" });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      console.error("[workspace/messages DELETE] error", err);
      res.status(500).json({ error: "Kunne ikke slette meldingen" });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // HR / team
  // ══════════════════════════════════════════════════════════════

  app.get("/api/admin-room/workspace/team", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const product = normalizeProductKey(req.query.product);

    try {
      const params: unknown[] = [session.userId];
      let where = "owner_user_id = $1";
      if (product) {
        params.push(product);
        // Medlemmer uten produkt jobber på tvers — de skal alltid med.
        where += ` AND (product_key = $${params.length} OR product_key IS NULL)`;
      }

      const members = await pool.query(
        `SELECT id::text AS id, member_user_id, full_name, email, role_title,
                engagement_type, product_key, status, started_on, ended_on,
                hourly_rate, currency, notes, created_at, updated_at
           FROM admin_workspace_team_members
          WHERE ${where}
          ORDER BY (status = 'active') DESC, full_name ASC`,
        params,
      );

      const ids = members.rows.map((m) => m.id);
      const absencesByMember = new Map<string, unknown[]>();
      if (ids.length > 0) {
        const abs = await pool.query(
          `SELECT id::text AS id, member_id::text AS member_id, absence_type,
                  start_date, end_date, note
             FROM admin_workspace_team_absences
            WHERE member_id = ANY($1::uuid[])
              AND end_date >= (CURRENT_DATE - INTERVAL '180 days')
            ORDER BY start_date DESC`,
          [ids],
        );
        for (const row of abs.rows) {
          const list = absencesByMember.get(row.member_id) ?? [];
          list.push({
            id: row.id,
            absenceType: row.absence_type,
            startDate: row.start_date,
            endDate: row.end_date,
            note: row.note,
          });
          absencesByMember.set(row.member_id, list);
        }
      }

      res.json({
        items: members.rows.map((m) => ({
          id: m.id,
          memberUserId: m.member_user_id,
          fullName: m.full_name,
          email: m.email,
          roleTitle: m.role_title,
          engagementType: m.engagement_type,
          productKey: m.product_key,
          status: m.status,
          startedOn: m.started_on,
          endedOn: m.ended_on,
          hourlyRate: m.hourly_rate === null ? null : Number(m.hourly_rate),
          currency: m.currency,
          notes: m.notes,
          absences: absencesByMember.get(m.id) ?? [],
        })),
      });
    } catch (err) {
      console.error("[workspace/team GET] error", err);
      res.status(500).json({ error: "Kunne ikke hente teamet" });
    }
  });

  app.post("/api/admin-room/workspace/team", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const fullName = asTrimmed(req.body?.fullName, 160);
    if (!fullName) {
      res.status(400).json({ error: "Navn er påkrevd" });
      return;
    }

    const engagementType = typeof req.body?.engagementType === "string"
      && ENGAGEMENT_TYPES.has(req.body.engagementType)
      ? req.body.engagementType
      : "freelancer";
    const status = typeof req.body?.status === "string" && MEMBER_STATUSES.has(req.body.status)
      ? req.body.status
      : "active";

    try {
      const r = await pool.query(
        `INSERT INTO admin_workspace_team_members
           (owner_user_id, member_user_id, full_name, email, role_title,
            engagement_type, product_key, status, started_on, ended_on,
            hourly_rate, currency, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id::text AS id`,
        [
          session.userId,
          asTrimmed(req.body?.memberUserId, 255),
          fullName,
          asTrimmed(req.body?.email, 255),
          asTrimmed(req.body?.roleTitle, 120),
          engagementType,
          normalizeProductKey(req.body?.productKey),
          status,
          asDateOrNull(req.body?.startedOn),
          asDateOrNull(req.body?.endedOn),
          req.body?.hourlyRate === null || req.body?.hourlyRate === undefined
            ? null
            : Number(req.body.hourlyRate),
          asTrimmed(req.body?.currency, 10) ?? "NOK",
          asTrimmed(req.body?.notes, 4000),
        ],
      );

      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_team_member",
        entityId: r.rows[0].id,
        action: "created",
        summary: `Team-medlem lagt til: ${fullName}`,
      });

      res.status(201).json({ id: r.rows[0].id });
    } catch (err) {
      console.error("[workspace/team POST] error", err);
      res.status(500).json({ error: "Kunne ikke legge til medlemmet" });
    }
  });

  app.patch("/api/admin-room/workspace/team/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const sets: string[] = [];
    const params: unknown[] = [];
    const push = (column: string, value: unknown): void => {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    };

    if (req.body?.fullName !== undefined) {
      const v = asTrimmed(req.body.fullName, 160);
      if (!v) {
        res.status(400).json({ error: "Navn kan ikke være tomt" });
        return;
      }
      push("full_name", v);
    }
    if (req.body?.email !== undefined) push("email", asTrimmed(req.body.email, 255));
    if (req.body?.roleTitle !== undefined) push("role_title", asTrimmed(req.body.roleTitle, 120));
    if (req.body?.notes !== undefined) push("notes", asTrimmed(req.body.notes, 4000));
    if (req.body?.startedOn !== undefined) push("started_on", asDateOrNull(req.body.startedOn));
    if (req.body?.endedOn !== undefined) push("ended_on", asDateOrNull(req.body.endedOn));
    if (req.body?.productKey !== undefined) {
      push("product_key", normalizeProductKey(req.body.productKey));
    }
    if (req.body?.hourlyRate !== undefined) {
      push(
        "hourly_rate",
        req.body.hourlyRate === null ? null : Number(req.body.hourlyRate),
      );
    }
    if (typeof req.body?.engagementType === "string" && ENGAGEMENT_TYPES.has(req.body.engagementType)) {
      push("engagement_type", req.body.engagementType);
    }
    if (typeof req.body?.status === "string" && MEMBER_STATUSES.has(req.body.status)) {
      push("status", req.body.status);
    }

    if (sets.length === 0) {
      res.status(400).json({ error: "Ingen felter å oppdatere" });
      return;
    }

    params.push(req.params.id, session.userId);

    try {
      const r = await pool.query(
        `UPDATE admin_workspace_team_members
            SET ${sets.join(", ")}, updated_at = NOW()
          WHERE id = $${params.length - 1} AND owner_user_id = $${params.length}
          RETURNING id::text AS id, full_name`,
        params,
      );
      if (r.rowCount === 0) {
        res.status(404).json({ error: "Medlemmet finnes ikke" });
        return;
      }

      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_team_member",
        entityId: r.rows[0].id,
        action: "updated",
        summary: `Team-medlem oppdatert: ${r.rows[0].full_name}`,
      });

      res.json({ success: true });
    } catch (err) {
      console.error("[workspace/team PATCH] error", err);
      res.status(500).json({ error: "Kunne ikke oppdatere medlemmet" });
    }
  });

  app.delete("/api/admin-room/workspace/team/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    try {
      const r = await pool.query(
        `DELETE FROM admin_workspace_team_members
          WHERE id = $1 AND owner_user_id = $2
          RETURNING id::text AS id, full_name`,
        [req.params.id, session.userId],
      );
      if (r.rowCount === 0) {
        res.status(404).json({ error: "Medlemmet finnes ikke" });
        return;
      }

      await logAdminActivity({
        userId: session.userId,
        entityType: "workspace_team_member",
        entityId: r.rows[0].id,
        action: "deleted",
        summary: `Team-medlem fjernet: ${r.rows[0].full_name}`,
      });

      res.json({ success: true });
    } catch (err) {
      console.error("[workspace/team DELETE] error", err);
      res.status(500).json({ error: "Kunne ikke fjerne medlemmet" });
    }
  });

  app.post("/api/admin-room/workspace/team/:id/absences", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    const startDate = asDateOrNull(req.body?.startDate);
    const endDate = asDateOrNull(req.body?.endDate);
    if (!startDate || !endDate) {
      res.status(400).json({ error: "Fra- og til-dato er påkrevd" });
      return;
    }
    if (endDate < startDate) {
      res.status(400).json({ error: "Til-dato kan ikke være før fra-dato" });
      return;
    }

    const absenceType = typeof req.body?.absenceType === "string"
      && ABSENCE_TYPES.has(req.body.absenceType)
      ? req.body.absenceType
      : "vacation";

    try {
      const owns = await pool.query(
        `SELECT 1 FROM admin_workspace_team_members
          WHERE id = $1 AND owner_user_id = $2 LIMIT 1`,
        [req.params.id, session.userId],
      );
      if (owns.rowCount === 0) {
        res.status(404).json({ error: "Medlemmet finnes ikke" });
        return;
      }

      const r = await pool.query(
        `INSERT INTO admin_workspace_team_absences
           (member_id, absence_type, start_date, end_date, note)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id::text AS id, absence_type, start_date, end_date, note`,
        [req.params.id, absenceType, startDate, endDate, asTrimmed(req.body?.note, 400)],
      );
      const row = r.rows[0];
      res.status(201).json({
        item: {
          id: row.id,
          absenceType: row.absence_type,
          startDate: row.start_date,
          endDate: row.end_date,
          note: row.note,
        },
      });
    } catch (err) {
      console.error("[workspace/absences POST] error", err);
      res.status(500).json({ error: "Kunne ikke registrere fraværet" });
    }
  });

  app.delete("/api/admin-room/workspace/absences/:id", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    try {
      const r = await pool.query(
        `DELETE FROM admin_workspace_team_absences a
          USING admin_workspace_team_members m
          WHERE a.member_id = m.id
            AND a.id = $1
            AND m.owner_user_id = $2
          RETURNING a.id`,
        [req.params.id, session.userId],
      );
      if (r.rowCount === 0) {
        res.status(404).json({ error: "Fraværet finnes ikke" });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      console.error("[workspace/absences DELETE] error", err);
      res.status(500).json({ error: "Kunne ikke slette fraværet" });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // Kundeprosjekt
  // ══════════════════════════════════════════════════════════════
  // Teamspace-flaten for klientarbeid: prosjekter du eier, med det som
  // faktisk krever handling fra deg — åpne klient-forespørsler,
  // ubesvarte reviews og leveranser som venter på klient.
  app.get("/api/admin-room/workspace/client-projects", async (req, res) => {
    const session = requireAdminRoomAccess(req, res);
    if (!session) return;

    try {
      const projects = await pool.query(
        `SELECT p.id::text     AS id,
                p.name         AS name,
                p.status       AS status,
                p.start_date   AS start_date,
                p.end_date     AS end_date,
                p.updated_at   AS updated_at
           FROM casting_projects p
          WHERE p.created_by = $1
          ORDER BY p.updated_at DESC NULLS LAST
          LIMIT 100`,
        [session.userId],
      );

      const ids = projects.rows.map((p) => p.id);
      const openRequests = new Map<string, number>();
      const clientReviewDeliverables = new Map<string, number>();

      if (ids.length > 0) {
        try {
          const reqs = await pool.query(
            `SELECT project_id::text AS project_id, COUNT(*)::int AS count
               FROM role_room_client_requests
              WHERE project_id = ANY($1::text[])
                AND status = 'pending'
              GROUP BY project_id`,
            [ids],
          );
          for (const row of reqs.rows) openRequests.set(row.project_id, row.count);
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code !== "42P01") throw err;
        }

        try {
          const dels = await pool.query(
            `SELECT project_id::text AS project_id, COUNT(*)::int AS count
               FROM role_room_deliverables
              WHERE project_id = ANY($1::text[])
                AND status = 'client_review'
              GROUP BY project_id`,
            [ids],
          );
          for (const row of dels.rows) clientReviewDeliverables.set(row.project_id, row.count);
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code !== "42P01") throw err;
        }
      }

      res.json({
        items: projects.rows.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status ?? "active",
          startDate: p.start_date,
          endDate: p.end_date,
          updatedAt: p.updated_at,
          openClientRequests: openRequests.get(p.id) ?? 0,
          awaitingClientReview: clientReviewDeliverables.get(p.id) ?? 0,
          linkPath: `/role-room/project/${p.id}`,
        })),
      });
    } catch (err) {
      console.error("[workspace/client-projects] error", err);
      res.status(500).json({ error: "Kunne ikke hente kundeprosjekter" });
    }
  });
}
