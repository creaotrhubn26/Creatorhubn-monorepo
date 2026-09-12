# CreatorHub AAX Review Console adapter

This directory contains the vendor-neutral boundary between an AAX UI and
CreatorHub Pro Tools Companion. It deliberately does not vendor, imitate or
redistribute Avid's licensed AAX SDK.

The Companion owns CreatorHub authentication, network access, offline cache
and PTSL. The AAX process only connects to `127.0.0.1:31417`, authenticates with
the separate local Review Console credential and sends protocol v1 messages.
The CreatorHub cloud device token never crosses this boundary.

Supported actions are `health`, `state`, `feedback`, `locate`, `mark`,
`resolve`, `reply`, `snapshot` and `send_review`. Every connection carries one
newline-delimited JSON request and receives one response before closing.

To finish the distributable `.aaxplugin`, add the files in `src/` to the Avid
AAX SDK project, provide the SDK-owned view/controller implementation and pass
the OS credential-store value for service
`com.creatorhub.protools-companion`, account `aax-review-console-ipc`, to
`CreatorHubReviewBridge`. Signing, wrapping and iLok authorization stay in the
Avid-controlled release job.

The host-neutral adapter is intentionally small enough to compile on macOS and
Windows without linking the PTSL SDK inside Pro Tools. This follows Avid's
threading guidance: socket work must run off the Pro Tools UI/audio thread.
