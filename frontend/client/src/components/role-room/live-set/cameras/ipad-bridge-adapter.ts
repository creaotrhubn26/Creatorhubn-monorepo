/**
 * ipad-bridge-adapter.ts
 *
 * Generisk WebSocket-adapter mot iPad CaptureApp. iPad gjør native-SDK-
 * arbeidet (RED Cinema RCP, DJI Mobile SDK, Panasonic Wi-Fi-modul,
 * Bluetooth-protokoller via CoreBluetooth, etc.); web-UI snakker generisk
 * WebSocket-protokoll.
 *
 * Hvorfor denne arkitekturen:
 *   - RED Cinema RCP krever NDA + native binær — kan ikke ligge i browser
 *   - DJI Mobile SDK er iOS/Android-only
 *   - Panasonic 3GS-modul har proprietær REST som krever testing
 *   - iPad er allerede på set, har Wi-Fi/Bluetooth/USB-C
 *   - Generisk bridge gjør at adding av nye vendors bare krever iPad-side
 *     implementasjon — web-UI endres ikke
 *
 * Protokoll (iPad-side må implementere):
 *   Transport:  WebSocket (ws:// eller wss://) på iPad's IP
 *   Auth:       Token i query-string eller første message
 *   Messages:   JSON
 *
 * Message types (web → iPad):
 *   { type: 'list-cameras' }                     — be om liste over paired-kameraer
 *   { type: 'connect', cameraId }                — koble til ett kamera
 *   { type: 'fetch-state', cameraId }            — be om current state
 *   { type: 'set-settings', cameraId, settings }
 *   { type: 'record-start', cameraId }
 *   { type: 'record-stop', cameraId }
 *   { type: 'shutter', cameraId }
 *   { type: 'disconnect', cameraId }
 *
 * Message types (iPad → web):
 *   { type: 'cameras', cameras: [...] }
 *   { type: 'state', cameraId, state }
 *   { type: 'state-change', cameraId, state } — push-update
 *   { type: 'ok', requestId }
 *   { type: 'error', requestId?, error }
 */

import type {
  CameraAdapter,
  CameraStateSnapshot,
  CameraSubscription,
  CameraVendor,
  NormalizedCameraSettings,
} from "./types";

// ─────────────────────────────────────────────────────────────────────
// Bridge-message-typer
// ─────────────────────────────────────────────────────────────────────

interface BridgeListCamerasMessage {
  type: "list-cameras";
  requestId: string;
}

interface BridgeConnectMessage {
  type: "connect";
  requestId: string;
  cameraId: string;
}

interface BridgeFetchStateMessage {
  type: "fetch-state";
  requestId: string;
  cameraId: string;
}

interface BridgeSetSettingsMessage {
  type: "set-settings";
  requestId: string;
  cameraId: string;
  settings: Partial<NormalizedCameraSettings>;
}

interface BridgeRecordMessage {
  type: "record-start" | "record-stop" | "shutter" | "disconnect";
  requestId: string;
  cameraId: string;
}

type BridgeOutgoingMessage =
  | BridgeListCamerasMessage
  | BridgeConnectMessage
  | BridgeFetchStateMessage
  | BridgeSetSettingsMessage
  | BridgeRecordMessage;

interface BridgeCamerasResponse {
  type: "cameras";
  requestId?: string;
  cameras: Array<{
    id: string;
    vendor: CameraVendor;
    label: string;
    model?: string;
  }>;
}

interface BridgeStateResponse {
  type: "state" | "state-change";
  requestId?: string;
  cameraId: string;
  state: CameraStateSnapshot;
}

interface BridgeOkResponse {
  type: "ok";
  requestId: string;
}

interface BridgeErrorResponse {
  type: "error";
  requestId?: string;
  error: string;
}

type BridgeIncomingMessage =
  | BridgeCamerasResponse
  | BridgeStateResponse
  | BridgeOkResponse
  | BridgeErrorResponse;

// ─────────────────────────────────────────────────────────────────────
// IpadBridgeConnection — håndterer selve WebSocket-tilkoblingen
// ─────────────────────────────────────────────────────────────────────

/**
 * Single connection-instans per iPad-IP. Caches messages, multiplexer
 * requests/responses via requestId.
 */
