# Frontend typecheck — feilrapport

- **Generert:** 2026-08-13
- **Kommando:** `npx tsc --noEmit` (kjørt i `frontend/`)
- **TypeScript:** 5.9.3 · **Node:** v24 · heap: `--max-old-space-size=8192`

## Konklusjon

De 2 113 feilene er **pre-eksisterende typefeil-gjeld** i frontend-kodebasen, spredt over 642 filer, og er **ikke** introdusert av dependency-/sikkerhetsarbeidet. Feilene består selv når alle `@types/*`-pakker er pinnet tilbake til baseline-versjonene i committet `package-lock.json`. De dominerende feilkodene er implisitte `any`-parametere (TS7006) og MUI-`Box`-typer (TS2769).

## Sammendrag

- **Totalt antall feil:** 2113
- **Antall filer:** 642
- **Antall kataloger (2 nivå under 'client/src/'):** 114

## Topp feiltyper

| TS-kode | Antall | Filer | Betydning |
|---|---|---|---|
| TS7006 | 1543 | 487 | Parameter har implisitt `any` |
| TS2769 | 565 | 259 | Ingen overload matcher kallet |
| TS2322 | 3 | 1 | Type kan ikke tildeles |
| TS7016 | 2 | 2 | (se detalj) |

## Feil per katalog

| Katalog | Filer | Feil |
|---|---|---|
| `client/src/components/role-room` | 194 | 599 |
| `client/src/components/admin` | 160 | 438 |
| `client/src/components/academy` | 27 | 197 |
| `client/src/components/universal` | 32 | 95 |
| `client/src/components/business-intelligence` | 5 | 51 |
| `client/src/components/showcase` | 6 | 44 |
| `client/src/components/timeline` | 5 | 36 |
| `client/src/components/photo-editing` | 8 | 35 |
| `client/src/pages/admin-room` | 10 | 35 |
| `client/src/components/notes` | 10 | 32 |
| `client/src/components/ProfessionalTimeline.tsx` | 1 | 32 |
| `client/src/components/leadgrid` | 13 | 29 |
| `client/src/components/photo-enhancer` | 7 | 28 |
| `client/src/components/vendor` | 10 | 25 |
| `client/src/components/audio` | 6 | 22 |
| `client/src/components/resume` | 8 | 21 |
| `client/src/components/community` | 6 | 19 |
| `client/src/components/AssetBrowser.tsx` | 1 | 16 |
| `client/src/components/tools` | 1 | 12 |
| `client/src/components/email` | 1 | 11 |
| `client/src/components/scroll-story` | 4 | 11 |
| `client/src/pages/audio-showcase.tsx` | 1 | 11 |
| `client/src/components/chat` | 6 | 10 |
| `client/src/pages/leadgrid-landing.tsx` | 1 | 9 |
| `client/src/pages/PricingPage.tsx` | 1 | 9 |
| `client/src/components/analytics` | 4 | 8 |
| `client/src/components/enhancement` | 1 | 8 |
| `client/src/components/meetings` | 2 | 8 |
| `client/src/components/virtual-studio` | 1 | 8 |
| `client/src/pages/theroleroom-landing.tsx` | 1 | 8 |
| `client/src/components/ElegantVideoPlayer.tsx` | 1 | 7 |
| `client/src/components/accounting` | 1 | 6 |
| `client/src/components/admin-room` | 4 | 6 |
| `client/src/components/camera` | 2 | 6 |
| `client/src/components/cms` | 3 | 6 |
| `client/src/components/common` | 5 | 6 |
| `client/src/components/enterprise` | 3 | 6 |
| `client/src/components/marketing` | 3 | 6 |
| `client/src/components/quotes` | 4 | 6 |
| `client/src/components/ai` | 1 | 5 |
| `client/src/pages/about.tsx` | 1 | 5 |
| `client/src/pages/AdminRoom.tsx` | 1 | 5 |
| `client/src/pages/agency-landing.tsx` | 1 | 5 |
| `client/src/pages/blog-post.tsx` | 1 | 5 |
| `client/src/pages/leadgrid-client-portal.tsx` | 1 | 5 |
| `client/src/pages/photographer-equipment.tsx` | 1 | 5 |
| `client/src/pages/photographer-gallery-detail.tsx` | 1 | 5 |
| `client/src/components/communication` | 2 | 4 |
| `client/src/components/CompositionOverlay.tsx` | 1 | 4 |
| `client/src/components/contracts` | 1 | 4 |
| `client/src/components/davinci-resolve` | 2 | 4 |
| `client/src/components/evendi` | 2 | 4 |
| `client/src/components/feedback` | 1 | 4 |
| `client/src/components/InviteRequestForm.tsx` | 1 | 4 |
| `client/src/components/StoryArcGenerator.tsx` | 1 | 4 |
| `client/src/components/StoryArcStudio.tsx` | 1 | 4 |
| `client/src/components/ui` | 3 | 4 |
| `client/src/pages/leadgrid-deals.tsx` | 1 | 4 |
| `client/src/pages/leadgrid-import.tsx` | 1 | 4 |
| `client/src/components/auth` | 1 | 3 |
| `client/src/components/CodeGenerationStudio.tsx` | 1 | 3 |
| `client/src/components/crm` | 2 | 3 |
| `client/src/components/seo-specialist` | 2 | 3 |
| `client/src/pages/chat-actions-guide.tsx` | 1 | 3 |
| `client/src/pages/chat-guide.tsx` | 1 | 3 |
| `client/src/pages/client-gallery.tsx` | 1 | 3 |
| `client/src/pages/leadgrid-marketplace.tsx` | 1 | 3 |
| `client/src/pages/leadgrid-personvern.tsx` | 1 | 3 |
| `client/src/pages/leadgrid-pricing.tsx` | 1 | 3 |
| `client/src/pages/leadgrid-superadmin.tsx` | 1 | 3 |
| `client/src/pages/nextrole-landing.tsx` | 1 | 3 |
| `client/src/pages/warmup-guide.tsx` | 1 | 3 |
| `client/src/components/ai-training` | 1 | 2 |
| `client/src/components/branded` | 1 | 2 |
| `client/src/components/dashboard` | 1 | 2 |
| `client/src/components/EmailDesigner` | 1 | 2 |
| `client/src/components/gallery` | 1 | 2 |
| `client/src/components/InspectorPanel.tsx` | 1 | 2 |
| `client/src/components/notifications` | 2 | 2 |
| `client/src/components/onboarding` | 1 | 2 |
| `client/src/components/project` | 1 | 2 |
| `client/src/components/royalties` | 1 | 2 |
| `client/src/components/video` | 1 | 2 |
| `client/src/components/wiremock` | 1 | 2 |
| `client/src/pages/admin-invite-system.tsx` | 1 | 2 |
| `client/src/pages/AdminWorkspace.tsx` | 1 | 2 |
| `client/src/pages/CullingReview.tsx` | 1 | 2 |
| `client/src/pages/leadgrid-feltsalg-salgsteam.tsx` | 1 | 2 |
| `client/src/pages/leadgrid-skaffe-leads-guide.tsx` | 1 | 2 |
| `client/src/pages/leadgrid-workflows.tsx` | 1 | 2 |
| `client/src/pages/photographer-client-detail.tsx` | 1 | 2 |
| `client/src/pages/pitch-deck.tsx` | 1 | 2 |
| `client/src/pages/portal.tsx` | 1 | 2 |
| `client/src/pages/wedding-access.tsx` | 1 | 2 |
| `client/src/components/equipment` | 1 | 1 |
| `client/src/components/invite` | 1 | 1 |
| `client/src/components/lightroom` | 1 | 1 |
| `client/src/components/modals` | 1 | 1 |
| `client/src/components/shared` | 1 | 1 |
| `client/src/components/story-arc-studio` | 1 | 1 |
| `client/src/components/TwoFactorSetup.tsx` | 1 | 1 |
| `client/src/components/universal-communication` | 1 | 1 |
| `client/src/components/website-builder` | 1 | 1 |
| `client/src/components/wedding-timeline-client-view.tsx` | 1 | 1 |
| `client/src/components/worklog` | 1 | 1 |
| `client/src/pages/agency-faq.tsx` | 1 | 1 |
| `client/src/pages/audio-review-shared.tsx` | 1 | 1 |
| `client/src/pages/blog-index.tsx` | 1 | 1 |
| `client/src/pages/client-portal-marketing.tsx` | 1 | 1 |
| `client/src/pages/leadgrid-akademi.tsx` | 1 | 1 |
| `client/src/pages/leadgrid-research-consent.tsx` | 1 | 1 |
| `client/src/pages/photographer-project-detail.tsx` | 1 | 1 |
| `client/src/pages/photographer-wedding-day.tsx` | 1 | 1 |
| `client/src/services/webgl-transition-engine.ts` | 1 | 1 |

## Topp 20 filer med flest feil

| Fil | Feil |
|---|---|
| `frontend/client/src/components/academy/AcademyLowerThirdsStudio.tsx` | 40 |
| `frontend/client/src/components/ProfessionalTimeline.tsx` | 32 |
| `frontend/client/src/components/business-intelligence/PersonaBuilder.tsx` | 31 |
| `frontend/client/src/components/role-room/components/producer/ProducerMediaPanel.tsx` | 30 |
| `frontend/client/src/components/academy/AcademyCTAOverlayStudio.tsx` | 25 |
| `frontend/client/src/components/role-room/components/ManuscriptPanel.tsx` | 25 |
| `frontend/client/src/components/showcase/ShowcaseAdmin.tsx` | 21 |
| `frontend/client/src/components/admin/IntegrationsManagementPanel.tsx` | 20 |
| `frontend/client/src/components/role-room/components/AuditionSchedulePanel.tsx` | 20 |
| `frontend/client/src/components/role-room/components/EquipmentManagementPanel.tsx` | 18 |
| `frontend/client/src/components/role-room/components/LoginDialog.tsx` | 18 |
| `frontend/client/src/pages/admin-room/LeadMapPanel.tsx` | 17 |
| `frontend/client/src/components/AssetBrowser.tsx` | 16 |
| `frontend/client/src/components/showcase/ComprehensiveShowcaseAdmin.tsx` | 15 |
| `frontend/client/src/components/photo-enhancer/FrequencySepEditor.tsx` | 14 |
| `frontend/client/src/components/role-room/components/LocationManagementPanel.tsx` | 14 |
| `frontend/client/src/components/universal/misc/CreatorHubPhotoEnhancer.tsx` | 14 |
| `frontend/client/src/components/academy/AcademyAssignmentsStudio.tsx` | 13 |
| `frontend/client/src/components/academy/AcademyLessonStudio.tsx` | 13 |
| `frontend/client/src/components/academy/AcademyPresentationOverlayStudio.tsx` | 13 |

## Alle feil per fil

Gruppert per katalog. Hver feil står som `fil(linje): error TS<kode> melding`.


### `client/src/components/academy`

- **`frontend/client/src/components/academy/AcademyAnalyticsStudio.tsx`** — 2 feil
  - L1159: TS2769: No overload matches this call.
  - L1611: TS2769: No overload matches this call.
- **`frontend/client/src/components/academy/AcademyAssetBrowser.tsx`** — 4 feil
  - L328: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L370: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1030: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1030: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/AcademyAssignmentsStudio.tsx`** — 13 feil
  - L2605: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L2605: TS7006: Parameter 'nextValue' implicitly has an 'any' type.
  - L3316: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3328: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3338: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3348: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3636: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L3636: TS7006: Parameter 'nextValue' implicitly has an 'any' type.
  - L3643: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L4382: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L4382: TS7006: Parameter 'nextValue' implicitly has an 'any' type.
  - L4894: TS7006: Parameter '_event' implicitly has an 'any' type.
  - _… og 1 til._
- **`frontend/client/src/components/academy/AcademyBrandMark.tsx`** — 1 feil
  - L13: TS2769: No overload matches this call.
- **`frontend/client/src/components/academy/AcademyCohortSettingsStudio.tsx`** — 3 feil
  - L1152: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L1162: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L1172: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/AcademyCTAOverlayStudio.tsx`** — 25 feil
  - L3168: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3191: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3214: TS2769: No overload matches this call.
  - L3245: TS2769: No overload matches this call.
  - L3279: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3314: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3314: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L3342: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3342: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L3394: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3744: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3744: TS7006: Parameter 'value' implicitly has an 'any' type.
  - _… og 13 til._
- **`frontend/client/src/components/academy/AcademyDashboard.tsx`** — 3 feil
  - L1641: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1705: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2781: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/AcademyDashboardCinematic.tsx`** — 1 feil
  - L825: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/AcademyLandingPage.tsx`** — 1 feil
  - L1050: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/AcademyLessonStudio.tsx`** — 13 feil
  - L2643: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2643: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L2908: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2908: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L2953: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2953: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L3000: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3000: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L3041: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3542: TS7006: Parameter '_' implicitly has an 'any' type.
  - L4561: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L4898: TS7006: Parameter 'event' implicitly has an 'any' type.
  - _… og 1 til._
- **`frontend/client/src/components/academy/AcademyLogo3D.tsx`** — 6 feil
  - L9: TS7016: Could not find a declaration file for module 'three'. 'C:/Users/UsmanQazi/Creatorhubn-monorepo/node_modules/three/build/three.module.js' implicitly has an 'any' type.
  - L93: TS2322: Type '{ map: any; transparent: true; opacity: number; toneMapped: boolean; depthWrite: boolean; }' is not assignable to type 'ExtendedColors<Overwrite<Partial<{}>, NodeProps<{}, {}>>>'.
  - L380: TS7006: Parameter 'child' implicitly has an 'any' type.
  - L380: TS7006: Parameter 'index' implicitly has an 'any' type.
  - L446: TS2322: Type '{ attach: string; count: number; array: Float32Array<ArrayBuffer>; itemSize: number; }' is not assignable to type 'ExtendedColors<Overwrite<Partial<{}>, NodeProps<{}, {}>>>'.
  - L448: TS2322: Type '{ color: string; size: number; transparent: true; opacity: number; sizeAttenuation: true; }' is not assignable to type 'ExtendedColors<Overwrite<Partial<{}>, NodeProps<{}, {}>>>'.
- **`frontend/client/src/components/academy/AcademyLowerThirdsStudio.tsx`** — 40 feil
  - L3051: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3074: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3109: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3109: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L3137: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3137: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L3174: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3294: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3294: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L3308: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3308: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L3322: TS7006: Parameter '_' implicitly has an 'any' type.
  - _… og 28 til._
- **`frontend/client/src/components/academy/AcademyMediaStudio.tsx`** — 3 feil
  - L3304: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L4063: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L4200: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/AcademyMonetizationStudio.tsx`** — 4 feil
  - L659: TS2769: No overload matches this call.
  - L896: TS7006: Parameter '_' implicitly has an 'any' type.
  - L967: TS7006: Parameter '_' implicitly has an 'any' type.
  - L967: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/AcademyPlayerStudio.tsx`** — 1 feil
  - L504: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/AcademyPresentationOverlayStudio.tsx`** — 13 feil
  - L8940: TS2769: No overload matches this call.
  - L9050: TS2769: No overload matches this call.
  - L9073: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L9098: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L9173: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L9240: TS2769: No overload matches this call.
  - L9253: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L9288: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L9315: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L9742: TS2769: No overload matches this call.
  - L9837: TS2769: No overload matches this call.
  - L11220: TS7006: Parameter '_' implicitly has an 'any' type.
  - _… og 1 til._
- **`frontend/client/src/components/academy/AcademySettingsPanel.tsx`** — 10 feil
  - L1205: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1205: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L2208: TS2769: No overload matches this call.
  - L2408: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2408: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L2413: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L2487: TS2769: No overload matches this call.
  - L2711: TS2769: No overload matches this call.
  - L2736: TS2769: No overload matches this call.
  - L2761: TS2769: No overload matches this call.
