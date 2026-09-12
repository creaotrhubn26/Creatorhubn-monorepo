/**
 * mockup-video — pakk en video inn i en device-mockup og eksporter som video.
 *
 * Bygd kun på nettleser-native API-er (Canvas 2D + MediaRecorder +
 * captureStream) — ingen nye avhengigheter. Gjenbruker geometrien fra
 * landingssidens DeviceMockup.tsx, men uttrykt som rene tall slik at den
 * kan tegnes på <canvas> for video-eksport.
 *
 * Offentlig API:
 *   - <MockupVideoStudio/>        demo/POC-flate
 *   - useMockupVideoExporter()    hook: video → mockup → ny video
 *   - renderMockupFrame(...)      tegn én komposittert frame (preview/eksport)
 *   - getDeviceGeometry(...)      skjerm-geometri per enhet
 *   - fitRect(...)                object-fit-matematikk (auto-justering)
 */

export { default as MockupVideoStudio } from './MockupVideoStudio';
export { useMockupVideoExporter } from './useMockupVideoExporter';
export type { MockupExportOptions, MockupExporterController, ExporterState } from './useMockupVideoExporter';
export { exportMockupVideo, isMockupExportSupported, pickMockupMimeType } from './exportMockupVideo';
export type { ExportMockupVideoOptions, ExportMockupVideoResult } from './exportMockupVideo';
export { renderMockupFrame } from './renderMockupFrame';
export type { MockupRenderOptions, MockupBackground, DrawableSource } from './renderMockupFrame';
export { getDeviceGeometry, deviceAspectRatio } from './deviceGeometry';
export type { DeviceVariant, DeviceGeometry, RoundedRect, DeviceOverlay } from './deviceGeometry';
export { fitRect, centerWithin, scaleToFit } from './fitRect';
export type { FitMode, Rect, Size } from './fitRect';
export {
  DEFAULT_MOCKUP_CONFIG,
  BACKGROUND_PRESETS,
  toRenderOptions,
} from './mockupConfig';
export type {
  MockupConfig,
  MockupVisualConfig,
  MockupAudioConfig,
  MockupMusicConfig,
  MockupExportConfig,
} from './mockupConfig';
