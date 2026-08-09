# Oppgave-artefakt-targeting + LMS-autorering — UI/UX-design

**Dato:** 2026-08-09
**Status:** Design til review (bygger på det godkjente konseptet i `2026-08-09-edu-assignment-artifact-targeting-design.md`)
**Forfatter:** Produktdesign (senior)
**Scope:** Tre frontend-flater — (1) faglærer-oppgaveautorering med artefakt + view-targeting, (2) DeepLinkPicker som full oppgaveautorering inne i Canvas/Moodle, (3) student-ankomst rett i Story Logic.

---

## Impeccable elevation pass

**Dato:** 2026-08-10 · **Lins:** Impeccable v3.5.0 (Paul Bakaus, impeccable.style) kjørt *over* det eksisterende specet. Ikke en omskriving — en craft-heving. Alt som allerede holdt er beholdt; deltaene er merket med **Impeccable:**-callouts i hver flate-seksjon.

**Register:** dette er entydig **product**, ikke brand — verktøyet *tjener* oppgaven, designet skal forsvinne. Impeccables product-gulv gjelder (WCAG AA, ≤4 i arbeidsminne, progressiv avdekking, fixed rem-skala), brand-heltereglene gjelder ikke. Ingen «AI-slop»-risiko her fordi paletten er merkevare-låst og arvet, ikke gjettet fra kategori.

**Referanseguider brukt (announced):**
- `polish.md` / **Absolute Bans** — fanget den viktigste feilen: side-stripe-kanten.
- `typography.md` — skala-ratio, arbeids-hierarki via vekt, `tabular-nums`.
- `cognitive-load.md` — Millers ≤4 i arbeidsminne, chunking av felt-grupper.
- `motion-design.md` — exit = 75 % av enter, ease-out-eksponential-kurve, blur som materiale.
- `ux-writing.md` — tredelt feilformel (hva skjedde → hvorfor → hva nå), verb+objekt-knapper, aldri utropstegn i feil.
- `color-and-contrast.md` — ikke-farge-avhengige statussignaler.

**De seks deltaene (høyest impact først):**

1. **[P0] Side-stripe-kanten fjernes (Flate C + Flate A-xs).** Det gamle specet foreslo `borderLeft: 3px solid #8B5CF6` på student-kontekststripen (og en «venstrekant-aksent» som mobil-fallback i Flate A). Dette er en **Absolute Ban** i Impeccable (>1px farget side-kant på callout/kort/listeelement). Verre: det matcher *ikke engang* huset — den ekte `RailTips` (`_eduUi.tsx:40`) bruker **full 1px-kant + lav-alfa vask** (`bgcolor: rgba(139,92,246,0.09)`, `border: 1px solid rgba(139,92,246,0.26)`). Retting = bruk den ekte RailTips-behandlingen. Mer on-brand *og* ban-ren på én gang.
2. **[P1] Hierarki via vekt/tall, ikke via flat skala.** 14 / 12.5 / 10.5 er ratio ~1.12 — under 1.25-terskelen. I product-register blåser vi ikke opp størrelsen (fixed rem), vi lar **vekt + `font-variant-numeric: tabular-nums`** bære hierarkiet. Frister, «{n} dager på overtid» og teller-tall får tabular-nums så de ikke rykker.
3. **[P1] Arbeidsminne: Flate A leses som 4 grupper, ikke 5 felt.** Rad 3 er nå Kull/Emne/Produksjon/Artefakt/Steg = 5 kontroller (over ≤4). Accent-ringen rundt Artefakt+Steg er ikke bare kobling — den **chunker** paret til én enhet, så øyet teller 4 beslutninger, ikke 5. Reframet eksplisitt som cognitive-load-tiltak.
4. **[P2] Feilcopy fullføres til tredelt formel.** «Kunne ikke publisere: {årsak}. Ingenting ble lagt til i Canvas.» sier hva + beroliger, men ikke *hva nå*. Legg til handling: «Sjekk at produksjon og kull er valgt, og prøv igjen.» Ingen utropstegn (allerede rent).
5. **[P2] Status aldri kun via farge.** Frist-«overtid» var rosa/fet — fargen bærer betydning alene. Teksten «{n} dager på overtid» + et lite ikon gjør signalet lesbart uten farge (WCAG 1.4.1). Levert = emerald *chip med tekst «Levert»*, ikke bare grønn prikk.
6. **[P3] Motion-konformans bekreftet + strammet.** Husets `cubic-bezier(0.23,1,0.32,1)` er samme ease-out-quint-familie som Impeccables anbefaling `cubic-bezier(0.25,1,0.5,1)` — beholdes. Exit-forhold justert til rene 75 % (enter 220ms → exit 165ms), og blur-krysstoningen på bekreftelses-hint/levert er eksplisitt sanksjonert som «materiale» (motion-design.md), ikke pynt.

**Heuristikk-miniscan (Nielsen, 0–4):** Synlighet av status **4** (bekreftelses-hint + sende-spinner), Match med virkeligheten **4** (norsk faglærer-språk), Brukerkontroll **3** (ingen angre på levering ennå — se åpent punkt), Konsistens **4** (arver `_eduUi`), Feilforebygging **4** (view kan aldri sette fast), Gjenkjenning **4** (Min side-språk gjenbrukt), Fleksibilitet **3**, Estetikk/minimalisme **4** (etter side-stripe-fjerning), Feil-recovery **4** (etter delta 4), Hjelp **3**. **Sum ≈ 37/40 — «Ship-ready»** etter deltaene over.

