# Samlet plan

Alt fra denne sesjonen, sekvensert. Skrevet fordi arbeidet ligger spredt
over fem dokumenter og det er vanskelig å se rekkefølgen.

To ting å vite før du leser:

**Rekkefølgen er ikke tilfeldig.** Fase 0 er ting som er ferdig bygget men
ikke tatt i bruk — den gir mest verdi per time og blokkerer flere av de
andre. Fase 3 og 4 er de dyre, og de bør ikke starte før du har sett at
fase 1 faktisk holder i drift.

**«Ferdig» betyr pushet, testet og typesjekket** — ikke at det er i bruk.
Nesten alt i fase 0 er ferdig kode som venter på en innlogging eller en
beslutning.

---

## Status i dag

| Område | Bygget | I bruk | Blokkert av |
| --- | --- | --- | --- |
| B2 primærlagring | ✅ | ❌ | Nøkler + bøtter |
| Produksjonseid kvote | ✅ | ❌ | Migrasjon |
| Asset-versjonering | ✅ | ❌ | Migrasjon |
| Egress-måling | ✅ | ❌ | Migrasjon |
| Kostmodell | ✅ | ⚠️ | Avtalepriser mangler |
| Avgrensede nøkler | ✅ | ❌ | Provisjonering |
| Bøtte-splitt | ✅ | ❌ | Bøtter finnes ikke |
| Admin lagringsstatus | ✅ | ❌ | Frontend-bygg |
| AML-flaten | ✅ | ✅ | — |
| Stripboardet | ✅ | ✅ | — |
| Live Set (slått sammen) | ✅ | ✅ | — |
| Take-godkjenning (backend) | ✅ | ❌ | Ingen skjerm |
| Take-godkjenning (skjerm) | ❌ | ❌ | Ikke bygget |
| Native Live Set-app | ❌ | ❌ | Ikke bygget |
| Retention-håndhevelse | ✅ | ❌ | Juridisk avklaring |

⚠️ Kostmodellen regner på listepris til avtaleprisene settes. Tallene ser
riktige ut mens de er feil.

---

## Fase 0 — Ta i bruk det som allerede er bygget

Ingen ny kode. Dette er den billigste verdien i hele planen, og det
meste av fase 1 avhenger av det.

**0.1 Kjør migrasjonene** (`0462`–`0467`). Detaljer i
`b2-overlevering-mac.md` punkt 4. Uten disse gjør ingenting av
lagringsarbeidet noe som helst.

**0.2 Provisjoner nøkler og bøtter.** Punkt 1 og 3. Krever
Backblaze-innlogging. Sett `B2_REQUIRE_SCOPED_KEYS=true` først når alle
ti nøkler er inne — ellers stopper opplastinger.

**0.3 Sett kostgrunnlaget.** Punkt 7. To minutter, og det er forskjellen
på at admin-flata viser sann margin eller listepris. Har du ikke
avtalepriser ennå, la defaultene stå og vit at marginen er
underrapportert.

**0.4 Bygg iPad-appen og typesjekk frontend.** Punkt 2 og 9. Begge er
verifisering av kode jeg har skrevet men ikke kunnet kompilere.

**Når fase 0 er ferdig** vet du hvor mye lagring hver produksjon faktisk
bruker, hva den koster, og om noen nærmer seg egress-grensen. Det er
grunnlaget for å prise noe som helst.

---

## Fase 1 — Lukk lagringssløyfa

Kan bygges nå. Ingenting her krever noe fra deg utover én juridisk
avklaring.

**1.1 Reconcile-jobb.** Regnskapet vårt mot hva som faktisk ligger i
bøtta. Vi har `reconciled_at`-kolonner i tre tabeller og ingenting som
skriver dem. Uten den vet vi ikke om ledgeren driver fra virkeligheten —
og en ledger ingen kontrollerer er en ledger ingen kan fakturere på.

Konkret: list objekter per prefiks, sammenlign mot
`role_room_production_storage` og `user_storage_consumption`, skriv avvik
til en rapport. Ikke korriger automatisk i første omgang — et avvik kan
like gjerne bety at slettingen feilet som at tellingen gjorde det.

**1.2 Retention-håndhevelse.** Mekanismen finnes
(`capture-asset-release-service`, `supersededVersions()`).
`RR_RETENTION_ENFORCE` står av fordi fristene er en juridisk beslutning.

**Dette trenger jeg fra deg:** hvor lenge skal kameramedier, selftapes og
godkjente leveranser oppbevares? Norsk personvernrett setter rammene for
selftapes (personopplysninger om skuespillere); kontraktene setter dem for
produksjonsmateriale. Jeg kan ikke gjette på noen av dem.

