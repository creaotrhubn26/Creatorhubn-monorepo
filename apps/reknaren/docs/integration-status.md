# Integrasjonsstatus

Status rapporteres ærlig av API-et: `GET /api/integrations/status`
(`src/api/server.ts`) — sandbox presenteres aldri som aktiv tilkobling.

**Helsesjekk for CreatorHub Control Center:** `GET /api/health` (uten auth,
kun lesing, ingen secrets) gir `{ service, status, uptimeSeconds, database,
integrations{…} }` — 200 ved frisk, 503 når databasen er nede. Endepunktet er
laget for å probes av Control Center-cockpitens helse-tavle
(`backend/server/control-center-health-client.ts` på `main`). Registrering på
Control Center-siden: sett en health-URL-env som peker hit (se
`docs/integration-status.md` §Control Center under).

| Integrasjon | Status | Hva som finnes i koden |
|---|---|---|
| **Gmail** | **Sandbox — ikke aktiv** | Port-grensesnitt (`src/ingestion/gmail/port.ts`), sandbox-adapter med fixtures (`src/ingestion/gmail/sandbox.ts`), sanitering (`sanitize.ts`), full importflyt med filter, duplikat, karantene og token-tilstander. Ingen produksjonsadapter. |
| **Bank** | **Manuell CSV alltid; automatisk PSD2-feed aktiv når GoCardless-legitimasjon er satt** | Idempotent transaksjonsimport (`src/bank/import.ts`), deterministisk matching (KID/beløp+dato/beløp+navn) med forklaring og godkjenningsflyt som bokfører betalingen (`src/bank/matching.ts`). **Bank-feed:** `GoCardlessBankFeedProvider` (`src/bank/feed.ts`, GoCardless Bank Account Data / tidl. Nordigen — PSD2-aggregator for norske banker) bak `BankFeedProvider`-port; henter «booked»-transaksjoner (`mapGcTransaction` normaliserer til øre-bigint m/ fortegn, aldri flyttall) og kjører dem gjennom SAMME import + matching som CSV. Endepunkt `POST …/bank-accounts/:id/feed/sync`. Uten `REKNAREN_GOCARDLESS_SECRET_ID`+`_SECRET_KEY`: `UnconfiguredBankFeedProvider`, `fetchTransactions` kaster NotConfigured FØR nettverk; `/status` → `bank.mode='manual_csv'`. Med legitimasjon → `bank.mode='psd2_gocardless'`. |
| **EHF (e-faktura)** | **XML-eksport aktiv; overføring venter på aksesspunkt-avtale** | `renderEhfXml` (`src/invoicing/ehf.ts`) bygger UBL 2.1 / PEPPOL BIS Billing 3.0-faktura (380) deterministisk fra fakturadataene: BIS-profil, partene m/ norsk PEPPOL-adresse (`EndpointID schemeID=0192`), mva-id på registrert selger, PaymentMeans (kode 30 + KID + konto), TaxTotal per avgiftskategori (S/Z/E/AE m/ fritaksgrunn), LegalMonetaryTotal, InvoiceLine. Beløp = eksakt 2 desimaler fra øre. Nedlasting `GET …/invoices/:id/ehf` (velformet, verifisert m/ xmllint). Overføring bak `PeppolAccessPoint`-port; `UnconfiguredPeppolAccessPoint` = ærlig no-op → `POST …/ehf/send` gir 503. `/status` → `ehf.mode='xml_export_only'` (alltid) el. `'peppol_access_point'` (m/ avtale). Kreditnota (UBL CreditNote) avvises eksplisitt. |
| **SAF-T Financial-eksport (v1.40)** | **Implementert — validert mot offisiell XSD v1.40** | `src/saft/export.ts` genererer komplett fil fra hovedboken (Header, kontoer m/ periodesaldo + **GroupingCategory/GroupingCode** fra næringsspesifikasjon-kodelisten, kunder/leverandører m/ reskontro i **BalanceAccount**, mva-koder, hovedbokstransaksjoner). **SAF-T Financial 1.40** (obligatorisk fra 1.1.2027) — valideres i test mot Skatteetatens offisielle XSD v1.40 (`vendor/saft/`). Full sporbarhet: linjenes **SourceDocumentID** (→ kildebilag), transaksjonens **SystemID** (bilagsnr), **Analysis** (prosjekt/avdeling → AnalysisTypeTable), og fremmed valuta (CurrencyCode/CurrencyAmount/ExchangeRate) per bokf.loven §4-2. Versjon konfigurerbar (`auditFileVersion`, standard 1.40). Nedlasting fra Rapporter-skjermen; hver eksport auditlogges. Altinn-innsending gjenstår. |
| **Altinn / Skatteetaten (MVA-melding-innsending)** | **Kodet, men ikke aktiv — venter på Maskinporten-legitimasjon** | `MaskinportenClient` (`src/integrations/maskinporten.ts`) henter access-token via `private_key_jwt`/jwt-bearer (verifisert mot metadata: prod `maskinporten.no/token`, test `test.maskinporten.no/token`, RS256-signering med Nodes `crypto`). `SkatteetatenVatSubmissionClient` (`src/integrations/vat-submission.ts`) bak `VatSubmissionPort`: `validate()` POST-er mva-melding-XML til grensesnittstøtte (`…/api/mva/grensesnittstoette/mva-melding/valider`), `submit()` er dokumentert Altinn 3-flyt (`skd/mva-melding-innsending`). Uten `MASKINPORTEN_*`-legitimasjon: `active=false`, og `getAccessToken`/`validate` kaster `MaskinportenAuthError` FØR nettverkskall. `/api/integrations/status` → `altinn.mode='awaiting_maskinporten', active=false`. Injiserbare stubs (`StaticMaskinportenStub`, `StubVatSubmission`). **NB:** XML-byggingen (`buildMvaMeldingXml`) er et MVP-skjelett som må valideres mot Skatteetatens XSD (referert i docs, ikke vendored) — derfor `validate()` først; `submit()` kaster ærlig «ikke ferdig» framfor falsk kvittering. |
| **Brønnøysundregistrene (MVA-registerkontroll)** | **Aktiv — åpne data, ingen nøkkel** | `BrregVatRegisterClient` (`src/integrations/brreg.ts`) slår opp org.nr. i Enhetsregisteret (`data.brreg.no`) og leser `registrertIMvaregisteret`. Endepunkt `POST /vat-register-check` lagrer resultat + tidspunkt på organisasjonen, auditlogger oppslaget og flagger avvik mot lokal MVA-status. Testene bruker injiserbar stub (`StaticVatRegisterStub`). |
| **Stripe (inntektssynk)** | **Kodet — aktiv når REKNAREN_STRIPE_SECRET_KEY er satt (kun LES)** | `StripeApiClient` (`src/integrations/stripe.ts`, kun GET mot Stripe — muterer aldri) bak `StripeReadPort` + `StaticStripeStub`. `syncStripeRevenue` (`src/integrations/stripe-sync.ts`): betalte Stripe-fakturaer (Creatorhub/The Role Room/Leadgrid) → upsert kunde (match på e-post) + **UTKAST-salgsfaktura** (ikke bokført; mennesket utsteder → da bokføres inntekt). Idempotent via `stripe_imports` (mig 0007, UNIQUE per org+faktura). Ikke-NOK hoppes over ærlig. Beløp ordrett fra Stripe (bigint øre). Endepunkt `POST /api/organizations/:orgId/integrations/stripe/sync` (`invoices.manage`). **NB:** mva-kode/konto er provisorisk default (kode 6 utenfor mva-loven + konto 3100, forutsetter ikke-mva-registrert selger) og MÅ fagkontrolleres før utstedelse — derfor utkast. Uten nøkkel: `active: false`, synk kaster `StripeAuthError` før nettverkskall. |
| **Lovdata API (lovtekst)** | **Delvis — åpne bulk-data uten nøkkel; per-paragraf-oppslag krever API-nøkkel (ikke konfigurert ⇒ ikke aktivt)** | `LovdataApiClient` (`src/integrations/lovdata.ts`) bak `LovdataPort` med injiserbar stub (`StaticLovdataStub`). **Åpent uten nøkkel:** `ping()` (reachability) og `listPublicDatasets()` (NLOD-katalogen `/v1/publicData/list`, bl.a. `gjeldende-lover.tar.bz2`). **Krever `X-API-Key`:** `fetchLegalText(refID)` via `/renderRefID` — henter ordrett lovtekst bak en `legalReference`. Uten nøkkel kaster `fetchLegalText` `LovdataAuthError` FØR nettverkskall, og `/api/integrations/status` viser `mode: 'public_data_only', active: false`. Broen fra regel til lovtekst er `legalReferenceRefID(rule, register)` (utleder f.eks. `NL/lov/1999-03-26-14/§6-20` fra fradragsregelen). **Verifisert 2026-07-20 mot api.lovdata.no:** vert naable her, `/ping`+`/v1/publicData/list` = 200 uten nøkkel, `/renderRefID`+`/lookup` = 401 uten nøkkel. |
| **AI-bilagslesing (Claude vision)** | **Aktiv når REKNAREN_ANTHROPIC_API_KEY er satt** | `ClaudeDocumentExtractor` (`src/pipeline/ai-extract.ts`) bak samme `DocumentExtractor`-port som OCR/tekstparser: foto/PDF/tekst → strukturerte felt (leverandør, org.nr, nr, datoer, KID, konto, beløp, linjer, mva-fordeling) via Anthropic Messages API + tvunget tool-use. Beløp → øre-bigint via `moneyFromDecimalString`. **AI LES bilaget; reknar ALDRI mva-satsar (de kommer fra regelregisteret) og bokfører ingenting** — pipelinens sumvalidering + MENNESKELIG godkjenning er uendret. Uten nøkkel: ikke aktiv, `extract` kaster NotConfigured FØR nettverk; 401/403 → NotConfigured. `/status` → `ocr.mode='ai_claude'` når aktiv. |
| **OCR** | **Tesseract (nor+eng) — fallback når AI ikke er konfigurert** | `OcrExtractor` (`src/pipeline/ocr.ts`): Tesseract for bilder, pdftotext for PDF-tekstlag, deterministisk parsing av resultatet. Injection-kontroll kjøres på den tolkede teksten. Krever `tesseract-ocr`, `tesseract-ocr-nor`, `poppler-utils`; faller ellers ærlig tilbake til tekstparser. Ekstraktor-valg (`src/api/main.ts`): AI når nøkkel finnes, ellers Tesseract, ellers tekstparser (`/api/integrations/status` viser hvilken modus som kjører). |

