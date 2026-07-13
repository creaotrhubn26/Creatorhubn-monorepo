# Kjente begrensninger

Ærlig liste over hva som mangler eller er forenklet per i dag. Ingen av punktene er
skjult for brukeren i API-et (integrasjonsstatus, estimat-forbehold osv. sier fra).

## Plattform

- **Enkelt web-UI.** SPA-en i `web/` dekker den vertikale flyten (oversikt,
  bilagsinnboks, bilagsdetalj med forklaring og godkjenning, Gmail-import,
  bank/avstemming, MVA, skatt, rapporter) og er røyktestet i browser
  (`scripts/ui-smoke.mjs`). De tre presentasjonsnivåene i `docs/ux-principles.md`
  (enkel/avansert/regnskapsfører) er fortsatt designmål — UI-et har ett nivå.
- **Dev-auth.** HMAC-token fra dev-login (`src/api/auth.ts`) er ikke produksjonsauth:
  ingen passord, ingen MFA, ingen token-tilbakekalling før TTL (12 t). Produksjon
  krever OIDC/BankID. RBAC og tenant-isolasjon er derimot reelle.
- **Objektlagring: lokal disk, ukryptert.** Dokumentinnhold lagres nå via
  `ObjectStorage`-porten (`src/storage/`) med sha256-integritetskontroll ved uthenting
  og audit-logg per tilgang. MVP-adapteren er lokal disk uten kryptering og redundans —
  produksjon krever S3-kompatibelt lager i EU/EØS med kryptering.

## Funksjonelt

- **Bank: manuell CSV-import, ikke PSD2.** Import (`src/bank/import.ts`), deterministisk
  matching med forklaring (`src/bank/matching.ts`) og godkjenningsflyt er implementert,
  men det finnes ingen bank-/open-banking-tilkobling — transaksjoner må limes inn som CSV.
  Kun utbetalinger matches (innbetalinger krever fakturamodulen). Splitting av én betaling
  på flere bilag støttes ikke ennå.
- **Faktura: kjernefunksjoner på plass, men ingen PDF, e-postutsending, EHF, purring
  eller delbetaling** (delbetaling registreres, men matching krever eksakt restbeløp).
  Tilbud/ordre og repeterende faktura er ikke bygget.
- **Ingen lønn** — konto 5000 finnes, men ingen a-melding/skattetrekk.
- **Ingen EHF** — XML aksepteres som filtype, men parses ikke.
- **SAF-T-eksport dekker hovedbok + masterdata.** Filen valideres mot Skatteetatens
  offisielle XSD (v1.10, vendored i `vendor/saft/`), men SourceDocuments-nodene
  (fakturadokumenter på dokumentnivå) og AnalysisTypeTable (dimensjoner) er ikke
  med ennå. Ikke testet mot Skatteetatens innsendingsvalidator i Altinn.
- **Ingen Altinn-innsending** — MVA-rapporten er alltid `draft`.

## Faglige forenklinger

- **OCR: Tesseract for bilder, pdftotext for PDF.** `OcrExtractor` (`src/pipeline/ocr.ts`)
  tolker kvitteringsbilder (nor+eng) og PDF-tekstlag; den tolkede teksten går gjennom
  samme validering OG prompt-injection-kontroll som annen tekst (tekst som kun finnes
  som piksler fanges — testet). Krever `tesseract-ocr` + `tesseract-ocr-nor` +
  `poppler-utils` på verten; uten dem faller systemet tilbake til ren tekstparser og
  sier fra i integrasjonsstatusen. OCR-kvalitet avhenger av bildekvalitet — mangelfulle
  uttrekk havner i kontrollkøen, de bokføres ikke.
- **2026-satser er uverifisert.** Lagt inn per kunnskapsdato 2026-01 med
  `verifiedBy: 'system-bootstrap'`; særlig trygdeavgiften for 2026 må kontrolleres mot
  Skatteetaten før produksjon (`docs/compliance-source-register.md`).
- **MVA-rapporten viser netto for omvendt avgiftsplikt (kode 86).** Beregnet utgående
  og fradragsberettiget inngående med samme kode aggregeres netto i rapportlinjen
  (`buildVatReport` i `src/vat/engine.ts`) i stedet for brutto begge veier slik
  mva-meldingen krever. Posteringene i hovedboken er korrekte (begge sider bokføres);
  det er rapportvisningen som må splittes før innsending.
- **Ingen delvis fradragsrett.** MVA-kodene er alt-eller-ingenting (`deductible`
  true/false); forholdsmessig fradrag ved delt bruk er ikke støttet. (Næringsandel på
  kostnadssiden støttes via `businessUsePercentage`, men da beregnes MVA av
  næringsdelen — ikke forholdsmessig fradrag etter mval. kap. 8.)
- **Ingen periodisering/avskrivningsautomatikk.** Saldogrupper og satser finnes som
  regelgrunnlag (`no.asset.depreciation-groups`), og forslagsmotoren flagger
  aktiveringskandidater, men ingen automatiske avskrivnings- eller
  periodiseringsposteringer genereres.
- **Skatteestimat for ENK er uten trinnskatt** (og uten personfradrag/minstefradrag) —
  kun 22 % alminnelig inntekt + trygdeavgift, med forutsetning om at hele overskuddet
  er personinntekt. Estimatet lister dette eksplisitt i `notIncluded`
  (`src/tax/estimate.ts`).
- Skattemessige justeringer (`taxAdjustmentsMinor`) er alltid 0 i MVP; representasjon,
  avskrivningsdifferanser og fremførbart underskudd er ikke medregnet.

## Drift/kvalitet

- Ingen rate limiting, ingen antivirus-skanning av vedlegg, ingen
  Brønnøysund-oppslag på leverandører.
- Ingen ytelses- eller lasttester; ingen UI- eller ekte OCR-tester
  (`docs/qa-matrix.md`).
