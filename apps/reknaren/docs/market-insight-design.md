# Reknaren — Markedsinnsikt fra nyhets- og offentlige kilder

**Dato:** 2026-08-09
**Status:** Godkjent design, klar for implementeringsplan

## Formål

Gi brukeren økonomisk innsikt ved å tolke eksterne signaler (offentlige tall +
nyheter) opp mot deres **eget regnskap**. Dette utvider Reknarens eksisterende,
deterministiske innsikt (`ledger/planning.ts` «Framover», `ledger/ask.ts` «Spør
virksomheten») med et eksternt kontekst-lag — uten å bryte kjerneprinsippet:
*ærlig, ingen gjetting, tallene styrer*.

## Rammer (ufravikelige)

1. **Regulatorisk.** Personlig investeringsrådgivning (kjøp/selg verdipapirer,
   plasser overskuddet) er konsesjonspliktig (verdipapirhandelloven / MiFID II)
   og skal **ikke** leveres. Investerings-/plasseringsinnhold begrenses til
   *generell, ikke-personlig opplysning* med tydelig ansvarsfraskrivelse. All
   innsikt leveres som virksomhets- og makroinnsikt knyttet til brukerens tall.
2. **Opphavsrett / betalingsmur.** Ingen skraping eller gjengivelse av full
   artikkeltekst. Vi lagrer egen kort oppsummering + lenke, respekterer
   robots/ToS. Finansavisen/DN er bak mur → kun tittel + lenke inntil
   lisens/abonnement-API finnes.

## Arkitektur

Én motor, fire presentasjonsflater, tall-styrt.

```
Offentlige/nyhetskilder → [henting, cron] → market_signals (normalisert)
                                                     │
   org-eksponering (fra ledger + Brreg NACE) ───────┤
                                                     ▼
                              Innsikts-motor (deterministiske regler)
                                   │ regner kroner-effekt mot brukerens tall
                                   ▼
                              insight_cards  ──► 4 flater
                                   ▲
              (fase 2) Claude: oppsummer/ranger nyhet + forklar rundt tallene
```

### Kilder (gratis, konkrete)

| Kilde | Hva | Form | Fase |
|---|---|---|---|
| Norges Bank open API | Styringsrente, valutakurs (EXR) | JSON/XML, ingen nøkkel | v1 |
| SSB PxWebApi | KPI/prisvekst, bransje-omsetning, byggekostnad | JSON, gratis | v1 |
| Brønnøysund enhetsregister | NACE-kode (bransje) fra org.nr | JSON (brukes allerede) | v1 |
| E24 RSS | Bransjenyheter (tittel + ingress + lenke) | RSS | v2 |
| Regjeringen.no RSS | Satser, frister, statsbudsjett, støtteordninger | RSS | v3 |
| Finansavisen / DN | Kun tittel + lenke inntil lisens | RSS (begrenset) | v3 |

### Innsikts-motoren (deterministisk, ikke KI)

Regler som mapper (signal-endring × org-eksponering) → innsikts-kort med
beregnet kroner-effekt. Eksempler for v1:

- **Rente × gjeld:** Δstyringsrente × rentebærende gjeld (saldo på 2xxx-konti)
  → «Renta opp 0,25 → driftskreditten din koster ~2 400 kr mer/år».
- **KPI × kostnad:** KPI-/prisvekst × brukerens topp-kostnadskategorier
  → «Prisvekst i din varekost ~4,1 %».
- **Valuta-timing (fremover):** dagens NOK-kurs mot 90-dagers median. Kronen svak
  → «Utenlandskjøp i EUR er dyrere nå enn snittet — ikke-hastende innkjøp kan vente
  (~X kr mer på et typisk månedskjøp)». Kronen sterk → «rimeligere nå».
- **Valuta-retrospektiv (dine faktiske kjøp):** effektiv kurs betalt på bokførte
  utenlandskjøp siste 90 dager (fra `original_amount_minor` + bokført NOK) mot Norges
  Banks snittkurs → «På dine EUR-kjøp betalte du ~X kr mer enn snittet». Eksakt, ikke
  anslag. Informativt, aldri bebreidende («ingen kan time kursen perfekt»).

Claude brukes **ikke** i v1. Fra v2: kun til å oppsummere/rangere nyheter og
skrive forklaringsteksten *rundt* de deterministiske tallene — finner aldri opp
tall, alltid kildelenke.

### Personalisering (fra data som allerede finnes)

- NACE/bransje via Brreg (org.nr).
- Rentebærende gjeld: saldo på gjeldskonti.
- Valutaeksponering: bilag i utenlandsk valuta.
- Topp kostnadskategorier: fra hovedbok → hvilke SSB-indekser som er relevante.

