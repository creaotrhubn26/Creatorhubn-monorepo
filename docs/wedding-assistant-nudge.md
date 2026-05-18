# Wedding Assistant Nudge — System-dokumentasjon

**Status:** v1.0 (Slice 9X.52) — in production
**Sist oppdatert:** 2026-05-18
**Eier:** wedding-day-flow

## Hva det er

Proaktiv banner som dukker opp på wedding-day-siden når Creatorhubn detekterer
at et kommende bryllup ser krevende ut, og fotografen ikke har invitert noen
assistenter ennå. Målet er å hjelpe Stine å innse at hun trenger hjelp *før*
det er for sent å booke noen.

Eksempel-rendering:

```
┌──────────────────────────────────────────────────────────────────┐
│ Kanskje du kunne trengt en hånd?                              [×]│
│                                                                  │
│ Lang dag dette. Du har klart slike alene før — men hvis det     │
│ er noe, kan du invitere en assistent med ett klikk.             │
│                                                                  │
│ [Lang dag: 11.5 timer] [Mange events: 18] [3 lokasjoner]        │
│                                                                  │
│ [+ Inviter assistent]                                            │
└──────────────────────────────────────────────────────────────────┘
```

## Hvorfor det er bygd slik

- **Anti-spam-først.** Vi har én sjanse til å bli oppfattet som hjelpsomme, ikke
  som en pushy app. Strenge betingelser, lang cooldown, vennlig tone.
- **Signal-basert, ikke regel-basert.** Vi viser ikke nudgen til *alle*; bare når
  flere uavhengige signaler peker samme vei. Reduserer false positives drastisk.
- **Dismissable per bryllup.** Stine vurderer hvert bryllup på sin egen merit.
  Hvis hun avviste nudgen for april-bryllupet, betyr ikke det at hun avviser
  forslaget for juli-bryllupet.

## Når den vises

Alle disse betingelsene må være sanne samtidig:

| Betingelse | Hvorfor |
|---|---|
| Minst **2 av 3 signaler matcher** | Ett signal alene er for svakt grunnlag |
| **Ingen assistent allerede invitert** for dette bryllupet | Da har Stine allerede vurdert |
| Bryllupet er **≥3 dager unna** | Mindre tid = umulig å rekke å booke noen |
| **Ikke avvist for dette bryllupet** de siste 30 dagene | Cooldown — ikke nag |
| Data lastet (events + assistants + history) | Aldri render uten alle signaler |

### Signalene

| Signal-key | Trigger | Begrunnelse |
|---|---|---|
| `long_day` | Span (første event → slutt på siste) ≥ 10 timer | Fysisk utmattende |
| `many_events` | ≥ 15 timeline-events | Krever logistisk støtte |
| `multi_location` | ≥ 3 unike `locationId` på events | Vanskelig å rekke alle alene |

Implementert i `useMemo` i `AssistantNeedsNudge.tsx:108-138`.

## Personalisering: førstegangs vs. erfaren

Når `lifetimeInvites === 0` (Stine har aldri invitert noen tidligere) viser vi
**egen variant**:

- **Tittel:** "Et stille tips"
- **Tekst:** "Hvis du aldri har invitert en assistent: prøv én gang. Du
  bestemmer rollen, lønna og hva hen leverer — og verktøyet håndterer kontrakt,
  brief og Drive-deling for deg."
- **CTA-tekst:** "Prøv å invitere en" (mindre forpliktende enn "Inviter assistent")

For erfarne fotografer roterer vi mellom 3 varianter (deterministisk per dag, så
samme bryllup ikke skifter tekst hvis Stine reloader). Logikk i
`pickVariant()` (AssistantNeedsNudge.tsx:64).

## Tekniske detaljer

### Filer
- `frontend/client/src/components/wedding/AssistantNeedsNudge.tsx` — komponenten
- `frontend/client/src/components/wedding/AssistantsPanel.tsx` — lytter på
  `open-assistant-invite`-eventen, har `data-assistants-panel`-attributt for
  scroll
- `frontend/client/src/pages/photographer-wedding-day.tsx` — monterer nudgen
  over `AssistantsPanel`

### Data-kilder (alle parallelt på mount)
```
GET /api/wedding/:weddingId/timeline-events
GET /api/wedding/:weddingId/assistants
GET /api/photographer/assistants/history
```

Hvis noen av disse feiler, behandles det som tom liste — nudgen vises ikke
(fail-closed).

### Dismiss-mekanikk
- LocalStorage-key: `assistant-nudge-dismissed:<weddingId>`
- Verdi: `Date.now()` (millisekunder)
- TTL: **30 dager** (`DISMISS_TTL_MS`)
- Renderes på nytt etter TTL hvis betingelsene fortsatt gjelder

### Kommunikasjon mellom nudge og AssistantsPanel
Vi bruker en custom DOM-event for å unngå prop-drilling:

```ts
// I nudgen:
window.dispatchEvent(new CustomEvent('open-assistant-invite', {
  detail: { weddingId }
}));

// I AssistantsPanel:
window.addEventListener('open-assistant-invite', (ev) => {
  if (ev.detail.weddingId === weddingId) setInviteOpen(true);
});
```

Begrunnelse: nudgen og panelet er separate komponenter mountet av en tredjepart
(wedding-day-siden). Custom event er enkelt og krever ingen kontekst/refactor.

