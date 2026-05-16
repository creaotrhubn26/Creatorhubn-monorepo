/**
 * ccapi-routes.ts
 *
 * HTTP-routes som eksponerer Canon CCAPI-funksjonalitet til frontend.
 * Frontend kaller disse i stedet for å snakke direkte mot kameraets
 * self-signed-cert HTTPS (browsere kan ikke).
 *
 * Endpoints:
 *   POST /api/ccapi/connect              { ipAddress, port? } → connect + cache
 *   GET  /api/ccapi/discover             → liste registrerte kameraer (DB)
 *   GET  /api/ccapi/cameras/:ip/state    → full snapshot
 *   POST /api/ccapi/cameras/:ip/shutter  → fire shutter
 *   GET  /api/ccapi/cameras/:ip/poll     → long-poll events (SSE-aktig)
 *   DELETE /api/ccapi/cameras/:ip        → glemme kameraet
 *
 * DB-persistens (casting_ccapi_cameras): kameraer registreres så vi kan
 * hente dem opp igjen ved reconnect uten å skanne nettverket.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { CcapiError, getCcapiClient, clearCcapiClient } from "./ccapi-client.js";
import { discoverCcapiCameras } from "./ccapi-discovery.js";

const HEADER_USER = "x-role-room-user-id";

function readUserId(req: Request): string | null {
  const header = req.header(HEADER_USER);
  if (typeof header === "string" && header.trim().length > 0) return header.trim();
  return null;
}

function requireUser(req: Request, res: Response): string | null {
  const userId = readUserId(req);
  if (!userId) {
    res.status(401).json({ error: "user-id-header mangler" });
    return null;
  }
  return userId;
}

function ipAddressValid(ip: string): boolean {
  // Liberal IPv4-validering — vi stoler ikke på den, men hindrer
  // åpenbart-feil input fra å bli sendt videre
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || /^[a-fA-F0-9:]+$/.test(ip);
}

export interface CcapiRoutesDeps {
  app: Express;
  pool: Pool;
}

export function setupCcapiRoutes(deps: CcapiRoutesDeps): void {
  const { app, pool } = deps;

  // ── Discover: returner kameraer registrert i DB ──────────────────
  //
  // Default: rask DB-lookup. ?scan=true trigger en aktiv subnet-skann
  // som tar ~5 sek og oppdager nye kameraer på samme nett som serveren.
  // Auto-merger funn med eksisterende DB-rad så frontend ser komplett liste.
  app.get("/api/ccapi/discover", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    const wantScan = req.query.scan === "true" || req.query.scan === "1";
    const scanDurationParam = req.query.scanDuration as string | undefined;
    const probeTimeoutMs = scanDurationParam ? Math.max(500, Math.min(10000, parseInt(scanDurationParam, 10))) : 2000;

    try {
      // 1. Hent eksisterende fra DB
      const dbResult = await pool.query<{
        id: string;
        ip_address: string;
        camera_name: string;
        model: string;
        firmware_version: string | null;
        is_online: boolean;
        last_seen_at: Date | null;
      }>(
        `SELECT id, ip_address, camera_name, model, firmware_version, is_online, last_seen_at
         FROM ccapi_cameras
         WHERE user_id = $1
         ORDER BY last_seen_at DESC NULLS LAST`,
        [userId],
      ).catch(() => ({ rows: [] }));

      const existingByIp = new Map(dbResult.rows.map((row) => [row.ip_address, row]));

      // 2. Hvis scan=true, kjør aktiv subnet-scanner
      if (wantScan) {
        try {
          const discovered = await discoverCcapiCameras({ probeTimeoutMs });
          for (const cam of discovered) {
            // Upsert til DB best-effort
            try {
              await pool.query(
                `INSERT INTO ccapi_cameras
                   (user_id, camera_name, model, serial_number, firmware_version,
                    ip_address, supported_features, is_online, last_seen_at,
                    created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW(), NOW())
                 ON CONFLICT (user_id, ip_address) DO UPDATE SET
                   model = COALESCE(EXCLUDED.model, ccapi_cameras.model),
                   serial_number = COALESCE(EXCLUDED.serial_number, ccapi_cameras.serial_number),
                   firmware_version = COALESCE(EXCLUDED.firmware_version, ccapi_cameras.firmware_version),
                   supported_features = EXCLUDED.supported_features,
                   is_online = true,
                   last_seen_at = NOW(),
                   updated_at = NOW()`,
                [
                  userId,
                  cam.model ?? "Canon Camera",
                  cam.model ?? "Unknown",
                  cam.serialNumber ?? null,
                  cam.firmwareVersion ?? null,
                  cam.ipAddress,
                  JSON.stringify(cam.supportedVersions),
                ],
              );
            } catch (err) {
              console.warn("[ccapi-routes] DB upsert skipped:", err);
            }

            // Merge inn i in-memory map så frontend får svaret straks
            if (!existingByIp.has(cam.ipAddress)) {
              existingByIp.set(cam.ipAddress, {
                id: `discovered-${cam.ipAddress}`,
                ip_address: cam.ipAddress,
                camera_name: cam.model ?? "Canon Camera",
                model: cam.model ?? "Unknown",
                firmware_version: cam.firmwareVersion ?? null,
                is_online: true,
                last_seen_at: new Date(cam.discoveredAt),
              });
            }
          }
        } catch (scanErr) {
          console.warn("[ccapi-routes] scan failed:", scanErr);
        }
      }

      const cameras = Array.from(existingByIp.values()).map((row) => ({
        id: row.id,
        name: row.camera_name,
        modelName: row.model,
        ipAddress: row.ip_address,
        port: 443,
        signalStrength: row.is_online ? 90 : 0,
        isConnected: row.is_online,
        lastSeen: row.last_seen_at?.toISOString() ?? null,
      }));

      res.json({ success: true, cameras, scanned: wantScan });
    } catch (err) {
      console.error("[ccapi-routes] discover error:", err);
      res.json({ success: true, cameras: [], scanned: false });
    }
  });

  // ── Eksplisitt scan-endpoint — alltid aktiv skannning ────────────
  app.post("/api/ccapi/scan", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = (req.body ?? {}) as { subnet?: string; probeTimeoutMs?: number };
    try {
      const discovered = await discoverCcapiCameras({
        subnet: typeof body.subnet === "string" ? body.subnet : undefined,
        probeTimeoutMs: typeof body.probeTimeoutMs === "number" ? body.probeTimeoutMs : 2000,
      });

      // Upsert alle funne kameraer
      for (const cam of discovered) {
        try {
          await pool.query(
            `INSERT INTO ccapi_cameras
               (user_id, camera_name, model, serial_number, firmware_version,
                ip_address, supported_features, is_online, last_seen_at,
                created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW(), NOW())
             ON CONFLICT (user_id, ip_address) DO UPDATE SET
               supported_features = EXCLUDED.supported_features,
               is_online = true,
               last_seen_at = NOW(),
               updated_at = NOW()`,
            [
              userId,
              cam.model ?? "Canon Camera",
              cam.model ?? "Unknown",
              cam.serialNumber ?? null,
              cam.firmwareVersion ?? null,
              cam.ipAddress,
              JSON.stringify(cam.supportedVersions),
            ],
          );
        } catch (err) {
          console.warn("[ccapi-routes] scan-upsert skipped:", err);
        }
      }

      res.json({ success: true, cameras: discovered, count: discovered.length });
    } catch (err) {
      console.error("[ccapi-routes] scan error:", err);
      res.status(500).json({ success: false, error: "Scan failed" });
    }
  });

  // ── Connect: prøv /ccapi-inventory og lagre kameraets info ───────
  app.post("/api/ccapi/connect", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    const body = (req.body ?? {}) as { ipAddress?: string; port?: number; cameraName?: string };
    if (!body.ipAddress || !ipAddressValid(body.ipAddress)) {
      res.status(400).json({ error: "Ugyldig ipAddress" });
      return;
    }
    const port = body.port ?? 443;
    const client = getCcapiClient(body.ipAddress, port);

    try {
      const inventory = await client.connect();
      const identity = await client.deviceInformation().catch(() => ({} as Partial<import("./ccapi-client.js").CcapiDeviceInfo>));

      // Upsert til DB
      await pool.query(
        `INSERT INTO ccapi_cameras
           (user_id, camera_name, model, serial_number, firmware_version,
            ip_address, supported_features, is_online, last_seen_at,
            last_connected_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW(), NOW(), NOW())
         ON CONFLICT (user_id, ip_address) DO UPDATE SET
           camera_name = EXCLUDED.camera_name,
           model = EXCLUDED.model,
           firmware_version = EXCLUDED.firmware_version,
           supported_features = EXCLUDED.supported_features,
           is_online = true,
           last_seen_at = NOW(),
           last_connected_at = NOW(),
           updated_at = NOW()`,
        [
          userId,
          body.cameraName ?? identity.productname ?? "Canon Camera",
          identity.productname ?? "Unknown",
          identity.serialnumber ?? null,
          identity.firmwareversion ?? null,
          body.ipAddress,
          JSON.stringify(Object.keys(inventory.apis)),
        ],
      ).catch((err) => {
        // DB-upsert er valgfri — kan feile hvis tabell ikke finnes / konflikt-constraint mangler
        console.warn("[ccapi-routes] DB upsert skipped:", err.message);
      });

      res.json({
        success: true,
        camera: {
          ipAddress: body.ipAddress,
          port,
          identity,
          supportedVersions: Object.keys(inventory.apis),
        },
      });
    } catch (err) {
      const isBusy = err instanceof CcapiError && err.kind === "busy";
      const isNetwork = err instanceof CcapiError && err.kind === "network";
      res.status(isBusy ? 503 : isNetwork ? 504 : 502).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // ── Camera state — full snapshot ─────────────────────────────────
  app.get("/api/ccapi/cameras/:ip/state", async (req, res) => {
    if (!requireUser(req, res)) return;
    const ip = req.params.ip;
    if (!ipAddressValid(ip)) {
      res.status(400).json({ error: "Ugyldig ip" });
      return;
    }
    try {
      const client = getCcapiClient(ip);
      const state = await client.fetchFullState();
      res.json({ success: true, state });
    } catch (err) {
      console.warn("[ccapi-routes] state fetch failed:", err);
      res.status(502).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // ── Shutter ──────────────────────────────────────────────────────
  app.post("/api/ccapi/cameras/:ip/shutter", async (req, res) => {
    if (!requireUser(req, res)) return;
    const ip = req.params.ip;
    if (!ipAddressValid(ip)) {
      res.status(400).json({ error: "Ugyldig ip" });
      return;
    }
    const body = (req.body ?? {}) as { af?: boolean };
    try {
      const client = getCcapiClient(ip);
      await client.triggerShutter(body.af !== false);
      res.json({ success: true });
    } catch (err) {
      console.error("[ccapi-routes] shutter failed:", err);
      const isBusy = err instanceof CcapiError && err.kind === "busy";
      res.status(isBusy ? 503 : 502).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // ── Long-poll events ─────────────────────────────────────────────
  //
  // Frontend kaller denne i loop. Hver request blokkerer opptil 30s på
  // kameraet (?continue=on). Returnerer { polling: ... } eller {} ved
  // timeout. Frontend re-issuer immediate.
  app.get("/api/ccapi/cameras/:ip/poll", async (req, res) => {
    if (!requireUser(req, res)) return;
    const ip = req.params.ip;
    if (!ipAddressValid(ip)) {
      res.status(400).json({ error: "Ugyldig ip" });
      return;
    }
    try {
      const client = getCcapiClient(ip);
      const polling = await client.longPollEvents(30_000);
      res.json({ success: true, polling });
    } catch (err) {
      // AbortError ved timeout er forventet — returnér tom polling
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("aborted") || message.includes("timeout")) {
        res.json({ success: true, polling: {} });
        return;
      }
      res.status(502).json({ success: false, error: message });
    }
  });

  // ── Disconnect / forget ──────────────────────────────────────────
  app.delete("/api/ccapi/cameras/:ip", async (req, res) => {
    const userId = requireUser(req, res);
    if (!userId) return;
    const ip = req.params.ip;
    if (!ipAddressValid(ip)) {
      res.status(400).json({ error: "Ugyldig ip" });
      return;
    }
    try {
      // Best-effort clearing av polling-state mot kameraet
      try {
        await getCcapiClient(ip).clearPollingState();
      } catch {
        // ignore — kameraet kan være offline
      }
      clearCcapiClient(ip);
      await pool.query(
        `UPDATE ccapi_cameras
         SET is_online = false, updated_at = NOW()
         WHERE user_id = $1 AND ip_address = $2`,
        [userId, ip],
      ).catch(() => {});
      res.json({ success: true });
    } catch (err) {
      console.error("[ccapi-routes] disconnect error:", err);
      res.status(500).json({ error: "Disconnect failed" });
    }
  });
}