**Åpent punkt Impeccable reiser:** levering har ingen angre-vindu (`ux-writing.md` foretrekker undo over bekreftelsesdialog). «Rediger levering» dekker det delvis; vurder et 5-sek «Angre»-snackbar rett etter Lever før drawer-en lukkes helt. Ikke blokkerende for ship.

---

## 0. Designspråk og hvilke skill-prinsipper som er brukt

**Design read:** Dette er *produkt-UI* i et etablert, nylig polert MUI-arbeidsrom — ikke en landingsside. Målgruppen er faglærere (konsentrert autorering, ofte midt i Canvas) og studenter (ofte på iPad/iPhone). Riktig register er **rolig, sikkert, tilbakeholdent** — verktøyet skal være til å stole på. Ingen fremmed designsystem introduseres; alt arves fra `_eduUi.tsx` og de eksisterende fanene.

**Etablerte tokens (gjenbrukes 1:1, ikke gjenoppfunnet):**

| Token | Verdi | Rolle |
| --- | --- | --- |
| Bakgrunn | `#0a0a0a` | App-lerret (full flate) |
| `ACCENT` | `#8B5CF6` | Primær lila — merkevare-eid, brukes låst på hele flaten |
| Aksent lys | `#c4b5fd` / `#e9d5ff` | Ikon-glyph / chip-tekst |
| `CARD` | `rgba(255,255,255,0.035)` | Panel-fyll |
| `BORDER` | `1px solid rgba(255,255,255,0.08)` | Panel-kant |
| Aktiv-kant | `rgba(139,92,246,0.35)` | Åpent skjema / valgt tilstand |
| Sky | `#38bdf8` | Emne / «Pågår» |
| Amber | `#f59e0b` | Arbeidskrav |
| Rosa | `#ec4899` | Eksamen / overtid |
| Emerald | `#10b981` | Levert / vurdert / suksess |
| Radius | `3` (24px `Panel`), `2` (16px felt/knapp) | Ett radius-system, låst |
| Tekst sekundær | `rgba(255,255,255,0.72)` | Hjelpetekst (kontrast > 4.5:1 mot `#0a0a0a`) |

**Prinsipp-syntese (announced):**

- **frontend-design** — «match the established language, spend boldness in one place.» Ingen ny palett. Den *ene* signaturbevegelsen på tvers av alle tre flatene er **artefakt → Steg-progressive disclosure**: et sekundærfelt som folder seg ut kun når det bærer informasjon. Alt annet er stille.
- **taste-skill** — dette er kategorisk «product UI», ikke landing; anti-hero-reglene gjelder ikke, men gulvreglene gjør: WCAG AA-kontrast, 44×44 touch, én aksent låst, ett radius-system, empty/loading/error-tilstander. Microcopy-selvrevisjon kjørt. (Tankestrek «—» beholdes kun der huset allerede bruker den som norsk typografi; ny prosa bruker vanlig bindestrek.)
- **ui-ux-pro-max** — Prioritet 1–2 (Accessibility, Touch): labels alltid synlige (MUI flytende label, aldri placeholder-as-label), fokusring bevart, 44px minsteflate på student-iPad. Prioritet 8 (Forms): feil ved feltet, progressiv avdekking av avanserte felt.
- **emil-design-eng** — animasjonsbeslutning per interaksjon: Steg-feltet og ankomst-banneret *entrer*, altså `ease-out`, < 300ms; ingen animasjon på ting faglærer gjør titalls ganger; `scale(0.97)` på trykk; aldri `scale(0)`; `prefers-reduced-motion` respektert. Exit raskere enn enter.

**Motion-dial:** lav-middels (3–4). Dette er et tillitsverktøy; bevegelse tjener forståelse (avdekking, ankomst-kontekst), aldri pynt.

---

## 1. Flate A — Faglærer-oppgaveautorering: Artefakt + Steg (view-targeting)

**Fil:** `AssignmentsTab.tsx`, «Ny oppgave»-skjemaet (`<Collapse in={creating}>`, linje 199–240).
**Endring:** Artefakt-velgeren får en betinget søster — **Steg** — som kun finnes når Artefakt = Story Arc.

### 1.1 Layout og hierarki

Dagens rad 3 i skjemaet er `[Kull] [Emne] [Produksjon] [Artefakt]` (fire `TextField select`, `direction row` på `sm+`). Story Arc-utvidelsen legger **Steg** som et femte, betinget felt *rett etter* Artefakt — visuelt bundet til det, ikke en ny rad. Relasjonen leses «Artefakt = Story Arc, presiser hvilket Steg».

Progressiv avdekking i to trinn (frontend-design-signaturen):

1. **Artefakt** er deaktivert til en produksjon er valgt (dagens `disabled={!f.productionId}` beholdes).
2. **Steg** eksisterer ikke i DOM før `artifactKind === 'story-arc'`. Det gled inn via `<Collapse orientation="horizontal">` (sm+) / vertikal (xs).

```
Rad 3 (sm+), Artefakt = «Story Arc» valgt:

┌─ Kull ────┐ ┌─ Emne ────┐ ┌─ Produksjon ─┐ ┌─ Artefakt ──┐ ┌─ Steg ─────────┐
│ Vår 25 ▾ │ │ FILM101 ▾ │ │ Kortfilm A  ▾│ │ Story Arc ▾ │ │ Story Logic  ▾ │   ← glir inn
└──────────┘ └───────────┘ └──────────────┘ └─────────────┘ └────────────────┘
                                              accent-ring     accent-ring (aktiv)

Artefakt = «Storyboard» (eller annet): Steg finnes ikke.
┌─ Kull ────┐ ┌─ Emne ────┐ ┌─ Produksjon ─┐ ┌─ Artefakt ──┐
│ Vår 25 ▾ │ │ FILM101 ▾ │ │ Kortfilm A  ▾│ │ Storyboard ▾│
└──────────┘ └───────────┘ └──────────────┘ └─────────────┘
```

