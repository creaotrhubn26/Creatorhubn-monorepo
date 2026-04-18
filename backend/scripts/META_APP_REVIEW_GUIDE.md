# Meta App Review — submission guide for The Role Room (Instagram publishing)

This is the playbook for getting `instagram_content_publish` (and supporting
permissions) approved on the Meta App for The Role Room. App Review takes
1–3 weeks the first time and requires real screenshots + a demo video.

## Prerequisites before submitting

- [ ] Meta App created (use `setup-meta-app.playwright.mjs`)
- [ ] Instagram Graph API + Facebook Login for Business products added
- [ ] OAuth redirect URI set: `https://creatorhub-backend-rtbl.onrender.com/api/role-room/instagram/oauth/callback`
- [ ] Webhook endpoint verified (Meta sends a GET → backend returns the `hub.challenge`)
- [ ] **Business Verification** completed (Settings → Business Verification)
  - Norwegian org: provide `Creatorhub AS` + org-nr `937518684` + Brønnøysund-utskrift
  - Stripe account already verified as same business — Meta will likely cross-check
- [ ] Privacy Policy URL set in Settings → Basic
  - Suggestion: `https://creatorhubn.com/privacy`
- [ ] Terms of Service URL set
  - Suggestion: `https://creatorhubn.com/terms`
- [ ] App icon uploaded (1024×1024 PNG)
- [ ] App Domains added: `creatorhubn.com`, `creatorhub-backend-rtbl.onrender.com`

## Permissions to request

| Permission | Why we need it |
|---|---|
| `instagram_basic` | Read IG Business Account profile (username, account id) so producers can verify they linked the right account. |
| `instagram_content_publish` | The core feature — publish images/reels/carousels on behalf of the connected IG Business Account. |
| `pages_show_list` | Discover which Facebook Pages the user manages so we can find the IG account linked to each page. |
| `pages_read_engagement` | Required by Meta to query page→IG-account relationship. |
| `business_management` | Required for Business Manager-owned IG accounts. |

## Demo video script (3–5 min)

Meta requires a screen recording showing the actual end-to-end flow. The
Role Room's recommended script:

1. **(0:00)** Open The Role Room (`https://creatorhubn.com`), log in as a
   producer with Showrunner-tier.
2. **(0:15)** Open a customer project, run the Role Room Agent research.
3. **(0:45)** Switch to Feed-planner tab — show the IG-style feed mockup
   with brand-styled placeholder posts.
4. **(1:00)** Click "Koble Instagram" button → Meta OAuth dialog opens →
   log in with a test IG Business account → grant all 5 permissions.
5. **(1:45)** Back in The Role Room — show the connection card now lists
   `@<test-username>`.
6. **(2:00)** Click on a post → use Google Drive picker to attach an
   image → click "Anbefal med AI" → caption + hashtags get filled in.
7. **(3:00)** Click "Publiser nå" → show the publish status changing
   queued → uploading → container → publishing → published.
8. **(3:30)** Open Instagram (mobile or web) → show the post is live on
   the test account.
9. **(4:00)** Back in The Role Room → show the publish-history view
   (status = published, IG media id linked).

**Recording tips**:
- Use Loom or QuickTime; record at 1080p.
- Voice-over in English (Meta reviewers are international).
- No edits — single continuous take preferred. They want to see the
  actual flow, not a polished marketing video.

## Use-case justification text (paste into App Review form)

> The Role Room is a Norwegian SaaS for content producers and creator
> agencies. Producers manage social media planning for their B2B clients
> (restaurants, retail, professional services). The Feed-planner module
> lets a producer draft a 12-post Instagram content plan for their
> client, attach images from the client's Google Drive, write captions
> with AI assistance, and publish directly to the client's IG Business
> account at scheduled times. We need `instagram_content_publish` so the
> producer can publish on behalf of the client (the client has authorized
> this via the standard Facebook Login flow). All publishes are
> initiated by an authenticated producer in a SaaS dashboard; we do not
> automate publishing without explicit producer action. Rate limits
> (50 publishes/24h per IG account) are enforced server-side before each
> Meta API call. We support image, reel, and carousel media types.

## Post-approval checklist

After Meta approves the app:

- [ ] Switch app to **Live mode** in dashboard (App Settings → Live)
- [ ] Update Render env: `META_APP_ID`, `META_APP_SECRET`,
      `META_OAUTH_REDIRECT_URI`, `META_WEBHOOK_VERIFY_TOKEN` (still test
      mode if it was working in dev — only the app's mode flag changes)
- [ ] Configure the same R2 bucket for image hosting in production
- [ ] Smoke test: have a real producer connect a real IG Business account
      and publish one post. Verify it appears on Instagram and the
      `role_room_instagram_publish_jobs.status` row says `published`.

## Common rejection reasons (and how to avoid them)

- **Demo video shows fake/test data only** → use a real IG Business
  account (the one for `@therolroom` or similar) for the demo.
- **Publishing happens without user action** → Meta is allergic to
  "auto-posting"; in our flow every publish requires a producer click
  the "Publiser nå" button, which is the right pattern.
- **Privacy Policy doesn't mention IG data** → add a paragraph in
  `creatorhubn.com/privacy` explaining we store IG access tokens
  encrypted, only fetch profile metadata + publish on user request, and
  never share IG data with third parties.
- **Business Verification missing** → IG Content Publish is enterprise-
  grade; Meta requires the business behind the app to be verified.

## Helpful Meta dashboard URLs

- App settings: https://developers.facebook.com/apps/{APP_ID}/settings/basic/
- App roles (test users): https://developers.facebook.com/apps/{APP_ID}/roles/roles/
- Permissions and Features: https://developers.facebook.com/apps/{APP_ID}/app-review/permissions/
- App Review status: https://developers.facebook.com/apps/{APP_ID}/app-review/
- Webhook: https://developers.facebook.com/apps/{APP_ID}/webhooks/
- Business Verification: https://business.facebook.com/settings/security
