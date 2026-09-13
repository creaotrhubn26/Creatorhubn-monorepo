# Premiere runtime verification

## 2026-09-13 · plugin 0.3.4

Environment:

- macOS
- Adobe Premiere Pro 26.5.0
- Adobe UXP Developer Tool 2.3.0
- Premiere UXP runtime 9.3.0-local
- deployed CreatorHub production backend at merge commit
  `5e375739ee4d7415543f969d9bea878afc657489`

Verified in the real host:

- UXP Developer Tool validated `manifest.json`, and the plugin loaded into the
  running Premiere host.
- `Window -> UXP Plugins -> CreatorHub Video Room` opened the panel and the
  complete send-to-review interface rendered.
- The native preset and output-folder pickers retained the selected `.epr` and
  picker-authorized output directory.
- An isolated, unsaved Premiere project with an active nine-second sequence was
  exported with the YouTube HD 720p 25 preset.
- The exported MP4 was read through the UXP File Entry API and uploaded through
  CreatorHub's resumable object-upload flow. No unsupported `fs.open()` call was
  required.
- The production backend provisioned a private multipart upload in
  `creatorhubn-prod-745600963362-eu-north-1`. The UXP client sent the required
  `x-amz-checksum-sha256` and `x-amz-sdk-checksum-algorithm: SHA256` headers,
  both of which were included in the AWS Signature V4 signed headers.
- The upload completed, the Video Room version became `V7 / under_review`, and
  the active Premiere sequence was bound and synchronized to that version.
- The stored CreatorHub object is 6,349,640 bytes. Its
  `creatorhub-sha256` metadata is
  `ef30d0bb3c703750474160a03c66ac8cabf7912b93c9f74766e7f98542d9596e`,
  exactly matching the local exported MP4.
- The corresponding Video Room prefix in
  `the-role-room-prod-745600963362-eu-north-1` contains no object. The upload is
  therefore physically isolated from The Role Room storage.
- Six incomplete versions produced while diagnosing the original 403 response
  were deleted through the CreatorHub version API. This removed their database
  records, released their storage reservations and aborted their multipart
  uploads. The project now contains only V7, and the CreatorHub prefix has no
  pending multipart upload.

Root cause confirmed in the real UXP network path:

- AWS rejected the original `UploadPart` request because the UXP runtime added
  `x-amz-sdk-checksum-algorithm`, while that header was absent from the
  presigned URL's `SignedHeaders`.
- Plugin 0.3.4 signs both checksum headers and limits the extra algorithm header
  to the exact value `SHA256`.

Automated and deployment verification:

- `npm run check`: all plugin JavaScript files parse successfully.
- `npm test`: 40 plugin contract/unit tests pass.
- 16 focused backend object-storage, checksum and Video Room route tests pass.
- The complete backend TypeScript `tsc --noEmit` check passes.
- All nine pull-request checks for the checksum-header fix pass.
- Production workflow run `34776506632` completed successfully, including
  migrations, the exact backend commit, smoke checks and frontend deployment.

Packaged artifact:

- UXP Developer Tool 2.3.0 successfully packaged plugin 0.3.4 as
  `no.creatorhubn.video-room-premiere_premierepro.ccx`.
- The package manifest targets Premiere Pro 25.6 or newer and contains the
  expected CreatorHub, AWS S3 and optional Stream network permissions.
- Creative Cloud Desktop accepted the `.ccx` as a non-Marketplace plugin and
  installed version 0.3.4 under Adobe UXP's external-plugin directory.
- The installed `index.js` and `publish-core.js` hashes exactly match the files
  inside the packaged `.ccx`.
- With UXP Developer Tool not running, Premiere exposed
  `Window -> UXP Plugins -> CreatorHub Video Room`, and the installed panel
  rendered successfully.
- The installed package completed CreatorHub device login, loaded the dedicated
  test project and displayed `V7 / under_review`. This package-install smoke did
  not initiate a second export or upload.

Not claimed by this targeted send-to-review run:

- A repeat of every collaboration smoke item in the broader checklist, such as
  comments, editor tasks, formal multi-approver notifications, live review,
  transcript/QC navigation and both marker-sync directions.
- Adaptive HLS processing through Cloudflare Stream. Stream remains optional;
  this successful review version used CreatorHub's private S3 object path.

The smoke run used the dedicated non-customer project
`CreatorHub Sound Room E2E`. No customer project or The Role Room object was
modified.