**Visuell kobling:** når Steg er synlig får både Artefakt og Steg en 1px `rgba(139,92,246,0.35)`-ring (samme som aktivt skjema-panel), så øyet leser dem som ett sammensatt valg. De andre feltene beholder nøytral `rgba(255,255,255,0.12)`-kant. Dette er den *eneste* fremhevingen — ingen badge, ingen hjelpe-sub-setning.

> **Impeccable (cognitive-load.md):** rad 3 er nå 5 kontroller (Kull/Emne/Produksjon/Artefakt/Steg) — over Millers ≤4-grense for arbeidsminne. Accent-ringen rundt Artefakt+Steg gjør *dobbel* jobb: den kobler valget visuelt **og chunker paret til én beslutningsenhet**, så faglæreren teller «4 grupper», ikke «5 felt». Bruk derfor en delt subtil bakgrunnsvask (`rgba(139,92,246,0.05)`) bak Artefakt+Steg-paret i tillegg til ringen — proksimitet + felles flate = chunk. Ringen alene bærer ikke chunkingen på tvers av kolonne-gap.

### 1.2 Komponentvalg (MUI)

- **Steg** = `TextField size="small" select` — identisk med de fire andre, slik at feltet ikke leser som en fremmed kontroll. `sx={{ minWidth: 150 }}` (matcher Artefakt).
- **Avdekking** = `Collapse` fra MUI (`orientation="horizontal"` på `sm+`, standard vertikal på `xs`). MUI `Collapse` bruker allerede `ease` timing; vi overstyrer til husets ease-out (se §Motion).
- **Ring på par** = betinget `sx`, ikke ny komponent.

**Options (fra spec, eksakt):**
```ts
const STEG_OPTIONS = [
  { key: '', label: 'Hele Story Arc' },     // artifactView = null
  { key: 'story-logic', label: 'Story Logic' },
  { key: 'story-writer', label: 'Story Writer' },
];
```

**State:** utvid `f` med `artifactView: ''`. Ved `setField('artifactKind', v)` der `v !== 'story-arc'`: nullstill `artifactView` i samme oppdatering (ellers henger en skjult view-verdi igjen). Ved create: `artifactView: (f.artifactKind === 'story-arc' && f.artifactView) ? f.artifactView : undefined`.

### 1.3 Tilstander (empty / filled / disabled / error)

| Tilstand | Utseende | Copy |
| --- | --- | --- |
| **Produksjon ikke valgt** | Artefakt deaktivert (0.5 opacity), Steg fraværende | Artefakt `helperText`: «Velg produksjon først» (dagens) |
| **Produksjon valgt, Artefakt = Fri leveranse / annet** | Artefakt aktiv, Steg fraværende | ingen |
| **Artefakt = Story Arc, Steg urørt** | Steg synlig, default «Hele Story Arc» | Steg `helperText` (kun ved fokus/hjelp): «Lander studenten i studio-hubben» |
| **Steg = Story Logic (filled)** | Begge felt accent-ring; tabellrad får to chips | Steg valgt: «Story Logic» |
| **Feil (create feilet)** | Eksisterende `<Alert severity="error">` øverst | «Kunne ikke opprette oppgave» (dagens) |

Det finnes ingen egen error-tilstand *på* Steg — en tom/ukjent view er alltid gyldig (faller tilbake til hele fanen, per spec §Feilhåndtering). Dette er bevisst: velgeren kan aldri sette faglærer fast.

### 1.4 Tabellrad-konsekvens (lese-tilbake)

Dagens rad viser en lilla `artifactLabel`-chip. Når `artifactView` finnes vises **to chips** side ved side, den andre lysere/svakere, så «hva slags oppgave er dette» leses på ett blikk:

```
Skriv en Story Logic i dag   [FILM101] [Arbeidskrav] [Story Arc] [Story Logic]
Produksjon · Kortfilm A                                  ^lilla     ^lilla-svak
```

Steg-chip: `bgcolor: 'rgba(139,92,246,0.10)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.28)'` (outline-variant av artefakt-chip, så de leses som forelder/barn). Vises kun når `a.artifactView` er satt.

### 1.5 Typografi og spacing-intensjon

Ingen avvik fra skjemaets etablerte rytme: `Stack spacing={1.5}` mellom rader, `size="small"` felt (høyde ~40px), label 12px flytende. Steg arver alt. Målet er at et faglærer-øye *ikke* skal registrere at noe nytt kom til — bare at Story Arc nå har et ekstra hakk.

### 1.6 Interaksjon / motion (emil-design-eng)

- Steg **entrer** når Story Arc velges → `ease-out`, 200ms, `Collapse` med `easing: 'cubic-bezier(0.23,1,0.32,1)'`. Bredde+opacity sammen (horisontal collapse gir bredde gratis; legg `opacity` via `sx` transition så det ikke «popper» tomt).
- Steg **forlater** når Artefakt endres bort fra Story Arc → 140ms (exit raskere enn enter). Ingen etterslep.
- Ring-på-par: `transition: border-color 160ms ease-out`.
- Ingen bevegelse på selve select-åpningen utover MUI-standard.
- `prefers-reduced-motion`: `Collapse` → umiddelbar (MUI respekterer dette via theme; sett `theme.transitions` eller `timeout={0}` under reduced motion). Feltet dukker opp uten glid, fortsatt fullt brukbart.

### 1.7 Mobil (xs)

