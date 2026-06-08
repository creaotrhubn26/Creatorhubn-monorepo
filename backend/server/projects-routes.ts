import express from "express";
import type { Pool } from "pg";
import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";
import { readString } from "./_shared";

export interface ProjectsRoutesDeps {
  app: express.Application;
  pool: Pool;
  mapProjectRow: (r: any) => any;
  getUserIdFromAuth: (req: any) => string | null;
  compatResolveUserId: (req: any) => string;
  compatStoreSet: (key: string, value: unknown) => Promise<void>;
  buildGalleryShareUrl: (accessToken: string) => string;
  bootstrapCaptureSessionForProject: (...args: any[]) => Promise<any>;
  createDriveUploadBatch: (...args: any[]) => Promise<any>;
  fetchDriveUploadBatch: (...args: any[]) => Promise<any>;
  dbCompatProjectStateKey: (projectId: string) => string;
  dispatchClientGalleryNotification: (...args: any[]) => Promise<void>;
  ensureCompatProjectState: (projectId: string) => {
    collaborators: Array<Record<string, unknown>>;
    files: Array<Record<string, unknown>>;
    comments: Array<Record<string, unknown>>;
    integrations: Record<string, Record<string, unknown>>;
    permissions: Record<string, unknown>;
    compliance: Record<string, unknown>;
    auditTrail: Array<Record<string, unknown>>;
  };
  isLocalDevelopmentWorkspaceUserId: (
    userId: string | null | undefined,
  ) => boolean;
  listProjectChangeLog: (
    pool: Pool,
    params: { projectId: string; limit?: number; before?: string | null },
  ) => Promise<any[]>;
  loadCompatProjectState: (projectId: string) => Promise<{
    collaborators: Array<Record<string, unknown>>;
    files: Array<Record<string, unknown>>;
    comments: Array<Record<string, unknown>>;
    integrations: Record<string, Record<string, unknown>>;
    permissions: Record<string, unknown>;
    compliance: Record<string, unknown>;
    auditTrail: Array<Record<string, unknown>>;
  }>;
  persistCompatProjectState: (projectId: string, state: any) => Promise<void>;
  compatProjectStateStore: Map<string, any>;
  PROJECT_FILE_STORAGE_ROOT: string;
  PROJECT_FILE_DB_INLINE_MAX_BYTES: number;
  projectFileUpload: any;
  db: any;
  recordAnalyticsEvent: (eventType: string, opts: any) => void;
  resolveMeetingNotesProjectContext: (...args: any[]) => Promise<any>;
  upsertShotListForProject: (...args: any[]) => Promise<any>;
}

