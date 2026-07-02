# Google OAuth Verification — Port 1 deliverables

OAuth client (Ads/marketing): `256648631702-c1ghdnobjroa489pbd8qrfeue28ioibt`
Project: `creatorhubn-com` · Consent screen: External · App name: CreatorHub / The Role Room

---

## 1. App description (paste into App overview / "App functionality")

CreatorHub (The Role Room) is a B2B platform that content production agencies use to run
marketing and advertising **on behalf of their clients**. A client is invited into a private
client portal, where they can connect their **own** marketing accounts (Google Ads, Google
Analytics 4, Google Search Console, Google Tag Manager). Once the client grants access, the
agency configures conversion tracking and manages the client's advertising for them.

All Google account access is **client-initiated, explicitly consented (the consent is logged
with a timestamp), and revocable at any time** from the client portal. We only access the
specific accounts the client authorizes, and only to perform marketing setup and reporting
the client has asked the agency to do. We never sell Google user data, never use it for
advertising of our own, and never transfer it except to provide the service.

---

## 2. Per-scope justifications (paste into each scope's justification field)

### `…/auth/adwords` — Google Ads
We use the Google Ads API to (a) read the client's campaign performance — impressions,
clicks, cost, conversions, ROAS — to show the client a transparent billing/results view in
their portal, and (b) create **conversion actions** in the client's Google Ads account so the
agency can measure leads, contacts, bookings and purchases. Mutations happen only on explicit
agency action. A narrower scope does not exist for these operations. Benefit: the client gets
accurate conversion tracking and a transparent view of their own ad spend and results.

### `…/auth/analytics.edit` — Google Analytics
We use the Analytics Admin API to set up the client's GA4 property — creating/configuring the
data stream and measurement ID — so conversions and traffic are tracked correctly. We only
edit the property the client authorizes. Read-only scopes are insufficient because we must
create/configure the data stream during onboarding. Benefit: the client gets a correctly
configured analytics setup without doing it themselves.

### `…/auth/webmasters` — Google Search Console
We use Search Console to register the client's site, submit the sitemap and read indexing/search
data, so the agency can improve the client's organic visibility and verify the site for tag
deployment. Benefit: faster, correct Search Console setup and SEO reporting.

### `…/auth/siteverification` — Site Verification
Required to verify ownership of the client's website, a prerequisite for Search Console and
Tag Manager setup. Used only to verify the domains the client provides. Benefit: enables the
above integrations without manual DNS/meta-tag steps for the client.

### `…/auth/tagmanager.edit.containers` and `…/auth/tagmanager.publish` — Google Tag Manager
We use Tag Manager to deploy and publish the tracking tags (conversion tags, analytics tag)
needed to measure the client's marketing — in the client's own GTM container. Edit is needed
to create the tags; publish is needed to make them live. Benefit: the client's tracking is
deployed correctly and consistently by the agency.

---

## 3. Limited Use / data handling statement (if asked)

CreatorHub's use of information received from Google APIs adheres to the Google API Services
User Data Policy, including the Limited Use requirements. Specifically: data from these scopes
is used **only** to provide the marketing-management features the client requested; it is not
sold, not used for ads of our own, not used for AI/ML model training, and is accessible only
to the client's assigned agency users. Tokens are encrypted at rest (AES-256-GCM); the client
can revoke access at any time, which immediately stops all access.

Privacy policy: https://creatorhubn.com/privacy-policy
Homepage: https://creatorhubn.com
Authorized domains: creatorhubn.com, theroleroom.com

---

## 4. Demo video — shot-by-shot script (record screen + narrate, upload UNLISTED to YouTube)

Google requires the video to (a) show the OAuth consent screen with the requested scopes,
(b) show the app's client_id in the browser URL during the OAuth flow, and (c) demonstrate how
each scope is used. Keep it 2–4 min. English narration (or English captions).

**[0:00] Intro (5s)**
On screen: the client portal (theroleroom.com/client/portal/…).
Say: "This is CreatorHub. A client logs into their portal to let their marketing agency manage
their advertising. I'll show how we request Google access and what we do with it."

