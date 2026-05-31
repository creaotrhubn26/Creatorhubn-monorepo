# Meta App Review — søknadspakke for Role Room

Denne dokumentet inneholder alt du trenger for å sende Meta App Review for
Role Room (theroleroom.com). Forskjellen fra Google: Meta gjennomgår hver
permission separat, krever **screencast** som demonstrerer hver permission
konkret, og krever **Business Verification** før ads-scopes kan godkjennes.

> **Hvorfor:** Role Room Ads-ryggraden er kodet og live, men de skrivende
> Meta-stiene (opprette/pause kampanjer + insights-polling for eksterne
> kunder) krever **advanced access** til `ads_management` + `ads_read`.
> Uten godkjenning kan kun app-roller (Admins/Developers/Testers) bruke
> dem — ekte kunder som **MedInnova** kan det ikke.

> **Tidskritisk:** Meta App Review tar **2–6 uker**, ofte med
> oppfølgings-spørsmål som restarter klokken. MedInnova-avtalen startet
> 2026-06-01 — Meta-writes vil ikke være live for dag 1; vi kjører
> read-only insights til godkjenning kommer.

---

## 1. Forutsetninger — sjekkliste FØR du går inn i App Dashboard

| Krav | Status | Notat |
|------|--------|-------|
| **Meta App eksisterer** | ⚠️ verifiser | App ID skal være satt som `META_APP_ID` på Render. Type må være **Business** (ikke Consumer). |
| **App er knyttet til Business Manager** | ⚠️ verifiser | Settings → Basic → "Business Use" → koblet til **Creatorhub AS** Business Manager. |
| **Business Verification fullført** | ⚠️ **STARTER LANGT FØR** | Org.nr 937 518 684 + dokumentasjon. Tar dager til uker. **Påkrevd FØR du kan be om advanced access** til ads-scopes. Start her: <https://business.facebook.com/settings/security> → Business Verification. |
| **App icon (1024×1024 PNG)** | ⚠️ verifiser | Role Room-logo, kvadratisk, ingen alpha. |
| **App Display Name** | ✅ | `Role Room` |
| **Privacy Policy URL** | ⚠️ MÅ PUBLISERES | `https://theroleroom.com/privacy` — må være offentlig + beskrive Meta-data-håndtering. |
| **Terms of Service URL** | ⚠️ MÅ PUBLISERES | `https://theroleroom.com/terms`. |
| **Data Deletion Instructions URL** | ⚠️ MÅ PUBLISERES | `https://theroleroom.com/data-deletion` — instrukser til brukeren om hvordan de ber om sletting. Alternativt: en **callback-URL** Meta kaller programmatisk (mer arbeid; instruksjons-URL er enklere). |
| **App Domain** | ✅ | `theroleroom.com` |
| **App Category** | ✅ | **Business** (eller "Marketing & Communications") |
| **Tester-konto** | ⚠️ legg til | Inkluder en Meta-konto Meta-reviewers kan bruke til å logge inn under review. Se §6. |
| **Live mode** | ⚠️ etter alt over | Switche app fra "In Development" til "Live" når alle assets er på plass. |

**Hovedrekkefølge:**

1. Start **Business Verification** NÅ (lengste lead-time, blokkerende for alt
   annet ads-relatert).
2. Publiser **privacy / terms / data-deletion** på theroleroom.com mens
   verifikasjonen kjører.
3. Last opp app-ikon, sjekk Display Name + App Domain.
4. Når Business Verification er godkjent: gå til App Review og søk om hvert
   scope (§3).

---

## 2. Hvor du søker

1. Logg inn på <https://developers.facebook.com/apps>.
2. Velg Role Room-appen (eller opprett ny Business-app hvis ikke finnes).
3. Venstre meny → **App Review** → **Permissions and Features**.
4. For hvert scope du trenger advanced access til: klikk **Request Advanced
   Access**.
5. Hver request åpner et eget skjema med use-case-tekst + screencast-opplasting.

---

## 3. Permissions å søke om

