# B2 — hva som gjenstår å kjøre på Mac-en

Alt i denne fila er ting jeg **ikke** kunne fullføre i sesjonsmiljøet, med
grunnen og med kommandoene som faktisk skal kjøres. Rekkefølgen er den
jeg ville brukt.

Miljøet mangler tre ting: Swift-toolchain, nettverkstilgang til Backblaze,
og `frontend/node_modules`. Alt annet er verifisert her — backend-suiten
(2746 tester) og migrasjonene er kjørt mot en ekte Postgres 16.

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
b2 key create --bucket "$BUCKET" trr-archive       listFiles,readFiles,writeFiles,shareFiles

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
B2_KEY_ARCHIVE_ID=…             B2_KEY_ARCHIVE_SECRET=…
B2_KEY_ADMIN_ID=…               B2_KEY_ADMIN_SECRET=…
```

Når alle sju er på plass:

```
B2_REQUIRE_SCOPED_KEYS=true
```

Da blir fallback til fellesnøkkelen en feil i stedet for en stille
nedgradering. Sett den **først** når alle sju er inne — ellers stopper
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

De atten modulene som fortsatt leser fellesnøkkelen direkte
(`admin-academy-b2-routes`, `pitch-deck-asset-service`,
`sales-leadership-routes`, `admin-system-backup-routes`,
`b2-archive-helper`, m.fl.) er **ikke** flyttet over. De vil fortsette å
bruke `B2_ROLE_ROOM_*`. Behold den nøkkelen til de er migrert hver for
seg.

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

## 3. Kjør migrasjonene

Fire nye, i rekkefølge:

```
backend/migrations/0464_storage_ledger_b2_backend.sql
backend/migrations/0465_production_storage_ledger.sql
backend/migrations/0466_storage_egress_ledger.sql
backend/migrations/0467_capture_asset_versions.sql
```

Alle er kjørt mot en scratch-Postgres 16 her og verifisert med
integrasjonstester. 0464 endrer en eksisterende funksjon
(`apply_storage_consumption_delta`) med `CREATE OR REPLACE` — den er
trygg å kjøre om igjen.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f backend/migrations/0464_storage_ledger_b2_backend.sql \
  -f backend/migrations/0465_production_storage_ledger.sql \
  -f backend/migrations/0466_storage_egress_ledger.sql \
  -f backend/migrations/0467_capture_asset_versions.sql
```

`0465` har fremmednøkkel mot `casting_projects(id)`. Feiler den, mangler
tabellen i den databasen.

---

## 4. Kjør integrasjonstestene

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

## 5. Typecheck frontend

**Hvorfor ikke gjort her:** `frontend/node_modules` er tom, og
npm-registeret er blokkert i miljøet. Jeg har ikke rørt frontend i denne
runden, men baseline bør bekreftes før deploy.

```bash
cd frontend && npm install && npx tsc --noEmit
```

Backend står på 135 feil — samme tall som før alt dette startet. Det er
en preeksisterende baseline, ikke noe jeg innførte.

---

## 6. Ikke gjort, og hvorfor

**Bucket-splitten.** Neste steg etter nøklene. Prefiks-rutingen som er på
plass gjør den trygg: nye filer skrives til riktig bøtte, gamle blir
liggende og leses fra der de faktisk er. Krever at bøttene opprettes
først, og at hver rolle-nøkkel får riktig bøtte via
`B2_KEY_<ROLLE>_BUCKET`.

**Object Lock.** Bevisst utsatt. Å slå det på er irreversibelt per bøtte,
og governance-lock på originals blokkerer GDPR-sletting i hele
retensjonsvinduet. Vent til oppbevaringsfristene er juridisk avklart.

**Retention-håndhevelse.** `RR_RETENTION_ENFORCE` står fortsatt av.
Mekanismen finnes (`capture-asset-release-service`,
`supersededVersions()`), men fristene er en juridisk beslutning jeg ikke
kan ta. Sett den ikke til `true` før noen har signert på tallene.

**De atten modulene på fellesnøkkelen.** Se punkt 1.

**Ingest/quarantine-bøttene.** Forutsetter et valideringssteg som ikke
finnes ennå — opplastinger går rett til endelig plassering. Quarantine
uten validering ville vært en tom bøtte.

**Organisasjonsnivået.** Prefikset `org/{orgId}/` i arkitekturspec-en
forutsetter en `organizations`-tabell. Den finnes ikke; alt henger på
`user_id` og `casting_projects`.
