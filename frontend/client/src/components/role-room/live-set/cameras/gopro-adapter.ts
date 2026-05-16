/**
 * gopro-adapter.ts
 *
 * GoPro Web Bluetooth-adapter via Open GoPro BLE-protokollen. Støtter
 * HERO9, HERO10, HERO11, HERO12, HERO13, MAX og senere modeller med
 * Open GoPro firmware.
 *
 * Hovedforskjell fra Blackmagic-adapter:
 *   - GoPro bruker TLV-pakker (Type-Length-Value) for kommandoer
 *   - Multi-part fragmentering kreves for kommandoer > BLE MTU (~20 bytes)
 *   - Separate characteristics for command vs settings vs query
 *
 * Protokoll (Open GoPro spec, public):
 *   Service UUID:           0000fea6-0000-1000-8000-00805f9b34fb
 *   Command tx:             b5f90072-aa8d-11e3-9046-0002a5d5c51b  (write)
 *   Command rx (notify):    b5f90073-aa8d-11e3-9046-0002a5d5c51b
 *   Settings tx:            b5f90074-aa8d-11e3-9046-0002a5d5c51b  (write)
 *   Settings rx (notify):   b5f90075-aa8d-11e3-9046-0002a5d5c51b
 *   Query tx:               b5f90076-aa8d-11e3-9046-0002a5d5c51b  (write)
 *   Query rx (notify):      b5f90077-aa8d-11e3-9046-0002a5d5c51b
 *
 * Commands:
 *   0x01 0x01  = Start shutter (record start)
 *   0x01 0x00  = Stop shutter (record stop)
 *   0x05 0x01  = AP-mode på (aktiverer Wi-Fi for HTTP-API)
 *   0x05 0x00  = AP-mode av
 *
 * Status-IDs:
 *   2          = Internal battery percent
 *   8          = Currently recording
 *   54         = Available SD card space (bytes)
 *
 * Settings-IDs (mest brukte):
 *   2          = Resolution (enum)
 *   3          = FPS (enum)
 *   115        = White balance (enum: 0=Auto, 1=2300K, ..., 8=Native)
 *   75         = ISO Mode/Min/Max
 *   145        = Shutter (enum: Auto/1/30/1/60/...)
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

const GOPRO_SERVICE_UUID = "0000fea6-0000-1000-8000-00805f9b34fb";
const GOPRO_CMD_TX = "b5f90072-aa8d-11e3-9046-0002a5d5c51b";
const GOPRO_CMD_RX = "b5f90073-aa8d-11e3-9046-0002a5d5c51b";
const GOPRO_SETTINGS_TX = "b5f90074-aa8d-11e3-9046-0002a5d5c51b";
const GOPRO_SETTINGS_RX = "b5f90075-aa8d-11e3-9046-0002a5d5c51b";
const GOPRO_QUERY_TX = "b5f90076-aa8d-11e3-9046-0002a5d5c51b";
const GOPRO_QUERY_RX = "b5f90077-aa8d-11e3-9046-0002a5d5c51b";

// Commands
const CMD_SHUTTER = 0x01;
const CMD_AP_MODE = 0x05;
const CMD_GET_HARDWARE_INFO = 0x3c;

// Status-IDs
const STATUS_BATTERY_PERCENT = 2;
const STATUS_RECORDING = 8;
const STATUS_SD_SPACE_BYTES = 54;

// Settings-IDs (Open GoPro v2.0)
const SETTING_RESOLUTION = 2;
const SETTING_FPS = 3;
const SETTING_WB = 115;
const SETTING_ISO_MIN = 75;
const SETTING_SHUTTER = 145;

// Query types
const QUERY_REGISTER_STATUS_UPDATES = 0x53;
const QUERY_REGISTER_SETTING_UPDATES = 0x52;
const QUERY_GET_STATUS_VALUES = 0x13;
const QUERY_GET_SETTING_VALUES = 0x12;

// ─────────────────────────────────────────────────────────────────────
// Web Bluetooth-types (kopiert fra blackmagic-adapter for konsistens)
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
  };
}

// ─────────────────────────────────────────────────────────────────────
// Discovery
// ─────────────────────────────────────────────────────────────────────

export function isWebBluetoothAvailable(): boolean {
  if (typeof navigator === "undefined") return false;
  return !!(navigator as unknown as NavigatorBluetooth).bluetooth;
}

export async function requestGoProDevice(): Promise<BluetoothDevice> {
  if (!isWebBluetoothAvailable()) {
    throw new Error("Web Bluetooth ikke støttet i denne browseren. Bruk Chrome/Edge på desktop.");
  }
  const bluetooth = (navigator as unknown as NavigatorBluetooth).bluetooth!;
  return bluetooth.requestDevice({
    filters: [{ namePrefix: "GoPro" }, { services: [GOPRO_SERVICE_UUID] }],
    optionalServices: [GOPRO_SERVICE_UUID],
  });
}

// ─────────────────────────────────────────────────────────────────────
// Packet-builders
// ─────────────────────────────────────────────────────────────────────

/**
 * TLV-pakke for command. Format: [length(1B), command(1B), ...data]
 * Length-byte er total-payload-størrelse minus selve length-byten.
 */