## Hva som trengs for å aktivere hver

### Gmail
Google Cloud-prosjekt med Gmail API, OAuth-samtykkeskjerm og klienthemmeligheter,
kun `gmail.readonly`-scope, kryptering av tokens før lagring i
`integration_connections.encrypted_credentials`, og en produksjonsadapter som
implementerer `GmailPort` (inkl. mapping til `GmailAuthError`-tilstandene).
Detaljer: `docs/google-workspace-integration.md`.

### Bank
Koden finnes (`GoCardlessBankFeedProvider`) — det som gjenstår er en avtale, ikke
ny kode: opprett bruker hos GoCardless Bank Account Data (gratis PSD2-aggregator),
generer `secret_id`/`secret_key`, kjør samtykkeflyten (requisition/end-user
agreement) for å få en konto-ID, og sett `REKNAREN_GOCARDLESS_SECRET_ID` +
`REKNAREN_GOCARDLESS_SECRET_KEY`. Da blir `bank.mode='psd2_gocardless'` og
`POST …/bank-accounts/:id/feed/sync` henter transaksjoner (via konto-IDen som
`connectionId`) inn i eksisterende import + matching. Manuell CSV fungerer uansett.

### EHF
XML-genereringen finnes (`renderEhfXml`, PEPPOL BIS Billing 3.0) og kan lastes ned
i dag. Det som gjenstår for AUTOMATISK overføring er en aksesspunkt-avtale: tegn
avtale med et PEPPOL-aksesspunkt, implementer `PeppolAccessPoint`-porten
(`src/invoicing/ehf.ts`) mot deres API, og injiser den i `main.ts`. Da svarer
`POST …/invoices/:id/ehf/send` med reell forsendelse i stedet for 503. Gjenstår i
kode før full BIS-samsvar: Schematron-validering + UBL CreditNote-syntaks for
kreditnota (avvises eksplisitt i dag).