**[0:10] Start the OAuth flow**
Click "Koble til Google Ads" → the consent prompt opens.
👉 IMPORTANT: pause so the browser URL bar is readable — it shows
`client_id=256648631702-c1ghdnobjroa489pbd8qrfeue28ioibt…` and the scopes. Say the client_id
aloud.

**[0:25] Google consent screen**
Show the Google "Sign in" + consent screen listing the scopes (Google Ads, Analytics, Search
Console, Tag Manager). Say: "The client grants access to their own Google Ads, Analytics,
Search Console and Tag Manager. They consent explicitly, and it's logged."
Click Allow → land back in the portal showing "connected".

**[0:50] Show scope usage #1 — Google Ads**
In the agency view, show the conversions button → click "Opprett konverteringer i klientens
Google Ads", and/or the results/billing panel. Say: "With the adwords scope we create
conversion actions in the client's account and read their campaign results for a transparent
billing view."

**[1:30] Show scope usage #2 — Analytics / Search Console / Tag Manager**
Show the setup screens (GA4 measurement ID, Search Console property, GTM container/publish).
Say: "Analytics.edit configures the GA4 data stream; webmasters + siteverification register and
verify the site in Search Console; Tag Manager edit + publish deploy the tracking tags — all in
the client's own accounts."

**[2:20] Revocation**
Show that the client can disconnect/revoke from the portal. Say: "The client can revoke access
at any time, which immediately stops all access."

**[2:35] Close**
Say: "All access is client-initiated, consented, used only to provide the requested marketing
service, and never sold or used for our own ads."

---

## 5. Submission checklist
- [ ] App in "In production", External (already done).
- [ ] Branding: app name, support email, logo, homepage, privacy URL filled in.
- [ ] Authorized domains: creatorhubn.com, theroleroom.com.
- [ ] All 6 scopes added with justifications (section 2).
- [ ] YouTube (unlisted) demo video URL (section 4).
- [ ] Submit via Verification Center → "Submit for review".
- [ ] (Separate) Google Ads MCC → API Center → request Basic access for the developer token.

---

# Part 3 — ⭐ COMBINED verification video (RECORD THIS ONE)

**Both OAuth clients are in the same GCP project — number `256648631702` (`creatorhubn-com`):**
- Ads/marketing client: `256648631702-c1ghdnobjroa489pbd8qrfeue28ioibt`
- Workspace (Drive/Gmail/etc.) client: `256648631702-7s92vtepjrmv68eb9iick95npivkgs3j`

Google verification, the consent screen and the scope list are **per project**, not per client.
So this is **one submission** and Google wants **one video that demonstrates every requested
scope**. Record the single running order below (it just chains Part 1 §4 and Part 2 §D). Each
of the two "Connect" flows shows its own client_id in the URL — that's expected and correct.

5–7 min, English narration or captions. Prep one agency account that has: connected test
Google accounts, ≥1 client with campaign data, ≥1 delivered project in Drive, ≥1 client email
reply already in the thread.

**[0:00] Intro (10s)** — producer dashboard. "CreatorHub / The Role Room lets production
agencies run their clients' marketing and deliver their work. The agency connects its own
Google accounts. I'll show every Google permission we request and exactly what each one does."

**[0:15] Connect #1 — Ads/marketing** (client `…c1ghd…`)
Client portal → "Koble til Google Ads". 👉 Pause on the URL — read `client_id=256648631702-c1ghd…`
aloud. Consent screen lists Ads / Analytics / Search Console / Tag Manager. Allow → "connected".

**[0:45] Demonstrate Ads scopes** — run Part 1 §4 shots [0:50]→[2:20]:
- `adwords`: create conversion actions + read campaign results
- `analytics.edit`: GA4 data stream / measurement ID
- `webmasters` + `siteverification`: register + verify site in Search Console
- `tagmanager.edit.containers` + `tagmanager.publish`: deploy + publish tags