export function setupProjectsRoutes(deps: ProjectsRoutesDeps): void {
  const {
    app,
    pool,
    mapProjectRow,
    getUserIdFromAuth,
    compatResolveUserId,
    compatStoreSet,
    buildGalleryShareUrl,
    bootstrapCaptureSessionForProject,
    createDriveUploadBatch,
    fetchDriveUploadBatch,
    dbCompatProjectStateKey,
    dispatchClientGalleryNotification,
    ensureCompatProjectState,
    isLocalDevelopmentWorkspaceUserId,
    listProjectChangeLog,
    loadCompatProjectState,
    persistCompatProjectState,
    compatProjectStateStore,
    PROJECT_FILE_STORAGE_ROOT,
    PROJECT_FILE_DB_INLINE_MAX_BYTES,
    projectFileUpload,
    db,
    recordAnalyticsEvent,
    resolveMeetingNotesProjectContext,
    upsertShotListForProject,
  } = deps;

  app.get("/api/projects", async (req, res) => {
    try {
      const authUserId = readString(getUserIdFromAuth(req));
      const queryUserId = readString(req.query.userId);
      const profession = readString(req.query.profession);
      const status = readString(req.query.status);
      const customerId =
        readString(req.query.customerId) || readString(req.query.clientId);
      const requestedUserId = queryUserId || authUserId;
      const isLocalDevelopmentWorkspaceUserId = (
        value: string | null | undefined,
      ): boolean =>
        typeof value === "string" &&
        (value === "local-admin" ||
          value === "dev-local-user" ||
          value.startsWith("dev-"));
      const scopedUserId =
        requestedUserId && !isLocalDevelopmentWorkspaceUserId(requestedUserId)
          ? requestedUserId
          : null;
      let query = "SELECT * FROM legacy.projects";
      const params: any[] = [];
      let idx = 1;
      const filters: string[] = [];

      if (customerId) {
        filters.push(`customer_id = $${idx++}`);
        params.push(customerId);
      }

      if (profession) {
        filters.push(`profession = $${idx++}`);
        params.push(profession);
      }

      if (status) {
        filters.push(`status = $${idx++}`);
        params.push(status);
      }

      if (scopedUserId) {
        filters.push(`user_id = $${idx++}`);
        params.push(scopedUserId);
      }

      if (filters.length > 0) {
        query += ` WHERE ${filters.join(" AND ")}`;
      }

      query += " ORDER BY created_at DESC";

      const result = await pool.query(query, params);
      res.json(result.rows.map(mapProjectRow));
    } catch (error) {
      // Manglende legacy.projects-tabell (eller schema-drift) skal ikke krasje
      // dashbord-load. Returner tom liste i stedet for 500.
      console.warn("[projects] list degraded:", (error as any)?.message || error);
      res.json([]);
    }
  });

  // GET /api/projects/:id — get single project
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM legacy.projects WHERE id = $1",
        [req.params.id],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Prosjekt ikke funnet" });
      }
      const project = mapProjectRow(result.rows[0]);
      const meetingContext = await resolveMeetingNotesProjectContext(req.params.id);
      res.json({
        ...project,
        submissionId: readString(meetingContext?.submission_id) || undefined,
        inquirySummary: readString(meetingContext?.inquiry_description) || undefined,
        specialRequests:
          readString(meetingContext?.inquiry_special_requests) || undefined,
        briefSummary: readString(meetingContext?.request_summary) || undefined,
        inquiryLocation: readString(meetingContext?.inquiry_location) || undefined,
        inquiryEventDate:
          readString(meetingContext?.inquiry_event_date) || undefined,
        inquiryTimeframe:
          readString(meetingContext?.inquiry_timeframe) || undefined,
      });
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ error: "Kunne ikke hente prosjekt" });
    }
  });

  // GET /api/projects/:id/change-log — paged list of noteworthy
  // project events (client hearts, quote/contract signatures). Used
  // by the iPad Context panel timeline + future web activity feed.
  //
  // Owner-gated: the request's bearer must match ``projects.user_id``
  // so one photographer can't browse another's client activity.
  app.get("/api/projects/:id/change-log", async (req, res) => {
    try {
      const userId = getUserIdFromAuth(req);
      if (!userId) return res.status(401).json({ error: "unauthorized" });
      const owns = await pool.query(
        "SELECT 1 FROM legacy.projects WHERE id = $1 AND user_id = $2 LIMIT 1",
        [req.params.id, userId],
      );
      if (owns.rowCount === 0) {
        // Returning 404 instead of 403 so callers can't enumerate
        // projects by probing ids.
        return res.status(404).json({ error: "not_found" });
      }
      const limit = Number(req.query.limit ?? 50);
      const before =
        typeof req.query.before === "string" && req.query.before.length > 0
          ? req.query.before
          : null;
      const entries = await listProjectChangeLog(pool, {
        projectId: req.params.id,
        limit,
        before,
      });

      // Enrich `asset.hearted` / `asset.commented` entries with the
      // hearted image's thumbnail URL so the photographer's activity
      // banner can show WHICH image the client liked — not just that
      // they liked one. Single batched query for every assetId in the
      // page rather than N round-trips.
      const assetIds = new Set<string>();
      for (const entry of entries) {
        if (entry.kind !== "asset.hearted" && entry.kind !== "asset.commented") continue;
        const assetId = (entry.payload as Record<string, unknown>)?.assetId;
        if (typeof assetId === "string" && assetId.trim()) assetIds.add(assetId);
      }
      if (assetIds.size > 0) {
        try {
          const thumbRows = await pool.query<{
            id: string;
            thumbnail_url: string | null;
            image_title: string | null;
          }>(
            `SELECT id, thumbnail_url, image_title
               FROM client_gallery_images
              WHERE id = ANY($1::uuid[])`,
            [Array.from(assetIds)],
          );
          const thumbById = new Map<
            string,
            { thumbnailUrl: string | null; title: string | null }
          >();
          for (const row of thumbRows.rows) {
            thumbById.set(row.id, {
              thumbnailUrl: row.thumbnail_url,
              title: row.image_title,
            });
          }
          for (const entry of entries) {
            const assetId = (entry.payload as Record<string, unknown>)?.assetId;
            if (typeof assetId !== "string") continue;
            const thumb = thumbById.get(assetId);
            if (!thumb) continue;
            (entry.payload as Record<string, unknown>).thumbnailUrl = thumb.thumbnailUrl;
            (entry.payload as Record<string, unknown>).imageTitle = thumb.title;
          }
        } catch (err) {
          // Non-fatal — the banner degrades to text-only if enrichment
          // fails, which is exactly what it did before this patch.
          console.warn("[project-change-log] thumbnail enrichment failed", err);
        }
      }

      res.json({ entries });
    } catch (error) {
      // Manglende change-log-tabell skal ikke krasje aktivitets-banner.
      // Returner tom liste i stedet for 500.
      console.warn("[project-change-log] degraded:", (error as any)?.message || error);
      res.json({ entries: [] });
    }
  });

  // MARK: Drive batch upload pipeline ----------------------------------
  //
  // POST /api/drive/batches — create a new batch; body carries the
  // items (deduped server-side so the returned count is honest).
  // GET  /api/drive/batches/:id — batch snapshot + progress.
  //
  // The orchestrator runs via ``advanceBatch`` calls driven by a
  // separate worker (out of scope here; see drive-batch-upload-wiring
  // for the live hookup). These routes are the create + read side
  // only — safe to ship independently of the worker.

  app.post("/api/drive/batches", async (req, res) => {
    try {
      const userId = getUserIdFromAuth(req);
      if (!userId) return res.status(401).json({ error: "unauthorized" });

      const body = req.body ?? {};
      const projectId =
        typeof body.projectId === "string" && body.projectId.length > 0
          ? body.projectId
          : null;
      const rawItems = Array.isArray(body.items) ? body.items : [];
      const items = rawItems
        .map((entry: unknown) => {
          if (!entry || typeof entry !== "object") return null;
          const obj = entry as Record<string, unknown>;
          const required =
            typeof obj.localId === "string" &&
            obj.localId.length > 0 &&
            typeof obj.localPath === "string" &&
            typeof obj.driveName === "string" &&
            obj.driveName.length > 0 &&
            typeof obj.targetFolderId === "string" &&
            obj.targetFolderId.length > 0 &&
            typeof obj.mimeType === "string" &&
            typeof obj.checksumSha256 === "string" &&
            obj.checksumSha256.length > 0;
          if (!required) return null;
          const size = Number(obj.sizeBytes);
          if (!Number.isFinite(size) || size < 0) return null;
          return {
            localId: obj.localId as string,
            localPath: obj.localPath as string,
            driveName: obj.driveName as string,
            targetFolderId: obj.targetFolderId as string,
            mimeType: obj.mimeType as string,
            sizeBytes: size,
            checksumSha256: obj.checksumSha256 as string,
          };
        })
        .filter((item: unknown): item is NonNullable<typeof item> => item !== null);

      if (items.length === 0) {
        return res.status(400).json({ error: "no_valid_items" });
      }

      const result = await createDriveUploadBatch(pool, {
        userId,
        projectId,
        items,
      });
      res.status(201).json({
        batchId: result.batchId,
        dedupedCount: result.dedupedCount,
        duplicateLocalIds: result.duplicateLocalIds,
      });
    } catch (error) {
      console.error("[drive-batch] create failed", error);
      res.status(500).json({ error: "create_failed" });
    }
  });

  app.get("/api/drive/batches/:id", async (req, res) => {
    try {
      const userId = getUserIdFromAuth(req);
      if (!userId) return res.status(401).json({ error: "unauthorized" });
      const snapshot = await fetchDriveUploadBatch(pool, userId, req.params.id);
      if (!snapshot) {
        // 404 — we don't distinguish "your batch doesn't exist" from
        // "someone else's batch" to avoid batch-id enumeration.
        return res.status(404).json({ error: "not_found" });
      }
      res.json(snapshot);
    } catch (error) {
      console.error("[drive-batch] fetch failed", error);
      res.status(500).json({ error: "fetch_failed" });
    }
  });

  // POST /api/projects — create new project
  app.post("/api/projects", async (req, res) => {
    try {
      const userId = getUserIdFromAuth(req);
      const data = req.body;

      // Build the project name
      const projectName =
        data.projectName ||
        data.name ||
        data.title ||
        `${data.projectType || "prosjekt"} - ${data.clientName || "ukjent"}`;

      // Build settings & metadata JSON
      const settings = {
        showcaseSettings: data.showcaseGallerySecurity || {},
        downloadProtection: data.downloadProtection || "none",
        watermark: data.watermark || "none",
        clientAccess: data.clientAccess || "full",
        pricing: data.pricing || {},
        meetingPreferences: {
          meetingOption: data.meetingOption || "auto",
          meetingTime: data.meetingTime || null,
          meetingDuration: data.meetingDuration || 60,
        },
        ...(data.settings || {}),
      };

      const metadata = {
        totalDays: data.totalDays || 1,
        activeDays: data.activeDays || [1],
        memoryCardConfigs: data.memoryCardConfigs || [],
        customCategories: data.customCategories || [],
        customDayNames: data.customDayNames || [],
        selectedMemoryCards: data.selectedMemoryCards || [],
        enhancedMemoryCardSelection: data.enhancedMemoryCardSelection || [],
        selectedCameras: data.selectedCameras || [],
        shotList: data.shotList || [],
        collaborators: data.collaborators || [],
        weddingCulture: data.weddingCulture || null,
        primaryCamera: data.primaryCamera || null,
        backupCamera: data.backupCamera || null,
        fileFormat: data.fileFormat || "RAW+JPEG",
        equipmentNotes: data.equipmentNotes || "",
        backupStrategy: data.backupStrategy || "dual-card",
        backupFrequency: data.backupFrequency || "continuous",
        estimatedPhotos: data.estimatedPhotos || 0,
        guestCount: data.guestCount || "",
        venue: data.venue || "",
        editingSoftware: data.editingSoftware || null,
        driveIntegration: data.driveIntegration || false,
        memoryCardBudget: data.memoryCardBudget || null,
        submissionId: data.submissionId || null,
        ...(data.metadata || {}),
      };

      const projectId = crypto.randomUUID();
      const customerId = data.customerId || data.customer_id || null;

      const result = await pool.query(
        `INSERT INTO legacy.projects 
          (id, user_id, title, name, description, profession, category, status,
           client_email, client_phone, date, event_date, location, budget,
           settings, metadata, customer_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
         RETURNING *`,
        [
          projectId,
          userId,
          projectName,
          projectName,
          data.description || "",
          data.profession || "photographer",
          data.projectType || "wedding",
          data.clientEmail || "",
          data.clientPhone || "",
          data.eventDate || null,
          data.eventDate || null,
          data.location || "",
          data.budget || null,
          JSON.stringify(settings),
          JSON.stringify(metadata),
          customerId,
        ],
      );

      const project = mapProjectRow(result.rows[0]);
      console.log(
        `🎬 Nytt prosjekt opprettet: "${projectName}" (${projectId}) av ${userId}${customerId ? ` for kunde ${customerId}` : ""}`,
      );

      // If created from CRM customer, link project back to customer
      if (customerId) {
        await pool
          .query(
            `UPDATE crm_customers SET project_id = $1, status = 'active', updated_at = NOW() WHERE id = $2`,
            [projectId, customerId],
          )
          .catch((err: any) =>
            console.error("Failed to link project to CRM customer:", err.message),
          );
      }

      // If this project came from a submission, update submission status
      if (data.submissionId) {
        await pool
          .query(
            `UPDATE client_submissions SET status = 'booked', updated_at = NOW() WHERE id = $1`,
            [data.submissionId],
          )
          .catch(() => {});
      }

      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ error: "Kunne ikke opprette prosjekt" });
    }
  });

  // PUT /api/projects/:id — update project
  app.put("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;

      // Slice 9X.15 — capture old status BEFORE update so we can detect
      // milestone transitions and notify clients exactly once. Wrapped in
      // its own try because a missing project would just mean the update
      // below also returns 404 — the notification logic skips on null.
      let oldStatus: string | null = null;
      try {
        const before = await pool.query(
          `SELECT status FROM legacy.projects WHERE id = $1 LIMIT 1`,
          [id],
        );
        oldStatus = (before.rows[0]?.status ?? null) as string | null;
      } catch (_err) {
        // Non-fatal — skip notification path on lookup error.
      }

      // Build dynamic SET clause
      const updates: string[] = ["updated_at = NOW()"];
      const params: any[] = [];
      let paramIdx = 1;

      const fieldMap: Record<string, string> = {
        name: "name",
        title: "title",
        description: "description",
        status: "status",
        location: "location",
        profession: "profession",
        clientName: "client_name",
        clientEmail: "client_email",
        clientPhone: "client_phone",
        projectType: "category",
        eventDate: "date",
      };

      for (const [key, col] of Object.entries(fieldMap)) {
        if (data[key] !== undefined) {
          updates.push(`${col} = $${paramIdx++}`);
          params.push(data[key]);
        }
      }

      if (data.budget !== undefined) {
        updates.push(`budget = $${paramIdx++}`);
        params.push(data.budget);
      }
      if (data.settings) {
        updates.push(
          `settings = COALESCE(settings, '{}')::jsonb || $${paramIdx++}::jsonb`,
        );
        params.push(JSON.stringify(data.settings));
      }
      if (data.metadata) {
        updates.push(
          `metadata = COALESCE(metadata, '{}')::jsonb || $${paramIdx++}::jsonb`,
        );
        params.push(JSON.stringify(data.metadata));
      }

      params.push(id);
      const result = await pool.query(
        `UPDATE legacy.projects SET ${updates.join(", ")} WHERE id = $${paramIdx} RETURNING *`,
        params,
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Prosjekt ikke funnet" });
      }

      // Slice 9X.15 — milestone notification. Fire-and-forget so the
      // PUT response isn't held up by SMTP. Only triggers on transitions
      // INTO the meaningful client-facing milestones (idempotent — same
      // status PATCH'd twice doesn't double-notify).
      const newStatus = typeof data.status === 'string' ? data.status : null;
      const MILESTONE_STATUSES = new Set(['ready_for_review', 'completed', 'editing']);
      if (newStatus && newStatus !== oldStatus) {
        // Analytics — alle status-overganger logges (ikke bare milestones)
        // så BI kan rekonstruere full prosjekt-flyt.
        recordAnalyticsEvent('project.status_changed', {
          entityType: 'project',
          entityId: String(id),
          actorUserId: typeof getUserIdFromAuth === 'function' ? readString(getUserIdFromAuth(req)) ?? null : null,
          metadata: {
            oldStatus: oldStatus ?? null,
            newStatus,
            isMilestone: MILESTONE_STATUSES.has(newStatus),
          },
        });
      }
      if (newStatus && newStatus !== oldStatus && MILESTONE_STATUSES.has(newStatus)) {
        const projectRow = result.rows[0];
        void (async () => {
          try {
            // Find linked galleries via gallery_settings.projectId.
            const linked = await pool.query(
              `SELECT id, access_token, client_name, client_email, project_title, photographer_id
               FROM photographer_client_galleries
               WHERE gallery_settings->>'projectId' = $1
                 AND status != 'completed'
               LIMIT 50`,
              [String(id)],
            );
            if (linked.rowCount === 0) return;
            // Photographer name for the From-line. Best-effort lookup —
            // falls back to "CreatorHub".
            let photographerName: string | null = null;
            if (projectRow.lead_creator || projectRow.photographer_id) {
              try {
                const pid = String(projectRow.photographer_id ?? projectRow.lead_creator ?? '');
                if (pid) {
                  const u = await pool.query(
                    `SELECT first_name, last_name, username FROM users WHERE id = $1 LIMIT 1`,
                    [pid],
                  );
                  const r0 = u.rows[0];
                  photographerName =
                    (r0 && [r0.first_name, r0.last_name].filter(Boolean).join(' ').trim()) ||
                    r0?.username ||
                    null;
                }
              } catch (_err) { /* ignore */ }
            }
            for (const g of linked.rows) {
              void dispatchClientGalleryNotification(
                'project_milestone',
                g.photographer_id,
                {
                  galleryId: g.id,
                  galleryTitle: g.project_title || projectRow.title || 'Prosjekt',
                  shareUrl: buildGalleryShareUrl(String(g.access_token)),
                  clientName: g.client_name,
                  clientEmail: g.client_email,
                  details: {
                    milestone: newStatus,
                    oldStatus: oldStatus ?? 'draft',
                    projectId: String(id),
                    photographerName: photographerName || 'Fotografen',
                  },
                },
              );
            }
          } catch (err) {
            console.warn('[project-milestone-notify] failed:', err);
          }
        })();
      }

      res.json(mapProjectRow(result.rows[0]));
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ error: "Kunne ikke oppdatere prosjekt" });
    }
  });

  // DELETE /api/projects/:id — delete project
  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const result = await pool.query(
        "DELETE FROM legacy.projects WHERE id = $1 RETURNING id",
        [req.params.id],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Prosjekt ikke funnet" });
      }
      res.json({ success: true, message: "Prosjekt slettet" });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ error: "Kunne ikke slette prosjekt" });
    }
  });

  async function compatReadProjectMetadata(
    projectId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const result = await pool.query(
        "SELECT metadata FROM legacy.projects WHERE id = $1 LIMIT 1",
        [projectId],
      );
      if (!result.rowCount || result.rowCount === 0) return null;
      const raw = result.rows[0]?.metadata;
      if (!raw) return {};
      if (typeof raw === "object") return raw as Record<string, unknown>;
      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          return typeof parsed === "object" && parsed ? parsed : {};
        } catch {
          return {};
        }
      }
      return {};
    } catch {
      return null;
    }
  }

  async function compatMergeProjectMetadata(
    projectId: string,
    patch: Record<string, unknown>,
  ) {
    try {
      await pool.query(
        `UPDATE legacy.projects
         SET metadata = COALESCE(metadata, '{}')::jsonb || $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(patch), projectId],
      );
    } catch {
      // Metadata persistence is best-effort for compatibility routes.
    }
  }

  function compatPushProjectAudit(
    projectId: string,
    action: string,
    details?: Record<string, unknown>,
  ) {
    const state = ensureCompatProjectState(projectId);
    state.auditTrail.unshift({
      id: crypto.randomUUID(),
      action,
      details: details || {},
      timestamp: new Date().toISOString(),
    });
    if (state.auditTrail.length > 500) state.auditTrail.length = 500;
    compatProjectStateStore.set(projectId, state);
    void compatStoreSet(dbCompatProjectStateKey(projectId), state);
  }

  // Project collaboration, files, comments, integrations, compliance, audit and analytics
  app.get("/api/projects/:projectId/collaborators", async (req, res) => {
    const { projectId } = req.params;
    const metadata = await compatReadProjectMetadata(projectId);
    const state = ensureCompatProjectState(projectId);
    if (
      metadata &&
      Array.isArray(metadata.collaborators) &&
      state.collaborators.length === 0
    ) {
      state.collaborators = metadata.collaborators as Array<
        Record<string, unknown>
      >;
    }
    res.json(state.collaborators);
  });

  app.post("/api/projects/:projectId/collaborators", async (req, res) => {
    const { projectId } = req.params;
    const state = ensureCompatProjectState(projectId);
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const collaborator = {
      id:
        readString((payload as Record<string, unknown>).id) ||
        crypto.randomUUID(),
      name:
        readString((payload as Record<string, unknown>).name) || "Collaborator",
      email: readString((payload as Record<string, unknown>).email) || "",
      role: readString((payload as Record<string, unknown>).role) || "viewer",
      permissions: Array.isArray((payload as Record<string, unknown>).permissions)
        ? (payload as Record<string, unknown>).permissions
        : ["read"],
      addedAt: new Date().toISOString(),
    };
    state.collaborators = [
      ...state.collaborators.filter((item) => item.id !== collaborator.id),
      collaborator,
    ];
    compatProjectStateStore.set(projectId, state);
    await compatMergeProjectMetadata(projectId, {
      collaborators: state.collaborators,
    });
    compatPushProjectAudit(projectId, "collaborator_added", {
      collaboratorId: collaborator.id as string,
    });
    res.status(201).json(collaborator);
  });

  app.delete(
    "/api/projects/:projectId/collaborators/:collaboratorId",
    async (req, res) => {
      const { projectId, collaboratorId } = req.params;
      const state = ensureCompatProjectState(projectId);
      state.collaborators = state.collaborators.filter(
        (item) => item.id !== collaboratorId,
      );
      compatProjectStateStore.set(projectId, state);
      await compatMergeProjectMetadata(projectId, {
        collaborators: state.collaborators,
      });
      compatPushProjectAudit(projectId, "collaborator_removed", {
        collaboratorId,
      });
      res.json({ success: true });
    },
  );

  app.put(
    "/api/projects/:projectId/collaborators/:collaboratorId/permissions",
    async (req, res) => {
      const { projectId, collaboratorId } = req.params;
      const state = ensureCompatProjectState(projectId);
      state.collaborators = state.collaborators.map((collaborator) => {
        if (collaborator.id !== collaboratorId) return collaborator;
        return {
          ...collaborator,
          permissions: Array.isArray(req.body?.permissions)
            ? req.body.permissions
            : req.body,
          updatedAt: new Date().toISOString(),
        };
      });
      compatProjectStateStore.set(projectId, state);
      await compatMergeProjectMetadata(projectId, {
        collaborators: state.collaborators,
      });
      compatPushProjectAudit(projectId, "collaborator_permissions_updated", {
        collaboratorId,
      });
      res.json({ success: true });
    },
  );

  app.post("/api/projects/:projectId/collaborators/invite", async (req, res) => {
    const { projectId } = req.params;
    const invitation = {
      id: crypto.randomUUID(),
      projectId,
      email: readString(req.body?.email) || "",
      role: readString(req.body?.role) || "viewer",
      invitedAt: new Date().toISOString(),
      status: "pending",
    };
    const state = ensureCompatProjectState(projectId);
    state.collaborators.push({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      invitedAt: invitation.invitedAt,
    });
    compatProjectStateStore.set(projectId, state);
    await compatMergeProjectMetadata(projectId, {
      collaborators: state.collaborators,
    });
    compatPushProjectAudit(projectId, "collaborator_invited", {
      invitationId: invitation.id,
    });
    res.json({ success: true, invitation });
  });

  const parseProjectFileMetadataInput = (
    rawValue: unknown,
  ): Record<string, unknown> => {
    if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
      return {};
    }
    try {
      const parsed = JSON.parse(rawValue);
      return parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  };

  async function compatProjectExistsForFiles(projectId: string): Promise<boolean> {
    const normalizedProjectId = projectId.trim();
    if (!normalizedProjectId) {
      return false;
    }

    const legacyResult = await pool
      .query("SELECT id FROM legacy.projects WHERE id = $1 LIMIT 1", [
        normalizedProjectId,
      ])
      .catch(() => ({ rowCount: 0 }));
    if ((legacyResult.rowCount || 0) > 0) {
      return true;
    }

    const castingResult = await pool
      .query("SELECT id FROM casting_projects WHERE id = $1 LIMIT 1", [
        normalizedProjectId,
      ])
      .catch(() => ({ rowCount: 0 }));
    return (castingResult.rowCount || 0) > 0;
  }

  async function requireProjectFileProject(
    res: express.Response,
    projectId: string,
  ): Promise<boolean> {
    if (!(await compatProjectExistsForFiles(projectId))) {
      res.status(404).json({ error: "project_not_found" });
      return false;
    }
    return true;
  }

  const ensureProjectFileStorageDirectory = async (
    projectId: string,
  ): Promise<string> => {
    const projectDirectory = path.join(PROJECT_FILE_STORAGE_ROOT, projectId);
    await fs.mkdir(projectDirectory, { recursive: true });
    return projectDirectory;
  };

  const toPublicProjectFileRecord = (
    fileRecord: Record<string, unknown>,
  ): Record<string, unknown> => {
    const {
      contentBase64: _contentBase64,
      contentEncoding: _contentEncoding,
      storagePath: _storagePath,
      storedName: _storedName,
      ...publicRecord
    } = fileRecord;
    return publicRecord;
  };

  app.post(
    "/api/projects/:projectId/files",
    projectFileUpload.single("file"),
    async (req, res) => {
      const { projectId } = req.params;
      if (!(await requireProjectFileProject(res, projectId))) {
        return;
      }
      if (!req.file) {
        return res.status(400).json({ error: "file is required" });
      }

      const metadata = parseProjectFileMetadataInput(req.body?.metadata);
      const projectDirectory = await ensureProjectFileStorageDirectory(projectId);
      const safeExtension = path
        .extname(req.file.originalname || "")
        .slice(0, 20);
      const storedName = `${crypto.randomUUID()}${safeExtension}`;
      const storagePath = path.join(projectDirectory, storedName);
      await fs.writeFile(storagePath, req.file.buffer);

      const state = await loadCompatProjectState(projectId);
      const fileId = crypto.randomUUID();
      const shouldInlineContent =
        PROJECT_FILE_DB_INLINE_MAX_BYTES > 0 &&
        req.file.size <= PROJECT_FILE_DB_INLINE_MAX_BYTES;
      const fileRecord = {
        id: fileId,
        projectId,
        name: req.file.originalname,
        originalName: req.file.originalname,
        storedName,
        storagePath,
        size: req.file.size,
        mimeType: req.file.mimetype,
        metadata,
        storageBackend: shouldInlineContent ? "disk+db-inline" : "disk",
        ...(shouldInlineContent
          ? {
              contentEncoding: "base64",
              contentBase64: req.file.buffer.toString("base64"),
              contentInlineBytes: req.file.size,
            }
          : {}),
        uploadedAt: new Date().toISOString(),
        downloadUrl: `/api/projects/${projectId}/files/${fileId}/download`,
      };
      state.files = [...state.files, fileRecord];
      await persistCompatProjectState(projectId, state);
      await compatMergeProjectMetadata(projectId, { files: state.files });
      compatPushProjectAudit(projectId, "file_uploaded", {
        fileId,
        name: req.file.originalname,
      });
      res.status(201).json(toPublicProjectFileRecord(fileRecord));
    },
  );

  app.get("/api/projects/:projectId/files", async (req, res) => {
    const { projectId } = req.params;
    if (!(await requireProjectFileProject(res, projectId))) {
      return;
    }
    const metadata = await compatReadProjectMetadata(projectId);
    const state = await loadCompatProjectState(projectId);
    if (metadata && Array.isArray(metadata.files) && state.files.length === 0) {
      state.files = metadata.files as Array<Record<string, unknown>>;
      await persistCompatProjectState(projectId, state);
    }
    res.json(
      state.files.map((fileRecord) =>
        toPublicProjectFileRecord(fileRecord as Record<string, unknown>),
      ),
    );
  });

  app.get("/api/projects/:projectId/files/:fileId/download", async (req, res) => {
    const { projectId, fileId } = req.params;
    if (!(await requireProjectFileProject(res, projectId))) {
      return;
    }
    const metadata = await compatReadProjectMetadata(projectId);
    const state = await loadCompatProjectState(projectId);
    if (metadata && Array.isArray(metadata.files) && state.files.length === 0) {
      state.files = metadata.files as Array<Record<string, unknown>>;
      await persistCompatProjectState(projectId, state);
    }

    const fileRecord = state.files.find((file) => file.id === fileId);
    if (!fileRecord) {
      return res.status(404).json({ error: "project_file_not_found" });
    }

    const downloadName =
      readString((fileRecord as Record<string, unknown>).originalName) ||
      readString((fileRecord as Record<string, unknown>).name) ||
      `project-file-${fileId}`;

    const storagePath = readString(
      (fileRecord as Record<string, unknown>).storagePath,
    );
    if (!storagePath || !existsSync(storagePath)) {
      const inlineContent = readString(
        (fileRecord as Record<string, unknown>).contentBase64,
      );
      if (!inlineContent) {
        return res.status(404).json({ error: "project_file_content_not_found" });
      }
      const buffer = Buffer.from(inlineContent, "base64");
      res.setHeader(
        "Content-Type",
        readString((fileRecord as Record<string, unknown>).mimeType) ||
          "application/octet-stream",
      );
      res.attachment(downloadName);
      res.send(buffer);
      return;
    }

    res.setHeader(
      "Content-Type",
      readString((fileRecord as Record<string, unknown>).mimeType) ||
        "application/octet-stream",
    );
    res.download(storagePath, downloadName);
  });

  app.put("/api/projects/:projectId/files/:fileId", async (req, res) => {
    const { projectId, fileId } = req.params;
    if (!(await requireProjectFileProject(res, projectId))) {
      return;
    }
    const state = await loadCompatProjectState(projectId);
    if (!state.files.some((file) => file.id === fileId)) {
      return res.status(404).json({ error: "project_file_not_found" });
    }
    state.files = state.files.map((file) =>
      file.id === fileId
        ? { ...file, ...(req.body || {}), updatedAt: new Date().toISOString() }
        : file,
    );
    await persistCompatProjectState(projectId, state);
    await compatMergeProjectMetadata(projectId, { files: state.files });
    compatPushProjectAudit(projectId, "file_updated", { fileId });
    res.json({ success: true });
  });

  app.delete("/api/projects/:projectId/files/:fileId", async (req, res) => {
    const { projectId, fileId } = req.params;
    if (!(await requireProjectFileProject(res, projectId))) {
      return;
    }
    const state = await loadCompatProjectState(projectId);
    const fileRecord = state.files.find((file) => file.id === fileId);
    if (!fileRecord) {
      return res.status(404).json({ error: "project_file_not_found" });
    }
    const storagePath = fileRecord
      ? readString((fileRecord as Record<string, unknown>).storagePath)
      : "";
    state.files = state.files.filter((file) => file.id !== fileId);
    await persistCompatProjectState(projectId, state);
    await compatMergeProjectMetadata(projectId, { files: state.files });
    compatPushProjectAudit(projectId, "file_deleted", { fileId });
    if (storagePath && existsSync(storagePath)) {
      await fs.unlink(storagePath).catch(() => {});
    }
    res.json({ success: true });
  });

  app.post("/api/projects/:projectId/files/:fileId/share", async (req, res) => {
    const { projectId, fileId } = req.params;
    if (!(await requireProjectFileProject(res, projectId))) {
      return;
    }
    const state = await loadCompatProjectState(projectId);
    if (!state.files.some((file) => file.id === fileId)) {
      return res.status(404).json({ error: "project_file_not_found" });
    }
    const expiresInHours = Number(req.body?.expiresInHours || 24);
    const expiresAt = new Date(
      Date.now() + Math.max(1, expiresInHours) * 60 * 60 * 1000,
    ).toISOString();
    compatPushProjectAudit(projectId, "file_shared", { fileId, expiresAt });
    res.json({
      success: true,
      shareUrl: `/shared/project-file/${projectId}/${fileId}`,
      expiresAt,
    });
  });

  app.post("/api/projects/:projectId/comments", async (req, res) => {
    const { projectId } = req.params;
    const state = ensureCompatProjectState(projectId);
    const payload = req.body;
    const comment = {
      id: crypto.randomUUID(),
      content:
        typeof payload === "string"
          ? payload
          : readString(payload?.content) || readString(payload?.text) || "",
      authorId: readString(payload?.authorId) || compatResolveUserId(req),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "open",
    };
    state.comments.push(comment);
    compatProjectStateStore.set(projectId, state);
    await compatMergeProjectMetadata(projectId, { comments: state.comments });
    compatPushProjectAudit(projectId, "comment_added", { commentId: comment.id });
    res.status(201).json(comment);
  });

  app.get("/api/projects/:projectId/comments", async (req, res) => {
    const { projectId } = req.params;
    const metadata = await compatReadProjectMetadata(projectId);
    const state = ensureCompatProjectState(projectId);
    if (
      metadata &&
      Array.isArray(metadata.comments) &&
      state.comments.length === 0
    ) {
      state.comments = metadata.comments as Array<Record<string, unknown>>;
    }
    res.json(state.comments);
  });

  app.put("/api/projects/:projectId/comments/:commentId", async (req, res) => {
    const { projectId, commentId } = req.params;
    const state = ensureCompatProjectState(projectId);
    state.comments = state.comments.map((comment) =>
      comment.id === commentId
        ? { ...comment, ...(req.body || {}), updatedAt: new Date().toISOString() }
        : comment,
    );
    compatProjectStateStore.set(projectId, state);
    await compatMergeProjectMetadata(projectId, { comments: state.comments });
    compatPushProjectAudit(projectId, "comment_updated", { commentId });
    res.json({ success: true });
  });

  app.delete("/api/projects/:projectId/comments/:commentId", async (req, res) => {
    const { projectId, commentId } = req.params;
    const state = ensureCompatProjectState(projectId);
    state.comments = state.comments.filter((comment) => comment.id !== commentId);
    compatProjectStateStore.set(projectId, state);
    await compatMergeProjectMetadata(projectId, { comments: state.comments });
    compatPushProjectAudit(projectId, "comment_deleted", { commentId });
    res.json({ success: true });
  });

  app.get("/api/projects/:projectId/integrations", (req, res) => {
    const state = ensureCompatProjectState(req.params.projectId);
    res.json(state.integrations);
  });

  app.put("/api/projects/:projectId/integrations", async (req, res) => {
    const { projectId } = req.params;
    const state = ensureCompatProjectState(projectId);
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    for (const [key, value] of Object.entries(payload)) {
      state.integrations[key] = {
        ...(state.integrations[key] || {}),
        enabled: Boolean(value),
        updatedAt: new Date().toISOString(),
      };
    }
    compatProjectStateStore.set(projectId, state);
    await compatMergeProjectMetadata(projectId, {
      integrations: state.integrations,
    });
    compatPushProjectAudit(projectId, "integrations_updated", {
      integrations: Object.keys(payload),
    });
    res.json({ success: true, integrations: state.integrations });
  });

  app.post(
    "/api/projects/:projectId/integrations/:integrationType",
    async (req, res) => {
      const { projectId, integrationType } = req.params;
      const state = ensureCompatProjectState(projectId);
      state.integrations[integrationType] = {
        ...(state.integrations[integrationType] || {}),
        enabled: true,
        config: req.body || {},
        connectedAt: new Date().toISOString(),
      };
      compatProjectStateStore.set(projectId, state);
      await compatMergeProjectMetadata(projectId, {
        integrations: state.integrations,
      });
      compatPushProjectAudit(projectId, "integration_connected", {
        integrationType,
      });
      res.json({
        success: true,
        integration: state.integrations[integrationType],
      });
    },
  );

  app.delete(
    "/api/projects/:projectId/integrations/:integrationType",
    async (req, res) => {
      const { projectId, integrationType } = req.params;
      const state = ensureCompatProjectState(projectId);
      state.integrations[integrationType] = {
        ...(state.integrations[integrationType] || {}),
        enabled: false,
        disconnectedAt: new Date().toISOString(),
      };
      compatProjectStateStore.set(projectId, state);
      await compatMergeProjectMetadata(projectId, {
        integrations: state.integrations,
      });
      compatPushProjectAudit(projectId, "integration_disconnected", {
        integrationType,
      });
      res.json({ success: true });
    },
  );

  app.post(
    "/api/projects/:projectId/integrations/:integrationType/test",
    (req, res) => {
      const { integrationType } = req.params;
      res.json({
        success: true,
        integrationType,
        status: "ok",
        testedAt: new Date().toISOString(),
      });
    },
  );

  app.get("/api/projects/:projectId/permissions", (req, res) => {
    const state = ensureCompatProjectState(req.params.projectId);
    res.json(state.permissions);
  });

  app.put("/api/projects/:projectId/permissions", async (req, res) => {
    const { projectId } = req.params;
    const state = ensureCompatProjectState(projectId);
    state.permissions = {
      ...state.permissions,
      ...(req.body || {}),
      updatedAt: new Date().toISOString(),
    };
    compatProjectStateStore.set(projectId, state);
    await compatMergeProjectMetadata(projectId, {
      permissions: state.permissions,
    });
    compatPushProjectAudit(projectId, "permissions_updated");
    res.json({ success: true, permissions: state.permissions });
  });

  app.post("/api/projects/:projectId/access", (req, res) => {
    res.json({
      hasAccess: true,
      action: readString(req.body?.action) || "view",
      checkedAt: new Date().toISOString(),
    });
  });

  app.get("/api/projects/:projectId/compliance", (req, res) => {
    const state = ensureCompatProjectState(req.params.projectId);
    res.json(state.compliance);
  });

  app.post("/api/projects/:projectId/compliance", async (req, res) => {
    const { projectId } = req.params;
    const state = ensureCompatProjectState(projectId);
    const standards = Array.isArray(req.body?.standards)
      ? req.body.standards
      : ["gdpr"];
    const report = {
      standards,
      score: 100,
      issues: [],
      validatedAt: new Date().toISOString(),
    };
    state.compliance = {
      ...state.compliance,
      ...report,
      updatedAt: new Date().toISOString(),
    };
    compatProjectStateStore.set(projectId, state);
    await compatMergeProjectMetadata(projectId, { compliance: state.compliance });
    compatPushProjectAudit(projectId, "compliance_validated");
    res.json(report);
  });

  app.put("/api/projects/:projectId/compliance", async (req, res) => {
    const { projectId } = req.params;
    const state = ensureCompatProjectState(projectId);
    state.compliance = {
      ...state.compliance,
      ...(req.body || {}),
      updatedAt: new Date().toISOString(),
    };
    compatProjectStateStore.set(projectId, state);
    await compatMergeProjectMetadata(projectId, { compliance: state.compliance });
    compatPushProjectAudit(projectId, "compliance_updated");
    res.json({ success: true, compliance: state.compliance });
  });

  app.get("/api/projects/:projectId/compliance/report", (req, res) => {
    const { projectId } = req.params;
    const state = ensureCompatProjectState(projectId);
    res.json({
      projectId,
      generatedAt: new Date().toISOString(),
      compliance: state.compliance,
    });
  });

  app.get("/api/projects/:projectId/audit-trail", (req, res) => {
    const state = ensureCompatProjectState(req.params.projectId);
    res.json(state.auditTrail);
  });

  app.get("/api/projects/:projectId/audit", (req, res) => {
    const state = ensureCompatProjectState(req.params.projectId);
    res.json({ entries: state.auditTrail });
  });

  app.get("/api/projects/:projectId/analytics", (req, res) => {
    const { projectId } = req.params;
    const state = ensureCompatProjectState(projectId);
    const createdAfter = readString(req.query?.start);
    const createdBefore = readString(req.query?.end);
    const commentsInRange = state.comments.filter((comment) => {
      const createdAt = readString(comment.createdAt);
      if (!createdAt) return true;
      if (createdAfter && createdAt < createdAfter) return false;
      if (createdBefore && createdAt > createdBefore) return false;
      return true;
    });
    res.json({
      projectId,
      totalCollaborators: state.collaborators.length,
      totalFiles: state.files.length,
      totalComments: commentsInRange.length,
      totalIntegrations: Object.keys(state.integrations).length,
      activityCount: state.auditTrail.length,
      generatedAt: new Date().toISOString(),
    });
  });

  app.get("/api/projects/:projectId/health-score", (req, res) => {
    const state = ensureCompatProjectState(req.params.projectId);
    const enabledIntegrations = Object.values(state.integrations).filter(
      (item) => item.enabled === true,
    ).length;
    const score = Math.max(
      35,
      Math.min(
        100,
        60 +
          enabledIntegrations * 5 +
          Math.min(20, state.files.length * 2) +
          Math.min(10, state.comments.length),
      ),
    );
    res.json({ score });
  });

  app.get("/api/projects/:projectId/health", (req, res) => {
    const { projectId } = req.params;
    const state = ensureCompatProjectState(projectId);
    const enabledIntegrations = Object.values(state.integrations).filter(
      (item) => item.enabled === true,
    ).length;
    const healthScore = Math.max(
      35,
      Math.min(
        100,
        60 +
          enabledIntegrations * 5 +
          Math.min(20, state.files.length * 2) +
          Math.min(10, state.comments.length),
      ),
    );
    res.json({
      projectId,
      status:
        healthScore >= 75
          ? "healthy"
          : healthScore >= 50
            ? "attention"
            : "critical",
      score: healthScore,
      integrationsConnected: enabledIntegrations,
      collaborators: state.collaborators.length,
      files: state.files.length,
      comments: state.comments.length,
      checkedAt: new Date().toISOString(),
    });
  });

  // POST /api/projects/:projectId/memory-cards — save memory card configuration
  app.post("/api/projects/:projectId/memory-cards", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { cards, configs, budget, cameras } = req.body;

      // Store in project metadata
      await pool.query(
        `UPDATE legacy.projects SET 
          metadata = COALESCE(metadata, '{}')::jsonb || $1::jsonb,
          updated_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            selectedMemoryCards: cards || [],
            memoryCardConfigs: configs || [],
            memoryCardBudget: budget || null,
            selectedCameras: cameras || [],
          }),
          projectId,
        ],
      );

      // Also save to project_memory_cards table if it exists
      try {
        const tableCheck = await pool.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'project_memory_cards')`,
        );
        if (tableCheck.rows[0].exists && cards?.length > 0) {
          // project_memory_cards has: id(serial), project_id, profession, labeling_scheme, total_required_gb, cards(jsonb), plan(jsonb), notes
          await pool.query(
            `INSERT INTO project_memory_cards (project_id, profession, cards, plan, total_required_gb, notes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
             ON CONFLICT DO NOTHING`,
            [
              projectId,
              "photographer",
              JSON.stringify(cards),
              JSON.stringify(configs || []),
              cards.reduce(
                (sum: number, c: any) => sum + (parseInt(c.capacity) || 0),
                0,
              ),
              `Budget: ${budget || "N/A"}. Cameras: ${cameras?.map((c: any) => c.name).join(", ") || "N/A"}`,
            ],
          );
        }
      } catch (memErr) {
        // Non-critical — project metadata already saved
        console.warn(
          "Memory cards table insert skipped:",
          (memErr as any).message,
        );
      }

      console.log(`💾 Minnekort-konfig lagret for prosjekt ${projectId}`);
      res.json({ success: true, message: "Minnekort-konfigurasjon lagret" });
    } catch (error) {
      console.error("Error saving memory cards:", error);
      res.status(500).json({ error: "Kunne ikke lagre minnekort-konfigurasjon" });
    }
  });

  // POST /api/projects/:projectId/shot-list — persist shot list to
  // shot_lists table so the iPad CaptureApp sees it (previously shots
  // only lived inside projects.projectData.metadata.shotList which the
  // iPad never reads).
  app.post("/api/projects/:projectId/shot-list", async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId = getUserIdFromAuth(req);
      if (!userId) {
        return res.status(401).json({ error: "unauthorized" });
      }
      const shots = Array.isArray(req.body?.shots) ? req.body.shots : [];
      const listName = typeof req.body?.listName === "string" ? req.body.listName : undefined;
      const eventType = typeof req.body?.eventType === "string" ? req.body.eventType : undefined;
      const result = await upsertShotListForProject(db as any, {
        ownerUserId: userId,
        projectId,
        shots,
        listName,
        eventType,
      });
      if (!result.ok) {
        return res.status(404).json({ error: result.error });
      }
      res.json({ success: true, data: result.data });
    } catch (error) {
      console.error("Error persisting shot list:", error);
      res.status(500).json({ error: "Kunne ikke lagre shot list" });
    }
  });

  // POST /api/projects/:projectId/capture-session — bootstrap (or reuse)
  // a capture_sessions row linked to the project so the iPad sees the
  // session immediately after the photographer finishes the web modal.
  app.post("/api/projects/:projectId/capture-session", async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId = getUserIdFromAuth(req);
      if (!userId) {
        return res.status(401).json({ error: "unauthorized" });
      }
      const name = typeof req.body?.name === "string" ? req.body.name : undefined;
      const startsAt = typeof req.body?.startsAt === "string" ? new Date(req.body.startsAt) : undefined;
      const result = await bootstrapCaptureSessionForProject(
        db as any,
        userId,
        projectId,
        { name, startsAt },
      );
      if (!result.ok) {
        return res.status(404).json({ error: result.error });
      }
      res.json({
        success: true,
        session: result.session,
        reused: result.reused,
      });
    } catch (error) {
      console.error("Error bootstrapping capture session:", error);
      res.status(500).json({ error: "Kunne ikke opprette capture-økt" });
    }
  });
}