## Tracking (GA4)

Alle events sendt via `trackEvent()` fra `@/utils/ga4-client-tracking`.

| Event | Når | Parametere |
|---|---|---|
| `assistant_nudge_shown` | Banner rendres (firet kun én gang per mount via `impressionFired`-guard) | `wedding_id`, `trigger_signals` (komma-separert), `signal_count`, `first_time_user` |
| `assistant_nudge_clicked` | Stine trykker CTA-knappen | `wedding_id`, `first_time_user` |
| `assistant_nudge_dismissed` | Stine trykker X | `wedding_id`, `first_time_user` |

### Måle-funnel i GA4

Bygg i Explore → Funnel exploration:

```
Step 1: assistant_nudge_shown
Step 2: assistant_nudge_clicked
Step 3: assistant_invite_sent
Step 4: assistant_invite_accepted
```

Nøkkel-tall å overvåke:
- **Step 1 → 2 click-through-rate.** <5 % betyr nudgen er irrelevant eller
  copy er svak. >20 % er sterkt signal.
- **Step 2 → 3 completion-rate.** Hvis lav: invite-dialogen er for komplisert.
- **Dismiss-rate (Step 1 → dismissed).** Over 60 % over tid = nudgen oppfattes
  som spam, slå av eller stram betingelsene.

### Custom dimensions å registrere i GA4
- `trigger_signals` (event-scoped, text) — for å se hvilken kombinasjon konverterer
- `first_time_user` (event-scoped, boolean) — segmenter førstegangs vs. erfarne

## Hvordan endre

### Justere terskler
Rediger konstantene i `useMemo`-blokken i `AssistantNeedsNudge.tsx:108-138`:
- `spanHours >= 10` — endre om "lang dag" skal være 8/12/14 timer
- `events.length >= 15` — endre minimum event-count
- `locations.size >= 3` — endre minimum lokasjons-spread

### Legge til ny variant-tekst
Push til `NUDGE_VARIANTS_REGULAR` eller `NUDGE_VARIANTS_FIRSTTIME` arrays
(`AssistantNeedsNudge.tsx:46-58`). Rotasjon er deterministisk per dag — `Math.floor(Date.now() / 86_400_000) % pool.length`.

### Endre cooldown
`DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000`. Bytt i `AssistantNeedsNudge.tsx:41`.

### Slå av midlertidig
Wrap nudgen i en feature-flag check i `photographer-wedding-day.tsx`. Vi har
ikke en feature-flag-server kjørende ennå, så enkleste er en env-var-check
eller bare kommentere ut komponenten.

## Tilstander / edge-cases vi har håndtert

| Case | Hva som skjer |
|---|---|
| Bryllupet er i dag eller i går | `tooLateToInvite` = true → ikke render |
| Ingen timeline-events | Ingen signaler → ikke render |
| Events uten `scheduledTime` | Filtreres bort før vi beregner span |
| Alle data laster feil | Listene blir tomme → ikke render (fail-closed) |
| Stine inviterte assistent rett før reload | `assistantsCount > 0` → ikke render |
| LocalStorage utilgjengelig (privacy-mode) | `try/catch` → fungerer som om aldri dismisset |

## Mulig veikart (ikke implementert)

Disse ble diskutert som naturlige neste steg, sortert etter forventet ROI:

### Tier 1 — direkte forsterkninger
1. **Outcome-feedback-løkke.** Etter et bryllup hvor Stine fulgte nudgen,
   vis henne et "regnskap": faktisk overskudd vs. estimert alene-overskudd,
   klient-rating, energi-nivå. Gjør neste nudge mye sterkere.
2. **Multi-channel.** E-post 7 dager før, push-notifikasjon, ukentlig
   "mandagsbrief".
3. **Tidligere triggere.** Vise nudge allerede ved kontraktssignering basert på
   gjeste-count / kontrakts-verdi, lenge før timeline finnes.
4. **Pulje-bookning.** "Du har 4 bryllup i juli med samme assistent-behov,
   inviter Anna til alle på én gang?"

### Tier 2 — nye nudge-kategorier
5. Pris-nudge (markedssnitt vs. egen rate)
6. Plan B-nudge (vær-trigget, kobles til `PlanBManager.tsx`)
7. Utstyrs-nudge med affiliate-modell
8. Wellness-nudge (back-to-back-bryllup, foreslå å si nei eller delegere)

### Tier 3 — arkitektur
9. **Generisk nudge-engine.** Abstrahere mønsteret slik at nye nudges blir 2-timers
   jobb i stedet for 1-dags. Automatisk GA4-tracking, cooldown-håndtering,
   variant-rotering.
10. **A/B-testing innebygd.** Variant-vinner basert på conversion-data fra GA4.

### Tier 4 — nye inntektsstrømmer
11. **Marketplace for subkontrakter.** Åpne rolodex-en frivillig på tvers av
    fotografer; Creatorhubn tar 10 % av matchet subkontrakt.
12. Mentorship-matching (junior + senior fotograf)
13. Forsikring/utstyrs-affiliate via nudge-triggere

## Endringslogg

| Dato | Slice | Hva |
|---|---|---|
| 2026-05-18 | 9X.52 | Initial release (3 signaler, 30-dagers cooldown, GA4-tracking, førstegangs-variant) |