Skjemaet stabler allerede til én kolonne (`direction={{ xs: 'column', sm: 'row' }}`). På `xs` blir Steg en full-bredde rad rett under Artefakt, vertikal `Collapse`. Touch-flate på select ≥ 44px (MUI `size="small"` er 40px; hev til `minHeight: 44` på `xs` via `sx`).

> **Impeccable (Absolute Bans):** den opprinnelige «venstrekant-aksent kan erstatte full ring»-fallbacken er **strøket**. En >1px farget side-kant er en absolutt ban (og huset bruker den ikke). På `xs` beholder paret i stedet den fulle ringen + den delte vasken fra §1.1 rundt begge feltene som nå er stablet — samme chunk-signal, ingen side-stripe.

---

## 2. Flate B — DeepLinkPicker som full oppgaveautorering i Canvas/Moodle (FLAGGSKIP)

**Fil:** `DeepLinkPicker.tsx`. I dag: velg/opprett produksjon → send lenke. Blir: **full oppgave-autorering** i en modal-i-LMS-kontekst, som lager en ekte `role_room_education_assignments`-rad og deep-linker studenten til artefakt-viewet.

### 2.1 Kontekst-diagnose (hvorfor dette er annerledes enn Flate A)

Faglærer er **midt i Canvas/Moodle**, i en iframe/popup, med ett mål: *legg denne oppgaven inn i dette emnet nå*. Det betyr:

- **Ett fokus, én primærhandling.** Ikke KPI-kort, ikke tabell, ikke navigasjon. Bare skjemaet og «Publiser til Canvas».
- **Rask vei til det vanlige.** «Publiser en Story Logic-oppgave» må gå på få klikk. Avanserte felt (arbeidskrav/eksamen/vurderingsform/læringsmål) er *foldet vekk* til faglærer ber om dem.
- **Trygg retur.** Ved feil: tydelig melding i pickeren, aldri et halvt innholdselement sendt til LMS (per spec §Feilhåndtering).

Dagens shell (`minHeight 100vh`, `#0a0a0a`, `maxWidth 640`, sentrert) beholdes — den er allerede riktig for en fokusert modal-i-iframe. Vi utvider innholdet, ikke rammen.

### 2.2 Layout og hierarki

Vertikal, seksjonert enkeltkolonne. Rekkefølge = mental modell «hva, hvor, når, hvordan vurderes»:

```
┌──────────────────────────────────────────────── maxWidth 560 ──┐
│  ◧  Publiser oppgave til Canvas                                  │  header (ikon + tittel + 1 linje)
│     Oppretter oppgaven og legger en direkte lenke i emnet.       │
│                                                                  │
│  ┌─ Produksjon ────────────────┐ ┌─ Kull ──────────────┐        │  1. HVOR
│  │ Kortfilm A              ▾  │ │ Vår 25           ▾  │        │
│  └────────────────────────────┘ └─────────────────────┘        │
│  › Opprett ny produksjon                                        │  disclosure (link-stil)
│                                                                  │
│  ┌─ Artefakt ─────────┐ ┌─ Steg ──────────────┐                 │  2. HVA (view-targeting)
│  │ Story Arc      ▾  │ │ Story Logic     ▾  │                 │  Steg glir inn (gjenbruk §1)
│  └────────────────────┘ └─────────────────────┘                 │
│                                                                  │
│  ┌─ Tittel ───────────────────────────────────────────────┐    │  3. HVA studenten ser
│  │ Skriv en Story Logic i dag                             │    │
│  └────────────────────────────────────────────────────────┘    │
│  ┌─ Brief ────────────────────────────────────────────────┐    │
│  │ (2 rader)                                              │    │
│  └────────────────────────────────────────────────────────┘    │
│  ┌─ Frist (dato) ─────────┐                                     │
│  │ 12. sep 2026        📅 │                                     │
│  └────────────────────────┘                                     │
│                                                                  │
│  › Flere valg (læringsmål, arbeidskrav, vurderingsform)         │  4. AVANSERT (foldet)
│  ┌ (Collapse) ────────────────────────────────────────────┐    │
│  │ Læringsmål …                                           │    │
│  │ Vurderingsform ▾   ☐ Arbeidskrav   ☐ Eksamen           │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            Publiser til Canvas          ●→                │  │  PRIMÆR (full bredde, sticky)
│  └──────────────────────────────────────────────────────────┘  │
│  Studenten lander rett i Story Logic.                           │  bekreftelses-hint (dynamisk)
└──────────────────────────────────────────────────────────────────┘
```

**Hierarkiet i tre nivåer:** (1) alltid synlig og påkrevd = Produksjon, Artefakt/Steg, Tittel; (2) synlig men valgfritt = Kull, Brief, Frist; (3) foldet = alt vurderings-relatert. Dette er den progressive avdekkingen taske- og emil-prinsippene ber om: den raske veien til «Story Logic-oppgave» krever bare Produksjon + Story Arc + Story Logic + Tittel + Publiser.

### 2.3 Komponentvalg (MUI)

