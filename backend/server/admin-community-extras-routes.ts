// Admin community-extras routes.
//
// Backs Admin Room → "Community"-tab.
// UI-komponenter: GroupManagement.tsx, RuleManagement.tsx,
// ModerationManagement.tsx, OnboardingEditor.tsx.
//
// Schema (se migrations/249_community_admin.sql + tidligere migrasjoner):
//   - community_groups            (rik schema fra tidlig migrasjon)
//   - community_admin_channels    (NY 249 — admin-scoped channel-katalog)
//   - community_channels          (presence — referert av channel_rules)
//   - community_channel_rules     (FK til community_channels)
//   - community_roles             (group_id NOT NULL — scoped per gruppe)
//   - community_badges            (slug NOT NULL)
//   - community_moderation_rules
//   - community_light_patterns    (NY 249)
//   - community_light_pattern_thresholds (NY 249, singleton)
//
// Alt er DEFENSIVT: tableExists-sjekk pluss try/catch, slik at UI
// degrades gracefully hvis migrasjonen ennå ikke har kjørt.

import express from "express";
import type { Pool } from "pg";

export interface AdminCommunityExtrasRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireAdminSession: (
    req: express.Request,
    res: express.Response,
  ) => { userId: string; email: string; name: string; role: string } | null;
}

