/**
 * live-set/types.ts
 *
 * Shared typer for LIVE SET PRO-layouten. Hardware-avhengig data
 * (kamera-feeds, audio-levels, scopes) representeres her som mock-typer
 * som senere kan kobles mot ekte SDK-er (Blackmagic, NDI, Decklink, etc.)
 * uten å endre UI-laget.
 *
 * Kamera-typene speiler Canon CCAPI-konvensjonen siden vi allerede har
 * working integrasjon i iPad CaptureApp (CCAPIClient.swift). Produksjon-
 * koblingen kommer enten via:
 *   (a) Node-backend-proxy /api/ccapi/* som speiler iPad's CCAPIClient,
 *       eller
 *   (b) WebSocket-bridge til iPad CaptureApp som er på set + på kameraets
 *       AP samtidig.
 * Selve protokollen: GET /ccapi for capability-inventory, GET
 * /ccapi/ver100/deviceinformation for identity, POST
 * /ccapi/ver100/shooting/control/shutterbutton/manual for shutter,
 * GET /ccapi/ver110/event/polling for state-diff.
 *
 * Arkitekturreferanse:
 *   livesetmode.md §16 (UI-spesifikasjon)
 *   ipad/CaptureApp/CaptureApp/Core/Capture/CCAPIClient.swift (working impl)
 *   frontend/shared/ccapi-schema.ts (DB-rad-shape)
 */

export type LiveSetMode = 'live' | 'edit' | 'review';

export type SyncStatus = 'fully-synced' | 'partial-sync' | 'offline';

// Camera ID konvensjon: A, B, C, D (kan utvides for multi-cam)
export type CameraId = 'A' | 'B' | 'C' | 'D';

export interface CameraSlot {
  id: CameraId;
  /** Display-navn i UI ('Cam A', 'Cam A*' for master, etc.) */
  label: string;
  /** Indikerer hvis denne kameraet er master for sync */
  isMaster?: boolean;
  /** Online-status — kommer fra hardware-integrasjon */
  online: boolean;
  /** Live thumbnail/preview-URL (kan være data: blob fra NDI-stream) */
  previewUrl?: string;
  /** Audio level i dB — siste 100ms */
  audioLevelDb?: number;
  /** Canon CCAPI-felter når kameraet er paret via /ccapi-proxy */
  ccapi?: {
    /** Model fra /ccapi/ver100/deviceinformation */
    model?: string;
    serialNumber?: string;
    firmwareVersion?: string;
    /** IP på kameraets eget AP (typisk 192.168.1.2) */
    ipAddress?: string;
    /** API-versjoner kameraet eksponerer ('ver100', 'ver110', 'ver120') */
    supportedVersions?: string[];
    /** Battery 0-100 fra /devicestatus/battery */
    batteryLevel?: number;
    /** Antall gjenstående exposures basert på card-storage */
    remainingShots?: number;
    /** Free storage ('32 GB') */
    storageAvailable?: string;
    /** Sist sett (ISO) */
    lastSeenAt?: string;
  };
}

export interface CameraSettings {
  /** Frames per second */
  fps: number;
  /** Shutter — kan være vinkel (180°) eller speed (1/48) */
  shutterAngle?: number;
  shutterSpeed?: string;
  /** Iris/aperture */
  iris: string;
  /** ISO */
  iso: number;
  /** White balance i Kelvin */
  whiteBalanceK: number;
  /** Focus mode */
  focus: 'auto' | 'manual';
  /** Stabilization */
  stabilization: boolean;
  /** Lens — for metadata */
  lensFocalLength?: string;
  /** Aspect ratio */
  aspectRatio?: string;
  /** Codec */
  codec?: string;
  /** Resolution */
  resolution?: string;
}

export interface CameraPreset {
  id: string;
  name: string;
  settings: Partial<CameraSettings>;
}

export type TakeStatus = 'klar-for-roll' | 'roller' | 'godkjent' | 'pickup' | 'arkivert';

// LIVE-state — det som skjer i sanntid på set
export interface LiveSetState {
  /** Hvilken mode er aktiv */
  mode: LiveSetMode;
  /** Hvilken kamera er PROGRAM-feed (selected) */
  programCameraId: CameraId;
  /** Hvilken kamera er aktiv for settings-editing */
  activeCameraId: CameraId;
  /** Er vi midt i en take? */
  isRecording: boolean;
  /** Recording started timestamp (sec since epoch) */
  recordingStartedAt?: number;
  /** Sync-status på tvers av devices */
  syncStatus: SyncStatus;
  /** Hvor mange crew er innlogget akkurat nå */
  crewCount: number;
  /** Hvor stort er totalbufferet (visuell sjekk for sync-drift) */
  bufferDriftMs?: number;
}

export interface QuickActionResult {
  action: 'good-take' | 'pickup-shot' | 'action-safe' | 'check-focus' | 'setup-complete';
  /** Hvilken take ble berørt (om relevant) */
  takeId?: string;
}
