/**
 * blackmagic-adapter.ts
 *
 * Blackmagic Camera Control via Web Bluetooth API. Snakker direkte fra
 * browser til BMD-kameraer (URSA Mini, Pocket Cinema, URSA Broadcast).
 * Ingen backend-proxy nødvendig — Web Bluetooth API i Chromium-browsere
 * gir browser-side BLE-tilgang.
 *
 * Begrensninger:
 *   - Bare Chromium-browsere (Chrome, Edge, Opera)
 *   - Krever HTTPS (vi har det)
 *   - Krever user-gesture for å pare (security-model)
 *   - Fungerer ikke i Safari/iOS — der må iPad CaptureApp brukes med
 *     native CoreBluetooth
 *
 * Protokoll (offentlig Blackmagic Camera Control Spec):
 *   Service UUID:                291D567A-6D75-11E6-8B77-86F30CA893D3
 *   Outgoing Camera Control:     5DD605F5-FB1B-4330-BD75-8EC9D7C6B0BE  (write)
 *   Incoming Camera Control:     B864E140-76A0-416A-BF30-5876504537D9  (notify)
 *   Camera Status:               7FE8691D-95DC-4FC5-8ABD-CA74339B51B9  (notify)
 *   Timecode:                    6D8F2110-86F1-41BF-9AFB-451D87E976C8  (notify)
 *
 * Command-pakke (binary):
 *   byte 0:  destination (1 byte) — 255 = "broadcast", 0..N = per-camera-id
 *   byte 1:  length (1 byte) — data-length etter header
 *   byte 2:  command-id (1 byte)
 *   byte 3:  reserved (1 byte)
 *   bytes 4+: data (varies per command)
 *
 * Common commands:
 *   0x00 0x00  = Lens / Focus              (data: int16 0..2048)
 *   0x00 0x02  = Lens / Iris               (data: int16 0..2048)
 *   0x01 0x00  = Video / Frame rate        (data: int8 enum)
 *   0x01 0x01  = Video / Sensor frame rate (data: int8 enum)
 *   0x01 0x02  = Video / Video mode        (data: int8 enum)
 *   0x01 0x04  = Video / Shutter angle     (data: int32 fixed-point)
 *   0x01 0x05  = Video / Shutter speed     (data: int32)
 *   0x01 0x07  = Video / Gain (dB)         (data: int8)
 *   0x01 0x08  = Video / ISO               (data: int32)
 *   0x01 0x0d  = Video / WB                (data: int16 + int16)
 *   0x0a 0x01  = Transport / Mode (preview/play/record) (data: int8 enum)
 */

import type {
  CameraAdapter,
  CameraStateSnapshot,
  CameraSubscription,
  NormalizedCameraSettings,
} from "./types";

// ─────────────────────────────────────────────────────────────────────
// Protokoll-konstanter
// ─────────────────────────────────────────────────────────────────────

const BMD_SERVICE_UUID = "291d567a-6d75-11e6-8b77-86f30ca893d3";
const BMD_OUTGOING_CONTROL_CHAR = "5dd605f5-fb1b-4330-bd75-8ec9d7c6b0be";
const BMD_INCOMING_CONTROL_CHAR = "b864e140-76a0-416a-bf30-5876504537d9";
const BMD_CAMERA_STATUS_CHAR = "7fe8691d-95dc-4fc5-8abd-ca74339b51b9";
const BMD_TIMECODE_CHAR = "6d8f2110-86f1-41bf-9afb-451d87e976c8";
const BMD_CAMERA_NAME_CHAR = "ffac0c52-c9fb-41a0-b063-cc76282eb89c";
const BMD_MODEL_CHAR = "7fe8691d-95dc-4fc5-8abd-ca74339b51b9";

// Camera Control protocol commands (group, parameter)
const CMD_LENS_FOCUS = [0x00, 0x00];
const CMD_LENS_IRIS_F = [0x00, 0x03]; // f-stop normalisert
const CMD_VIDEO_FPS = [0x01, 0x00];
const CMD_VIDEO_SHUTTER_ANGLE = [0x01, 0x04];
const CMD_VIDEO_GAIN = [0x01, 0x07];
const CMD_VIDEO_ISO = [0x01, 0x0e];
const CMD_VIDEO_WB = [0x01, 0x02];
const CMD_TRANSPORT_MODE = [0x0a, 0x01];

// Data types in protocol
const DATA_TYPE_BOOL = 0x00;
const DATA_TYPE_INT8 = 0x01;
const DATA_TYPE_INT16 = 0x02;
const DATA_TYPE_INT32 = 0x03;
const DATA_TYPE_INT64 = 0x04;
const DATA_TYPE_FIXED16 = 0x80;

// Operation types
const OP_ASSIGN = 0x00;
const OP_OFFSET = 0x01;

