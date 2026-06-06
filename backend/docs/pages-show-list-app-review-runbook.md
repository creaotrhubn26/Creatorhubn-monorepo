# `pages_show_list` — App Review runbook

Permission/feature: **pages_show_list** — list the Facebook Pages a person
manages, for the account-picker in The Role Room's connect flow.

## Use case (paste this into App Review)

> The Role Room is a casting/production-management platform for the Norwegian
> film/TV/theatre industry. When a production team connects their Meta account
> via Facebook Login, we use `pages_show_list` to call `GET /me/accounts` and
> present the list of Facebook Pages the person manages, so they can choose
> which production-team Page (and its connected Instagram Business account + ad
> account) to link to The Role Room.
>
> - `GET /v21.0/me/accounts?fields=id,name,category,tasks,picture{url}` — list
>   the Pages the user manages for the account-picker.
>
> How it adds value: a user often administers several Pages; showing the actual
> list lets them pick the correct one instead of pasting IDs, and we only ever
> operate on the Page they explicitly select.
>
> Why it's necessary: `pages_show_list` is the only way to enumerate the Pages a
> user manages. Without it the user cannot connect a Page, which is the entry
> point for every other feature (CTA management, content publishing, lead
> retrieval, events).

## Reviewer instructions (paste this into App Review's "Instructions for reviewer")

> 1. Open the live demo URL:
>    `https://creatorhub-backend-rtbl.onrender.com/admin/pages-show-list-app-review-demo?token=<DEMO_TOKEN>`
>    (Same demo-bypass token as the prior Meta App Review submissions.)
> 2. **Step 1 — Click "Continue with Facebook"** — illustrates the connect flow;
>    in production this is Facebook Login where the user grants `pages_show_list`.
> 3. **Step 2 — Paste a user access token** with `pages_show_list`. (The demo
>    also accepts an optional user id, which runs `/{user-id}/accounts` —
>    equivalent to `/me/accounts` against the user's own token.)
> 4. **Step 3 — Click "List my Pages"**. Backend issues `GET /me/accounts` and
>    renders each Page (picture, name, category, ID) as a selectable card. The
>    user picks which Page to connect.

## Record the screencast

```
node backend/scripts/record-pages-show-list-app-review-demo.playwright.mjs
```

Reads `backend/.env.pages-show-list.demo.local` for `APP_BASE_URL`,
`WHATSAPP_DEMO_BYPASS_TOKEN`, `DEMO_ACCESS_TOKEN`, `DEMO_USER_ID`.
Output: `recordings/pages-show-list-demo-<ts>.webm`.
