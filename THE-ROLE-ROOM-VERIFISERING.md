# TheRoleRoom — Verifisering: dokumentasjon mot faktisk kode

> Audit 2026-05-27. Fire parallelle kode-agenter auditerte påstandene i
> produktdokumentasjonen mot den faktiske koden. Dom per påstand:
> **BEKREFTET / DELVIS / STUB / IKKE FUNNET / UNØYAKTIG**.

---

## Hovedkonklusjon

Produktet er **substansielt reelt — ikke vaporware**. Det store flertallet av kjerne-
funksjonene er genuint end-to-end (DB-tabell + registrert backend-route + frontend som
faktisk bruker dem), med ekte eksterne API-kall, OAuth, kryptering og webhooks. Anslagsvis
**~80–85 % av påstandene holder som formulert.**

Men: noen påstander er **overdrevne**, og **tre arkitektur-fakta er direkte feil**. Disse er
dokumentert under (ikke flettet inn i hoveddokumentet — det står slik forfatteren skrev det).

---

## Status-oppdatering (2026-05-28)

**5 av funnene er nå løst i koden** og committet på branch
`feat/role-room-consent-production-api`:

| Funn | Status | Commit |
|---|---|---|
| Casting consent (signatur/PIN/portal) | ✅ Ekte issue + portal + signering, ny `SignaturePad` (tegnet signatur), redesign | `59756dcd` |
| Props / produksjonsdager | ✅ Ekte REST + DB-persistens (data JSONB for tapsfri lagring) | `59756dcd` |
| Dans åpne auditions | ✅ Ny `dance_audition`-tabell + full CRUD; dashboardet henter ekte data | `6fbbbc90` |
| Sosiale lenker i samtykke-portal | ✅ Instagram + Facebook fra `publicBrandLinks` | `6fbbbc90` |
| Manus-låsing | ✅ Eksplisitt acquire/release/heartbeat + 409-håndhevelse i PUT/DELETE | `412a87dc` |
| Ads management fee → Stripe meter | ✅ `MeterEmitter` implementert; env-gated default-AV for sikker rollout | `5be7f5a4` |

**Fortsatt utestående:**

| Funn | Status |
|---|---|
| Annonser: TikTok | Utsatt til egen økt (krever full ads-connector) |
| Dans: casting til danseoppdrag | Finnes ikke i koden — bygges fra null (separat oppgave) |
| «Norsk juridisk data» | Formuleringsjustering i hoveddokumentet (brukeren har bedt om at hoveddokumentet ikke endres) |
| Arkitektur-feil (Express 4 / Vite / Render) | Dokumentert i Seksjon A nedenfor; ikke flettet inn i hoveddokumentet |
| Dans: «formasjonstrening» (editor vs. trening) | Beholdt som-er (separat UX-avgjørelse) |
| Dans / EHF-faktura | Beholdt som-er (krever Peppol/Fiken-integrasjon — eget arbeid) |
| Usage-billing for SMS/WhatsApp | Beholdt som-er (allerede `invoiceItems.create` via Stripe — ikke regresjon) |

Tabellen i Seksjon B nedenfor er annotert med ✅ for løste funn.

---

## A. Faktiske feil i arkitektur-avsnittet

| Påstand i dok | Virkeligheten |
|---|---|
| «Express 5» | **Express 4** (4.22.1) kjører serveren. Express 5 lå kun i ubrukt root-package. |
| «React + Next.js» | Frontend er en **Vite + React SPA** (wouter-routing, React 18.3.1). Next.js er en **ubrukt** backend-dependency. |
| «Hosting: Vercel» | **Kun frontend** på Vercel. **Backend kjører på Render** (Docker, Render Cron). |

## B. Overdrevne funksjoner (status-justert / forbehold)