| Del | Komponent | Notat |
| --- | --- | --- |
| Header | `Stack` + ikon-boks (dagens) | Ikon byttes fra ren produksjon til oppgave-metafor; behold 44px lilla boks |
| Produksjon / Kull / Artefakt / Steg / Vurderingsform | `TextField select` | Gjenbruk **eksakt** Steg-avdekkingen fra §1 (delt `<ArtifactStegFields>`-hjelper anbefales — se §Gjenbruk) |
| «Opprett ny produksjon» | `Collapse` bak en tekstlenke, ikke alltid-synlig `Card` | I dag er opprett-kortet dominant; her nedtones det til en disclosure, siden det vanlige er å velge eksisterende |
| Tittel / Brief / Læringsmål | `TextField` (Brief `multiline minRows={2}`) | Som `AssignmentsTab` |
| Frist | `TextField type="date"` (native) | `InputLabelProps={{ shrink: true }}`; native gir iPad-datovelger gratis (ponytail: ingen date-lib) |
| Flere valg | `Collapse` + tekstlenke-toggle | Chevron roterer 180° på åpne |
| Arbeidskrav / Eksamen | `Checkbox` (gjensidig `disabled`, dagens mønster) | Amber / rosa checked-farge |
| Primærhandling | `Button variant="contained"` full bredde | Lilla, `position: sticky; bottom: 0` med gradient-scrim over `#0a0a0a` så den aldri forsvinner ved scroll i iframe |
| Feil | `Alert severity="error"` | Beholdes øverst, dagens |

### 2.4 Primærhandling og sekundær

- **Primær:** `Publiser til Canvas` (eller `Publiser til Moodle` — utled fra launch-plattform hvis tilgjengelig, ellers nøytralt `Publiser oppgaven`). Full bredde, sticky bunn. `disabled` til Produksjon + Tittel finnes. Trykk-tilstand: label → `Publiserer…` + `CircularProgress size={16}`.
- **Ingen «Avbryt»-knapp i skjemaet** — i en LMS-deep-link lukker faglærer vinduet/avbryter fra LMS-chromet selv. En egen avbryt duplirer LMS-kontroller og legger til intensjonsstøy (taske: no duplicate-intent).
- **Bekreftelses-hint under knappen** (dynamisk, dette er den lille emil-detaljen): når Steg = Story Logic → «Studenten lander rett i Story Logic.» Når Hele Story Arc → «Studenten lander i Story Arc-studio.» Når artefakt tomt → «Studenten åpner produksjonen.» Faglærer ser konsekvensen *før* de sender.

### 2.5 Tilstander

| Tilstand | Utseende | Copy |
| --- | --- | --- |
| **Laster** | `CircularProgress` sentrert (dagens) | — |
| **Tom (ingen produksjoner)** | Produksjon-select tom → «Opprett ny»-disclosure auto-åpen | «Ingen produksjoner ennå. Opprett en for å starte.» |
| **Klar minimum** (Produksjon + Tittel) | Primærknapp aktiv | knapp: «Publiser til Canvas» |
| **Sender** | Knapp spinner, felt `disabled`, ingen navigasjon | «Publiserer…» |
| **Feil ved opprettelse** (manglende kull/produksjon, backend-avvisning) | `Alert` øverst, skjema intakt, INGEN POST til Canvas fullført | «Kunne ikke publisere: {årsak}. Ingenting ble lagt til i {LMS}. Sjekk at produksjon og kull er valgt, og prøv igjen.» |
| **Suksess** | `submitToCanvas` POSTer JWT → LMS overtar | (LMS lukker/redirecter; ingen egen suksess-skjerm nødvendig) |

Feil-copyen er bevisst eksplisitt om at *ingenting ble sendt* — det er tillitshandlingen på flaggskip-flaten (taske: errors explain what happened and reassure the trust boundary).

> **Impeccable (ux-writing.md):** feilen fullfører nå den tredelte formelen *hva skjedde → hvorfor/tilstand → hva nå*. «Ingenting ble lagt til» beroliger tilstanden; «Sjekk at produksjon og kull er valgt, og prøv igjen» gir handlingen. Ingen utropstegn, aldri skyld på faglæreren. `{årsak}` må være menneskelesbar (ikke rå backend-kode) — map kjente feil til norske setninger, ukjente til «en teknisk feil oppstod».

### 2.6 Typografi og spacing-intensjon

- `maxWidth` fra 640 → **560**: strammere leseflate i iframe, ett fokus.
- Seksjonsavstand: `Stack spacing={2}` mellom logiske grupper, `spacing={1.25}` innad. Diskré `Divider`/luft mellom «Hva studenten ser» og «Flere valg».
- Sticky primærknapp: `pt: 2` med `linear-gradient(transparent, #0a0a0a 40%)`-scrim (16px over knappen) så innhold som scroller under den ikke leser hardt-kuttet.
- Tittel-feltet er visuelt det største/tydeligste tekstfeltet (det er studentens overskrift) — samme størrelse som andre, men står alene på egen rad = får vekt via posisjon, ikke skalering.

### 2.7 Interaksjon / motion

- **«Flere valg»-Collapse:** enter 220ms ease-out, exit 160ms. Chevron rotasjon `transition: transform 200ms ease-out`.
- **«Opprett ny produksjon»-Collapse:** samme.
- **Steg-avdekking:** identisk med §1.6.
- **Primærknapp:** `:active { transform: scale(0.985) }` 120ms — flaten *lytter*. (Litt mindre enn 0.97 fordi knappen er full-bredde; stor flate + stor skala føles slapt.)
- **Bekreftelses-hint:** krysstoning når teksten endres — `filter: blur(2px)` + opacity 150ms mens strengen bytter (emil blur-mask), så det ikke «hopper» mellom setninger.
- Ingen entré-choreografi på hele skjemaet ved mount (faglærer venter på å jobbe, ikke på en show-reel). `prefers-reduced-motion`: alle Collapse → timeout 0.

> **Impeccable (motion-design.md):** exit-varighetene er strammet til rene ~75 % av enter (Collapse: enter 220ms / exit 165ms; hint-krysstoning holder 150ms). Husets `cubic-bezier(0.23,1,0.32,1)` er samme ease-out-quint-familie som Impeccables `cubic-bezier(0.25,1,0.5,1)` — beholdes, ikke byttet. Blur-krysstoningen på bekreftelses-hintet er sanksjonert som *materiale* (blur/mask), ikke pynt: den formidler at samme UI-element bytter tilstand, ikke at et nytt kom til. `Flere valg`-Collapse avslører 4 kontroller (Læringsmål/Vurderingsform/Arbeidskrav/Eksamen) = akkurat på ≤4-grensen; hold dem som én visuell gruppe med felles luft, ikke spredt.