**[2:30] Connect #2 — Drive & Gmail** (client `…7s92v…`)
Settings → Integrations → "Connect your Google Drive". 👉 Pause on the URL — read
`client_id=256648631702-7s92v…` aloud. Consent screen lists Drive (full), See Drive files,
View Drive activity, Read email, Manage drafts & send email. Allow → "Connected".

**[3:00] Demonstrate Drive & Gmail scopes** — run Part 2 §D shots [0:55]→[2:20]:
- `drive`: create project folder + upload deliverables + share with client (permissions)
- `drive.readonly`: attach existing Drive files read-only
- `drive.activity.readonly`: "client opened the final gallery" on the timeline
- `gmail.readonly` + `gmail.compose`: client reply pulled into inbox + reply from agency Gmail

**[5:00] Revocation + Limited Use close (both)** — show disconnect/revoke in both places.
"All access is client/agency-initiated, consented, revocable, and used only to provide the
requested service — never sold, never used for our own ads or model training."

> **Do NOT show** Apps Script / Google Meet / metadata-only screens — those 5 Drive scopes are
> being removed (Part 2 §B). A scope you can't demo is what fails a restricted-scope review.

> The two per-client scripts below (Part 1 §4, Part 2 §D) are now just the component detail for
> this combined take — you don't record them separately.

---

# Part 2 — Drive & Gmail restricted scopes (workspace / client-comms client)

> These scopes belong to the main CreatorHub / Role Room workspace OAuth client (Drive
> backup + client communications), NOT the Ads client above. Full `drive` and all `gmail`
> scopes are **restricted** → this group also requires a **CASA Tier-2 security assessment**
> in addition to the demo video.

## A. What we actually request AND use (submit these)

Verified by a repo-wide code audit (2026-07-02). Each is genuinely called; each is
demonstrable in the video.

### `…/auth/drive` — full Drive (RESTRICTED)
The agency connects its **own** Google Drive so CreatorHub can (a) **back up** delivered
client media (galleries, edits, final deliverables) into the agency's Drive, (b) create and
organize per-project folders, (c) upload signed contracts/documents, and (d) **share**
specific files/folders with the right client by managing Drive **permissions**
(`permissions.create/list/delete`). We create, read, list, update and export files, and set
sharing on the files we create/manage. `drive.file` is insufficient because we must also
organize into, and manage sharing across, folders the app did not itself create (existing
agency project structure). Code: `drive-batch-upload-service.ts`, `contract-google-signing.ts`,
`backup-routes.ts`, `communication-routes.ts`, `role-room-routes.ts`, `lightroom-routes.ts`,
`role-room-agent-feed-plan-routes.ts`. Benefit: the agency's client deliverables are backed
up, organized and shared automatically instead of by hand.

### `…/auth/drive.readonly` — read Drive (RESTRICTED)
Used to read back existing files/folders the agency selects for delivery or backup (list
contents, fetch metadata/thumbnails, verify a file before sharing) without modifying them.
Code: file-listing paths in `communication-routes.ts` / `role-room-routes.ts`. Benefit: the
agency can pick from its existing Drive to attach to a project without granting write where
only reading is needed.

### `…/auth/drive.activity.readonly` — Drive Activity (RESTRICTED)
Used with the Drive Activity API (`driveActivityApi.activity.query`) to show the agency **who
viewed or edited a delivered file** on the client-communication timeline (e.g. "client opened
the final gallery"). Read-only; we never write activity. Code:
`communication-routes.ts:5072`. Benefit: producers see whether the client has actually opened
the deliverable, closing the delivery loop.

### `…/auth/gmail.readonly` — read Gmail (RESTRICTED)
Used by the client-conversation poller to find the client's **email replies** so they appear
inside the in-app conversation thread. We search only the last 90 days and only match messages
against **thread IDs of emails the app itself sent** — we never read the mailbox at large. Code:
`chat-gmail-poller.ts:256` (`messages.list` + `messages.get`), `communication-routes.ts`
(`threads.list` / `threads.get`). Benefit: a client can just reply to an email and it lands in
the producer's unified inbox — no copy-paste.

### `…/auth/gmail.compose` — draft Gmail (RESTRICTED)
Used to compose/draft emails from the agency's own Gmail (client updates, audition reminders,
delivery notices) so they're sent from the agency's real address and threaded correctly. Code:
`communication-routes.ts` (drafts), `role-room-education-inquiry-service.ts`. Benefit: outbound
client email comes from the agency's own Gmail identity, keeping the thread intact.