Role Room ber om disse scopene i OAuth-flowen
(`backend/server/role-room-instagram-oauth.ts → REQUIRED_SCOPES`):

| Scope | Standard / Advanced | Hvorfor Role Room bruker den | Status søknad |
|-------|---------------------|-------------------------------|---------------|
| `instagram_basic` | Standard | Lese IG-konto-metadata (navn, ID, brukernavn) som er koblet til kundens FB-side. | Auto |
| `instagram_content_publish` | **Advanced** | Publisere innhold (poster/reels) på vegne av kunden — del av content-production-flowen. | App Review |
| `pages_show_list` | Standard | Liste Pages-er produsenten er admin på (for kontovelger). | Auto |
| `pages_read_engagement` | **Advanced** | Lese Page-engasjement (likes/kommentarer/innlegg-statistikk) for klient-dashbord. | App Review |
| `pages_manage_posts` | **Advanced** | Publisere/schedule poster på Pages som del av content-production. | App Review |
| `publish_video` | **Advanced** | Publisere reels/video til Page + IG. | App Review |
| `business_management` | **Advanced** | Verifisere admin-tilgang til kundens ad-accounts + Pages via Business Manager (cross-asset access). Brukt i `hasMetaAdAccountAccess`. | App Review |
| `ads_read` | **Advanced** | Hente daglig spend/CTR/CPC/ROAS via Marketing Insights API — driver Økonomi-fanen + Lag 2-anbefalinger. | App Review |
| `ads_management` | **Advanced** | Opprette/pause/resume/end Meta-kampanjer på vegne av kunde. Brukt i `createCampaign`/`pauseCampaign`/`resumeCampaign`/`endCampaign`. | App Review |
| `attribution_read` | **Advanced** | Lese attribution-data for korrekt konvertering-rapportering. | App Review |

**Avhengighet:** `ads_management` + `ads_read` + `business_management`
gis ikke før **Business Verification** er fullført. Resten kan i prinsippet
godkjennes uavhengig.

---

## 4. Per-permission justifikasjoner (kopier inn)

Meta vil ha en **use-case-tekst per permission**. Disse er pre-skrevet for
Role Rooms kode.

### `ads_management`

```
Role Room is an agency platform that lets marketing producers manage paid
campaigns on behalf of their small and mid-size business clients. The
producer authenticates via Facebook Login, the client grants ADVERTISE
or MANAGE role on their Meta ad account via Business Manager, and Role
Room then provides programmatic campaign management:

- Create campaigns via POST /act_{ad-account-id}/campaigns with
  objective + status (campaigns are created PAUSED by default; the
  producer activates them manually after review).
- Update campaign status (PAUSE, RESUME, END) via POST /{campaign-id}
  when the producer pauses or stops a campaign from the Role Room UI.
- Optional client-controlled auto-pause when the client's monthly spend
  cap is reached (the client must explicitly enable the toggle —
  off by default).

Before any write call we verify the producer's access via
/{ad-account-id}?fields=user_tasks (must include ADVERTISE or MANAGE).
If access is missing we return HTTP 403 to the user and do not call
the API. This is implemented in role-room-meta-ads.ts:
`hasMetaAdAccountAccess` is called by every mutation route in
role-room-routes.ts.

Volume: well under Meta's standard rate limits. Estimated 5–15 mutations
per day per advertiser at steady state (campaign create + occasional
status changes).
```

### `ads_read`

```
Role Room ingests daily campaign performance metrics from the Meta
Marketing Insights API to power the cross-channel reporting dashboard
in our Økonomi (Economy) tab — clients see aggregated spend, CTR, CPC,
conversions, and ROAS for each ad channel.

Endpoint used: GET /{campaign-id}/insights with fields=date_start,
impressions, clicks, spend, cpc, cpm, ctr, actions, action_values and
time_increment=1. Run nightly per active campaign by our cron job
`runAdsAttributionSweep` in role-room-ads-sync.ts.

Metrics are stored aggregated per campaign per day in our
`ads_attribution_daily` PostgreSQL table (idempotent on
(campaign_id, date)). This data also feeds our AI-assisted advisory
recommendations layer (Lag 2) — Claude analyzes the performance
numbers and suggests budget reallocation or underperformer pauses;
all suggestions are advisory and never trigger automated actions.

Volume: ~1 GET per campaign per day, well under rate limits.
```