## Datamodell (append-vennlig, matcher eksisterende stil)

- **`market_signals`** — `(source, kind, key, value, unit, period, published_at,
  url, raw)`. Dedup på `(source, key, period)`. Normaliserte eksterne signaler.
- **`insight_cards`** — `(organization_id, kind, title, body, impact_minor?,
  signal_refs, sources[], valid_until, dismissed_at, created_at)`. Regenereres
  ved signal-endring, caches til `valid_until`.
- **`news_items`** (fase 2) — `(source, title, url, summary, topics[],
  published_at)`. Vår egen oppsummering, aldri full brødtekst.

Migrasjoner følger eksisterende nummerert mønster; lat `ensureTable`-selvheler
der det passer (Render har ingen preDeployCommand — kjør migrasjon manuelt mot
prod-Neon før deploy).

## Presentasjon (impeccable, Operate-modus)

Nytt innhold i eksisterende designsystem («rolig norsk fintech», skoggrønn
`#1f4d3a` + gull `#b0913b`, kremflater, tabulære tall, mørk modus via system).
Ingen nye tokens — merkevaren lever i detaljene.

### Ny primitiv: `insight-card` (bygger på `.card`)

- **Venstre-stripe (3px) koder type** med eksisterende tokens: `--accent` =
  nøytralt signal, `--gold` = mulighet/oppside, `--warn` = fortjener
  oppmerksomhet. Farge = mening, ikke pynt.
- **Kroner-effekt stor + tabulær** (`.num`), over en ren forklaringslinje.
  Tallet er helten.
- **Fot:** kilde-chip (`.chip`, f.eks. «Norges Bank · 2d siden») + diskret
  «Ikke finansiell rådgivning»-lenke (gjenbruker `ai/disclosure.ts`). Avvisbar.
- `text-wrap: balance` på tittel; type-skala og fokus-ring fra systemet.

### Fire flater (én motor, ulik tetthet)

| Flate | Form | Tetthet |
|---|---|---|
| **Framover** (vevd) | Slank kontekst-rad ved likviditetskurven som binder makro til prognosen | 1–2 kort, inline |
| **Oversikt «Verdt å vite»** | `.panel` med topp 2–3 relevans-rangerte kort + «Se alle»; speiler `KomIGang`-mønsteret | 3 kort |
| **«Marked»-fane** (ny) | Topp: 3 makro-`.tile` (rente/KPI/valuta med pil + Δ + sparkline m/ uthevet endepunkt). Under: full kort-strøm + (fase 2) nyhetsliste | full |
| **Veke-digest** (e-post) | Merkevare-HTML, samme palett, topp 3 kort + lenke inn. Opt-in. Gjenbruker e-post-infra | ukentlig |

Makro-`.tile`: stor tabulær verdi, retningspil i `--ok`/`--danger`, `.tile-sub`
med periode, én sparkline-strek (siste 12 mnd).

## Cron, ytelse, kost

- Henting via cron (gjenbruker `REKNAREN_CRON_SECRET`-mønsteret): Norges Bank på
  publiseringsdager, SSB ved slipp, E24 RSS 3×/dag (fase 2).
- Per-org kort: regenereres ved signal-endring, caches med `valid_until`.
- **Deterministiske kort = null Claude-kost.** Claude kun i fase 2
  (nyhets-oppsummering, batch + cache per artikkel).

## Juridiske vakter (i kode)

- Aldri full brødtekst — egen kort oppsummering + lenke; respekter robots/ToS;
  Finansavisen/DN = tittel + lenke inntil lisens.
- Investeringsinnhold: kun generelt/opplysende + ansvarsfraskrivelse, aldri
  personlig kjøp/selg.
- Kildeattribusjon + «ikke finansiell rådgivning»-disclosure på hvert kort.

## Fasing

- **v1 (trygg kjerne):** offentlig ryggrad (Norges Bank rente + valuta, SSB KPI)
  → deterministiske kort i Framover + Oversikt «Verdt å vite». NACE via Brreg.
  Fire regler (rente/gjeld, KPI/kostnad, valuta-timing fremover, valuta-retrospektiv
  mot faktiske kjøp). FX-vindu fra Norges Bank (90-dager). Null KI, null nyhet.
- **v2:** E24 RSS + Claude oppsummer/ranger → «Marked»-fane + nyhet i kort.
- **v3:** veke-digest e-post; Regjeringen RSS skatte-/frist-varsel;
  Finansavisen/DN ved lisens.

## Ikke-mål

- Ingen personlig investerings-/plasseringsrådgivning.
- Ingen full-tekst-lagring eller -visning av opphavsrettsbeskyttet materiale.
- Ingen automatiske finansielle handlinger.