### `…/auth/gmail.send` — send Gmail (RESTRICTED)
Used to send the above messages (audition reminders, client notifications) programmatically
from the agency's Gmail. Code: `communication-routes.ts` / `communication-routes.ts` reminder
paths (`messages.send`). Benefit: reminders and client comms go out automatically on schedule.

### `…/auth/drive.file` — app-created files (sensitive, NOT restricted)
Per-file access to files CreatorHub itself creates/opens. No CASA needed for this one.

## B. Scopes Google lists but the app does NOT call — DROP these

A whole-repo audit (every `.ts/.tsx/.js/.mjs/.json/.env`, frontend + backend) returned **zero**
call sites for the following. The full `drive` scope you already hold **grants everything these
give you**, so requesting them adds no capability — but a reviewer will look for each in the
demo video, not find it, and can reject the whole submission.

| Scope | Call sites in repo | Why it's redundant |
|---|---|---|
| `drive.metadata` | 0 | metadata is already readable/writable via full `drive` |
| `drive.metadata.readonly` | 0 | metadata already readable via `drive` / `drive.readonly` |
| `drive.meet.readonly` | 0 | no Meet API / Meet-recording access in the app |
| `drive.scripts` | 0 | no Apps Script API usage anywhere |
| `drive.activity` (write) | 0 | we only query activity read-only (`drive.activity.readonly`) |

**Action:** in Google Cloud Console → OAuth consent screen → Data access, **remove** those 5
scopes. Keep: `drive`, `drive.readonly`, `drive.activity.readonly`, `gmail.readonly`,
`gmail.compose`, `gmail.send` (+ `drive.file`). This is the fastest, truthful path to approval.
If you genuinely intend to build Apps Script / Meet-recording / metadata-only features later,
add + demo those scopes **in the submission where they're actually exercised** — not before.

> **UPDATED DECISION (2026-07-02, after build):** We BUILT real features so two of the five
> are now genuinely used — verify these, don't drop them:
> - `drive.meet.readonly` + `meetings.space.readonly` (NEW) → **Meet-recording import**:
>   `POST /api/creatorhub/google/meet/import-artifacts` lists a meeting's recordings/transcripts
>   via the Meet REST API (`conferenceRecords`) and reads the Meet-generated Drive files.
>   Code: `google-meet.ts` (`listMeetArtifactsForMeeting`, `readMeetDriveFile`).
> - `drive.scripts` + `script.projects` (NEW) → **Apps Script deliverable automation**:
>   `POST /api/creatorhub/google/apps-script/attach` creates a container-bound Apps Script on a
>   generated deliverables Sheet (CreatorHub menu + formatting/status macros).
>   Code: `apps-script-service.ts` (`attachDeliverableAutomationScript`).
>
> Still DROP the 3 that cannot be made real: `drive.metadata`, `drive.metadata.readonly`
> (strict subset of full `drive`), and `drive.activity` write (the Drive Activity API v2 has
> only `activity.query` — no write method exists, verified against the API reference).
>
> Original name-collision note (still true for the 3 dropped):
> the app's "Meet" feature creates Meet *links* via the Calendar API (`createGoogleMeetLink`,
> `conferenceData`), it does NOT read Meet *recording files* (`drive.meet.readonly`;
> `conferenceRecords` = 0 hits). The app's "script" features are DaVinci Resolve scripts +
> casting manuscripts — NOT the Google Apps Script API (`drive.scripts`;
> `script.googleapis.com` = 0 hits). None of the 5 appear in any code scope list, only in the
> Console consent screen → dropping them is a pure Console action, zero code change, nothing
> breaks.
>
> Console click-path: console.cloud.google.com → project `256648631702` (creatorhubn-com) →
> APIs & Services → OAuth consent screen → **Data access** → Edit → untick/Remove:
> `drive.metadata`, `drive.metadata.readonly`, `drive.meet.readonly`, `drive.scripts`,
> `drive.activity` (keep `drive.activity.readonly`) → Save. Then record the Part 3 video.