- **`frontend/client/src/components/academy/AnimatedLowerThirds.tsx`** — 12 feil
  - L1348: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1362: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1374: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1393: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1814: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1814: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L2340: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2340: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L2519: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2519: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L2531: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2531: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/CourseCreator.tsx`** — 3 feil
  - L2255: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2277: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2304: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/CourseCreatorSidebar.tsx`** — 1 feil
  - L729: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/CoursePricingPanel.tsx`** — 3 feil
  - L220: TS7006: Parameter '_' implicitly has an 'any' type.
  - L220: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L232: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/CTAOverlayEditor.tsx`** — 10 feil
  - L1468: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1482: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1494: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1513: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1590: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1590: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L1655: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1655: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L2225: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2225: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/InstructorRevenueDashboard.tsx`** — 1 feil
  - L291: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/PublishToCommunityDialog.tsx`** — 2 feil
  - L559: TS2769: No overload matches this call.
  - L706: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/QuizManager.tsx`** — 8 feil
  - L3396: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3452: TS2769: No overload matches this call.
  - L3508: TS2769: No overload matches this call.
  - L3512: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3551: TS2769: No overload matches this call.
  - L3555: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3726: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3785: TS7006: Parameter '_' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/VideoAnnotationEditor.tsx`** — 6 feil
  - L3713: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L4605: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L4641: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L4664: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L4786: TS7006: Parameter '_' implicitly has an 'any' type.
  - L4909: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/academy/VideoChapterManager.tsx`** — 8 feil
  - L727: TS2769: No overload matches this call.
  - L807: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L818: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L831: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L845: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L856: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L865: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1023: TS2769: No overload matches this call.

### `client/src/components/accounting`

- **`frontend/client/src/components/accounting/AccountingBillingOverview.tsx`** — 6 feil
  - L581: TS2769: No overload matches this call.
  - L593: TS2769: No overload matches this call.
  - L670: TS2769: No overload matches this call.
  - L682: TS2769: No overload matches this call.
  - L739: TS2769: No overload matches this call.
  - L744: TS2769: No overload matches this call.

### `client/src/components/admin-room`

- **`frontend/client/src/components/admin-room/market-intelligence/GrantWorkspacePanel.tsx`** — 1 feil
  - L163: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin-room/market-intelligence/InsightsFeedPanel.tsx`** — 1 feil
  - L238: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin-room/market-intelligence/MarketScanDetailPanel.tsx`** — 2 feil
  - L356: TS7006: Parameter '_' implicitly has an 'any' type.
  - L356: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin-room/market-intelligence/OpportunityScorePanel.tsx`** — 2 feil
  - L276: TS7006: Parameter '_' implicitly has an 'any' type.
  - L276: TS7006: Parameter 'v' implicitly has an 'any' type.

### `client/src/components/admin`

- **`frontend/client/src/components/admin/AcademyAdminPanel.tsx`** — 3 feil
  - L730: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L772: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L772: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/AdminActivityFeed.tsx`** — 1 feil
  - L578: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/AdminCommunicationPanel.tsx`** — 5 feil
  - L410: TS7006: Parameter '_' implicitly has an 'any' type.
  - L410: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L643: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L643: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L759: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/AdminConsole.tsx`** — 2 feil
  - L1076: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1076: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/AdminDashboard.tsx`** — 6 feil
  - L2288: TS7006: Parameter '_e' implicitly has an 'any' type.
  - L2288: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L2861: TS2769: No overload matches this call.
  - L3378: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3378: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L4480: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/AdminEmailCenter.tsx`** — 2 feil
  - L444: TS7006: Parameter '_' implicitly has an 'any' type.
  - L444: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/AdminFloatingActionButtons.tsx`** — 3 feil
  - L286: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L404: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L516: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/AdminPerformanceDashboard.tsx`** — 2 feil
  - L543: TS7006: Parameter '_' implicitly has an 'any' type.
  - L543: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/AIAnalyticsInsights.tsx`** — 2 feil
  - L264: TS7006: Parameter '_' implicitly has an 'any' type.
  - L264: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/AITodoTracker.tsx`** — 1 feil
  - L346: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/AIVideoGenerator.tsx`** — 1 feil
  - L363: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/AutomatedBusinessReports.tsx`** — 2 feil
  - L944: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L944: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/B2ArchiveTab.tsx`** — 2 feil
  - L363: TS2769: No overload matches this call.
  - L375: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/BackupManagementInterface.tsx`** — 1 feil
  - L353: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/CodeExplainerPanel.tsx`** — 3 feil
  - L195: TS7006: Parameter '_' implicitly has an 'any' type.
  - L195: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L637: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/CombinedCameraDiscoveryManager.tsx`** — 1 feil
  - L347: TS7006: Parameter '_' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/CommunicationTestPanel.tsx`** — 2 feil
  - L720: TS7006: Parameter '_' implicitly has an 'any' type.
  - L720: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/community/LightPatternPromotion.tsx`** — 4 feil
  - L442: TS7006: Parameter '_' implicitly has an 'any' type.
  - L442: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L455: TS7006: Parameter '_' implicitly has an 'any' type.
  - L455: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/community/ModerationManagement.tsx`** — 2 feil
  - L285: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L285: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/community/RolesAndBadges.tsx`** — 2 feil
  - L606: TS7006: Parameter '_' implicitly has an 'any' type.
  - L606: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/community/VotingBoardManagement.tsx`** — 2 feil
  - L420: TS7006: Parameter '_' implicitly has an 'any' type.
  - L420: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/CompleteDeploymentManager.tsx`** — 4 feil
  - L1609: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2103: TS2769: No overload matches this call.
  - L2114: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2114: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/ComprehensiveProtocolManager.tsx`** — 2 feil
  - L446: TS7006: Parameter '_' implicitly has an 'any' type.
  - L446: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/content-marketing/BusinessDnaOnboarding.tsx`** — 2 feil
  - L264: TS2769: No overload matches this call.
  - L349: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/content-marketing/CastingScamSignsPage.tsx`** — 1 feil
  - L189: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/content-marketing/DansestudioNorgePage.tsx`** — 2 feil
  - L441: TS2769: No overload matches this call.
  - L462: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/content-marketing/FilmTvUtdanningVerktoyPage.tsx`** — 1 feil
  - L176: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/content-marketing/InnholdsprodusentPage.tsx`** — 2 feil
  - L360: TS2769: No overload matches this call.
  - L381: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/content-marketing/MarketingCatalogTab.tsx`** — 1 feil
  - L145: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/content-marketing/NewsletterBlockBuilder.tsx`** — 2 feil
  - L359: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L402: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/content-marketing/NewsletterSignupBlock.tsx`** — 1 feil
  - L121: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/content-marketing/NewsletterStudioTab.tsx`** — 1 feil
  - L351: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/content-marketing/NorskCastingProsessPage.tsx`** — 2 feil
  - L210: TS2769: No overload matches this call.
  - L226: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/content-marketing/OperativsystemPage.tsx`** — 1 feil
  - L390: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/content-marketing/PlatformStatusCard.tsx`** — 1 feil
  - L116: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/content-marketing/ProduksjonsOSPage.tsx`** — 2 feil
  - L529: TS2769: No overload matches this call.
  - L550: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/content-marketing/PublicBriefPage.tsx`** — 2 feil
  - L111: TS2769: No overload matches this call.
  - L222: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/content-marketing/RoleRoomEconomyTab.tsx`** — 2 feil
  - L486: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L676: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/ContentCalendar.tsx`** — 1 feil
  - L247: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/Creatorhubnotesnew.tsx`** — 4 feil
  - L1442: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1442: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L1479: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1479: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/CustomerJourneyBuilder.tsx`** — 3 feil
  - L1968: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1968: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L2534: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/DAMAdminPanel.tsx`** — 2 feil
  - L789: TS7006: Parameter '_' implicitly has an 'any' type.
  - L789: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/DatabaseManagementPanel.tsx`** — 2 feil
  - L1513: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1513: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/DependenciesManager.tsx`** — 2 feil
  - L338: TS7006: Parameter '_' implicitly has an 'any' type.
  - L338: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/DocumentationBrowser.tsx`** — 3 feil
  - L551: TS2769: No overload matches this call.
  - L600: TS7006: Parameter '_' implicitly has an 'any' type.
  - L600: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/EditingPartnersAdminPanel.tsx`** — 2 feil
  - L200: TS7006: Parameter '_' implicitly has an 'any' type.
  - L200: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/EmailTemplateLibrary.tsx`** — 2 feil
  - L368: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L454: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/EnhancedActivityFeed.tsx`** — 1 feil
  - L435: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/EnterpriseInquiriesPanel.tsx`** — 2 feil
  - L198: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L218: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/feature-management.tsx`** — 2 feil
  - L516: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L516: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/FeatureCustomizationPanel.tsx`** — 2 feil
  - L253: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L253: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/FeatureManagementWithPublish.tsx`** — 2 feil
  - L423: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L423: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/FikenIntegrationRequestsPanel.tsx`** — 2 feil
  - L440: TS7006: Parameter '_' implicitly has an 'any' type.
  - L440: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/FileManagementTestPanel.tsx`** — 2 feil
  - L322: TS7006: Parameter '_' implicitly has an 'any' type.
  - L322: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/FixValidationRequest.tsx`** — 2 feil
  - L239: TS7006: Parameter '_' implicitly has an 'any' type.
  - L239: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/GDPRCompliancePanel.tsx`** — 4 feil
  - L287: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L320: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L374: TS7006: Parameter '_' implicitly has an 'any' type.
  - L374: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/IntegratedEmailMarketingCenter.tsx`** — 1 feil
  - L335: TS7006: Parameter '_' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/IntegrationAnalyticsDashboard.tsx`** — 2 feil
  - L812: TS7006: Parameter '_' implicitly has an 'any' type.
  - L812: TS7006: Parameter 'tab' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/IntegrationsManagementPanel.tsx`** — 20 feil
  - L1460: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1460: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L3564: TS2769: No overload matches this call.
  - L3630: TS2769: No overload matches this call.
  - L3695: TS2769: No overload matches this call.
  - L3812: TS2769: No overload matches this call.
  - L4183: TS2769: No overload matches this call.
  - L4298: TS2769: No overload matches this call.
  - L4324: TS2769: No overload matches this call.
  - L4350: TS2769: No overload matches this call.
  - L4376: TS2769: No overload matches this call.
  - L4402: TS2769: No overload matches this call.
  - _… og 8 til._
- **`frontend/client/src/components/admin/InviteManagementDashboard.tsx`** — 4 feil
  - L411: TS7006: Parameter '_' implicitly has an 'any' type.
  - L411: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L506: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L506: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/LeadgridAdminSection.tsx`** — 2 feil
  - L28: TS7006: Parameter '_' implicitly has an 'any' type.
  - L28: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/LeadgridExperienceMediaPanel.tsx`** — 1 feil
  - L49: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/LeadgridTestimonialsPanel.tsx`** — 2 feil
  - L115: TS7006: Parameter '_' implicitly has an 'any' type.
  - L115: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/LeadMapMarketplaceCard.tsx`** — 3 feil
  - L155: TS2769: No overload matches this call.
  - L165: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L234: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/LiveVerificationDemo.tsx`** — 3 feil
  - L438: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L565: TS7006: Parameter '_' implicitly has an 'any' type.
  - L565: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/PackageMarketplace.tsx`** — 2 feil
  - L461: TS7006: Parameter '_' implicitly has an 'any' type.
  - L461: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/PriceManagementDashboard.tsx`** — 2 feil
  - L1518: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2889: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/ProductManager.tsx`** — 1 feil
  - L479: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/ProfessionCMSManager.tsx`** — 1 feil
  - L409: TS7006: Parameter '_' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/PrototypeFeedbackPanel.tsx`** — 4 feil
  - L1254: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1564: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1621: TS2769: No overload matches this call.
  - L2094: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/ReceiptTemplateManager.tsx`** — 1 feil
  - L487: TS7006: Parameter '_' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/ReportsPanel.tsx`** — 1 feil
  - L318: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/SEOBotAnalyticsDashboard.tsx`** — 2 feil
  - L337: TS7006: Parameter '_' implicitly has an 'any' type.
  - L337: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/SEOTrendsDashboard.tsx`** — 2 feil
  - L212: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L212: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/shared/useAdminPresence.tsx`** — 1 feil
  - L107: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/ShowcaseSettingsPanel.tsx`** — 5 feil
  - L545: TS7006: Parameter '_' implicitly has an 'any' type.
  - L545: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L1502: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L1502: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L1517: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/SocialMediaManager.tsx`** — 3 feil
  - L471: TS7006: Parameter '_' implicitly has an 'any' type.
  - L471: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L668: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/tables/ApiKeysDataGrid.tsx`** — 1 feil
  - L331: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/TesterSkillRatings.tsx`** — 1 feil
  - L169: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/TestingDashboard.tsx`** — 2 feil
  - L440: TS7006: Parameter '_' implicitly has an 'any' type.
  - L440: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/TidumAccessRequestsPanel.tsx`** — 1 feil
  - L320: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/TrialManagementPanel.tsx`** — 2 feil
  - L784: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L784: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/TutorialApprovalPanel.tsx`** — 2 feil
  - L358: TS7006: Parameter '_' implicitly has an 'any' type.
  - L358: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/UnifiedAdminAnalytics.tsx`** — 2 feil
  - L247: TS7006: Parameter '_' implicitly has an 'any' type.
  - L247: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/UserManagementPanel.tsx`** — 1 feil
  - L2438: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/VerificationSystemDemo.tsx`** — 2 feil
  - L533: TS7006: Parameter '_' implicitly has an 'any' type.
  - L533: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/ViralContentCreator.tsx`** — 2 feil
  - L368: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L368: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/AccessibilityAnimationDashboard.tsx`** — 2 feil
  - L318: TS7006: Parameter '_' implicitly has an 'any' type.
  - L318: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/AICompletionPanel.tsx`** — 2 feil
  - L174: TS7006: Parameter '_' implicitly has an 'any' type.
  - L174: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/AIDebugAssistant.tsx`** — 2 feil
  - L389: TS7006: Parameter '_' implicitly has an 'any' type.
  - L389: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/AIIntegrationDashboard.tsx`** — 2 feil
  - L695: TS7006: Parameter '_' implicitly has an 'any' type.
  - L695: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/AIPromptTemplates.tsx`** — 4 feil
  - L398: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L425: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L434: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L444: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/AISettingsDialog.tsx`** — 6 feil
  - L271: TS7006: Parameter '_' implicitly has an 'any' type.
  - L271: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L292: TS7006: Parameter '_' implicitly has an 'any' type.
  - L292: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L331: TS7006: Parameter '_' implicitly has an 'any' type.
  - L331: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/AIVisionCodeGenerator.tsx`** — 1 feil
  - L373: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/visual-editor/AnimationDashboard.tsx`** — 6 feil
  - L775: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1230: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1283: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1283: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L1296: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1296: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/AnimationTools.tsx`** — 4 feil
  - L237: TS7006: Parameter '_' implicitly has an 'any' type.
  - L237: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L314: TS7006: Parameter '_' implicitly has an 'any' type.
  - L314: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/AssetManager.tsx`** — 5 feil
  - L372: TS7006: Parameter '_' implicitly has an 'any' type.
  - L372: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L552: TS2769: No overload matches this call.
  - L562: TS2769: No overload matches this call.
  - L572: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/visual-editor/BrandingWorkflowPanel.tsx`** — 2 feil
  - L392: TS7006: Parameter '_' implicitly has an 'any' type.
  - L392: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/CanvasToolbar.tsx`** — 1 feil
  - L223: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/CloudSyncDashboard.tsx`** — 2 feil
  - L866: TS7006: Parameter '_' implicitly has an 'any' type.
  - L866: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/CodeEditorPanel.tsx`** — 3 feil
  - L547: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L585: TS7006: Parameter '_' implicitly has an 'any' type.
  - L585: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/CodeSyncSystem.tsx`** — 1 feil
  - L596: TS7006: Parameter '_' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/CollaborationDashboard.tsx`** — 2 feil
  - L603: TS7006: Parameter '_' implicitly has an 'any' type.
  - L603: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/ComponentLibrary.tsx`** — 3 feil
  - L781: TS7006: Parameter '_' implicitly has an 'any' type.
  - L781: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L826: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/ComponentLibraryDashboard.tsx`** — 2 feil
  - L658: TS7006: Parameter '_' implicitly has an 'any' type.
  - L658: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/ComponentLibrarySidebar.tsx`** — 1 feil
  - L280: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/CreatorHubDesignShell.tsx`** — 2 feil
  - L95: TS7006: Parameter '_e' implicitly has an 'any' type.
  - L95: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/DashboardComponentManager.tsx`** — 9 feil
  - L581: TS7006: Parameter '_' implicitly has an 'any' type.
  - L581: TS7006: Parameter 'val' implicitly has an 'any' type.
  - L591: TS7006: Parameter '_' implicitly has an 'any' type.
  - L591: TS7006: Parameter 'val' implicitly has an 'any' type.
  - L666: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L671: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L676: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1060: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1060: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/DashboardIntegrationPanel.tsx`** — 2 feil
  - L320: TS7006: Parameter '_' implicitly has an 'any' type.
  - L320: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/DesignSystemDashboard.tsx`** — 2 feil
  - L690: TS7006: Parameter '_' implicitly has an 'any' type.
  - L690: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/DragDropDashboard.tsx`** — 2 feil
  - L647: TS7006: Parameter '_' implicitly has an 'any' type.
  - L647: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/EditorNavigatorPanel.tsx`** — 8 feil
  - L270: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L277: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L293: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L305: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L353: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L354: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L361: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L368: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/EnhancedPropertiesPanel.tsx`** — 2 feil
  - L1256: TS2769: No overload matches this call.
  - L1287: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/visual-editor/EnhancedTopToolbar.tsx`** — 1 feil
  - L423: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/EnhancedVisualEditorPage.tsx`** — 1 feil
  - L3046: TS7006: Parameter '_' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/ExportDashboard.tsx`** — 2 feil
  - L577: TS7006: Parameter '_' implicitly has an 'any' type.
  - L577: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/ExportPresetsDashboard.tsx`** — 2 feil
  - L652: TS7006: Parameter '_' implicitly has an 'any' type.
  - L652: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/FabricCanvas.tsx`** — 1 feil
  - L2104: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/GestureDashboard.tsx`** — 2 feil
  - L583: TS7006: Parameter '_' implicitly has an 'any' type.
  - L583: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/HistoryPanel.tsx`** — 1 feil
  - L259: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/KeyboardShortcuts.tsx`** — 2 feil
  - L445: TS7006: Parameter '_' implicitly has an 'any' type.
  - L445: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/KeyboardShortcutsDashboard.tsx`** — 2 feil
  - L592: TS7006: Parameter '_' implicitly has an 'any' type.
  - L592: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/LandingPageSectionEditor.tsx`** — 4 feil
  - L382: TS7006: Parameter '_' implicitly has an 'any' type.
  - L382: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L528: TS7006: Parameter '_' implicitly has an 'any' type.
  - L528: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/LayoutDashboard.tsx`** — 2 feil
  - L659: TS7006: Parameter '_' implicitly has an 'any' type.
  - L659: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/LogoManagementPanel.tsx`** — 2 feil
  - L154: TS7006: Parameter '_' implicitly has an 'any' type.
  - L154: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/MediaEditingTools.tsx`** — 12 feil
  - L595: TS7006: Parameter '_' implicitly has an 'any' type.
  - L595: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L605: TS7006: Parameter '_' implicitly has an 'any' type.
  - L605: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L615: TS7006: Parameter '_' implicitly has an 'any' type.
  - L615: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L625: TS7006: Parameter '_' implicitly has an 'any' type.
  - L625: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L635: TS7006: Parameter '_' implicitly has an 'any' type.
  - L635: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L645: TS7006: Parameter '_' implicitly has an 'any' type.
  - L645: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/ModalCreator.tsx`** — 4 feil
  - L490: TS7006: Parameter '_' implicitly has an 'any' type.
  - L490: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L834: TS7006: Parameter '_' implicitly has an 'any' type.
  - L834: TS7006: Parameter 'val' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/MonitoringDashboard.tsx`** — 4 feil
  - L396: TS7006: Parameter '_' implicitly has an 'any' type.
  - L396: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L620: TS7006: Parameter '_' implicitly has an 'any' type.
  - L620: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/MultiSiteManager.tsx`** — 2 feil
  - L811: TS7006: Parameter '_' implicitly has an 'any' type.
  - L811: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/PageTreeNavigator.tsx`** — 3 feil
  - L322: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L346: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L381: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/PluginDashboard.tsx`** — 2 feil
  - L564: TS7006: Parameter '_' implicitly has an 'any' type.
  - L564: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/PropertyPanel.tsx`** — 5 feil
  - L179: TS7006: Parameter '_' implicitly has an 'any' type.
  - L179: TS7006: Parameter 'tab' implicitly has an 'any' type.
  - L477: TS7006: Parameter '_' implicitly has an 'any' type.
  - L477: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L479: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/ResponsiveDesignDashboard.tsx`** — 2 feil
  - L487: TS7006: Parameter '_' implicitly has an 'any' type.
  - L487: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/RevenueOptimizationDashboard.tsx`** — 4 feil
  - L450: TS7006: Parameter '_' implicitly has an 'any' type.
  - L450: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L463: TS7006: Parameter '_' implicitly has an 'any' type.
  - L463: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/RolesPermissions.tsx`** — 2 feil
  - L820: TS7006: Parameter '_' implicitly has an 'any' type.
  - L820: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/SEODashboard.tsx`** — 2 feil
  - L501: TS7006: Parameter '_' implicitly has an 'any' type.
  - L501: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/SystemManagementDashboard.tsx`** — 4 feil
  - L400: TS7006: Parameter '_' implicitly has an 'any' type.
  - L400: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L795: TS7006: Parameter '_' implicitly has an 'any' type.
  - L795: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/TemplateDashboard.tsx`** — 3 feil
  - L721: TS7006: Parameter '_' implicitly has an 'any' type.
  - L721: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L796: TS2769: No overload matches this call.
