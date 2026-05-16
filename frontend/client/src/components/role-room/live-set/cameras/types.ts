/**
 * cameras/types.ts
 *
 * Felles types for cross-vendor kamera-integrasjon. Hver adapter
 * implementerer CameraAdapter-interface; UI-laget snakker bare mot
 * dette grensesnittet og bryr seg ikke om protokollen under.
 *
 * Arkitekturreferanse:
 *   ../../components/camera-integration-strategy.md
 */

export type CameraVendor =
  | "canon"
  | "blackmagic"
  | "sony"
  | "arri"
  | "red"
  | "zcam"
  | "gopro"
  | "dji"
  | "mock";

export type CameraTransport =
  | "ccapi-https"      // Canon CCAPI over HTTPS
  | "ble"              // Bluetooth LE (Blackmagic, GoPro)
  | "sony-wifi"        // Sony Wi-Fi Remote
  | "arri-web"         // ARRI Web Remote
  | "zcam-http"        // Z CAM HTTP
  | "red-sdk"          // RED Cinema RCP via native SDK
  | "ipad-bridge"      // Via iPad CaptureApp WebSocket
  | "sdi-embed";       // SDI command embed (Blackmagic switcher pattern)

export type FocusMode = "auto" | "manual";

/**
 * Normalisert kamera-settings — alle vendors mapper sine konsepter til
 * dette skjemaet. Vendor-spesifikke felt går i `vendorExtra`.
 */
export interface NormalizedCameraSettings {
  fps?: number;
  shutterAngle?: number;
  shutterSpeed?: string;      // f.eks. "1/48", "1/50"
  iris?: string;              // f-stop: "f/2.8"
  iso?: number;
  whiteBalanceK?: number;
  focusMode?: FocusMode;
  /** 0..1 manuell focus-posisjon (vendor-spesifikk skala normalisert) */
  focusPosition?: number;
  stabilization?: boolean;
  lensFocalLength?: string;
  aspectRatio?: string;
  codec?: string;
  resolution?: string;
}

/**
 * Snapshot av kameraets state. Brukes til list-views, status-indikatorer,
 * etc. Skiller seg fra settings ved at den også inkluderer runtime-state
 * (battery, recording, online).
 */
export interface CameraStateSnapshot {
  /** Identifikasjon */
  vendor: CameraVendor;
  id: string;                 // Vendor-specific: IP, BLE-address, USB-serial
  label: string;              // Menneskeleselig: "Cam A — Canon R6"
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;

  /** Runtime */
  online: boolean;
  recording: boolean;
  /** 0..100 — alle vendors normalisert hit */
  batteryPercent?: number;
  storageFreeGb?: number;
  storageTotalGb?: number;
  temperatureStatus?: "normal" | "warning" | "critical";

  /** Settings — kan være partielle hvis kameraet ikke eksponerer alt */
  settings: NormalizedCameraSettings;

  /** Tidspunkt for state-fetch */
  fetchedAt: string;

  /** Vendor-spesifikke felt som UI kan vise i debug-modus */
  vendorExtra?: Record<string, unknown>;
}

export interface CameraSubscription {
  /** Stopp subscription */
  unsubscribe(): void;
}

/**
 * Abstrakt grensesnitt som alle kamera-protokoller implementerer.
 * UI-laget bruker bare denne typen — adapter-spesifikke detaljer er
 * skjult.
 */
export interface CameraAdapter {
  readonly vendor: CameraVendor;
  readonly id: string;
  readonly transport: CameraTransport;

  /** Forsøk å koble til. Kaster på feil. */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  /** Hent nåværende state-snapshot */
  fetchState(): Promise<CameraStateSnapshot>;

  /**
   * Subscribe på state-endringer. Returner null hvis adapter ikke støtter
   * push-based updates — UI faller tilbake til poll.
   */
  subscribeStateChanges?(
    callback: (snapshot: CameraStateSnapshot) => void,
  ): CameraSubscription;

  /** Endre settings. Vendor implementerer sin egen mapping. */
  applySettings(settings: Partial<NormalizedCameraSettings>): Promise<void>;

  /** Start opptak (video). Adapter kan kaste hvis ikke støttet. */
  startRecording(): Promise<void>;
  /** Stopp opptak. */
  stopRecording(): Promise<void>;

  /** Trigger shutter (still-foto). Adapter kan kaste hvis ikke støttet. */
  triggerShutter?(): Promise<void>;

  /**
   * Hvor lenge polling-intervallet bør være i ms hvis subscribe ikke er
   * tilgjengelig. Vendor velger basert på protokoll-cost.
   */
  recommendedPollIntervalMs: number;
}

/**
 * Vendor-spesifikk pairing-info. UI sender dette til riktig factory.
 */
export type CameraPairingInfo =
  | {
      vendor: "canon";
      transport: "ccapi-https";
      ipAddress: string;
      port?: number;
    }
  | {
      vendor: "blackmagic";
      transport: "ble";
      /** Bluetooth-device-id (browser-spesifikk) */
      bluetoothDeviceId: string;
    }
  | {
      vendor: "sony";
      transport: "sony-wifi";
      ipAddress: string;
      port?: number;
    }
  | {
      vendor: "arri";
      transport: "arri-web";
      ipAddress: string;
      port?: number;
    }
  | {
      vendor: "zcam";
      transport: "zcam-http";
      ipAddress: string;
      port?: number;
    };

/**
 * Discovery-resultat før paring. UI viser disse som "tilgjengelige
 * kameraer" i pairing-dialog.
 */
export interface DiscoveredCamera {
  vendor: CameraVendor;
  transport: CameraTransport;
  id: string;
  label: string;
  model?: string;
  ipAddress?: string;
  signalStrength?: number;
}
