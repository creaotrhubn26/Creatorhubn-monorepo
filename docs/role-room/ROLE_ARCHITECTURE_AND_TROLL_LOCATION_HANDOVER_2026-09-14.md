# The Role Room: rollearkitektur og Troll-lokasjoner

Dato: 14. september 2026
Status: Kode og backend er i produksjon på `theroleroom.com`. Dette dokumentet er overleveringen til neste arbeidsøkt eller Claude.

## Kort konklusjon

Den pågående leveransen er fullført. Troll-prosjektets fem grunnlokasjoner har gyldige, kartbare adresser og koordinater, lokasjonsanalysen godtar et eksakt Kartverket-treff selv om treffet mangler matrikkel-/property-ID, og den tidligere produksjonskrasjen fra blandede MUI-versjoner er fjernet. Endringene er merget til `main`, promotert til den dedikerte `live/roleroom`-grenen og bekreftet på `https://theroleroom.com`.

Rollearkitekturen har samtidig fått et tydelig fundament: én produksjon, én delt prosjektgraf og rollebaserte arbeidslinser over de samme dataene. Kodebasen har nå et kanonisk kataloglag med 79 produksjonsroller i 31 avdelinger og dedikerte arbeidsflater for regissør, filmfotograf, regiassistenter, produksjonsleder, produksjonskoordinator, location-avdelingen og script supervisor. Det viktigste som står igjen er å gjøre tildeling, tilgang, arbeidsflater og operasjonelle datalinjer helt registerstyrte før flere avdelingsflater bygges.

## Levert i den avsluttede lokasjonsrunden

### Gyldige adresser i Troll

| Lokasjon | Lagret adresse | Koordinater | Avgrensning |
| --- | --- | --- | --- |
| Dovrefjell | Hjerkinnhusvegen 33, 2661 Hjerkinn | 62.221369748446335, 9.545710818134248 | Kartbar base/reference ved Hjerkinn; faktisk opptakspunkt må scout-bekreftes. |
| Lærdalstunnelen | Håbakken 1, 6887 Lærdal | 61.064242216726036, 7.5091786081532 | Produksjonsbasekandidat ved vestre tunnelmunning. Selve tunnelen har ikke en vanlig gateadresse. |
| Statsministerens kontor | Einar Gerhardsens plass 2, 0179 Oslo | 59.915476919195164, 10.747079786878066 | Offisiell besøksadresse; filming og sikkerhet må avklares separat. |
| Østerdalen gård | Vollanveien 221, 2512 Kvikne | 62.5697007013055, 10.303484139189125 | Offentlig scout-/referansekandidat; eier og faktisk opptaksområde er ikke bekreftet. |
| Tobias hytte | Synnfjellvegen 1879, 2880 Nord-Torpa | 61.12914119732402, 9.871904330537753 | Offentlig scout-/referansekandidat; hytte, tilgang og avtale er ikke bekreftet. |

Adressene ble lagt i både demo-seed og en idempotent, strengt prosjektavgrenset migrasjon for `troll-project-2026` og `troll-1780071501773`. Migrasjonen oppdaterer normaliserte rader og legacy-kompatibilitetsdata uten å reseede prosjektet eller berøre andre leietakere.

Relevante filer:

- `backend/server/troll-demo-seed-service.ts`
- `backend/migrations/0606_troll_demo_verified_location_addresses.sql`
- `backend/server/troll-demo-location-addresses.test.ts`

Eksterne holdepunkter som ble brukt i verifiseringen:

