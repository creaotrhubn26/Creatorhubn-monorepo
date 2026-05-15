/**
 * ccapi-client.ts
 *
 * Node-side Canon CCAPI-klient. Speiler iPad CaptureApp's CCAPIClient.swift
 * (samme protokoll, samme versjons-forhandling, samme insecure-trust).
 *
 * Protokoll (CCAPI Reference v1.4):
 *   GET  /ccapi                                  — capability-inventory
 *   GET  /ccapi/ver100/deviceinformation         — identity
 *   GET  /ccapi/ver100/devicestatus/battery
 *   GET  /ccapi/ver100/devicestatus/lens
 *   GET  /ccapi/ver100/devicestatus/temperature
 *   GET  /ccapi/ver110/devicestatus/storage
 *   GET  /ccapi/ver110/event/polling             — state diff
 *   POST /ccapi/ver100/shooting/control/shutterbutton/manual
 *
 * Self-signed cert: Canon-kameraer i AP-mode serverer self-signed.
 * Vi bruker en undici-Agent per-host som overstyrer rejectUnauthorized,
 * scoped til kameraets host. Andre HTTPS-kall i samme prosess påvirkes ikke.
 *
 * Versjons-forhandling: kameraets /ccapi-respons har 'apis': { ver100: [...],
 * ver110: [...] }. pickVersion velger høyeste versjon som har endpoint-stien.
 */

import { Agent } from "undici";

// ─────────────────────────────────────────────────────────────────────
// Typer (matcher CCAPI-respons-shapen)
// ─────────────────────────────────────────────────────────────────────

export interface CcapiInventory {
  apis: Record<string, Array<{ path: string; get?: boolean; post?: boolean; delete?: boolean }>>;
}

export interface CcapiDeviceInfo {
  manufacturer?: string;
  productname?: string;
  guid?: string;
  serialnumber?: string;
  macaddress?: string;
  firmwareversion?: string;
}

export interface CcapiBatteryStatus {
  name?: string;
  kind?: string;
  level?: string;  // 'high' | 'half' | 'low' | 'quarter' etc, eller %
  quality?: string;
}

export interface CcapiLensStatus {
  name?: string;
  mount?: string;
}

export interface CcapiTemperatureStatus {
  status?: string;  // 'normal' | 'high' | 'frameratedown'
}

export interface CcapiStorage {
  name?: string;
  path?: string;
  accesscapability?: string;
  maxsize?: number;
  freesize?: number;
  numberofcontents?: number;
  url?: string;
}

export interface CcapiPollingResponse {
  // Kameraets event-snapshot — bare endrede felt populeres
  battery?: CcapiBatteryStatus;
  lens?: CcapiLensStatus;
  temperature?: CcapiTemperatureStatus;
  storage?: { storagelist?: CcapiStorage[] };
  shooting?: Record<string, unknown>;
  addedcontents?: string[];
  [key: string]: unknown;
}

export interface CcapiCameraState {
  identity: CcapiDeviceInfo;
  battery?: CcapiBatteryStatus;
  lens?: CcapiLensStatus;
  temperature?: CcapiTemperatureStatus;
  storages?: CcapiStorage[];
  supportedVersions: string[];
  lastFetchedAt: string;
}

// ─────────────────────────────────────────────────────────────────────
// Per-camera klient
// ─────────────────────────────────────────────────────────────────────

/**
 * Klient mot ett kamera. Holder cached inventory + undici-Agent for
 * self-signed cert. Aktor-pattern fra iPad-implementasjonen er ikke
 * nødvendig her — Node er single-threaded.
 */
export class CcapiClient {
  private inventory: CcapiInventory | null = null;
  private readonly agent: Agent;

  constructor(public readonly baseUrl: string) {
    // undici-Agent som ignorerer self-signed cert KUN for denne URL-en.
    // Vi instansierer per-kamera så cert-trust ikke lekker mellom kameraer.
    this.agent = new Agent({
      connect: {
        rejectUnauthorized: false,
      },
    });
  }

