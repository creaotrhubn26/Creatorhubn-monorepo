# Production Graph: forhåndsvisbar change impact

Plan, ikke implementasjon. Skrevet 2026-09-16 mot faktisk skjema og faktiske
ruter i repoet. Rapporten `ROLE_ARCHITECTURE_AND_TROLL_LOCATION_HANDOVER_2026-09-14.md`
krever at migrasjons- og kompatibilitetsstrategien er eksplisitt før noe bygges.
Den står i kapittel 4.

## 1. Avgrensning

Én endring: **å flytte en opptaksdag til en annen dato.**

Ikke hele grafen. Ikke scene-bytte, ikke lokasjonsbytte. Én endring, hele veien
gjennom, slik at verdien kan demonstreres på en uke i stedet for etter en
normalisering som tar en måned før noen ser noe.

Kriteriene dette svarer på:

- **Gjør vondt** — konsekvensen av en flyttet dag samles i dag manuelt fra fem
  flater, og det som glippes koster penger.
- **Skjer ofte** — omplanlegging skjer ukentlig i produksjon.
- **Tydelig kjøper** — produsenten som bærer kosten.
- **Demonstreres raskt** — «flytt dag 6 til torsdag» viser én skjerm.
- **Blir mer verdifull** — hver ny rolleflate kobler seg på samme graf.

## 2. Hva som finnes i dag

Opptaksdagen er `casting_production_days`. Radens egne koblinger er
denormaliserte JSONB-lister pluss én kolonne:

| Kolonne | Innhold |
| --- | --- |
| `date` | datoen som flyttes |
| `scene_ids` | scener som skytes den dagen |
| `crew_ids` | crew kalt inn |
| `prop_ids` | rekvisitt som må være på plass |
| `location_id` | fysisk lokasjon |
| `data` | rik payload: dagsbrief, koordinering, kontinuitet |

Tre uavhengige samtidighetsbaner ligger på samme rad:
`management_version`, `coordination_version`, `continuity_version`, hver med
`updated_by` og `updated_at`.

Det som peker på dagen utenfra:

| Tabell | Kobling | Hva som brekker ved datoflytt |
| --- | --- | --- |
| `casting_production_continuity_media` | FK `production_day_id`, cascade | take-bevis knyttet til dag + scene |
| `role_room_call_sheet_deliveries` | `production_day_id`, unik publisert per prosjekt+dag | en publisert call sheet oppgir nå feil dato |
| `role_room_call_sheet_events` | `production_day_id` | leveranselogg peker på utsendt feil |
| `equipment_bookings` | `start_date`/`end_date`, `status` | booking står igjen på gammel dato |
| `role_room_location_operations` | per lokasjon, versjonert | tilgang, tillatelser og recce bekreftet for gammel dato |
| `casting_schedules` | prosjektets øvrige planlegging | auditions og annet som kolliderer |
| `role_room_budget_items` | `category` | kostlinjer knyttet til dagen — koblingen må verifiseres, se §6 |

## 3. Gapet

Ingenting leser disse sammen. En produsent som flytter dag 6 får ingen
advarsel om at call sheet er publisert, at utstyret er booket til onsdag, eller
at lokasjonsavtalen gjelder en dato som ikke lenger er aktuell.

Rapporten formulerer kravet slik: brukeren skal se berørte avdelinger,
dokumenter, bookinger, kostnader og godkjenninger **før** endringen skjer, og
ingen automatikk skal endre produksjonsdata uten eksplisitt godkjenning.

## 4. Kompatibilitets- og migrasjonsstrategi

**Steg 1 krever ingen migrasjon.** Dette er det viktigste valget i planen.

Alle koblingene over finnes allerede, enten som fremmednøkkel eller som dato
det kan sammenlignes mot. En impact-forespørsel er en ren lesning på tvers av
seks tabeller. Ingen ny tabell, ingen backfill, ingen dual-write, ingenting å
rulle tilbake.

