# Book demo → CRM → kunde (demo-bruker-håndtering)

Hvordan en «Book demo»-forespørsel fra theroleroom.com blir til en betalende
Role Room-kunde, og hvordan demo-brukere håndteres underveis.

## 1. Innsamling — Book demo-modalen

«Book demo»-knappene på theroleroom.com (Hero + FinalCTA) åpner en dedikert
modal (`BookDemoModal.tsx`) som samler all viktig bedrifts-info:

- Bedrift/selskap, kontaktnavn + rolle, jobb-e-post, telefon
- Org.nr, nettside, virksomhetstype, team-størrelse
- Bruksområde, dagens verktøy, ønsket demo-tid, demo-språk

Innsendt → `POST /api/public/agency-lead` med `source='book_demo'`. Landet i
**`agency_leads`** (samme CRM som /for-byraer — én pipeline) med
`status='demo_booked'`. Kontakten får bekreftelses-e-post; Daniel får intern
varsel med alle feltene.

> Migrasjon `0328_agency_leads_b2b_and_conversion.sql` la til B2B-kolonnene +
> konverterings-sporing (`converted_user_id`, `stripe_customer_id`,
> `stripe_subscription_id`, `conversion_persona`, `conversion_initiated_at`).

## 2. Håndtering — Admin Room CRM

**Admin Room → Byrå-akkvisisjon** (`AgencyAcquisitionDashboard`).

- Funnel: `new → contacted → demo_booked → trial → customer`.
- «Hot leads»-lista viser nylige leads inkl. **booket demo + trial** øverst,
  så de er klare for oppfølging/konvertering.
- Hver lead kan flyttes ett steg (`→`-knappen) eller konverteres (under).

Gated til `daniel@creatorhubn.com` (`isAdminEmail`).

## 3. Konvertering til kunde — selvbetjent lenke

På en `demo_booked`/`trial`-lead: **«Konverter»** → velg plan
(Innholdsprodusent / Produksjonsteam).

`POST /api/admin-room/agency-leads/:id/convert-to-customer { persona }`:

1. Bygger en **persona-forhåndsutfylt onboarding-lenke**:
   `https://theroleroom.com/?signup=<persona>&email=<e-post>&ref=demo_conversion`
2. Sender kontakten en «Kom i gang»-e-post med lenken.
3. Setter `conversion_persona` + `conversion_initiated_at`, løfter status til
   `trial` (i onboarding).

Kontakten åpner lenken → landingens dyplenking (`?signup=<persona>`) åpner den
**utprøvde commercial-onboarding-flyten** (`LoginDialog`), der de selv fyller
inn org.nr (Brønnøysund-validert), legger til teamet (roller) og fullfører
Stripe-checkout. Dette er bevisst: org/roller/seter samles av den ekte flyten,
ikke fabrikkeres fra leaden (som mangler dem).

## 4. Tilbake-flipp ved betaling (webhook)

Når Stripe bekrefter abonnementet, kjører
`markRoleRoomCommercialCheckoutRecordPaid` (index.ts) den vanlige
provisjoneringen (invite_requests → tilgang). I tillegg (additivt, best-effort)
flippes matchende `agency_leads`-rad på **e-post** (team-lead eller medlem) til
`status='customer'`, med `customer_at`, `stripe_subscription_id`,
`stripe_customer_id`. Leaden lukkes dermed automatisk i CRM-en.

> Matcher på e-post fordi den selvbetjente lenken går gjennom ordinær checkout —
> vi har ikke lead-id i Stripe-metadataen, men e-posten er stabil.

## 5. Demo-bruker-tilgang (under demoen)

Demo-brukeren trenger ikke en betalt konto for å se en demo — demoen kjøres av
selger. Hvis en demo-bruker skal få utforske selv FØR konvertering, bruk
eksisterende entitlement-grant (`adminGrantEntitlement` / `startAgentTrial` for
Agent-tilgang), eller send konverterings-lenken og la dem starte onboarding.
Full betalt tilgang gis først etter fullført Stripe-checkout (steg 3–4).

## Datapunkter

| Sted | Hva |
| --- | --- |
| `agency_leads` | CRM-rad, B2B-felt, status, konverterings-sporing |
| `agency_lead_events` | `demo_booked`, `conversion_initiated`, `status_*` |
| `POST /api/public/agency-lead` | Book demo-innsending |
| `POST /api/admin-room/agency-leads/:id/convert-to-customer` | Konvertering |
| `markRoleRoomCommercialCheckoutRecordPaid` (index.ts) | Webhook-flipp til kunde |