- **`frontend/client/src/components/admin/visual-editor/ThemeDashboard.tsx`** — 2 feil
  - L670: TS7006: Parameter '_' implicitly has an 'any' type.
  - L670: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/ToastDesigner.tsx`** — 12 feil
  - L3296: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3296: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L3373: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3373: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L3408: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3408: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L3422: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3422: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L3471: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3471: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L3642: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3642: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/UnifiedCodeStudio.tsx`** — 2 feil
  - L607: TS7006: Parameter '_' implicitly has an 'any' type.
  - L607: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/VersionControlDashboard.tsx`** — 2 feil
  - L616: TS7006: Parameter '_' implicitly has an 'any' type.
  - L616: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/VisualEditorCanvas.tsx`** — 5 feil
  - L575: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L576: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L577: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L664: TS2769: No overload matches this call.
  - L720: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/VisualEditorCanvasOptimized.tsx`** — 1 feil
  - L146: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/VisualEditorSidebar.tsx`** — 2 feil
  - L224: TS7006: Parameter '_' implicitly has an 'any' type.
  - L224: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/wiring/ComponentWiringSystem.tsx`** — 7 feil
  - L936: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L937: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L938: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L979: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1011: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1060: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1407: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/wiring/DataFlowVisualizer.tsx`** — 2 feil
  - L369: TS7006: Parameter '_' implicitly has an 'any' type.
  - L369: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/wiring/IconPickerWiring.tsx`** — 5 feil
  - L487: TS7006: Parameter '_' implicitly has an 'any' type.
  - L487: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L572: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L640: TS7006: Parameter '_' implicitly has an 'any' type.
  - L640: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/wiring/nodes/AINodes.tsx`** — 4 feil
  - L120: TS7006: Parameter '_' implicitly has an 'any' type.
  - L120: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L216: TS7006: Parameter '_' implicitly has an 'any' type.
  - L216: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/wiring/nodes/AnimationNodes.tsx`** — 6 feil
  - L311: TS7006: Parameter '_' implicitly has an 'any' type.
  - L311: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L322: TS7006: Parameter '_' implicitly has an 'any' type.
  - L322: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L333: TS7006: Parameter '_' implicitly has an 'any' type.
  - L333: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/wiring/nodes/BaseNode.tsx`** — 7 feil
  - L142: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L258: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L264: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L273: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L321: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L330: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L335: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/wiring/nodes/ThemeNodes.tsx`** — 7 feil
  - L114: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L155: TS7006: Parameter '_' implicitly has an 'any' type.
  - L155: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L459: TS7006: Parameter '_' implicitly has an 'any' type.
  - L459: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L546: TS7006: Parameter '_' implicitly has an 'any' type.
  - L546: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/withVisualEditor.tsx`** — 12 feil
  - L543: TS7006: Parameter '_' implicitly has an 'any' type.
  - L543: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L553: TS7006: Parameter '_' implicitly has an 'any' type.
  - L553: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L563: TS7006: Parameter '_' implicitly has an 'any' type.
  - L563: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L573: TS7006: Parameter '_' implicitly has an 'any' type.
  - L573: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L583: TS7006: Parameter '_' implicitly has an 'any' type.
  - L583: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L593: TS7006: Parameter '_' implicitly has an 'any' type.
  - L593: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/WorkflowAutomationDashboard.tsx`** — 2 feil
  - L687: TS7006: Parameter '_' implicitly has an 'any' type.
  - L687: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/visual-editor/ZIndexManager.tsx`** — 7 feil
  - L275: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L289: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L303: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L317: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L333: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L347: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L360: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/VisualCMSAdmin.tsx`** — 1 feil
  - L524: TS7006: Parameter '_' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/VisualCMSAdminDashboard.tsx`** — 1 feil
  - L921: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/VisualCMSDashboard.tsx`** — 1 feil
  - L651: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/VisualUserManagement.tsx`** — 2 feil
  - L510: TS7006: Parameter '_' implicitly has an 'any' type.
  - L510: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/admin/WireMockResponseViewer.tsx`** — 2 feil
  - L150: TS7006: Parameter '_' implicitly has an 'any' type.
  - L150: TS7006: Parameter 'v' implicitly has an 'any' type.

### `client/src/components/ai-training`

- **`frontend/client/src/components/ai-training/EnhancementRatingDialog.tsx`** — 2 feil
  - L147: TS7006: Parameter '_' implicitly has an 'any' type.
  - L147: TS7006: Parameter 'newValue' implicitly has an 'any' type.

### `client/src/components/ai`

- **`frontend/client/src/components/ai/CreativeAIProtocols.tsx`** — 5 feil
  - L439: TS7006: Parameter '_' implicitly has an 'any' type.
  - L476: TS7006: Parameter '_' implicitly has an 'any' type.
  - L476: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L497: TS7006: Parameter '_' implicitly has an 'any' type.
  - L497: TS7006: Parameter 'value' implicitly has an 'any' type.

### `client/src/components/analytics`

- **`frontend/client/src/components/analytics/BusinessAnalyticsPanel.tsx`** — 2 feil
  - L259: TS7006: Parameter '_' implicitly has an 'any' type.
  - L259: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/analytics/BusinessIntelligenceDashboard.tsx`** — 2 feil
  - L216: TS7006: Parameter '_' implicitly has an 'any' type.
  - L216: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/analytics/ClientInsightsDashboard.tsx`** — 2 feil
  - L239: TS7006: Parameter '_' implicitly has an 'any' type.
  - L239: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/analytics/EquipmentAnalytics.tsx`** — 2 feil
  - L242: TS7006: Parameter '_' implicitly has an 'any' type.
  - L242: TS7006: Parameter 'value' implicitly has an 'any' type.

### `client/src/components/AssetBrowser.tsx`

- **`frontend/client/src/components/AssetBrowser.tsx`** — 16 feil
  - L1692: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1776: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1785: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1846: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1861: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1884: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1884: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L2129: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2159: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2201: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2210: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2220: TS7006: Parameter 'e' implicitly has an 'any' type.
  - _… og 4 til._

### `client/src/components/audio`

- **`frontend/client/src/components/audio/ABComparisonPanel.tsx`** — 2 feil
  - L242: TS7006: Parameter '_' implicitly has an 'any' type.
  - L242: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/audio/AdvancedWaveform.tsx`** — 2 feil
  - L264: TS7006: Parameter '_' implicitly has an 'any' type.
  - L264: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/audio/AudioMixerPanel.tsx`** — 10 feil
  - L188: TS7006: Parameter '_' implicitly has an 'any' type.
  - L188: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L225: TS7006: Parameter '_' implicitly has an 'any' type.
  - L225: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L250: TS7006: Parameter '_' implicitly has an 'any' type.
  - L250: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L286: TS7006: Parameter '_' implicitly has an 'any' type.
  - L286: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L294: TS7006: Parameter '_' implicitly has an 'any' type.
  - L294: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/audio/AudioRestorationPanel.tsx`** — 2 feil
  - L254: TS7006: Parameter '_' implicitly has an 'any' type.
  - L254: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/audio/ReferenceTrackPanel.tsx`** — 4 feil
  - L269: TS7006: Parameter '_' implicitly has an 'any' type.
  - L269: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L282: TS7006: Parameter '_' implicitly has an 'any' type.
  - L282: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/audio/SpectralAnalyzer.tsx`** — 2 feil
  - L244: TS7006: Parameter '_' implicitly has an 'any' type.
  - L244: TS7006: Parameter 'value' implicitly has an 'any' type.

### `client/src/components/auth`

- **`frontend/client/src/components/auth/LoginModal.tsx`** — 3 feil
  - L282: TS2769: No overload matches this call.
  - L734: TS2769: No overload matches this call.
  - L746: TS2769: No overload matches this call.

### `client/src/components/branded`

- **`frontend/client/src/components/branded/BrandedClientPortal.tsx`** — 2 feil
  - L116: TS7006: Parameter '_' implicitly has an 'any' type.
  - L116: TS7006: Parameter 'newValue' implicitly has an 'any' type.

### `client/src/components/business-intelligence`

- **`frontend/client/src/components/business-intelligence/CommunicationHub.tsx`** — 4 feil
  - L569: TS7006: Parameter '_' implicitly has an 'any' type.
  - L569: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L795: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L844: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/business-intelligence/CommunicationHubV2.tsx`** — 11 feil
  - L985: TS2769: No overload matches this call.
  - L1340: TS2769: No overload matches this call.
  - L1405: TS2769: No overload matches this call.
  - L1523: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1540: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1733: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1750: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2025: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2048: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L3101: TS2769: No overload matches this call.
  - L3128: TS2769: No overload matches this call.
- **`frontend/client/src/components/business-intelligence/PersonaBuilder.tsx`** — 31 feil
  - L169: TS2769: No overload matches this call.
  - L234: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L260: TS2769: No overload matches this call.
  - L337: TS2769: No overload matches this call.
  - L388: TS2769: No overload matches this call.
  - L440: TS2769: No overload matches this call.
  - L451: TS7006: Parameter '_' implicitly has an 'any' type.
  - L451: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L467: TS7006: Parameter '_' implicitly has an 'any' type.
  - L467: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L483: TS7006: Parameter '_' implicitly has an 'any' type.
  - L483: TS7006: Parameter 'value' implicitly has an 'any' type.
  - _… og 19 til._
- **`frontend/client/src/components/business-intelligence/SurveyBuilder.tsx`** — 3 feil
  - L205: TS7006: Parameter '_' implicitly has an 'any' type.
  - L205: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L307: TS2769: No overload matches this call.
- **`frontend/client/src/components/business-intelligence/SWOTKanbanBoard.tsx`** — 2 feil
  - L293: TS2769: No overload matches this call.
  - L343: TS2769: No overload matches this call.

### `client/src/components/camera`

- **`frontend/client/src/components/camera/CameraTemplateManager.tsx`** — 1 feil
  - L344: TS7006: Parameter '_' implicitly has an 'any' type.
- **`frontend/client/src/components/camera/CameraTemplateSidebar.tsx`** — 5 feil
  - L562: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L573: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L584: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L595: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L606: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/components/chat`

- **`frontend/client/src/components/chat/AdvancedChatProtocols.tsx`** — 1 feil
  - L234: TS7006: Parameter '_' implicitly has an 'any' type.
- **`frontend/client/src/components/chat/EmailChatIntegration.tsx`** — 1 feil
  - L413: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/chat/fullscreen/FullscreenCommunicationTabs.tsx`** — 2 feil
  - L29: TS7006: Parameter '_' implicitly has an 'any' type.
  - L29: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/chat/FullscreenChatWidget.tsx`** — 4 feil
  - L1483: TS7006: Parameter 'el' implicitly has an 'any' type.
  - L1488: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1903: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2186: TS2769: No overload matches this call.
- **`frontend/client/src/components/chat/GoogleDriveAttachmentPicker.tsx`** — 1 feil
  - L906: TS2769: No overload matches this call.
- **`frontend/client/src/components/chat/SupportChatButton.tsx`** — 1 feil
  - L42: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/components/cms`