// Transport modes
const TRANSPORT_PREVIEW = 0;
const TRANSPORT_PLAY = 1;
const TRANSPORT_RECORD = 2;

// ─────────────────────────────────────────────────────────────────────
// Web Bluetooth-typer (kommer fra @types/web hvis prosjektet bruker dom-lib)
// ─────────────────────────────────────────────────────────────────────

interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: "gattserverdisconnected", listener: () => void): void;
}

interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  connected: boolean;
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic {
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  readValue(): Promise<DataView>;
  addEventListener(
    type: "characteristicvaluechanged",
    listener: (ev: { target: { value: DataView } }) => void,
  ): void;
}

interface BluetoothRequestDeviceOptions {
  filters?: Array<{ services?: string[]; namePrefix?: string }>;
  optionalServices?: string[];
}

interface NavigatorBluetooth {
  bluetooth?: {
    requestDevice(options: BluetoothRequestDeviceOptions): Promise<BluetoothDevice>;
    getDevices?: () => Promise<BluetoothDevice[]>;
  };
}

// ─────────────────────────────────────────────────────────────────────
// Discovery (paring-dialog)
// ─────────────────────────────────────────────────────────────────────

export function isWebBluetoothAvailable(): boolean {
  if (typeof navigator === "undefined") return false;
  return !!(navigator as unknown as NavigatorBluetooth).bluetooth;
}

/**
 * Trigger browser-native paring-dialog. Bruker-gesture er REQUIRED
 * (må kalles fra klikk-handler). Returnerer device hvis brukeren parer,
 * eller kaster hvis avbrutt.
 */
export async function requestBlackmagicCameraDevice(): Promise<BluetoothDevice> {
  if (!isWebBluetoothAvailable()) {
    throw new Error("Web Bluetooth ikke støttet i denne browseren. Bruk Chrome/Edge på desktop.");
  }
  const bluetooth = (navigator as unknown as NavigatorBluetooth).bluetooth!;
  return bluetooth.requestDevice({
    filters: [{ services: [BMD_SERVICE_UUID] }],
    optionalServices: [BMD_SERVICE_UUID],
  });
}

// ─────────────────────────────────────────────────────────────────────
// Packet-builder
// ─────────────────────────────────────────────────────────────────────

function buildCommandPacket(
  destination: number,
  commandGroup: number,
  commandParameter: number,
  dataType: number,
  operation: number,
  data: number[],
): Uint8Array {
  // Header: dest(1) + length(1) + command(1) + reserved(1) = 4 bytes
  // Then: group(1) + parameter(1) + type(1) + op(1) + data(N)
  // Total length stored in byte 1 is the data length (including group/param/type/op)
  const dataPart = [commandGroup, commandParameter, dataType, operation, ...data];
  const length = dataPart.length;
  // Pad to 4-byte boundary (BMD protocol requirement)
  const paddingBytes = (4 - (length % 4)) % 4;

  const packet = new Uint8Array(4 + length + paddingBytes);
  packet[0] = destination;
  packet[1] = length;
  packet[2] = 0; // command-id (always 0 for control)
  packet[3] = 0; // reserved
  for (let i = 0; i < dataPart.length; i++) packet[4 + i] = dataPart[i];
  return packet;
}

// Helpers for å pakke int-typer som BMD forventer (little-endian)
function int16Bytes(value: number): number[] {
  const buf = new ArrayBuffer(2);
  new DataView(buf).setInt16(0, value, true);
  return Array.from(new Uint8Array(buf));
}

function int32Bytes(value: number): number[] {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setInt32(0, value, true);
  return Array.from(new Uint8Array(buf));
}

// Fixed16 — Q0.16 fixed-point format. Maks-verdi 1.0 representeres som 2048
function fixed16Bytes(value: number): number[] {
  const fixed = Math.round(value * 2048);
  return int16Bytes(fixed);
}

// ─────────────────────────────────────────────────────────────────────
// BlackmagicCameraAdapter
// ─────────────────────────────────────────────────────────────────────

export class BlackmagicCameraAdapter implements CameraAdapter {
  readonly vendor = "blackmagic" as const;
  readonly transport = "ble" as const;
  readonly id: string;
  readonly recommendedPollIntervalMs = 1000;

  private device: BluetoothDevice;
  private server?: BluetoothRemoteGATTServer;
  private outgoingControl?: BluetoothRemoteGATTCharacteristic;
  private incomingControl?: BluetoothRemoteGATTCharacteristic;
  private cameraStatus?: BluetoothRemoteGATTCharacteristic;
  private timecode?: BluetoothRemoteGATTCharacteristic;
  private cameraName?: string;
  private stateListeners = new Set<(s: CameraStateSnapshot) => void>();