### `business_management`

```
Role Room operates on a multi-tenant agency model where each producer
manages multiple clients via their own Business Manager. We use
business_management to:

1. Verify that the authenticated producer has admin role on the
   client's ad accounts (hasMetaAdAccountAccess) before allowing any
   mutation — implemented in role-room-meta-ads.ts.
2. List which Pages, Instagram accounts, and ad accounts the client
   has granted the producer admin access to (the "Granted Assets" card
   in Role Room — see role-room-meta-ads.ts → listManagedPages,
   listManagedAdAccounts). This gives clients full transparency into
   exactly which assets we have access to on their behalf.

We do not modify business-level configuration (we never assign roles,
modify billing, or change account settings). business_management is
read-only in our use.
```

### `pages_read_engagement`

```
Role Room reads Page engagement metrics (likes, comments, shares per
post) to provide a unified content + ads performance view in the
client's dashboard. Specifically: when a producer publishes a post via
Role Room (which uses pages_manage_posts to publish), we later read the
engagement metrics on that post via /{post-id}/insights to show the
producer + client how the published content is performing alongside
the paid campaigns.

No bulk Page-data ingestion; only the specific posts Role Room has
published on the client's behalf.
```

### `pages_manage_posts`

```
Role Room's content-production workflow lets producers draft posts in
the Role Room editor and publish them to the client's Facebook Page —
either immediately or scheduled. Each post is reviewed and approved
by the client (or auto-approved after a configurable business-day
deadline) before publication, enforced by our content-approval gate
in role-room-material-approval.ts.

Endpoints: POST /{page-id}/feed for text/image posts, POST /{page-id}/photos
for image posts, POST /{page-id}/videos for video posts.

The client always retains the right to revoke admin access via Business
Manager, after which Role Room cannot publish to the Page.
```

### `publish_video`

```
Same content-publishing flow as pages_manage_posts but for video content
(reels and longer-form video) on Page and Instagram. Used in conjunction
with instagram_content_publish for cross-platform reel posting.

Endpoint: POST /{page-id}/videos with status_type=SCHEDULED or PUBLISHED.
```

### `instagram_content_publish`

```
Role Room publishes content (image posts, carousels, reels) to the
client's Instagram Business account as part of the same content-production
flow as pages_manage_posts. The producer drafts the post, the client
approves, and Role Room publishes via the two-step Container + Publish
flow.

Endpoints: POST /{ig-user-id}/media (create container) → POST
/{ig-user-id}/media_publish (publish the container).

Instagram account is linked to the Facebook Page that the producer has
admin role on; we use instagram_basic to discover the linked IG ID.
```

### `attribution_read`

```
Role Room reads attribution windows + conversion attribution data
from the Marketing Insights API so that the conversion + conversionValue
numbers shown to clients in the Økonomi tab reflect Meta's official
attribution model (rather than just lastclick). Used as part of the
same /{campaign-id}/insights call that requires ads_read.
```

### `pages_show_list` (standard)

```
Read-only: list the Facebook Pages the authenticated producer is an
admin of, so that we can populate the Page-selector when they connect
a new client to Role Room.

Endpoint: GET /me/accounts.
```

### `instagram_basic` (standard)

```
Read-only: discover the Instagram Business account linked to each
Facebook Page the producer admins, plus basic metadata (username,
profile picture URL). Used to populate the IG-account picker in the
Role Room "Granted Assets" card.

Endpoints: GET /{page-id}?fields=instagram_business_account,
GET /{ig-user-id}?fields=username,profile_picture_url.
```

---

## 5. Screencast — skript Meta-reviewer skal se

Meta krever **én screencast per advanced permission** som viser at
permission-en faktisk brukes til det du beskriver. Du kan lage ÉN lang
screencast som dekker alle scopene, og linke den fra hver request.