- **`frontend/client/src/components/cms/CodeGenerator.tsx`** — 2 feil
  - L449: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L449: TS7006: Parameter 'next' implicitly has an 'any' type.
- **`frontend/client/src/components/cms/MaterialIconLibrary.tsx`** — 3 feil
  - L174: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L174: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L218: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/cms/UniversalVisualCMS.tsx`** — 1 feil
  - L192: TS2769: No overload matches this call.

### `client/src/components/CodeGenerationStudio.tsx`

- **`frontend/client/src/components/CodeGenerationStudio.tsx`** — 3 feil
  - L402: TS2769: No overload matches this call.
  - L522: TS7006: Parameter '_' implicitly has an 'any' type.
  - L522: TS7006: Parameter 'v' implicitly has an 'any' type.

### `client/src/components/common`

- **`frontend/client/src/components/common/GooglePayBadge.tsx`** — 1 feil
  - L34: TS2769: No overload matches this call.
- **`frontend/client/src/components/common/GoogleServicesLoadingStates.tsx`** — 1 feil
  - L328: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/common/PublicSocialLinks.tsx`** — 1 feil
  - L144: TS2769: No overload matches this call.
- **`frontend/client/src/components/common/TrialFeatureButton.tsx`** — 1 feil
  - L196: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/common/TrialFeatureGrid.tsx`** — 2 feil
  - L131: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L131: TS7006: Parameter 'newValue' implicitly has an 'any' type.

### `client/src/components/communication`

- **`frontend/client/src/components/communication/ChatWidget.tsx`** — 2 feil
  - L383: TS7006: Parameter '_' implicitly has an 'any' type.
  - L383: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/communication/UniversalCommunication.tsx`** — 2 feil
  - L442: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L442: TS7006: Parameter 'next' implicitly has an 'any' type.

### `client/src/components/community`

- **`frontend/client/src/components/community/AdvancedSearchDialog.tsx`** — 3 feil
  - L345: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L354: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L387: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/community/CommunityFileAttachment.tsx`** — 3 feil
  - L137: TS2769: No overload matches this call.
  - L285: TS2769: No overload matches this call.
  - L311: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/community/CommunityLandingFallback.tsx`** — 3 feil
  - L173: TS2769: No overload matches this call.
  - L542: TS2769: No overload matches this call.
  - L642: TS2769: No overload matches this call.
- **`frontend/client/src/components/community/CoursePostAnalyticsDialog.tsx`** — 5 feil
  - L1241: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1294: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1347: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2033: TS2769: No overload matches this call.
  - L2065: TS2769: No overload matches this call.
- **`frontend/client/src/components/community/ImageContent.tsx`** — 3 feil
  - L71: TS2769: No overload matches this call.
  - L116: TS2769: No overload matches this call.
  - L176: TS2769: No overload matches this call.
- **`frontend/client/src/components/community/MentorDashboard.tsx`** — 2 feil
  - L302: TS7006: Parameter '_' implicitly has an 'any' type.
  - L302: TS7006: Parameter 'newValue' implicitly has an 'any' type.

### `client/src/components/CompositionOverlay.tsx`

- **`frontend/client/src/components/CompositionOverlay.tsx`** — 4 feil
  - L523: TS7006: Parameter '_' implicitly has an 'any' type.
  - L523: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L536: TS7006: Parameter '_' implicitly has an 'any' type.
  - L536: TS7006: Parameter 'value' implicitly has an 'any' type.

### `client/src/components/contracts`

- **`frontend/client/src/components/contracts/ContractTemplateSelector.tsx`** — 4 feil
  - L325: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L339: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L352: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L367: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/components/crm`

- **`frontend/client/src/components/crm/CustomerDetailDrawer.tsx`** — 2 feil
  - L307: TS7006: Parameter '_e' implicitly has an 'any' type.
  - L307: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/crm/DealsPipelineBoard.tsx`** — 1 feil
  - L130: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/components/dashboard`

- **`frontend/client/src/components/dashboard/B2UsageWidget.tsx`** — 2 feil
  - L129: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L170: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/components/davinci-resolve`

- **`frontend/client/src/components/davinci-resolve/ScriptBankManager.tsx`** — 2 feil
  - L309: TS7006: Parameter '_' implicitly has an 'any' type.
  - L309: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/davinci-resolve/ScriptParameterForm.tsx`** — 2 feil
  - L223: TS7006: Parameter '_' implicitly has an 'any' type.
  - L223: TS7006: Parameter 'newValue' implicitly has an 'any' type.

### `client/src/components/ElegantVideoPlayer.tsx`

- **`frontend/client/src/components/ElegantVideoPlayer.tsx`** — 7 feil
  - L805: TS7006: Parameter '_' implicitly has an 'any' type.
  - L805: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L955: TS7006: Parameter '_' implicitly has an 'any' type.
  - L955: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L982: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L998: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1096: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/components/email`

- **`frontend/client/src/components/email/CustomerInquiryCenter.tsx`** — 11 feil
  - L529: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L529: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L604: TS2769: No overload matches this call.
  - L632: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L653: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L665: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L677: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L717: TS2769: No overload matches this call.
  - L742: TS2769: No overload matches this call.
  - L768: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L779: TS7006: Parameter 'event' implicitly has an 'any' type.

### `client/src/components/EmailDesigner`

- **`frontend/client/src/components/EmailDesigner/EmailDesignerComplete.tsx`** — 2 feil
  - L1112: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1153: TS2769: No overload matches this call.

### `client/src/components/enhancement`

- **`frontend/client/src/components/enhancement/VideoEnhancementTools.tsx`** — 8 feil
  - L542: TS7006: Parameter '_' implicitly has an 'any' type.
  - L542: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L558: TS7006: Parameter '_' implicitly has an 'any' type.
  - L558: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L643: TS7006: Parameter '_' implicitly has an 'any' type.
  - L643: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L654: TS7006: Parameter '_' implicitly has an 'any' type.
  - L654: TS7006: Parameter 'value' implicitly has an 'any' type.

### `client/src/components/enterprise`

- **`frontend/client/src/components/enterprise/EnterpriseFeaturePermissions.tsx`** — 2 feil
  - L335: TS7006: Parameter '_' implicitly has an 'any' type.
  - L335: TS7006: Parameter 'expanded' implicitly has an 'any' type.
- **`frontend/client/src/components/enterprise/EnterpriseInquiryForm.tsx`** — 2 feil
  - L354: TS7006: Parameter '_' implicitly has an 'any' type.
  - L354: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/enterprise/EnterpriseTeamManagement.tsx`** — 2 feil
  - L344: TS7006: Parameter '_' implicitly has an 'any' type.
  - L344: TS7006: Parameter 'val' implicitly has an 'any' type.

### `client/src/components/equipment`

- **`frontend/client/src/components/equipment/FirmwareManagementInterface.tsx`** — 1 feil
  - L513: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/components/evendi`

- **`frontend/client/src/components/evendi/EvendiImportantPeople.tsx`** — 2 feil
  - L473: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L478: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/evendi/EvendiOfferManager.tsx`** — 2 feil
  - L349: TS2769: No overload matches this call.
  - L432: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/components/feedback`

- **`frontend/client/src/components/feedback/PrototypeFeedbackTool.tsx`** — 4 feil
  - L872: TS7006: Parameter '_' implicitly has an 'any' type.
  - L872: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L1368: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1368: TS7006: Parameter 'v' implicitly has an 'any' type.

### `client/src/components/gallery`

- **`frontend/client/src/components/gallery/ClientVersionTabs.tsx`** — 2 feil
  - L276: TS7006: Parameter '_' implicitly has an 'any' type.
  - L276: TS7006: Parameter 'v' implicitly has an 'any' type.

### `client/src/components/InspectorPanel.tsx`

- **`frontend/client/src/components/InspectorPanel.tsx`** — 2 feil
  - L118: TS7006: Parameter '_' implicitly has an 'any' type.
  - L118: TS7006: Parameter 'val' implicitly has an 'any' type.

### `client/src/components/invite`

- **`frontend/client/src/components/invite/NdaAgreementCard.tsx`** — 1 feil
  - L126: TS7006: Parameter 'event' implicitly has an 'any' type.

### `client/src/components/InviteRequestForm.tsx`

- **`frontend/client/src/components/InviteRequestForm.tsx`** — 4 feil
  - L619: TS2769: No overload matches this call.
  - L713: TS2769: No overload matches this call.
  - L1049: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1049: TS7006: Parameter 'value' implicitly has an 'any' type.

### `client/src/components/leadgrid`

- **`frontend/client/src/components/leadgrid/AdminPartnerReviewModal.tsx`** — 4 feil
  - L89: TS7006: Parameter '_' implicitly has an 'any' type.
  - L89: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L379: TS7006: Parameter '_' implicitly has an 'any' type.
  - L379: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/leadgrid/ApiAndWebhooksTab.tsx`** — 2 feil
  - L171: TS7006: Parameter '_' implicitly has an 'any' type.
  - L171: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/leadgrid/AssignLeadDialog.tsx`** — 2 feil
  - L155: TS7006: Parameter '_' implicitly has an 'any' type.
  - L155: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/leadgrid/CrmCustomerDetailDrawer.tsx`** — 5 feil
  - L134: TS2769: No overload matches this call.
  - L142: TS2769: No overload matches this call.
  - L150: TS2769: No overload matches this call.
  - L163: TS7006: Parameter '_' implicitly has an 'any' type.
  - L163: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/leadgrid/EmailBrandingTab.tsx`** — 3 feil
  - L340: TS2769: No overload matches this call.
  - L420: TS2769: No overload matches this call.
  - L426: TS2769: No overload matches this call.
- **`frontend/client/src/components/leadgrid/LeadgridNotificationBell.tsx`** — 1 feil
  - L104: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/leadgrid/LeadInboxCard.tsx`** — 2 feil
  - L305: TS2769: No overload matches this call.
  - L331: TS2769: No overload matches this call.
- **`frontend/client/src/components/leadgrid/LeadInboxSection.tsx`** — 1 feil
  - L148: TS2769: No overload matches this call.
- **`frontend/client/src/components/leadgrid/LeadStatusChanger.tsx`** — 2 feil
  - L105: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L106: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/leadgrid/OrgSwitcher.tsx`** — 1 feil
  - L164: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/leadgrid/PartnersTab.tsx`** — 3 feil
  - L179: TS7006: Parameter '_' implicitly has an 'any' type.
  - L179: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L289: TS2769: No overload matches this call.
- **`frontend/client/src/components/leadgrid/PoweredByLeadgridBanner.tsx`** — 1 feil
  - L35: TS2769: No overload matches this call.
- **`frontend/client/src/components/leadgrid/WhatsAppTemplatesTab.tsx`** — 2 feil
  - L167: TS7006: Parameter '_' implicitly has an 'any' type.
  - L167: TS7006: Parameter 'v' implicitly has an 'any' type.

### `client/src/components/lightroom`

- **`frontend/client/src/components/lightroom/LightroomPluginTest.tsx`** — 1 feil
  - L402: TS2769: No overload matches this call.

### `client/src/components/marketing`

- **`frontend/client/src/components/marketing/ContentMarketingEngine.tsx`** — 2 feil
  - L400: TS7006: Parameter '_' implicitly has an 'any' type.
  - L400: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/marketing/EmailMarketingManager.tsx`** — 2 feil
  - L339: TS7006: Parameter '_' implicitly has an 'any' type.
  - L339: TS7006: Parameter 'next' implicitly has an 'any' type.
- **`frontend/client/src/components/marketing/ReferralGrowthSystem.tsx`** — 2 feil
  - L292: TS7006: Parameter '_' implicitly has an 'any' type.
  - L292: TS7006: Parameter 'next' implicitly has an 'any' type.

### `client/src/components/meetings`

- **`frontend/client/src/components/meetings/GoogleWorkspaceMeetingManager.tsx`** — 3 feil
  - L332: TS2769: No overload matches this call.
  - L338: TS2769: No overload matches this call.
  - L344: TS2769: No overload matches this call.
- **`frontend/client/src/components/meetings/NotebookLmWorkspaceCard.tsx`** — 5 feil
  - L408: TS2769: No overload matches this call.
  - L422: TS2769: No overload matches this call.
  - L490: TS2769: No overload matches this call.
  - L508: TS2769: No overload matches this call.
  - L526: TS2769: No overload matches this call.

### `client/src/components/modals`

- **`frontend/client/src/components/modals/QuoteGeneratorModal.tsx`** — 1 feil
  - L1015: TS2769: No overload matches this call.

### `client/src/components/notes`

- **`frontend/client/src/components/notes/AILearningAssistant.tsx`** — 2 feil
  - L236: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L236: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/notes/APIIntegration.tsx`** — 2 feil
  - L226: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L226: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/notes/CodeSandbox.tsx`** — 2 feil
  - L184: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L184: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/notes/DataEncryption.tsx`** — 2 feil
  - L249: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L249: TS7006: Parameter 'tab' implicitly has an 'any' type.
- **`frontend/client/src/components/notes/InteractiveDiagram.tsx`** — 9 feil
  - L420: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L596: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L596: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L607: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L607: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L719: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L719: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L729: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L729: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/notes/LiveCursorTracking.tsx`** — 2 feil
  - L192: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L192: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/notes/PerformanceMonitoring.tsx`** — 4 feil
  - L405: TS7006: Parameter '_' implicitly has an 'any' type.
  - L405: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L507: TS7006: Parameter '_' implicitly has an 'any' type.
  - L507: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/notes/PrivacyControls.tsx`** — 2 feil
  - L267: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L267: TS7006: Parameter 'tab' implicitly has an 'any' type.
- **`frontend/client/src/components/notes/RewardSystem.tsx`** — 2 feil
  - L289: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L289: TS7006: Parameter 'next' implicitly has an 'any' type.
- **`frontend/client/src/components/notes/VisualEffects.tsx`** — 5 feil
  - L314: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L356: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L356: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L366: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L366: TS7006: Parameter 'value' implicitly has an 'any' type.

### `client/src/components/notifications`

- **`frontend/client/src/components/notifications/EnhancementToastProvider.tsx`** — 1 feil
  - L219: TS7006: Parameter 'theme' implicitly has an 'any' type.
- **`frontend/client/src/components/notifications/NotificationSystem.tsx`** — 1 feil
  - L343: TS7006: Parameter 'event' implicitly has an 'any' type.

### `client/src/components/onboarding`

- **`frontend/client/src/components/onboarding/SubscriptionPlanSelector.tsx`** — 2 feil
  - L500: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L516: TS7006: Parameter 'event' implicitly has an 'any' type.

### `client/src/components/photo-editing`

- **`frontend/client/src/components/photo-editing/AutoCullingPanel.tsx`** — 4 feil
  - L212: TS7006: Parameter '_' implicitly has an 'any' type.
  - L212: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L247: TS7006: Parameter '_' implicitly has an 'any' type.
  - L247: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/photo-editing/BeforeAfterView.tsx`** — 2 feil
  - L143: TS7006: Parameter '_' implicitly has an 'any' type.
  - L143: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/photo-editing/FilmStrip.tsx`** — 4 feil
  - L273: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L287: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L300: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L320: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/photo-editing/HealingToolbar.tsx`** — 5 feil
  - L307: TS7006: Parameter '_' implicitly has an 'any' type.
  - L307: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L323: TS7006: Parameter '_' implicitly has an 'any' type.
  - L323: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L367: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/photo-editing/HSLColorPanel.tsx`** — 9 feil
  - L162: TS7006: Parameter '_' implicitly has an 'any' type.
  - L162: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
  - L196: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L219: TS7006: Parameter '_' implicitly has an 'any' type.
  - L219: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L249: TS7006: Parameter '_' implicitly has an 'any' type.
  - L249: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L279: TS7006: Parameter '_' implicitly has an 'any' type.
  - L279: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/photo-editing/MaskToolbar.tsx`** — 7 feil
  - L459: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L510: TS7006: Parameter '_' implicitly has an 'any' type.
  - L510: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L525: TS7006: Parameter '_' implicitly has an 'any' type.
  - L525: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L562: TS7006: Parameter '_' implicitly has an 'any' type.
  - L562: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/photo-editing/PresetManager.tsx`** — 2 feil
  - L221: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L236: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/photo-editing/SnapshotPanel.tsx`** — 2 feil
  - L212: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L225: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/components/photo-enhancer`

