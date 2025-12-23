# Community Admin Components

Location: `client/src/components/admin/community`

## Components
- `GroupManagement.tsx`: CRUD for profession groups; expects `/api/community/admin/groups`.
- `ChannelManagement.tsx`: CRUD for channels; optional rules dialog attempts `/api/community/admin/channels/:id/rules` (will show a notice if backend lacks it).
- `RuleManagement.tsx`: Moderation rules configuration; expects `/api/community/moderation/rules`.
- `ModerationManagement.tsx`: Stats, reports, warning flow; expects `/api/community/moderation/stats`, `/api/community/moderation/reports`, `/api/community/moderation/warn`, `/api/community/moderation/reports/:id/resolve`. Actions feed will show a notice if the endpoint is missing.
- `LightPatternPromotion.tsx`: Promotion thresholds and candidate lists; expects `/api/community/admin/light-patterns/promotion-candidates`, `/api/community/admin/light-patterns/promotion-thresholds`, and promote POST `/api/community/admin/light-patterns/:id/promote`.
- `OnboardingEditor.tsx`: Attempts admin CRUD via `/api/community/admin/onboarding` and `/api/community/admin/onboarding/:id`; falls back to read-only viewer using `/api/community/onboarding/:profession` if admin endpoints are unavailable.
- `CommunityAnalytics.tsx`, `RolesAndBadges.tsx`: Placeholders for analytics and badges.

## Usage
These components are MUI-based admin views intended for the CreatorHub admin dashboard. All API calls go through `apiRequest` (`@/lib/queryClient`), so ensure auth/session tokens are present in that wrapper.

## Notes
- Channel rules dialog will attempt `/channels/:id/rules` and show a warning if unsupported.
- Moderation actions tab loads from `/moderation/actions` when available; otherwise it shows a warning.
- Light pattern promotion includes threshold dialog and per-pattern preview; pool closing not required on frontend.
- Onboarding editor now edits welcome/completion text and steps (text/video/image/checklist). Steps are kept in order via the `position` field; backend should sort accordingly.
- Components perform lightweight endpoint detection and disable features with a warning when the backend route is missing.
