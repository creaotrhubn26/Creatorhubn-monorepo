# Kjente begrensninger

Ærlig liste over hva som mangler eller er forenklet per i dag. Ingen av punktene er
skjult for brukeren i API-et (integrasjonsstatus, estimat-forbehold osv. sier fra).

## Plattform

- **Ingen frontend.** Kun HTTP-API (`src/api/server.ts`). Presentasjonsnivåene i
  `docs/ux-principles.md` er designmål.
- **Dev-auth.** HMAC-token fra dev-login (`src/api/auth.ts`) er ikke produksjonsauth:
  ingen passord, ingen MFA, ingen token-tilbakekalling før TTL (12 t). Produksjon
  krever OIDC/BankID. RBAC og tenant-isolasjon er derimot reelle.
- **Ingen objektlagring.** Dokumentinnhold lagres **ikke** — kun sha256, metadata og
  en lokal `storage_key` (`src/documents/service.ts`). Oppbevaringsplikten for bilag
  (jf. `docs/data-retention.md`) kan derfor ikke oppfylles ennå, og det finnes ingen
  kryptering av dokumentlager.

## Funksjonelt

- **Ingen bank** — kun databaseskjema, ingen import/avstemming.
- **Ingen utgående faktura** og **ingen purring**.
- **Ingen lønn** — konto 5000 finnes, men ingen a-melding/skattetrekk.
- **Ingen EHF** — XML aksepteres som filtype, men parses ikke.
- **Ingen SAF-T-XML-eksport** — koder/kontoplan følger standarden, filen genereres ikke.
- **Ingen Altinn-innsending** — MVA-rapporten er alltid `draft`.

## Faglige forenklinger

- **OCR er en tekstparser.** `DeterministicTextExtractor` (`src/pipeline/extract.ts`)
  leser tekstbærende innhold med regex; skannede bilder gir tomt/mangelfullt uttrekk
  (som havner i kontrollkø, ikke bokføres feil).
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
