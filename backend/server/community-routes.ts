import express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

type CommunityOnboardingStepRecord = {
  id: string;
  title: string;
  description: string;
  content_type: "text" | "video" | "image" | "checklist";
  content: Record<string, unknown>;
  position: number;
  is_required: boolean;
};

type CommunityOnboardingConfigRecord = {
  id: string;
  profession_type: string;
  welcome_title: string;
  welcome_message: string;
  welcome_video_url: string | null;
  steps: CommunityOnboardingStepRecord[];
  completion_message: string;
  completion_cta_text: string;
  completion_cta_url: string;
  is_active: boolean;
};

type CommunityUserProfileRecord = {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  profession: string;
  inviteStatus: string | null;
};

type CommunityGroupRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  profession_type: string;
  is_active: boolean;
  member_count: number;
};

type CommunityChannelRecord = {
  id: string;
  group_id: string;
  name: string;
  display_name: string;
  description: string;
  channel_type: string;
  is_default: boolean;
  requires_feature: string | null;
  requires_subscription_tier: string | null;
  is_read_only: boolean;
  position: number;
};

type CommunityProgressRecord = {
  completedSteps: number[];
  activeStep: number;
  timestamp: number;
};

const COMMUNITY_DEFAULT_NOTIFICATION_PREFERENCES = {
  notify_mentions: true,
  notify_replies: true,
  notify_reactions: true,
  notify_badges: true,
  notify_moderation: true,
  notify_followed_threads: true,
  notify_daily_digest: false,
  notify_mentor_requests: true,
  notify_course_discussions: true,
};

export interface CommunityRoutesDeps {
  app: express.Application;
  pool: Pool;
  normalizeCommunityProfession: (rawValue: unknown) => string;
  getCommunityProfessionLabel: (profession: string) => string;
  ensureCommunityDefaultChannels: (group: any) => Promise<void>;
  onboardUserToCommunity: (input: {
    userId: string;
    profession: string;
    email?: string | null;
  }) => Promise<any>;
  hasTable: (tableName: string) => Promise<boolean>;
  tableExistsCache: Map<string, boolean>;
  tableColumnsCache: Map<string, Set<string>>;
}

