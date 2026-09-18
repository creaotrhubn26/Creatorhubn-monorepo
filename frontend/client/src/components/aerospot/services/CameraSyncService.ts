/**
 * aerospot/services/CameraSyncService.ts
 *
 * Holder AeroSpot synkronisert med tilkoblet Canon-kamera via
 * eksisterende CCAPI-proxy (/api/ccapi/* + /api/aerospot/camera/*).
 * Gjenbruker CanonCcapiAdapter — bygger IKKE ny Canon-integrasjon.
 *
 * Ansvar: connection state, polling, normalisering, reconnect,
 * capture-events (addedcontents fra CCAPI event-polling).
 * Ingen UI-logikk her.
 */

import { CanonCcapiAdapter } from "../../role-room/live-set/cameras/canon-adapter";
import type { CameraSettingsSnapshot, CaptureContext, ConnectedCameraState } from "../types";
import { ccapiHeaders } from "@/lib/ccapiAuth";

type StateListener = (state: ConnectedCameraState) => void;
type CaptureListener = (ctx: CaptureContext) => void;

const DISCONNECTED: ConnectedCameraState = {
  connected: false,
  reconnecting: false,
  settings: {},
};

/** Parse "RF100-500mm F4.5-7.1 L IS USM" → [100, 500] */
export function parseLensRange(lensName?: string): [number, number] | null {
  if (!lensName) return null;
  const zoom = lensName.match(/(\d{2,4})-(\d{2,4})\s?mm/i);
  if (zoom) return [Number(zoom[1]), Number(zoom[2])];
  const prime = lensName.match(/(\d{2,4})\s?mm/i);
  if (prime) return [Number(prime[1]), Number(prime[1])];
  return null;
}

function parseIso(value?: string): number | "auto" | undefined {
  if (!value) return undefined;
  if (value.toLowerCase() === "auto") return "auto";
  const n = Number(value.replace(/^iso/i, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

export class CameraSyncService {
  private adapter: CanonCcapiAdapter | null = null;
  private state: ConnectedCameraState = DISCONNECTED;
  private stateListeners = new Set<StateListener>();
  private captureListeners = new Set<CaptureListener>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private eventAbort: AbortController | null = null;
  private consecutiveFailures = 0;

  getState(): ConnectedCameraState {
    return this.state;
  }

  onStateChange(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    fn(this.state);
    return () => this.stateListeners.delete(fn);
  }

  onCapture(fn: CaptureListener): () => void {
    this.captureListeners.add(fn);
    return () => this.captureListeners.delete(fn);
  }

  async connect(ipAddress: string): Promise<void> {
    await this.disconnect();
    this.adapter = new CanonCcapiAdapter(ipAddress);
    this.emit({ ...DISCONNECTED, reconnecting: true, ipAddress });
    await this.adapter.connect();
    this.consecutiveFailures = 0;
    await this.refresh();
    this.pollTimer = setInterval(() => void this.refresh(), this.adapter.recommendedPollIntervalMs);
    this.startEventLoop(ipAddress);
  }

  async disconnect(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.eventAbort?.abort();
    this.eventAbort = null;
    if (this.adapter) {
      await this.adapter.disconnect().catch(() => undefined);
      this.adapter = null;
    }
    this.emit(DISCONNECTED);
  }

  /** Hent state + shooting-settings og normaliser. */
  private async refresh(): Promise<void> {
    const adapter = this.adapter;
    if (!adapter) return;
    try {
      const [snapshot, settings] = await Promise.all([
        adapter.fetchState(),
        this.fetchShootingSettings(adapter.ipAddress),
      ]);
      this.consecutiveFailures = 0;
      const lensName =
        typeof snapshot.vendorExtra?.lensName === "string"
          ? snapshot.vendorExtra.lensName
          : this.state.lensName;
      this.emit({
        connected: snapshot.online,
        reconnecting: false,
        model: snapshot.model ?? this.state.model,
        lensName,
        batteryPercent: snapshot.batteryPercent,
        storageFreeGb: snapshot.storageFreeGb,
        settings: settings ?? this.state.settings,
        ipAddress: adapter.ipAddress,
        lastUpdatedIso: snapshot.fetchedAt,
      });
    } catch {
      this.consecutiveFailures += 1;
      // 3 strake feil = mistet forbindelse → reconnecting-state.
      if (this.consecutiveFailures >= 3 && this.state.connected) {
        this.emit({ ...this.state, connected: false, reconnecting: true });
      }
    }
  }

  private async fetchShootingSettings(ip: string): Promise<CameraSettingsSnapshot | null> {
    try {
      const res = await fetch(`/api/aerospot/camera/${encodeURIComponent(ip)}/settings`, {
        credentials: "include",
        headers: ccapiHeaders(),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        settings?: { shutterSpeed?: string; aperture?: string; iso?: string };
      };
      if (!body.settings) return null;
      return {
        shutterSpeed: body.settings.shutterSpeed,
        aperture: body.settings.aperture ? `f/${body.settings.aperture.replace(/^f\/?/i, "")}` : undefined,
        iso: parseIso(body.settings.iso),
      };
    } catch {
      return null;
    }
  }

  /**
   * Event-loop mot CCAPI long-poll — fanger addedcontents (= bilde tatt)
   * og emitter CaptureContext med presist tidsstempel.
   */
  private startEventLoop(ip: string): void {
    this.eventAbort?.abort();
    const abort = new AbortController();
    this.eventAbort = abort;
    const loop = async (): Promise<void> => {
      while (!abort.signal.aborted && this.adapter) {
        try {
          const res = await fetch(`/api/ccapi/cameras/${encodeURIComponent(ip)}/poll`, {
            credentials: "include",
            headers: ccapiHeaders(),
            signal: abort.signal,
          });
          if (!res.ok) throw new Error(String(res.status));
          const body = (await res.json()) as {
            polling?: { addedcontents?: string[] };
          };
          if (body.polling?.addedcontents && body.polling.addedcontents.length > 0) {
            const ctx: CaptureContext = {
              timestampIso: new Date().toISOString(),
              cameraModel: this.state.model,
              lensName: this.state.lensName,
              settings: this.state.settings,
            };
            for (const fn of this.captureListeners) fn(ctx);
          }
        } catch {
          if (abort.signal.aborted) return;
          // backoff før neste long-poll-forsøk
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    };
    void loop();
  }

  private emit(state: ConnectedCameraState): void {
    this.state = state;
    for (const fn of this.stateListeners) fn(state);
  }
}


/** Singleton — én kamera-forbindelse per app-instans. */
export const cameraSync = new CameraSyncService();