**1.3 Ingest + validering + quarantine.** Nå har det et innhold, siden
bøttene finnes. Opplastinger går i dag rett til endelig plassering; en
fil regnes som gyldig i det den er skrevet.

Flyten: last opp til ingest → sjekk størrelse, checksum, MIME → flytt til
originals, eller til quarantine hvis noe skurrer. Ingest får kort
retention (3–7 dager), quarantine 14.

**1.4 Object Lock.** Vent. Å slå det på er irreversibelt per bøtte, og
governance-lock på originals blokkerer GDPR-sletting i hele
retensjonsvinduet. Ta det etter 1.2, når fristene er avklart.

---

## Fase 2 — Fullfør Live Set

**2.1 REVIEW-skjermen.** Godkjenningsflyten er bygget og testet på
serversiden — fem ruter, en tilstandsmaskin, og `availableActions` på hver
rad slik at skjermen slipper å reimplementere den. Men det finnes ingen
skjerm, så flyten er utilgjengelig.

Dette er den korteste veien fra «bygget» til «brukt» i hele planen.
Backend er ferdig; det som mangler er tegning.

**2.2 Live Set mot produksjonsledgeren.** Live Set-skjermen viser i dag
ikke hvor mye lagring innspillingsdagen har brukt. Nå som tallet finnes
per produksjon, hører det hjemme der — en DIT som ser at dagen har brukt
800 GB tar andre valg enn en som ikke ser det.

---

## Fase 3 — Native Live Set-app

Dokumentert i `live-set-ipad-native.md`. Ikke påbegynt.

**Dette er den dyre fasen.** Vurder om den skal starte i det hele tatt før
fase 2 har vist at REVIEW-flyten brukes.

**3.1 `CameraControlKit`-utrekket.** Forutsetningen. Canon CCAPI-koden
ligger i CaptureApp og må ut i delt pakke, på samme måte som `OutboxKit`
og `NetworkingKit` allerede er trukket ut.

**3.2 Selve appen.** Egen flate, ikke en modul i CaptureApp — det var
beslutningen. Gjenbruker de tre pakkene.

**3.3 Navnekollisjonen.** `LiveSetDashboardModel` finnes allerede.
Film-flaten trenger et annet navn før koden vokser.

---

## Fase 4 — Organisasjonsnivå

Arkitekturspec-en forutsetter `org/{orgId}/` i hver nøkkel. Den tabellen
finnes ikke; alt henger på `user_id` og `casting_projects`.

**Dette er en datamodell-endring, ikke en lagringsendring.** Den treffer
tilgangskontroll, fakturering, kvote og hver eneste objektnøkkel. Den bør
gjøres når du faktisk har kunder med flere produksjonsselskaper under seg
— ikke før.

Nøkkelrommet er allerede forberedt på det: prefiks-rutingen tåler et ledd
til uten at gamle nøkler slutter å virke.

---

## Det jeg ville gjort

Fase 0 denne uka. Den er ferdig kode som venter på en innlogging, og uten
den er alt det andre arbeidet inert.

Så **2.1 REVIEW-skjermen** — kortest vei fra bygget til brukt, og den
gjør godkjenningsflyten faktisk tilgjengelig.

Så **1.1 reconcile**, fordi et regnskap ingen kontrollerer ikke er verdt
å fakturere på.

**1.2 retention** når du har fristene. **1.3 ingest** når du har sett at
volumet faktisk krever validering — det er ikke gitt at det gjør det ennå.

Fase 3 og 4 ville jeg utsatt til noe i drift gjør dem nødvendige.

---

## Hva jeg trenger fra deg

| Beslutning | Blokkerer | Hvorfor jeg ikke kan ta den |
| --- | --- | --- |
| Oppbevaringsfrister | 1.2, 1.4 | Juridisk, ikke teknisk |
| Avtalepriser B2 | 0.3 | Du har avtalen |
| Backblaze-innlogging | 0.2 | Legitimasjon |
| Skal fase 3 startes? | 3.x | Kost/nytte, ikke arkitektur |

---

## Dokumentkart

| Dokument | Dekker |
| --- | --- |
| `b2-overlevering-mac.md` | Hva som må kjøres lokalt, med kommandoer |
| `b2-primaerlagring.md` | Hvorfor lagringen er som den er |
| `del-a-kodekartlegging.md` | AML, stripboard, økonomi, Live Set-merge, godkjenningsflyt |
| `live-set-ipad-native.md` | Plan for den native appen |
| `samlet-plan.md` | Denne — rekkefølgen |