- [Statsministerens kontor – kontakt og besøksadresse](https://www.regjeringen.no/no/dep/smk/kontakt/id883/)
- [Tynset kommune – Vollan gård](https://www.tynset.kommune.no/turistinformasjon/severdigheter/)
- [Spåtind – offentlig besøksinformasjon](https://www.spatind.no/om/)
- [Lærdal kommune – informasjon om Håbakken/Lærdal](https://laerdal.kommune.no/ny-i-lardal/)
- [Visit Norway – Viewpoint Snøhetta](https://www.visitnorway.no/listings//viewpoint-snohetta/181162/)

### Presis og konservativ lokasjonsanalyse

Feilen var at dialogen først fikk et gyldig adressetreff, men deretter krevde en `propertyId` fra et eldre Kartverket-kall. Kartverkets adresseoppslag gir ikke alltid en slik ID. Et gyldig treff ble derfor feilaktig vist som «Kunne ikke finne lokasjons-ID for denne adressen».

Nå behandles et eksakt adressetreff uten property-ID som verifisert adressegrunnlag, men uten oppdiktede tekniske konklusjoner:

- ingen readiness-, risiko- eller kostnadsscore blir beregnet uten dokumentasjon;
- driftstilstand settes til `unverified`;
- kilde settes til `kartverket`;
- bruker får tydelig beskjed om at drone, vær, lys, parkering og tilgjengelighet må verifiseres etter scout;
- analysen lagres og kan åpnes igjen;
- det gjøres ikke et ugyldig property-kall.

Relevante filer:

- `frontend/client/src/components/role-room/components/LocationAnalysisDialog.tsx`
- `frontend/e2e/role-room-location-manager-troll.spec.ts`

### MUI-produksjonskrasj

Vite-bygget kunne laste MUI 6 fra frontend og MUI 7 fra den hoistede backend-avhengigheten i samme runtime. Det ga blant annet `t.alpha is not a function` i Production Plan. `@mui/material` og `@mui/system` er nå eksplisitt deduplisert i `frontend/vite.config.ts`, slik at produksjonsbundlen bruker én runtime.

### Drizzle ORM og S3

Drizzle-skjemaet er allerede samkjørt med Location Manager-leveransen:

- `role_room_location_operations` er den versjonerte, konfliktbeskyttede operasjonslinjen per prosjekt og lokasjon;
- `casting_location_scout_media` beskriver private, checksum-verifiserte og retry-sikre scoutfiler;
- databasekontrakten krever `aws_s3`, bøtten `the-role-room-prod-745600963362-eu-north-1` og objektsti under `organizations/`;
- SQL-migrasjonen `0603_role_room_location_operations.sql` og `backend/migrations/role-room-schema.ts` beskriver samme domene.

Dette skal ikke splittes til en ny lokasjonsdatabase eller en parallell opplastingsmodell.

## Verifisering og produksjonsstatus

### Lokal og automatisert verifisering

- 25 målrettede tester for adresse-, analyse- og nærliggende flyter bestod i første release.
- Backend- og frontend-typecheck bestod.
- Frontend ESLint bestod.
- Full produksjonsbygg bestod med 23 905 moduler og alle Role Room-/Leadgrid-prerender.
- Hele Location Manager-spesifikasjonen bestod: 3 av 3 scenarier, inkludert eksakt analyse uten property-ID og konservativ tilstand ved upresis adresse.
- Migrasjonen ble kjørt mot midlertidig PostgreSQL: 10 normaliserte Troll-rader og to kompatibilitetsprosjekter ble oppdatert, andre rader var uendret, og andre kjøring ga 0/0 endringer.
- Alle åtte sentrale PR-porter bestod: autentiserte Troll-flyter, backend Vitest, CreatorHub Sentinel, frontend ESLint, frontend typecheck, secretscan, Story Arc E2E og Visual Editor-regresjon.

### Produksjon

- Adresse- og MUI-release: [PR #2321](https://github.com/creaotrhubn26/Creatorhubn-monorepo/pull/2321), merge `0dd0581e100cd5c8b9fc5e82383161ef65cb18ed`.
- Analyse uten property-ID: [PR #2323](https://github.com/creaotrhubn26/Creatorhubn-monorepo/pull/2323), merge og aktiv live-SHA `e5bbd1d04a9a7317490c2b7ed3f022be9d56cb84`.
- Produksjonspipeline: [run 34862422965](https://github.com/creaotrhubn26/Creatorhubn-monorepo/actions/runs/34862422965), bestått.
- Dedikert Role Room-promotering: [run 34884564490](https://github.com/creaotrhubn26/Creatorhubn-monorepo/actions/runs/34884564490), bestått.
- `origin/main`, `origin/live/creatorhub` og `origin/live/roleroom` pekte på samme release-SHA ved avslutning.
- `https://theroleroom.com/build-info.json` og backendens `/api/version` rapporterte samme SHA.

Live-test med innlogget Troll-prosjekt bekreftet at Dovrefjell åpner «Lokasjonsanalyse», viser «Adressetreff bekreftet: Hjerkinnhusvegen 33, DOVRE» og den konservative informasjonsteksten. Den tidligere røde lokasjons-ID-feilen ble ikke vist. Konsollen hadde ingen ukontrollert React-/JavaScript-feil. En enkelt forespørsel til Google Analytics endte med `ERR_CONNECTION_CLOSED`; det er en ekstern analyseforespørsel og påvirket ikke Role Room-flyten.

`theroleroom.com` måtte promoteres eksplisitt fordi nettstedet følger den isolerte `live/roleroom`-grenen. En vellykket CreatorHub-promotering alene oppdaterer ikke nødvendigvis Role Room. Dette er årsaken til at en tidligere kontroll havnet på `creatorhubn.com`; den endelige kontrollen ble gjort på riktig domene.

## Rollearkitekturen Claude skal videreføre

### Grunnprinsipp

Ikke bygg en ny app eller en ny prosjektmodell per rolle. Arkitekturen er:

```text
ProfessionMode
  velger produktdomene, for eksempel production, dance eller education
    -> produksjonsrolle i ett prosjekt
       velger tilgang og anbefalt workspace-linse
         -> workspace-linsen viser relevante flater
            over den samme prosjektgrafen og de samme serverdataene
```

En workspace-linse er en rolletilpasset komposisjon, ikke et datasilo. Regissør, filmfotograf, 1st AD, location manager og script supervisor skal se ulike prioriteringer og handlinger, men scene, opptaksdag, lokasjon, rolle, kandidat, shot, utstyr og budsjett må beholde samme identitet på tvers av linsene.

### Kanoniske kilder

Start alltid med disse før arkitekturen endres:

- `frontend/client/src/components/role-room/config/productionRoleCatalog.ts`: 79 roller, 31 avdelinger, aliaser, rapporteringslinjer og rolle-til-workspace-mapping.
- `frontend/client/src/components/role-room/components/production/productionWorkspaceLens.ts`: tillatte workspace-linser.
- `frontend/client/src/components/role-room/components/CastingPlannerPanel.tsx`: dagens ruting, lens/surface/scene-dyplenker og komposisjon. Dette er foreløpig orkestratoren, men er for stor.
- `backend/migrations/role-room-schema.ts`: kanonisk Drizzle-skjema.
- `backend/server/casting-project-ownership.ts`: serverens fail-closed prosjekt- og operasjonsrettigheter.
- `backend/server/casting-production-routes.ts`: versjonerte produksjons-, koordinasjons-, continuity- og location-operasjoner.
- `backend/server/role-room-storage-key.ts`: kanoniske private S3-nøkler.

Viktig skille:

- `ProfessionMode` beskriver hvilket produktområde brukeren er i.
- `casting_user_roles` beskriver prosjektmedlemskap og prosjektrolle.
- `casting_crew` beskriver en person som produksjonsressurs.
- `PRODUCTION_ROLES` beskriver det kanoniske yrket og organisasjonsplassen.
- Workspace-linsen er bare presentasjon og navigasjon; den kan aldri være eneste autorisasjonskontroll.

### Arbeidsflater som finnes nå

| Område | Status | Viktigste implementasjon |
| --- | --- | --- |
| Regissør | Dedikert linse | `components/director/DirectorWorkspace.tsx`, seks flater: i dag, scener, casting, visuell plan, on-set og post. |
| Regissør per scene | Dedikert scenehub | `components/director/DirectorSceneWorkspace.tsx`, kobler manusutdrag, storyboard og shotlist til samme scene-ID. |
| Filmfotograf/DoP | Dedikert linse | `components/cinematographer/CinematographerWorkspace.tsx`, scene, shotplan, lys/utstyr, kamerateam og on-set. |
| 1st AD og 2nd AD | Dedikert linse | `components/assistant-director/`, rolleavhengig komposisjon for dagsbrief, stripboard, opptaksplan, call sheet, cast/crew og on-set. |
| Produksjonsleder | Dedikert linse | `components/production-management/`, separat management-versjon for godkjenninger, kost og avvik. |
| Produksjonskoordinator | Dedikert linse | `components/production-coordination/`, egen coordination-versjon og avgrenset ansvar. |
| Location manager/scout/security | Dedikert linse | `components/locations/`, operativ status, offline kø, S3-scoutmedia, analyse og Location Decision Room. |
| Script supervisor/continuity | Dedikert linse | `components/continuity/`, take-logg, lined-script-avvik, kommentarer, revisjoner og privat S3-media. |
| Casting | Eksisterende spesialiserte faner | Roller, kandidater, auditions og utvelgelse er modne fagflater, men er ikke samlet som en egen `casting`-lens i lens-registeret. |
| Produsent | Eksisterende prosjekt-/plannerflater | Store deler finnes, men `producer` i rollekatalogen har ikke en egen produksjons-lens i `ROLE_ROOM_WORKSPACE_LENSES`. |
| Andre fagroller | Katalogført, generisk workspace | Art, lyd, kostyme, hår/sminke, rekvisitt, set, transport, catering, PR og postroller peker foreløpig til `department`. |

Sporbare grunncommits:

- `f99cb0795` regissørrom
- `ac7d3dd10` scenehub for regissør
- `ab402a46b` kanonisk rollehierarki
- `c79c7492a` filmfotograf
- `000ab647b` 1st AD
- `8bf6f7672` 2nd AD
- `8aa6dcf40` produksjonsleder
- `fb426dfbd` produksjonskoordinator
- `fb3cbf428` continuity og privat media
- `de2bd1c7b` Location Manager
- `e9bb5e584` Location Decision Room

### Data- og konfliktmodell som skal gjenbrukes

Nye rolleflater skal følge samme mønster:

1. Les fra den delte prosjektgrafen.
2. Legg fagspesifikke operasjoner i en avgrenset servereid lane.
3. Bruk monoton versjon og optimistic concurrency; en `409` skal gi synlig sammenligning, aldri stille overskriving.
4. Logg aktør, tidspunkt og før/etter eller revisjon.
5. Hold lokale utkast separat, med tydelig «lokalt»/«synkronisert»-status.
6. Bruk private S3-objekter med kortlivede URL-er og prosjekt-/organisasjonsscope for media.
7. La kommentarer være bredere enn mutasjonsrettighet, men håndhev begge på serveren.

Eksisterende eksempler er `management_version`, `coordination_version` og `continuity_version` på produksjonsdagen, samt `role_room_location_operations.version` per lokasjon.

## Det som står igjen

### Prioritet 1: stabiliser rollen som plattformkontrakt

1. **Ett sentralt workspace-register.** Flytt lens-navn, støttede roller, standardflate, URL-parametere, navigasjonsmål, read/edit-permissions og komponentlasting til ett typed register. Dagens nested conditional- og switch-logikk i `CastingPlannerPanel.tsx` må bli en konsument av registeret.
2. **Serverautoritativ rolleoppløsning.** Frontendens persona- og adminlogikk er nyttig for presentasjon, men serveren må returnere effektiv prosjektrolle og eksplisitte grants i ett svar. Alle API-er skal bruke den samme resolveren.
3. **Flere prosjektroller per person.** `casting_user_roles` har i dag unikhet på `(project_id, user_id)` og representerer i praksis én rolle per bruker i prosjektet. Små produksjoner trenger for eksempel produsent + regissør eller DoP + kameraoperatør. Innfør normalisert assignment-tabell eller en trygg, migrerbar flerrollemodell før mer rollelogikk kopieres.
4. **Skill medlemskap fra crew-credit.** Ikke bruk `casting_crew.role`, profilens `professions` og `casting_user_roles.role` om hverandre. Definer én eksplisitt kobling mellom konto, prosjektassignment og crew-rad.
5. **Felles operasjonskontrakt.** Standardiser service- og API-form for `version`, `updatedAt`, `updatedBy`, `activity`, `revisions`, `comments`, offline-utkast og `409`-payload.
6. **Rollebasert E2E-matrise.** Test eier, produsent, fagansvarlig, assistent, leser og utenforstående mot samme prosjekt. Verifiser både skjulte kontroller og direkte API-kall.

### Prioritet 2: bygg Production Graph

Normaliser koblingene mellom:

```text
manuslokasjon -> scene -> storyboard/shot -> rolle/cast/crew
             -> opptaksdag -> fysisk lokasjon -> tillatelser/backup
             -> utstyr/transport/sikkerhet -> kost -> call sheet
             -> take/continuity -> review -> postleveranse
```

I dag finnes mange av nodene, men konsekvensen av en endring må fortsatt samles manuelt flere steder. Før en dato, fysisk lokasjon eller scene byttes, skal brukeren få en forhåndsvisning av berørte avdelinger, dokumenter, bookinger, kostnader og godkjenninger. Ingen AI eller automatikk skal endre produksjonsdata uten eksplisitt godkjenning og angremulighet.

### Prioritet 3: neste rolleleveranser

Bygg avdelingsvis og gjenbruk en felles department-shell. Anbefalt rekkefølge:

1. **Production Designer / Art Department.** Samler manusbehov, sett, rekvisitt, kostyme, hår/sminke, konstruksjon, konsept og storyboard mot scene og opptaksdag. Dette tester om Production Graph faktisk fungerer på tvers av mange underavdelinger.
2. **Produksjonslyd.** Sound mixer og boom trenger lydforhold per lokasjon/scene, kanal- og radioplan, sound report, take-kobling og overlevering til post.
3. **Rekvisitt, set, kostyme og hår/sminke.** Bruk samme asset-/continuity-kjerne med eierskap, tilstand, bilder før/etter, hvem/hvilken scene og dagsbehov.
4. **Transport, sikkerhet, catering og unit-logistikk.** Knyttes til production day, location, crew count, call time og avvik.
5. **Post supervisor, editorial, post sound, VFX og musikk.** Bygg leveransemanifest, versionsporing, review/godkjenning og opphav/rights over samme scene-/take-identitet.
6. **Generisk department workspace.** Før de siste smårollene får spesialflater, lever én trygg shell med «I dag», mine oppgaver, behov, filer, beslutninger, avvik og overlevering. Spesialisering skal være moduler i shellen, ikke kopierte apper.

Casting og produsent bør samtidig registreres eksplisitt i det samme workspace-registeret, selv om dagens fagflater gjenbrukes. Det fjerner særlogikk og gjør rollebytte forutsigbart.

### Definition of Done for hver ny rolle

En rolle er ikke ferdig bare fordi et dashboard finnes. Hver rolleleveranse må ha:

- dokumentert research med faktiske fagpersoner og avgrensede pain points;
- rolle, avdeling, rapporteringslinje, alias og workspace-mapping i katalogen;
- les-/skriv-/kommentarrettigheter håndhevet både i UI og API;
- delt prosjektidentitet for scene, dag, lokasjon, person og asset;
- versjonert persistence, konfliktvisning, aktivitet og gjenopprettbart lokalt utkast;
- mobil portrait, mobil landscape, nettbrett og desktop uten horisontal overflow;
- touchmål på minst 44 px og full tastatur-/skjermleserflyt;
- tom, loading, offline, forbidden, conflict og stale-state;
- testdata i Troll uten oppdiktet produksjonsfakta;
- modelltest, service-/API-test, autorisasjonstest og autentisert E2E;
- migrasjonskonvergens, Drizzle/SQL-paritet, build og live-konsollsjekk;
- en tydelig tilbakevei til full workspace og en kopierbar dyplenke.

## Kjente mangler etter denne leveransen

Disse er dokumentert og skal ikke tolkes som ferdige:

- De fem adressene gjør demoen kartbar, men bekrefter ikke faktisk opptakspunkt, grunneier, kontrakt, tilgang, parkering, vær, drone, trafikk, sikkerhet eller tillatelse.
- Håbakken er en basekandidat for Lærdalstunnelen, ikke en påstand om at tunnelen kan filmes fra gateadressen. Eksakt tunnelpunkt og vegeieravklaring gjenstår.
- Dovrefjell, Østerdalen og Tobias hytte er scout-/referansekandidater. Kontakt, tilgjengelighet og rettigheter gjenstår.
- Kommune-/tillatelseskatalogen er ikke komplett for alle kommuner. Manglende kilde skal fortsatt vises som manglende, aldri erstattes av generisk godkjenning.
- Ved 390 px responsive-emulering viste den åpne lokasjonsanalysen horisontal overflow og avkuttet innhold. Det er ikke rettet i denne closeout-runden og trenger en egen mobil/touch-regresjon.
- Den eksterne Google Analytics-forespørselen kan feile med `ERR_CONNECTION_CLOSED`. Ingen appfeil ble observert, men telemetrileveransen bør kontrolleres separat hvis den er forretningskritisk.
- Rolleoppløsning og workspace-ruting er fremdeles delvis håndkodet i den store `CastingPlannerPanel.tsx`.
- En bruker kan ikke ha flere normaliserte prosjektroller gjennom dagens unike `casting_user_roles`-rad.
- Mange avdelinger er katalogført, men mangler dedikert eller modulær department-workspace.
- Production Graph og automatisk, forhåndsvisbar change impact er ikke ferdig.

Det finnes ingen kjent blokkering igjen for Troll-adressenes gyldighet eller for å åpne og lagre en konservativ lokasjonsanalyse uten property-ID.

## Konkret startpunkt for neste Claude-økt

1. Les dette dokumentet og de syv kanoniske kildefilene nevnt over.
2. Bekreft live-SHA før endring; ikke anta at `creatorhubn.com` og `theroleroom.com` følger samme live-gren.
3. Lag først en repository-grounded plan for workspace-register og flerrolle-assignment. Ikke implementer en ny rolle før migrasjons- og kompatibilitetsstrategien er eksplisitt.
4. Bevar URL-kontrakten `project`, `tab`, `lens`, `surface` og `scene`, inkludert back/forward og refresh.
5. Bruk Troll til E2E, men ikke skriv nye faktapåstander inn i demoen uten verifisert kilde.
6. Etter plattformarbeidet: start Production Designer / Art Department som neste vertikale rolleleveranse.