  /** Inventorer kameraets capabilities — må kjøres før andre endepunkter. */
  async connect(): Promise<CcapiInventory> {
    const inventory = await this.get<CcapiInventory>("/ccapi");
    this.inventory = inventory;
    return inventory;
  }

  isConnected(): boolean {
    return this.inventory !== null;
  }

  /**
   * Velg høyeste API-versjon som har endpoint-stien. F.eks. for
   * '/devicestatus/storage' kan ver110 ha den men ver100 ikke. Vi
   * prefererer høyeste versjon hvis den eksisterer.
   */
  private pickVersion(endpointPath: string, minVersion: string): string {
    if (!this.inventory) {
      throw new Error("Not connected — call connect() first");
    }
    const versions = Object.keys(this.inventory.apis)
      .filter((v) => v.startsWith("ver"))
      .sort()
      .reverse(); // høyest først

    for (const version of versions) {
      if (version < minVersion) break;
      const fullPath = `/ccapi/${version}${endpointPath}`;
      if (this.inventory.apis[version]?.some((api) => api.path === fullPath)) {
        return version;
      }
    }
    // Fallback til minVersion selv om ikke advertised — noen kameraer
    // har endpoint uten å liste det i inventory
    return minVersion;
  }

  /** Device-info (model, serial, firmware) */
  async deviceInformation(): Promise<CcapiDeviceInfo> {
    return this.getVersioned<CcapiDeviceInfo>("/deviceinformation", "ver100");
  }

  /** Battery — kan returnere én eller liste (batterylist på ver110) */
  async battery(): Promise<CcapiBatteryStatus> {
    return this.getVersioned<CcapiBatteryStatus>("/devicestatus/battery", "ver100");
  }

  /** Lens-info */
  async lens(): Promise<CcapiLensStatus> {
    return this.getVersioned<CcapiLensStatus>("/devicestatus/lens", "ver100");
  }

  /** Temperatur-status (normal/high/frameratedown) */
  async temperature(): Promise<CcapiTemperatureStatus> {
    return this.getVersioned<CcapiTemperatureStatus>("/devicestatus/temperature", "ver100");
  }

  /** Storage-info (ver110+) */
  async storage(): Promise<CcapiStorage[]> {
    const result = await this.getVersioned<{ storagelist?: CcapiStorage[] }>("/devicestatus/storage", "ver110");
    return result.storagelist ?? [];
  }

  /** Trigger shutter — full_press + release-sekvens (samme som iPad) */
  async triggerShutter(af = true): Promise<void> {
    const path = "/ccapi/ver100/shooting/control/shutterbutton/manual";
    await this.post(path, { action: "full_press", af });
    await this.post(path, { action: "release", af });
  }

  /**
   * Short-poll: returnerer current diff umiddelbart. Spec §4.13.1.
   * Server-state må deretter cleares via DELETE for å unngå at samme
   * event returneres igjen.
   */
  async pollEvents(): Promise<CcapiPollingResponse> {
    return this.getVersioned<CcapiPollingResponse>("/event/polling", "ver100");
  }

  /**
   * Long-poll: server blokkerer opp til ~30s. Brukes av frontend
   * for live-state-oppdatering uten busy-polling.
   */
  async longPollEvents(timeoutMs = 30_000): Promise<CcapiPollingResponse> {
    return this.getVersioned<CcapiPollingResponse>(
      "/event/polling?continue=on",
      "ver100",
      timeoutMs,
    );
  }

  /** Clear polling-state (DELETE /event/polling) */
  async clearPollingState(): Promise<void> {
    const version = this.inventory ? this.pickVersion("/event/polling", "ver100") : "ver100";
    await this.deleteRequest(`/ccapi/${version}/event/polling`);
  }

  /**
   * Liste filer i kameraet — for live-preview-thumbnail kan vi pulle
   * siste fil her. Kameraet har 'DCIM/100CANON/...'-mappestruktur.
   */
  async listContents(storage = "card1", directory = "100CANON"): Promise<string[]> {
    const path = `/contents/${storage}/${directory}?kind=list`;
    const result = await this.getVersioned<{ url?: string[] }>(path, "ver120");
    return result.url ?? [];
  }