- **`frontend/client/src/components/photo-enhancer/AutoDistractionDetector.tsx`** — 3 feil
  - L382: TS2769: No overload matches this call.
  - L431: TS2769: No overload matches this call.
  - L442: TS2769: No overload matches this call.
- **`frontend/client/src/components/photo-enhancer/ExportPresetDialog.tsx`** — 1 feil
  - L742: TS2769: No overload matches this call.
- **`frontend/client/src/components/photo-enhancer/Filmstrip.tsx`** — 2 feil
  - L65: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L168: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/photo-enhancer/FrequencySepEditor.tsx`** — 14 feil
  - L670: TS7006: Parameter '_' implicitly has an 'any' type.
  - L670: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L686: TS7006: Parameter '_' implicitly has an 'any' type.
  - L686: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L700: TS7006: Parameter '_' implicitly has an 'any' type.
  - L700: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L714: TS7006: Parameter '_' implicitly has an 'any' type.
  - L714: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L735: TS7006: Parameter '_' implicitly has an 'any' type.
  - L735: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L785: TS7006: Parameter '_' implicitly has an 'any' type.
  - L785: TS7006: Parameter 'v' implicitly has an 'any' type.
  - _… og 2 til._
- **`frontend/client/src/components/photo-enhancer/HSLColorPanel.tsx`** — 2 feil
  - L235: TS7006: Parameter '_' implicitly has an 'any' type.
  - L235: TS7006: Parameter 'next' implicitly has an 'any' type.
- **`frontend/client/src/components/photo-enhancer/LUTPanel.tsx`** — 4 feil
  - L309: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L323: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L348: TS7006: Parameter '_' implicitly has an 'any' type.
  - L348: TS7006: Parameter 'next' implicitly has an 'any' type.
- **`frontend/client/src/components/photo-enhancer/ObjectRemovalEditor.tsx`** — 2 feil
  - L490: TS7006: Parameter '_' implicitly has an 'any' type.
  - L490: TS7006: Parameter 'v' implicitly has an 'any' type.

### `client/src/components/ProfessionalTimeline.tsx`

- **`frontend/client/src/components/ProfessionalTimeline.tsx`** — 32 feil
  - L1293: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1297: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1383: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L1418: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L1750: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L1871: TS7006: Parameter 'node' implicitly has an 'any' type.
  - L1877: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L1878: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L1965: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2069: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2088: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2107: TS7006: Parameter 'event' implicitly has an 'any' type.
  - _… og 20 til._

### `client/src/components/project`

- **`frontend/client/src/components/project/ProjectCollaborators.tsx`** — 2 feil
  - L511: TS7006: Parameter '_' implicitly has an 'any' type.
  - L511: TS7006: Parameter 'newValue' implicitly has an 'any' type.

### `client/src/components/quotes`

- **`frontend/client/src/components/quotes/QuoteKanbanView.tsx`** — 1 feil
  - L201: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/quotes/QuoteManagement.tsx`** — 2 feil
  - L1029: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1104: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/quotes/QuoteReminderSettings.tsx`** — 1 feil
  - L257: TS7006: Parameter '_event' implicitly has an 'any' type.
- **`frontend/client/src/components/quotes/QuoteTemplatesDialog.tsx`** — 2 feil
  - L260: TS7006: Parameter '_' implicitly has an 'any' type.
  - L260: TS7006: Parameter 'nextValue' implicitly has an 'any' type.

### `client/src/components/resume`

- **`frontend/client/src/components/resume/ArbeidsplassenImportDialog.tsx`** — 1 feil
  - L167: TS2769: No overload matches this call.
- **`frontend/client/src/components/resume/JobApplicationKanban.tsx`** — 2 feil
  - L417: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L439: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/resume/JobApplicationTracker.tsx`** — 2 feil
  - L470: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L470: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/resume/NextRoleMockInterview.tsx`** — 1 feil
  - L482: TS2769: No overload matches this call.
- **`frontend/client/src/components/resume/NextRoleVideoPresentation.tsx`** — 4 feil
  - L875: TS2769: No overload matches this call.
  - L1105: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1105: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L1110: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/resume/ResumeBuilder.tsx`** — 4 feil
  - L5003: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L5013: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L5407: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L5407: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/resume/ResumeBuilderMarketplace.tsx`** — 6 feil
  - L846: TS2769: No overload matches this call.
  - L873: TS2769: No overload matches this call.
  - L949: TS2769: No overload matches this call.
  - L1495: TS2769: No overload matches this call.
  - L1679: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1679: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/resume/SigridCareerMentor.tsx`** — 1 feil
  - L645: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/components/role-room`

- **`frontend/client/src/components/role-room/BookDemoModal.tsx`** — 2 feil
  - L457: TS2769: No overload matches this call.
  - L459: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/cms/BlockListEditor.tsx`** — 3 feil
  - L638: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L640: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L659: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/cms/BlockRenderer.tsx`** — 2 feil
  - L479: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L940: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/cms/RevisionsDrawer.tsx`** — 1 feil
  - L143: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/admin-room/B2ArchiveTab.tsx`** — 2 feil
  - L373: TS2769: No overload matches this call.
  - L386: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/admin/SuperAdminOverlay.tsx`** — 1 feil
  - L477: TS7006: Parameter 'theme' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/admin/visual-editor/GuideEditorPanel.tsx`** — 4 feil
  - L43: TS2769: No overload matches this call.
  - L47: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L231: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L817: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/AdminDashboard.tsx`** — 2 feil
  - L2641: TS2769: No overload matches this call.
  - L2988: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/ai/RoleRoomAgentChatPanel.tsx`** — 1 feil
  - L216: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/AIShotSuggestions.tsx`** — 2 feil
  - L121: TS2769: No overload matches this call.
  - L186: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/AuditionSchedulePanel.tsx`** — 20 feil
  - L1726: TS2769: No overload matches this call.
  - L2252: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2257: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2310: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2363: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2374: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2385: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3377: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L3446: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L3455: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L3487: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L3523: TS2769: No overload matches this call.
  - _… og 8 til._
- **`frontend/client/src/components/role-room/components/AvatarFocalPointEditor.tsx`** — 2 feil
  - L126: TS2769: No overload matches this call.
  - L167: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/BeatBoard.tsx`** — 8 feil
  - L403: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L432: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L438: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L444: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L450: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L456: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L462: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1193: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/calendar/CalendarMonthHeader.tsx`** — 1 feil
  - L93: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/calendar/CrewCalendarView.tsx`** — 2 feil
  - L318: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L347: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/calendar/MonthGridView.tsx`** — 2 feil
  - L153: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L210: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/CandidateWorkflowStatus.tsx`** — 3 feil
  - L248: TS7006: Parameter '_' implicitly has an 'any' type.
  - L248: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L317: TS7006: Parameter 'props' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/casting/CandidateVideoReview.tsx`** — 2 feil
  - L298: TS7006: Parameter '_' implicitly has an 'any' type.
  - L298: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/CastingPlannerTutorial.tsx`** — 1 feil
  - L1166: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/client-workspace/ClientConversationView.tsx`** — 3 feil
  - L516: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L598: TS7006: Parameter '_' implicitly has an 'any' type.
  - L598: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/client-workspace/ClientMerkevareView.tsx`** — 2 feil
  - L131: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L133: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/client-workspace/ClientWorkspaceShell.tsx`** — 5 feil
  - L173: TS2769: No overload matches this call.
  - L175: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L192: TS2769: No overload matches this call.
  - L194: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L225: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/client-workspace/RoleRoomChatBubble.tsx`** — 1 feil
  - L123: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/CollapsibleSection.tsx`** — 1 feil
  - L39: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/ColorWheelPicker.tsx`** — 1 feil
  - L444: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/consent/ConsentPortalView.tsx`** — 2 feil
  - L603: TS2769: No overload matches this call.
  - L638: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/ConsentStatusBadge.tsx`** — 1 feil
  - L116: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/ContentProducerWorkflowStepper.tsx`** — 1 feil
  - L165: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/CrewManagementPanel.tsx`** — 11 feil
  - L424: TS2769: No overload matches this call.
  - L585: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1696: TS2769: No overload matches this call.
  - L3138: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3847: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3852: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L4204: TS2769: No overload matches this call.
  - L4225: TS2769: No overload matches this call.
  - L4437: TS2769: No overload matches this call.
  - L4544: TS2769: No overload matches this call.
  - L4611: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/DeviceMockup.tsx`** — 3 feil
  - L86: TS2769: No overload matches this call.
  - L182: TS2769: No overload matches this call.
  - L262: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/drawing/BrushLibrary.tsx`** — 2 feil
  - L941: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L952: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/drawing/DrawingToolsPanel.tsx`** — 2 feil
  - L571: TS7006: Parameter '_' implicitly has an 'any' type.
  - L571: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/drawing/ExportOptions.tsx`** — 2 feil
  - L445: TS7006: Parameter '_' implicitly has an 'any' type.
  - L445: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/drawing/LayersPanel.tsx`** — 6 feil
  - L488: TS7006: Parameter '_' implicitly has an 'any' type.
  - L488: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L562: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L574: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L588: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L599: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/drawing/OnionSkinning.tsx`** — 6 feil
  - L407: TS7006: Parameter '_' implicitly has an 'any' type.
  - L407: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L432: TS7006: Parameter '_' implicitly has an 'any' type.
  - L432: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L457: TS7006: Parameter '_' implicitly has an 'any' type.
  - L457: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/drawing/ShapeTools.tsx`** — 12 feil
  - L360: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L407: TS7006: Parameter '_' implicitly has an 'any' type.
  - L407: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L415: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L462: TS7006: Parameter '_' implicitly has an 'any' type.
  - L462: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L478: TS7006: Parameter '_' implicitly has an 'any' type.
  - L478: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L495: TS7006: Parameter '_' implicitly has an 'any' type.
  - L495: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L512: TS7006: Parameter '_' implicitly has an 'any' type.
  - L512: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/drawing/StoryboardTemplates.tsx`** — 5 feil
  - L1012: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L1084: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L1164: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1269: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1269: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/drawing/SymmetryMode.tsx`** — 7 feil
  - L321: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L358: TS7006: Parameter '_' implicitly has an 'any' type.
  - L358: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L372: TS7006: Parameter '_' implicitly has an 'any' type.
  - L372: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L387: TS7006: Parameter '_' implicitly has an 'any' type.
  - L387: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/drawing/TextAnnotations.tsx`** — 4 feil
  - L411: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L453: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L504: TS7006: Parameter '_' implicitly has an 'any' type.
  - L504: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/EquipmentManagementPanel.tsx`** — 18 feil
  - L1658: TS2769: No overload matches this call.
  - L4741: TS7006: Parameter 'ev' implicitly has an 'any' type.
  - L5116: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L5144: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L5173: TS2769: No overload matches this call.
  - L5632: TS2769: No overload matches this call.
  - L6122: TS2769: No overload matches this call.
  - L6211: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L7065: TS2769: No overload matches this call.
  - L8358: TS7006: Parameter '_' implicitly has an 'any' type.
  - L8358: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L8479: TS2769: No overload matches this call.
  - _… og 6 til._
- **`frontend/client/src/components/role-room/components/KlientStatusBadge.tsx`** — 1 feil
  - L49: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/landing-sections/LandingBackdrop.tsx`** — 2 feil
  - L32: TS2769: No overload matches this call.
  - L52: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/landing-sections/LandingFooter.tsx`** — 1 feil
  - L43: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/landing-sections/LandingHero.tsx`** — 1 feil
  - L105: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/landing-sections/LandingIntro.tsx`** — 2 feil
  - L55: TS2769: No overload matches this call.
  - L109: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/LandingFAQSection.tsx`** — 1 feil
  - L59: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/LiveSetDitPanel.tsx`** — 1 feil
  - L285: TS7006: Parameter '_e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/LocationAnalysisDialog.tsx`** — 1 feil
  - L2338: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/LocationManagementPanel.tsx`** — 14 feil
  - L3148: TS2769: No overload matches this call.
  - L4394: TS2769: No overload matches this call.
  - L5453: TS2769: No overload matches this call.
  - L5465: TS2769: No overload matches this call.
  - L5684: TS2769: No overload matches this call.
  - L5696: TS2769: No overload matches this call.
  - L5843: TS2769: No overload matches this call.
  - L5858: TS2769: No overload matches this call.
  - L5900: TS2769: No overload matches this call.
  - L5915: TS2769: No overload matches this call.
  - L6455: TS2769: No overload matches this call.
  - L6555: TS7006: Parameter 'e' implicitly has an 'any' type.
  - _… og 2 til._
- **`frontend/client/src/components/role-room/components/LocationMapThumbnail.tsx`** — 1 feil
  - L98: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/LoginDialog.tsx`** — 18 feil
  - L1286: TS2769: No overload matches this call.
  - L1333: TS2769: No overload matches this call.
  - L1352: TS2769: No overload matches this call.
  - L1388: TS2769: No overload matches this call.
  - L1506: TS2769: No overload matches this call.
  - L1533: TS2769: No overload matches this call.
  - L4281: TS2769: No overload matches this call.
  - L4300: TS2769: No overload matches this call.
  - L4434: TS2769: No overload matches this call.
  - L4612: TS2769: No overload matches this call.
  - L4679: TS2769: No overload matches this call.
  - L4840: TS2769: No overload matches this call.
  - _… og 6 til._
- **`frontend/client/src/components/role-room/components/ManuscriptPanel.tsx`** — 25 feil
  - L2341: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2341: TS7006: Parameter 'isEnabled' implicitly has an 'any' type.
  - L2384: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2601: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2636: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2637: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2638: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2669: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2674: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2675: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2731: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2865: TS7006: Parameter 'e' implicitly has an 'any' type.
  - _… og 13 til._
