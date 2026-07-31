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

## 6. Typecheck frontend

**Hvorfor ikke gjort her:** `frontend/node_modules` er tom, og
npm-registeret er blokkert i miljøet. Jeg har ikke rørt frontend i denne
runden, men baseline bør bekreftes før deploy.

```bash
cd frontend && npm install && npx tsc --noEmit
```

Backend står på 135 feil — samme tall som før alt dette startet. Det er
en preeksisterende baseline, ikke noe jeg innførte.

---

## 7. Ikke gjort, og hvorfor

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
