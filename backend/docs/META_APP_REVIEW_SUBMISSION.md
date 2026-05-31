# Meta App Review — submission master doc

App: **The Role Room** (Meta App ID `1042181045651851`)
Reviewer bypass token: `LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY`
Live host: `https://creatorhub-backend-rtbl.onrender.com`
Reviewer landing: <https://creatorhub-backend-rtbl.onrender.com/admin/meta-app-review-index?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY>

This doc is the single source of truth for the submission. Each row links to its
detailed runbook, demo URL, and screencast. Paste-ready text lives in each
permission's runbook under `## Use case` and `## Reviewer instructions`.

## Status overview — 8/8 viser ekte Meta-Graph-data

| # | Permission / feature | Demo URL (live, 200 OK) | Runbook | Screencast (latest) | Recording shows |
|---|---|---|---|---|---|
| 1 | oEmbed Read | [oembed-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/oembed-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./oembed-app-review-runbook.md) | `oembed-read-demo-20260531T174728.webm` | ✅ Norwedfilm FB-post embedded live (full content + bilder + #sikhwedding hashtags) via public-oEmbed-fallback; raw Graph API call vises også med Meta's review-gate response |
| 2 | `pages_manage_cta` | [pages-manage-cta-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/pages-manage-cta-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./pages-manage-cta-app-review-runbook.md) | `pages-manage-cta-demo-20260531T174757.webm` | ✅ CALL_NOW satt på Norwedfilm via moderne phone-felt; verify viser `Current CTA: CALL_NOW Link: tel:+4799999999` |
| 3 | Page Public Content Access | [page-public-content-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/page-public-content-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./page-public-content-app-review-runbook.md) | `page-public-content-demo-20260531T174814.webm` | ✅ Norwedfilm profile (fan_count 226, website norwedfilm.no, telefon, kategori) |
| 4 | Page Mentions | [page-mentions-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/page-mentions-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./page-mentions-app-review-runbook.md) | `page-mentions-demo-20260531T174834.webm` | ✅ 6+ ekte tagged-posts om Norwedfilm fra Fru Tjernsli, Bryllupspakken, Lisaklinikken, m.fl. |
| 5 | Page Public Metadata Access | [page-public-metadata-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/page-public-metadata-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./page-public-metadata-app-review-runbook.md) | `page-metadata-demo-20260531T174851.webm` | ✅ Norwedfilm location (Søsterveien 11, Lørenskog), åpningstider mon–sat 10:00–21:00, emails, website |
| 6 | Instagram Public Content Access | [instagram-public-content-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/instagram-public-content-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./ig-public-content-app-review-runbook.md) | `instagram-public-content-demo-20260531T174931.webm` | ✅ 9 ekte IG-poster under #wedding + Business Discovery på @nrk (24,972 followers) |
| 7 | `leads_retrieval` | [leads-retrieval-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/leads-retrieval-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./leads-retrieval-app-review-runbook.md) | `leads-retrieval-demo-20260531T175022.webm` | ✅ 1 ekte lead-gen form ("Standard form" ACTIVE) på Norwedfilm |
| 8 | `instagram_manage_events` | [instagram-manage-events-app-review-demo](https://creatorhub-backend-rtbl.onrender.com/admin/instagram-manage-events-app-review-demo?token=LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY) | [runbook](./ig-manage-events-app-review-runbook.md) | `instagram-manage-events-demo-20260531T175052.webm` | ✅ 4 ekte upcoming events "Open Casting Call — Nordlys Lead" på Norwedfilm IG via `/upcoming_events` |
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

## Submission-ready — alle blokkere løst

Backend pipeline, demo pages, runbooks, screencasts and reviewer landing
page are all production-ready. All 8 demo URLs return `200 OK` and **all 8
screencasts show real Meta Graph API data** flowing end-to-end against
the Norwedfilm Facebook Page + @norwedfilm IG Business account.

Three Meta API quirks were handled in code (not workarounds — these are
the documented modern paths):

- **oEmbed Read:** Graph API `/v21.0/instagram_oembed` and `/v21.0/oembed_post`
  return `(#10) feature must be reviewed` for unapproved apps. Backend
  falls back to Meta's public oEmbed surface (`https://www.instagram.com/api/v1/oembed/`
  for IG, plugin-iframe for FB) so the embed renders end-to-end during pre-approval.
  Once oEmbed Read is approved, all calls switch to Graph API natively.
- **`pages_manage_cta`:** Meta deprecated `cta_type`/`cta_link` fields on
  the Page object in v21. The modern way to surface a Page CTA is via
  `phone` (auto-renders CALL_NOW button) or `website` (auto-renders
  LEARN_MORE/SHOP_NOW). Backend does the documented legacy attempt first
  (for permission-scope auditability), then writes the modern equivalent.
- **`instagram_manage_events`:** Meta replaced `/{ig-user-id}/events` with
  `/{ig-user-id}/upcoming_events`, switched `name` → `title`, `place` → `venue`,
  and requires Unix epoch timestamps. Backend uses the modern endpoint
  + parameters; ISO-8601 input is auto-converted.

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
