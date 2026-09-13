# Premiere runtime verification

## 2026-09-13 · plugin 0.3.1

Environment:

- macOS on Apple silicon
- Adobe Premiere Pro 26.5.0
- Adobe UXP Developer Tool 2.3.0
- Premiere UXP runtime 9.3.0-local

Verified in the real host:

- UXP Developer Tool validated `manifest.json` successfully.
- The plugin loaded successfully into the running Premiere host.
- `Window -> UXP Plugins -> CreatorHub Video Room` opened the panel.
- The complete 0.3.1 send-to-review interface rendered, including preset,
  output-folder, version, review-round, approver and resume controls.
- A local three-second MP4 was imported into an isolated, unsaved Premiere
  project and used to create an active sequence. The panel remained loaded
  without manifest or host errors.
- At the minimum 300x420 panel size, the panel has a constrained 420px viewport
  and an independently scrollable document. The send controls remain reachable.
- The manifest's picker-scoped `localFileSystem: request` permission was accepted
  after a full unload/load. The native macOS file and folder pickers opened, and
  retained Adobe's `shareforreview-web720.epr` plus the isolated output folder.
- With exactly one eligible CreatorHub project, the panel explicitly selected
  that project and enabled publishing.
- `EncoderManager.exportSequence()` exported the active three-second sequence to
  `creatorhub-premiere-e2e - Premiere Runtime Smoke 2026-09-13.mp4` using the
  Adobe review preset. The stable file size was 1,991,406 bytes.
- The plugin reached the deployed production TUS-provisioning route. Cloudflare
  rejected provisioning with provider code 10011 because the configured Stream
  account has zero allocated storage minutes. No Video Room version, revision
  round, approver or notification was created.
- The failed provision kept a resumable local checkpoint and hid the stale
  progress state. Selecting `Fortsett avbrutt sending` retried provisioning while
  the exported file's modification time stayed exactly `1789300480`, proving
  that Premiere did not export the sequence again.

Automated verification for this build:

- `npm run check`: all plugin JavaScript files parse successfully.
- `npm test`: 29 plugin contract/unit tests pass.
- Focused Cloudflare Stream and Video Room regression suites: 26 tests pass.
- Backend TypeScript typecheck passes.

Not yet claimed as runtime-verified:

- Transfer of bytes to the one-time TUS URL, Stream processing and atomic Video
  Room activation.
- Creation of the optional revision round and approval step after that upload.

The first remaining path requires enabling or increasing prepaid Cloudflare
Stream storage capacity. The smoke run used the dedicated non-customer project
`CreatorHub Sound Room E2E`, with revision-round creation disabled and no
approver addresses or notifications.
