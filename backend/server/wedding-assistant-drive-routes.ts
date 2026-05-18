/**
 * wedding-assistant-drive-routes.ts
 *
 * Slice 9X.45 — Auto-delt Drive-mappe for assistent-leveranse.
 *
 * Smart UX-flyt:
 *   1. Stine inviterer Lena (9X.44)
 *   2. Etter accept: Stine trykker "Sett opp delt mappe" → Creatorhubn
 *      bruker hennes Google-tilgang for å lage subfolder under
 *      "Creatorhubn" og dele den med Lena (Drive sender automatisk
 *      delings-mail)
 *   3. Lena laster opp etter bryllupet
 *   4. Background-poller henter file count → notify Stine via push + e-post
 *      når > forrige
 *   5. Stine ser badge "12 nye filer fra Lena · siste for 4 min siden"
 *      i AssistantsPanel
 *
 * Endpoints:
 *   POST /api/wedding/:weddingId/assistants/:assistantId/setup-drive-folder
 *   POST /api/wedding/:weddingId/assistants/:assistantId/check-drive
 *   POST /api/wedding/:weddingId/assistants/:assistantId/mark-files-viewed
 *
 * Export: pollAllAssistantFolders(pool) — for periodisk runner.
 */

import type express from "express";
import { google } from "googleapis";
import { loadGoogleCredentials } from "./google-calendar-project";
import { sendPushToUser } from "./web-push-routes";
import { broadcastEventToRoom } from "./websocket-chat";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CREATORHUB_ROOT_FOLDER_NAME = "Creatorhubn";
const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

export interface WeddingAssistantDriveRoutesDeps {
  app: express.Application;
  pool: any;
  getPricingUserId: (req: any) => string;
}

async function ensureSchema(pool: any): Promise<void> {
  const cols = ["drive_folder_id TEXT", "drive_folder_url TEXT", "drive_folder_setup_at TIMESTAMPTZ",
    "baseline_file_count INTEGER DEFAULT 0", "last_known_file_count INTEGER DEFAULT 0",
    "last_polled_at TIMESTAMPTZ", "last_new_files_at TIMESTAMPTZ",
    "new_files_since_viewed INTEGER DEFAULT 0"];
  for (const col of cols) {
    const [name] = col.split(" ");
    await pool.query(
      `ALTER TABLE wedding_assistants ADD COLUMN IF NOT EXISTS ${col}`,
    ).catch(() => undefined);
  }
}

async function findOrCreateCreatorhubRoot(
  driveApi: ReturnType<typeof google.drive>,
): Promise<string> {
  const existing = await driveApi.files.list({
    q: `name = '${CREATORHUB_ROOT_FOLDER_NAME}' and mimeType = '${DRIVE_FOLDER_MIME}' and trashed = false`,
    pageSize: 1,
    fields: "files(id, name)",
  });
  const existingId = existing.data.files?.[0]?.id;
  if (existingId) return existingId;

  const created = await driveApi.files.create({
    requestBody: { name: CREATORHUB_ROOT_FOLDER_NAME, mimeType: DRIVE_FOLDER_MIME },
    fields: "id",
  });
  const id = created.data.id;
  if (!id) throw new Error("Kunne ikke opprette Creatorhubn-rotmappe");
  return id;
}

function buildFolderName(coupleName: string | null, weddingDate: string | null, assistantName: string | null): string {
  const couple = coupleName || "Bryllup";
  const datePart = weddingDate ? new Date(weddingDate).toISOString().slice(0, 10) : "uten-dato";
  const assistant = assistantName || "assistent";
  // Drive tillater de fleste tegn, men unngår vi / og \ som kan misforstås
  return `${couple} ${datePart} - ${assistant}`.replace(/[/\\]/g, "-");
}