**Anbefalt opptak:** macOS Screen Recording (Cmd+Shift+5) → MP4 → upload
til YouTube som **Unlisted** → lim inn YouTube-link i hver request.
Lengde 3–6 min.

**Skript (Norwegian dialog ok så lenge UI er på engelsk eller du dubber):**

```
00:00  INTRO
"Hi Meta team. This is Role Room — an agency platform for marketing
 producers managing paid + organic campaigns on behalf of small business
 clients. The producer is Daniel, the client is MedInnova/PreVisit
 (healthcare). I'll walk through the OAuth flow and demonstrate each
 advanced permission we're requesting."

00:20  OAUTH FLOW (covers all scopes via consent screen)
- Naviger til https://theroleroom.com → log in as producer
- Klikk "Connect Facebook" på et prosjekt
- Vis at consent-screen viser alle scopene vi ber om
- Godta og fullfør tilbake til Role Room

01:00  GRANTED ASSETS (covers business_management, pages_show_list,
       instagram_basic)
- Åpne Økonomi-fanen → "Tilganger du har gitt"-kortet
- Pek på hver Page, IG-konto, og ad-account som dukker opp med logo
- "These come from /me/accounts (pages_show_list) +
   /me/adaccounts (business_management) + the linked IG via
   instagram_basic."

01:45  CONTENT PUBLISHING (covers pages_manage_posts,
       instagram_content_publish, publish_video, pages_read_engagement)
- Åpne content-editor-fanen
- Lag en post med bilde + caption
- Klient godkjenner (vis approval-gaten)
- Klikk Publish → vis at posten dukker opp på FB Page + IG
- Tilbake i Role Room: vis engagement-tall som ticker inn
   (uses pages_read_engagement on the post-ID)

03:00  CAMPAIGN CREATION (covers ads_management)
- Åpne AdsManagementPanel under Økonomi-fanen
- Klikk "Ny kampanje" → Meta plattform → velg ad-account → fyll inn
   navn + objective + dagsbudsjett
- Klikk "AI-annonsetekst" → Generer → velg variant
- Klikk Opprett → vis at den havner som PAUSED i listen
- Vis at den faktisk dukker opp i Ads Manager (åpne nytt vindu, naviger
   til Meta Ads Manager, vis kampanjen)

04:15  CAMPAIGN MANAGEMENT (covers ads_management — status mutations)
- I AdsManagementPanel: pause/resume en eksisterende kampanje
- Vis at status faktisk endrer seg i Ads Manager

04:45  REPORTING (covers ads_read + attribution_read)
- Åpne "Resultater per kanal"-kortet i Økonomi
- Pek på Meta-raden: forbruk, klikk, CTR, CPC, konv., ROAS
- "These metrics come from GET /{campaign-id}/insights with
   time_increment=1, fetched nightly by our attribution sweep.
   Attribution data uses the attribution_read scope to reflect Meta's
   official attribution model."

05:30  AUTO-PAUSE (kort demo — covers ads_management write usage)
- Sett budsjett-tak lavt
- Slå på "Pause kampanjer automatisk når taket nås"
- (Skip live trigger — bare beskriv: "Når perioden treffer taket
   pauses kampanjene automatisk via campaigns:mutate.")

06:00  OUTRO
"All write operations are gated by Hasaccess checks before the API call.
 Clients control budget caps + can revoke admin access at any time.
 Privacy policy: theroleroom.com/privacy. Thank you."
```

**Opptaks-tips:**
- Skru av notifications (Cmd+Option+D i Notification Center).
- Bruk en "demo"-profilbruker i nettleseren, ikke produksjon.
- Hvis du nøler i en av seksjonene — start på nytt heller enn å klippe;
  Meta-reviewers liker rolig, sammenhengende demo.
- 1080p er nok; ikke nødvendig med 4K (større fil, lengre opplasting).

---

## 6. Test-bruker for Meta-reviewer

Meta-reviewers vil ofte logge inn selv og prøve. Du må gi dem en testbruker
med admin-tilgang til en testkonto:

1. App Dashboard → **Roles** → **Test Users**.
2. Klikk **Add** → opprett en testbruker (Meta genererer e-post + passord).
3. Gi testbrukeren **admin**-rolle på:
   - En test-Facebook-side
   - En tilkoblet Instagram-konto
   - En test-Meta-ad-account (kan være en sandbox-konto med kr 0 i forbruk)
4. Logg inn én gang som testbrukeren på theroleroom.com for å verifisere
   at flowen funker.
5. I App Review-skjemaet for hvert scope: lim inn testbruker-credentials i
   "Instructions for App Review"-feltet, sammen med en kort guide:
   ```
   1. Log in at https://theroleroom.com with the credentials above.
   2. Open a project, go to Economy tab.
   3. Click "Connect Facebook" and grant all requested permissions.
   4. The "Granted Assets" card will show our test Page + IG + ad account.
   5. Click "New campaign" to demo ads_management.
   6. Click "Results per channel" to demo ads_read.
   ```

---

## 7. Submission-rekkefølge

Optimal rekkefølge (sparer tid hvis noe må re-submittes):

1. **Business Verification** først (uten dette godkjennes ingen ads-scope).
2. **Privacy/Terms/Data-deletion-URL-er** publisert på theroleroom.com.
3. **App icon + display name + app domain** på plass.
4. **Test-bruker + test-side/ad-account** opprettet.
5. **Screencast** spilt inn og lastet opp til YouTube (Unlisted).
6. **App switchet til Live mode**.
7. **Søk per scope** i App Review → Permissions and Features. Du kan
   sende alle samtidig.

---

## 8. Etter innsending

**Behandlingstid:** Meta sier 7 virkedager, men 2–6 uker er realistisk
med oppfølgings-spørsmål. Hver oppfølging restarter klokken.

### Vanlige oppfølgings-spørsmål

- *"Show how the permission is used for end-users, not just internally"*
  — vis at klienter (ikke bare produsenten) ser data som kommer fra
  permission-en. Vår Økonomi-fane oppfyller dette.
- *"The screencast doesn't clearly show permission X being requested."*
  — sørg for at consent-screen-en er synlig i opptaket, og at hver
  permission er sjekket på i listen.
- *"Privacy policy doesn't mention what Meta data you collect."*
  — privacy må eksplisitt liste hver type Meta-data Role Room behandler
  (Page-data, ad-spend, kampanje-config, etc.).

### Hvis godkjent

- Du får e-post + status-endring i App Dashboard.
- Du trenger **ikke** å gjøre noe på vår side — koden ber allerede om
  scopene; appens advanced-access-status åpner dem opp for ekte kunder
  automatisk fra neste OAuth-flow.
- Pek MedInnova-kontakten på OAuth-flowen i Role Room.

### Hvis avslag

- Meta sender konkret grunn pluss instruksjoner.
- Mest vanlig: «screencast viste ikke X» → re-spill in den biten, re-submit.
- Re-submission er gratis og resetter klokka — så det er ingen kostnad
  ved å være tålmodig med iterasjon.

---

## 9. Mens vi venter

- Skrive-stiene fungerer for app-roller (Admins/Developers/Testers). Bruk
  test-ad-account til ende-til-ende-verifisering av sync-ryggraden.
- `runAdsAttributionSweep` kan kjøres mot testkontoen for å validere at
  attribution + påslag-ledger + spend-rapporten stemmer.
- Read-only insights kan fungere for MedInnova hvis vi midlertidig knytter
  daniel@creatorhubn.com som developer på Meta-appen og kjører som
  produsent for MedInnovas eksisterende ad-account (de selv må gi tilgang
  i sin Business Manager).

---

## 10. Lenker

- App Dashboard: <https://developers.facebook.com/apps>
- App Review docs: <https://developers.facebook.com/docs/app-review>
- Marketing API authorization: <https://developers.facebook.com/docs/marketing-api/overview/authorization>
- Business Verification: <https://www.facebook.com/business/help/2058515294227817>
- Permission reference: <https://developers.facebook.com/docs/permissions/reference>
- Data deletion callback spec: <https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback>
