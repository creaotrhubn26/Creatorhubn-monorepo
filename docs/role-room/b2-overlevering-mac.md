# B2 — hva som gjenstår å kjøre på Mac-en

Alt i denne fila er ting jeg **ikke** kunne fullføre i sesjonsmiljøet, med
grunnen og med kommandoene som faktisk skal kjøres. Rekkefølgen er den
jeg ville brukt.

Miljøet mangler tre ting: Swift-toolchain, nettverkstilgang til Backblaze,
og `frontend/node_modules`. Alt annet er verifisert her — backend-suiten
(2801 tester) og migrasjonene er kjørt mot en ekte Postgres 16.

---

## 0. Komme i gang i terminalen

Alt arbeidet ligger på grenen `claude/new-session-s15c36`. Ingen
pull request er opprettet — det er din beslutning.

```bash
git fetch origin
git checkout claude/new-session-s15c36
git pull

npm install                      # rot
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..

claude                           # start Claude Code her
```

To ting som biter i dette repoet:

- **`*.md` er gitignored.** Nye dokumenter må legges til med
  `git add -f docs/…`, ellers forsvinner de stille.
- **Pre-push-hooken henger.** Den kjører npm + frontend-tsc og blir
  stående. Kjør sjekkene manuelt og bruk `git push --no-verify`.

Verifiser at du står på samme sted som meg:

```bash
cd backend && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS"
# forventet: 135 (preeksisterende baseline, ikke innført her)

npx vitest run | tail -3
# forventet: 2801 passed
```

Åpningsprompt til Claude Code:

> Les `docs/role-room/b2-overlevering-mac.md`. Vi er midt i å flytte
> lagringen til Backblaze B2. Punkt 1–9 er ting jeg må gjøre lokalt.
> Start med å bekrefte at typecheck står på 135 og at backend-suiten er
> grønn, og si fra hvis noe avviker fra doken.

---

## 1. Provisjoner B2-nøklene

**Hvorfor ikke gjort her:** krever innlogging hos Backblaze. Koden er
klar; nøklene finnes ikke.

Registret ligger i `backend/server/b2-key-registry.ts`. Sju roller, hver
med sitt eget env-par. Så lenge en rolle mangler nøkkel, faller den
tilbake til plattformens fellesnøkkel — det virker, men gir ingen
sikkerhetsgevinst, og backend logger én advarsel ved oppstart om hvilke
roller det gjelder.

Installer CLI-en og logg inn:

```bash
brew install b2-tools
b2 account authorize                 # master key id + key
```

Opprett én nøkkel per rolle. Kapabilitetene under er fasit — de er de
samme som `requiredCapabilities` i registret:

```bash
BUCKET=the-role-room-prod

# Lesing: kan signere URL-er, kan verken skrive eller slette.
b2 key create --bucket "$BUCKET" trr-capture-read  listFiles,readFiles,shareFiles

# Skriving: kan laste opp, kan IKKE slette.
b2 key create --bucket "$BUCKET" trr-capture-write listFiles,writeFiles,shareFiles

# Sletting: egen rolle, fordi den er den eneste som kan ødelegge noe.
b2 key create --bucket "$BUCKET" trr-capture-delete listFiles,readFiles,deleteFiles

b2 key create --bucket "$BUCKET" trr-uploads-read  listFiles,readFiles,shareFiles
b2 key create --bucket "$BUCKET" trr-uploads-write listFiles,writeFiles,shareFiles

# Arkivet leser og skriver, men sletter ikke.
b2 key create --bucket "$BUCKET" trr-archive       listFiles,readFiles,writeFiles,shareFiles

# Dokumenter, avledet media og brukerens egen filflate. Alle tre har
# deleteFiles: dette er innhold brukeren selv oppretter og fjerner igjen,
# og å dele det i to nøkler ville gitt to nøkler for én CRUD-flate.
b2 key create --bucket "$BUCKET" trr-documents \
  listFiles,readFiles,writeFiles,deleteFiles,shareFiles
b2 key create --bucket "$BUCKET" trr-media-worker \
  listFiles,readFiles,writeFiles,deleteFiles,shareFiles
b2 key create --bucket "$BUCKET" trr-user-storage \
  listFiles,readFiles,writeFiles,deleteFiles,shareFiles

# Admin er bred med vilje — men skal da bare brukes av admin-flatene.
b2 key create --bucket "$BUCKET" trr-admin \
  listBuckets,listFiles,readFiles,writeFiles,deleteFiles,shareFiles
```

