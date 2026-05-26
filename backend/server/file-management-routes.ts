import express from "express";
import type { Pool } from "pg";
import { readString, readOptionalIsoDate } from "./_shared";

export interface FileManagementRoutesDeps {
  app: express.Application;
  pool: Pool;
  compatResolveUserId: (req: any) => string;
  resolveActiveSessionFromRequest: (req: any) => any;
  isLocalDevelopmentWorkspaceUserId: (
    userId: string | null | undefined,
  ) => boolean;
  isMissingRelationError: (err: unknown) => boolean;
  ensureGoogleWorkspaceConnectionsSchema: (pool: Pool) => Promise<void>;
  resolveRoleRoomGoogleConnection: (...args: any[]) => Promise<any>;
  selectFallbackRoleRoomConnection: (...args: any[]) => Promise<any>;
  derivePreferredGoogleWorkspaceOauthApps: (...args: any[]) => any;
  hasAnyGrantedScope: (...args: any[]) => boolean;
  readGrantedGoogleScopes: (...args: any[]) => string[];
  buildGoogleContactsStatusSnapshot: (...args: any[]) => Promise<any>;
}

export function setupFileManagementRoutes(
  deps: FileManagementRoutesDeps,
): void {
  const {
    app,
    pool,
    compatResolveUserId,
    resolveActiveSessionFromRequest,
    isLocalDevelopmentWorkspaceUserId,
    isMissingRelationError,
    ensureGoogleWorkspaceConnectionsSchema,
    resolveRoleRoomGoogleConnection,
    selectFallbackRoleRoomConnection,
    derivePreferredGoogleWorkspaceOauthApps,
    hasAnyGrantedScope,
    readGrantedGoogleScopes,
    buildGoogleContactsStatusSnapshot,
  } = deps;

  app.get("/api/file-management/health", async (req, res) => {
    const headerUserId = readString(req.headers["x-user-id"]);
    const queryUserId = readString(req.query.userId);
    const userId = queryUserId || headerUserId;

    try {
      let activeOperations = 0;
      let googleDriveConnected = false;
      let syncStatus = "unknown";

      try {
        const syncParams: string[] = [];
        const syncFilters: string[] = [
          `status IN ('pending','running','processing')`,
        ];
        if (userId) {
          syncParams.push(userId);
          syncFilters.push(`user_id = $${syncParams.length}`);
        }

        const syncResult = await pool.query(
          `SELECT COUNT(*)::int AS count
           FROM file_sync_jobs
           WHERE ${syncFilters.join(" AND ")}`,
          syncParams,
        );
        activeOperations = Number(syncResult.rows[0]?.count || 0);
        syncStatus = "online";
      } catch (syncError) {
        if (!isMissingRelationError(syncError)) {
          console.warn("file_sync_jobs health probe failed:", syncError);
        }
        syncStatus = "degraded";
      }

      try {
        const driveParams: string[] = [];
        const driveFilters: string[] = [
          `connection_status = 'connected'`,
          `sync_enabled = true`,
        ];
        if (userId) {
          driveParams.push(userId);
          driveFilters.push(`user_id = $${driveParams.length}`);
        }

        const driveResult = await pool.query(
          `SELECT COUNT(*)::int AS count
           FROM google_drive_connections
           WHERE ${driveFilters.join(" AND ")}`,
          driveParams,
        );
        googleDriveConnected = Number(driveResult.rows[0]?.count || 0) > 0;
      } catch (driveError) {
        if (!isMissingRelationError(driveError)) {
          console.warn(
            "google_drive_connections health probe failed:",
            driveError,
          );
        }
      }

      res.json({
        status: "ok",
        uploadService: "online",
        downloadService: "online",
        storageService: syncStatus === "online" ? "online" : "degraded",
        activeOperations,
        integrations: {
          googleDriveConnected,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("File management health check failed:", error);
      res.status(500).json({
        status: "error",
        uploadService: "offline",
        downloadService: "offline",
        storageService: "offline",
        activeOperations: 0,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /api/file-management/stats — activity counters for uploads/downloads/sync jobs
  app.get("/api/file-management/stats", async (req, res) => {
    const headerUserId = readString(req.headers["x-user-id"]);
    const queryUserId = readString(req.query.userId);
    const userId = queryUserId || headerUserId;

    try {
      const scopedFilter = userId ? "WHERE user_id = $1" : "";
      const scopedParams = userId ? [userId] : [];

      const [syncResult, uploadsResult, downloadsResult, failedSyncResult] =
        await Promise.all([
          pool
            .query(
              `SELECT COUNT(*)::int AS count
             FROM file_sync_jobs
             ${scopedFilter ? `${scopedFilter} AND status IN ('pending','running','processing')` : "WHERE status IN ('pending','running','processing')"}`,
              scopedParams,
            )
            .catch(() => ({ rows: [{ count: 0 }] })),
          pool
            .query(
              `SELECT COUNT(*)::int AS count
             FROM file_uploads
             ${scopedFilter}`,
              scopedParams,
            )
            .catch(() => ({ rows: [{ count: 0 }] })),
          pool
            .query(
              `SELECT COUNT(*)::int AS count
             FROM file_downloads
             ${scopedFilter}`,
              scopedParams,
            )
            .catch(() => ({ rows: [{ count: 0 }] })),
          pool
            .query(
              `SELECT COUNT(*)::int AS count
             FROM file_sync_jobs
             ${scopedFilter ? `${scopedFilter} AND status = 'failed'` : "WHERE status = 'failed'"}`,
              scopedParams,
            )
            .catch(() => ({ rows: [{ count: 0 }] })),
        ]);

      const activeOperations = Number(syncResult.rows[0]?.count || 0);
      const uploadCompleted = Number(uploadsResult.rows[0]?.count || 0);
      const downloadCompleted = Number(downloadsResult.rows[0]?.count || 0);
      const failedOperations = Number(failedSyncResult.rows[0]?.count || 0);

      res.json({
        activeOperations,
        upload: {
          active: activeOperations,
          completed: uploadCompleted,
          failed: failedOperations,
        },
        download: {
          active: 0,
          completed: downloadCompleted,
          failed: failedOperations,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("File management stats failed:", error);
      res.status(500).json({
        activeOperations: 0,
        upload: { active: 0, completed: 0, failed: 0 },
        download: { active: 0, completed: 0, failed: 0 },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // GET /api/file-management/google-drive/status — verify Google Drive integration health
  app.get("/api/file-management/google-drive/status", async (req, res) => {
    try {
      await ensureGoogleWorkspaceConnectionsSchema(pool);

      const isLocalDevelopmentWorkspaceUserId = (
        value: string | null | undefined,
      ): boolean =>
        typeof value === "string" &&
        (value === "local-admin" ||
          value === "dev-local-user" ||
          value.startsWith("dev-"));

      const resolvedSession = await resolveActiveSessionFromRequest(req);
      const normalizedUserId =
        readString(req.query.userId) ||
        readString(req.headers["x-user-id"]) ||
        resolvedSession?.userId ||
        compatResolveUserId(req);
      if (!normalizedUserId || normalizedUserId === "guest") {
        return res.status(200).json({
          connected: false,
          status: "disconnected",
          syncEnabled: false,
          accountEmail: null,
          lastSync: null,
          message: "Ingen bruker valgt for Google Drive.",
        });
      }

      const configuredWorkspaceEmail =
        typeof process.env.GOOGLE_WORKSPACE_EMAIL === "string" &&
        process.env.GOOGLE_WORKSPACE_EMAIL.trim().length > 0
          ? process.env.GOOGLE_WORKSPACE_EMAIL.trim().toLowerCase()
          : null;
      const configuredWorkspaceDomain = configuredWorkspaceEmail?.includes("@")
        ? configuredWorkspaceEmail.split("@")[1] || null
        : null;
      const selectFallbackRoleRoomConnection = async (
        extraClause?: string,
        params: string[] = [],
      ): Promise<Record<string, unknown> | null> => {
        const whereClause = extraClause
          ? `connection_state = 'connected'
             AND (refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)
             AND ${extraClause}`
          : `connection_state = 'connected'
             AND (refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)`;
        const result = await pool.query(
          `SELECT user_id, google_email, scopes, updated_at
           FROM role_room_google_connections
           WHERE ${whereClause}
           ORDER BY
             CASE WHEN oauth_app = 'creatorhub' THEN 0 WHEN oauth_app = 'role_room' THEN 1 ELSE 2 END,
             CASE WHEN refresh_token_encrypted IS NOT NULL THEN 0 ELSE 1 END,
             last_used_at DESC NULLS LAST,
             updated_at DESC NULLS LAST,
             created_at DESC NULLS LAST
           LIMIT 1`,
          params,
        );
        return (result.rows[0] ?? null) as Record<string, unknown> | null;
      };

      const roleRoomResult = await pool.query(
        `SELECT user_id, google_email, scopes, updated_at
         FROM role_room_google_connections
         WHERE connection_state = 'connected'
           AND (refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)
           AND user_id = $1
         ORDER BY CASE WHEN oauth_app = 'creatorhub' THEN 0 WHEN oauth_app = 'role_room' THEN 1 ELSE 2 END,
                  last_used_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         LIMIT 1`,
        [normalizedUserId],
      );

      const roleRoomRow = (roleRoomResult.rows[0] ?? null) as Record<
        string,
        unknown
      > | null;
      let resolvedRoleRoomRow = roleRoomRow;
      let roleRoomSource = "google-workspace";

      if (!resolvedRoleRoomRow && isLocalDevelopmentWorkspaceUserId(normalizedUserId)) {
        if (configuredWorkspaceDomain) {
          const workspaceDomainCount = await pool.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count
             FROM role_room_google_connections
             WHERE connection_state = 'connected'
               AND (refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)
               AND LOWER(split_part(google_email, '@', 2)) = LOWER($1)`,
            [configuredWorkspaceDomain],
          );
          if (
            Number.parseInt(workspaceDomainCount.rows[0]?.count ?? "0", 10) === 1
          ) {
            resolvedRoleRoomRow = await selectFallbackRoleRoomConnection(
              `LOWER(split_part(google_email, '@', 2)) = LOWER($1)`,
              [configuredWorkspaceDomain],
            );
          }
        }

        if (!resolvedRoleRoomRow) {
          const corporateConnectionCount = await pool.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count
             FROM role_room_google_connections
             WHERE connection_state = 'connected'
               AND (refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)
               AND google_email IS NOT NULL
               AND LOWER(split_part(google_email, '@', 2)) NOT IN ('gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'icloud.com')`,
          );
          if (
            Number.parseInt(
              corporateConnectionCount.rows[0]?.count ?? "0",
              10,
            ) === 1
          ) {
            resolvedRoleRoomRow = await selectFallbackRoleRoomConnection(
              `google_email IS NOT NULL
               AND LOWER(split_part(google_email, '@', 2)) NOT IN ('gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'icloud.com')`,
            );
          }
        }

        if (!resolvedRoleRoomRow) {
          const fallbackCountResult = await pool.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count
             FROM role_room_google_connections
             WHERE connection_state = 'connected'
               AND (refresh_token_encrypted IS NOT NULL OR access_token_encrypted IS NOT NULL)`,
          );
          if (
            Number.parseInt(fallbackCountResult.rows[0]?.count ?? "0", 10) === 1
          ) {
            resolvedRoleRoomRow = await selectFallbackRoleRoomConnection();
          }
        }

        if (resolvedRoleRoomRow) {
          roleRoomSource = "google-workspace-dev-fallback";
        }
      }

      if (resolvedRoleRoomRow) {
        const scopes = readGrantedGoogleScopes(resolvedRoleRoomRow.scopes);
        const driveEnabled = hasAnyGrantedScope(scopes, [
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/drive",
          "https://www.googleapis.com/auth/drive.readonly",
        ]);
        const roleRoomConnectionUserId =
          readString(resolvedRoleRoomRow.user_id) || normalizedUserId;

        try {
          const authorized = await resolveRoleRoomGoogleConnection(
            pool,
            roleRoomConnectionUserId,
            { preferredOauthApps: derivePreferredGoogleWorkspaceOauthApps(req) },
          );
          return res.status(200).json({
            connected: driveEnabled,
            status: driveEnabled ? "connected" : "missing_scope",
            syncEnabled: driveEnabled,
            accountEmail:
              authorized.connection.googleEmail ||
              readString(resolvedRoleRoomRow.google_email) ||
              null,
            lastSync: readOptionalIsoDate(resolvedRoleRoomRow.updated_at),
            message: driveEnabled
              ? null
              : "Google Workspace er koblet til, men mangler Google Drive-scope.",
            source: roleRoomSource,
          });
        } catch (error) {
          return res.status(200).json({
            connected: false,
            status: "error",
            syncEnabled: false,
            accountEmail: readString(resolvedRoleRoomRow.google_email) || null,
            lastSync: readOptionalIsoDate(resolvedRoleRoomRow.updated_at),
            message:
              error instanceof Error
                ? error.message
                : "Kunne ikke verifisere Google Drive-tilkoblingen.",
            source: roleRoomSource,
          });
        }
      }

      const legacyResult = await pool.query(
        `SELECT user_id, google_account_email, connection_status, sync_enabled, last_sync, updated_at
         FROM google_drive_connections
         WHERE user_id = $1
         ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
         LIMIT 1`,
        [normalizedUserId],
      );

      if (!legacyResult.rows.length) {
        return res.status(200).json({
          connected: false,
          status: "disconnected",
          syncEnabled: false,
          accountEmail: null,
          lastSync: null,
          message: "Google Workspace er ikke koblet til denne brukeren.",
          source: null,
        });
      }

      const legacyRow = legacyResult.rows[0] as Record<string, unknown>;
      const legacyConnected =
        String(legacyRow.connection_status || "").toLowerCase() === "connected" &&
        Boolean(legacyRow.sync_enabled);

      res.status(200).json({
        connected: legacyConnected,
        status: legacyConnected
          ? "connected"
          : String(legacyRow.connection_status || "disconnected"),
        syncEnabled: Boolean(legacyRow.sync_enabled),
        accountEmail: legacyRow.google_account_email || null,
        lastSync: legacyRow.last_sync || null,
        message: legacyConnected
          ? null
          : "Legacy Google Drive-tilkobling er ikke aktiv.",
        source: "legacy-google-drive",
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(200).json({
          connected: false,
          status: "unavailable",
          message: "Google Drive integration table not available",
        });
      }
      console.error("Google Drive status check failed:", error);
      res.status(500).json({
        connected: false,
        status: "error",
        message: "Failed to check Google Drive status",
      });
    }
  });

  // GET /api/file-management/google-photos/status — verify Google Photos integration health
  app.get("/api/file-management/google-photos/status", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS items, MAX(last_synced) AS last_synced
         FROM google_photos`,
      );

      const items = Number(result.rows[0]?.items || 0);
      const lastSynced = result.rows[0]?.last_synced || null;

      if (items === 0) {
        return res.status(200).json({
          connected: false,
          status: "disconnected",
          itemsSynced: 0,
          lastSynced: null,
        });
      }

      res.json({
        connected: true,
        status: "connected",
        itemsSynced: items,
        lastSynced,
      });
    } catch (error) {
      if (isMissingRelationError(error)) {
        return res.status(200).json({
          connected: false,
          status: "unavailable",
          itemsSynced: 0,
          lastSynced: null,
        });
      }
      console.error("Google Photos status check failed:", error);
      res.status(500).json({
        connected: false,
        status: "error",
        itemsSynced: 0,
        lastSynced: null,
      });
    }
  });

  app.get("/api/file-management/google-contacts/status", async (req, res) => {
    try {
      const userId =
        readString(req.query.userId) ||
        readString(req.headers["x-user-id"]) ||
        "guest";
      const snapshot = await buildGoogleContactsStatusSnapshot(
        userId,
        derivePreferredGoogleWorkspaceOauthApps(req),
      );
      res.json(snapshot);
    } catch (error) {
      console.error("Error fetching Google Contacts status:", error);
      res.status(500).json({
        connected: false,
        status: "error",
        readEnabled: false,
        writeEnabled: false,
        accountEmail: null,
        scopes: [],
        lastChecked: new Date().toISOString(),
        message: "Kunne ikke hente Google Contacts-status.",
      });
    }
  });
}
