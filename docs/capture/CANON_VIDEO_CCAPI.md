# Canon CCAPI video in CreatorHub One

Last verified: 2026-09-19

## Implemented

- Capability-gated movie recording through the camera-advertised
  `shooting/control/recbutton` POST resource.
- TV, AV and ISO are read from their advertised resources. A setting is only
  editable when the body advertises both GET and PUT, and a write is limited
  to the camera's current `ability` values. Every write is read back.
- Canon live view remains active around recording when the body supports it.
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
- A real-body smoke run was attempted against an EOS R6 Mark II. The iPad did
  not discover a CCAPI endpoint within 90 seconds, so no command was sent to
  the camera. Repeat while the R6 Mark II has CCAPI/network control enabled and
  the iPad is connected to the same camera/LAN network.

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

1. Enable CCAPI/network control on the EOS R6 Mark II and confirm its firmware.
2. Put the iPad and camera on the same reachable network (or join the camera's
   access point from the iPad), then run the opt-in smoke test.
3. Confirm live view remains available during movie recording on that firmware.
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