// ── Defensiv tabell-sjekk ──────────────────────────────────────
async function tableExists(pool: Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
          WHERE table_name = $1
            AND table_schema = 'public'
       ) AS exists`,
      [table],
    );
    return Boolean(r.rows[0]?.exists);
  } catch {
    return false;
  }
}

// Slugify enkel hjelper for community_groups.slug / community_badges.slug
function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100) || "untitled";
}

export function setupAdminCommunityExtrasRoutes(
  deps: AdminCommunityExtrasRoutesDeps,
): void {
  const { app, pool, requireAdminSession } = deps;

  // ─── Groups ────────────────────────────────────────────────
  // GET /api/community/admin/groups — list alle community-grupper
  app.get("/api/community/admin/groups", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await tableExists(pool, "community_groups"))) {
        return res.json({ success: true, groups: [], total: 0 });
      }
      const r = await pool.query(
        `SELECT id, name, slug, description, icon, profession_type,
                is_active, member_count, created_at, updated_at
           FROM community_groups
          ORDER BY created_at DESC
          LIMIT 500`,
      );
      res.json({
        success: true,
        groups: r.rows,
        total: r.rowCount ?? r.rows.length,
      });
    } catch (e) {
      console.warn("[admin-community] GET groups failed:", e);
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  // POST /api/community/admin/groups — opprett ny gruppe
  app.post("/api/community/admin/groups", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await tableExists(pool, "community_groups"))) {
        return res
          .status(503)
          .json({ success: false, error: "community_groups table missing" });
      }
      const {
        name = "",
        slug,
        description = null,
        icon = null,
        profession_type = "cross_profession",
        is_active = true,
      } = req.body || {};
      if (!name || typeof name !== "string") {
        return res
          .status(400)
          .json({ success: false, error: "name is required" });
      }
      const finalSlug = slugify(String(slug || name));
      const r = await pool.query(
        `INSERT INTO community_groups
           (name, slug, description, icon, profession_type, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, slug, description, icon, profession_type,
                   is_active, member_count, created_at, updated_at`,
        [name, finalSlug, description, icon, profession_type, is_active],
      );
      res.json({
        success: true,
        message: "Group created",
        group: r.rows[0],
        id: r.rows[0]?.id,
      });
    } catch (e) {
      console.warn("[admin-community] POST groups failed:", e);
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  // PUT /api/community/admin/groups/:id — oppdater gruppe (UI bruker dette)
  app.put("/api/community/admin/groups/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await tableExists(pool, "community_groups"))) {
        return res
          .status(503)
          .json({ success: false, error: "community_groups table missing" });
      }
      const id = req.params.id;
      const {
        name,
        slug,
        description,
        icon,
        profession_type,
        is_active,
      } = req.body || {};
      const r = await pool.query(
        `UPDATE community_groups SET
            name = COALESCE($2, name),
            slug = COALESCE($3, slug),
            description = COALESCE($4, description),
            icon = COALESCE($5, icon),
            profession_type = COALESCE($6, profession_type),
            is_active = COALESCE($7, is_active),
            updated_at = now()
          WHERE id = $1
          RETURNING id, name, slug, description, icon, profession_type,
                    is_active, member_count, created_at, updated_at`,
        [
          id,
          name ?? null,
          slug ? slugify(slug) : null,
          description ?? null,
          icon ?? null,
          profession_type ?? null,
          typeof is_active === "boolean" ? is_active : null,
        ],
      );
      if (!r.rowCount) {
        return res.status(404).json({ success: false, error: "not found" });
      }
      res.json({
        success: true,
        message: "Group updated",
        group: r.rows[0],
      });
    } catch (e) {
      console.warn("[admin-community] PUT group failed:", e);
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  // DELETE /api/community/admin/groups/:id — slett gruppe
  app.delete("/api/community/admin/groups/:id", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await tableExists(pool, "community_groups"))) {
        return res
          .status(503)
          .json({ success: false, error: "community_groups table missing" });
      }
      const r = await pool.query(
        `DELETE FROM community_groups WHERE id = $1`,
        [req.params.id],
      );
      if (!r.rowCount) {
        return res.status(404).json({ success: false, error: "not found" });
      }
      res.json({ success: true, message: "Group deleted" });
    } catch (e) {
      console.warn("[admin-community] DELETE group failed:", e);
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  // ─── Channels (admin-scoped) ───────────────────────────────
  // GET /api/community/admin/channels?groupId=X
  app.get("/api/community/admin/channels", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await tableExists(pool, "community_admin_channels"))) {
        return res.json({ success: true, channels: [], total: 0 });
      }
      const groupId =
        typeof req.query.groupId === "string" ? req.query.groupId : null;
      const sql = groupId
        ? `SELECT id, group_id, name, description, channel_type, is_active,
                  created_at, updated_at
             FROM community_admin_channels
            WHERE group_id = $1
            ORDER BY created_at DESC
            LIMIT 500`
        : `SELECT id, group_id, name, description, channel_type, is_active,
                  created_at, updated_at
             FROM community_admin_channels
            ORDER BY created_at DESC
            LIMIT 500`;
      const params = groupId ? [groupId] : [];
      const r = await pool.query(sql, params);
      res.json({
        success: true,
        channels: r.rows,
        total: r.rowCount ?? r.rows.length,
      });
    } catch (e) {
      console.warn("[admin-community] GET channels failed:", e);
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  // POST /api/community/admin/channels — opprett ny channel
  app.post("/api/community/admin/channels", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await tableExists(pool, "community_admin_channels"))) {
        return res.status(503).json({
          success: false,
          error: "community_admin_channels table missing",
        });
      }
      const {
        group_id = null,
        name = "",
        description = null,
        channel_type = "public",
        is_active = true,
      } = req.body || {};
      if (!name) {
        return res
          .status(400)
          .json({ success: false, error: "name is required" });
      }
      const r = await pool.query(
        `INSERT INTO community_admin_channels
           (group_id, name, description, channel_type, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, group_id, name, description, channel_type, is_active,
                   created_at, updated_at`,
        [group_id, name, description, channel_type, is_active],
      );
      res.json({
        success: true,
        message: "Channel created",
        channel: r.rows[0],
        id: r.rows[0]?.id,
      });
    } catch (e) {
      console.warn("[admin-community] POST channels failed:", e);
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  // ─── Channel rules ─────────────────────────────────────────
  // NB: community_channel_rules.channel_id refererer
  // community_channels (presence-schema), ikke community_admin_channels.
  // Vi følger eksisterende FK.
  app.get("/api/community/admin/channels/:id/rules", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await tableExists(pool, "community_channel_rules"))) {
        return res.json({ success: true, rules: [] });
      }
      const r = await pool.query(
        `SELECT id, channel_id, rule_text, position, created_at
           FROM community_channel_rules
          WHERE channel_id = $1
          ORDER BY position ASC, created_at ASC`,
        [req.params.id],
      );
      res.json({ success: true, rules: r.rows });
    } catch (e) {
      console.warn("[admin-community] GET channel rules failed:", e);
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  app.post("/api/community/admin/channels/:id/rules", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await tableExists(pool, "community_channel_rules"))) {
        return res.status(503).json({
          success: false,
          error: "community_channel_rules table missing",
        });
      }
      const { rule_text = "", position = 0 } = req.body || {};
      if (!rule_text) {
        return res
          .status(400)
          .json({ success: false, error: "rule_text is required" });
      }
      const r = await pool.query(
        `INSERT INTO community_channel_rules (channel_id, rule_text, position)
         VALUES ($1, $2, $3)
         RETURNING id, channel_id, rule_text, position, created_at`,
        [req.params.id, String(rule_text), Number(position) || 0],
      );
      res.json({ success: true, message: "Rule created", rule: r.rows[0] });
    } catch (e) {
      console.warn("[admin-community] POST channel rules failed:", e);
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  // ─── Roles & badges ───────────────────────────────────────
  app.get("/api/community/admin/roles", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await tableExists(pool, "community_roles"))) {
        return res.json({ success: true, roles: [] });
      }
      const r = await pool.query(
        `SELECT id, group_id, name, slug, description, color, permissions,
                is_mentionable, is_hoisted, position, created_at, updated_at
           FROM community_roles
          ORDER BY position ASC, created_at DESC
          LIMIT 500`,
      );
      res.json({ success: true, roles: r.rows });
    } catch (e) {
      console.warn("[admin-community] GET roles failed:", e);
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  app.get("/api/community/admin/badges", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await tableExists(pool, "community_badges"))) {
        return res.json({ success: true, badges: [] });
      }
      const r = await pool.query(
        `SELECT id, name, slug, description, icon, color, criteria_type,
                criteria_value, is_active, rarity, created_at
           FROM community_badges
          ORDER BY created_at DESC
          LIMIT 500`,
      );
      res.json({ success: true, badges: r.rows });
    } catch (e) {
      console.warn("[admin-community] GET badges failed:", e);
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  // ─── Analytics ────────────────────────────────────────────
  // Aggregert KPI over community-domenet. Defensiv per-tabell-sjekk
  // slik at en manglende tabell ikke feller hele endepunktet.
  app.get("/api/community/admin/analytics", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      let totalMembers = 0;
      let activeMembers = 0;
      let postCount = 0;
      let groupCount = 0;
      let channelCount = 0;

      if (await tableExists(pool, "user_community_memberships")) {
        try {
          const r = await pool.query<{ total: string; active: string }>(
            `SELECT COUNT(*)::text AS total,
                    COUNT(*) FILTER (WHERE status = 'active')::text AS active
               FROM user_community_memberships`,
          );
          totalMembers = Number(r.rows[0]?.total ?? 0);
          activeMembers = Number(r.rows[0]?.active ?? 0);
        } catch (err) {
          console.warn("[admin-community] memberships agg failed:", err);
        }
      }

      if (await tableExists(pool, "community_messages")) {
        try {
          const r = await pool.query<{ n: string }>(
            `SELECT COUNT(*)::text AS n FROM community_messages`,
          );
          postCount = Number(r.rows[0]?.n ?? 0);
        } catch (err) {
          console.warn("[admin-community] messages count failed:", err);
        }
      }

      if (await tableExists(pool, "community_groups")) {
        try {
          const r = await pool.query<{ n: string }>(
            `SELECT COUNT(*)::text AS n FROM community_groups WHERE is_active = TRUE`,
          );
          groupCount = Number(r.rows[0]?.n ?? 0);
        } catch (err) {
          console.warn("[admin-community] groups count failed:", err);
        }
      }

      if (await tableExists(pool, "community_channels")) {
        try {
          const r = await pool.query<{ n: string }>(
            `SELECT COUNT(*)::text AS n FROM community_channels`,
          );
          channelCount = Number(r.rows[0]?.n ?? 0);
        } catch (err) {
          console.warn("[admin-community] channels count failed:", err);
        }
      }

      res.json({
        success: true,
        totalMembers,
        activeMembers,
        postCount,
        groupCount,
        channelCount,
      });
    } catch (e) {
      console.warn("[admin-community] analytics failed:", e);
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  // ─── Light-patterns (promotion candidates) ────────────────
  app.get(
    "/api/community/admin/light-patterns/promotion-candidates",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      try {
        if (
          !(await tableExists(pool, "community_light_patterns")) ||
          !(await tableExists(pool, "community_light_pattern_thresholds"))
        ) {
          return res.json({ success: true, candidates: [] });
        }
        // Hent threshold-singleton, så filtrer patterns over terskel som
        // ennå ikke er promoted.
        const thresh = await pool.query<{
          message_count: number;
          reaction_count: number;
        }>(
          `SELECT message_count, reaction_count
             FROM community_light_pattern_thresholds
            WHERE id = 'singleton'`,
        );
        const msgT = Number(thresh.rows[0]?.message_count ?? 100);
        const rxT = Number(thresh.rows[0]?.reaction_count ?? 10);
        const r = await pool.query(
          `SELECT id, pattern_name, pattern_data, is_promoted,
                  message_count, reaction_count, promoted_at, created_at
             FROM community_light_patterns
            WHERE is_promoted = FALSE
              AND (message_count >= $1 OR reaction_count >= $2)
            ORDER BY message_count DESC, reaction_count DESC
            LIMIT 100`,
          [msgT, rxT],
        );
        res.json({ success: true, candidates: r.rows });
      } catch (e) {
        console.warn("[admin-community] promotion candidates failed:", e);
        res.status(500).json({ success: false, error: String(e) });
      }
    },
  );

  app.get(
    "/api/community/admin/light-patterns/promotion-thresholds",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      try {
        if (
          !(await tableExists(pool, "community_light_pattern_thresholds"))
        ) {
          return res.json({
            success: true,
            thresholds: { messageCount: 100, reactions: 10 },
          });
        }
        const r = await pool.query<{
          message_count: number;
          reaction_count: number;
          updated_at: string;
        }>(
          `SELECT message_count, reaction_count, updated_at
             FROM community_light_pattern_thresholds
            WHERE id = 'singleton'`,
        );
        const row = r.rows[0];
        res.json({
          success: true,
          thresholds: {
            messageCount: Number(row?.message_count ?? 100),
            reactions: Number(row?.reaction_count ?? 10),
            updatedAt: row?.updated_at ?? null,
          },
        });
      } catch (e) {
        console.warn("[admin-community] promotion thresholds failed:", e);
        res.status(500).json({ success: false, error: String(e) });
      }
    },
  );

  app.post(
    "/api/community/admin/light-patterns/:id/promote",
    async (req, res) => {
      if (!requireAdminSession(req, res)) return;
      try {
        if (!(await tableExists(pool, "community_light_patterns"))) {
          return res.status(503).json({
            success: false,
            error: "community_light_patterns table missing",
          });
        }
        const r = await pool.query(
          `UPDATE community_light_patterns
              SET is_promoted = TRUE,
                  promoted_at = COALESCE(promoted_at, now())
            WHERE id = $1
            RETURNING id, pattern_name, is_promoted, promoted_at`,
          [req.params.id],
        );
        if (!r.rowCount) {
          return res
            .status(404)
            .json({ success: false, error: "pattern not found" });
        }
        res.json({
          success: true,
          message: "Pattern promoted",
          pattern: r.rows[0],
        });
      } catch (e) {
        console.warn("[admin-community] promote failed:", e);
        res.status(500).json({ success: false, error: String(e) });
      }
    },
  );

  // ─── Moderation ───────────────────────────────────────────
  app.get("/api/community/moderation/rules", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      if (!(await tableExists(pool, "community_moderation_rules"))) {
        return res.json({ success: true, rules: [] });
      }
      const r = await pool.query(
        `SELECT id, rule_code, rule_name, rule_description, default_severity,
                auto_enforce, auto_detect_keywords, first_violation_action,
                second_violation_action, third_violation_action, is_active,
                created_at, updated_at
           FROM community_moderation_rules
          ORDER BY created_at DESC
          LIMIT 500`,
      );
      res.json({ success: true, rules: r.rows });
    } catch (e) {
      console.warn("[admin-community] GET moderation rules failed:", e);
      res.status(500).json({ success: false, error: String(e) });
    }
  });

  // ─── Onboarding (no-op alias for admin-prefix) ────────────
  // Den ekte POST /api/community/onboard-user finnes i community-routes.ts.
  // For å unngå double-mount eksponerer vi en admin-alias.
  app.post("/api/admin/community/onboard-user", async (req, res) => {
    if (!requireAdminSession(req, res)) return;
    try {
      const { userId = null } = req.body || {};
      res.json({ success: true, userId });
    } catch (e) {
      res.status(500).json({ success: false, error: String(e) });
    }
  });
}
