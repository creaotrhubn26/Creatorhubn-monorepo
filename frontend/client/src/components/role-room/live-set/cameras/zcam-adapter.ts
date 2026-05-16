/**
 * zcam-adapter.ts
 *
 * Frontend Z CAM-adapter via backend-proxy /api/zcam/*.
 */

import type { CameraAdapter, CameraStateSnapshot, NormalizedCameraSettings } from "./types";

const BASE = "/api/zcam";

function getUserIdHeader(): string {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem("role-room-user-id");
    if (stored) return stored;
  }
  return "dev-user";
}

export class ZcamAdapter implements CameraAdapter {
  readonly vendor = "zcam" as const;
  readonly transport = "zcam-http" as const;
  readonly id: string;
  readonly recommendedPollIntervalMs = 2500;

  private connected = false;
  private cachedLabel: string;

  constructor(public readonly ipAddress: string, public readonly port: number = 80, label?: string) {
    this.id = `${ipAddress}:${port}`;
    this.cachedLabel = label ?? "Z CAM";
  }

  async connect(): Promise<void> {
    const response = await fetch(`${BASE}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-role-room-user-id": getUserIdHeader() },
      body: JSON.stringify({ ipAddress: this.ipAddress, port: this.port }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Z CAM connect failed (${response.status})`);
    }
    const body = (await response.json()) as { camera?: { info?: { model?: string } } };
    if (body.camera?.info?.model) this.cachedLabel = body.camera.info.model;
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
    const response = await fetch(
      `${BASE}/cameras/${encodeURIComponent(this.ipAddress)}/state`,
      { headers: { "x-role-room-user-id": getUserIdHeader() } },
    );
    const body = await response.json();
    const info = body.info ?? {};
    const state = body.state ?? {};

    const settings: NormalizedCameraSettings = {
      iso: state.iso,
      shutterSpeed: state.shutterSpeed,
      iris: state.iris && !state.iris.startsWith("f/") ? `f/${state.iris}` : state.iris,
      whiteBalanceK: state.whiteBalanceK,
      focusMode: state.focusMode,
      fps: state.fps,
    };

    return {
      vendor: this.vendor,
      id: this.id,
      label: this.cachedLabel,
      model: info.model,
      serialNumber: info.serialNumber,
      firmwareVersion: info.firmwareVersion,
      online: this.connected && body.success,
      recording: state.recording === true,
      batteryPercent: state.batteryPercent,
      storageFreeGb: state.storageFreeMb ? Math.round(state.storageFreeMb / 1024) : undefined,
      storageTotalGb: state.storageTotalMb ? Math.round(state.storageTotalMb / 1024) : undefined,
      temperatureStatus:
        state.temperatureCelsius && state.temperatureCelsius > 55
          ? "warning"
          : state.temperatureCelsius && state.temperatureCelsius > 70
            ? "critical"
            : "normal",
      settings,
      fetchedAt: new Date().toISOString(),
      vendorExtra: { temperatureCelsius: state.temperatureCelsius },
    };
  }

  async applySettings(settings: Partial<NormalizedCameraSettings>): Promise<void> {
    const body: Record<string, unknown> = {};
    if (settings.iso !== undefined) body.iso = settings.iso;
    if (settings.shutterSpeed) body.shutterSpeed = settings.shutterSpeed;
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
    if (!response.ok) throw new Error("Z CAM settings failed");
  }

  async startRecording(): Promise<void> {
    const response = await fetch(
      `${BASE}/cameras/${encodeURIComponent(this.ipAddress)}/record/start`,
      { method: "POST", headers: { "x-role-room-user-id": getUserIdHeader() } },
    );
    if (!response.ok) throw new Error("Z CAM record start failed");
  }

  async stopRecording(): Promise<void> {
    const response = await fetch(
      `${BASE}/cameras/${encodeURIComponent(this.ipAddress)}/record/stop`,
      { method: "POST", headers: { "x-role-room-user-id": getUserIdHeader() } },
    );
    if (!response.ok) throw new Error("Z CAM record stop failed");
  }
}
