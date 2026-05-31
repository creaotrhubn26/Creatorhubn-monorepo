# Meta App Review — submission master doc

App: **The Role Room** (Meta App ID `1042181045651851`)
Reviewer bypass token: `LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY`
Live host: `https://creatorhub-backend-rtbl.onrender.com`
Reviewer landing: <https://creatorhub-backend-rtbl.onrender.com/admin/meta-app-review-index?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY>

This doc is the single source of truth for the submission. Each row links to its
detailed runbook, demo URL, and screencast. Paste-ready text lives in each
permission's runbook under `## Use case` and `## Reviewer instructions`.

## Status overview

| # | Permission / feature | Demo URL (live, 200 OK) | Runbook | Screencast | Real creds? |
|---|---|---|---|---|---|
| 1 | oEmbed Read | [oembed-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/oembed-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./oembed-app-review-runbook.md) | `recordings/oembed-read-demo-20260531T142149.webm` | ⚠ needs public IG/FB URL |
| 2 | `pages_manage_cta` | [pages-manage-cta-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/pages-manage-cta-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./pages-manage-cta-app-review-runbook.md) | `recordings/pages-manage-cta-demo-20260531T145509.webm` | ❌ placeholder token |
| 3 | Page Public Content Access | [page-public-content-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/page-public-content-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./page-public-content-app-review-runbook.md) | `recordings/page-public-content-demo-20260531T145536.webm` | ❌ App in Dev mode |
| 4 | Page Mentions | [page-mentions-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/page-mentions-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./page-mentions-app-review-runbook.md) | `recordings/page-mentions-demo-20260531T145557.webm` | ❌ App in Dev mode |
| 5 | Page Public Metadata Access | [page-public-metadata-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/page-public-metadata-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./page-public-metadata-app-review-runbook.md) | `recordings/page-metadata-demo-20260531T145618.webm` | ❌ App in Dev mode |
| 6 | Instagram Public Content Access | [instagram-public-content-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/instagram-public-content-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./ig-public-content-app-review-runbook.md) | `recordings/instagram-public-content-demo-20260531T145652.webm` | ❌ placeholder IG user_id |
| 7 | `leads_retrieval` | [leads-retrieval-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/leads-retrieval-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./leads-retrieval-app-review-runbook.md) | `recordings/leads-retrieval-demo-20260531T145814.webm` | ❌ placeholder token |
| 8 | `instagram_manage_events` | [instagram-manage-events-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/instagram-manage-events-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./ig-manage-events-app-review-runbook.md) | `recordings/instagram-manage-events-demo-20260531T145845.webm` | ❌ placeholder token |
| 9 | WhatsApp Business Messaging | (existing demo from prior submission) | [runbook](./whatsapp-app-review-runbook.md) | (existing recording) | ✅ shipped earlier |

Verification commands:
```bash
TOKEN=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY
BASE=https://creatorhub-backend-rtbl.onrender.com
for p in oembed pages-manage-cta page-public-content page-mentions page-public-metadata instagram-public-content leads-retrieval instagram-manage-events; do
  printf "%3s  /admin/%s-app-review-demo\n" \
    "$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/admin/$p-app-review-demo?token=$TOKEN")" "$p"
done
curl -sS -o /dev/null -w "%{http_code}" "$BASE/admin/meta-app-review-index?token=$TOKEN"
```

## The remaining blocker — Development-mode credentials

Backend pipeline, demo pages, runbooks, screencasts and the reviewer landing
page are all in place. Demo URLs all return `200 OK`. The remaining gap is
that **6 of 8 recordings show Meta error responses** because the demo env
files use placeholder Page-IDs and tokens. Meta App Review will reject a
screencast that ends in `(#100) Object does not exist...`.

To make the recordings truly submission-ready, the developer must provide a
real Page (the developer must be an admin/editor on that Page) and generate
Page- + IG-scoped access tokens.

### What's needed per permission

| Submission | What must be filled in | Where to set |
|---|---|---|
| 1. oEmbed Read | A public Instagram post URL + a public Facebook post URL (anyone's, just verify in incognito) | `backend/.env.oembed.demo.local` → `DEMO_INSTAGRAM_POST_URL`, `DEMO_FACEBOOK_POST_URL` |
| 2. pages_manage_cta | A Page you admin + a Page-scoped token with `pages_manage_cta` scope | `backend/.env.pages-cta.demo.local` → `DEMO_PAGE_ID`, `DEMO_PAGE_ACCESS_TOKEN` |
| 3. Page Public Content | A Page where the app has been added as a Tester (Dev mode), or any Page once feature is approved | `backend/.env.page-public-content.demo.local` → `DEMO_PAGE_ID` |
| 4. Page Mentions | Same as #3 | `backend/.env.page-mentions.demo.local` → `DEMO_PAGE_ID` |
| 5. Page Public Metadata | Same as #3 | `backend/.env.page-metadata.demo.local` → `DEMO_PAGE_ID` |
| 6. IG Public Content | A real IG Business `user_id` you own + at least one IG public hashtag + one IG username that is a Business/Creator | `backend/.env.ig-public.demo.local` → `DEMO_IG_USER_ID`, `DEMO_HASHTAG`, `DEMO_IG_USERNAME` |
| 7. leads_retrieval | A Page you admin that has at least one Lead Ad form + a Page-scoped token with `leads_retrieval` scope | `backend/.env.leads-retrieval.demo.local` → `DEMO_PAGE_ID`, `DEMO_PAGE_ACCESS_TOKEN` |
| 8. instagram_manage_events | An IG Business `user_id` + Page-scoped token with `instagram_manage_events` scope | `backend/.env.ig-events.demo.local` → `DEMO_IG_USER_ID`, `DEMO_IG_TOKEN` |

### Getting Page-scoped tokens (one-time setup, ~10 minutes)

1. Go to <https://developers.facebook.com/tools/explorer>.
2. Select app **The Role Room** (`1042181045651851`).
3. Click **Get Token → Get User Access Token** → check the scopes you need
   (`pages_manage_cta`, `pages_read_engagement`, `pages_show_list`,
   `leads_retrieval`, `instagram_basic`, `instagram_manage_events`).
4. Approve the dialog with your own FB user (you must already be Developer
   on the app).
5. Run `GET /me/accounts` in the Explorer → copy the `id` (Page ID) and
   `access_token` (long-lived Page token) for the Page you'll demo with.
6. For IG flows, run `GET /{page-id}?fields=instagram_business_account` →
   copy the IG `id` for use as `DEMO_IG_USER_ID` / `DEMO_IG_TOKEN`
   (uses the same Page-scoped token).

Paste the resulting IDs/tokens into the env files listed above, then run
the orchestrator:

```bash
./backend/scripts/record-all-app-review-demos.sh
```

The script reads each env file, skips items whose env file is incomplete,
re-records the rest, and renames the freshly-produced webm to a stable
name in `recordings/`.

## What ships to Meta App Review

For each of the 8 new permissions:

1. **Use case** — copy the `## Use case` block from the corresponding runbook.
2. **Instructions for reviewer** — copy the `## Reviewer instructions` block.
   Replace the placeholder `<DEMO_TOKEN>` with the literal bypass token
   `LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY`.
3. **Screencast** — upload the corresponding webm from `recordings/`.
4. **Test users** — none required; the reviewer uses our demo-bypass token.

The reviewer landing page (`/admin/meta-app-review-index`) is a courtesy
index for the Meta reviewer — it lists all 9 submissions with status badges
and one-click demo links. Linking to it from the submission notes is
optional but reduces friction.
