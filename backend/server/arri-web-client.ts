/**
 * arri-web-client.ts
 *
 * ARRI Web Remote protokoll for Alexa Mini LF, Alexa 35, Alexa Plus.
 * REST API over Wi-Fi/Ethernet — typisk på port 80 (HTTP) eller 443 (HTTPS,
 * avhengig av kamera-modell og firmware-versjon).
 *
 * Offentlig API-dokumentasjon er begrenset (NDA-tilgjengelig). Vi
 * implementerer det subset som er reverse-engineered av åpne prosjekter
 * (alexa-camera-control på GitHub, Pomfort Silverstack-integrasjon).
 *
 * Endpoints (basert på Alexa Mini LF firmware 7.x):
 *   GET  /api/v1/info               — kamera-modell, serial, firmware
 *   GET  /api/v1/state              — full state-snapshot
 *   POST /api/v1/recording/start    — start record
 *   POST /api/v1/recording/stop     — stop record
 *   POST /api/v1/settings/exposure  — ISO/shutter/iris
 *   POST /api/v1/settings/white-balance
 *   GET  /api/v1/events             — SSE-stream eller polling-snapshot
 *
 * MetaSync (metadata-streaming) er separat — bruker UDP-broadcast på
 * port 9100. Vi bryr oss ikke om den her; Web Remote-protokollen dekker
 * alt vi trenger for LIVE SET PRO's bruksmønster.
 */

import { Agent } from "undici";

export interface ArriCameraInfo {
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
}

export interface ArriStateSnapshot {
  recording?: boolean;
  iso?: number;
  shutter?: string;          // "180.0°" eller "1/48"
  iris?: string;             // "T2.8"
  whiteBalanceK?: number;
  tint?: number;
  batteryVoltage?: number;   // V (Alexa bruker volt, ikke %)
  cardSlot1?: { freeGb?: number; totalGb?: number };
  cardSlot2?: { freeGb?: number; totalGb?: number };
  temperatureCelsius?: number;
  fps?: number;
  resolution?: string;
  codec?: string;
}

export class ArriWebClient {
  private readonly agent: Agent;
  private readonly baseUrl: string;

  constructor(ipAddress: string, port = 80, secure = false) {
    const proto = secure ? "https" : "http";
    this.baseUrl = `${proto}://${ipAddress}:${port}`;
    this.agent = new Agent({
      connect: { rejectUnauthorized: false },
    });
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      dispatcher: this.agent,
    } as RequestInit & { dispatcher: Agent });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`ARRI ${method} ${path} failed (${response.status}): ${text.slice(0, 200)}`);
    }
    if (method === "POST") {
      const text = await response.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }
    return (await response.json()) as T;
  }

  async getInfo(): Promise<ArriCameraInfo> {
    try {
      const info = await this.request<Record<string, unknown>>("GET", "/api/v1/info");
      return {
        model: typeof info.model === "string" ? info.model : undefined,
        serialNumber: typeof info.serialNumber === "string" ? info.serialNumber : undefined,
        firmwareVersion: typeof info.firmwareVersion === "string" ? info.firmwareVersion : undefined,
      };
    } catch {
      return {};
    }
  }

  async getState(): Promise<ArriStateSnapshot> {
    try {
      const state = await this.request<Record<string, unknown>>("GET", "/api/v1/state");
      return parseArriState(state);
    } catch {
      return {};
    }
  }

  async startRecording(): Promise<void> {
    await this.request("POST", "/api/v1/recording/start", {});
  }

  async stopRecording(): Promise<void> {
    await this.request("POST", "/api/v1/recording/stop", {});
  }

  async setExposure(settings: { iso?: number; shutter?: string; iris?: string }): Promise<void> {
    const body: Record<string, unknown> = {};
    if (settings.iso !== undefined) body.iso = settings.iso;
    if (settings.shutter !== undefined) body.shutter = settings.shutter;
    if (settings.iris !== undefined) {
      // ARRI bruker T-stop heller enn f-stop ofte; normaliser
      body.iris = settings.iris.startsWith("T") ? settings.iris : settings.iris.replace("f/", "T");
    }
    await this.request("POST", "/api/v1/settings/exposure", body);
  }

  async setWhiteBalance(kelvin: number, tint = 0): Promise<void> {
    await this.request("POST", "/api/v1/settings/white-balance", {
      temperature: kelvin,
      tint,
    });
  }

  async setFps(fps: number): Promise<void> {
    await this.request("POST", "/api/v1/settings/fps", { fps });
  }
}

function parseArriState(raw: Record<string, unknown>): ArriStateSnapshot {
  const state: ArriStateSnapshot = {};

  if (typeof raw.recording === "boolean") state.recording = raw.recording;

  const exposure = raw.exposure as Record<string, unknown> | undefined;
  if (exposure) {
    if (typeof exposure.iso === "number") state.iso = exposure.iso;
    if (typeof exposure.shutter === "string") state.shutter = exposure.shutter;
    if (typeof exposure.iris === "string") state.iris = exposure.iris;
  }

  const wb = raw.whiteBalance as Record<string, unknown> | undefined;
  if (wb) {
    if (typeof wb.temperature === "number") state.whiteBalanceK = wb.temperature;
    if (typeof wb.tint === "number") state.tint = wb.tint;
  }

  const power = raw.power as Record<string, unknown> | undefined;
  if (power && typeof power.batteryVoltage === "number") {
    state.batteryVoltage = power.batteryVoltage;
  }

  const storage = raw.storage as Record<string, unknown> | undefined;
  if (storage) {
    const slot1 = storage.slot1 as Record<string, unknown> | undefined;
    const slot2 = storage.slot2 as Record<string, unknown> | undefined;
    if (slot1) {
      state.cardSlot1 = {
        freeGb: typeof slot1.freeGb === "number" ? slot1.freeGb : undefined,
        totalGb: typeof slot1.totalGb === "number" ? slot1.totalGb : undefined,
      };
    }
    if (slot2) {
      state.cardSlot2 = {
        freeGb: typeof slot2.freeGb === "number" ? slot2.freeGb : undefined,
        totalGb: typeof slot2.totalGb === "number" ? slot2.totalGb : undefined,
      };
    }
  }

  if (typeof raw.temperatureCelsius === "number") state.temperatureCelsius = raw.temperatureCelsius;

  const video = raw.video as Record<string, unknown> | undefined;
  if (video) {
    if (typeof video.fps === "number") state.fps = video.fps;
    if (typeof video.resolution === "string") state.resolution = video.resolution;
    if (typeof video.codec === "string") state.codec = video.codec;
  }

  return state;
}

const arriClientCache = new Map<string, ArriWebClient>();

export function getArriClient(ipAddress: string, port = 80, secure = false): ArriWebClient {
  const key = `${secure ? "https" : "http"}://${ipAddress}:${port}`;
  let client = arriClientCache.get(key);
  if (!client) {
    client = new ArriWebClient(ipAddress, port, secure);
    arriClientCache.set(key, client);
  }
  return client;
}
