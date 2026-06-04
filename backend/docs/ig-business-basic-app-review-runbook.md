# `instagram_business_basic` — App Review runbook

Permission/feature: **instagram_business_basic** — read the basic profile
(username, account_type, profile_picture_url, followers_count, media_count) of
an Instagram professional account that a Page admin has connected to The Role
Room.

## Use case (paste this into App Review)

> The Role Room is a casting/production-management platform for the Norwegian
> film/TV/theatre industry. Production teams connect their own Instagram
> Business/Creator account via Facebook Login so the platform can show them
> which account is linked and operate on their behalf within the casting
> workflow.
>
> With **`instagram_business_basic`** we read the connected Instagram
> professional account's basic profile and display it back to the user —
> username and profile picture — in the "Permissions you've granted" card, so
> they can confirm the correct account is linked before publishing or reading
> content.
>
> - `GET /v21.0/{ig-user-id}?fields=id,username,account_type,profile_picture_url,followers_count,media_count,name`
>   — read the connected account's basic profile.
>
> This is requested as a dependency for our content and discovery features
> (instagram_content_publish, Instagram Public Content Access). We only read
> accounts the Page admin has explicitly connected, only basic profile
> metadata, and only BUSINESS/CREATOR account types.

## Reviewer instructions (paste this into App Review's "Instructions for reviewer")

> 1. Open the live demo URL:
>    `https://creatorhub-backend-rtbl.onrender.com/admin/instagram-business-basic-app-review-demo?token=<DEMO_TOKEN>`
>    (Same demo-bypass token as the prior Meta App Review submissions.)
> 2. **Step 1 — Click "Continue with Facebook"** — illustrates the connect
>    flow; in production this is the Facebook Login OAuth where the Page admin
>    selects the Page whose connected IG account they manage and grants
>    `instagram_business_basic`.
> 3. **Step 2 — Enter the connected IG Business `user_id` + access token**
>    (resolved from `/me/accounts` in production).
> 4. **Step 3 — Click "Read connected profile"**. Backend issues
>    `GET /v21.0/{ig-user-id}?fields=username,account_type,profile_picture_url,…`
>    and renders the connected account's profile picture, username,
>    account type, follower count, and post count.

## Record the screencast

```
node backend/scripts/record-ig-business-basic-app-review-demo.playwright.mjs
```

Reads `backend/.env.ig-business-basic.demo.local` for `APP_BASE_URL`,
`WHATSAPP_DEMO_BYPASS_TOKEN`, `DEMO_IG_USER_ID`, `DEMO_IG_PAGE_ACCESS_TOKEN`.
Output: `recordings/instagram-business-basic-demo-<ts>.webm`.