function buildCommandPacket(commandId: number, ...data: number[]): Uint8Array {
  const length = 1 + data.length; // command-byte + data
  const packet = new Uint8Array(1 + length);
  packet[0] = length;
  packet[1] = commandId;
  for (let i = 0; i < data.length; i++) packet[2 + i] = data[i];
  return packet;
}

/**
 * Setting-pakke: [length(1B), settingId(1B), valueLength(1B), value...]
 */
function buildSettingPacket(settingId: number, value: number[]): Uint8Array {
  const valueLength = value.length;
  const totalLength = 2 + valueLength; // settingId + valueLength + value
  const packet = new Uint8Array(1 + totalLength);
  packet[0] = totalLength;
  packet[1] = settingId;
  packet[2] = valueLength;
  for (let i = 0; i < value.length; i++) packet[3 + i] = value[i];
  return packet;
}

/**
 * Query-pakke: [length(1B), queryType(1B), id1, id2, ...]
 */
function buildQueryPacket(queryType: number, ids: number[]): Uint8Array {
  const length = 1 + ids.length;
  const packet = new Uint8Array(1 + length);
  packet[0] = length;
  packet[1] = queryType;
  for (let i = 0; i < ids.length; i++) packet[2 + i] = ids[i];
  return packet;
}

// ─────────────────────────────────────────────────────────────────────
// FPS / Resolution / WB enum-mapping (Open GoPro v2.0+)
// ─────────────────────────────────────────────────────────────────────

function fpsToGoProEnum(fps: number): number | null {
  // Forenklet — Open GoPro v2.0 enum-verdiene
  if (fps === 240) return 0;
  if (fps === 120) return 1;
  if (fps === 100) return 2;
  if (fps === 60) return 5;
  if (fps === 50) return 6;
  if (fps === 30) return 8;
  if (fps === 25) return 9;
  if (fps === 24) return 10;
  return null;
}

function goProEnumToFps(enumValue: number): number | null {
  const map: Record<number, number> = {
    0: 240, 1: 120, 2: 100, 5: 60, 6: 50, 8: 30, 9: 25, 10: 24,
  };
  return map[enumValue] ?? null;
}

function whiteBalanceToGoProEnum(kelvin: number): number {
  // Open GoPro v2.0 WB-enum: 0=Auto, 1=2300K, 2=2800K, 3=3200K, 4=4000K,
  // 5=4500K, 6=5000K, 7=5500K, 8=6000K, 9=6500K, 10=Native
  if (kelvin <= 2400) return 1;
  if (kelvin <= 2900) return 2;
  if (kelvin <= 3500) return 3;
  if (kelvin <= 4200) return 4;
  if (kelvin <= 4750) return 5;
  if (kelvin <= 5200) return 6;
  if (kelvin <= 5750) return 7;
  if (kelvin <= 6200) return 8;
  return 9;
}

function goProEnumToWhiteBalance(enumValue: number): number | undefined {
  const map: Record<number, number> = {
    1: 2300, 2: 2800, 3: 3200, 4: 4000, 5: 4500,
    6: 5000, 7: 5500, 8: 6000, 9: 6500,
  };
  return map[enumValue];
}

// ─────────────────────────────────────────────────────────────────────
// GoProAdapter
// ─────────────────────────────────────────────────────────────────────

export class GoProAdapter implements CameraAdapter {
  readonly vendor = "gopro" as const;
  readonly transport = "ble" as const;
  readonly id: string;
  readonly recommendedPollIntervalMs = 2000;