### a-melding (lønn/arbeidsgiver)
Ikke påbegynt — og bevisst utsatt: a-meldingen forutsetter en lønnsmodul
(ansatte, lønnsarter, trekk, arbeidsgiveravgift) som ennå ikke finnes i Reknaren.
Å bygge a-melding-innsending før lønnsdataene eksisterer ville vært et skall uten
innhold. Rekkefølge: lønnsmodul → a-melding (samme Maskinporten-klient som
MVA-meldingen kan gjenbrukes for innsendingen).

### Altinn/Skatteetaten
Maskinporten-klienten finnes (`src/integrations/maskinporten.ts`). Det som gjenstår
for å aktivere er registrering hos Digdir, ikke ny kode: opprett en Maskinporten-
klient i Samarbeidsportalen (BankID/virksomhet), be om scopes
`altinn:instances.read altinn:instances.write`, generer nøkkelpar og last opp
offentlig JWK, og sett `MASKINPORTEN_ENV`, `MASKINPORTEN_CLIENT_ID`,
`MASKINPORTEN_SCOPE` (= de to Altinn-scopene), `MASKINPORTEN_PRIVATE_KEY` (PEM) og
`MASKINPORTEN_KEY_ID` (+ evt. `MASKINPORTEN_CONSUMER_ORG`). Da blir `active=true`.
Gjenstår i kode før reell innsending: XSD-validering av mva-melding-XML og full
Altinn 3-instansflyt i `submit()` (krever autorisert test-organisasjon).