  // Cached state — oppdateres når notifications kommer
  private cachedSettings: NormalizedCameraSettings = {};
  private cachedRecording = false;
  private cachedBattery: number | undefined;

  constructor(device: BluetoothDevice) {
    this.device = device;
    this.id = device.id;
  }

  async connect(): Promise<void> {
    if (!this.device.gatt) {
      throw new Error("Device har ikke GATT-server tilgjengelig");
    }
    this.server = await this.device.gatt.connect();
    const service = await this.server.getPrimaryService(BMD_SERVICE_UUID);

    this.outgoingControl = await service.getCharacteristic(BMD_OUTGOING_CONTROL_CHAR);
    this.incomingControl = await service.getCharacteristic(BMD_INCOMING_CONTROL_CHAR);
    this.cameraStatus = await service.getCharacteristic(BMD_CAMERA_STATUS_CHAR);

    // Best-effort: timecode + name
    try {
      this.timecode = await service.getCharacteristic(BMD_TIMECODE_CHAR);
    } catch {
      // optional
    }
    try {
      const nameChar = await service.getCharacteristic(BMD_CAMERA_NAME_CHAR);
      const value = await nameChar.readValue();
      this.cameraName = new TextDecoder().decode(value.buffer);
    } catch {
      // optional
    }

    // Lytt på state-endringer fra kamera
    await this.incomingControl.startNotifications();
    this.incomingControl.addEventListener("characteristicvaluechanged", (ev) => {
      this.handleIncomingControl(ev.target.value);
    });

    await this.cameraStatus.startNotifications();
    this.cameraStatus.addEventListener("characteristicvaluechanged", (ev) => {
      this.handleStatusUpdate(ev.target.value);
    });

    // Reconnect-handler
    this.device.addEventListener("gattserverdisconnected", () => {
      this.server = undefined;
      console.warn("[BlackmagicAdapter] GATT disconnected");
    });
  }

  async disconnect(): Promise<void> {
    if (this.server?.connected) {
      this.server.disconnect();
    }
    this.server = undefined;
  }

  isConnected(): boolean {
    return !!this.server?.connected;
  }

  async fetchState(): Promise<CameraStateSnapshot> {
    return {
      vendor: this.vendor,
      id: this.id,
      label: this.cameraName ?? this.device.name ?? "Blackmagic Camera",
      model: this.cameraName ?? undefined,
      online: this.isConnected(),
      recording: this.cachedRecording,
      batteryPercent: this.cachedBattery,
      settings: { ...this.cachedSettings },
      fetchedAt: new Date().toISOString(),
    };
  }

  subscribeStateChanges(
    callback: (snapshot: CameraStateSnapshot) => void,
  ): CameraSubscription {
    this.stateListeners.add(callback);
    return {
      unsubscribe: () => this.stateListeners.delete(callback),
    };
  }

  async applySettings(settings: Partial<NormalizedCameraSettings>): Promise<void> {
    if (!this.outgoingControl) throw new Error("Not connected");

    // FPS — int8 enum (0=23.98, 1=24, 2=25, 3=29.97, 4=30, 5=50, 6=59.94, 7=60)
    if (settings.fps !== undefined) {
      const fpsEnum = fpsToBmdEnum(settings.fps);
      if (fpsEnum !== null) {
        await this.send(CMD_VIDEO_FPS, DATA_TYPE_INT8, [fpsEnum]);
        this.cachedSettings.fps = settings.fps;
      }
    }

    // Shutter angle — int32 fixed-point (degrees * 100)
    if (settings.shutterAngle !== undefined) {
      const value = Math.round(settings.shutterAngle * 100);
      await this.send(CMD_VIDEO_SHUTTER_ANGLE, DATA_TYPE_INT32, int32Bytes(value));
      this.cachedSettings.shutterAngle = settings.shutterAngle;
    }

    // ISO — int32 (sensitivity native value)
    if (settings.iso !== undefined) {
      await this.send(CMD_VIDEO_ISO, DATA_TYPE_INT32, int32Bytes(settings.iso));
      this.cachedSettings.iso = settings.iso;
    }

    // White balance — int16 Kelvin + int16 tint (0)
    if (settings.whiteBalanceK !== undefined) {
      await this.send(
        CMD_VIDEO_WB,
        DATA_TYPE_INT16,
        [...int16Bytes(settings.whiteBalanceK), ...int16Bytes(0)],
      );
      this.cachedSettings.whiteBalanceK = settings.whiteBalanceK;
    }

    // Iris — fixed-point f-stop normalisert 0..1
    if (settings.iris) {
      const fStop = parseFloat(settings.iris.replace("f/", ""));
      // Map f/1.4 (widest) → 0.0, f/22 (narrowest) → 1.0
      const normalized = Math.max(0, Math.min(1, (fStop - 1.4) / (22 - 1.4)));
      await this.send(CMD_LENS_IRIS_F, DATA_TYPE_FIXED16, fixed16Bytes(normalized));
      this.cachedSettings.iris = settings.iris;
    }

    // Focus position — fixed-point 0..1
    if (settings.focusPosition !== undefined) {
      await this.send(CMD_LENS_FOCUS, DATA_TYPE_FIXED16, fixed16Bytes(settings.focusPosition));
      this.cachedSettings.focusPosition = settings.focusPosition;
    }

    this.emitStateChange();
  }

