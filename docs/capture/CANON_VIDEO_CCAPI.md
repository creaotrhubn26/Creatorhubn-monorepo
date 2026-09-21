# Canon CCAPI video in CreatorHub One

Last verified: 2026-09-20

## Implemented

- Capability-gated movie recording through the camera-advertised
  `shooting/control/recbutton` POST resource.
- TV, AV, ISO, exposure compensation, white balance, colour temperature,
  AF operation/method, subject tracking, Picture Style and movie crop are read
  when the body advertises them. A setting is only
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
- Video files reported through `addedcontents` are deduplicated and imported
  automatically, including recordings started with the physical camera REC
  button. The filmstrip shows a loading card while the file is copied, then
  replaces it with the durable local take and its CreatorHub upload state.
  While copying, the card shows received/total bytes, byte percentage,
  elapsed time and estimated remaining time when the camera supplies a total.
- After the original is durably registered in the local video store, a
  non-blocking "Lagret på iPaden" confirmation appears. A separate "Sikret i
  CreatorHub" confirmation is only shown after the backend has completed and
  verified the upload. Recording can continue immediately throughout; upload
  failures remain retryable and are shown as a non-modal status.
- The Video header shows how much space CreatorHub video originals currently
  use on the iPad and the device's available capacity. The operator chooses a
  persisted policy for new takes: iPad only with no upload, both iPad and
  CreatorHub, or CreatorHub-only after a verified upload. That policy is
  stored per take. Local-only takes are not counted as pending uploads.
  Deletion is rejected before `ready` and for every path outside the
  app-managed recordings directory.
- Cloud-only takes remain playable. The asset endpoint prefers private
  Cloudflare Stream playback when ready and otherwise returns a short-lived,
  project-authorized URL to the verified CreatorHub S3 original.

## Verification

- All `CaptureAppTests` pass on the iPad simulator.
- `testCanonVideoDemoRecordAndImport` passes on the simulator. It covers
  discovery, live view, settings, REC start/stop, new-content polling, local
  movie import and the visible filmstrip take.
- `testCanonVideoRecordedOnCameraAppearsInFilmstrip` passes on the simulator.
  It simulates a recording made using the camera's physical REC button and
  verifies that the resulting take appears without starting REC in the app.
- Storage-policy persistence and guarded local-original release tests pass;
  the guarded release test covers pre-verification refusal, path containment
  and post-verification removal.
- The video-capture route test verifies the signed CreatorHub-original
  playback fallback when Stream is not ready.
- `testAdaptiveLandscapeWorkspaces` passes after the Canon controls were added.
- A real EOS R6 Mark II on firmware 1.6.0 was reached over its HTTPS CCAPI
  origin. Inventory, device identity and battery reads returned HTTP 200. A
  bounded Live View start returned HTTP 200, `flip` returned a valid 512×288
  JPEG after the startup lifecycle was corrected, and the documented POST-off
  cleanup returned HTTP 200. No recording or media mutation was performed, so
  automatic physical-camera video import still needs the hardware smoke test.

## Monitor and camera-control capability boundaries

CreatorHub separates local monitor processing from camera-native control. This
keeps the UI useful across Canon, UVC and Bridge sources without pretending a
camera offers an API it does not have.

| Function | R6 Mark II / CCAPI | CreatorHub implementation |
| --- | --- | --- |
| Vertical monitoring | No dedicated camera command required | Local rotation/fitting on iPad |
| Markers and safe areas | Not required from camera | Local overlay |
| Vectorscope | No vectorscope data endpoint | Local analysis of Live View frames |
| Reference image overlay | No camera endpoint | Local PhotosPicker overlay with opacity |
| Snapshots and automatic snapshots | Live View JPEG is available | Project-scoped JPEG plus JSON metadata in protected app storage |
| Auto reconnect | Transport concern | Exponential reconnect up to 30 seconds, retaining the selected camera |
| Live View off | POST-only body supports `liveviewsize: off` | Control-only mode keeps settings/REC available |
| Focus drive and AF | Advertised on the verified R6 inventory | Capability-gated relative focus bar and AF pulse |
| Touch AF | AF-frame endpoint exists | `flipdetail` geometry maps taps to the camera's full-image coordinate space before writing the AF frame |
| Focus Map / depth map | No depth-map endpoint on the R6 | Not labelled or simulated as Focus Map |
| C-Log 2/3 LUT preview | No LUT-upload endpoint on the R6 | Planned local `.cube` preview; no camera-write claim |
| ND filter | No R6 ND endpoint | Hidden. Future Cinema EOS adapter must advertise it explicitly |
| Composition presets | R6 advertises only movie-crop enable/disable | App-local framing presets are planned; no camera-native preset claim |
| OK / NG / KEEP | No verified camera clip-flag endpoint | Existing Take Board maps this workflow to Good / No Good / Hold in CreatorHub |

## Firmware updates

CreatorHub does **not** install camera firmware. The verified R6 Mark II
inventory has no public CCAPI firmware-update endpoint, and the app must not
download or sideload camera firmware outside Canon's signed workflow. It can
read the installed firmware version, report that a newer Canon release exists,
and open Canon's official instructions. Firmware 1.6.0 added the camera's own
internet-connected firmware-update flow; firmware 1.7.0 adds/updates CCAPI
support according to Canon's release notice.

- Canon EOS R6 Mark II firmware 1.7.0 notice:
  <https://www.usa.canon.com/support/canon-product-advisories/Firmware-Notice-EOS-R6-Mark-II-Firmware-Version-1-7-0>
- Canon CCAPI operation guide:
  <https://downloads.canon.com/sdk/CameraControlAPI_OperationGuide_EN.pdf>

The EOS C80 is a separate adapter target: Canon documents remote control,
including its mechanical 2/4/6/8/10-stop ND filter, through the IP-based
**XC Protocol** rather than assuming the R6 CCAPI contract. CreatorHub must
therefore expose ND, Custom Picture and Cinema EOS controls only after an XC
Protocol capability handshake.

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