  /**
   * Hent bilde-data som Buffer (for live-preview-thumbnail).
   * Brukes for å oppdatere PROGRAM-feed når CCAPI-direct er eneste vei.
   */
  async downloadContent(contentUrl: string, kind: "main" | "display" | "thumbnail" = "display"): Promise<Buffer> {
    const url = `${contentUrl}?kind=${kind}`;
    const response = await fetch(url, { dispatcher: this.agent } as RequestInit & { dispatcher: Agent });
    if (!response.ok) {
      throw new Error(`Download failed (${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** Aggregert state-snapshot — én call returnerer alt frontend trenger */
  async fetchFullState(): Promise<CcapiCameraState> {
    if (!this.inventory) await this.connect();
    const [identity, battery, lens, temperature, storages] = await Promise.allSettled([
      this.deviceInformation(),
      this.battery(),
      this.lens(),
      this.temperature(),
      this.storage(),
    ]);
    return {
      identity: identity.status === "fulfilled" ? identity.value : {},
      battery: battery.status === "fulfilled" ? battery.value : undefined,
      lens: lens.status === "fulfilled" ? lens.value : undefined,
      temperature: temperature.status === "fulfilled" ? temperature.value : undefined,
      storages: storages.status === "fulfilled" ? storages.value : undefined,
      supportedVersions: Object.keys(this.inventory?.apis ?? {}),
      lastFetchedAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Low-level HTTP-helpere
  // ─────────────────────────────────────────────────────────────

  private async get<T>(path: string, timeoutMs?: number): Promise<T> {
    return this.request<T>("GET", path, undefined, timeoutMs);
  }

  private async getVersioned<T>(
    relativePath: string,
    minVersion: string,
    timeoutMs?: number,
  ): Promise<T> {
    // Split query-string så path-matching mot inventory virker
    const [pathOnly, query] = relativePath.split("?");
    const version = this.inventory ? this.pickVersion(pathOnly, minVersion) : minVersion;
    const fullPath = `/ccapi/${version}${pathOnly}${query ? "?" + query : ""}`;
    return this.request<T>("GET", fullPath, undefined, timeoutMs);
  }

  private async post(path: string, body: Record<string, unknown>): Promise<void> {
    await this.request<void>("POST", path, body);
  }

  private async deleteRequest(path: string): Promise<void> {
    await this.request<void>("DELETE", path);
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        // undici-spesifikt: dispatcher overstyrer global cert-trust per request
        dispatcher: this.agent,
      } as RequestInit & { dispatcher: Agent });
    } catch (err) {
      if (timer) clearTimeout(timer);
      const message = err instanceof Error ? err.message : String(err);
      throw new CcapiError(`${method} ${path}: ${message}`, "network");
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (response.status === 503) {
      throw new CcapiError("Camera busy", "busy", 503);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new CcapiError(
        `${method} ${path} failed (${response.status}): ${body.slice(0, 300)}`,
        "http",
        response.status,
      );
    }

    // DELETE og POST kan returnere tom body
    if (method !== "GET") {
      const text = await response.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }
    return (await response.json()) as T;
  }
}

export type CcapiErrorKind = "network" | "busy" | "http" | "unsupported";

export class CcapiError extends Error {
  constructor(
    message: string,
    public readonly kind: CcapiErrorKind,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "CcapiError";
  }
}

// ─────────────────────────────────────────────────────────────────────
// Per-prosess klient-cache (én klient per kamera-IP)
// ─────────────────────────────────────────────────────────────────────

const clientCache = new Map<string, CcapiClient>();

export function getCcapiClient(ipAddress: string, port = 443): CcapiClient {
  const baseUrl = `https://${ipAddress}:${port}`;
  let client = clientCache.get(baseUrl);
  if (!client) {
    client = new CcapiClient(baseUrl);
    clientCache.set(baseUrl, client);
  }
  return client;
}

export function clearCcapiClient(ipAddress: string, port = 443): void {
  const baseUrl = `https://${ipAddress}:${port}`;
  clientCache.delete(baseUrl);
}