export function setupCommunityRoutes(deps: CommunityRoutesDeps): void {
  const {
    app,
    pool,
    normalizeCommunityProfession,
    getCommunityProfessionLabel,
    ensureCommunityDefaultChannels,
    onboardUserToCommunity,
    hasTable,
    tableExistsCache,
    tableColumnsCache,
  } = deps;

  function getCommunityAccessUserId(req: express.Request): string {
    const headerUserId = req.header("x-user-id");
    if (headerUserId && headerUserId.trim()) {
      return headerUserId.trim();
    }
    if (typeof req.body?.userId === "string" && req.body.userId.trim()) {
      return req.body.userId.trim();
    }
    return "";
  }

  function getDefaultCommunityOnboardingConfig(
    profession: string,
  ): CommunityOnboardingConfigRecord {
    const normalizedProfession = normalizeCommunityProfession(profession);
    const professionLabel = getCommunityProfessionLabel(normalizedProfession);

    return {
      id: `default-${normalizedProfession}`,
      profession_type: normalizedProfession,
      welcome_title: "Velkommen til CreatorHub Community",
      welcome_message: `Her finner du fagmiljø, inspirasjon og hjelp for ${professionLabel}. Fullfør de korte stegene under for å komme raskt i gang.`,
      welcome_video_url: null,
      steps: [
        {
          id: "introduksjon",
          title: "Forstå rommet",
          description:
            "Få oversikt over hvordan du bruker kanalene, hvor du presenterer deg, og hvor du stiller spørsmål.",
          content_type: "checklist",
          content: {
            checklist: [
              "Start i oppslagstavlen",
              "Presenter deg i presentasjoner",
              "Bruk spørsmål & hjelp når du trenger sparring",
            ],
          },
          position: 0,
          is_required: true,
        },
        {
          id: "deling",
          title: "Del riktig type innhold",
          description:
            "Hold community ryddig ved å poste work in progress, korte case og konkrete spørsmål i riktig kanal.",
          content_type: "text",
          content: {
            body: "Legg ved nok kontekst til at andre faktisk kan hjelpe deg: målet ditt, hva du har prøvd, og hvor du sitter fast.",
          },
          position: 1,
          is_required: true,
        },
        {
          id: "respons",
          title: "Gi verdi tilbake",
          description:
            "Community fungerer best når alle svarer presist, deler erfaringer og avslutter tråder med hva som faktisk løste problemet.",
          content_type: "text",
          content: {
            body: "Svar konkret, hold tonen profesjonell, og marker gode løsninger slik at andre finner dem igjen.",
          },
          position: 2,
          is_required: true,
        },
      ],
      completion_message:
        "Du er klar. Community-tilgangen din er aktivert, og du kan gå rett inn i kanalene.",
      completion_cta_text: "Gå til community",
      completion_cta_url: "/community",
      is_active: true,
    };
  }

  async function ensureCommunityOnboardingProgressTable() {
    if (await hasTable("community_onboarding_progress")) {
      return;
    }

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS community_onboarding_progress (
          user_id TEXT NOT NULL,
          profession TEXT NOT NULL,
          completed_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
          active_step INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, profession)
        )
      `);
    } catch (error: any) {
      if (error?.code !== "42P07" && error?.code !== "23505") {
        throw error;
      }
    }

    tableExistsCache.set("community_onboarding_progress", true);
    tableColumnsCache.delete("community_onboarding_progress");
  }

  async function loadCommunityUserProfile(
    userId: string,
  ): Promise<CommunityUserProfileRecord> {
    const result = await pool.query(
      `
        WITH invite_match AS (
          SELECT *
          FROM invite_requests
          WHERE registered_user_id = $1 OR user_id = $1
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 1
        ),
        user_match AS (
          SELECT *
          FROM users
          WHERE id = $1
          LIMIT 1
        )
        SELECT
          COALESCE(um.id, $1) AS id,
          COALESCE(um.email, im.email, '') AS email,
          COALESCE(
            NULLIF(TRIM(CONCAT(COALESCE(um.first_name, ''), ' ', COALESCE(um.last_name, ''))), ''),
            NULLIF(TRIM(CONCAT(COALESCE(im.first_name, ''), ' ', COALESCE(im.last_name, ''))), ''),
            NULLIF(SPLIT_PART(COALESCE(um.email, im.email, ''), '@', 1), ''),
            'User'
          ) AS name,
          um.profile_image_url AS picture,
          COALESCE(im.profession, 'photographer') AS profession,
          im.status AS invite_status
        FROM (SELECT $1::text AS requested_id) requested
        LEFT JOIN user_match um ON true
        LEFT JOIN invite_match im ON true
        LIMIT 1
      `,
      [userId],
    );

    const row = result.rows[0] || {};
    return {
      id: String(row.id || userId),
      email: String(row.email || ""),
      name: String(row.name || "User"),
      picture:
        typeof row.picture === "string" && row.picture.trim()
          ? row.picture
          : null,
      profession: normalizeCommunityProfession(row.profession),
      inviteStatus:
        typeof row.invite_status === "string" && row.invite_status.trim()
          ? row.invite_status
          : null,
    };
  }

  async function getCommunityMembershipRows(
    userId: string,
    profession?: string,
  ): Promise<Array<Record<string, unknown>>> {
    const normalizedProfession = profession
      ? normalizeCommunityProfession(profession)
      : null;
    const groupTypes = normalizedProfession
      ? [normalizedProfession, "cross_profession"]
      : [];

    const result = await pool.query(
      `
        SELECT
          m.id,
          m.user_id,
          m.group_id,
          m.status,
          m.joined_at,
          m.left_at,
          m.message_count,
          m.last_active_at,
          COALESCE(m.onboarding_completed, false) AS onboarding_completed,
          m.onboarding_completed_at,
          g.name,
          g.slug,
          COALESCE(g.description, '') AS description,
          COALESCE(g.icon, 'group') AS icon,
          g.profession_type,
          COALESCE(g.is_active, true) AS is_active,
          COALESCE(g.member_count, 0) AS member_count
        FROM user_community_memberships m
        JOIN community_groups g ON g.id = m.group_id
        WHERE m.user_id = $1
          AND m.status = 'active'
          AND m.left_at IS NULL
          AND COALESCE(g.is_active, true) = true
          AND (
            $2::boolean = false
            OR g.profession_type = ANY($3::text[])
          )
        ORDER BY
          CASE
            WHEN g.profession_type = $4 THEN 0
            WHEN g.profession_type = 'cross_profession' THEN 1
            ELSE 2
          END,
          m.joined_at ASC NULLS LAST,
          g.name ASC
      `,
      [
        userId,
        Boolean(normalizedProfession),
        groupTypes,
        normalizedProfession || "",
      ],
    );

    return result.rows;
  }

  async function getCommunityOnboardingStatus(userId: string) {
    const profile = await loadCommunityUserProfile(userId);
    let memberships = await getCommunityMembershipRows(userId, profile.profession);

    if (
      memberships.length === 0 &&
      profile.inviteStatus === "approved" &&
      profile.profession !== "vendor"
    ) {
      await onboardUserToCommunity({
        userId,
        profession: profile.profession,
        email: profile.email,
      });
      memberships = await getCommunityMembershipRows(userId, profile.profession);
    }

    const hasAccess = memberships.length > 0;
    const completed =
      hasAccess &&
      memberships.every((membership) => Boolean(membership.onboarding_completed));

    return {
      success: true,
      hasAccess,
      completed,
      profession: profile.profession,
      groups: memberships.map((membership) => ({
        id: String(membership.group_id || ""),
        name: String(membership.name || ""),
        slug: String(membership.slug || ""),
        description: String(membership.description || ""),
        icon: String(membership.icon || "group"),
        profession_type: String(membership.profession_type || ""),
        is_active: Boolean(membership.is_active),
        member_count: Number(membership.member_count || 0),
      })),
    };
  }

  function mapCommunityMessageRow(
    row: Record<string, unknown>,
  ): Record<string, unknown> {
    const attachments = Array.isArray(row.attachments) ? row.attachments : [];
    const reactions =
      row.reactions && typeof row.reactions === "object" ? row.reactions : {};

    return {
      id: String(row.id || ""),
      channel_id: String(row.channel_id || ""),
      user_id: String(row.user_id || ""),
      content: String(row.content || ""),
      message_type: String(row.content_type || "text"),
      attachments,
      reactions,
      reply_to_id:
        typeof row.parent_message_id === "string" ? row.parent_message_id : null,
      created_at: row.created_at
        ? new Date(String(row.created_at)).toISOString()
        : new Date().toISOString(),
      updated_at: row.updated_at
        ? new Date(String(row.updated_at)).toISOString()
        : new Date().toISOString(),
      user_name: String(row.user_name || "User"),
      user_avatar:
        typeof row.user_avatar === "string" && row.user_avatar.trim()
          ? row.user_avatar
          : null,
      user_badges: [],
      is_edited: Boolean(row.is_edited),
      is_solution: Boolean(row.is_solution),
      thread_count: Number(row.thread_count || 0),
      parent_message_id:
        typeof row.parent_message_id === "string" ? row.parent_message_id : null,
      is_pinned: Boolean(row.is_pinned),
    };
  }

  app.post("/api/community/onboard-user", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "").trim();
      const profession = String(req.body?.profession || "").trim();
      const email =
        typeof req.body?.email === "string" ? String(req.body.email) : null;

      if (!userId || !profession) {
        return res
          .status(400)
          .json({ success: false, error: "userId og profession er obligatoriske" });
      }

      const result = await onboardUserToCommunity({ userId, profession, email });
      res.json(result);
    } catch (error) {
      console.error("Community onboard-user error:", error);
      res
        .status(500)
        .json({ success: false, error: "Kunne ikke aktivere community-tilgang" });
    }
  });

  app.get("/api/community/user/:userId/onboarding-status", async (req, res) => {
    try {
      const userId = String(req.params.userId || "").trim();
      if (!userId || userId === "guest") {
        return res.json({
          success: true,
          hasAccess: false,
          completed: false,
          groups: [],
        });
      }

      res.json(await getCommunityOnboardingStatus(userId));
    } catch (error) {
      console.error("Community onboarding-status error:", error);
      res
        .status(500)
        .json({ success: false, error: "Kunne ikke hente onboarding-status" });
    }
  });

  app.post("/api/community/onboarding/complete", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "").trim();
      const profession = normalizeCommunityProfession(req.body?.profession);
      if (!userId) {
        return res
          .status(400)
          .json({ success: false, error: "userId er obligatorisk" });
      }

      const memberships = await getCommunityMembershipRows(userId, profession);
      if (memberships.length === 0) {
        return res.json({
          success: true,
          updated: 0,
          message: "Ingen aktive community-medlemskap aa oppdatere",
        });
      }

      await pool.query(
        `
          UPDATE user_community_memberships
          SET onboarding_completed = true,
              onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()),
              updated_at = NOW()
          WHERE user_id = $1
            AND group_id = ANY($2::uuid[])
        `,
        [userId, memberships.map((membership) => String(membership.group_id))],
      );

      await ensureCommunityOnboardingProgressTable();
      await pool.query(
        `
          INSERT INTO community_onboarding_progress (
            user_id,
            profession,
            completed_steps,
            active_step,
            created_at,
            updated_at
          )
          VALUES ($1, $2, '[]'::jsonb, 0, NOW(), NOW())
          ON CONFLICT (user_id, profession)
          DO UPDATE SET
            updated_at = NOW()
        `,
        [userId, profession],
      );

      res.json({
        success: true,
        updated: memberships.length,
        message: "Community-onboarding er markert som fullfoert",
      });
    } catch (error) {
      console.error("Community onboarding complete error:", error);
      res
        .status(500)
        .json({ success: false, error: "Kunne ikke oppdatere onboarding" });
    }
  });

  app.post("/api/community/onboarding/progress", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "").trim();
      const profession = normalizeCommunityProfession(req.body?.profession);
      const completedSteps = Array.isArray(req.body?.completedSteps)
        ? req.body.completedSteps.filter((value: unknown) =>
            Number.isFinite(Number(value)),
          )
        : [];
      const activeStep = Number.isFinite(Number(req.body?.activeStep))
        ? Number(req.body.activeStep)
        : 0;

      if (!userId || !profession) {
        return res
          .status(400)
          .json({ success: false, error: "userId og profession er obligatoriske" });
      }

      await ensureCommunityOnboardingProgressTable();
      await pool.query(
        `
          INSERT INTO community_onboarding_progress (
            user_id,
            profession,
            completed_steps,
            active_step,
            created_at,
            updated_at
          )
          VALUES ($1, $2, $3::jsonb, $4, NOW(), NOW())
          ON CONFLICT (user_id, profession)
          DO UPDATE SET
            completed_steps = EXCLUDED.completed_steps,
            active_step = EXCLUDED.active_step,
            updated_at = NOW()
        `,
        [userId, profession, JSON.stringify(completedSteps), activeStep],
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Community onboarding progress save error:", error);
      res
        .status(500)
        .json({ success: false, error: "Kunne ikke lagre onboarding-fremdrift" });
    }
  });

  app.get(
    "/api/community/onboarding/progress/:userId/:profession",
    async (req, res) => {
      try {
        const userId = String(req.params.userId || "").trim();
        const profession = normalizeCommunityProfession(req.params.profession);
        if (!userId || !profession) {
          return res
            .status(400)
            .json({ success: false, error: "Mangler userId eller profession" });
        }

        await ensureCommunityOnboardingProgressTable();
        const result = await pool.query(
          `
            SELECT completed_steps, active_step, updated_at
            FROM community_onboarding_progress
            WHERE user_id = $1 AND profession = $2
            LIMIT 1
          `,
          [userId, profession],
        );

        if ((result.rowCount ?? 0) === 0) {
          return res.json({ success: true, progress: null });
        }

        const row = result.rows[0];
        const progress: CommunityProgressRecord = {
          completedSteps: Array.isArray(row.completed_steps)
            ? row.completed_steps.map((value: unknown) => Number(value))
            : [],
          activeStep: Number(row.active_step || 0),
          timestamp: row.updated_at
            ? new Date(String(row.updated_at)).getTime()
            : Date.now(),
        };

        res.json({ success: true, progress });
      } catch (error) {
        console.error("Community onboarding progress fetch error:", error);
        res
          .status(500)
          .json({ success: false, error: "Kunne ikke hente onboarding-fremdrift" });
      }
    },
  );

  app.get("/api/community/onboarding/:profession", async (req, res) => {
    try {
      const profession = normalizeCommunityProfession(req.params.profession);
      const result = await pool.query(
        `
          SELECT
            id,
            profession_type,
            welcome_title,
            welcome_message,
            welcome_video_url,
            steps,
            completion_message,
            completion_cta_text,
            completion_cta_url,
            COALESCE(is_active, true) AS is_active
          FROM community_onboarding_configs
          WHERE profession_type = $1
            AND COALESCE(is_active, true) = true
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 1
        `,
        [profession],
      );

      if ((result.rowCount ?? 0) === 0) {
        return res.json({
          success: true,
          config: getDefaultCommunityOnboardingConfig(profession),
        });
      }

      const row = result.rows[0];
      const config: CommunityOnboardingConfigRecord = {
        id: String(row.id),
        profession_type: String(row.profession_type || profession),
        welcome_title: String(row.welcome_title || "Velkommen til community"),
        welcome_message: String(row.welcome_message || ""),
        welcome_video_url:
          typeof row.welcome_video_url === "string" && row.welcome_video_url.trim()
            ? row.welcome_video_url
            : null,
        steps: Array.isArray(row.steps)
          ? row.steps
          : getDefaultCommunityOnboardingConfig(profession).steps,
        completion_message: String(row.completion_message || ""),
        completion_cta_text: String(row.completion_cta_text || "Gå til community"),
        completion_cta_url: String(row.completion_cta_url || "/community"),
        is_active: Boolean(row.is_active),
      };

      res.json({ success: true, config });
    } catch (error) {
      console.error("Community onboarding config error:", error);
      res
        .status(500)
        .json({ success: false, error: "Kunne ikke hente onboarding-config" });
    }
  });

  app.get("/api/community/user/:userId/groups", async (req, res) => {
    try {
      const userId = String(req.params.userId || "").trim();
      const profile = await loadCommunityUserProfile(userId);
      const groups = await getCommunityMembershipRows(userId, profile.profession);
      res.json({
        success: true,
        groups: groups.map((group) => ({
          id: String(group.group_id || ""),
          name: String(group.name || ""),
          slug: String(group.slug || ""),
          description: String(group.description || ""),
          icon: String(group.icon || "group"),
          profession_type: String(group.profession_type || ""),
          is_active: Boolean(group.is_active),
          member_count: Number(group.member_count || 0),
        })),
      });
    } catch (error) {
      console.error("Community groups fetch error:", error);
      res.status(500).json({ success: false, error: "Kunne ikke hente grupper" });
    }
  });

  app.get("/api/community/user/:userId/channels", async (req, res) => {
    try {
      const userId = String(req.params.userId || "").trim();
      const groupId = String(req.query.groupId || "").trim();
      if (!groupId) {
        return res.json({ success: true, channels: [] });
      }

      const groupAccess = await pool.query(
        `
          SELECT
            g.id,
            g.name,
            g.profession_type
          FROM user_community_memberships m
          JOIN community_groups g ON g.id = m.group_id
          WHERE m.user_id = $1
            AND m.group_id = $2::uuid
            AND m.status = 'active'
            AND m.left_at IS NULL
            AND COALESCE(g.is_active, true) = true
          LIMIT 1
        `,
        [userId, groupId],
      );

      if ((groupAccess.rowCount ?? 0) === 0) {
        return res.json({ success: true, channels: [] });
      }

      await ensureCommunityDefaultChannels({
        id: String(groupAccess.rows[0].id),
        name: String(groupAccess.rows[0].name || ""),
        profession_type: String(groupAccess.rows[0].profession_type || ""),
      });

      const channels = await pool.query(
        `
          SELECT
            id,
            group_id,
            name,
            display_name,
            COALESCE(description, '') AS description,
            COALESCE(channel_type, 'discussion') AS channel_type,
            COALESCE(is_default, false) AS is_default,
            requires_feature,
            requires_subscription_tier,
            COALESCE(is_read_only, false) AS is_read_only,
            COALESCE(position, 0) AS position
          FROM community_channels
          WHERE group_id = $1::uuid
            AND COALESCE(is_archived, false) = false
          ORDER BY position ASC, created_at ASC NULLS LAST
        `,
        [groupId],
      );

      res.json({
        success: true,
        channels: channels.rows.map(
          (row: any): CommunityChannelRecord => ({
            id: String(row.id),
            group_id: String(row.group_id),
            name: String(row.name || ""),
            display_name: String(row.display_name || row.name || ""),
            description: String(row.description || ""),
            channel_type: String(row.channel_type || "discussion"),
            is_default: Boolean(row.is_default),
            requires_feature:
              typeof row.requires_feature === "string"
                ? row.requires_feature
                : null,
            requires_subscription_tier:
              typeof row.requires_subscription_tier === "string"
                ? row.requires_subscription_tier
                : null,
            is_read_only: Boolean(row.is_read_only),
            position: Number(row.position || 0),
          }),
        ),
      });
    } catch (error) {
      console.error("Community channels fetch error:", error);
      res.status(500).json({ success: false, error: "Kunne ikke hente kanaler" });
    }
  });

  app.get("/api/community/user/:userId/badges", async (req, res) => {
    try {
      const result = await pool.query(
        `
          SELECT
            b.id,
            b.name,
            b.slug,
            COALESCE(b.icon, '🏅') AS icon,
            COALESCE(b.color, '#64748b') AS color,
            COALESCE(b.rarity, 'common') AS rarity
          FROM user_community_badges ub
          JOIN community_badges b ON b.id = ub.badge_id
          WHERE ub.user_id = $1
            AND COALESCE(b.is_active, true) = true
          ORDER BY ub.earned_at DESC NULLS LAST, b.name ASC
        `,
        [req.params.userId],
      );

      res.json({ success: true, badges: result.rows });
    } catch (error) {
      console.error("Community badges fetch error:", error);
      res.status(500).json({ success: false, error: "Kunne ikke hente badges" });
    }
  });

  app.get("/api/community/user/:userId/roles", async (req, res) => {
    try {
      const result = await pool.query(
        `
          SELECT
            r.id,
            r.group_id,
            r.name,
            r.slug,
            COALESCE(r.description, '') AS description,
            COALESCE(r.color, '#111827') AS color
          FROM user_community_roles ur
          JOIN community_roles r ON r.id = ur.role_id
          WHERE ur.user_id = $1
          ORDER BY r.position ASC NULLS LAST, r.name ASC
        `,
        [req.params.userId],
      );

      res.json({ success: true, roles: result.rows });
    } catch (error) {
      console.error("Community roles fetch error:", error);
      res.status(500).json({ success: false, error: "Kunne ikke hente roller" });
    }
  });

  app.get("/api/community/user/:userId/stats", async (req, res) => {
    try {
      const result = await pool.query(
        `
          SELECT
            COUNT(*)::int AS messages,
            COUNT(*) FILTER (WHERE COALESCE(is_solution, false) = true)::int AS solutions
          FROM community_messages
          WHERE user_id = $1
        `,
        [req.params.userId],
      );

      const row = result.rows[0] || {};
      res.json({
        success: true,
        stats: {
          messages: Number(row.messages || 0),
          reactions: 0,
          solutions: Number(row.solutions || 0),
        },
      });
    } catch (error) {
      console.error("Community stats fetch error:", error);
      res.status(500).json({ success: false, error: "Kunne ikke hente statistikk" });
    }
  });

  app.get("/api/community/channels/:channelId/messages", async (req, res) => {
    try {
      const result = await pool.query(
        `
          SELECT
            m.id,
            m.channel_id,
            m.user_id,
            m.content,
            m.content_type,
            m.attachments,
            m.reactions,
            m.parent_message_id,
            m.thread_count,
            m.created_at,
            m.updated_at,
            m.is_edited,
            m.is_solution,
            m.is_pinned,
            COALESCE(
              NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
              NULLIF(TRIM(CONCAT(COALESCE(ir.first_name, ''), ' ', COALESCE(ir.last_name, ''))), ''),
              NULLIF(SPLIT_PART(COALESCE(u.email, ir.email, ''), '@', 1), ''),
              'User'
            ) AS user_name,
            u.profile_image_url AS user_avatar
          FROM community_messages m
          LEFT JOIN users u ON u.id = m.user_id
          LEFT JOIN LATERAL (
            SELECT *
            FROM invite_requests
            WHERE registered_user_id = m.user_id OR user_id = m.user_id
            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
            LIMIT 1
          ) ir ON true
          WHERE m.channel_id = $1::uuid
            AND m.parent_message_id IS NULL
            AND COALESCE(m.is_deleted, false) = false
          ORDER BY m.created_at ASC
          LIMIT 200
        `,
        [req.params.channelId],
      );

      res.json({
        success: true,
        messages: result.rows.map((row: Record<string, unknown>) =>
          mapCommunityMessageRow(row),
        ),
      });
    } catch (error) {
      console.error("Community messages fetch error:", error);
      res.status(500).json({ success: false, error: "Kunne ikke hente meldinger" });
    }
  });

  app.get("/api/community/channels/:channelId/pinned", (_req, res) => {
    res.json({ success: true, messages: [] });
  });

  app.post("/api/community/channels/:channelId/messages", async (req, res) => {
    try {
      const channelId = String(req.params.channelId || "").trim();
      const userId = String(req.body?.userId || "").trim();
      const content = String(req.body?.content || "").trim();
      const attachments = Array.isArray(req.body?.attachments)
        ? req.body.attachments
        : [];
      const contentType = String(req.body?.message_type || "text").trim() || "text";

      if (!channelId || !userId || (!content && attachments.length === 0)) {
        return res.status(400).json({
          success: false,
          error: "channelId, userId og innhold er obligatoriske",
        });
      }

      const created = await pool.query(
        `
          INSERT INTO community_messages (
            id,
            channel_id,
            user_id,
            content,
            content_type,
            attachments,
            parent_message_id,
            thread_count,
            reactions,
            is_pinned,
            is_edited,
            is_deleted,
            created_at,
            updated_at,
            is_solution
          )
          VALUES (
            $1, $2::uuid, $3, $4, $5, $6::jsonb, NULL, 0, '{}'::jsonb, false, false, false, NOW(), NOW(), false
          )
          RETURNING *
        `,
        [
          crypto.randomUUID(),
          channelId,
          userId,
          content,
          contentType,
          JSON.stringify(attachments),
        ],
      );

      await pool.query(
        `
          UPDATE user_community_memberships
          SET message_count = COALESCE(message_count, 0) + 1,
              last_active_at = NOW(),
              updated_at = NOW()
          WHERE user_id = $1
            AND group_id = (
              SELECT group_id
              FROM community_channels
              WHERE id = $2::uuid
              LIMIT 1
            )
        `,
        [userId, channelId],
      );

      await pool.query(
        `
          UPDATE community_channels
          SET message_count = COALESCE(message_count, 0) + 1,
              updated_at = NOW()
          WHERE id = $1::uuid
        `,
        [channelId],
      );

      const profile = await loadCommunityUserProfile(userId);
      const message = mapCommunityMessageRow({
        ...created.rows[0],
        user_name: profile.name,
        user_avatar: profile.picture,
      });

      res.status(201).json({ success: true, message });
    } catch (error) {
      console.error("Community message create error:", error);
      res.status(500).json({ success: false, error: "Kunne ikke sende melding" });
    }
  });

  app.post("/api/community/messages/:messageId/pin", (_req, res) => {
    res.json({ success: true });
  });

  app.get("/api/community/messages/:messageId/thread", async (req, res) => {
    try {
      const result = await pool.query(
        `
          SELECT
            m.id,
            m.channel_id,
            m.user_id,
            m.content,
            m.content_type,
            m.attachments,
            m.reactions,
            m.parent_message_id,
            m.thread_count,
            m.created_at,
            m.updated_at,
            m.is_edited,
            m.is_solution,
            m.is_pinned,
            COALESCE(
              NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
              NULLIF(TRIM(CONCAT(COALESCE(ir.first_name, ''), ' ', COALESCE(ir.last_name, ''))), ''),
              NULLIF(SPLIT_PART(COALESCE(u.email, ir.email, ''), '@', 1), ''),
              'User'
            ) AS user_name,
            u.profile_image_url AS user_avatar
          FROM community_messages m
          LEFT JOIN users u ON u.id = m.user_id
          LEFT JOIN LATERAL (
            SELECT *
            FROM invite_requests
            WHERE registered_user_id = m.user_id OR user_id = m.user_id
            ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
            LIMIT 1
          ) ir ON true
          WHERE m.id = $1::uuid OR m.parent_message_id = $1::uuid
          ORDER BY m.created_at ASC
        `,
        [req.params.messageId],
      );

      res.json({
        success: true,
        messages: result.rows.map((row: Record<string, unknown>) =>
          mapCommunityMessageRow(row),
        ),
      });
    } catch (error) {
      console.error("Community thread fetch error:", error);
      res.status(500).json({ success: false, error: "Kunne ikke hente traad" });
    }
  });

  app.get("/api/community/dm/conversations", (_req, res) => {
    res.json({ success: true, conversations: [] });
  });

  app.post("/api/community/dm/conversations", async (req, res) => {
    try {
      const participantId = String(req.body?.participantId || "").trim();
      const participantProfile = participantId
        ? await loadCommunityUserProfile(participantId)
        : null;

      res.status(201).json({
        success: true,
        conversation: {
          id: crypto.randomUUID(),
          participant: participantProfile
            ? {
                id: participantProfile.id,
                name: participantProfile.name,
                email: participantProfile.email,
                profile_picture: participantProfile.picture,
              }
            : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Community DM conversation create error:", error);
      res
        .status(500)
        .json({ success: false, error: "Kunne ikke opprette DM-samtale" });
    }
  });

  app.get("/api/community/dm/conversations/:conversationId/messages", (_req, res) => {
    res.json({ success: true, messages: [] });
  });

  app.post(
    "/api/community/dm/conversations/:conversationId/messages",
    async (req, res) => {
      try {
        const senderId = String(req.body?.senderId || "").trim();
        const senderProfile = senderId
          ? await loadCommunityUserProfile(senderId)
          : null;

        res.status(201).json({
          success: true,
          message: {
            id: crypto.randomUUID(),
            content: String(req.body?.content || ""),
            sender_id: senderId,
            is_read: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            sender: senderProfile
              ? {
                  id: senderProfile.id,
                  name: senderProfile.name,
                  profile_picture: senderProfile.picture,
                }
              : {
                  id: senderId,
                  name: "User",
                },
          },
        });
      } catch (error) {
        console.error("Community DM message create error:", error);
        res.status(500).json({ success: false, error: "Kunne ikke sende DM" });
      }
    },
  );

  app.delete("/api/community/dm/conversations/:conversationId", (_req, res) => {
    res.json({ success: true });
  });

  app.get("/api/community/mentors", (_req, res) => {
    res.json({ success: true, mentors: [] });
  });

  app.get("/api/community/mentors/check-eligibility", (_req, res) => {
    res.json({ success: true, eligible: false });
  });

  app.get("/api/community/notifications/:userId/unread-count", (_req, res) => {
    res.json({ success: true, count: 0 });
  });

  app.get("/api/community/notifications/:userId/preferences", (_req, res) => {
    res.json({
      success: true,
      preferences: COMMUNITY_DEFAULT_NOTIFICATION_PREFERENCES,
    });
  });

  app.put("/api/community/notifications/:userId/preferences", (_req, res) => {
    res.json({ success: true });
  });

  app.post("/api/community/notifications/:userId/preferences", (_req, res) => {
    res.json({ success: true });
  });

  app.get("/api/community/unanswered", (_req, res) => {
    res.json({ success: true, unanswered: [], messages: [] });
  });

  app.get("/api/community/bookmarks", async (req, res) => {
    try {
      const userId = getCommunityAccessUserId(req);
      if (!userId) {
        return res.json({ success: true, bookmarks: [] });
      }

      const result = await pool.query(
        `
          SELECT id, user_id, message_id, collection_name, notes, created_at
          FROM community_bookmarks
          WHERE user_id = $1
          ORDER BY created_at DESC NULLS LAST
        `,
        [userId],
      );

      res.json({ success: true, bookmarks: result.rows });
    } catch (error) {
      console.error("Community bookmarks fetch error:", error);
      res.status(500).json({ success: false, error: "Kunne ikke hente bokmerker" });
    }
  });

  app.post("/api/community/bookmarks", async (req, res) => {
    try {
      const userId = String(req.body?.userId || getCommunityAccessUserId(req)).trim();
      const messageId = String(req.body?.messageId || "").trim();
      if (!userId || !messageId) {
        return res
          .status(400)
          .json({ success: false, error: "userId og messageId er obligatoriske" });
      }

      await pool.query(
        `
          INSERT INTO community_bookmarks (
            id,
            user_id,
            message_id,
            collection_name,
            notes,
            created_at
          )
          VALUES ($1, $2, $3::uuid, NULL, NULL, NOW())
        `,
        [crypto.randomUUID(), userId, messageId],
      );

      res.status(201).json({ success: true });
    } catch (error) {
      console.error("Community bookmark create error:", error);
      res.status(500).json({ success: false, error: "Kunne ikke lagre bokmerke" });
    }
  });

  app.post("/api/community/bookmarks/:messageId", async (req, res) => {
    try {
      const userId = getCommunityAccessUserId(req);
      const messageId = String(req.params.messageId || "").trim();
      if (!userId || !messageId) {
        return res
          .status(400)
          .json({ success: false, error: "userId og messageId er obligatoriske" });
      }

      await pool.query(
        `
          INSERT INTO community_bookmarks (
            id,
            user_id,
            message_id,
            collection_name,
            notes,
            created_at
          )
          VALUES ($1, $2, $3::uuid, NULL, NULL, NOW())
        `,
        [crypto.randomUUID(), userId, messageId],
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Community bookmark create error:", error);
      res.status(500).json({ success: false, error: "Kunne ikke lagre bokmerke" });
    }
  });

  app.delete("/api/community/bookmarks/:messageId", async (req, res) => {
    try {
      const userId = getCommunityAccessUserId(req);
      const messageId = String(req.params.messageId || "").trim();
      if (!userId || !messageId) {
        return res
          .status(400)
          .json({ success: false, error: "userId og messageId er obligatoriske" });
      }

      await pool.query(
        `
          DELETE FROM community_bookmarks
          WHERE user_id = $1 AND message_id = $2::uuid
        `,
        [userId, messageId],
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Community bookmark delete error:", error);
      res.status(500).json({ success: false, error: "Kunne ikke slette bokmerke" });
    }
  });

  app.get("/api/users/:userId", async (req, res) => {
    try {
      const profile = await loadCommunityUserProfile(String(req.params.userId || ""));
      res.json({
        id: profile.id,
        name: profile.name,
        email: profile.email || "user@example.com",
        picture: profile.picture,
        profession: profile.profession,
      });
    } catch (error) {
      console.error("Community user profile fetch error:", error);
      res.status(500).json({ error: "Kunne ikke hente brukerprofil" });
    }
  });
}
