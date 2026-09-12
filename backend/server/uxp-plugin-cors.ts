import cors, { type CorsOptions } from "cors";
import type { Application } from "express";

/**
 * UXP panels run outside CreatorHub's normal web origins. Adobe documents that
 * remote servers must opt in to CORS, but the concrete Origin value is owned by
 * the host/runtime and may differ between development and packaged plugins.
 *
 * These routes are intentionally safe for wildcard CORS without credentials:
 * pairing is code/rate-limit protected, and project data requires an explicit
 * bearer token. Cookie credentials remain unavailable to third-party origins.
 */
export const UXP_PLUGIN_API_PATHS = [
  "/api/post-agent/pairing/start",
  "/api/post-agent/pairing/poll",
  "/api/video-nle/projects",
  "/api/projects/:projectId/video-marker-sync/:editor",
] as const;

export const UXP_PLUGIN_CORS_OPTIONS: CorsOptions = {
  origin: "*",
  credentials: false,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  exposedHeaders: ["Content-Disposition"],
  maxAge: 600,
};

export function setupUxpPluginCors(app: Application): void {
  app.use([...UXP_PLUGIN_API_PATHS], cors(UXP_PLUGIN_CORS_OPTIONS));
}
