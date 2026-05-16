/**
 * multi-vendor-camera-routes.ts
 *
 * HTTP-routes for Sony + ARRI + Z CAM. Følger samme mønster som
 * ccapi-routes.ts. Frontend snakker mot disse i stedet for direkte mot
 * kameraets self-signed-cert HTTPS.
 *
 * Endpoints (per vendor):
 *   POST /api/{vendor}/connect     — sjekk at kamera svarer
 *   GET  /api/{vendor}/state       — full snapshot
 *   POST /api/{vendor}/record/start
 *   POST /api/{vendor}/record/stop
 *   POST /api/{vendor}/settings    — partial-update av exposure/WB
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { getSonyClient, clearSonyClient } from "./sony-wifi-client.js";
import { getArriClient } from "./arri-web-client.js";
import { getZcamClient, clearZcamClient } from "./zcam-http-client.js";

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
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || /^[a-fA-F0-9:]+$/.test(ip);
}

export interface MultiVendorCameraRoutesDeps {
  app: Express;
  pool: Pool;
}

export function setupMultiVendorCameraRoutes(deps: MultiVendorCameraRoutesDeps): void {
  const { app } = deps;

  // ── Sony ──────────────────────────────────────────────────────────

  app.post("/api/sony/connect", async (req, res) => {
    if (!requireUser(req, res)) return;
    const body = (req.body ?? {}) as { ipAddress?: string; port?: number };
    if (!body.ipAddress || !ipAddressValid(body.ipAddress)) {
      res.status(400).json({ error: "Ugyldig ipAddress" });
      return;
    }
    try {
      const client = getSonyClient(body.ipAddress, body.port ?? 8080);
      const info = await client.getCameraInfo();
      res.json({ success: true, camera: { ipAddress: body.ipAddress, port: body.port ?? 8080, info } });
    } catch (err) {
      res.status(502).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get("/api/sony/cameras/:ip/state", async (req, res) => {
    if (!requireUser(req, res)) return;
    const ip = req.params.ip;
    if (!ipAddressValid(ip)) {
      res.status(400).json({ error: "Ugyldig ip" });
      return;
    }
    try {
      const client = getSonyClient(ip);
      const [info, event] = await Promise.all([
        client.getCameraInfo(),
        client.getEvent(false), // immediate snapshot
      ]);
      res.json({ success: true, info, event });
    } catch (err) {
      res.status(502).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.post("/api/sony/cameras/:ip/record/start", async (req, res) => {
    if (!requireUser(req, res)) return;
    try {
      await getSonyClient(req.params.ip).startMovieRecording();
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/sony/cameras/:ip/record/stop", async (req, res) => {
    if (!requireUser(req, res)) return;
    try {
      await getSonyClient(req.params.ip).stopMovieRecording();
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/sony/cameras/:ip/settings", async (req, res) => {
    if (!requireUser(req, res)) return;
    const body = (req.body ?? {}) as {
      iso?: number;
      shutterSpeed?: string;
      fNumber?: string;
      whiteBalanceK?: number;
    };
    try {
      const client = getSonyClient(req.params.ip);
      if (body.iso !== undefined) await client.setIso(body.iso);
      if (body.shutterSpeed) await client.setShutterSpeed(body.shutterSpeed);
      if (body.fNumber) await client.setFNumber(body.fNumber);
      if (body.whiteBalanceK !== undefined) await client.setWhiteBalance(body.whiteBalanceK);
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete("/api/sony/cameras/:ip", async (req, res) => {
    if (!requireUser(req, res)) return;
    clearSonyClient(req.params.ip);
    res.json({ success: true });
  });

  // ── ARRI ──────────────────────────────────────────────────────────

  app.post("/api/arri/connect", async (req, res) => {
    if (!requireUser(req, res)) return;
    const body = (req.body ?? {}) as { ipAddress?: string; port?: number; secure?: boolean };
    if (!body.ipAddress || !ipAddressValid(body.ipAddress)) {
      res.status(400).json({ error: "Ugyldig ipAddress" });
      return;
    }
    try {
      const client = getArriClient(body.ipAddress, body.port ?? 80, body.secure ?? false);
      const info = await client.getInfo();
      res.json({
        success: true,
        camera: { ipAddress: body.ipAddress, port: body.port ?? 80, info },
      });
    } catch (err) {
      res.status(502).json({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get("/api/arri/cameras/:ip/state", async (req, res) => {
    if (!requireUser(req, res)) return;
    try {
      const client = getArriClient(req.params.ip);
      const [info, state] = await Promise.all([client.getInfo(), client.getState()]);
      res.json({ success: true, info, state });
    } catch (err) {
      res.status(502).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/arri/cameras/:ip/record/start", async (req, res) => {
    if (!requireUser(req, res)) return;
    try {
      await getArriClient(req.params.ip).startRecording();
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/arri/cameras/:ip/record/stop", async (req, res) => {
    if (!requireUser(req, res)) return;
    try {
      await getArriClient(req.params.ip).stopRecording();
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/arri/cameras/:ip/settings", async (req, res) => {
    if (!requireUser(req, res)) return;
    const body = (req.body ?? {}) as {
      iso?: number;
      shutter?: string;
      iris?: string;
      fps?: number;
      whiteBalanceK?: number;
      tint?: number;
    };
    try {
      const client = getArriClient(req.params.ip);
      if (body.iso !== undefined || body.shutter || body.iris) {
        await client.setExposure({
          iso: body.iso,
          shutter: body.shutter,
          iris: body.iris,
        });
      }
      if (body.fps !== undefined) await client.setFps(body.fps);
      if (body.whiteBalanceK !== undefined) {
        await client.setWhiteBalance(body.whiteBalanceK, body.tint ?? 0);
      }
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── Z CAM ─────────────────────────────────────────────────────────

  app.post("/api/zcam/connect", async (req, res) => {
    if (!requireUser(req, res)) return;
    const body = (req.body ?? {}) as { ipAddress?: string; port?: number };
    if (!body.ipAddress || !ipAddressValid(body.ipAddress)) {
      res.status(400).json({ error: "Ugyldig ipAddress" });
      return;
    }
    try {
      const client = getZcamClient(body.ipAddress, body.port ?? 80);
      await client.openSession();
      const info = await client.getInfo();
      res.json({
        success: true,
        camera: { ipAddress: body.ipAddress, port: body.port ?? 80, info },
      });
    } catch (err) {
      res.status(502).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get("/api/zcam/cameras/:ip/state", async (req, res) => {
    if (!requireUser(req, res)) return;
    try {
      const client = getZcamClient(req.params.ip);
      const [info, state] = await Promise.all([client.getInfo(), client.getState()]);
      res.json({ success: true, info, state });
    } catch (err) {
      res.status(502).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/zcam/cameras/:ip/record/start", async (req, res) => {
    if (!requireUser(req, res)) return;
    try {
      await getZcamClient(req.params.ip).startRecording();
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/zcam/cameras/:ip/record/stop", async (req, res) => {
    if (!requireUser(req, res)) return;
    try {
      await getZcamClient(req.params.ip).stopRecording();
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post("/api/zcam/cameras/:ip/settings", async (req, res) => {
    if (!requireUser(req, res)) return;
    const body = (req.body ?? {}) as {
      iso?: number;
      shutterSpeed?: string;
      iris?: string;
      fps?: number;
      whiteBalanceK?: number;
    };
    try {
      const client = getZcamClient(req.params.ip);
      if (body.iso !== undefined) await client.setIso(body.iso);
      if (body.shutterSpeed) await client.setShutterSpeed(body.shutterSpeed);
      if (body.iris) await client.setIris(body.iris);
      if (body.fps !== undefined) await client.setFps(body.fps);
      if (body.whiteBalanceK !== undefined) await client.setWhiteBalance(body.whiteBalanceK);
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete("/api/zcam/cameras/:ip", async (req, res) => {
    if (!requireUser(req, res)) return;
    clearZcamClient(req.params.ip);
    res.json({ success: true });
  });
}
