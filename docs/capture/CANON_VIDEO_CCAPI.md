# Canon CCAPI video in CreatorHub One

Last verified: 2026-09-19

## Implemented

- Capability-gated movie recording through the camera-advertised
  `shooting/control/recbutton` POST resource.
- TV, AV and ISO are read from their advertised resources. A setting is only
  editable when the body advertises both GET and PUT, and a write is limited
  to the camera's current `ability` values. Every write is read back.
- Camera battery is sampled from CCAPI events, shown in the monitor and camera
  controls, and highlighted below 20 percent (including named `low`/`empty`
  values). Telemetry polling pauses during REC/import so it cannot consume the
  new-movie event before the importer sees it.
- The source refresh action now restarts Canon discovery as well as iPad/UVC
  discovery. The UI exposes search state, denied local-network permission and
  a Settings deep-link instead of silently showing an empty list.
- Discovery probes HTTP/HTTPS on the common 80, 443, 8080 and 8443 ports. For
  custom ports, the operator can enter the exact URL displayed on the camera's
  CCAPI communication screen; `/ccapi` is normalized to the base origin.
- Canon live view polls only the advertised `flip` JPEG endpoint. Streaming
  `scroll`/`multipart` endpoints are not accidentally consumed as finite
  responses, and POST-only bodies are stopped with Canon's documented
  `liveviewsize: off` payload.
- Stopping a recording waits for a newly-added movie (`MP4`, `MOV`, `MXF` or
  `CRM`), downloads it with URLSession's file-backed download API, inspects its
  media metadata and registers it in the existing offline-first Video Take
  Board/upload flow.
- Absolute camera media URLs are accepted only from the connected camera's
  origin. Imported files use protected local storage and are excluded from
  iCloud backup.
- DEBUG mode provides a complete fake Canon body so the same UI workflow can
  run on Simulator or a physical iPad without camera hardware.

## Verification

- All `CaptureAppTests` pass on the iPad simulator.
- `testCanonVideoDemoRecordAndImport` passes both on the simulator and on the
  connected iPad Pro 13-inch (M5). It covers discovery, live view, settings,
  REC start/stop, new-content polling and local movie import.
- `testAdaptiveLandscapeWorkspaces` passes after the Canon controls were added.
- A signed device build installs and launches on the connected iPad.
- A real EOS R6 Mark II on firmware 1.6.0 was reached over its HTTPS CCAPI
  origin. Inventory, device identity and battery reads returned HTTP 200. A
  bounded Live View start returned HTTP 200, `flip` returned a valid 512×288
  JPEG after the startup lifecycle was corrected, and the documented POST-off
  cleanup returned HTTP 200. No recording or media mutation was performed.

The real-body test is `ScreenshotHarness.testRealCanonR6HardwareSmoke`. It is
opt-in and skips unless the UI-test runner has `RUN_REAL_CANON_SMOKE=1` in its
Xcode scheme environment. It records a two-second clip, imports it, and uses a
DEBUG-only local project so it cannot pollute a real CreatorHub project.

## Production data path

The imported original enters `VideoCaptureStore` and `VideoCaptureUploader`,
the same CreatorHub AWS S3 path used by iPad/UVC takes. Canon media is never
routed through The Role Room storage. Cloudflare Stream remains an optional
playback proxy after the S3 original has been secured.

## Remaining hardware validation

1. Install with an Xcode/device-support version compatible with the connected
   iPad's iPadOS 27.0. Xcode 26.5 built the app, but device installation failed
   before launch with Apple profile error `0xe800801f`.
2. Run the opt-in physical-iPad smoke test against the now-confirmed endpoint.
3. Confirm Live View remains available during movie recording on firmware 1.6.0.
4. Confirm `addedcontents` timing and imported metadata for MP4 and any enabled
   high-quality/raw movie format.
5. Run a longer clip to validate transfer progress, background interruption,
   low-storage handling and reconnect/resume behavior. The current direct
   camera download is file-backed but not resumable across process death.

## Authoritative external references

- Canon Developer Resources SDK list:
  <https://asia.canon/en/campaign/developerresources/sdk>
- Canon Camera Control API release notes:
  <https://asia.canon/en/campaign/developerresources/camera/cap/camera-control-api-release-note>

Do not commit Canon Developer Program packages or full reference manuals.