## C. CASA note
Full `drive` + Gmail are restricted → Google will route this group to a **CASA Tier-2**
security assessment (independent lab, annual, ~$540 typical). Budget time for it; the demo
video alone won't clear restricted scopes.

> Scope-of-this-submission note: Google's flagged list for this client is `drive`,
> `drive.readonly`, `drive.activity.readonly`, `gmail.readonly`, `gmail.compose`. `gmail.send`
> is granted on a different client — justify it in that client's submission, not here.

## D. Demo video — shot-by-shot script (Drive & Gmail client)

Same rules as Part 1 §4: (a) show the consent screen with these scopes, (b) show the
**client_id in the browser URL** during the OAuth flow, (c) demonstrate each scope with real
data. 2–4 min, English narration or captions. Record on a real agency account with at least
one delivered project + one client email reply already present.

**[0:00] Intro (5s)**
On screen: the CreatorHub producer dashboard.
Say: "This is CreatorHub — production agencies use it to deliver work to clients. The agency
connects its own Google Drive and Gmail so deliverables are backed up and client email lands in
one inbox. I'll show how we request access and what each scope does."

**[0:12] Start the OAuth flow**
Go to Settings → Integrations → click **"Connect your Google Drive"** (fires
`POST /api/creatorhub/google/oauth/start` → Google).
👉 IMPORTANT: pause on the Google URL so the **client_id** in the address bar is readable, and
say it aloud.

**[0:25] Google consent screen**
Show Google's consent screen listing the scopes — **See, edit, create and delete all your Google
Drive files** (`drive`), **See your Drive files** (`drive.readonly`), **View activity on your
Drive files** (`drive.activity.readonly`), **Read your email** (`gmail.readonly`), **Manage
drafts and send email** (`gmail.compose`).
Say: "The agency grants access to its own Drive and Gmail. Consent is explicit and logged, and
revocable any time." Click **Allow** → land back showing "Connected".

**[0:55] Scope usage #1 — `drive` (create + share deliverables)**
Open a project → **Deliver / Back up to Drive**. Show a per-project folder being created and the
gallery/edit files uploaded into the agency's Drive, then **share** the folder with the client
(a `permissions.create` share dialog / "shared with client" state).
Say: "With the drive scope we create the project folder, upload the final deliverables, and
share that folder with the specific client by managing Drive permissions."

**[1:35] Scope usage #2 — `drive.readonly` (pick existing files)**
Show the "attach from Drive" / file-picker listing existing Drive files read-only, selecting one
to attach to the project.
Say: "drive.readonly lets the agency browse and attach existing Drive files without write
access."

**[2:00] Scope usage #3 — `drive.activity.readonly` (delivery timeline)**
Open the client-communication timeline and show an activity entry like "Client opened the final
gallery".
Say: "With drive.activity.readonly we query the Drive Activity API to show whether the client
has actually opened the delivered file — read-only, we never write activity."

**[2:20] Scope usage #4 — `gmail.readonly` + `gmail.compose` (unified inbox)**
Open the in-app conversation for a client. Show an **incoming client email reply** that was
pulled in (gmail.readonly, matched to a thread we sent, last 90 days). Then **compose a reply**
from the agency's Gmail and send/draft it (gmail.compose).
Say: "gmail.readonly finds the client's replies — only messages matching threads we sent, only
the last 90 days — and shows them in the producer's inbox. gmail.compose lets the producer reply
from the agency's own Gmail so the thread stays intact."

**[2:50] Revocation + close**
Show Disconnect in Integrations.
Say: "The agency can disconnect any time, which immediately revokes access. All Google data is
used only to deliver the agency's own client work — never sold, never used for ads or model
training."

**Do NOT show** Apps Script, Google Meet, or metadata-only screens — those scopes are being
removed (§B) and showing nothing for them is fine; showing a claim you can't demo is what fails
the review.
