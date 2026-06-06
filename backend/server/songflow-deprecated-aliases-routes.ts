/**
 * songflow-deprecated-aliases-routes.ts
 *
 * Standalone modul for /api/songflow-* + /api/split-sheets/*-songflow
 * deprecation-aliases. Ekstraktert fra backend/server/index.ts
 * (linje 70425-70469).
 *
 * 10 routes, alle trivielle wirings:
 *   - GET    /api/songflow-projects                  → /api/easeverse-projects
 *   - GET    /api/songflow-tracks                    → /api/easeverse-tracks
 *   - POST   /api/songflow-tracks                    → /api/easeverse-tracks
 *   - POST   /api/songflow-tracks/:trackId/backup    → /api/easeverse-tracks/:trackId/backup
 *   - POST   /api/songflow-tracks/:trackId/sync-lyrics → /api/easeverse-tracks/:trackId/sync-lyrics
 *   - PUT    /api/songflow-tracks/:trackId/lyrics    → /api/easeverse-tracks/:trackId/lyrics
 *   - POST   /api/split-sheets/from-songflow/:trackId → /api/split-sheets/from-easeverse/:trackId
 *   - GET    /api/split-sheets/:id/songflow          → /api/split-sheets/:id/easeverse
 *   - POST   /api/split-sheets/:id/link-songflow     → /api/split-sheets/:id/link-easeverse
 *   - DELETE /api/split-sheets/:id/unlink-songflow   → /api/split-sheets/:id/unlink-easeverse
 *
 * Hver alias:
 *   1. Setter Deprecation/Sunset/X-API-Successor headers
 *   2. Delegerer til EaseVerse-handler-funksjonen
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { setupSongflowDeprecatedAliasesRoutes } from "./songflow-deprecated-aliases-routes";
 *
 *   setupSongflowDeprecatedAliasesRoutes({
 *     app,
 *     markSongFlowAliasDeprecated,
 *     listEaseVerseProjectsHandler,
 *     listEaseVerseTracksHandler,
 *     createEaseVerseTrackHandler,
 *     backupEaseVerseTrackHandler,
 *     syncEaseVerseLyricsHandler,
 *     updateEaseVerseLyricsHandler,
 *     createSplitSheetFromEaseVerseTrackHandler,
 *     listSplitSheetEaseVerseLinksHandler,
 *     linkSplitSheetEaseVerseHandler,
 *     unlinkSplitSheetEaseVerseHandler,
 *   });
 */

import type express from "express";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: any, res: any) => any;

export interface SongflowDeprecatedAliasesRoutesDeps {
  app: express.Application;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  markSongFlowAliasDeprecated: (res: any, successorPath: string) => void;
  listEaseVerseProjectsHandler: Handler;
  listEaseVerseTracksHandler: Handler;
  createEaseVerseTrackHandler: Handler;
  backupEaseVerseTrackHandler: Handler;
  syncEaseVerseLyricsHandler: Handler;
  updateEaseVerseLyricsHandler: Handler;
  createSplitSheetFromEaseVerseTrackHandler: Handler;
  listSplitSheetEaseVerseLinksHandler: Handler;
  linkSplitSheetEaseVerseHandler: Handler;
  unlinkSplitSheetEaseVerseHandler: Handler;
}

export function setupSongflowDeprecatedAliasesRoutes(
  deps: SongflowDeprecatedAliasesRoutesDeps,
): void {
  const {
    app,
    markSongFlowAliasDeprecated,
    listEaseVerseProjectsHandler,
    listEaseVerseTracksHandler,
    createEaseVerseTrackHandler,
    backupEaseVerseTrackHandler,
    syncEaseVerseLyricsHandler,
    updateEaseVerseLyricsHandler,
    createSplitSheetFromEaseVerseTrackHandler,
    listSplitSheetEaseVerseLinksHandler,
    linkSplitSheetEaseVerseHandler,
    unlinkSplitSheetEaseVerseHandler,
  } = deps;

  // SongFlow project + track aliases
  app.get("/api/songflow-projects", (req, res) => {
    markSongFlowAliasDeprecated(res, "/api/easeverse-projects");
    return listEaseVerseProjectsHandler(req, res);
  });
  app.get("/api/songflow-tracks", (req, res) => {
    markSongFlowAliasDeprecated(res, "/api/easeverse-tracks");
    return listEaseVerseTracksHandler(req, res);
  });
  app.post("/api/songflow-tracks", (req, res) => {
    markSongFlowAliasDeprecated(res, "/api/easeverse-tracks");
    return createEaseVerseTrackHandler(req, res);
  });
  app.post("/api/songflow-tracks/:trackId/backup", (req, res) => {
    markSongFlowAliasDeprecated(res, "/api/easeverse-tracks/:trackId/backup");
    return backupEaseVerseTrackHandler(req, res);
  });
  app.post("/api/songflow-tracks/:trackId/sync-lyrics", (req, res) => {
    markSongFlowAliasDeprecated(
      res,
      "/api/easeverse-tracks/:trackId/sync-lyrics",
    );
    return syncEaseVerseLyricsHandler(req, res);
  });
  app.put("/api/songflow-tracks/:trackId/lyrics", (req, res) => {
    markSongFlowAliasDeprecated(res, "/api/easeverse-tracks/:trackId/lyrics");
    return updateEaseVerseLyricsHandler(req, res);
  });

  // SongFlow split-sheets aliases
  app.post("/api/split-sheets/from-songflow/:trackId", (req, res) => {
    markSongFlowAliasDeprecated(res, "/api/split-sheets/from-easeverse/:trackId");
    return createSplitSheetFromEaseVerseTrackHandler(req, res);
  });
  app.get("/api/split-sheets/:id/songflow", (req, res) => {
    markSongFlowAliasDeprecated(res, "/api/split-sheets/:id/easeverse");
    return listSplitSheetEaseVerseLinksHandler(req, res);
  });
  app.post("/api/split-sheets/:id/link-songflow", (req, res) => {
    markSongFlowAliasDeprecated(res, "/api/split-sheets/:id/link-easeverse");
    return linkSplitSheetEaseVerseHandler(req, res);
  });
  app.delete("/api/split-sheets/:id/unlink-songflow", (req, res) => {
    markSongFlowAliasDeprecated(res, "/api/split-sheets/:id/unlink-easeverse");
    return unlinkSplitSheetEaseVerseHandler(req, res);
  });
}
