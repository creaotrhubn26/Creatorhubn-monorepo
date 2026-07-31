# Live Set (film) som native iPad

Egen app for The Role Room, som gjenbruker de tekniske løsningene fra
`ipad/CaptureApp` gjennom en delt Swift-pakke.

Skrevet 31. juli 2026, mot kodebasen slik den står.

---

## 0. Rett premiss først

Det finnes allerede en native iPad-app i repoet: `ipad/CaptureApp/`.

- 205 Swift-filer, **Swift 6 med `SWIFT_STRICT_CONCURRENCY: complete`**
- XcodeGen (`project.yml`), SwiftLint, deploymentTarget iOS 17
- GRDB (SQLite), offline-outbox med idempotenstokens
- Canon CCAPI-kamerakontroll, RAW-pipeline, AI-forbedring
- CI: `ipad-capture-ci.yml`, TestFlight via fastlane (`capture-testflight.yml`)
- Widgets og Live Activities

**Du starter ikke fra null.** Men Live Set skal være en **egen app** — det er
The Role Room, ikke CreatorHub-fotografen. Derfor gjenbrukes de tekniske
løsningene gjennom en delt pakke, ikke ved å legge en modul inn i CaptureApp.
Se kapittel 1.

### 0.1 «Live Set» betyr allerede to forskjellige ting

Dette må ryddes før noen skriver kode, ellers blir det dyrt:

| Hva | Hvor | Domene |
|---|---|---|
| `LiveSetDashboardView` + `LiveSetDashboardModel` | `ipad/CaptureApp` | **Foto.** Shot-liste mot opplastede bilder, dekningsfliser, AI-dekningssjekk, collage |
| `live-set-ai-routes.ts` | backend | Foto. Betjener den over |
| `LiveSetMode.tsx` | web | **Film.** ROLL/CUT, take-logg, hendelsesbasert, scene/oppsett |

Den native «Live Set» er fotografens dekningsoversikt. Den filmen du vil ha er
noe annet: ROLL/CUT, take-logg, timecode, multiview.

**Anbefaling: døp den nye film-flaten noe annet.** `ShootLive`, `SetMode`,
`OnSet` — hva som helst som ikke kolliderer. To ting med samme navn i samme app
er en feilkilde som varer i årevis.

---

## 1. Egen app, delt pakke

### 1.1 Hvorfor ikke en modul i CaptureApp

Live Set er et annet produkt for andre brukere: script supervisor og regi på et
filmsett, ikke fotografen med RAW-arbeidsflyt. Egen App Store-oppføring, egen
utgivelsestakt, egen binær som ikke drar med seg Redigering og CRM.

### 1.2 Hvorfor da ikke bare kopiere

Fordi det allerede har skjedd én gang. `ipad/` har to apper i dag, og de deler
**ingenting**:

| Konsept | CaptureApp | LeadMapApp |
|---|---|---|
| Offline-kø | `Outbox.swift` | `OfflineActionQueue.swift` |
| HTTP-klient | `BackendClient.swift` | `APIClient.swift` |
| Realtime | — | `LeadgridRealtimeClient.swift` |

To uavhengige implementasjoner av samme tre konsepter. En tredje app som
kopierer gir tre. Det er samme mønster som ga to live-set-skjermer, to
stripboards og to offline-outbokser på web-siden — og som måtte ryddes.

### 1.3 Hva som faktisk lar seg trekke ut

Målt på referanser til app-spesifikke typer (`Asset`, `Shoot`, `Gallery`,
`Redigering`, `CRM`):

| Fil | Domenereferanser | Vurdering |
|---|---|---|
| `Core/Sync/Outbox.swift` | 0 | Flytter som den er |
| `Core/Sync/OutboxWorker.swift` | 0 | Flytter som den er |
| `Core/Sync/OutboxSender.swift` | 0 | Flytter som den er |
| `Core/Models/OutboxMutation.swift` | 0 | Flytter som den er |
| `Core/Capture/CameraDiscovery.swift` | 0 | Flytter som den er |
| `Core/Capture/CCAPIClient.swift` | 1 | Nesten ren — én kobling å bryte |
| `Core/Capture/CCAPIAdapter.swift` | 8 | **Blir igjen.** Det er her domenet hører hjemme |

