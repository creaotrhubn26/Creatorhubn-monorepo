/**
 * arri-adapter.ts
 *
 * Frontend ARRI-adapter via backend-proxy /api/arri/*.
 */

import type { CameraAdapter, CameraStateSnapshot, NormalizedCameraSettings } from "./types";

const BASE = "/api/arri";

function getUserIdHeader(): string {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("role-room-user-id");
    if (stored) return stored;
  }
  return "dev-user";
}

// ARRI bruker voltage (typisk 12-17V på Alexa Mini LF battery) — vi
// normaliserer til percent med konservativ kurve.
function arriVoltageToPercent(volts?: number): number | undefined {
  if (volts === undefined) return undefined;
  // Antar 12V = 0%, 16.5V = 100% (Lithium-Ion-typisk discharge-kurve)
  return Math.max(0, Math.min(100, Math.round(((volts - 12) / 4.5) * 100)));
}

export class ArriWebAdapter implements CameraAdapter {
  readonly vendor = "arri" as const;
  readonly transport = "arri-web" as const;
  readonly id: string;
  readonly recommendedPollIntervalMs = 2000;

  private connected = false;
  private cachedLabel: string;

  constructor(public readonly ipAddress: string, public readonly port: number = 80, label?: string) {
    this.id = `${ipAddress}:${port}`;
    this.cachedLabel = label ?? "ARRI Alexa";
  }

  async connect(): Promise<void> {
    const response = await fetch(`${BASE}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-role-room-user-id": getUserIdHeader() },
      body: JSON.stringify({ ipAddress: this.ipAddress, port: this.port }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `ARRI connect failed (${response.status})`);
    }
    const body = (await response.json()) as { camera?: { info?: { model?: string } } };
    if (body.camera?.info?.model) this.cachedLabel = body.camera.info.model;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async fetchState(): Promise<CameraStateSnapshot> {
    const response = await fetch(
      `${BASE}/cameras/${encodeURIComponent(this.ipAddress)}/state`,
      { headers: { "x-role-room-user-id": getUserIdHeader() } },
    );
    const body = await response.json();
    const info = body.info ?? {};
    const state = body.state ?? {};

    const settings: NormalizedCameraSettings = {
      iso: state.iso,
      shutterSpeed: state.shutter,
      iris: state.iris,
      whiteBalanceK: state.whiteBalanceK,
      fps: state.fps,
      resolution: state.resolution,
      codec: state.codec,
    };

    const totalStorageGb = (state.cardSlot1?.totalGb ?? 0) + (state.cardSlot2?.totalGb ?? 0);
    const freeStorageGb = (state.cardSlot1?.freeGb ?? 0) + (state.cardSlot2?.freeGb ?? 0);

    return {
      vendor: this.vendor,
      id: this.id,
      label: this.cachedLabel,
      model: info.model,
      serialNumber: info.serialNumber,
      firmwareVersion: info.firmwareVersion,
      online: this.connected && body.success,
      recording: state.recording === true,
      batteryPercent: arriVoltageToPercent(state.batteryVoltage),
      storageFreeGb: freeStorageGb || undefined,
      storageTotalGb: totalStorageGb || undefined,
      temperatureStatus:
        state.temperatureCelsius && state.temperatureCelsius > 50
          ? "warning"
          : state.temperatureCelsius && state.temperatureCelsius > 65
            ? "critical"
            : "normal",
      settings,
      fetchedAt: new Date().toISOString(),
      vendorExtra: {
        batteryVoltage: state.batteryVoltage,
        temperatureCelsius: state.temperatureCelsius,
      },
    };
  }

  async applySettings(settings: Partial<NormalizedCameraSettings>): Promise<void> {
    const body: Record<string, unknown> = {};
    if (settings.iso !== undefined) body.iso = settings.iso;
    if (settings.shutterSpeed) body.shutter = settings.shutterSpeed;
    if (settings.iris) body.iris = settings.iris;
    if (settings.fps !== undefined) body.fps = settings.fps;
    if (settings.whiteBalanceK !== undefined) body.whiteBalanceK = settings.whiteBalanceK;

    const response = await fetch(
      `${BASE}/cameras/${encodeURIComponent(this.ipAddress)}/settings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-role-room-user-id": getUserIdHeader() },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) throw new Error("ARRI settings failed");
  }

  async startRecording(): Promise<void> {
    const response = await fetch(
      `${BASE}/cameras/${encodeURIComponent(this.ipAddress)}/record/start`,
      { method: "POST", headers: { "x-role-room-user-id": getUserIdHeader() } },
    );
    if (!response.ok) throw new Error("ARRI record start failed");
  }

  async stopRecording(): Promise<void> {
    const response = await fetch(
      `${BASE}/cameras/${encodeURIComponent(this.ipAddress)}/record/stop`,
      { method: "POST", headers: { "x-role-room-user-id": getUserIdHeader() } },
    );
    if (!response.ok) throw new Error("ARRI record stop failed");
  }
}
