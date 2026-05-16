/**
 * sony-wifi-client.ts
 *
 * Sony Wi-Fi Remote-protokoll for Venice, FX9, FX6, FX3, alpha-serie.
 * HTTPS REST på kameraets eget AP.
 *
 * Sony bruker delvis åpne API-er via Camera Remote API (eldre, ikke alle
 * pro-modeller) og Content Browser Mobile-protokollen (Venice, FX9).
 * Vi implementerer her det åpne subset som er kjent og fungerer på FX9/FX6:
 *
 *   POST /sony/camera/setShootMode
 *   POST /sony/camera/setIsoSpeedRate
 *   POST /sony/camera/setShutterSpeed
 *   POST /sony/camera/setFNumber
 *   POST /sony/camera/setWhiteBalance
 *   POST /sony/camera/startMovieRec
 *   POST /sony/camera/stopMovieRec
 *   POST /sony/camera/getEvent      — long-poll for state-diff
 *
 * Request-format: JSON-RPC-aktig
 *   { method: "setIsoSpeedRate", params: ["1600"], id: 1, version: "1.0" }
 *
 * For Venice spesifikt brukes Content Browser Mobile-protokoll (proprietary).
 * Vi stubber den siden den krever NDA-tilgjengelig dokumentasjon.
 */

import { Agent } from "undici";

export interface SonyCameraInfo {
  model?: string;
  productSerialNumber?: string;
  firmwareVersion?: string;
}

export interface SonyEventPayload {
  isoSpeedRate?: { currentIsoSpeedRate?: string };
  shutterSpeed?: { currentShutterSpeed?: string };
  fNumber?: { currentFNumber?: string };
  whiteBalance?: { currentWhiteBalanceMode?: string; currentColorTemperature?: number };
  recordingStatus?: string;
  batteryInfo?: Array<{ batteryRemainPercent?: number }>;
  // Sony returnerer events som array av forskjellige objekter — vi hopper
  // over noe detalje her
}

export class SonyWiFiClient {
  private readonly agent: Agent;
  private readonly baseUrl: string;
  private nextId = 1;

  constructor(ipAddress: string, port = 8080) {
    this.baseUrl = `http://${ipAddress}:${port}`;
    this.agent = new Agent({ connect: { rejectUnauthorized: false } });
  }

  /**
   * Kjør JSON-RPC-call mot /sony/camera-service (eller annet service-endpoint).
   * Sony-protokollen bruker numeriske id'er som forventes å rotere.
   */
  private async rpc<T>(service: "camera" | "system" | "avContent", method: string, params: unknown[] = []): Promise<T> {
    const response = await fetch(`${this.baseUrl}/sony/${service}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method,
        params,
        id: this.nextId++,
        version: "1.0",
      }),
      dispatcher: this.agent,
    } as RequestInit & { dispatcher: Agent });

    if (!response.ok) {
      throw new Error(`Sony ${method} failed (${response.status})`);
    }
    const body = await response.json() as { result?: unknown[]; error?: unknown };
    if (body.error) {
      throw new Error(`Sony ${method} error: ${JSON.stringify(body.error)}`);
    }
    return body.result?.[0] as T;
  }

  async getCameraInfo(): Promise<SonyCameraInfo> {
    try {
      const result = await this.rpc<unknown>("system", "getDeviceInfo");
      // Sony-respons-format varierer per modell
      if (typeof result === "object" && result !== null) {
        const obj = result as Record<string, unknown>;
        return {
          model: typeof obj.modelName === "string" ? obj.modelName : undefined,
          productSerialNumber: typeof obj.productSerialNumber === "string"
            ? obj.productSerialNumber
            : undefined,
          firmwareVersion: typeof obj.firmwareVersion === "string"
            ? obj.firmwareVersion
            : undefined,
        };
      }
    } catch {
      // ignore — getDeviceInfo støttes ikke av alle Sony-modeller
    }
    return {};
  }

  async startMovieRecording(): Promise<void> {
    await this.rpc("camera", "startMovieRec");
  }

  async stopMovieRecording(): Promise<void> {
    await this.rpc("camera", "stopMovieRec");
  }

  async setIso(iso: number): Promise<void> {
    await this.rpc("camera", "setIsoSpeedRate", [String(iso)]);
  }

  async setShutterSpeed(speed: string): Promise<void> {
    // Sony bruker streng som "1/60", "1/100", etc.
    await this.rpc("camera", "setShutterSpeed", [speed]);
  }

  async setFNumber(fStop: string): Promise<void> {
    // Sony bruker streng som "F2.8" (uten "/")
    const normalized = fStop.replace("f/", "F").toUpperCase();
    await this.rpc("camera", "setFNumber", [normalized]);
  }

  async setWhiteBalance(kelvin: number): Promise<void> {
    // Sony tar mode-streng + tint + temperature for manuell WB
    await this.rpc("camera", "setWhiteBalance", ["Color Temperature", false, kelvin]);
  }

  /**
   * Long-poll for state-diff. Sony's getEvent blokkerer opptil 25s
   * og returnerer et array med ulike state-objekter. Den første-call
   * fortalt med `false` returnerer current state; etterfølgende med
   * `true` returnerer diff siden forrige call.
   */
  async getEvent(longPoll = true): Promise<SonyEventPayload> {
    const result = await this.rpc<unknown>("camera", "getEvent", [longPoll]);
    if (!Array.isArray(result)) return {};
    // Sony returnerer event-objekter i index-spesifikke posisjoner
    const event: SonyEventPayload = {};
    for (const item of result) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const type = obj.type as string | undefined;
      if (type === "isoSpeedRate" && typeof obj.currentIsoSpeedRate === "string") {
        event.isoSpeedRate = { currentIsoSpeedRate: obj.currentIsoSpeedRate };
      } else if (type === "shutterSpeed" && typeof obj.currentShutterSpeed === "string") {
        event.shutterSpeed = { currentShutterSpeed: obj.currentShutterSpeed };
      } else if (type === "fNumber" && typeof obj.currentFNumber === "string") {
        event.fNumber = { currentFNumber: obj.currentFNumber };
      } else if (type === "whiteBalance") {
        event.whiteBalance = {
          currentWhiteBalanceMode: typeof obj.currentWhiteBalanceMode === "string"
            ? obj.currentWhiteBalanceMode
            : undefined,
          currentColorTemperature: typeof obj.currentColorTemperature === "number"
            ? obj.currentColorTemperature
            : undefined,
        };
      } else if (type === "cameraStatus" && typeof obj.cameraStatus === "string") {
        event.recordingStatus = obj.cameraStatus;
      } else if (type === "batteryInfo" && Array.isArray(obj.batteryInfo)) {
        event.batteryInfo = obj.batteryInfo
          .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
          .map((b) => ({
            batteryRemainPercent:
              typeof b.batteryRemainPercent === "number" ? b.batteryRemainPercent : undefined,
          }));
      }
    }
    return event;
  }
}

// Per-camera cache
const sonyClientCache = new Map<string, SonyWiFiClient>();

export function getSonyClient(ipAddress: string, port = 8080): SonyWiFiClient {
  const key = `${ipAddress}:${port}`;
  let client = sonyClientCache.get(key);
  if (!client) {
    client = new SonyWiFiClient(ipAddress, port);
    sonyClientCache.set(key, client);
  }
  return client;
}

export function clearSonyClient(ipAddress: string, port = 8080): void {
  sonyClientCache.delete(`${ipAddress}:${port}`);
}