Alle importerer bare `Foundation` (Outbox også `GRDB`). Utrekket er billig
nettopp nå, og blir dyrere for hver måned begge appene vokser.

At `CCAPIAdapter` er den koblede er som det skal: adapteren er per definisjon
laget som oversetter Canon til *ditt* domene. Protokollen i pakken, mappingen
i appen.

### 1.4 Foreslått oppdeling

```
ipad/
  Packages/
    OutboxKit/         ✅ trukket ut — Outbox, OutboxWorker, OutboxSender,
                          OutboxMutation, OutboxSchema, OutboxDatabase
    NetworkingKit/     ✅ trukket ut — HTTPTransport, RetryPolicy, HTTPError
    CameraControlKit/  senere — CCAPIClient/Error/Types/InsecureTrust,
                          CameraDiscovery, CameraSession
                          + protocol CameraControl  ← BMD/RED/Sony
  CaptureApp/          CCAPIAdapter (foto-mapping) + resten
  LeadMapApp/
  SetModeApp/          ny — film-Live-Set
```

Navnene er produktnøytrale med vilje. Pakkene deles mellom CreatorHub og
The Role Room, så et `CH`-prefiks ville pekt på feil eier.

Lokale Swift-pakker via `packages:` med `path:` i XcodeGen — samme mekanisme
som GRDB allerede bruker, ingen ny infrastruktur.

**`OutboxKit` er gjort.** CaptureApp bruker pakken i stedet for sine egne
filer, så utrekket er bevist mot en app som allerede virker — framfor å bli en
antakelse den nye appen arver. To ting fulgte med som ikke lå i selve
kø-koden:

- **GRDB-konformansen** lå i appens `DatabaseSchema.swift`. Den hører til
  typen — en ny app skal ikke måtte vite at den må skrives.
- **DDL-en** lå inline i migratoren. `OutboxSchema.createTable(db)` eier den
  nå, mens *migreringsnavnet* blir stående i appen: å flytte navnet ville
  fått GRDB til å tro at en allerede kjørt migrering var ny.

Koblingen til appens database går gjennom `OutboxDatabase`-protokollen, så
alle ni `Outbox(database: db)`-kallstedene står urørt.

**`NetworkingKit` er gjort — men det var en annen jobb enn Outbox.**
`BackendClient` er 891 linjer med *domenemetoder* (`deliverToShowcase`,
`fetchWeddingTimelineBrief`), ikke en generisk klient. Å flytte den ville
flyttet fotografens API-flate inn i en delt pakke.

Det generiske lå inni to klienter, med hver sin halvdel av det riktige:

| | `BackendClient` | `DashboardClient` |
|---|---|---|
| Feilmapping (401/403, 404) | ✅ | delvis |
| Timeout | ❌ | ✅ 30 s |
| Retry m/backoff og jitter | ❌ | ✅ |

Pakken er begge halvdelene. `BackendClient` beholder sine 40 endepunkter og
delegerer transporten; den arver dermed timeout og retry den ikke hadde.

To ting måtte rettes underveis, og begge ville kompilert:

- **Feilvokabularet.** Transporten kaster `HTTPError`, men `QuickTeaserService`
  fanger `BackendError.unauthorized`. Uten en oversettelse på grensen ville de
  `catch`-ene stille sluttet å matche. Feiltypen er en del av klientens API.
- **Responsen.** Åtte kallsteder leser `statusCode` selv — typisk opplastinger
  der 409 betyr «finnes allerede». De går derfor via `rawData`, som beholder
  responsen, ikke `send`, som kaster på ikke-2xx.

`DashboardClient` er migrert på samme måte. Den beholder `DashboardError` —
den er `LocalizedError` med norske meldinger som vises direkte i UI-et, altså
en del av flatens API. `notConfigured` fra transporten oversettes til
`signedOut`, som er det nærmeste dashboardet har.

Begge klientene delegerer nå transporten. Duplikatet er borte: timeout,
retry-stigen og feilmappingen finnes ett sted, og en tredje app arver hele
oppførselen framfor halve.

`CameraControlKit` kan vente til fase 5. Live Set trenger den ikke før
kamerakontroll skal inn.

