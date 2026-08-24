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

// Kamera-IP må ligge på privat LAN. Tidligere godtok vi vilkårlig IPv4/IPv6
// → serveren kunne tvinges til å koble til hvilken som helst host (SSRF, bl.a.
// sky-metadata 169.254.169.254). Kun RFC1918-privat aksepteres. Samme sperre
// som aerospot-routes bruker.
function isPrivateLanIp(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const octets = m.slice(1).map(Number);
  if (octets.some((o) => o > 255)) return false;
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

// Valider :ip-param på ethvert kamera-endepunkt. 400 hvis ikke privat-LAN
// (hindrer SSRF mot vilkårlig host via req.params.ip).
function guardCameraIp(req: Request, res: Response): string | null {
  const ip = req.params.ip;
  if (!isPrivateLanIp(ip)) {
    res.status(400).json({ error: "Ugyldig ip" });
    return null;
  }
  return ip;
}

export interface MultiVendorCameraRoutesDeps {
  app: Express;
  requireUserSession: (req: any, res: any) => any;
  pool: Pool;
}

export function setupMultiVendorCameraRoutes(deps: MultiVendorCameraRoutesDeps): void {
  const { app, requireUserSession } = deps;

  // ── Sony ──────────────────────────────────────────────────────────

  app.post("/api/sony/connect", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const body = (req.body ?? {}) as { ipAddress?: string; port?: number };
    if (!body.ipAddress || !isPrivateLanIp(body.ipAddress)) {
      res.status(400).json({ error: "Ugyldig ipAddress" });
      return;
    }
    try {
      const client = getSonyClient(body.ipAddress, body.port ?? 8080);
      const info = await client.getCameraInfo();
      res.json({ success: true, camera: { ipAddress: body.ipAddress, port: body.port ?? 8080, info } });
    } catch (err) {
      res.status(502).json({ success: false, error: "vendor_error" });
    }
  });

  app.get("/api/sony/cameras/:ip/state", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const ip = guardCameraIp(req, res);
    if (!ip) return;
    try {
      const client = getSonyClient(ip);
      const [info, event] = await Promise.all([
        client.getCameraInfo(),
        client.getEvent(false), // immediate snapshot
      ]);
      res.json({ success: true, info, event });
    } catch (err) {
      res.status(502).json({ success: false, error: "vendor_error" });
    }
  });

  app.post("/api/sony/cameras/:ip/record/start", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const ip = guardCameraIp(req, res);
    if (!ip) return;
    try {
      await getSonyClient(ip).startMovieRecording();
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: "vendor_error" });
    }
  });

  app.post("/api/sony/cameras/:ip/record/stop", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const ip = guardCameraIp(req, res);
    if (!ip) return;
    try {
      await getSonyClient(ip).stopMovieRecording();
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: "vendor_error" });
    }
  });

  app.post("/api/sony/cameras/:ip/settings", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const ip = guardCameraIp(req, res);
    if (!ip) return;
    const body = (req.body ?? {}) as {
      iso?: number;
      shutterSpeed?: string;
      fNumber?: string;
      whiteBalanceK?: number;
    };
    try {
      const client = getSonyClient(ip);
      if (body.iso !== undefined) await client.setIso(body.iso);
      if (body.shutterSpeed) await client.setShutterSpeed(body.shutterSpeed);
      if (body.fNumber) await client.setFNumber(body.fNumber);
      if (body.whiteBalanceK !== undefined) await client.setWhiteBalance(body.whiteBalanceK);
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: "vendor_error" });
    }
  });

  app.delete("/api/sony/cameras/:ip", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const ip = guardCameraIp(req, res);
    if (!ip) return;
    clearSonyClient(ip);
    res.json({ success: true });
  });

  // ── ARRI ──────────────────────────────────────────────────────────

  app.post("/api/arri/connect", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const body = (req.body ?? {}) as { ipAddress?: string; port?: number; secure?: boolean };
    if (!body.ipAddress || !isPrivateLanIp(body.ipAddress)) {
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
      res.status(502).json({ success: false, error: "vendor_error" });
    }
  });

  app.get("/api/arri/cameras/:ip/state", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const ip = guardCameraIp(req, res);
    if (!ip) return;
    try {
      const client = getArriClient(ip);
      const [info, state] = await Promise.all([client.getInfo(), client.getState()]);
      res.json({ success: true, info, state });
    } catch (err) {
      res.status(502).json({ success: false, error: "vendor_error" });
    }
  });

  app.post("/api/arri/cameras/:ip/record/start", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const ip = guardCameraIp(req, res);
    if (!ip) return;
    try {
      await getArriClient(ip).startRecording();
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: "vendor_error" });
    }
  });

  app.post("/api/arri/cameras/:ip/record/stop", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const ip = guardCameraIp(req, res);
    if (!ip) return;
    try {
      await getArriClient(ip).stopRecording();
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: "vendor_error" });
    }
  });

  app.post("/api/arri/cameras/:ip/settings", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const ip = guardCameraIp(req, res);
    if (!ip) return;
    const body = (req.body ?? {}) as {
      iso?: number;
      shutter?: string;
      iris?: string;
      fps?: number;
      whiteBalanceK?: number;
      tint?: number;
    };
    try {
      const client = getArriClient(ip);
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
      res.status(502).json({ success: false, error: "vendor_error" });
    }
  });

  // ── Z CAM ─────────────────────────────────────────────────────────

  app.post("/api/zcam/connect", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const body = (req.body ?? {}) as { ipAddress?: string; port?: number };
    if (!body.ipAddress || !isPrivateLanIp(body.ipAddress)) {
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
      res.status(502).json({ success: false, error: "vendor_error" });
    }
  });

  app.get("/api/zcam/cameras/:ip/state", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const ip = guardCameraIp(req, res);
    if (!ip) return;
    try {
      const client = getZcamClient(ip);
      const [info, state] = await Promise.all([client.getInfo(), client.getState()]);
      res.json({ success: true, info, state });
    } catch (err) {
      res.status(502).json({ success: false, error: "vendor_error" });
    }
  });

  app.post("/api/zcam/cameras/:ip/record/start", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const ip = guardCameraIp(req, res);
    if (!ip) return;
    try {
      await getZcamClient(ip).startRecording();
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: "vendor_error" });
    }
  });

  app.post("/api/zcam/cameras/:ip/record/stop", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const ip = guardCameraIp(req, res);
    if (!ip) return;
    try {
      await getZcamClient(ip).stopRecording();
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: "vendor_error" });
    }
  });

  app.post("/api/zcam/cameras/:ip/settings", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const ip = guardCameraIp(req, res);
    if (!ip) return;
    const body = (req.body ?? {}) as {
      iso?: number;
      shutterSpeed?: string;
      iris?: string;
      fps?: number;
      whiteBalanceK?: number;
    };
    try {
      const client = getZcamClient(ip);
      if (body.iso !== undefined) await client.setIso(body.iso);
      if (body.shutterSpeed) await client.setShutterSpeed(body.shutterSpeed);
      if (body.iris) await client.setIris(body.iris);
      if (body.fps !== undefined) await client.setFps(body.fps);
      if (body.whiteBalanceK !== undefined) await client.setWhiteBalance(body.whiteBalanceK);
      res.json({ success: true });
    } catch (err) {
      res.status(502).json({ success: false, error: "vendor_error" });
    }
  });

  app.delete("/api/zcam/cameras/:ip", async (req, res) => {
    if (!requireUserSession(req, res)) return;
    const ip = guardCameraIp(req, res);
    if (!ip) return;
    clearZcamClient(ip);
    res.json({ success: true });
  });
}