### 2.8 Mobil (faglærer kan authore fra iPad i Canvas-appen)

- Alt stabler til én kolonne under `sm`. Produksjon+Kull, Artefakt+Steg blir vertikale par.
- Native `type="date"` gir iOS-hjulvelger gratis.
- Sticky primærknapp respekterer `env(safe-area-inset-bottom)` (`pb: 'max(16px, env(safe-area-inset-bottom))'`) så den ikke havner under iPad-home-indikatoren.
- Touch-flater ≥ 44px; disclosure-lenker får `py: 1` for trygg tapp.

---

## 3. Flate C — Student-ankomst: oppgave → Story Logic-landing

**Kontekst:** Student åpner en artefakt-targetet oppgave (fra «Min side»-`StudentWorkspace.tsx` eller direkte LMS-lenke) og lander *rett i* Story Logic-viewet i `story-arc-studio`-fanen (`edu=1`, samme tab). Målet: en **lett, ikke-blokkerende kontekst-affordanse** som minner om *hva* oppgaven er (tittel, brief, frist) og tilbyr «Min side» tilbake + «Lever» — uten å kapre Story Logic-verktøyet.

### 3.1 Prinsipp: en tynn kontekst-stripe, ikke en modal

Story Logic-verktøyet («Storylogikk-system», 3 faser Konsept/Logline/Tema) er der studenten skal jobbe. En modal eller overlay ville blokkert arbeidet og måttet lukkes — feil for noe som skal minne, ikke avbryte. Løsningen er en **oppgave-kontekststripe** som legger seg som et tynt bånd øverst i verktøy-viewet (under produksjons-chromet, over Story Logic-headeren), synlig men aldri i veien.

```
Story Logic-view med oppgave-kontekst:

┌────────────────────────────────────────────────────────────────────┐
│ ◧  Oppgave · Skriv en Story Logic i dag        Frist 12. sep  ▾    │  ← kontekststripe (collapsed)
│    Valider konseptet før du skriver. Lever når loglinen sitter.     │     (brief, 1 linje trunkert)
│    [ ← Min side ]                                   [ Lever ▲ ]     │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Storylogikk-system                                                │  ← verktøyet, urørt
│   ● Konsept   ○ Logline   ○ Tema                                     │
│   …                                                                  │
```

- **Collapsed (default):** to linjer — tittel + frist på rad 1, brief (trunkert) på rad 2, to handlinger på rad 3. Full 1px lilla hairline-kant + lav-alfa vask knytter den til edu-konteksten uten å rope.

> **Impeccable (Absolute Bans + polish.md) — flaggskip-rettingen:** den opprinnelige «3px lilla venstre-aksent» er **fjernet**. En >1px farget side-kant på en callout er en absolutt ban, *og* den matcher ikke huset: den ekte `RailTips` i `_eduUi.tsx:40` bruker `bgcolor: rgba(139,92,246,0.09)` + `border: 1px solid rgba(139,92,246,0.26)` hele veien rundt. Stripen adopterer nøyaktig den behandlingen — mer on-brand og ban-ren samtidig. Aksenten kommer nå fra vasken + hairline-ringen + «Lever»-knappens lilla fyll, ikke fra en kant-strek. (Se oppdatert `sx` i §3.2.)
- **Ekspandert (chevron / tap):** brief vises i full lengde, læringsmål (om satt), leveringsstatus. `Collapse`, ikke ny rute.
- **Dismiss-adferd:** stripen *lukkes ikke bort* (den er oppgavens hjemknapp), men kan minimeres til en enkelt-linje pille ved scroll ned (se §3.6) så den ikke tar vertikal plass mens studenten jobber.

### 3.2 Komponentvalg (MUI)

| Del | Komponent | Notat |
| --- | --- | --- |
| Stripe-container | `Paper`/`Box` `position: sticky; top: 0; z-index` over verktøyet | `bgcolor: rgba(139,92,246,0.09)`, `border: 1px solid rgba(139,92,246,0.26)` (full ring, **ikke** `borderLeft`), radius 2. Gjenbruker `RailTips`-behandlingen `_eduUi.tsx:40` 1:1 — én kilde til sannhet, ingen side-stripe |
| Tittel-linje | `Typography` 14px 700 + `Chip` frist | Frist-chip rosa hvis overtid (`relDue().overdue`) |
| Brief | `T`/`Typography` 12.5px sekundær, `noWrap` collapsed | CMS-tagget om ønskelig |
| «Min side» | `Button variant="text"` `startIcon={<ArrowBack>}` | Navigerer tilbake (samme-tab, `asStudent`) |
| «Lever» | `Button variant="contained"` lilla `startIcon={<Upload>}` | Åpner leverings-sheet |
| Ekspander | `IconButton` chevron | Roterer 180° |
| Leverings-sheet | MUI `Drawer anchor="bottom"` (mobil) / `Popover` (desktop) | Gjenbruker `AssignmentSubmit`-logikken fra `StudentWorkspace` (lenke + kommentar + Lever) |

### 3.3 «Lever»-flyten (gjenbruk, ikke ny)