### 1.5 Hva som mangler helt

Ingenting av dette finnes i noen av appene, så det bygges likt uansett hvor
det havner:

| Mangler | Treff i CaptureApp |
|---|---|
| Timecode (BLE) | 0 |
| NDI / SRT | 0 |
| Multiview | 0 |
| Hendelsesvokabularet for film-Live-Set | 0 |

---

## 2. Kontrakten mot serveren

Appen skal **ikke** ha en egen skrivevei. Samme hendelsesspråk som
webklienten, mot samme endepunkter — da kan iPad og laptop være inne på
samme opptaksdag samtidig.

### 2.1 Økt

```
POST /api/role-room/projects/{projectId}/live-set/sessions
{ "operatorId": "...", "deviceId": "...", "shootingDayId": "..." }
→ { "success": true, "session": { "sessionId": "..." } }
```

`sessionId` holdes for hele dagen. `seq` telles per økt, starter på 1.

### 2.2 Hendelser

```
POST /api/role-room/projects/{projectId}/live-set/events/batch
{ "sessionId": "...", "events": [ … ] }        // 1–500 per kall
→ { "success": true, "ackedEventIds": [...], "rejected": [...] }
```

```jsonc
{
  "eventId":   "uuid",   // idempotensnøkkel — unik per HENDELSE, ikke per batch
  "sessionId": "...",
  "seq":       42,       // monotont per økt
  "type":      "cut",
  "payload":   {},
  "capturedAt":"2027-03-15T08:36:12Z",   // enhetens klokke VED HANDLINGEN
  "deviceId":  "...", "operatorId": "...",
  "projectId": "...", "shootingDayId": "..."
}
```

`eventId` går i `OutboxMutation.clientMutationId`. Dobbeltlevering er trygt;
tap er det ikke.

### 2.3 Vokabularet

```
roll · cut · capture_take · set_take_status · add_flag
add_note · update_note · delete_note · set_scene
setup_complete · advance_scene · set_camera · set_setup · set_cam · quick_action
```

| Type | Payload |
|---|---|
| `set_scene` | `{ sceneId, scene? }` |
| `set_setup` | `{ label }` |
| `set_cam` | `{ cam }` |
| `set_camera` | `{ camera?, lens?, fps?, iso?, ndFilter? }` |
| `set_take_status` | `{ id, status }` |
| `add_flag` | `{ flag }` |
| `capture_take` | `{ shotId, shotLabel?, quality?, camera?, lens?, fps?, notes?, continuityFlags? }` |

`roll`, `cut`, `setup_complete`, `advance_scene` har **tom payload** — hva de
gjør avhenger av tilstanden de treffer.

### 2.4 Lese tilstand

```
GET /api/role-room/projects/{projectId}/live-set/state?shootingDayId={id}
→ { "state": { liveState, currentSceneId, activeSetup, rollingSince,
                nextTakeNumber, takes[], lastAction, … } }
```

Bruk ved oppstart og etter lang frakobling. **Ikke** som erstatning for lokal
tilstand under opptak — 150 ms-budsjettet tåler ikke en rundtur.

---

## 3. Tilstandsmaskinen

Reglene finnes to steder i dag og må stemme med en tredje (Swift):
`frontend/…/hooks/useLiveSet.ts` og `backend/server/role-room-live-set-projection.ts`.

| Guard | Hvorfor |
|---|---|
| `roll` uten aktiv scene forkastes | Ellers havner taken på «unknown» |
| `roll` mens det ruller forkastes | Dobbelttrykk skal ikke gi to takes |
| `cut` uten `roll` forkastes | Ingen take uten opptak |
| Dobbel `cut` på samme roll forkastes | Nettverksretry skal ikke gi to takes |
| `setup_complete` under rulling forkastes | Man avslutter ikke et oppsett midt i en take |
| `advance_scene` → `idle`, men **beholder** take-loggen | Loggen er dagens, ikke scenens |

Take-nummer telles **per oppsett** (`setupLabel`), ikke per scene.

Varighet **måles** — appen sender aldri et varighetstall. Serveren regner den
mellom `roll` og `cut` sine `capturedAt`, så alle enheter er enige.