Normalisering — en faktisk kantetabell — utsettes til vi har målt at lesningen
er for treg eller for upresis. Da vet vi også hvilke kanter som betyr noe, i
stedet for å gjette dem på forhånd. Dette er samme valg som `additional_roles`
i PR #2337: en migrerbar modell foran en normalisert tabell ingen ennå trenger.

Når normalisering blir aktuelt, gjelder:

- kantetabellen bygges fra de eksisterende koblingene, ikke ved siden av dem
- den leses først, skrives etter, og gammel lesning beholdes til pariteten er
  målt på ekte data
- ingen rad flyttes; `production_day_id` forblir sannheten

## 5. Leveranse

**Backend:** `GET /api/role-room/projects/:projectId/production-days/:dayId/impact?date=YYYY-MM-DD`

Lesning, ingen mutasjon. Svarer med én liste av påvirkninger:

```
{
  "from": "2026-09-20",
  "to": "2026-09-24",
  "impacts": [
    { "area": "call_sheet", "severity": "blocking",
      "summary": "Call sheet revisjon 3 er publisert med 20. september",
      "entityId": "...", "action": "Må republiseres" },
    { "area": "equipment", "severity": "warning", ... },
    { "area": "location", "severity": "blocking", ... },
    { "area": "continuity", "severity": "info", ... }
  ]
}
```

`severity` er tredelt med vilje: `blocking` betyr at noen må gjøre noe før
flyttingen, `warning` at noe bør sjekkes, `info` at noe følger med automatisk.
Uten det skillet blir lista en vegg av tekst brukeren slutter å lese.

Tilgang: samme resolver som alt annet — `canEditProduction` for å be om
forhåndsvisningen, siden den avslører produksjonsdata.

**Frontend:** forhåndsvisningen vises i dialogen som allerede eier datoflytt,
før bekreftelse. Ingen ny flate.

States som skal tegnes:

- laster — skjelett, ikke blank dialog
- ingen påvirkning — sies eksplisitt, ikke tom liste
- blokkerende funn — bekreftelsesknappen er nedtonet og inert, med hvilke punkter som må ryddes
- lesningen feiler — flyttingen tillates ikke stille; brukeren får vite at konsekvensen er ukjent
- stale — datoen ble endret av noen andre mens dialogen sto åpen

Siste punkt er ikke pynt: de tre versjonsbanene på raden betyr at dagen kan ha
flyttet seg under føttene på deg.

## 6. Det som må verifiseres før koding

- **Budsjettkoblingen.** `role_room_budget_items` har `category`, men ingen
  synlig dag-referanse. Enten finnes koblingen i `data`-bloben, eller så finnes
  den ikke. Må måles mot ekte prosjekt før den tas med i lista.
- **`casting_schedules`** — hva som faktisk ligger der i produksjon, ikke hva
  navnet antyder.
- **Equipment-bookinger** bruker tidsstempel, ikke dato. Tidssone-håndteringen
  må avklares før «overlapper med dagen» kan beregnes riktig.

Ingen av de tre skal gjettes. Måles på Troll-prosjektet, som har ekte data.

## 7. Verifisering

- enhetstester per påvirkningsområde, med en dag som treffer og en som ikke gjør det
- én test som flytter en dag uten noen påvirkning og bekrefter tom-tilstanden
- rollebasert test: en leser får ikke forhåndsvisningen
- E2E mot Troll: flytt dag, se lista, avbryt, bekreft at ingenting er endret

Siste punkt er det som skiller denne fra en grønn testsuite: avbryt skal
etterlate databasen nøyaktig som før.

## 8. Ikke i denne leveransen

- Automatisk retting av det som brekker. Forhåndsvisning først; å la systemet
  flytte en booking er en egen beslutning med egen angrerett.
- Scene- og lokasjonsbytte. Samme mekanikk, men egne kanter.
- Kantetabellen. Se §4.