export class IpadBridgeConnection {
  private ws: WebSocket | null = null;
  private requestCounter = 0;
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (err: Error) => void }>();
  private stateListeners = new Map<string, Set<(s: CameraStateSnapshot) => void>>();
  private connectionPromise: Promise<void> | null = null;

  constructor(private readonly wsUrl: string, private readonly authToken?: string) {}

  async ensureConnected(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = new Promise<void>((resolve, reject) => {
      const url = this.authToken
        ? `${this.wsUrl}?token=${encodeURIComponent(this.authToken)}`
        : this.wsUrl;
      const ws = new WebSocket(url);

      ws.addEventListener("open", () => {
        this.ws = ws;
        resolve();
      });

      ws.addEventListener("error", (ev) => {
        reject(new Error("iPad WebSocket-feil: " + String(ev)));
        this.connectionPromise = null;
      });

      ws.addEventListener("close", () => {
        this.ws = null;
        this.connectionPromise = null;
        // Reject alle pending requests
        for (const { reject: pendingReject } of this.pending.values()) {
          pendingReject(new Error("iPad-bridge disconnected"));
        }
        this.pending.clear();
      });

      ws.addEventListener("message", (ev) => this.handleMessage(ev.data));
    });

    return this.connectionPromise;
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Send message med requestId og returner Promise som resolves på matching response.
   *
   * Vi bruker en løs payload-type her siden Omit på diskriminert union ikke
   * distribuerer naturlig i TS. Caller bygger payload-objektet inline; runtime-
   * validation skjer iPad-side.
   */
  async send<T>(message: { type: BridgeOutgoingMessage["type"]; [key: string]: unknown }): Promise<T> {
    await this.ensureConnected();
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("iPad-bridge ikke koblet til");
    }
    const requestId = `req-${++this.requestCounter}`;
    const payload = { ...message, requestId };

    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.ws!.send(JSON.stringify(payload));

      // 10s timeout
      setTimeout(() => {
        if (this.pending.has(requestId)) {
          this.pending.delete(requestId);
          reject(new Error(`iPad-bridge timeout: ${message.type}`));
        }
      }, 10000);
    });
  }

  subscribeStateChanges(
    cameraId: string,
    callback: (snapshot: CameraStateSnapshot) => void,
  ): CameraSubscription {
    let listeners = this.stateListeners.get(cameraId);
    if (!listeners) {
      listeners = new Set();
      this.stateListeners.set(cameraId, listeners);
    }
    listeners.add(callback);
    return {
      unsubscribe: () => {
        listeners?.delete(callback);
        if (listeners?.size === 0) {
          this.stateListeners.delete(cameraId);
        }
      },
    };
  }

  private handleMessage(raw: unknown): void {
    let msg: BridgeIncomingMessage;
    try {
      msg = JSON.parse(String(raw)) as BridgeIncomingMessage;
    } catch {
      return;
    }

    // Push state-changes til subscribers
    if (msg.type === "state-change") {
      const listeners = this.stateListeners.get(msg.cameraId);
      if (listeners) {
        for (const listener of listeners) {
          try {
            listener(msg.state);
          } catch (err) {
            console.warn("[IpadBridge] listener-feil:", err);
          }
        }
      }
      return;
    }

    // Resolve pending request
    const requestId = "requestId" in msg ? msg.requestId : undefined;
    if (!requestId) return;
    const pending = this.pending.get(requestId);
    if (!pending) return;
    this.pending.delete(requestId);

    if (msg.type === "error") {
      pending.reject(new Error(msg.error));
    } else {
      pending.resolve(msg);
    }
  }
}

const bridgeConnectionCache = new Map<string, IpadBridgeConnection>();

export function getIpadBridge(wsUrl: string, authToken?: string): IpadBridgeConnection {
  const key = `${wsUrl}|${authToken ?? ""}`;
  let conn = bridgeConnectionCache.get(key);
  if (!conn) {
    conn = new IpadBridgeConnection(wsUrl, authToken);
    bridgeConnectionCache.set(key, conn);
  }
  return conn;
}

// ─────────────────────────────────────────────────────────────────────
// IpadBridgeCameraAdapter — én adapter per kamera bridged av iPad
// ─────────────────────────────────────────────────────────────────────

export class IpadBridgeCameraAdapter implements CameraAdapter {
  readonly transport = "ipad-bridge" as const;
  readonly recommendedPollIntervalMs = 5000; // bridge har push-updates, polling er fallback

  private connected = false;
  private subscription?: CameraSubscription;

  constructor(
    public readonly vendor: CameraVendor,
    public readonly id: string,
    private readonly bridge: IpadBridgeConnection,
    public readonly label: string,
    public readonly model?: string,
  ) {}

  async connect(): Promise<void> {
    await this.bridge.ensureConnected();
    await this.bridge.send({ type: "connect", cameraId: this.id });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
    try {
      await this.bridge.send({ type: "disconnect", cameraId: this.id });
    } catch {
      // ignore — bridge kan være død allerede
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.bridge.isOpen();
  }

  async fetchState(): Promise<CameraStateSnapshot> {
    const response = await this.bridge.send<BridgeStateResponse>({
      type: "fetch-state",
      cameraId: this.id,
    });
    return {
      ...response.state,
      // Sørg for at vendor er konsistent — iPad kan ha sin egen casing
      vendor: this.vendor,
      label: this.label,
      model: this.model ?? response.state.model,
    };
  }

  subscribeStateChanges(callback: (snapshot: CameraStateSnapshot) => void): CameraSubscription {
    this.subscription = this.bridge.subscribeStateChanges(this.id, callback);
    return this.subscription;
  }

  async applySettings(settings: Partial<NormalizedCameraSettings>): Promise<void> {
    await this.bridge.send({
      type: "set-settings",
      cameraId: this.id,
      settings,
    });
  }

  async startRecording(): Promise<void> {
    await this.bridge.send({ type: "record-start", cameraId: this.id });
  }

  async stopRecording(): Promise<void> {
    await this.bridge.send({ type: "record-stop", cameraId: this.id });
  }

  async triggerShutter(): Promise<void> {
    await this.bridge.send({ type: "shutter", cameraId: this.id });
  }
}

// ─────────────────────────────────────────────────────────────────────
// Discovery via bridge
// ─────────────────────────────────────────────────────────────────────

export interface BridgedCameraInfo {
  cameraId: string;
  vendor: CameraVendor;
  label: string;
  model?: string;
}

/**
 * Spør iPad-bridge om hvilke kameraer den har paired.
 * Returnerer ferdig-bygde adaptere caller kan add'e til pairing-state.
 */
export async function discoverBridgedCameras(
  bridge: IpadBridgeConnection,
): Promise<IpadBridgeCameraAdapter[]> {
  const response = await bridge.send<BridgeCamerasResponse>({ type: "list-cameras" });
  return response.cameras.map(
    (cam) => new IpadBridgeCameraAdapter(cam.vendor, cam.id, bridge, cam.label, cam.model),
  );
}