- **`frontend/client/src/components/role-room/components/ManuscriptTemplatePanel.tsx`** — 4 feil
  - L240: TS7006: Parameter '_' implicitly has an 'any' type.
  - L240: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L368: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L411: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/MemoryCardBackupControlDialog.tsx`** — 6 feil
  - L1306: TS2769: No overload matches this call.
  - L1780: TS2769: No overload matches this call.
  - L1794: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L1795: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2001: TS2769: No overload matches this call.
  - L2197: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/mobile-brief/BriefReferenceMoodboard.tsx`** — 3 feil
  - L239: TS2769: No overload matches this call.
  - L243: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L282: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/PlannerBreadcrumb.tsx`** — 1 feil
  - L57: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/PressKitPage.tsx`** — 3 feil
  - L247: TS2769: No overload matches this call.
  - L257: TS2769: No overload matches this call.
  - L336: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/primitives/RoleCard.tsx`** — 1 feil
  - L45: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/primitives/RoleStatPill.tsx`** — 1 feil
  - L57: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/producer/AgentAdsPanel.tsx`** — 1 feil
  - L475: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/AgentDockLauncher.tsx`** — 1 feil
  - L93: TS7006: Parameter 'theme' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/producer/BudgetCategoryPicker.tsx`** — 1 feil
  - L204: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/producer/carousel/CarouselImageSwapDialog.tsx`** — 3 feil
  - L161: TS7006: Parameter '_' implicitly has an 'any' type.
  - L161: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L301: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/carousel/CarouselPostEditor.tsx`** — 2 feil
  - L209: TS7006: Parameter '_' implicitly has an 'any' type.
  - L209: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/producer/carousel/CarouselSlidePreview.tsx`** — 1 feil
  - L93: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/ClientAdsDeploymentPanel.tsx`** — 2 feil
  - L181: TS7006: Parameter '_' implicitly has an 'any' type.
  - L181: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/producer/ClientTiktokCreativesPanel.tsx`** — 1 feil
  - L202: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/DailyBriefCard.tsx`** — 2 feil
  - L279: TS2769: No overload matches this call.
  - L354: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/DiscoveryPanel.tsx`** — 1 feil
  - L155: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/FeedPlanTimeline.tsx`** — 1 feil
  - L168: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/producer/FeedPostDetailPanel.tsx`** — 5 feil
  - L735: TS2769: No overload matches this call.
  - L802: TS2769: No overload matches this call.
  - L957: TS2769: No overload matches this call.
  - L1556: TS2769: No overload matches this call.
  - L1560: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/producer/FeedPostTile.tsx`** — 3 feil
  - L90: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L117: TS2769: No overload matches this call.
  - L221: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/GoogleDriveImagePicker.tsx`** — 2 feil
  - L288: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L315: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/IgHashtagInspector.tsx`** — 1 feil
  - L333: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/MarketingPlanCalendarView.tsx`** — 5 feil
  - L75: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L80: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L83: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L121: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L137: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/MarketingPlanPanel.tsx`** — 4 feil
  - L542: TS7006: Parameter '_' implicitly has an 'any' type.
  - L542: TS7006: Parameter 'next' implicitly has an 'any' type.
  - L2234: TS2769: No overload matches this call.
  - L2292: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/MarketingPlanPostPreview.tsx`** — 4 feil
  - L73: TS2769: No overload matches this call.
  - L146: TS2769: No overload matches this call.
  - L164: TS2769: No overload matches this call.
  - L247: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/MerchMockupPreview.tsx`** — 3 feil
  - L293: TS2769: No overload matches this call.
  - L298: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L409: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/MerchSuppliersPanel.tsx`** — 4 feil
  - L533: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L591: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L642: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L645: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/PagePublicContentInspector.tsx`** — 2 feil
  - L198: TS2769: No overload matches this call.
  - L236: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/ProducerBudgetTabs.tsx`** — 1 feil
  - L41: TS7006: Parameter '_event' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/producer/ProducerExportHandoffPanel.tsx`** — 2 feil
  - L1588: TS2769: No overload matches this call.
  - L1601: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/ProducerGoogleWorkspacePanel.tsx`** — 1 feil
  - L717: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/ProducerMediaPanel.tsx`** — 30 feil
  - L7760: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L7913: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L8397: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L8471: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L8478: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L8516: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L8602: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L8609: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L8731: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L9569: TS2769: No overload matches this call.
  - L10077: TS2769: No overload matches this call.
  - L10264: TS2769: No overload matches this call.
  - _… og 18 til._
- **`frontend/client/src/components/role-room/components/producer/ResearchFieldProvenancePanel.tsx`** — 1 feil
  - L103: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/producer/RoleRoomAgentDialog.tsx`** — 4 feil
  - L1112: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1112: TS7006: Parameter 'next' implicitly has an 'any' type.
  - L1193: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2934: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/producer/RoleRoomAgentIcon.tsx`** — 1 feil
  - L22: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/RoleRoomAgentWorkflowStepper.tsx`** — 1 feil
  - L129: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/producer/RoleRoomFeedPlannerPanel.tsx`** — 1 feil
  - L948: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/RoleRoomGoogleContextBar.tsx`** — 2 feil
  - L825: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L875: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/RoleRoomResearchCompleteOverlay.tsx`** — 1 feil
  - L373: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/producer/VaultRevealMfaPrompt.tsx`** — 2 feil
  - L158: TS7006: Parameter '_' implicitly has an 'any' type.
  - L158: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/producer/VersionPicker.tsx`** — 1 feil
  - L79: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/production/AddShotDialog.tsx`** — 3 feil
  - L241: TS2769: No overload matches this call.
  - L288: TS2769: No overload matches this call.
  - L377: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/production/AuditionGuide.tsx`** — 2 feil
  - L1843: TS2769: No overload matches this call.
  - L2014: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/production/CrewManagementGuide.tsx`** — 1 feil
  - L1105: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/production/LiveSetMode.tsx`** — 2 feil
  - L986: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1471: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/production/LocationAnalysisGuide.tsx`** — 2 feil
  - L839: TS2769: No overload matches this call.
  - L1054: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/production/LocationManagementGuide.tsx`** — 2 feil
  - L947: TS2769: No overload matches this call.
  - L1162: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/production/ScenePoolPanel.tsx`** — 1 feil
  - L124: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/production/ShotListDialogs.tsx`** — 2 feil
  - L224: TS2769: No overload matches this call.
  - L420: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/production/ShotListGuide.tsx`** — 1 feil
  - L847: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/production/StripItem.tsx`** — 2 feil
  - L82: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L148: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/ProductionCalendarPanel.tsx`** — 4 feil
  - L971: TS2769: No overload matches this call.
  - L1003: TS2769: No overload matches this call.
  - L1030: TS2769: No overload matches this call.
  - L1043: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/ProductionDayView.tsx`** — 7 feil
  - L2213: TS2769: No overload matches this call.
  - L3313: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L3377: TS2769: No overload matches this call.
  - L3386: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L3392: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L4740: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L5584: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/ProductionManuscriptView.tsx`** — 10 feil
  - L558: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L559: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L4293: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L4304: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L6520: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L7726: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L8023: TS2769: No overload matches this call.
  - L9305: TS2769: No overload matches this call.
  - L10043: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L10069: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/ProductionToolsPanel.tsx`** — 2 feil
  - L162: TS7006: Parameter '_' implicitly has an 'any' type.
  - L162: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/ProjectAgreementsPanel.tsx`** — 4 feil
  - L1669: TS7006: Parameter 'node' implicitly has an 'any' type.
  - L2157: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L3213: TS7006: Parameter '_' implicitly has an 'any' type.
  - L3213: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/ProjectEconomyHub.tsx`** — 4 feil
  - L2315: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L2565: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2949: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L3533: TS7006: Parameter '_event' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/ProjectMembersDialog.tsx`** — 2 feil
  - L123: TS7006: Parameter '_' implicitly has an 'any' type.
  - L123: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/ProjectTabAccessDialog.tsx`** — 2 feil
  - L166: TS7006: Parameter '_' implicitly has an 'any' type.
  - L166: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/PropManagementPanel.tsx`** — 7 feil
  - L1247: TS2769: No overload matches this call.
  - L1307: TS2769: No overload matches this call.
  - L2110: TS2769: No overload matches this call.
  - L2238: TS2769: No overload matches this call.
  - L2444: TS2769: No overload matches this call.
  - L2643: TS2769: No overload matches this call.
  - L2820: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/RolePoolPanel.tsx`** — 2 feil
  - L469: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L480: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/RoleRoomBillingAccountDialog.tsx`** — 2 feil
  - L449: TS7006: Parameter '_' implicitly has an 'any' type.
  - L449: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/RoleRoomEducationPartnershipPage.tsx`** — 2 feil
  - L76: TS2769: No overload matches this call.
  - L133: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/RoleRoomStoragePanel.tsx`** — 4 feil
  - L404: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L406: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L456: TS7006: Parameter '_' implicitly has an 'any' type.
  - L456: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/screenplay/GrammarCheckPanel.tsx`** — 5 feil
  - L361: TS7006: Parameter '_' implicitly has an 'any' type.
  - L361: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L694: TS7006: Parameter '_' implicitly has an 'any' type.
  - L694: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L700: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/screenplay/GrammarSuggestionsOverlay.tsx`** — 4 feil
  - L356: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L373: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L508: TS2769: No overload matches this call.
  - L515: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/screenplay/storyLogic/components/AutoSaveBadge.tsx`** — 1 feil
  - L127: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/screenplay/storyLogic/components/PhaseHeader.tsx`** — 3 feil
  - L183: TS2769: No overload matches this call.
  - L188: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L192: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/screenplay/StoryLogicPanel.tsx`** — 8 feil
  - L1571: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1571: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
  - L1721: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1918: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1918: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
  - L2187: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2187: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
  - L2406: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/ScreenplayEditor.tsx`** — 4 feil
  - L1531: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1819: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L1869: TS2769: No overload matches this call.
  - L1915: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/ScriptStoryboardSplitView.tsx`** — 1 feil
  - L549: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/selftape/SelfTapePreviewModal.tsx`** — 1 feil
  - L439: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/shared/guide/GuideAnnotationOverlay.tsx`** — 1 feil
  - L590: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/shared/PricingSelector.tsx`** — 4 feil
  - L269: TS7006: Parameter '_' implicitly has an 'any' type.
  - L269: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L387: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L532: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/shared/QrCameraScanner.tsx`** — 1 feil
  - L309: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/shared/RoleRoomBrandMark.tsx`** — 2 feil
  - L27: TS2769: No overload matches this call.
  - L59: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/shared/WarehouseInventoryDialog.tsx`** — 3 feil
  - L655: TS7006: Parameter '_' implicitly has an 'any' type.
  - L655: TS7006: Parameter 'next' implicitly has an 'any' type.
  - L1268: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/split-sheets/ContractEditingInterface.tsx`** — 10 feil
  - L376: TS7006: Parameter '_' implicitly has an 'any' type.
  - L376: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
  - L495: TS7006: Parameter '_' implicitly has an 'any' type.
  - L495: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
  - L599: TS7006: Parameter '_' implicitly has an 'any' type.
  - L599: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
  - L752: TS7006: Parameter '_' implicitly has an 'any' type.
  - L752: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
  - L834: TS7006: Parameter '_' implicitly has an 'any' type.
  - L834: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/StoryStructurePanel.tsx`** — 4 feil
  - L246: TS7006: Parameter '_' implicitly has an 'any' type.
  - L246: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L683: TS7006: Parameter '_' implicitly has an 'any' type.
  - L683: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/TableReadPanel.tsx`** — 6 feil
  - L427: TS7006: Parameter '_' implicitly has an 'any' type.
  - L427: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L433: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L440: TS7006: Parameter '_' implicitly has an 'any' type.
  - L440: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L446: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/TalentPortalView.tsx`** — 5 feil
  - L990: TS2769: No overload matches this call.
  - L1121: TS2769: No overload matches this call.
  - L1144: TS2769: No overload matches this call.
  - L1322: TS2769: No overload matches this call.
  - L1345: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/components/TeamDashboard.tsx`** — 1 feil
  - L1304: TS7006: Parameter '_' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/components/TimelineView.tsx`** — 2 feil
  - L321: TS7006: Parameter '_' implicitly has an 'any' type.
  - L321: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/dance/AddonsPanel.tsx`** — 1 feil
  - L135: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/dance/AdminOpsPanels.tsx`** — 1 feil
  - L180: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/dance/AnnotateCategoryDialog.tsx`** — 1 feil
  - L171: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/dance/AnnotateCategoryToolsPanel.tsx`** — 2 feil
  - L130: TS2769: No overload matches this call.
  - L162: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/dance/AnnotateCommonLabelsPanel.tsx`** — 2 feil
  - L176: TS2769: No overload matches this call.
  - L199: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/dance/AnnotationTimeline.tsx`** — 2 feil
  - L211: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L291: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/dance/BillingPanels.tsx`** — 1 feil
  - L686: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/dance/ChoreographyBuilder.tsx`** — 4 feil
  - L490: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L537: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L928: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1240: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/dance/ClipsSidebar.tsx`** — 2 feil
  - L403: TS2769: No overload matches this call.
  - L450: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/dance/DanceAnnotateLayout.tsx`** — 3 feil
  - L160: TS2769: No overload matches this call.
  - L246: TS2769: No overload matches this call.
  - L415: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/dance/DanceAnnotateView.tsx`** — 1 feil
  - L448: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/dance/DanceFlowNavRail.tsx`** — 2 feil
  - L126: TS2769: No overload matches this call.
  - L184: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/dance/DanceProductionCalendar.tsx`** — 6 feil
  - L421: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L800: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L806: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L807: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L863: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L864: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/dance/DanceProjectCalendar.tsx`** — 1 feil
  - L268: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/dance/DanceProjectSwitcherDialog.tsx`** — 1 feil
  - L191: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/dance/DancerInjuryLogPanel.tsx`** — 3 feil
  - L304: TS7006: Parameter '_' implicitly has an 'any' type.
  - L567: TS7006: Parameter '_' implicitly has an 'any' type.
  - L567: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/dance/DanceWorkspace.tsx`** — 5 feil
  - L892: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L915: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L981: TS2769: No overload matches this call.
  - L1012: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1012: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/dance/FormationHeaderBar.tsx`** — 1 feil
  - L246: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/dance/FormationTimeline.tsx`** — 5 feil
  - L192: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L218: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L234: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L278: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L284: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/dance/FormationView.tsx`** — 2 feil
  - L851: TS2769: No overload matches this call.
  - L1778: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/dance/MyTeamsHeader.tsx`** — 1 feil
  - L66: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/dance/TeamAdminPanel.tsx`** — 1 feil
  - L424: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/dance/VideoLibrary.tsx`** — 1 feil
  - L374: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/dance/VideoRefPlayer.tsx`** — 1 feil
  - L133: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/dance/VideoReviewRoom.tsx`** — 4 feil
  - L569: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L594: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L736: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L967: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/education/AssignmentsTab.tsx`** — 1 feil
  - L167: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/education/DeepLinkPicker.tsx`** — 2 feil
  - L267: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L300: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/education/LmsRosterPanel.tsx`** — 1 feil
  - L94: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/live-set/CameraControlsPanel.tsx`** — 3 feil
  - L66: TS2769: No overload matches this call.
  - L69: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L325: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/live-set/CameraDetailDrawer.tsx`** — 2 feil
  - L177: TS7006: Parameter '_' implicitly has an 'any' type.
  - L177: TS7006: Parameter 'isOpen' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/live-set/CameraPairingDialog.tsx`** — 2 feil
  - L655: TS7006: Parameter '_' implicitly has an 'any' type.
  - L655: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/live-set/ProgramAndMulticam.tsx`** — 1 feil
  - L307: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/live-set/SceneInfoColumn.tsx`** — 2 feil
  - L112: TS7006: Parameter '_' implicitly has an 'any' type.
  - L112: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/live-set/TakesColumn.tsx`** — 2 feil
  - L173: TS7006: Parameter '_' implicitly has an 'any' type.
  - L173: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/marketing-templates/MarketingFeedPoster.tsx`** — 2 feil
  - L319: TS2769: No overload matches this call.
  - L435: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/services/shotPlanner/AnnotationLayer.tsx`** — 4 feil
  - L350: TS7006: Parameter '_' implicitly has an 'any' type.
  - L350: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L365: TS7006: Parameter '_' implicitly has an 'any' type.
  - L365: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/services/shotPlanner/CameraSettingsPanel.tsx`** — 2 feil
  - L326: TS7006: Parameter '_e' implicitly has an 'any' type.
  - L326: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/services/shotPlanner/GuidesPanel.tsx`** — 4 feil
  - L148: TS7006: Parameter '_' implicitly has an 'any' type.
  - L148: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L184: TS7006: Parameter '_' implicitly has an 'any' type.
  - L184: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/services/shotPlanner/ShotListSidebar.tsx`** — 3 feil
  - L96: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L113: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L350: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/services/shotPlanner/ShotPlannerPanel.tsx`** — 1 feil
  - L769: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/shared/FirstTimeTour.tsx`** — 2 feil
  - L151: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L166: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/shared/HelpButton.tsx`** — 3 feil
  - L226: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L310: TS2769: No overload matches this call.
  - L348: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/shared/ProfessionModeChip.tsx`** — 1 feil
  - L96: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/talents-app/components/MediaUploader.tsx`** — 3 feil
  - L180: TS2769: No overload matches this call.
  - L210: TS2769: No overload matches this call.
  - L226: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/talents-app/components/ProposeNewTalentDialog.tsx`** — 1 feil
  - L262: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/talents-app/components/ProposeTalentsDialog.tsx`** — 3 feil
  - L246: TS7006: Parameter '_' implicitly has an 'any' type.
  - L246: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L389: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/talents-app/components/selftape/dialogs/ProjectLibraryDrawer.tsx`** — 1 feil
  - L116: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/talents-app/components/selftape/dialogs/ScriptViewerDialog.tsx`** — 1 feil
  - L85: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/talents-app/components/selftape/SelfTapeAIFeedbackCard.tsx`** — 2 feil
  - L118: TS2769: No overload matches this call.
  - L179: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/talents-app/components/selftape/SelfTapeAlmostReadyCard.tsx`** — 1 feil
  - L62: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/talents-app/components/selftape/SelfTapePreviousTakesStrip.tsx`** — 1 feil
  - L106: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/talents-app/components/selftape/SelfTapeSubmissionTargets.tsx`** — 1 feil
  - L135: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/talents-app/components/selftape/SelfTapeVideoPlayer.tsx`** — 4 feil
  - L304: TS2769: No overload matches this call.
  - L331: TS2769: No overload matches this call.
  - L356: TS2769: No overload matches this call.
  - L380: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/talents-app/pages/AgencyPartnershipsPage.tsx`** — 3 feil
  - L283: TS7006: Parameter '_' implicitly has an 'any' type.
  - L283: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L986: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/talents-app/pages/PartnersCollaborationPage.tsx`** — 3 feil
  - L334: TS7006: Parameter '_' implicitly has an 'any' type.
  - L334: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L783: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/talents-app/pages/ProfilePage.tsx`** — 1 feil
  - L360: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/talents-app/pages/SettingsPage.tsx`** — 2 feil
  - L154: TS2769: No overload matches this call.
  - L154: TS2769: No overload matches this call.