«Lever» skal ikke sende studenten bort fra Story Logic. Trykk åpner en **bottom `Drawer`** (mobil-først) med nøyaktig samme felt som eksisterende `AssignmentSubmit` (linje 312–360 i `StudentWorkspace`): «Lenke til arbeidet», «Kommentar (valgfritt)», primær «Lever». Etter levering: drawer lukkes, «Lever»-knappen i stripen blir en emerald `Chip` «Levert» (eller «Innlevert» hvis vurdert). Ingen sидe-navigasjon, ingen tapt arbeidskontekst.

```
[ Lever ] trykket  →  Drawer glir opp fra bunn (mobil):

        ┌──────────────────────────────────┐
        │  Lever arbeidet                   │
        │  ┌─ Lenke (video / Drive) ─────┐  │
        │  │ https://…                   │  │
        │  └─────────────────────────────┘  │
        │  ┌─ Kommentar (valgfritt) ─────┐  │
        │  └─────────────────────────────┘  │
        │            [ Avbryt ]  [ Lever ]  │
        └──────────────────────────────────┘
```

### 3.4 Tilstander

| Tilstand | Utseende | Copy |
| --- | --- | --- |
| **Ikke levert** | «Lever»-knapp lilla, aktiv | «Lever» |
| **Frist nær (< 3 dager)** | Frist-chip amber | «Frist {dato}» |
| **Overtid** | Frist-chip rosa, fet | «{n} dager på overtid» |
| **Levert (ikke vurdert)** | «Lever» → emerald outline-chip «Levert»; sekundær «Rediger levering» | «Levert» |
| **Vurdert** | Chip «Vurdert» emerald; ekspandert stripe viser karakter/feedback | «Vurdert · Karakter: {grade}» |
| **Uten frist** | Ingen frist-chip | — |
| **Ukjent view / verktøyet lastes** | Stripe vises straks (kun oppgave-data, uavhengig av verktøy-hydrering); hvis oppgave-data ennå ikke er hentet: stripe skjult, ingen skjelett-flimmer | — |

Stripen er **aldri en feiltilstand**: mangler `artifactView`, lander studenten i studio-hubben og stripen sier fortsatt «Oppgave · {tittel}». Robusthet over presisjon (spec §Feilhåndtering).

### 3.5 Typografi og spacing

- Stripe-høyde collapsed: ~68px (to tekstlinjer + handlingsrad). Bevisst tynn — verktøyet eier skjermen.
- Padding `px: 2, py: 1.25`; på iPad `py: 1.5` for touch-luft.
- Tittel 14/700, brief 12.5/sekundær, chip 10.5. Samme skala som `StudentWorkspace`-oppgavekort → studenten kjenner igjen «oppgave»-språket fra Min side.
- Aksent (**Impeccable-oppdatert**): lav-alfa lilla vask (`rgba(139,92,246,0.09)`) + full 1px hairline-ring er hele fargeflaten — ingen side-stripe. «Lever»-knappens lilla fyll er det ene mettede punktet. Fortsatt ikke en «banner», en «margnote».

### 3.6 Interaksjon / motion (emil — dette er en sjelden, første-gangs ankomst → litt delight tillatt, men målt)

- **Ankomst:** stripen glir ned fra topp ved mount → `translateY(-100%) → 0` + opacity, 260ms `cubic-bezier(0.32,0.72,0,1)` (husets drawer-kurve). Én gang, ved landing. Dette er den ene «du kom hit med en hensikt»-bevegelsen. `@starting-style` der støttet, ellers `data-mounted`.
- **Verktøyet under** animeres *ikke* — kun stripen entrer, så fokus lander på arbeidet.
- **Ekspander/minimer:** `Collapse` 200ms ease-out.
- **Scroll-minimer:** når studenten scroller ned i Story Logic > ~80px, krymper stripen til en enkelt-linje pille (tittel + frist + «Lever»), `sticky top`. Scroll opp → full stripe igjen. Implementeres med `IntersectionObserver`/`useScroll` (aldri `window.addEventListener('scroll')` — perf-ban). Bevegelse: høyde+opacity 180ms ease-out.
- **«Lever»-drawer:** MUI `Drawer` bottom, iOS-kurve, 300ms. `:active scale(0.97)` på knappen.
- **Levert-overgang:** «Lever»-knapp → «Levert»-chip via `filter: blur(2px)` krysstoning 200ms (emil blur-mask) + kort emerald glød som toner ut — bekreftelse uten konfetti.
- `prefers-reduced-motion`: ankomst = ren opacity-fade (ingen translate); scroll-minimer = umiddelbar; drawer = standard MUI redusert. Alt fortsatt fullt brukbart.

### 3.7 Mobil (iPad/iPhone — førsteklasses)

- Stripe full bredde, sticky topp; handlingsrad kan wrappe: «Min side» + «Lever» ligger på egen rad under tittel/brief på `xs` (aldri trange side-om-side < 360px).
- **Touch:** «Min side», «Lever», chevron alle ≥ 44×44px (`minHeight/minWidth: 44` på `xs`).
- **Lever = bottom `Drawer`** (ikke popover) på touch — møter tommelen, respekterer `env(safe-area-inset-bottom)`.
- Scroll-minimer er ekstra verdifull på liten skjerm: gir Story Logic maks vertikal plass mens oppgave-hjemknappen alltid er én tapp unna.
- Ingen hover-avhengighet (chevron/handlinger er alltid synlige, ikke hover-avdekket) — `@media (hover: hover)` gate på evt. hover-finish.

---

## 4. Appendiks — delt copy og tokens

### 4.1 Norsk Bokmål microcopy (eksakte strenger)

**Flate A — Steg-velger**
- Feltlabel: `Steg`
- Options: `Hele Story Arc` · `Story Logic` · `Story Writer`
- Hjelpetekst (Hele Story Arc): `Lander studenten i studio-hubben`
- Tabell-chip: `Story Logic` (arver artefakt-chip-mønster)