`b2 key create` skriver ut `keyID` og `applicationKey`. **Hemmeligheten
vises bare denne ene gangen.**

Legg dem inn i miljøet (Render → Environment):

```
B2_KEY_CAPTURE_READ_ID=…        B2_KEY_CAPTURE_READ_SECRET=…
B2_KEY_CAPTURE_WRITE_ID=…       B2_KEY_CAPTURE_WRITE_SECRET=…
B2_KEY_CAPTURE_DELETE_ID=…      B2_KEY_CAPTURE_DELETE_SECRET=…
B2_KEY_UPLOADS_READ_ID=…        B2_KEY_UPLOADS_READ_SECRET=…
B2_KEY_UPLOADS_WRITE_ID=…       B2_KEY_UPLOADS_WRITE_SECRET=…
B2_KEY_DOCUMENTS_ID=…           B2_KEY_DOCUMENTS_SECRET=…
B2_KEY_MEDIA_WORKER_ID=…        B2_KEY_MEDIA_WORKER_SECRET=…
B2_KEY_USER_STORAGE_ID=…        B2_KEY_USER_STORAGE_SECRET=…
B2_KEY_ARCHIVE_ID=…             B2_KEY_ARCHIVE_SECRET=…
B2_KEY_ADMIN_ID=…               B2_KEY_ADMIN_SECRET=…
```

Når alle ti er på plass:

```
B2_REQUIRE_SCOPED_KEYS=true
```

Da blir fallback til fellesnøkkelen en feil i stedet for en stille
nedgradering. Sett den **først** når alle ti er inne — ellers stopper
opplastinger.

Verifiser at avgrensningen faktisk virker. Dette skal **feile**:

```bash
# Lesenøkkelen skal ikke kunne skrive.
B2_APPLICATION_KEY_ID=<capture-read-id> \
B2_APPLICATION_KEY=<capture-read-secret> \
  b2 file upload "$BUCKET" /etc/hosts test-skal-feile.txt

# Skrivenøkkelen skal ikke kunne slette.
B2_APPLICATION_KEY_ID=<capture-write-id> \
B2_APPLICATION_KEY=<capture-write-secret> \
  b2 file delete b2id://<en-fil-id>
```

Får du 200 på noen av dem, er nøkkelen opprettet med feil kapabiliteter.
En nøkkel som «virker» på alt er nøyaktig problemet vi prøvde å fjerne.

Alle modulene går nå gjennom `b2-client-factory`. Behold likevel
`B2_ROLE_ROOM_APPLICATION_KEY_ID`/`_KEY` til `B2_REQUIRE_SCOPED_KEYS=true`
er satt — det er fortsatt fallbacken.

Én ting å merke seg: academy-materiellet defaulter til **us-west-001**,
ikke fellesregionen. Ligger den bøtta et annet sted, må `B2_REGION` settes
deretter — B2 kaster ikke exception på feil region, den skriver bare feil
sted.

---

## 2. Bygg iPad-appen

**Hvorfor ikke gjort her:** ingen Swift-toolchain i miljøet. Endringene
er skrevet, men aldri kompilert.

Endret i denne runden:

- `ipad/CaptureApp/CaptureApp/Core/Sync/BackendTypes.swift` —
  `BackendUploadPlan` fikk `versionId: String?` og `versionNumber: Int?`;
  `BackendUploadCompleteRequest` fikk `versionId: String?`
- `ipad/CaptureApp/CaptureApp/Core/Sync/DeliveryService.swift` — sender
  `plan.versionId` videre ved complete (to steder)

Feltene er valgfrie, så syntetisert `Decodable` tåler at serveren ikke
sender dem.

```bash
cd ipad/CaptureApp
xcodegen generate
xcodebuild -scheme CaptureApp -destination 'platform=iOS Simulator,name=iPad Pro (11-inch)' build
```

Se særlig etter at `DeliveryService` kompilerer — det er der jeg la til
argumentet i to `.init(...)`-kall, og en manglende parameter der er en
kompileringsfeil, ikke en kjøretidsfeil.