- **`frontend/client/src/components/role-room/talents-app/pages/TalentRegistryPage.tsx`** — 2 feil
  - L694: TS2769: No overload matches this call.
  - L768: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/role-room/talents-app/TalentsLogo.tsx`** — 2 feil
  - L36: TS2769: No overload matches this call.
  - L76: TS2769: No overload matches this call.

### `client/src/components/royalties`

- **`frontend/client/src/components/royalties/RoyaltiesManagementDashboard.tsx`** — 2 feil
  - L395: TS7006: Parameter '_' implicitly has an 'any' type.
  - L395: TS7006: Parameter 'value' implicitly has an 'any' type.

### `client/src/components/scroll-story`

- **`frontend/client/src/components/scroll-story/GoogleDriveMediaPicker.tsx`** — 3 feil
  - L353: TS7006: Parameter '_' implicitly has an 'any' type.
  - L353: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L423: TS2769: No overload matches this call.
- **`frontend/client/src/components/scroll-story/ScrollStory.enhanced.tsx`** — 5 feil
  - L376: TS2769: No overload matches this call.
  - L389: TS2769: No overload matches this call.
  - L411: TS2769: No overload matches this call.
  - L449: TS2769: No overload matches this call.
  - L469: TS2769: No overload matches this call.
- **`frontend/client/src/components/scroll-story/ScrollStorySettingsPanel.tsx`** — 2 feil
  - L633: TS7006: Parameter '_' implicitly has an 'any' type.
  - L633: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/scroll-story/ScrollStorySVGGraphic.tsx`** — 1 feil
  - L131: TS2769: No overload matches this call.

### `client/src/components/seo-specialist`

- **`frontend/client/src/components/seo-specialist/SEOSpecialistDashboard.tsx`** — 2 feil
  - L533: TS7006: Parameter '_' implicitly has an 'any' type.
  - L533: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/seo-specialist/SEOSpecialistDashboardIntegrated.tsx`** — 1 feil
  - L348: TS7006: Parameter '_event' implicitly has an 'any' type.

### `client/src/components/shared`

- **`frontend/client/src/components/shared/ProjectCreationModal.tsx`** — 1 feil
  - L268: TS2769: No overload matches this call.

### `client/src/components/showcase`

- **`frontend/client/src/components/showcase/CaptureSessionsPanel.tsx`** — 1 feil
  - L328: TS2769: No overload matches this call.
- **`frontend/client/src/components/showcase/ClientReviewForm.tsx`** — 2 feil
  - L75: TS7006: Parameter '_' implicitly has an 'any' type.
  - L75: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/showcase/ComprehensiveShowcaseAdmin.tsx`** — 15 feil
  - L704: TS7006: Parameter '_' implicitly has an 'any' type.
  - L704: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L716: TS7006: Parameter '_' implicitly has an 'any' type.
  - L716: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L728: TS7006: Parameter '_' implicitly has an 'any' type.
  - L728: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L1030: TS7006: Parameter 'color' implicitly has an 'any' type.
  - L1060: TS7006: Parameter 'color' implicitly has an 'any' type.
  - L1070: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1070: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L1151: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1151: TS7006: Parameter 'value' implicitly has an 'any' type.
  - _… og 3 til._
- **`frontend/client/src/components/showcase/GalleryVersionsTimelineDialog.tsx`** — 2 feil
  - L537: TS7006: Parameter '_' implicitly has an 'any' type.
  - L537: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/showcase/ShowcaseAdmin.tsx`** — 21 feil
  - L1862: TS2769: No overload matches this call.
  - L2076: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2076: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L2091: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2091: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L2207: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2207: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L2602: TS2769: No overload matches this call.
  - L2797: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2797: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L3214: TS2769: No overload matches this call.
  - L3958: TS7006: Parameter '_' implicitly has an 'any' type.
  - _… og 9 til._
- **`frontend/client/src/components/showcase/VideoThumbnailSelector.tsx`** — 3 feil
  - L324: TS7006: Parameter '_' implicitly has an 'any' type.
  - L324: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L384: TS2769: No overload matches this call.

### `client/src/components/story-arc-studio`

- **`frontend/client/src/components/story-arc-studio/sections/StoryArcSyncDialog.tsx`** — 1 feil
  - L379: TS7006: Parameter 'value' implicitly has an 'any' type.

### `client/src/components/StoryArcGenerator.tsx`

- **`frontend/client/src/components/StoryArcGenerator.tsx`** — 4 feil
  - L416: TS7006: Parameter '_' implicitly has an 'any' type.
  - L416: TS7006: Parameter 'newValue' implicitly has an 'any' type.
  - L596: TS7006: Parameter '_' implicitly has an 'any' type.
  - L596: TS7006: Parameter 'value' implicitly has an 'any' type.

### `client/src/components/StoryArcStudio.tsx`

- **`frontend/client/src/components/StoryArcStudio.tsx`** — 4 feil
  - L12925: TS2769: No overload matches this call.
  - L13451: TS7006: Parameter 'theme' implicitly has an 'any' type.
  - L13708: TS7006: Parameter 'theme' implicitly has an 'any' type.
  - L14796: TS2769: No overload matches this call.

### `client/src/components/timeline`

- **`frontend/client/src/components/timeline/BackgroundRemovalPanel.tsx`** — 4 feil
  - L172: TS7006: Parameter '_' implicitly has an 'any' type.
  - L172: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L195: TS7006: Parameter '_' implicitly has an 'any' type.
  - L195: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/timeline/ColorGradingPanel.tsx`** — 12 feil
  - L114: TS7006: Parameter '_' implicitly has an 'any' type.
  - L114: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L171: TS7006: Parameter '_' implicitly has an 'any' type.
  - L171: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L185: TS7006: Parameter '_' implicitly has an 'any' type.
  - L185: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L197: TS7006: Parameter '_' implicitly has an 'any' type.
  - L197: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L209: TS7006: Parameter '_' implicitly has an 'any' type.
  - L209: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L221: TS7006: Parameter '_' implicitly has an 'any' type.
  - L221: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/timeline/GPUFiltersPanel.tsx`** — 10 feil
  - L118: TS7006: Parameter '_' implicitly has an 'any' type.
  - L118: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L134: TS7006: Parameter '_' implicitly has an 'any' type.
  - L134: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L151: TS7006: Parameter '_' implicitly has an 'any' type.
  - L151: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L168: TS7006: Parameter '_' implicitly has an 'any' type.
  - L168: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L185: TS7006: Parameter '_' implicitly has an 'any' type.
  - L185: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/timeline/LUTLibrary.tsx`** — 2 feil
  - L87: TS7006: Parameter '_' implicitly has an 'any' type.
  - L87: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/timeline/SpeedRampPanel.tsx`** — 8 feil
  - L142: TS7006: Parameter '_' implicitly has an 'any' type.
  - L142: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L231: TS7006: Parameter '_' implicitly has an 'any' type.
  - L231: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L242: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L335: TS7006: Parameter '_' implicitly has an 'any' type.
  - L335: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L340: TS7006: Parameter 'v' implicitly has an 'any' type.

### `client/src/components/tools`

- **`frontend/client/src/components/tools/KeyboardShortcutsToolsNew.tsx`** — 12 feil
  - L2353: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2353: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
  - L2496: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2496: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
  - L2726: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2726: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
  - L3557: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L3557: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
  - L4082: TS2769: No overload matches this call.
  - L4122: TS2769: No overload matches this call.
  - L4203: TS2769: No overload matches this call.
  - L4243: TS2769: No overload matches this call.

### `client/src/components/TwoFactorSetup.tsx`

- **`frontend/client/src/components/TwoFactorSetup.tsx`** — 1 feil
  - L193: TS2769: No overload matches this call.

### `client/src/components/ui`

- **`frontend/client/src/components/ui/alert-dialog.tsx`** — 2 feil
  - L138: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L154: TS7006: Parameter 'event' implicitly has an 'any' type.
- **`frontend/client/src/components/ui/responsive-design.tsx`** — 1 feil
  - L302: TS2769: No overload matches this call.
- **`frontend/client/src/components/ui/tabs.tsx`** — 1 feil
  - L60: TS7006: Parameter '_event' implicitly has an 'any' type.

### `client/src/components/universal-communication`

- **`frontend/client/src/components/universal-communication/QuickCommunicationWidget.tsx`** — 1 feil
  - L202: TS7006: Parameter 'event' implicitly has an 'any' type.

### `client/src/components/universal`

- **`frontend/client/src/components/universal/admin/comprehensive-admin-dashboard.tsx`** — 1 feil
  - L142: TS7006: Parameter '_' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/AdministrationHub.tsx`** — 2 feil
  - L185: TS7006: Parameter '_event' implicitly has an 'any' type.
  - L185: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/editing-marketplace/EditingJobReviewDialog.tsx`** — 2 feil
  - L99: TS7006: Parameter '_' implicitly has an 'any' type.
  - L99: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/editing-marketplace/EditingVendorWorkspace.tsx`** — 3 feil
  - L542: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L833: TS7006: Parameter '_' implicitly has an 'any' type.
  - L833: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/editing-marketplace/PartnerApplicationForm.tsx`** — 4 feil
  - L327: TS2769: No overload matches this call.
  - L376: TS2769: No overload matches this call.
  - L377: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L458: TS2769: No overload matches this call.
- **`frontend/client/src/components/universal/editing-marketplace/PartnerLanding.tsx`** — 1 feil
  - L138: TS2769: No overload matches this call.
- **`frontend/client/src/components/universal/editing-marketplace/PartnerProgramDashboard.tsx`** — 1 feil
  - L293: TS2769: No overload matches this call.
- **`frontend/client/src/components/universal/editing-marketplace/PartnerTerms.tsx`** — 1 feil
  - L103: TS2769: No overload matches this call.
- **`frontend/client/src/components/universal/editing-marketplace/VendorPrototypeFeedbackTool.tsx`** — 2 feil
  - L153: TS7006: Parameter '_' implicitly has an 'any' type.
  - L153: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/forms/songflow-platform.tsx`** — 2 feil
  - L467: TS7006: Parameter '_' implicitly has an 'any' type.
  - L467: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/misc/CreatorHubPhotoEnhancer.tsx`** — 14 feil
  - L1712: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L1992: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1992: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L2070: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2070: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L2176: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2176: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L2241: TS7006: Parameter '_' implicitly has an 'any' type.
  - L2241: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L2687: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2719: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L2744: TS7006: Parameter 'event' implicitly has an 'any' type.
  - _… og 2 til._
- **`frontend/client/src/components/universal/misc/FloatingActionButtons.tsx`** — 2 feil
  - L477: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L597: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/misc/TemplatePreviewCard.tsx`** — 7 feil
  - L177: TS2769: No overload matches this call.
  - L196: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L226: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L307: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L320: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L335: TS7006: Parameter 'event' implicitly has an 'any' type.
  - L360: TS2769: No overload matches this call.
- **`frontend/client/src/components/universal/shared/RelatedItemsWidget.tsx`** — 2 feil
  - L147: TS7006: Parameter '_' implicitly has an 'any' type.
  - L147: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/shared/StorageUsageBanner.tsx`** — 3 feil
  - L182: TS7006: Parameter 'theme' implicitly has an 'any' type.
  - L219: TS7006: Parameter 'theme' implicitly has an 'any' type.
  - L221: TS7006: Parameter 'theme' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/showcase/ClientActivityPanel.tsx`** — 3 feil
  - L903: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1133: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1423: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/showcase/ContextualActionBar.tsx`** — 1 feil
  - L357: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/showcase/DragDropCollections.tsx`** — 4 feil
  - L378: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L380: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L508: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L531: TS2769: No overload matches this call.
- **`frontend/client/src/components/universal/showcase/SmartCollections.tsx`** — 3 feil
  - L494: TS2769: No overload matches this call.
  - L517: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L623: TS2769: No overload matches this call.
- **`frontend/client/src/components/universal/showcase/SpotifyArtistField.tsx`** — 1 feil
  - L75: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/showcase/TimelineView.tsx`** — 8 feil
  - L294: TS7006: Parameter '_' implicitly has an 'any' type.
  - L294: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L443: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L445: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L466: TS2769: No overload matches this call.
  - L525: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L527: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L545: TS2769: No overload matches this call.
- **`frontend/client/src/components/universal/showcase/WarmupDialog.tsx`** — 2 feil
  - L153: TS2769: No overload matches this call.
  - L260: TS2769: No overload matches this call.
- **`frontend/client/src/components/universal/showcase/WarmupPlayer.tsx`** — 2 feil
  - L136: TS2769: No overload matches this call.
  - L186: TS2769: No overload matches this call.
- **`frontend/client/src/components/universal/showcase/WaveformView.tsx`** — 4 feil
  - L608: TS7006: Parameter '_' implicitly has an 'any' type.
  - L608: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L675: TS7006: Parameter '_' implicitly has an 'any' type.
  - L675: TS7006: Parameter 'value' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/showcase/YouTubePublishPanel.tsx`** — 1 feil
  - L80: TS2769: No overload matches this call.
- **`frontend/client/src/components/universal/ShowcaseCard.tsx`** — 6 feil
  - L279: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L309: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L361: TS2769: No overload matches this call.
  - L404: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L426: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L521: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/split-sheets/SplitSheetLegalSuggestions.tsx`** — 2 feil
  - L164: TS7006: Parameter '_' implicitly has an 'any' type.
  - L164: TS7006: Parameter 'isExpanded' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/split-sheets/SplitSheetManager.tsx`** — 4 feil
  - L669: TS7006: Parameter '_' implicitly has an 'any' type.
  - L669: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L829: TS7006: Parameter '_' implicitly has an 'any' type.
  - L829: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/split-sheets/SplitSheetTemplates.tsx`** — 2 feil
  - L286: TS7006: Parameter '_' implicitly has an 'any' type.
  - L286: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/split-sheets/SplitSheetViewer.tsx`** — 2 feil
  - L425: TS7006: Parameter '_' implicitly has an 'any' type.
  - L425: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/UnifiedFileManagerWidget.tsx`** — 2 feil
  - L362: TS7006: Parameter '_' implicitly has an 'any' type.
  - L362: TS7006: Parameter 'newValue' implicitly has an 'any' type.
- **`frontend/client/src/components/universal/UniversalDashboard-Mobile.tsx`** — 1 feil
  - L520: TS7006: Parameter '_' implicitly has an 'any' type.

### `client/src/components/vendor`

- **`frontend/client/src/components/vendor/NorthtoneVendorDashboard.tsx`** — 1 feil
  - L796: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/vendor/VendorDeliveryManager.tsx`** — 1 feil
  - L368: TS2769: No overload matches this call.
- **`frontend/client/src/components/vendor/VendorFinancialDashboard.tsx`** — 3 feil
  - L149: TS2769: No overload matches this call.
  - L304: TS7006: Parameter '_' implicitly has an 'any' type.
  - L304: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/vendor/VendorInsightsWidget.tsx`** — 1 feil
  - L247: TS2769: No overload matches this call.
- **`frontend/client/src/components/vendor/VendorInspirationManager.tsx`** — 7 feil
  - L304: TS7006: Parameter '_' implicitly has an 'any' type.
  - L304: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L348: TS2769: No overload matches this call.
  - L576: TS2769: No overload matches this call.
  - L593: TS2769: No overload matches this call.
  - L606: TS2769: No overload matches this call.
  - L619: TS2769: No overload matches this call.
- **`frontend/client/src/components/vendor/VendorInventoryManager.tsx`** — 4 feil
  - L1039: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1069: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1820: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1820: TS7006: Parameter 'v' implicitly has an 'any' type.
- **`frontend/client/src/components/vendor/VendorMessaging.tsx`** — 1 feil
  - L101: TS2769: No overload matches this call.
- **`frontend/client/src/components/vendor/VendorQuickStats.tsx`** — 3 feil
  - L236: TS2769: No overload matches this call.
  - L352: TS2769: No overload matches this call.
  - L360: TS2769: No overload matches this call.
- **`frontend/client/src/components/vendor/VendorTasksWidget.tsx`** — 2 feil
  - L336: TS2769: No overload matches this call.
  - L503: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/components/vendor/VendorTypeManager.tsx`** — 2 feil
  - L543: TS2769: No overload matches this call.
  - L563: TS2769: No overload matches this call.