  private device: BluetoothDevice;
  private server?: BluetoothRemoteGATTServer;
  private cmdTx?: BluetoothRemoteGATTCharacteristic;
  private settingsTx?: BluetoothRemoteGATTCharacteristic;
  private queryTx?: BluetoothRemoteGATTCharacteristic;
  private stateListeners = new Set<(s: CameraStateSnapshot) => void>();

  private cachedSettings: NormalizedCameraSettings = {};
  private cachedRecording = false;
  private cachedBattery: number | undefined;
  private cachedStorageFreeGb: number | undefined;
  private cachedModel: string | undefined;

  constructor(device: BluetoothDevice) {
    this.device = device;
    this.id = device.id;
  }

  async connect(): Promise<void> {
    if (!this.device.gatt) {
      throw new Error("Device har ikke GATT-server tilgjengelig");
    }
    this.server = await this.device.gatt.connect();
    const service = await this.server.getPrimaryService(GOPRO_SERVICE_UUID);

    this.cmdTx = await service.getCharacteristic(GOPRO_CMD_TX);
    this.settingsTx = await service.getCharacteristic(GOPRO_SETTINGS_TX);
    this.queryTx = await service.getCharacteristic(GOPRO_QUERY_TX);

    // Subscribe på response/notify-characteristics
    const cmdRx = await service.getCharacteristic(GOPRO_CMD_RX);
    const settingsRx = await service.getCharacteristic(GOPRO_SETTINGS_RX);
    const queryRx = await service.getCharacteristic(GOPRO_QUERY_RX);

    await cmdRx.startNotifications();
    cmdRx.addEventListener("characteristicvaluechanged", (ev) => {
      this.handleCommandResponse(ev.target.value);
    });

    await settingsRx.startNotifications();
    settingsRx.addEventListener("characteristicvaluechanged", (ev) => {
      this.handleSettingResponse(ev.target.value);
    });

    await queryRx.startNotifications();
    queryRx.addEventListener("characteristicvaluechanged", (ev) => {
      this.handleQueryResponse(ev.target.value);
    });

    this.device.addEventListener("gattserverdisconnected", () => {
      this.server = undefined;
      console.warn("[GoProAdapter] GATT disconnected");
    });

    // Registrer for status-updates på battery, recording, sd-space
    await this.sendQuery(
      QUERY_REGISTER_STATUS_UPDATES,
      [STATUS_BATTERY_PERCENT, STATUS_RECORDING, STATUS_SD_SPACE_BYTES],
    );

    // Spør om hardware-info for å få modell-navn
    await this.sendCommand(CMD_GET_HARDWARE_INFO);
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
      label: this.cachedModel ?? this.device.name ?? "GoPro",
      model: this.cachedModel,
      online: this.isConnected(),
      recording: this.cachedRecording,
      batteryPercent: this.cachedBattery,
      storageFreeGb: this.cachedStorageFreeGb,
      settings: { ...this.cachedSettings },
      fetchedAt: new Date().toISOString(),
    };
  }

  subscribeStateChanges(callback: (snapshot: CameraStateSnapshot) => void): CameraSubscription {
    this.stateListeners.add(callback);
    return {
      unsubscribe: () => this.stateListeners.delete(callback),
    };
  }

  async applySettings(settings: Partial<NormalizedCameraSettings>): Promise<void> {
    if (settings.fps !== undefined) {
      const enumValue = fpsToGoProEnum(settings.fps);
      if (enumValue !== null) {
        await this.sendSetting(SETTING_FPS, [enumValue]);
        this.cachedSettings.fps = settings.fps;
      }
    }

    if (settings.whiteBalanceK !== undefined) {
      const enumValue = whiteBalanceToGoProEnum(settings.whiteBalanceK);
      await this.sendSetting(SETTING_WB, [enumValue]);
      this.cachedSettings.whiteBalanceK = settings.whiteBalanceK;
    }

    if (settings.iso !== undefined) {
      // ISO bruker en mer kompleks enum med min/max. Forenklet: bare set
      // ISO min til nearest enum-verdi.
      const isoEnum = isoToGoProEnum(settings.iso);
      if (isoEnum !== null) {
        await this.sendSetting(SETTING_ISO_MIN, [isoEnum]);
        this.cachedSettings.iso = settings.iso;
      }
    }

    this.emitStateChange();
  }

  async startRecording(): Promise<void> {
    await this.sendCommand(CMD_SHUTTER, 0x01);
    this.cachedRecording = true;
    this.emitStateChange();
  }

  async stopRecording(): Promise<void> {
    await this.sendCommand(CMD_SHUTTER, 0x00);
    this.cachedRecording = false;
    this.emitStateChange();
  }

  // ── Private ──────────────────────────────────────────────────────

  private async sendCommand(commandId: number, ...data: number[]): Promise<void> {
    if (!this.cmdTx) throw new Error("Not connected");
    const packet = buildCommandPacket(commandId, ...data);
    await this.cmdTx.writeValueWithResponse(packet.buffer as ArrayBuffer);
  }

  private async sendSetting(settingId: number, value: number[]): Promise<void> {
    if (!this.settingsTx) throw new Error("Not connected");
    const packet = buildSettingPacket(settingId, value);
    await this.settingsTx.writeValueWithResponse(packet.buffer as ArrayBuffer);
  }

  private async sendQuery(queryType: number, ids: number[]): Promise<void> {
    if (!this.queryTx) throw new Error("Not connected");
    const packet = buildQueryPacket(queryType, ids);
    await this.queryTx.writeValueWithResponse(packet.buffer as ArrayBuffer);
  }

  private handleCommandResponse(value: DataView): void {
    // Format: [length, cmdId, status, ...data]
    if (value.byteLength < 3) return;
    const cmdId = value.getUint8(1);
    // const status = value.getUint8(2);
    if (cmdId === CMD_GET_HARDWARE_INFO && value.byteLength > 4) {
      // Hardware-info-respons: parse model-name (offset varierer per firmware)
      // Forenklet: vi prøver å finne første printable ASCII-streng
      const bytes = new Uint8Array(value.buffer, value.byteOffset + 3, value.byteLength - 3);
      const text = new TextDecoder().decode(bytes).replace(/[^\x20-\x7e]/g, "").trim();
      if (text.length > 0) {
        this.cachedModel = text.split(/\s+/).slice(0, 3).join(" ");
        this.emitStateChange();
      }
    }
  }

  private handleSettingResponse(value: DataView): void {
    // Format: [length, settingId, valueLength, ...value]
    if (value.byteLength < 3) return;
    const settingId = value.getUint8(1);
    const valueLength = value.getUint8(2);
    if (value.byteLength < 3 + valueLength) return;

    if (settingId === SETTING_FPS && valueLength >= 1) {
      const fps = goProEnumToFps(value.getUint8(3));
      if (fps !== null) this.cachedSettings.fps = fps;
    } else if (settingId === SETTING_WB && valueLength >= 1) {
      const wb = goProEnumToWhiteBalance(value.getUint8(3));
      if (wb !== undefined) this.cachedSettings.whiteBalanceK = wb;
    }
    this.emitStateChange();
  }

  private handleQueryResponse(value: DataView): void {
    // Status-update format: [length, type, statusId, valueLength, ...value]
    // Multiple status-updates kan komme i samme packet
    if (value.byteLength < 4) return;
    let offset = 2; // skip length + type
    while (offset < value.byteLength) {
      if (offset + 2 > value.byteLength) break;
      const statusId = value.getUint8(offset);
      const valueLength = value.getUint8(offset + 1);
      offset += 2;
      if (offset + valueLength > value.byteLength) break;

      if (statusId === STATUS_BATTERY_PERCENT && valueLength >= 1) {
        this.cachedBattery = value.getUint8(offset);
      } else if (statusId === STATUS_RECORDING && valueLength >= 1) {
        this.cachedRecording = value.getUint8(offset) !== 0;
      } else if (statusId === STATUS_SD_SPACE_BYTES && valueLength >= 4) {
        const bytesLeft = value.getUint32(offset, false); // big-endian for GoPro
        this.cachedStorageFreeGb = Math.round(bytesLeft / (1024 * 1024 * 1024));
      }
      offset += valueLength;
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
          console.warn("[GoProAdapter] listener-feil:", err);
        }
      }
    });
  }
}

function isoToGoProEnum(iso: number): number | null {
  // Open GoPro ISO enum (forenklet)
  if (iso <= 100) return 0;
  if (iso <= 200) return 1;
  if (iso <= 400) return 2;
  if (iso <= 800) return 3;
  if (iso <= 1600) return 4;
  if (iso <= 3200) return 5;
  return 6; // 6400+
}