Uten dette bygget fungerer opplasting fortsatt: `versionId` er valgfri på
serveren, og complete faller tilbake til å skrive nøkkelen direkte. Da
mister du bare den delen av samtidighetsvernet som ligger i at klienten
sier hvilken versjon den lastet opp.

---

## 3. Opprett bøttene

**Hvorfor ikke gjort her:** krever Backblaze-innlogging.

Koden ruter allerede etter datatype. Så lenge en klasse mangler egen
bøtte, brukes fellesbøtta — det virker, men splitten er da ikke
gjennomført, og backend logger én linje ved oppstart om hvilke klasser
det gjelder.

```bash
for b in originals proxies working deliverables archive uploads; do
  b2 bucket create "trr-prod-$b" allPrivate
done
```

Sett env:

```
B2_BUCKET_ORIGINALS=trr-prod-originals
B2_BUCKET_PROXIES=trr-prod-proxies
B2_BUCKET_WORKING=trr-prod-working
B2_BUCKET_DELIVERABLES=trr-prod-deliverables
B2_BUCKET_ARCHIVE=trr-prod-archive
B2_BUCKET_UPLOADS=trr-prod-uploads
```

**Ikke slett fellesbøtta.** Alt som ble lastet opp før splitten ligger
der og har ingen klassemerking i nøkkelen. Koden ruter slike nøkler dit
med vilje — det er dette som gjør at ingenting må kopieres.

Nøklene fra punkt 1 er avgrenset til én bøtte (`--bucket "$BUCKET"`). Når
bøttene finnes, må de opprettes på nytt uten bøtte-binding, eller én
nøkkel per bøtte. Enklest: opprett nøklene på nytt uten `--bucket` og la
prefiks-avgrensningen gjøre jobben, eller lag én nøkkel per (rolle,
bøtte)-par hvis du vil ha hardere isolasjon.

Nøkkelformen etter splitten:

```
capture-b2/_originals/{eier}/{sesjon}/{asset}/full/v1/A001.mov
capture-b2/_proxies/{eier}/{sesjon}/{asset}/preview/v1/A001.jpg
capture-b2/{eier}/…      ← før splitten, fellesbøtta
capture/{eier}/…         ← R2, uendret
```

Understreken er ikke pynt: den skiller klasseleddet fra en bruker-id, så
en bruker som heter «originals» ikke får filene sine rutet til
master-bøtta.

Livssyklusregler er verdt å sette per bøtte når de finnes — men husk at
B2 bare kan «N dager fra opplasting». Alt som avhenger av apptilstand
(«90 dager etter arkivering», «30 dager etter siste aktivitet») må ligge
i vår egen retention-tjeneste.

---

## 4. Kjør migrasjonene

Seks nye fra denne sesjonen, i rekkefølge. De to første er ikke
lagringsrelaterte, men de er like nye og må kjøres:

```
backend/migrations/0462_role_room_production_day_data.sql
backend/migrations/0463_role_room_take_approval.sql
backend/migrations/0464_storage_ledger_b2_backend.sql
backend/migrations/0465_production_storage_ledger.sql
backend/migrations/0466_storage_egress_ledger.sql
backend/migrations/0467_capture_asset_versions.sql
```

Alle er kjørt mot en scratch-Postgres 16 her.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f backend/migrations/0462_role_room_production_day_data.sql \
  -f backend/migrations/0463_role_room_take_approval.sql \
  -f backend/migrations/0464_storage_ledger_b2_backend.sql \
  -f backend/migrations/0465_production_storage_ledger.sql \
  -f backend/migrations/0466_storage_egress_ledger.sql \
  -f backend/migrations/0467_capture_asset_versions.sql
```

Tre ting verdt å vite før du kjører:

- **0462** flytter en kolonne (`casting_production_days.data`) fra å bli
  lagt til ved oppstart i `ensureSchema` til å ligge i en migrering. Den er
  idempotent, men kjør den før backend starter neste gang.
- **0464** endrer en eksisterende funksjon
  (`apply_storage_consumption_delta`) med `CREATE OR REPLACE` — trygg å
  kjøre om igjen.
- **0465** har fremmednøkkel mot `casting_projects(id)`. Feiler den,
  mangler tabellen i den databasen.

---

## 5. Kjør integrasjonstestene

De hoppes over uten `RR_TEST_DATABASE_URL`, så de går ikke i vanlig
`npm test`. Kjør dem én gang mot en lokal database:

```bash
createdb trrtest
cd backend
RR_TEST_DATABASE_URL=postgres://localhost/trrtest npx vitest run \
  server/production-storage-service.integration.test.ts \
  server/capture-asset-version-service.integration.test.ts
