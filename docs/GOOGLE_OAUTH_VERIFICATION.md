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