> **Oppdatering 2026-08-19 (Skatteetaten Fagsupport, Heidi):** Scopet
> `skatteetaten:mvameldinginnsending` er **utfasa — ikkje i bruk lenger**. Innsending
> skjer mot **Altinn 3-appen** (`skd/mva-melding-innsending`), og Altinn krev
> **`altinn:instances.read` + `altinn:instances.write`** ved kall mot altinn3-appen.
> Valideringa (`skatteetaten:mvameldingvalidering`) er uendra. Token-veksling til
> Altinn-token skjer alt i `vat-submission.ts` (`exchange/maskinporten`). Doc:
> https://skatteetaten.github.io/api-dokumentasjon/api/mvameldinginnsending

### Lovdata API (per-paragraf lovtekst)
En Lovdata-utstedt API-nøkkel (`X-API-Key`), satt som `REKNAREN_LOVDATA_API_KEY`.
Da blir `LovdataApiClient.hasApiKey` sann, `fetchLegalText(refID)` henter ordrett
lovtekst via `/renderRefID`, og `/api/integrations/status` skifter til
`mode: 'api_key', active: true`. Nøkkel fås ved å opprette en API-konto hos Lovdata
(bruksvilkår + NLOD 2.0 for datagrunnlaget). De åpne bulk-datasettene
(`/v1/publicData/*`) krever derimot ingen nøkkel og virker allerede.

### OCR
En dokumentforståelses-/OCR-motor bak `DocumentExtractor`-porten. Output valideres
uansett av `src/documents/validate.ts`, og forslag må fortsatt validere mot
`postingSuggestionSchema` — ingen arkitekturendring kreves.
