# Google Verification Demo

This folder contains the local helper scripts for recording a Google OAuth verification demo for CreatorHub.

## Files

- `record-screen.sh`: records a timed macOS screen video using `screencapture`
- `convert-video.sh`: converts the raw `.mov` recording into an upload-friendly `.mp4`

## Suggested CreatorHub flow

1. Open CreatorHub on the live domain.
2. Start the screen recording on the main display.
3. Show the CreatorHub page and the visible domain in the browser.
4. Trigger Google Workspace connection from the product.
5. Complete the OAuth consent screen.
6. Return to CreatorHub and demonstrate the features that rely on the granted scopes:
   - Google Drive file workflow
   - Google Calendar / Meet workflow
   - Gmail read + draft/send workflow
   - Contacts lookup
   - Tasks
   - Chat spaces/messages
   - YouTube publishing and metadata editing
   - **Ads & marketing (Stage 4 on `/google-verification-demo`)** — live read-only
     calls proving each marketing scope is used:
       - List Google Ads accounts (adwords)
       - List GA4 accounts (analytics.edit)
       - List Search Console sites (webmasters)
       - List Tag Manager accounts (tagmanager)
     Requires a connected account with Google Ads + GA4/GSC/GTM access.
7. Convert the raw `.mov` to `.mp4`.
8. Upload the final video to YouTube as `Unlisted`.

## Example

```bash
frontend/scripts/google-verification/record-screen.sh output/google-verification/creatorhub-demo-raw.mov 240 1
frontend/scripts/google-verification/convert-video.sh output/google-verification/creatorhub-demo-raw.mov output/google-verification/creatorhub-demo.mp4
```