  async startRecording(): Promise<void> {
    if (!this.outgoingControl) throw new Error("Not connected");
    await this.send(CMD_TRANSPORT_MODE, DATA_TYPE_INT8, [TRANSPORT_RECORD]);
    this.cachedRecording = true;
    this.emitStateChange();
  }

  async stopRecording(): Promise<void> {
    if (!this.outgoingControl) throw new Error("Not connected");
    await this.send(CMD_TRANSPORT_MODE, DATA_TYPE_INT8, [TRANSPORT_PREVIEW]);
    this.cachedRecording = false;
    this.emitStateChange();
  }

  // ── Private ──────────────────────────────────────────────────────

  private async send(
    command: number[],
    dataType: number,
    data: number[],
  ): Promise<void> {
    if (!this.outgoingControl) throw new Error("outgoing-control mangler");
    const packet = buildCommandPacket(
      255, // broadcast — alle paired-cameras lytter
      command[0],
      command[1],
      dataType,
      OP_ASSIGN,
      data,
    );
    await this.outgoingControl.writeValueWithoutResponse(packet);
  }

  private handleIncomingControl(value: DataView): void {
    // Parse innkommende control-pakke. Format identisk med outgoing.
    if (value.byteLength < 4) return;
    const length = value.getUint8(1);
    if (value.byteLength < 4 + length) return;
    const group = value.getUint8(4);
    const parameter = value.getUint8(5);
    const dataType = value.getUint8(6);
    // operation = value.getUint8(7);
    const dataStart = 8;

    // Tolk noen common command-svar
    if (group === 0x01 && parameter === 0x00 && dataType === DATA_TYPE_INT8) {
      // FPS-update
      const fpsEnum = value.getInt8(dataStart);
      const fps = bmdEnumToFps(fpsEnum);
      if (fps !== null) this.cachedSettings.fps = fps;
    } else if (group === 0x01 && parameter === 0x04 && dataType === DATA_TYPE_INT32) {
      // Shutter angle (degrees * 100)
      this.cachedSettings.shutterAngle = value.getInt32(dataStart, true) / 100;
    } else if (group === 0x01 && parameter === 0x0e && dataType === DATA_TYPE_INT32) {
      // ISO
      this.cachedSettings.iso = value.getInt32(dataStart, true);
    } else if (group === 0x01 && parameter === 0x02 && dataType === DATA_TYPE_INT16) {
      // WB Kelvin
      this.cachedSettings.whiteBalanceK = value.getInt16(dataStart, true);
    } else if (group === 0x0a && parameter === 0x01) {
      // Transport mode
      const mode = value.getInt8(dataStart);
      this.cachedRecording = mode === TRANSPORT_RECORD;
    }

    this.emitStateChange();
  }

  private handleStatusUpdate(value: DataView): void {
    // BMD camera-status-payload: forskjellige felt avhengig av kamera-modell.
    // Vi prøver å parse battery-percent som første byte når det er tilgjengelig.
    // Komplett parsing krever modell-spesifikt skjema.
    if (value.byteLength >= 1) {
      const firstByte = value.getUint8(0);
      // Heuristisk: hvis verdi er 0-100, tolk som battery-percent
      if (firstByte <= 100) {
        this.cachedBattery = firstByte;
      }
    }
    this.emitStateChange();
  }

  private emitStateChange(): void {
    if (this.stateListeners.size === 0) return;
    void this.fetchState().then((snapshot) => {
      for (const listener of this.stateListeners) {
        try {
          listener(snapshot);
        } catch (err) {
          console.warn("[BlackmagicAdapter] listener-feil:", err);
        }
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────
// FPS-enum-mapping
// ─────────────────────────────────────────────────────────────────────

function fpsToBmdEnum(fps: number): number | null {
  if (Math.abs(fps - 23.98) < 0.1) return 0;
  if (fps === 24) return 1;
  if (fps === 25) return 2;
  if (Math.abs(fps - 29.97) < 0.1) return 3;
  if (fps === 30) return 4;
  if (fps === 50) return 5;
  if (Math.abs(fps - 59.94) < 0.1) return 6;
  if (fps === 60) return 7;
  return null;
}

function bmdEnumToFps(enumValue: number): number | null {
  return [23.98, 24, 25, 29.97, 30, 50, 59.94, 60][enumValue] ?? null;
}
