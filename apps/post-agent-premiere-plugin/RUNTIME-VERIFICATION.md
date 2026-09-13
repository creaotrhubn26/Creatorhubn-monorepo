# Premiere runtime verification

## 2026-09-13 · plugin 0.3.0

Environment:

- macOS on Apple silicon
- Adobe Premiere Pro 26.5.0
- Adobe UXP Developer Tool 2.3.0
- Premiere UXP runtime 9.3.0-local

Verified in the real host:

- UXP Developer Tool validated `manifest.json` successfully.
- The plugin loaded successfully into the running Premiere host.
- `Window -> UXP Plugins -> CreatorHub Video Room` opened the panel.
- The complete 0.3.0 send-to-review interface rendered, including preset,
  output-folder, version, review-round, approver and resume controls.
- A local three-second MP4 was imported into an isolated, unsaved Premiere
  project and used to create an active sequence. The panel remained loaded
  without manifest or host errors.
- UXP Developer Tool packaged the current source as
  `no.creatorhubn.video-room-premiere_premierepro.ccx`; the archive contains
  `publish-core.js`, `tus-upload.js` and manifest version 0.3.0.

Automated verification for this build:

- `npm run check`: all plugin JavaScript files parse successfully.
- `npm test`: 24 plugin contract/unit tests pass.
- Backend focused and adjacent regression suites: 36 tests pass.
- Backend TypeScript typecheck passes.

Not yet claimed as runtime-verified:

- `EncoderManager.exportSequence()` with a chosen production `.epr` preset.
- A real direct TUS upload, interrupted-upload resume, Stream processing and
  atomic Video Room activation.
- Creation of the optional revision round and approval step after that upload.

Those final steps require the matching backend changes to be deployed and a
dedicated non-customer CreatorHub test project to appear in the plugin picker.
The smoke run intentionally did not publish the synthetic test clip into an
unidentified production project.
