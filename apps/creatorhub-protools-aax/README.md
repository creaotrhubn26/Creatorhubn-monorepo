# CreatorHub AAX Review Console adapter

This directory contains a native AAX wrapper and the vendor-neutral boundary
between its Review Console UI and CreatorHub Pro Tools Companion. It
deliberately does not vendor, imitate or redistribute Avid's licensed AAX SDK.

The Companion owns CreatorHub authentication, network access, offline cache
and PTSL. The AAX process only connects to `127.0.0.1:31417`, authenticates with
the separate local Review Console credential and sends protocol v1 messages.
The CreatorHub cloud device token never crosses this boundary.

Supported actions are `health`, `state`, `feedback`, `locate`, `mark`,
`resolve`, `reply`, `snapshot` and `send_review`. Every connection carries one
newline-delimited JSON request and receives one response before closing.

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
`aax-review-console-ipc`. It provides controls for state, feedback, locate,
mark, resolve, reply, session snapshot and review export. Mono and stereo audio
are passed through sample-for-sample; all socket work is dispatched away from
the Pro Tools audio and UI threads.

The first local connection may display a macOS Keychain access prompt. Grant
the signed CreatorHub/Pro Tools host access so later review requests do not
interrupt the session.

The unsigned bundle can be exercised only in Avid's developer host or checked
with AAX Validator. A normal Pro Tools installation requires Avid/PACE wrapping
and signing plus the corresponding iLok authorization. Those proprietary
credentials and tools must stay in the protected release environment.

The `CrHb`/`ChRC`/`ChR1`/`ChR2` type IDs in the wrapper are provisional
development IDs. Replace them with the values allocated or approved by Avid
before commercial distribution.

The host-neutral adapter remains small enough to compile on macOS and Windows
without linking the PTSL SDK inside Pro Tools. The current native Review Console
view is implemented for macOS; Windows continues to use the Companion desktop
UI until a native Win32 AAX view is added.
