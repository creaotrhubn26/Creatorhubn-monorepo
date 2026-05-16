/**
 * canon-adapter.ts
 *
 * Frontend CameraAdapter-implementasjon for Canon. Snakker via backend-
 * proxy (/api/ccapi/*) — direct-til-kamera er ikke mulig fra browser pga
 * self-signed cert.
 */

import type {
  CameraAdapter,
  CameraStateSnapshot,
  NormalizedCameraSettings,
} from "./types";

const BASE = "/api/ccapi";

interface CcapiStateResponse {
  success: boolean;
  state?: {
    identity?: { manufacturer?: string; productname?: string; serialnumber?: string; firmwareversion?: string };
    battery?: { level?: string };
    storages?: Array<{ freesize?: number; maxsize?: number }>;
    temperature?: { status?: string };
    supportedVersions?: string[];
    lastFetchedAt?: string;
  };
  error?: string;
}

function batteryLevelToPercent(level?: string): number | undefined {
  // Canon returnerer level som 'high'/'half'/'low'/'quarter' eller %
  if (!level) return undefined;
  const numeric = parseInt(level, 10);
  if (!Number.isNaN(numeric)) return Math.max(0, Math.min(100, numeric));
  const map: Record<string, number> = { high: 90, half: 50, quarter: 25, low: 10 };
  return map[level.toLowerCase()];
}

function temperatureStatusFromCanon(status?: string): CameraStateSnapshot["temperatureStatus"] {
  if (!status) return undefined;
  if (status === "normal") return "normal";
  if (status === "high" || status === "frameratedown") return "warning";
  return "critical";
}

export class CanonCcapiAdapter implements CameraAdapter {
  readonly vendor = "canon" as const;
  readonly transport = "ccapi-https" as const;
  readonly id: string;
  readonly recommendedPollIntervalMs = 2000;

  private connected = false;
  private cachedLabel: string;

  constructor(public readonly ipAddress: string, label?: string) {
    this.id = ipAddress;
    this.cachedLabel = label ?? "Canon Camera";
  }

  async connect(): Promise<void> {
    const response = await fetch(`${BASE}/connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-role-room-user-id": getUserIdHeader(),
      },
      body: JSON.stringify({ ipAddress: this.ipAddress }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Connect failed (${response.status})`);
    }
    const body = (await response.json()) as { camera?: { identity?: { productname?: string } } };
    if (body.camera?.identity?.productname) {
      this.cachedLabel = body.camera.identity.productname;
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await fetch(`${BASE}/cameras/${encodeURIComponent(this.ipAddress)}`, {
      method: "DELETE",
      headers: { "x-role-room-user-id": getUserIdHeader() },
    });
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async fetchState(): Promise<CameraStateSnapshot> {
    const response = await fetch(`${BASE}/cameras/${encodeURIComponent(this.ipAddress)}/state`, {
      headers: { "x-role-room-user-id": getUserIdHeader() },
    });
    const body = (await response.json()) as CcapiStateResponse;
    const state = body.state;
    const storage = state?.storages?.[0];
    const storageFreeGb = storage?.freesize ? Math.round(storage.freesize / (1024 * 1024 * 1024)) : undefined;
    const storageTotalGb = storage?.maxsize ? Math.round(storage.maxsize / (1024 * 1024 * 1024)) : undefined;

    return {
      vendor: this.vendor,
      id: this.id,
      label: this.cachedLabel,
      model: state?.identity?.productname,
      serialNumber: state?.identity?.serialnumber,
      firmwareVersion: state?.identity?.firmwareversion,
      online: this.connected && body.success,
      recording: false, // CCAPI polling-event gir dette — vi henter ikke det her
      batteryPercent: batteryLevelToPercent(state?.battery?.level),
      storageFreeGb,
      storageTotalGb,
      temperatureStatus: temperatureStatusFromCanon(state?.temperature?.status),
      settings: {}, // Canon CCAPI eksponerer settings via separate endpoints
      fetchedAt: state?.lastFetchedAt ?? new Date().toISOString(),
      vendorExtra: {
        supportedVersions: state?.supportedVersions,
      },
    };
  }

  async applySettings(_settings: Partial<NormalizedCameraSettings>): Promise<void> {
    // Canon settings via /ccapi/ver100/shooting/settings — krever per-setting
    // endpoint-call. Implementeres når backend-proxyen har shooting-settings-
    // routes wired (TODO).
    throw new Error("Canon settings-write krever shooting-settings-routes — kommer");
  }

  async startRecording(): Promise<void> {
    throw new Error("Canon video-recording-trigger krever /ccapi/ver100/shooting/control/recbutton — kommer");
  }

  async stopRecording(): Promise<void> {
    throw new Error("Canon video-recording-trigger krever /ccapi/ver100/shooting/control/recbutton — kommer");
  }

  async triggerShutter(): Promise<void> {
    const response = await fetch(`${BASE}/cameras/${encodeURIComponent(this.ipAddress)}/shutter`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-role-room-user-id": getUserIdHeader(),
      },
      body: JSON.stringify({ af: true }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Shutter failed (${response.status})`);
    }
  }
}

function getUserIdHeader(): string {
  // Hent fra eksisterende session/auth-state — frontend har dette via
  // role-room context. For nå: hardcoded fallback for utvikling.
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("role-room-user-id");
    if (stored) return stored;
  }
  return "dev-user";
}