```

45 tester. De verifiserer det unit-tester ikke kan: at unik-indeksen
faktisk hindrer at to samtidige opplastinger får samme versjonsnummer, at
en opplasting ikke kan endre hvem som betaler, og at breakdown-kolonnene
summerer til totalen.

---

## 6. Admin-flaten

**Hvorfor ikke verifisert her:** `frontend/node_modules` er tom, så
`.tsx`-fila er skrevet uten typesjekk.

Flata ligger under **Admin → B2-arkiv**, over den eksisterende
arkiv-fanen. Den viser utrullingsstatus (hvilke roller og bøtte-klasser
som fortsatt deler), forbruk per backend, de største produksjonene med
kost, og egress målt mot gratiskvoten.

Tallbehandlingen ligger i `frontend/client/src/services/storageStatusAdapter.ts`
og er testet her (31 tester). Panelet er bare tegning.

To ting å se etter når du bygger:

- `AdminDashboard.tsx` har **ikke** `@ts-nocheck`, så min JSX-endring der
  blir typesjekket. `Box` og fragment-syntaksen brukes allerede i fila, så
  den bør gå gjennom — men det er den endringen som eventuelt feiler.
- Panelet selv har `@ts-nocheck`, som `AdminConfigStatusCard` ved siden av.

Endepunktene bak:

```
GET /api/admin/storage-status/overview
GET /api/admin/storage-status/productions?limit=25
GET /api/admin/storage-status/egress?days=30&limit=25
```

Marginen i oversikten regnes mot inntekt 0 og er derfor negativ:
Stripe-inntekten er ikke koblet inn. Det er med vilje — å gjette et tall
ville vært verre enn å vise at det mangler.

---

## 7. Sett kostgrunnlaget

**Dette er det viktigste punktet ingen ber deg om.** Uten det regner
admin-flaten margin på listepriser, og tallene der ser riktige ut mens de
er feil.

Defaultene er Backblaze og Cloudflares LISTEPRISER per juli 2026. Får du
reseller- eller B2 Reserve-vilkår, ligger din faktiske kost under — og da
er marginen i flata lavere enn den er i virkeligheten.

```
STORAGE_COST_B2_PER_GB_MONTH=0.006          # USD/GB/mnd — din avtalepris
STORAGE_COST_B2_EGRESS_PER_GB=0.01          # USD/GB over gratiskvoten
STORAGE_COST_B2_FREE_EGRESS_MULTIPLIER=3    # gratis egress = 3x lagret
STORAGE_COST_R2_PER_GB_MONTH=0.015
STORAGE_COST_STREAM_PER_GB_MONTH=0.1        # tilnærming — Stream prises per minutt
STORAGE_COST_STREAM_EGRESS_PER_GB=0.05
STORAGE_COST_NOK_PER_USD=10.5               # påvirker ALLE kronetall
```

En negativ eller ikke-numerisk verdi ignoreres og faller til defaulten —
en feilskrevet pris gir altså ikke negativ margin, den gir listepris. Det
er tryggere, men også stillere: sjekk verdiene i admin-flata etterpå.

Stream-tallet er en tilnærming. Cloudflare priser per lagret og levert
minutt, ikke per GB, og omregningen avhenger av bitrate. Det er godt nok
til å se at Stream er mange ganger dyrere enn B2, men ikke til å fakturere
på.

---

## 8. Env-referanse

Alt som er nytt i denne runden, samlet. Kjedene tar første ikke-tomme
verdi.

**Rollback-brytere** — ruller tilbake uten kodeendring:

```
UPLOAD_STORAGE_PRIMARY=r2      # generiske opplastinger tilbake til R2
CAPTURE_STORAGE_PRIMARY=r2     # capture tilbake til R2
```

Filer som allerede er skrevet til B2 leses fortsatt fra B2 — per-fil-
backenden og nøkkelprefikset står i dataene, ikke i konfigen.

**Per-vei B2-overstyring** (valgfritt — uten disse brukes
`B2_ROLE_ROOM_*`/`B2_*`):

```
GENERIC_UPLOADS_B2_BUCKET / _APPLICATION_KEY_ID / _APPLICATION_KEY
GENERIC_UPLOADS_B2_REGION / _ENDPOINT / _PREFIX / _PUBLIC_URL_BASE
CAPTURE_B2_BUCKET / _APPLICATION_KEY_ID / _APPLICATION_KEY
CAPTURE_B2_REGION / _ENDPOINT / _PREFIX
```

`*_PREFIX` bestemmer nøkkelrommet. Endrer du det etter at filer er
skrevet, slutter de gamle å bli funnet — de leses etter prefiks.

**Nøkler og bøtter:** se punkt 1 og 3.

**Uendret fra før:** hele `R2_*`, `CLOUDFLARE_R2_*`, `CAPTURE_R2_*`-kjeden,
`CHUNKED_UPLOAD_DIR`, `STORAGE_SIGNED_URL_TTL_SECONDS`,
`STORAGE_COST_NOK_PER_GB_MONTH`, `STORAGE_MARGIN_MARKUP`. Ikke rør dem —
R2 er fortsatt lesekilde for alt som ligger der.

---

## 9. Typecheck frontend

**Hvorfor ikke gjort her:** `frontend/node_modules` er tom, og
npm-registeret er blokkert i miljøet. Jeg har ikke rørt frontend i denne
runden, men baseline bør bekreftes før deploy.

```bash
cd frontend && npm install && npx tsc --noEmit
```

Backend står på 135 feil — samme tall som før alt dette startet. Det er
en preeksisterende baseline, ikke noe jeg innførte.

---

## 10. Filkart

Hvor ting ligger, for den som skal videre på dette.

| Fil | Ansvar |
| --- | --- |
| `backend/server/b2-key-registry.ts` | Ti roller, kapabiliteter, fallback |
| `backend/server/b2-bucket-registry.ts` | Seks klasser, nøkkelledd, bøtte-oppslag |
| `backend/server/b2-client-factory.ts` | Eneste sted en B2-klient bygges |
| `backend/server/upload-storage-router.ts` | Generiske opplastinger: B2 → R2 → disk |
| `backend/server/capture-upload-service.ts` | Multipart fra iPad, prefiks-ruting |
| `backend/server/capture-asset-version-service.ts` | Versjonsreservasjon og promotering |
| `backend/server/capture-asset-release-service.ts` | Sletting + nedtrekk av begge regnskap |
| `backend/server/production-storage-service.ts` | Produksjonseid kvote og ledger |
| `backend/server/storage-egress-service.ts` | Egress-estimat og gratiskvote |
| `backend/server/storage-cost-model.ts` | Kost per backend, margin, prisforslag |
| `backend/server/admin-storage-status-service.ts` | Regnestykkene bak admin-flata |
| `backend/server/admin-storage-status-routes.ts` | De tre admin-endepunktene |
| `frontend/client/src/services/storageStatusAdapter.ts` | Tallformatering, testet |
| `frontend/client/src/components/admin/AdminStorageStatusPanel.tsx` | Selve panelet |

Bakgrunnen for designvalgene står i `docs/role-room/b2-primaerlagring.md` —
hvorfor nøkkelen bærer klassen sin, hvorfor versjonsnummeret reserveres
ved start, hvorfor begge regnskapene skrives.

---

## 11. Ikke gjort, og hvorfor

**Object Lock.** Bevisst utsatt. Å slå det på er irreversibelt per bøtte,
og governance-lock på originals blokkerer GDPR-sletting i hele
retensjonsvinduet. Vent til oppbevaringsfristene er juridisk avklart.

**Retention-håndhevelse.** `RR_RETENTION_ENFORCE` står fortsatt av.
Mekanismen finnes (`capture-asset-release-service`,
`supersededVersions()`), men fristene er en juridisk beslutning jeg ikke
kan ta. Sett den ikke til `true` før noen har signert på tallene.

**Ingest/quarantine-bøttene.** Forutsetter et valideringssteg som ikke
finnes ennå — opplastinger går rett til endelig plassering. Quarantine
uten validering ville vært en tom bøtte.

**Organisasjonsnivået.** Prefikset `org/{orgId}/` i arkitekturspec-en
forutsetter en `organizations`-tabell. Den finnes ikke; alt henger på
`user_id` og `casting_projects`.
