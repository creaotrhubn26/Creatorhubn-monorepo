/**
 * zcam-http-client.ts
 *
 * Z CAM HTTP API for E2, E2-M4, F8, F6, ZF — Z CAM's hele cinema-linje
 * eksponerer en åpen HTTP-API på port 80 (default). Dokumentasjon på
 * https://github.com/imaginevision/Z-Camera-Doc.
 *
 * Sentrale endpoints (alle GET med query-params):
 *   GET /info                       — camera-modell + serial + firmware
 *   POST /session                   — opprett kontroll-session (ofte krevd
 *                                     før set/rec-kommandoer)
 *   GET /ctrl/get?k=<key>          — les gjeldende settings-verdi
 *   GET /ctrl/set?<key>=<value>    — sett verdi (ja, GET ikke POST)
 *   GET /ctrl/rec?action=start     — start recording
 *   GET /ctrl/rec?action=stop      — stop recording
 *   GET /ctrl/film?action=get_status
 *   GET /ctrl/temperature
 *   GET /ctrl/battery
 *
 * Settings-keys (bruker /ctrl/set?<key>=<value>):
 *   iso, shutter_time, iris, wb (Kelvin), focus, primary_lens_zoom, fps
 *
 * Response-format: JSON med { code: 0, desc: "ok", msg: <value> }
 * code !== 0 betyr feil.
 */

import { Agent } from "undici";

export interface ZcamInfo {
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
}

export interface ZcamState {
  recording: boolean;
  iso?: number;
  shutterSpeed?: string;       // "1/48"
  iris?: string;               // "f/2.8" eller "2.8" (Z CAM-format)
  whiteBalanceK?: number;
  focusMode?: "auto" | "manual";
  batteryPercent?: number;
  temperatureCelsius?: number;
  storageFreeMb?: number;
  storageTotalMb?: number;
  fps?: number;
}

export class ZcamHttpClient {
  private readonly agent: Agent;
  private readonly baseUrl: string;

  constructor(ipAddress: string, port = 80) {
    this.baseUrl = `http://${ipAddress}:${port}`;
    this.agent = new Agent({ connect: { rejectUnauthorized: false } });
  }

  /**
   * Z CAM-respons-format. msg-feltet kan være string, number, eller objekt
   * avhengig av endpoint.
   */
  private async request<T>(method: "GET" | "POST", path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      dispatcher: this.agent,
    } as RequestInit & { dispatcher: Agent });
    if (!response.ok) {
      throw new Error(`Z CAM ${method} ${path} failed (${response.status})`);
    }
    const body = (await response.json()) as { code?: number; desc?: string; msg?: T };
    if (body.code !== 0 && body.code !== undefined) {
      throw new Error(`Z CAM error ${body.code}: ${body.desc ?? "unknown"}`);
    }
    return body.msg as T;
  }

  /** Opprett kontroll-session — krevet før set-kommandoer på de fleste modeller */
  async openSession(): Promise<void> {
    await this.request<unknown>("POST", "/session");
  }

  async getInfo(): Promise<ZcamInfo> {
    try {
      const info = await this.request<Record<string, unknown>>("GET", "/info");
      return {
        model: typeof info?.model === "string" ? info.model : undefined,
        serialNumber: typeof info?.sn === "string" ? info.sn : undefined,
        firmwareVersion: typeof info?.fw === "string" ? info.fw : undefined,
      };
    } catch {
      return {};
    }
  }

  async getState(): Promise<ZcamState> {
    const state: ZcamState = { recording: false };

    // Recording-status
    try {
      const status = await this.request<{ status?: string }>("GET", "/ctrl/film?action=get_status");
      state.recording = status?.status === "recording";
    } catch {
      // ignore
    }

    // Battery
    try {
      const battery = await this.request<number>("GET", "/ctrl/battery");
      if (typeof battery === "number") state.batteryPercent = battery;
    } catch {
      // ignore
    }

    // Temperature
    try {
      const temp = await this.request<number>("GET", "/ctrl/temperature");
      if (typeof temp === "number") state.temperatureCelsius = temp;
    } catch {
      // ignore
    }

    // Settings — fetch parallelt
    await Promise.allSettled(
      (
        [
          ["iso", (v: unknown) => (state.iso = parseInt(String(v), 10) || undefined)],
          ["shutter_time", (v: unknown) => (state.shutterSpeed = String(v))],
          ["iris", (v: unknown) => (state.iris = String(v))],
          ["wb", (v: unknown) => (state.whiteBalanceK = parseInt(String(v), 10) || undefined)],
          ["fps", (v: unknown) => (state.fps = parseInt(String(v), 10) || undefined)],
        ] as Array<[string, (v: unknown) => void]>
      ).map(async ([key, setter]) => {
        try {
          const value = await this.request<unknown>("GET", `/ctrl/get?k=${key}`);
          setter(value);
        } catch {
          // ignore — keyen kan være ikke-støttet på modellen
        }
      }),
    );

    return state;
  }

  async setIso(iso: number): Promise<void> {
    await this.request("GET", `/ctrl/set?iso=${iso}`);
  }

  async setShutterSpeed(speed: string): Promise<void> {
    // Z CAM forventer "1/48", "1/100", etc. — verdiene må encodes
    await this.request("GET", `/ctrl/set?shutter_time=${encodeURIComponent(speed)}`);
  }

  async setIris(fStop: string): Promise<void> {
    // Strip "f/" prefiks — Z CAM tar bare nummer ("2.8")
    const numeric = fStop.replace(/^f\//i, "");
    await this.request("GET", `/ctrl/set?iris=${encodeURIComponent(numeric)}`);
  }

  async setWhiteBalance(kelvin: number): Promise<void> {
    await this.request("GET", `/ctrl/set?wb=${kelvin}`);
  }

  async setFps(fps: number): Promise<void> {
    await this.request("GET", `/ctrl/set?fps=${fps}`);
  }

  async startRecording(): Promise<void> {
    await this.request("GET", "/ctrl/rec?action=start");
  }

  async stopRecording(): Promise<void> {
    await this.request("GET", "/ctrl/rec?action=stop");
  }
}

const zcamClientCache = new Map<string, ZcamHttpClient>();

export function getZcamClient(ipAddress: string, port = 80): ZcamHttpClient {
  const key = `${ipAddress}:${port}`;
  let client = zcamClientCache.get(key);
  if (!client) {
    client = new ZcamHttpClient(ipAddress, port);
    zcamClientCache.set(key, client);
  }
  return client;
}

export function clearZcamClient(ipAddress: string, port = 80): void {
  zcamClientCache.delete(`${ipAddress}:${port}`);
}
