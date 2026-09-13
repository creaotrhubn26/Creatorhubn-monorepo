# CreatorHub Video Room for Adobe Premiere

Native UXP review workspace for one exact CreatorHub Video Room version. The
panel combines editorial feedback and Premiere timeline navigation with native
two-way marker sync; markers are one part of the workflow, not its data model.

## Requirements

- Adobe Premiere 25.6 or newer
- UXP Developer Tool 2.2 or newer for development loading
- A CreatorHub account with editor access to the selected project

The plugin uses only APIs documented for Premiere 25.6. It deliberately does
not depend on `Marker.guid`, which was introduced in Premiere 26.3. Stable
CreatorHub IDs are stored as a small metadata tag at the end of the marker
comments instead.

## Load in development

1. Enable Developer Mode under Premiere Settings → Plugins and restart Premiere.
2. Open UXP Developer Tool.
3. Choose **Add Plugin** and select this directory's `manifest.json`.
4. Choose **Load**.
5. Open **Window → UXP Plugins → CreatorHub Video Room** in Premiere.

There is no build step and no runtime package dependency. Run the local checks
with `npm test` and `npm run check` from this directory.

## Review workspace

Version-scoped data comes from the same `project_video_*` collaboration model
as the browser Video Room. The panel supports:

- timecoded comments, replies, editing, resolution and decision comments;
- automatic assigned editor tasks for new `must-fix` feedback, task status and
  reassignment;
- click-to-seek from comments, tasks, transcript segments and QC findings;
- revision rounds and multi-approver approval steps;
- transcript/caption generation, transcript search and text navigation;
- technical QC profiles and timecoded findings;
- live review creation, shared-playhead push/follow and session close;
- direct opening of the exact selected version in the browser for playback,
  drawing, sharing, version upload and destructive administration.
- native sequence export with an editor-selected `.epr` preset and automatic
  selection between resumable Cloudflare Stream and checksum-verified private
  multipart upload in the CreatorHub S3 bucket, plus permanent
  sequence/version binding;
- optional review-round creation and multi-approver setup as part of the same
  “send to review” operation;
- crash/restart recovery using UXP persistent file tokens and the storage
  provider's authoritative TUS offset or multipart part list. The old active
  cut stays active until the new cut is fully uploaded and verified.

The collaboration API deliberately omits media URLs and share credentials. UXP
uses a bearer token from SecureStorage; cookie credentials are disabled.

## Validated Adobe surface

The production calls are limited to Adobe's documented Premiere 25.6 surface:

- [`Project.getActiveProject()`, `getActiveSequence()`, `lockedAccess()` and
  `executeTransaction()`](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/project/)
- [`Markers.getMarkers()`, `createAddMarkerAction()`,
  `createMoveMarkerAction()` and `createRemoveMarkerAction()`](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/markers/)
- [Marker name, comment, color and type actions](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/marker/)
- [`TickTime.createWithSeconds()`](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/ticktime/)
- [`Sequence.getPlayerPosition()` and `setPlayerPosition()`](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/sequence/)
- [UXP SecureStorage](https://developer.adobe.com/premiere-pro/uxp/uxp-api/reference-js/modules/uxp/key-value-storage/)
- [`EncoderManager.exportSequence()` and
  `getExportFileExtension()`](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/encodermanager/)
- [UXP persistent file tokens and local file/folder
  pickers](https://developer.adobe.com/premiere-pro/uxp/uxp-api/reference-js/modules/uxp/persistent-file-storage/file-system-provider/)
- [UXP `File.read()` on picker-authorized entries](https://developer.adobe.com/premiere-pro/uxp/uxp-api/reference-js/modules/uxp/persistent-file-storage/file/)
- [UXP descriptor-based `fs.open()` / `fs.read()`](https://developer.adobe.com/premiere-pro/uxp/uxp-api/reference-js/modules/fs/fs/),
  retained as the preferred large-file path when the host implements it

All `Action` objects are created and consumed synchronously inside nested
`lockedAccess()` / `executeTransaction()` callbacks, matching Adobe's undo and
state-consistency requirements.

Premiere 26.5 exposes the documented descriptor methods but currently returns
`Unimplemented method: open` in the real host. Version 0.3.3 therefore falls
back to the picker-authorized `File.read()` API for review proxies up to 512
MiB. Larger exports fail before being buffered and remain available locally for
browser upload; the plugin does not risk loading a camera master into Premiere's
UXP heap.

## Marker sync behavior

- Sign-in uses CreatorHub's short-lived device-code flow.
- The bearer token is stored in Adobe UXP SecureStorage, never localStorage.
- A sync is bound to the exact Premiere project and sequence GUID selected when
  it starts. Switching timelines pauses writes with a visible error.
- CreatorHub comments are represented by native sequence comment markers.
- `[MÅ FIKSES]` or a red/magenta marker creates or updates a must-fix task.
- `[FERDIG]` or a green marker resolves the linked comment/task.
- Browser-deleted CreatorHub markers are removed from Premiere. Unmanaged local
  markers are never removed automatically.
- A local deletion cannot delete client feedback; the canonical browser marker
  is restored on the next pull.
- A different unmanaged marker at the same timestamp is reported as a conflict
  and preserved.

Automatic marker sync runs every eight seconds while the plugin container
remains loaded. Collaboration state refreshes every ten seconds. Use **Synk
nå** or **Oppdater** for an immediate pass.

## Runtime smoke checklist

The latest machine-specific result and remaining blockers are recorded in
[`RUNTIME-VERIFICATION.md`](./RUNTIME-VERIFICATION.md).

1. Complete device-code login and confirm the project/version picker loads.
2. Create a comment and reply at the playhead; verify the same thread in web.
3. Create a `must-fix` comment; verify the selected editor receives a task.
4. Click a comment, task, transcript segment and QC finding; verify playhead seek.
5. Create/close a review round and create a two-person approval step.
6. Generate captions/transcript and start a QC run.
7. Start live review, push/follow playhead, then close the session.
8. Bind one version and complete both native marker directions.
9. Switch sequence and verify the plugin refuses marker writes to the wrong timeline.
10. Switch Video Room version and verify comments/tasks/transcript all change together.
11. Select a `.epr` preset and output folder, send the active sequence, and
    verify the previous cut remains active during export/upload/processing.
12. Close and reopen the panel during an upload, choose **Fortsett avbrutt
    sending**, and verify the same version resumes without duplicated bytes.
13. Verify the ready version becomes active, the exact exported sequence is
    bound, and the requested review round/approval step exists.

## Distribution

The checked-in plugin ID is suitable for internal development. Marketplace
distribution requires replacing it with the ID allocated by Adobe Developer
Distribution and packaging the plugin as a `.ccx` through UXP Developer Tool.

An internal-test package produced by UDT is available as
[`no.creatorhubn.video-room-premiere_premierepro.ccx`](./no.creatorhubn.video-room-premiere_premierepro.ccx).
See [`RUNTIME-VERIFICATION.md`](./RUNTIME-VERIFICATION.md) for the exact host
result. Repackage after every manifest/source version bump; do not distribute a
stale archive as if it contained the current source.
