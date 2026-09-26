# CreatorHub AAX Review Console adapter

This directory contains a native AAX wrapper and the vendor-neutral boundary
between its Review Console UI and CreatorHub Pro Tools Companion. It
deliberately does not vendor, imitate or redistribute Avid's licensed AAX SDK.

The Companion owns CreatorHub authentication, network access, offline cache
and PTSL. The AAX process only connects to `127.0.0.1:31417`, authenticates with
the separate local Review Console credential and sends protocol v1 messages.
The CreatorHub cloud device token never crosses this boundary.

On macOS the Review Console automatically wakes the installed Companion in
background mode if the loopback listener is unavailable. It waits up to six
seconds for the authenticated listener and otherwise fails closed with a clear
diagnostic. The Tauri window is therefore optional during normal Pro Tools use;
it remains available from the menu bar for pairing, settings and diagnostics.
Before launch, the plug-in verifies that the discovered app has bundle ID
`com.creatorhub.protools-companion` and a valid Apple signature from Creatorhub
AS team `9TAUZCPK95`; an unsigned or look-alike app is rejected.

Supported actions are `health`, `state`, `feedback`, `locate`, `mark`,
`resolve`, `reply`, `snapshot`, `snapshots`, `recall_preview`, `recall`,
`sources`, `send_review`, `delivery`, `delivery_jobs`, `import_reference`,
`prepare_compare`, `intro_copy` and `diagnostics`. Every connection carries one
newline-delimited JSON request and receives one response before closing.

## Producer cockpit UX

The macOS AAX view follows the CreatorHub Workspace dark/orange design and is
organized by the producer's goal rather than by technical subsystems:

- **Tilbakemeldinger** lists Sound Room comments as selectable cards; locate,
  marker, reply and resolve actions never require a pasted id or time value.
  The same overview shows EaseVerse tempo, key, genre, song structure and the
  current creative brief, so musical context stays visible while mixing.
- **Send miks** chooses an explicit Pro Tools output, shows transfer/QC status
  and prevents an accidental duplicate version.
- **Versjoner** imports one or two session-owned versions as reference tracks
  and previews Snapshot Recall before a recovery-protected change.
- **Leveranse** requires an explicit bus/output for every requested master,
  instrumental, acapella, clean or TV file.
- **Hjelp** translates diagnostics into one next step and hides raw JSON until
  the user asks for technical details.

Controls use plain Norwegian, forgiving 44-point targets, native keyboard/focus
behavior and accessible labels. Live peak/RMS/correlation is calculated with
bounded lock-free writes on the audio callback; the signal remains
sample-for-sample unchanged. Delivery LUFS and true peak always come from the
offline WAV QC pass, not from the lightweight live indicator.

## Build the AAX bundle

Accept Avid's AAX SDK license and extract the SDK outside the repository. Then
build with its absolute path:

```bash
cmake -S apps/creatorhub-protools-aax \
  -B build/creatorhub-protools-aax \
  -DCMAKE_BUILD_TYPE=Release \
  -DCREATORHUB_BUILD_AAX_PLUGIN=ON \
  -DCREATORHUB_AAX_SDK_ROOT=/absolute/path/to/aax-sdk
cmake --build build/creatorhub-protools-aax --config Release
ctest --test-dir build/creatorhub-protools-aax --output-on-failure
```

The resulting `CreatorHub Review Console.aaxplugin` contains only CreatorHub's
wrapper plus the AAX objects linked from the locally licensed SDK. The SDK is
never copied into source control.

On macOS, the plug-in reads the separate local credential from Keychain using
service `com.creatorhub.protools-companion` and account
`aax-review-console-ipc`. It provides the complete review, publishing,
version/reference, safe recall, delivery, Intro-copy and diagnostics cockpit
described above. Mono and stereo audio are passed through sample-for-sample;
all socket work is dispatched away from the Pro Tools audio and UI threads.

The first local connection may display a macOS Keychain access prompt. Grant
the signed CreatorHub/Pro Tools host access so later review requests do not
interrupt the session.

The unsigned bundle can be exercised only in Avid's developer host or checked
with AAX Validator. A normal Pro Tools installation requires Avid/PACE wrapping
and signing plus the corresponding iLok authorization. Those proprietary
credentials and tools must stay in the protected release environment.

The default `CrHb`/`ChRC`/`ChR1`/`ChR2` type IDs are provisional development
IDs. A production build must provide the values registered or approved by Avid
and explicitly mark that approval at configure time:

```bash
cmake -S apps/creatorhub-protools-aax \
  -B build/creatorhub-protools-aax-release \
  -DCMAKE_BUILD_TYPE=Release \
  -DCREATORHUB_BUILD_AAX_PLUGIN=ON \
  -DCREATORHUB_AAX_SDK_ROOT=/absolute/path/to/aax-sdk \
  -DCREATORHUB_AAX_MANUFACTURER_ID=ABCD \
  -DCREATORHUB_AAX_PRODUCT_ID=EFGH \
  -DCREATORHUB_AAX_MONO_NATIVE_ID=IJKL \
  -DCREATORHUB_AAX_STEREO_NATIVE_ID=MNOP \
  -DCREATORHUB_AAX_IDS_AVID_APPROVED=ON \
  -DCREATORHUB_AAX_AVID_APPROVAL_REFERENCE=AVID-CASE-ID
```

The build embeds those values in both the binary and a signed release-identity
manifest. The PACE release script refuses to wrap a bundle whose manifest is
missing or whose IDs are still marked as development-only. Do not set the
approval flag until Avid has confirmed the IDs in writing.

The identity gate can be checked independently of PACE/iLok readiness:

```bash
scripts/release-protools-aax-macos.sh identity \
  "/absolute/path/CreatorHub Review Console.aaxplugin"
```

CI also verifies the development, approved and invalid identity configurations
with `scripts/test-protools-aax-release-identity.sh`.

## Release readiness and PACE signing

Run the read-only preflight before attempting a commercial macOS release:

```bash
scripts/release-protools-aax-macos.sh check \
  "/absolute/path/CreatorHub Review Console.aaxplugin"
```

It fails closed unless the universal bundle, physical iLok, PACE License
Support service, wrapper cache, Apple signature and PACE tooling license are
all available. It never accepts an iLok password on the command line.

After Avid has approved the permanent type IDs and PACE has deposited the
`PACE Licensing` tool license, create a new output bundle with values supplied
through the release environment:

```bash
PACE_ACCOUNT_ID="your-ilok-account" \
PACE_WRAP_CONFIG_GUID="your-approved-wrap-config-guid" \
APPLE_SIGNING_IDENTITY="Developer ID Application: Your Company (TEAMID)" \
scripts/release-protools-aax-macos.sh wrap \
  "/absolute/path/CreatorHub Review Console.aaxplugin" \
  "/absolute/output/CreatorHub Review Console.aaxplugin"
```

The command stages a copy, refuses to overwrite an existing output, asks PACE
to wrap and sign it, and then requires both PACE verification and strict Apple
code-signature verification. Run AAX Validator against that exact output before
publishing it.

The host-neutral adapter remains small enough to compile on macOS and Windows
without linking the PTSL SDK inside Pro Tools. The current native Review Console
view is implemented for macOS; Windows continues to use the Companion desktop
UI until a native Win32 AAX view is added.