### `client/src/components/video`

- **`frontend/client/src/components/video/AIVideoAnalysisPanel.tsx`** — 2 feil
  - L221: TS7006: Parameter '_' implicitly has an 'any' type.
  - L221: TS7006: Parameter 'val' implicitly has an 'any' type.

### `client/src/components/virtual-studio`

- **`frontend/client/src/components/virtual-studio/RateClonedProjectDialog.tsx`** — 8 feil
  - L157: TS7006: Parameter '_' implicitly has an 'any' type.
  - L157: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L180: TS7006: Parameter '_' implicitly has an 'any' type.
  - L180: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L195: TS7006: Parameter '_' implicitly has an 'any' type.
  - L195: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L210: TS7006: Parameter '_' implicitly has an 'any' type.
  - L210: TS7006: Parameter 'value' implicitly has an 'any' type.

### `client/src/components/website-builder`

- **`frontend/client/src/components/website-builder/WebsiteBuilder.tsx`** — 1 feil
  - L489: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/components/wedding-timeline-client-view.tsx`

- **`frontend/client/src/components/wedding-timeline-client-view.tsx`** — 1 feil
  - L457: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/components/wiremock`

- **`frontend/client/src/components/wiremock/WireMockController.tsx`** — 2 feil
  - L266: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L266: TS7006: Parameter 'newValue' implicitly has an 'any' type.

### `client/src/components/worklog`

- **`frontend/client/src/components/worklog/WorklogContextShortcuts.tsx`** — 1 feil
  - L423: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/pages/about.tsx`

- **`frontend/client/src/pages/about.tsx`** — 5 feil
  - L412: TS2769: No overload matches this call.
  - L684: TS2769: No overload matches this call.
  - L690: TS2769: No overload matches this call.
  - L696: TS2769: No overload matches this call.
  - L702: TS2769: No overload matches this call.

### `client/src/pages/admin-invite-system.tsx`

- **`frontend/client/src/pages/admin-invite-system.tsx`** — 2 feil
  - L472: TS7006: Parameter '_' implicitly has an 'any' type.
  - L472: TS7006: Parameter 'newValue' implicitly has an 'any' type.

### `client/src/pages/admin-room`

- **`frontend/client/src/pages/admin-room/AgencyAcquisitionDashboard.tsx`** — 2 feil
  - L473: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L514: TS2769: No overload matches this call.
- **`frontend/client/src/pages/admin-room/B2BAcquisitionPanel.tsx`** — 2 feil
  - L57: TS2769: No overload matches this call.
  - L287: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/pages/admin-room/CompetitorReportPanel.tsx`** — 4 feil
  - L151: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L335: TS2769: No overload matches this call.
  - L344: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L397: TS2769: No overload matches this call.
- **`frontend/client/src/pages/admin-room/ContentCalendarTab.tsx`** — 1 feil
  - L107: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/pages/admin-room/LeadMapMyDayPanel.tsx`** — 5 feil
  - L396: TS2769: No overload matches this call.
  - L543: TS2769: No overload matches this call.
  - L552: TS2769: No overload matches this call.
  - L560: TS2769: No overload matches this call.
  - L568: TS2769: No overload matches this call.
- **`frontend/client/src/pages/admin-room/LeadMapNotificationBell.tsx`** — 1 feil
  - L153: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/pages/admin-room/LeadMapPanel.tsx`** — 17 feil
  - L1968: TS7006: Parameter '_' implicitly has an 'any' type.
  - L1968: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L2210: TS2769: No overload matches this call.
  - L2219: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2538: TS2769: No overload matches this call.
  - L2562: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L2860: TS2769: No overload matches this call.
  - L3222: TS2769: No overload matches this call.
  - L3239: TS2769: No overload matches this call.
  - L3256: TS2769: No overload matches this call.
  - L3275: TS2769: No overload matches this call.
  - L4938: TS7006: Parameter 'e' implicitly has an 'any' type.
  - _… og 5 til._
- **`frontend/client/src/pages/admin-room/LeadMapViewAsBanner.tsx`** — 1 feil
  - L141: TS7006: Parameter 'e' implicitly has an 'any' type.
- **`frontend/client/src/pages/admin-room/LeadsGrowthTab.tsx`** — 1 feil
  - L39: TS7006: Parameter '_e' implicitly has an 'any' type.
- **`frontend/client/src/pages/admin-room/MarketingCockpitTab.tsx`** — 1 feil
  - L453: TS7006: Parameter '_e' implicitly has an 'any' type.

### `client/src/pages/AdminRoom.tsx`

- **`frontend/client/src/pages/AdminRoom.tsx`** — 5 feil
  - L802: TS2769: No overload matches this call.
  - L922: TS2769: No overload matches this call.
  - L1017: TS2769: No overload matches this call.
  - L3654: TS7006: Parameter '_e' implicitly has an 'any' type.
  - L4665: TS7006: Parameter '_event' implicitly has an 'any' type.

### `client/src/pages/AdminWorkspace.tsx`

- **`frontend/client/src/pages/AdminWorkspace.tsx`** — 2 feil
  - L344: TS7006: Parameter '_e' implicitly has an 'any' type.
  - L975: TS2769: No overload matches this call.

### `client/src/pages/agency-faq.tsx`

- **`frontend/client/src/pages/agency-faq.tsx`** — 1 feil
  - L287: TS2769: No overload matches this call.

### `client/src/pages/agency-landing.tsx`

- **`frontend/client/src/pages/agency-landing.tsx`** — 5 feil
  - L207: TS2769: No overload matches this call.
  - L208: TS2769: No overload matches this call.
  - L613: TS2769: No overload matches this call.
  - L1299: TS2769: No overload matches this call.
  - L1609: TS2769: No overload matches this call.

### `client/src/pages/audio-review-shared.tsx`

- **`frontend/client/src/pages/audio-review-shared.tsx`** — 1 feil
  - L189: TS2769: No overload matches this call.

### `client/src/pages/audio-showcase.tsx`

- **`frontend/client/src/pages/audio-showcase.tsx`** — 11 feil
  - L378: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L442: TS2769: No overload matches this call.
  - L542: TS7006: Parameter '_' implicitly has an 'any' type.
  - L542: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L644: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L915: TS7006: Parameter '_' implicitly has an 'any' type.
  - L915: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L1066: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L1297: TS2769: No overload matches this call.
  - L1323: TS2769: No overload matches this call.
  - L1347: TS2769: No overload matches this call.

### `client/src/pages/blog-index.tsx`

- **`frontend/client/src/pages/blog-index.tsx`** — 1 feil
  - L304: TS2769: No overload matches this call.

### `client/src/pages/blog-post.tsx`

- **`frontend/client/src/pages/blog-post.tsx`** — 5 feil
  - L236: TS2769: No overload matches this call.
  - L285: TS2769: No overload matches this call.
  - L302: TS2769: No overload matches this call.
  - L392: TS2769: No overload matches this call.
  - L423: TS2769: No overload matches this call.

### `client/src/pages/chat-actions-guide.tsx`

- **`frontend/client/src/pages/chat-actions-guide.tsx`** — 3 feil
  - L24: TS2769: No overload matches this call.
  - L53: TS2769: No overload matches this call.
  - L136: TS2769: No overload matches this call.

### `client/src/pages/chat-guide.tsx`

- **`frontend/client/src/pages/chat-guide.tsx`** — 3 feil
  - L24: TS2769: No overload matches this call.
  - L53: TS2769: No overload matches this call.
  - L144: TS2769: No overload matches this call.

### `client/src/pages/client-gallery.tsx`

- **`frontend/client/src/pages/client-gallery.tsx`** — 3 feil
  - L944: TS2769: No overload matches this call.
  - L1512: TS2769: No overload matches this call.
  - L1819: TS2769: No overload matches this call.

### `client/src/pages/client-portal-marketing.tsx`

- **`frontend/client/src/pages/client-portal-marketing.tsx`** — 1 feil
  - L1368: TS2769: No overload matches this call.

### `client/src/pages/CullingReview.tsx`

- **`frontend/client/src/pages/CullingReview.tsx`** — 2 feil
  - L270: TS2769: No overload matches this call.
  - L340: TS2769: No overload matches this call.

### `client/src/pages/leadgrid-akademi.tsx`

- **`frontend/client/src/pages/leadgrid-akademi.tsx`** — 1 feil
  - L87: TS2769: No overload matches this call.

### `client/src/pages/leadgrid-client-portal.tsx`

- **`frontend/client/src/pages/leadgrid-client-portal.tsx`** — 5 feil
  - L212: TS2769: No overload matches this call.
  - L239: TS2769: No overload matches this call.
  - L266: TS2769: No overload matches this call.
  - L570: TS2769: No overload matches this call.
  - L578: TS2769: No overload matches this call.

### `client/src/pages/leadgrid-deals.tsx`

- **`frontend/client/src/pages/leadgrid-deals.tsx`** — 4 feil
  - L422: TS7006: Parameter '_' implicitly has an 'any' type.
  - L422: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L423: TS7006: Parameter '_' implicitly has an 'any' type.
  - L423: TS7006: Parameter 'v' implicitly has an 'any' type.

### `client/src/pages/leadgrid-feltsalg-salgsteam.tsx`

- **`frontend/client/src/pages/leadgrid-feltsalg-salgsteam.tsx`** — 2 feil
  - L181: TS2769: No overload matches this call.
  - L197: TS2769: No overload matches this call.

### `client/src/pages/leadgrid-import.tsx`

- **`frontend/client/src/pages/leadgrid-import.tsx`** — 4 feil
  - L134: TS7006: Parameter '_' implicitly has an 'any' type.
  - L134: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L773: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L775: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/pages/leadgrid-landing.tsx`

- **`frontend/client/src/pages/leadgrid-landing.tsx`** — 9 feil
  - L350: TS2769: No overload matches this call.
  - L375: TS2769: No overload matches this call.
  - L892: TS2769: No overload matches this call.
  - L904: TS2769: No overload matches this call.
  - L918: TS2769: No overload matches this call.
  - L987: TS2769: No overload matches this call.
  - L1000: TS2769: No overload matches this call.
  - L1739: TS2769: No overload matches this call.
  - L1807: TS2769: No overload matches this call.

### `client/src/pages/leadgrid-marketplace.tsx`

- **`frontend/client/src/pages/leadgrid-marketplace.tsx`** — 3 feil
  - L102: TS2769: No overload matches this call.
  - L164: TS2769: No overload matches this call.
  - L193: TS2769: No overload matches this call.

### `client/src/pages/leadgrid-personvern.tsx`

- **`frontend/client/src/pages/leadgrid-personvern.tsx`** — 3 feil
  - L243: TS2769: No overload matches this call.
  - L253: TS2769: No overload matches this call.
  - L325: TS2769: No overload matches this call.

### `client/src/pages/leadgrid-pricing.tsx`

- **`frontend/client/src/pages/leadgrid-pricing.tsx`** — 3 feil
  - L390: TS7006: Parameter '_' implicitly has an 'any' type.
  - L390: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L679: TS2769: No overload matches this call.

### `client/src/pages/leadgrid-research-consent.tsx`

- **`frontend/client/src/pages/leadgrid-research-consent.tsx`** — 1 feil
  - L105: TS2769: No overload matches this call.

### `client/src/pages/leadgrid-skaffe-leads-guide.tsx`

- **`frontend/client/src/pages/leadgrid-skaffe-leads-guide.tsx`** — 2 feil
  - L172: TS2769: No overload matches this call.
  - L188: TS2769: No overload matches this call.

### `client/src/pages/leadgrid-superadmin.tsx`

- **`frontend/client/src/pages/leadgrid-superadmin.tsx`** — 3 feil
  - L240: TS7006: Parameter '_' implicitly has an 'any' type.
  - L240: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L400: TS2769: No overload matches this call.

### `client/src/pages/leadgrid-workflows.tsx`

- **`frontend/client/src/pages/leadgrid-workflows.tsx`** — 2 feil
  - L223: TS7006: Parameter '_' implicitly has an 'any' type.
  - L223: TS7006: Parameter 'v' implicitly has an 'any' type.

### `client/src/pages/nextrole-landing.tsx`

- **`frontend/client/src/pages/nextrole-landing.tsx`** — 3 feil
  - L807: TS2769: No overload matches this call.
  - L1033: TS2769: No overload matches this call.
  - L1036: TS2769: No overload matches this call.

### `client/src/pages/photographer-client-detail.tsx`

- **`frontend/client/src/pages/photographer-client-detail.tsx`** — 2 feil
  - L283: TS7006: Parameter '_' implicitly has an 'any' type.
  - L283: TS7006: Parameter 'v' implicitly has an 'any' type.

### `client/src/pages/photographer-equipment.tsx`

- **`frontend/client/src/pages/photographer-equipment.tsx`** — 5 feil
  - L236: TS2769: No overload matches this call.
  - L241: TS7006: Parameter 'ev' implicitly has an 'any' type.
  - L387: TS2769: No overload matches this call.
  - L392: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L412: TS2769: No overload matches this call.

### `client/src/pages/photographer-gallery-detail.tsx`

- **`frontend/client/src/pages/photographer-gallery-detail.tsx`** — 5 feil
  - L444: TS7006: Parameter '_' implicitly has an 'any' type.
  - L444: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L519: TS2769: No overload matches this call.
  - L570: TS2769: No overload matches this call.
  - L843: TS2769: No overload matches this call.

### `client/src/pages/photographer-project-detail.tsx`

- **`frontend/client/src/pages/photographer-project-detail.tsx`** — 1 feil
  - L643: TS7006: Parameter 'theme' implicitly has an 'any' type.

### `client/src/pages/photographer-wedding-day.tsx`

- **`frontend/client/src/pages/photographer-wedding-day.tsx`** — 1 feil
  - L450: TS7006: Parameter 'theme' implicitly has an 'any' type.

### `client/src/pages/pitch-deck.tsx`

- **`frontend/client/src/pages/pitch-deck.tsx`** — 2 feil
  - L151: TS7006: Parameter 'e' implicitly has an 'any' type.
  - L266: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/pages/portal.tsx`

- **`frontend/client/src/pages/portal.tsx`** — 2 feil
  - L102: TS2769: No overload matches this call.
  - L102: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/pages/PricingPage.tsx`

- **`frontend/client/src/pages/PricingPage.tsx`** — 9 feil
  - L272: TS7006: Parameter '_' implicitly has an 'any' type.
  - L272: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L274: TS7006: Parameter 'v' implicitly has an 'any' type.
  - L508: TS7006: Parameter '_' implicitly has an 'any' type.
  - L508: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L523: TS7006: Parameter '_' implicitly has an 'any' type.
  - L523: TS7006: Parameter 'value' implicitly has an 'any' type.
  - L671: TS7006: Parameter '_' implicitly has an 'any' type.
  - L671: TS7006: Parameter 'newValue' implicitly has an 'any' type.

### `client/src/pages/theroleroom-landing.tsx`

- **`frontend/client/src/pages/theroleroom-landing.tsx`** — 8 feil
  - L432: TS2769: No overload matches this call.
  - L437: TS2769: No overload matches this call.
  - L455: TS2769: No overload matches this call.
  - L628: TS2769: No overload matches this call.
  - L1122: TS2769: No overload matches this call.
  - L1233: TS2769: No overload matches this call.
  - L1251: TS2769: No overload matches this call.
  - L1267: TS2769: No overload matches this call.

### `client/src/pages/warmup-guide.tsx`

- **`frontend/client/src/pages/warmup-guide.tsx`** — 3 feil
  - L17: TS2769: No overload matches this call.
  - L46: TS2769: No overload matches this call.
  - L180: TS2769: No overload matches this call.

### `client/src/pages/wedding-access.tsx`

- **`frontend/client/src/pages/wedding-access.tsx`** — 2 feil
  - L78: TS2769: No overload matches this call.
  - L78: TS7006: Parameter 'e' implicitly has an 'any' type.

### `client/src/services/webgl-transition-engine.ts`

- **`frontend/client/src/services/webgl-transition-engine.ts`** — 1 feil
  - L7: TS7016: Could not find a declaration file for module 'three'. 'C:/Users/UsmanQazi/Creatorhubn-monorepo/node_modules/three/build/three.module.js' implicitly has an 'any' type.