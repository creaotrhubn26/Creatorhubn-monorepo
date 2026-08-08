import express, { type Request, type Response } from "express";
import { google } from "googleapis";
import type { Pool } from "pg";
import { resolveRoleRoomGoogleConnection } from "./contract-google-signing.js";
import { loadPersistedAuthSession } from "./auth-session-store.js";
import { derivePreferredGoogleWorkspaceOauthApps } from "./google-workspace-oauth.js";

// Ruter for de resterende Google Workspace-integrasjonene som gjør at hvert
// forespurte OAuth-scope er backet av et ekte API-kall (Google Minimum Scopes):
//   • Drive Activity  → auth/drive.activity.readonly
//   • Sheets export   → auth/spreadsheets
// (YouTube Analytics-scopene dekkes av /api/youtube/analytics i youtube-routes.)

function readStringValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

// Eierskaps-håndhevende bruker-oppslag. Alle endepunktene her leser/skriver
// sensitiv Workspace-data (Drive-aktivitet, Sheets), så vi krever en autentisert
// sesjon (bearer) OG at en evt. eksplisitt ?userId/x-user-id matcher sesjons-
// brukeren. Hindrer IDOR: uten dette kunne ?userId=<annen> lekket/skrevet en
// annen brukers data. Returnerer null → kaller svarer 403.
async function resolveUserId(pool: Pool, req: Request): Promise<string | null> {
  const bearer = readStringValue(req.headers.authorization)?.replace(/^Bearer\s+/i, "").trim();
  if (!bearer) {
    return null;
  }

  const session = await loadPersistedAuthSession<{
    userId: string;
    email: string;
    name: string;
    role: string;
    loginAt: string;
  }>(pool, bearer);
  const sessionUserId = readStringValue(session?.userId);
  if (!sessionUserId) {
    return null;
  }

  const requested =
    readStringValue(req.query.userId)
    ?? readStringValue(req.body?.userId)
    ?? readStringValue(req.headers["x-user-id"]);
  if (requested && requested !== sessionUserId) {
    return null;
  }

  return sessionUserId;
}

async function resolveOauthClient(pool: Pool, userId: string, req: Request) {
  const authorized = await resolveRoleRoomGoogleConnection(pool, userId, {
    allowFallbackToAnyUser: false,
    preferredOauthApps: derivePreferredGoogleWorkspaceOauthApps(req),
  });
  return authorized.oauthClient;
}

function sendError(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Ukjent Google-feil.";
  const status =
    typeof (error as { code?: number })?.code === "number" && (error as { code: number }).code >= 400
      ? (error as { code: number }).code
      : 500;
  res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
}

export function createGoogleWorkspaceExtraRouter(pool: Pool) {
  const router = express.Router();

  // Drive Activity — hvem endret hvilke filer når. Leser aktivitetsloggen for
  // en gitt fil (?fileId) eller hele driven. Scope: auth/drive.activity.readonly.
  router.get("/drive-activity", async (req: Request, res: Response) => {
    const userId = await resolveUserId(pool, req);
    if (!userId) {
      res.status(403).json({ error: "Ingen tilgang — autentisert sesjon kreves og må eie den forespurte kontoen." });
      return;
    }

    try {
      const auth = await resolveOauthClient(pool, userId, req);
      const activity = google.driveactivity({ version: "v2", auth });
      const fileId = readStringValue(req.query.fileId);
      const pageSize = Math.min(Number(readStringValue(req.query.pageSize) ?? 20) || 20, 100);

      const response = await activity.activity.query({
        requestBody: {
          pageSize,
          ...(fileId ? { itemName: `items/${fileId}` } : {}),
        },
      });

      res.json({ activities: response.data.activities ?? [] });
    } catch (error) {
      sendError(res, error);
    }
  });

  // Sheets-eksport — oppretter et nytt regneark i brukerens Drive og skriver
  // inn rader. Body: { title, rows: string[][], sheetTitle? }. Scope: auth/spreadsheets.
  router.post("/sheets/export", async (req: Request, res: Response) => {
    const userId = await resolveUserId(pool, req);
    if (!userId) {
      res.status(403).json({ error: "Ingen tilgang — autentisert sesjon kreves og må eie den forespurte kontoen." });
      return;
    }

    const rows = req.body?.rows;
    const rowsValid = Array.isArray(rows)
      && rows.length > 0
      && rows.every((row) =>
        Array.isArray(row)
        && row.every((cell) => cell == null || ['string', 'number', 'boolean'].includes(typeof cell)),
      );
    if (!rowsValid) {
      res.status(400).json({ error: "rows må være en ikke-tom liste av rader, der hver rad er en liste av tekst/tall/boolean." });
      return;
    }

    try {
      const auth = await resolveOauthClient(pool, userId, req);
      const sheets = google.sheets({ version: "v4", auth });
      const title = readStringValue(req.body?.title) ?? "CreatorHub-eksport";
      const sheetTitle = readStringValue(req.body?.sheetTitle) ?? "Ark1";

      const created = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title },
          sheets: [{ properties: { title: sheetTitle } }],
        },
      });

      const spreadsheetId = created.data.spreadsheetId ?? undefined;
      if (!spreadsheetId) {
        throw new Error("Google returnerte ingen spreadsheetId.");
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetTitle}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: rows },
      });

      res.json({
        spreadsheetId,
        spreadsheetUrl: created.data.spreadsheetUrl,
        rowsWritten: rows.length,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  // Sheets-lesing — leser verdier fra et eksisterende regneark. Scope: auth/spreadsheets.
  router.get("/sheets/:spreadsheetId", async (req: Request, res: Response) => {
    const userId = await resolveUserId(pool, req);
    if (!userId) {
      res.status(403).json({ error: "Ingen tilgang — autentisert sesjon kreves og må eie den forespurte kontoen." });
      return;
    }

    try {
      const auth = await resolveOauthClient(pool, userId, req);
      const sheets = google.sheets({ version: "v4", auth });
      const range = readStringValue(req.query.range) ?? "Ark1";

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: req.params.spreadsheetId,
        range,
      });

      res.json({ range: response.data.range, values: response.data.values ?? [] });
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
}