async function countFilesInFolder(
  driveApi: ReturnType<typeof google.drive>,
  folderId: string,
): Promise<{ count: number; latestModified: string | null }> {
  // Tell ikke under-mapper, kun faktiske filer. Pageinerer hvis > 100.
  let count = 0;
  let latestModified: string | null = null;
  let pageToken: string | undefined;
  do {
    const r: any = await driveApi.files.list({
      q: `'${folderId}' in parents and mimeType != '${DRIVE_FOLDER_MIME}' and trashed = false`,
      pageSize: 100,
      pageToken,
      fields: "nextPageToken, files(id, modifiedTime)",
    });
    const files = r.data.files || [];
    count += files.length;
    for (const f of files) {
      if (f.modifiedTime && (!latestModified || f.modifiedTime > latestModified)) {
        latestModified = f.modifiedTime;
      }
    }
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  return { count, latestModified };
}

interface PollResult {
  assistantId: string;
  newFiles: number;
  totalFiles: number;
  lastUploadAt: string | null;
}

async function pollAssistantFolder(
  pool: any,
  assistantRow: any,
  triggerNotifications: boolean = true,
): Promise<PollResult | null> {
  const creds = await loadGoogleCredentials(pool, assistantRow.primary_photographer_id);
  if (!creds) return null;
  const drive = google.drive({ version: "v3", auth: creds.oauthClient });

  let result;
  try {
    result = await countFilesInFolder(drive, assistantRow.drive_folder_id);
  } catch (err) {
    console.warn(`[assistant-drive] count feilet for assistent ${assistantRow.id}:`, err);
    return null;
  }

  const prevCount = Number(assistantRow.last_known_file_count) || 0;
  const baseline = Number(assistantRow.baseline_file_count) || 0;
  const actualUploads = Math.max(0, result.count - baseline);
  const newSinceLastPoll = Math.max(0, result.count - prevCount);

  await pool.query(
    `UPDATE wedding_assistants
       SET last_known_file_count = $1,
           last_polled_at = NOW(),
           last_new_files_at = CASE WHEN $2 > 0 THEN NOW() ELSE last_new_files_at END,
           new_files_since_viewed = new_files_since_viewed + $2,
           updated_at = NOW()
       WHERE id = $3`,
    [result.count, newSinceLastPoll, assistantRow.id],
  ).catch(() => undefined);

  if (triggerNotifications && newSinceLastPoll > 0) {
    const folderUrl = assistantRow.drive_folder_url;
    const title = `📷 ${assistantRow.assistant_name || "Assistent"} lastet opp ${newSinceLastPoll} bilde${newSinceLastPoll === 1 ? "" : "r"}`;
    const body = `Totalt fra assistent: ${actualUploads}. Trykk for å åpne i Drive.`;

    // PWA push til Stine
    sendPushToUser(pool, assistantRow.primary_photographer_id, {
      title,
      body,
      url: folderUrl || `/photographer/wedding-day/${assistantRow.wedding_id}`,
      tag: `assistant-upload-${assistantRow.id}`,
    }).catch(() => undefined);

    // Real-time WS-broadcast
    broadcastEventToRoom(`wedding:${assistantRow.wedding_id}`, {
      type: "assistant_uploaded",
      payload: {
        assistantId: assistantRow.id,
        assistantName: assistantRow.assistant_name,
        newFiles: newSinceLastPoll,
        totalFiles: actualUploads,
        folderUrl,
      },
      timestamp: new Date().toISOString(),
    });
  }

  return {
    assistantId: assistantRow.id,
    newFiles: newSinceLastPoll,
    totalFiles: actualUploads,
    lastUploadAt: result.latestModified,
  };
}

/** Background-poller: kalles fra wedding-reminder-runner el.l. */
export async function pollAllAssistantFolders(pool: any): Promise<number> {
  await ensureSchema(pool);
  // Poll alle accepted-assistenter som har drive_folder_id og ikke ble pollet
  // siste 4 min (rate-limit beskyttelse mot for ofte kall).
  const r = await pool.query(
    `SELECT * FROM wedding_assistants
       WHERE drive_folder_id IS NOT NULL
         AND status IN ('accepted', 'completed')
         AND (last_polled_at IS NULL OR last_polled_at < NOW() - INTERVAL '4 minutes')
       ORDER BY last_polled_at NULLS FIRST
       LIMIT 50`,
  );
  let polled = 0;
  for (const row of r.rows) {
    const result = await pollAssistantFolder(pool, row, true);
    if (result) polled++;
  }
  return polled;
}

export function setupWeddingAssistantDriveRoutes(deps: WeddingAssistantDriveRoutesDeps): void {
  const { app, pool, getPricingUserId } = deps;

  // ─── POST setup-drive-folder ───────────────────────────────────
  app.post("/api/wedding/:weddingId/assistants/:assistantId/setup-drive-folder", async (req, res) => {
    try {
      await ensureSchema(pool);
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });

      const assistantR = await pool.query(
        `SELECT a.*, w.couple_name, w.wedding_date
           FROM wedding_assistants a
           LEFT JOIN wedding_timelines w ON w.id = a.wedding_id
           WHERE a.id = $1 AND a.wedding_id = $2 AND a.primary_photographer_id = $3 LIMIT 1`,
        [req.params.assistantId, req.params.weddingId, uid],
      );
      if (assistantR.rowCount === 0) return res.status(404).json({ error: "Assistent finnes ikke" });
      const a = assistantR.rows[0];

      if (a.drive_folder_id) {
        return res.json({
          alreadySetUp: true,
          folderId: a.drive_folder_id,
          folderUrl: a.drive_folder_url,
        });
      }
      if (!a.assistant_email) {
        return res.status(400).json({ error: "Mangler assistent-e-post for å dele mappen" });
      }

      const creds = await loadGoogleCredentials(pool, uid);
      if (!creds) {
        return res.status(412).json({
          error: "Google Drive ikke koblet. Koble Drive først i innstillinger så får du automatisk delt mappe-flyt.",
          requiresGoogleConnection: true,
        });
      }

      const drive = google.drive({ version: "v3", auth: creds.oauthClient });

      // 1. Finn/lag Creatorhubn-rot
      const rootId = await findOrCreateCreatorhubRoot(drive);

      // 2. Lag subfolder med fornuftig navn
      const folderName = buildFolderName(a.couple_name, a.wedding_date, a.assistant_name);
      const folder = await drive.files.create({
        requestBody: { name: folderName, mimeType: DRIVE_FOLDER_MIME, parents: [rootId] },
        fields: "id, webViewLink",
      });
      const folderId = folder.data.id!;
      const folderUrl = folder.data.webViewLink || `https://drive.google.com/drive/folders/${folderId}`;

      // 3. Del med assistent
      await drive.permissions.create({
        fileId: folderId,
        supportsAllDrives: true,
        sendNotificationEmail: true,
        emailMessage: `Hei ${a.assistant_name || ""}! Du har fått tilgang til en delt mappe for bryllupet ${a.couple_name || ""}. Last opp bildene dine her etter dagen.\n\n— ${creds.googleEmail || "Fotograf"} via Creatorhubn`,
        requestBody: {
          type: "user",
          role: "writer", // Lar assistent laste opp + se. 'fileOrganizer' kan også brukes.
          emailAddress: a.assistant_email,
        },
      });

      // 4. Tell baseline (typisk 0)
      const initial = await countFilesInFolder(drive, folderId);

      await pool.query(
        `UPDATE wedding_assistants
           SET drive_folder_id = $1,
               drive_folder_url = $2,
               drive_folder_setup_at = NOW(),
               baseline_file_count = $3,
               last_known_file_count = $3,
               last_polled_at = NOW(),
               updated_at = NOW()
           WHERE id = $4`,
        [folderId, folderUrl, initial.count, a.id],
      );

      res.json({
        folderId,
        folderUrl,
        folderName,
        sharedWith: a.assistant_email,
        sharedFromGoogle: creds.googleEmail,
      });
    } catch (err: any) {
      console.error("POST setup-drive-folder:", err);
      res.status(500).json({ error: err?.message || "Kunne ikke sette opp delt mappe" });
    }
  });

  // ─── POST check-drive ──────────────────────────────────────────
  // On-demand sjekk (når Stine åpner AssistantsPanel kalles denne for å
  // gi henne ferskest mulig file-count selv mellom background-polls).
  app.post("/api/wedding/:weddingId/assistants/:assistantId/check-drive", async (req, res) => {
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `SELECT * FROM wedding_assistants
           WHERE id = $1 AND wedding_id = $2 AND primary_photographer_id = $3 LIMIT 1`,
        [req.params.assistantId, req.params.weddingId, uid],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Assistent finnes ikke" });
      if (!r.rows[0].drive_folder_id) return res.status(400).json({ error: "Drive-mappe ikke satt opp ennå" });

      const result = await pollAssistantFolder(pool, r.rows[0], true);
      if (!result) return res.status(503).json({ error: "Kunne ikke hente fra Drive" });
      res.json(result);
    } catch (err) {
      console.error("POST check-drive:", err);
      res.status(500).json({ error: "Sjekk feilet" });
    }
  });

  // ─── POST mark-files-viewed ────────────────────────────────────
  // Nullstiller "nye filer siden sist sett"-badge.
  app.post("/api/wedding/:weddingId/assistants/:assistantId/mark-files-viewed", async (req, res) => {
    try {
      const uid = getPricingUserId(req);
      if (!uid) return res.status(401).json({ error: "Mangler bruker-ID" });
      const r = await pool.query(
        `UPDATE wedding_assistants
           SET new_files_since_viewed = 0, updated_at = NOW()
           WHERE id = $1 AND wedding_id = $2 AND primary_photographer_id = $3
           RETURNING id`,
        [req.params.assistantId, req.params.weddingId, uid],
      );
      if (r.rowCount === 0) return res.status(404).json({ error: "Ikke funnet" });
      res.json({ success: true });
    } catch (err) {
      console.error("POST mark-files-viewed:", err);
      res.status(500).json({ error: "Kunne ikke markere som sett" });
    }
  });
}