### 3.1 Konformitetstest — ta den fra dag én

Serverprojeksjonen er dommeren. Send samme hendelsessekvens gjennom
Swift-reduceren og gjennom `GET …/live-set/state`, sammenlign tilstanden.

De 21 testene i `role-room-live-set-projection.test.ts` er ferdige sekvenser —
inkludert avviste hendelser, dobbel roll/cut, og ankomst i vilkårlig
rekkefølge. Port dem til XCTest.

Dette er det eneste som hindrer at Swift og TypeScript driver fra hverandre.

---

## 4. Xcode

Prosjektet finnes; du legger til et target eller en modul. Det som må endres:

**Info.plist / capabilities som ennå ikke er der:**

| Nøkkel | Til hva |
|---|---|
| `NSLocalNetworkUsageDescription` | **NDI-oppdagelse på iOS 14+.** Uten den finner appen ingen kameraer — og feiler stille. Regn med en dag hvis du glemmer den |
| `NSBonjourServices` | NDI annonserer over mDNS |
| `NSBluetoothAlwaysUsageDescription` | Tentacle Sync / UltraSync |
| Background Modes → `bluetooth-central` | Timecode i bakgrunnen |
| Background Modes → `processing` | Opplasting som overlever skjermlås |

**Rammeverk:**

| Til | Bruk |
|---|---|
| Dekoding | `VideoToolbox` (`VTDecompressionSession`) — ikke `AVPlayer`, du trenger frame-nivå |
| Visning | `CAMetalLayer`. SwiftUI **rundt** rutenettet, ikke inni |
| Histogram, waveform, focus peaking, zebras | Metal compute shaders på teksturen som allerede er dekodet |
| Audio-målere | `AVAudioEngine` + `vDSP` (Accelerate) |
| Timecode | Core Bluetooth |
| Opplasting | `URLSession` background configuration |

Merk at prosjektet står på **Swift 6 / complete strict concurrency**. Video- og
BLE-kode med callbacks fra andre køer må annoteres riktig fra start —
det er hard error i CI, ikke advarsel.

---

## 5. Rekkefølge

Ikke begynn med multiview. Den er morsomst og minst risikabel å utsette.

**Fase 1 — kontrakten, uten video.**
Velg prosjekt og opptaksdag, sett scene og oppsett, ROLL/CUT, take-liste.
Hendelser gjennom eksisterende `Outbox`. Konformitetstest grønn.
*Her er appen allerede nyttig for script supervisor* — resten er tillegg.

**Fase 2 — én strøm.**
Én NDI- eller SRT-kilde, `VTDecompressionSession`, vist i Metal. **Mål
ende-til-ende-forsinkelsen.** Klarer ikke én strøm 150 ms, er det ingen vits i
å prøve seksten.

**Fase 3 — multiview.**
4 → 8 → 16. Her møter du GPU-minne og termisk struping: en iPad Pro struper
etter ~20 min med 16 dekodere hvis du ikke skalerer ned oppløsningen på de som
ikke er i fokus.

**Fase 4 — timecode og lokalt opptak.**
BLE-timecode, opptak, bakgrunnsopplasting.

**Fase 5 — kamerakontroll.**
CCAPI-mønsteret finnes. BMD/RED/Sony er ett prosjekt hver.

---

## 6. Må avklares før kode

- **Hvor står SFU-en?** 150 ms × 16 strømmer betyr på settet, ikke i skyen.
  Maskinvare- og kostnadsvalg, og det avgjør transporten.
- **Hvilke kameraer først?** SDK-ene er ikke utbyttbare.
- **Skal appen ta opp, eller bare overvåke?** Endrer lagring, termikk og batteri.

---

## 7. Hva som ikke skal flyttes

REVIEW-modus, som nettopp er bygget mot web:

- Godkjenningsflyten (`role_room_take_approvals`) — Review → Approve /
  Needs Work / Reject → Lock, med historikk, låsing og revisjonsspor
- Kommentarer med timecode
- Favoritter per bruker

Brukes av klipper, produsent og regissør — ofte ikke på settet, ofte ikke på
iPad. Native ville kostet App Store-review på hver rettelse uten å kjøpe noe.
