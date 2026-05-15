/**
 * useLiveSetHardware.ts
 *
 * Hook som returnerer hardware-state for LIVE SET PRO. Akkurat nå er
 * dette MOCK-data — implementasjonen byttes ut med ekte integrasjoner
 * uten at UI-laget endres.
 *
 * Canon-cameras (kjent working pattern fra iPad CaptureApp):
 *   1. GET /api/ccapi/discover → liste over kameraer på WiFi
 *   2. POST /api/ccapi/cameras/:ip/connect → opprett session
 *   3. GET /api/ccapi/cameras/:ip/state → poll for cam-settings + status
 *   4. POST /api/ccapi/cameras/:ip/shutter → fire shutter
 *   Backend-proxyen må trust kameraets self-signed cert (browser kan ikke)
 *   ELLER bruke iPad CaptureApp som WebSocket-bridge.
 *
 * Andre kameraer (ARRI/RED/Sony/Blackmagic): respektive SDK-er — alle
 * trenger node-side-proxy uansett (samme grunn: self-signed certs +
 * lokalt nettverk).
 *
 * Audio: Sound Devices Network Manager-protokoll for MixPre/Scorpio
 * (Dante/AES67), eller NDI-mottak fra trådløse Vaxis/Hollyland-sendere.
 *
 * Sync-status og crewCount kan plukkes opp fra eksisterende
 * collaboration-substrat (websocket eller GA4-live-events).
 */

import { useEffect, useState } from 'react';
import type { CameraId, CameraSlot, SyncStatus } from './types';

interface LiveSetHardwareState {
  cameras: CameraSlot[];
  masterAudioDb: number;
  syncStatus: SyncStatus;
  crewCount: number;
  bufferDriftMs: number;
}

const DEFAULT_CAMERAS: CameraSlot[] = [
  { id: 'A', label: 'Cam A', isMaster: false, online: true, audioLevelDb: -12 },
  { id: 'B', label: 'Cam B*', isMaster: true, online: true, audioLevelDb: -10 },
  { id: 'C', label: 'Cam C', isMaster: false, online: true, audioLevelDb: -8 },
  { id: 'D', label: 'Cam D*', isMaster: true, online: true, audioLevelDb: -14 },
];

/**
 * Mock-implementasjon. Genererer varierte audio-levels hvert 100ms så
 * VU-meterene i UI ser "live" ut. Ekte implementasjon henter dette fra
 * mixer-stream.
 */
export function useLiveSetHardware(): LiveSetHardwareState {
  const [cameras, setCameras] = useState<CameraSlot[]>(DEFAULT_CAMERAS);
  const [masterAudioDb, setMasterAudioDb] = useState(-6);

  useEffect(() => {
    // Mock: jiggle audio levels for liveness-feeling
    const timer = setInterval(() => {
      setCameras((current) =>
        current.map((cam) => ({
          ...cam,
          audioLevelDb: (cam.audioLevelDb ?? -12) + (Math.random() - 0.5) * 2,
        })),
      );
      setMasterAudioDb(-6 + (Math.random() - 0.5) * 4);
    }, 200);

    return () => clearInterval(timer);
  }, []);

  return {
    cameras,
    masterAudioDb,
    syncStatus: 'fully-synced',
    crewCount: 8,
    bufferDriftMs: 0,
  };
}