| Påstand | Dom | Virkeligheten |
|---|---|---|
| Casting consent (signatur/PIN/portal) | **STUB → ✅ FIKSET** (`59756dcd`) | `casting_consents`-tabellen er ubrukt; tilgangskoder genereres client-side (`Math.random`); portal-sign-endepunktene UI-et kaller **finnes ikke** i backend. Consent lagres som blob på kandidaten. *Nå:* nytt `consent-portal-routes.ts` med issue/access/sign mot tabellen, hashet PIN/passord, rate-limit + utløp; redesignet portal + signaturdialog + tegnet signatur. |
| Props / produksjonsdager | **DELVIS → ✅ FIKSET** (`59756dcd`) | Schema + UI finnes, men **ingen REST-API**; frontend-API-klientene er dødkode. Fungerer kun via «lagre hele prosjektet»-blob + localStorage. *Nå:* nytt `casting-production-routes.ts` med ekte CRUD + `data JSONB`-kolonne for tapsfri lagring. `castingService` reimplementert til API; paneler urørt. |
| Manus-«låsing» | **DELVIS → ✅ FIKSET** (`412a87dc`) | «Låsing» = optimistisk versjonssjekk; `locked_by` håndheves ikke. Scener lagres som KV-JSON-blob, ikke i normalisert scene-tabell. *Nå:* ny `ManuscriptLockState` + 4 service-metoder (acquire/release/heartbeat/get) som omgår versjons-bump; 4 nye `/lock`-endepunkter; PUT/DELETE returnerer 409 hvis annen bruker holder gyldig lås; FE-service håndterer 409 (ikke silent localStorage-fallback). |
| Annonser: Meta/Google/LinkedIn | **BEKREFTET, men gated** | Kode-komplett med ekte API-kall — men **skrive-flatene krever plattform-godkjenning** (Meta App Review, Google dev-token, LinkedIn Marketing Platform) før de kan kjøre for ekte kunder. |
| Annonser: **TikTok** | **DELVIS** | Kun OAuth + video-upload (inbox). **Ingen ads-connector**, ingen kampanje/spend; `video.publish` er kommentert ut. Bør ikke listes likestilt med Meta/Google/LinkedIn. |
| «Norsk juridisk data» | **OVERDREVET** | Ingen Lovdata/lov-database. Det er **BRREG-selskapsoppslag + Claude-generert tekst**. |
| Usage-billing (SMS/WhatsApp/ads-fee) | **DELVIS → ✅ FIKSET (ads-fee)** (`5be7f5a4`) | Det er et **kostnads-ledger**, ikke automatisk Stripe-trekk. Ads-`MeterEmitter` er uimplementert (`null`) — «automatisk metered Stripe-fakturering av annonse-spend» er stillas, ikke koblet. *Nå:* `buildRoleRoomAdsMeterEmitter` implementert (Stripe `billing.meterEvents.create` + customer-id-oppslag via snapshot-mønster); env-gated default-AV. SMS/WhatsApp uendret — de bruker allerede `invoiceItems.create` (ikke regresjon). |
| Dans: **casting til danseoppdrag** | **IKKE FUNNET** | Finnes ikke i koden. Dansevertikalen **fjerner bevisst** casting. Fjern fra featurelisten. |
| Dans: åpne auditions | **STUB → ✅ FIKSET** (`6fbbbc90`) | Hardkodet `DEMO_AUDITIONS`; ingen tabell/endepunkt. *Nå:* ny `dance_audition`-tabell (migrasjon 0076) + 4 service-funksjoner + 4 endepunkter under `/api/dance/ops/auditions`; dashboardet henter ekte data, demo beholdt som fallback for tests. |
| Dans: «formasjonstrening» | **DELVIS** | Formasjons-**editor/visualisering** (scenekart, baner), ikke «trening» (ingen scoring/øvingsloop). |
| Dans / EHF-faktura | **DELVIS** | `ehf_status`/`fiken_invoice_id` er manuelle strengkolonner; **ingen Peppol/Fiken-overføring**. Betalt add-on-checkout er eksplisitt utsatt til «neste fase». |

## C. Bekreftet sterkt — den reelle ryggraden

**Produksjons-OS:** produsent/klient-samarbeid (timeline, budsjett i NOK, reviews+kommentarer,
intake, materials), utstyr + booking + checkout (mest komplette modul), manus (17 endepunkter,
ekte screenplay/Fountain-parsing), shot lists/storyboard, casting (prosjekter/roller/
kandidater), scheduling, crew, lokasjoner — **alle end-to-end.**

**Integrasjoner:** Meta/Google/LinkedIn ads (ekte API-kall), content marketing (ekte Claude),
Instagram publish + webhook (HMAC-verifisert), Google Workspace (Calendar/Meet/Drive/e-sign
med AES-GCM + SHA-256), Printful, BRREG, Stripe (webhook-signatur), Claude, Replicate, Twilio,
WhatsApp Business — **alle bekreftet ekte.**

**Dans:** booking, koreografi, medlemshåndtering, event-dashboard, skadelogg, øvingslogg,
Stripe plan-billing — **alle ekte.** Den mest utbygde spesialvertikalen (~22 backend-filer,
~20 migrasjoner, ~60 frontend-komponenter).

**Agenten:** korrekt merket **BETA** — hard-gated bak admin-only + feature flag
(`role-room-agent-producer`) + Claude-env av som default «til DPA er signert». Matcher
dokumentet presist. (Et kunde-entitlement/trial-system finnes i koden, men er ikke koblet til
porten ennå — det er stillas.)

**Integrasjonsrammeverk:** ekte og funksjonelt (SHA-256-hashede API-nøkler, scope-håndhevelse,
idempotency, AES-GCM-krypterte webhook-secrets, HMAC-signert outbox, retry + dead-letter).
Operativt **internt** — OpenAPI-spec finnes men serveres ikke, ingen dev-portal/offentlig
nøkkelutstedelse. «Arkitektur for fremtidig offentlig API» er dermed **presist**.

**Prising:** 795/495 kr, danse-tiers (149/299/599/1199/2490), SMS 2,00 kr — **bekreftet i kode.**

---

## Justert helhetsdom

Dokumentasjonen var **ærlig på det viktigste** (pre-revenue, Agent i beta, compliance-gap) og
treffer godt på kjernen: produksjons-OS-et, integrasjonene og dansevertikalen er reelle og
end-to-end. Korreksjonene endrer **ikke** historien om hva produktet *er* — de gjør den mer
presis: noen kant-funksjoner (consent-portal, props/produksjonsdager-API, dans-auditions/
casting, EHF-overføring) er stillas eller demo, og annonse-skriveflatene venter på
plattform-godkjenning. For en investor er nettopp denne presisjonen en styrke: påstandene som
står igjen, står på solid kode.
