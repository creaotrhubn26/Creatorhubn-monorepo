/**
 * sony-adapter.ts
 *
 * Frontend Sony-adapter via backend-proxy /api/sony/*.
 */

import type { CameraAdapter, CameraStateSnapshot, NormalizedCameraSettings } from "./types";
import { ccapiHeaders } from "@/lib/ccapiAuth";

const BASE = "/api/sony";

export class SonyWifiAdapter implements CameraAdapter {
  readonly vendor = "sony" as const;
  readonly transport = "sony-wifi" as const;
  readonly id: string;
  readonly recommendedPollIntervalMs = 3000;

  private connected = false;
  private cachedLabel: string;

  constructor(public readonly ipAddress: string, public readonly port: number = 8080, label?: string) {
    this.id = `${ipAddress}:${port}`;
    this.cachedLabel = label ?? "Sony Camera";
  }

  async connect(): Promise<void> {
    const response = await fetch(`${BASE}/connect`, {
      method: "POST",
      headers: ccapiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ ipAddress: this.ipAddress, port: this.port }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Sony connect failed (${response.status})`);
    }
    const body = (await response.json()) as { camera?: { info?: { model?: string } } };
    if (body.camera?.info?.model) this.cachedLabel = body.camera.info.model;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await fetch(`${BASE}/cameras/${encodeURIComponent(this.ipAddress)}`, {
      method: "DELETE",
      headers: ccapiHeaders(),
    });
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async fetchState(): Promise<CameraStateSnapshot> {
    const response = await fetch(
      `${BASE}/cameras/${encodeURIComponent(this.ipAddress)}/state`,
      { headers: ccapiHeaders() },
    );
    const body = await response.json();
    const info = body.info ?? {};
    const event = body.event ?? {};

    const settings: NormalizedCameraSettings = {};
    if (event.isoSpeedRate?.currentIsoSpeedRate) {
      const iso = parseInt(event.isoSpeedRate.currentIsoSpeedRate, 10);
      if (!Number.isNaN(iso)) settings.iso = iso;
    }
    if (event.shutterSpeed?.currentShutterSpeed) {
      settings.shutterSpeed = event.shutterSpeed.currentShutterSpeed;
    }
    if (event.fNumber?.currentFNumber) {
      settings.iris = `f/${event.fNumber.currentFNumber.replace(/^F/, "")}`;
    }
    if (event.whiteBalance?.currentColorTemperature) {
      settings.whiteBalanceK = event.whiteBalance.currentColorTemperature;
    }

    return {
      vendor: this.vendor,
      id: this.id,
      label: this.cachedLabel,
      model: info.model,
      serialNumber: info.productSerialNumber,
      firmwareVersion: info.firmwareVersion,
      online: this.connected && body.success,
      recording: event.recordingStatus === "MovieRecording" || event.recordingStatus === "recording",
      batteryPercent: event.batteryInfo?.[0]?.batteryRemainPercent,
      settings,
      fetchedAt: new Date().toISOString(),
      vendorExtra: { rawEvent: event },
    };
  }

  async applySettings(settings: Partial<NormalizedCameraSettings>): Promise<void> {
    const body: Record<string, unknown> = {};
    if (settings.iso !== undefined) body.iso = settings.iso;
    if (settings.shutterSpeed) body.shutterSpeed = settings.shutterSpeed;
    if (settings.iris) body.fNumber = settings.iris;
    if (settings.whiteBalanceK !== undefined) body.whiteBalanceK = settings.whiteBalanceK;

    const response = await fetch(
      `${BASE}/cameras/${encodeURIComponent(this.ipAddress)}/settings`,
      {
        method: "POST",
        headers: ccapiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error ?? "Sony settings failed");
    }
  }

  async startRecording(): Promise<void> {
    const response = await fetch(
      `${BASE}/cameras/${encodeURIComponent(this.ipAddress)}/record/start`,
      { method: "POST", headers: ccapiHeaders() },
    );
    if (!response.ok) throw new Error("Sony record start failed");
  }

  async stopRecording(): Promise<void> {
    const response = await fetch(
      `${BASE}/cameras/${encodeURIComponent(this.ipAddress)}/record/stop`,
      { method: "POST", headers: ccapiHeaders() },
    );
    if (!response.ok) throw new Error("Sony record stop failed");
  }
}