**Flate B — DeepLinkPicker (autorering)**
- Header tittel: `Publiser oppgave til Canvas` (Moodle-variant: `Publiser oppgave til Moodle`)
- Header undertekst: `Oppretter oppgaven og legger en direkte lenke i emnet.`
- Felt: `Produksjon` · `Kull` · `Artefakt` · `Steg` · `Tittel` · `Brief` · `Frist` · `Læringsmål` · `Vurderingsform`
- Disclosure produksjon: `Opprett ny produksjon`
- Disclosure avansert: `Flere valg (læringsmål, arbeidskrav, vurderingsform)`
- Checkboxer: `Arbeidskrav (må godkjennes før eksamen)` · `Eksamen / sluttvurdering`
- Primærknapp: `Publiser til Canvas` / arbeid: `Publiserer…`
- Bekreftelses-hint: `Studenten lander rett i Story Logic.` / `Studenten lander i Story Arc-studio.` / `Studenten åpner produksjonen.`
- Tom-tilstand: `Ingen produksjoner ennå. Opprett en for å starte.`
- Feil: `Kunne ikke publisere: {årsak}. Ingenting ble lagt til i Canvas.`

**Flate C — Student-ankomst**
- Stripe-etikett: `Oppgave · {tittel}`
- Frist-chip: `Frist {dato}` / `I dag` / `{n} dager på overtid`
- Handlinger: `Min side` · `Lever`
- Etter levering: `Levert` → (vurdert) `Vurdert · Karakter: {grade}`
- Lever-drawer: tittel `Lever arbeidet`; felt `Lenke til arbeidet (video / Drive / produksjonen)`, `Kommentar (valgfritt)`; knapper `Avbryt` · `Lever` / `Leverer…`
- Sekundær etter levering: `Rediger levering`

*(Tankestrek «·» og «—» følger husets eksisterende norske typografi i disse fanene; ny engelsk-stil em-dash unngås i ny prosa.)*

### 4.2 Token- og komponent-kontrakt (for implementerer)

```
Farger (fra _eduUi.tsx + AssignmentsTab, ikke nye):
  ACCENT           #8B5CF6      primær lila (låst hele flaten)
  accent-light     #c4b5fd      ikon-glyph
  accent-chiptext  #e9d5ff      chip-tekst
  accent-ring      rgba(139,92,246,0.35)   aktivt par / åpent skjema
  accent-wash      rgba(139,92,246,0.09)   stripe/tips-bg
  CARD             rgba(255,255,255,0.035)
  BORDER           1px solid rgba(255,255,255,0.08)
  text-secondary   rgba(255,255,255,0.72)   (kontrast > 4.5:1 mot #0a0a0a)
  sky #38bdf8 · amber #f59e0b · rosa #ec4899 · emerald #10b981

Radius:  Panel 3 (24px) · felt/knapp/chip 2 (16px)   — ett system
Motion:  ease-out cubic-bezier(0.23,1,0.32,1)  (enter/exit UI)
         drawer  cubic-bezier(0.32,0.72,0,1)   (ankomst/drawer)
         enter 200-260ms · exit 140-160ms · trykk 120ms scale(0.97)
         alt gated bak prefers-reduced-motion → opacity/instant
Touch:   ≥ 44×44 på xs · safe-area-inset-bottom på sticky/drawer
A11y:    synlig fokusring bevart · flytende label (ingen placeholder-as-label)
         · aria-label på ikon-knapper (chevron: «Vis mer», Min side, Lever)

Delte options (én kilde, gjenbrukt av Flate A + B):
  STEG_OPTIONS = [
    { key: '',            label: 'Hele Story Arc' },
    { key: 'story-logic', label: 'Story Logic' },
    { key: 'story-writer', label: 'Story Writer' },
  ]
  vises kun når artifactKind === 'story-arc'
```

### 4.3 Anbefalt gjenbruk (ponytail: bygg det ett sted)

- **`<ArtifactStegFields>`** — trekk ut Artefakt + betinget Steg-`Collapse` som én liten komponent (props: `artifactKind`, `artifactView`, `disabled`, `onChange`). Brukes av **både** `AssignmentsTab` (Flate A) og `DeepLinkPicker` (Flate B). Én kilde til visuell + logisk sannhet; ingen drift mellom in-app og LMS-autorering.
- **`AssignmentSubmit`** (Flate C-drawer) — gjenbruk den eksisterende komponenten fra `StudentWorkspace.tsx` (linje 312) uendret inni drawer-en; ikke skriv ny leverings-UI.
- **Steg-chip** i tabell = outline-variant av eksisterende `artifactLabel`-chip; ingen ny chip-komponent.

### 4.4 Pre-flight (design-gulv, verifisert)

- [x] Én aksent (`#8B5CF6`) låst på alle tre flatene
- [x] Ett radius-system (3 / 2)
- [x] WCAG AA-kontrast på all tekst mot `#0a0a0a` (sekundær 0.72-alfa = ~7:1)
- [x] Touch ≥ 44px + safe-area på student-mobil
- [x] Synlig fokus + flytende labels (ingen placeholder-as-label)
- [x] Empty / loading / error dekket på alle tre flatene
- [x] Motion tjener forståelse (avdekking, ankomst, bekreftelse), gated bak reduced-motion
- [x] Ingen fremmed designsystem; alt arvet fra `_eduUi.tsx`
- [x] Progressiv avdekking i stedet for felt-vegg (Steg, «Flere valg», stripe-ekspander)
- [x] Ingen blokkerende modal på studentens arbeidsflate
```
