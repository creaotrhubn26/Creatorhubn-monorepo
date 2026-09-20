# The Role Room: rollearkitektur og Troll-lokasjoner

Dato: 14. september 2026
Status: Lokasjonsleveransen er i produksjon på `theroleroom.com`. Tillegget for Production Designer / Art Department er verifisert på arbeidsgren, men ikke merget eller deployet. Dette dokumentet er overleveringen til neste arbeidsøkt eller Claude.

## Kort konklusjon

Den pågående leveransen er fullført. Troll-prosjektets fem grunnlokasjoner har gyldige, kartbare adresser og koordinater, lokasjonsanalysen godtar et eksakt Kartverket-treff selv om treffet mangler matrikkel-/property-ID, og den tidligere produksjonskrasjen fra blandede MUI-versjoner er fjernet. Endringene er merget til `main`, promotert til den dedikerte `live/roleroom`-grenen og bekreftet på `https://theroleroom.com`.

Rollearkitekturen har samtidig fått et tydelig fundament: én produksjon, én delt prosjektgraf og rollebaserte arbeidslinser over de samme dataene. Kodebasen har nå et kanonisk kataloglag med 80 produksjonsroller i 31 avdelinger og dedikerte arbeidsflater for regissør, filmfotograf, regiassistenter, produksjonsleder, produksjonskoordinator, location-avdelingen og script supervisor. Det viktigste som står igjen er å gjøre tildeling, tilgang, arbeidsflater og operasjonelle datalinjer helt registerstyrte før flere avdelingsflater bygges.

### Tillegg 20. september 2026: Production Designer / Art Department

Neste vertikale rolleleveranse er implementert og verifisert på arbeidsgrenen `codex/role-room-production-designer`, men er **ikke merget, deployet eller live** når dette tillegget skrives. Den historiske produksjonsstatusen over gjelder fortsatt bare release-SHA-ene som er oppgitt i produksjonsavsnittet.

Produksjonsdesigner og de tilknyttede art-rollene rutes nå til `art-department`-linsen med fem sammenhengende flater:

- oversikt over uavklarte sceneplaner, rekvisittkoblinger, beslutninger og revisjonsspor;
- scenevis art-breakdown med status, praktisk lokasjon/set build/hybrid, fagbehov og dokumentert designintensjon;
- visuell retning med fase, palett, designintensjon og eksisterende storyboardreferanser;
- avdelingshandoff for art direction, set decoration, rekvisitt, kostyme, hår/sminke, konstruksjon, SFX og VFX;
- samlet handoff-review før informasjonen sendes videre til produksjon.

Tilstanden lagres i en prosjektavgrenset, versjonert Postgres-lane gjennom `GET/PATCH /api/role-room/projects/:projectId/art-department`. Lagreoperasjonen bruker optimistic concurrency. Ved `409` beholdes det lokale utkastet, og brukeren må eksplisitt velge å laste serverversjonen; det skjer ingen stille overskriving. Audit-felt opprettes på serveren og kan ikke forfalskes fra klienten.

Autoriseringen er fail-closed og gjenbruker den kanoniske prosjektresolveren. Prosjekteier, eksplisitt grant eller en relevant art-rolle kan skrive. Andre aktive prosjektmedlemmer kan lese, mens utenforstående får 404. `production_designer` er samtidig lagt til i rollevalg, effektiv rolleoppløsning, administrasjonsnavigasjon og mobilnavigasjon.

Relevante filer:

- `frontend/client/src/components/role-room/components/art-department/ArtDepartmentWorkspace.tsx`
- `frontend/client/src/components/role-room/components/art-department/artDepartmentWorkspaceModel.ts`
- `frontend/client/src/components/role-room/services/artDepartmentService.ts`
- `backend/server/casting-production-art-department.ts`
- `backend/server/casting-production-routes.ts`
- `backend/migrations/0656_role_room_art_department_operations.sql`
- `frontend/e2e/role-room-production-designer-troll.spec.ts`

Verifisering på arbeidsgrenen:

- 51 målrettede frontendtester bestod;
- 107 målrettede backendtester bestod;
- frontend- og backend-typecheck bestod;
- autentisert Troll-E2E bestod på Chromium med lagring, reload, revisjonsspor og kontroll av kritiske konsollfeil;
- mobil-E2E bestod i stående og liggende visning med 44 px trykkflater og uten horisontal overflow.

Denne første leveransen viser allerede registrerte storyboardbilder og rekvisitter, men oppretter ikke en ny parallell filopplastingsmodell. Når egne art-referanser, tegninger og revisjoner får opplasting, skal de bruke den eksisterende private Role Room-kontrakten i AWS S3-bøtten `the-role-room-prod-745600963362-eu-north-1`, med organisasjons-/prosjektscope, checksum og kortlivede URL-er.

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

- `frontend/client/src/components/role-room/config/productionRoleCatalog.ts`: 80 roller, 31 avdelinger, aliaser, rapporteringslinjer og rolle-til-workspace-mapping.
- `frontend/client/src/components/role-room/components/production/productionWorkspaceLens.ts`: tillatte workspace-linser.
- `frontend/client/src/components/role-room/components/CastingPlannerPanel.tsx`: dagens ruting, lens/surface/scene-dyplenker og komposisjon. Dette er foreløpig orkestratoren, men er for stor.
- `backend/migrations/role-room-schema.ts`: kanonisk Drizzle-skjema.
- `backend/server/casting-project-ownership.ts`: serverens fail-closed prosjekt- og operasjonsrettigheter.
- `backend/server/casting-production-routes.ts`: versjonerte produksjons-, koordinasjons-, continuity- og location-operasjoner.
- `backend/server/role-room-storage-key.ts`: kanoniske private S3-nøkler.
- `frontend/client/src/components/role-room/components/art-department/`: produksjonsdesignerens komposisjon og konservative scenegrunnlag.
- `backend/server/casting-production-art-department.ts`: streng art-kontrakt, validering og servereid audit.

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
| Production Designer / Art Department | Dedikert linse på arbeidsgren | `components/art-department/`, fem flater over scenegrunnlag, visuell retning, beslutninger, avdelinger og handoff. Versjonert API/Drizzle-lane og E2E finnes, men leveransen er ikke deployet. |
| Casting | Eksisterende spesialiserte faner | Roller, kandidater, auditions og utvelgelse er modne fagflater, men er ikke samlet som en egen `casting`-lens i lens-registeret. |
| Produsent | Eksisterende prosjekt-/plannerflater | Store deler finnes, men `producer` i rollekatalogen har ikke en egen produksjons-lens i `ROLE_ROOM_WORKSPACE_LENSES`. |
| Andre fagroller | Katalogført eller delt faglinse | Art, kostyme, hår/sminke, rekvisitt, set og konstruksjon peker nå til den delte `art-department`-linsen på arbeidsgrenen. Lyd, transport, catering, PR og post peker foreløpig til `department`. |

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

Eksisterende eksempler er `management_version`, `coordination_version` og `continuity_version` på produksjonsdagen, `role_room_location_operations.version` per lokasjon og `role_room_art_department_operations.version` per prosjekt.

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

1. **Production Designer / Art Department — implementert på arbeidsgren, ikke deployet.** Første ende-til-ende-linje samler scenegrunnlag, settstrategi, rekvisitter, designintensjon, beslutninger, storyboardreferanser og avdelingshandoff. Neste art-iterasjon er fil-/revisjonshåndtering via privat S3, godkjenningsflyt og Production Graph-change impact.
2. **Produksjonslyd — neste vertikale rolleleveranse.** Sound mixer og boom trenger lydforhold per lokasjon/scene, kanal- og radioplan, sound report, take-kobling og overlevering til post.
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
- Art-linsen har versjonert fagdata og eksisterende storyboardreferanser, men mangler egne S3-opplastinger, tegningsrevisjoner, før/etter-sammenligning, formell regissør-/produsentgodkjenning og automatisk konsekvensanalyse mot budsjett og opptaksplan.

Det finnes ingen kjent blokkering igjen for Troll-adressenes gyldighet eller for å åpne og lagre en konservativ lokasjonsanalyse uten property-ID.

## Hierarkivedlegg: alle rollene i organisasjonskartet

Dette vedlegget speiler rollehierarkiet i referansebildet mot faktisk kode. Det skiller mellom at en rolle finnes i katalogen og at den har en reell, autorisert arbeidsflyt.

Status betyr:

- **Levert:** rollen rutes til en dedikert arbeidsflate med testet arbeidsflyt.
- **Delvis:** relevante verktøy eller en delt fagflate finnes, men rollen mangler full auto-ruting, egen operasjonskontrakt eller komplett E2E.
- **Katalog:** rolle, avdeling og rapporteringslinje finnes, men brukeren får foreløpig bare generisk/full workspace.
- **Modellgap:** noden i organisasjonskartet er bevisst modellert et annet sted eller mangler som prosjektassignment; dette må avgjøres eksplisitt.

### Above the line og fagledelse

| Avdeling | Rolle i hierarkiet | Status nå | Det som er tenkt og det som står igjen |
| --- | --- | --- | --- |
| Produsenter | Ansvarlig produsent (`executive_producer`) | Delvis | Overordnet finansiering, grønt lys, klient-/eiergodkjenning og milepæler. Koble eksisterende økonomi, review og leveranser til en eksplisitt producer-lens og servergrants. |
| Produsenter | Produsent (`producer`) | Delvis | Prosjektpuls, beslutninger, budsjett, casting, location sign-off, risiko og leveranse. Eksisterende plannerflater må registreres i samme workspace-register som de nye linsene. |
| Produsenter | Linjeprodusent (`line_producer`) | Delvis | Dagskost, bemanning, lokasjoner, avtaler og produksjonsberedskap. Trenger egen komposisjon over production management, coordination og location uten parallelle data. |
| Regi | Regissør (`director`) | Levert | Seks flater og scenehub finnes. Videre arbeid er å koble alle sign-offs til Production Graph og erstatte håndkodet ruting med registeret. |
| Kamera | Filmfotograf/DoP (`cinematographer`) | Levert | Dedikert lens finnes for scener, shotplan, lys/utstyr, kamerateam og on-set. Videre arbeid er avdelingsdelegasjon til kamera, lys og grip. |
| Manus | Manusforfatter (`writer`) | Delvis | Manus, kommentarer, analyse og strukturverktøy finnes. Rollen mangler eksplisitt production-lens, serveroppløst tilgang og ryddig overlevering fra låst manusrevisjon til avdelingene. |
| Cast | Hovedcast/skuespiller-noden i bildet | Modellgap | Hovedroller og skuespillere lever i `casting_roles` og kandidat/cast-domenet, ikke i `PRODUCTION_ROLES`. Avklar om booket cast også skal få prosjektassignment og en avgrenset cast-portal uten å duplisere castingdata. |

### Location, produksjonsledelse, regiassistenter, casting og continuity

| Avdeling | Rolle i hierarkiet | Status nå | Det som er tenkt og det som står igjen |
| --- | --- | --- | --- |
| Location | Location manager (`location_manager`) | Levert | Eier operativ sannhet, readiness, hold, tillatelser, kost, backup og beslutningsgrunnlag. Neste er komplett permit intelligence og Production Graph-change impact. |
| Location | Location scout (`location_scout`) | Levert | Samme location-lens med scout capture, offline kø og privat S3-media. Neste er sterkere mobil/touch, 360, feltmaler og dublettdeteksjon. |
| Location | Location security (`location_security`) | Levert | Samme lens med lesetilgang som standard; mutasjon krever eksplisitt grant. Neste er vaktplan, perimeter, publikumsflyt, hendelser og nødadkomst. |
| Produksjonsledelse | Produksjonsleder/UPM (`production_manager`) | Levert | Egen management-lane for godkjenning, kost, avvik og audit. Neste er portefølje på tvers av dager og konsekvensvisning før planendring. |
| Produksjonsledelse | Produksjonskoordinator (`production_coordinator`) | Levert | Egen coordination-lane for dokumenter, oppfølging og dagsforberedelse. Neste er maler, frister, leverandørdialog og tydelig handoff til 1st AD. |
| Produksjonsledelse | Produksjonssekretær (`production_secretary`) | Delvis | Skal dele coordinator-shell med dokumentregister, versjoner, distribusjon og møte-/dagslogg. Rollebasert auto-ruting og avgrensede grants mangler. |
| Produksjonsledelse | Produksjonsregnskapsfører (`production_accountant`) | Delvis | Skal dele management-data, men få kostrapporter, PO, petty cash, avvik og eksport uten tilgang til kreative mutasjoner. Egen modul og permission bundle mangler. |
| Produksjonsledelse | Kontor-PA (`office_production_assistant`) | Delvis | Skal få en oppgave-/dokument-/løperflate under coordinator. Katalogmapping finnes, men auto-ruting, begrenset skriveflate og E2E mangler. |
| Produksjonsledelse | Produksjonsmedarbeider (`collaborator`) | Katalog | Generisk produksjonsrolle. Skal få department-shell med tildelte oppgaver, filer, kommentarer og minst mulig prosjektinnsyn. |
| Innspillingsledelse | 1. regiassistent (`first_assistant_director`) | Levert | Dagsbrief, stripboard, opptaksplan, call sheet, cast/crew og on-set finnes. Neste er full schedule-change impact og låst distribusjon. |
| Innspillingsledelse | 2. regiassistent (`second_assistant_director`) | Levert | Rolleavhengig AD-flate finnes. Neste er cast movement, bakgrunn, transport/status og kommunikasjon koblet til samme produksjonsdag. |
| Innspillingsledelse | 2nd 2nd AD (`second_second_assistant_director`) | Delvis | Katalogen peker mot AD-workspace, men dagens effektive lens-resolver kjenner ikke rollen eksplisitt. Legg til registerruting, avgrenset cast-/bakgrunnsflyt og E2E. |
| Innspillingsledelse | Set-PA (`set_production_assistant`) | Delvis | Katalogen peker mot AD-workspace. Trenger mobil «mine oppgaver», lockup, talentbevegelse, kvittering og svært begrensede rettigheter. |
| Casting | Castingansvarlig (`casting_director`) | Delvis | Roller, kandidater, auditions og utvelgelse finnes som modne faner. Samle dem i en eksplisitt casting-lens med rollegrants og produksjonshandoff. |
| Casting | Lokal castingansvarlig (`local_casting_director`) | Delvis | Skal bruke casting-lens med geografisk/rollebasert scope, lokale lister og dokumenterte forslag. Scope og egen E2E mangler. |
| Casting | Statistansvarlig (`extras_casting_director`) | Delvis | Skal bruke casting-lens med bakgrunnsgrupper, availability, fitting, transport og dagsinnsjekk. Produksjonskobling og avgrenset portal mangler. |
| Kontinuitet | Script supervisor (`script_supervisor`) | Levert | Egen versioned lane, take-logg, lined-script-avvik, kommentarer, revisjoner og privat S3-media finnes. Neste er tettere live-set/post-handoff og mobilpolering. |

### Kamera, lys og grip

| Avdeling | Rolle i hierarkiet | Status nå | Det som er tenkt og det som står igjen |
| --- | --- | --- | --- |
| Kamera | Kameraoperatør (`camera_operator`) | Delvis | Katalogen peker mot cinematography. Trenger egne shots, kameraassignment, blokkeringer og take-status uten tilgang til DoP-beslutninger. |
| Kamera | 1. kameraassistent (`first_assistant_camera`) | Delvis | Katalogen peker mot cinematography. Planlagt modul for kamera-/linsepakke, fokusnotater, byggestatus, test og feilrapport. |
| Kamera | 2. kameraassistent (`second_assistant_camera`) | Delvis | Katalogen peker mot cinematography. Planlagt slate, media-ID, kamerarapport, kort/logg og utstyrsbevegelse koblet til take. |
| Kamera | DIT (`digital_imaging_technician`) | Delvis | Katalogen peker mot cinematography. Trenger checksum, offload-kø, kopier, rapport, LUT-/lookmetadata og verifisert post-handoff. |
| Kamera | Droneoperatør (`drone_pilot`) | Delvis | Katalogen peker mot cinematography. Trenger vær, sone, operatørbevis, tillatelse, flight plan og go/no-go koblet til location. |
| Lys | Gaffer (`gaffer`) | Delvis | Katalogen peker mot cinematography. Trenger lysplan, kraftbehov, crew/utstyr, prelight, sikkerhet og avvik per scene/location. |
| Lys | Best boy electric (`best_boy_electric`) | Katalog | Planlagt department-shell for kraftdistribusjon, bemanning, last, dagsoppgaver og avvik under gaffer. |
| Lys | Generatoroperatør (`generator_operator`) | Katalog | Planlagt mobilflate for generator, drivstoff, kabling, kapasitet, driftstid, støy og sikkerhet. |
| Lys | Lystekniker (`lighting_technician`) | Katalog | Planlagt «mine oppgaver», riggpunkt, utstyrsstatus og sikker kvittering uten budsjett-/designrettigheter. |
| Grip | Key grip (`key_grip`) | Delvis | Katalogen peker mot cinematography. Trenger riggplan, bevegelse, sikkerhet, mannskap, utstyr og godkjenning med DoP/1st AD. |
| Grip | Best boy grip (`best_boy_grip`) | Katalog | Planlagt department-shell for crew, utstyr, last, oppgaver og avvik under key grip. |
| Grip | Dolly grip (`dolly_grip`) | Katalog | Planlagt shot-koblet skinne/dolly/riggplan, mål, underlag, bemanning og sikkerhet. |
| Grip | Grip (`grip`) | Katalog | Planlagt mobil oppgave- og utstyrsflate med riggstatus, bilder, avvik og kvittering. |

### Cast, SFX, art, opptakslyd og stunt

| Avdeling | Rolle i hierarkiet | Status nå | Det som er tenkt og det som står igjen |
| --- | --- | --- | --- |
| Medvirkende | Stand-in (`stand_in`) | Katalog | Planlagt avgrenset cast-portal for call time, scene, blokkering, garderobe/HMU, meldinger og bekreftelse. |
| Medvirkende | Statist (`background_performer`) | Katalog | Planlagt gruppebasert portal for call, transport, fitting, samtykke, innsjekk og wrap; ingen bred prosjektlesing. |
| Spesialeffekter | SFX supervisor (`sfx_supervisor`) | Katalog | Planlagt scene-/shotbehov, metode, materialer, risikovurdering, tillatelser, test, reset og sign-off. |
| Art | Produksjonsdesigner (`production_designer`) | Levert på arbeidsgren, ikke deployet | Dedikert, versjonert art-linse samler sceneplan, designintensjon, beslutninger, storyboardgrunnlag og fag-handoffs. Neste er private S3-revisjoner, formell sign-off og change impact. |
| Art | Settdesigner (`set_designer`) | Delvis på arbeidsgren | Rutes til art-linsen og kan arbeide i sceneplan og sets-handoff. Egen modul for tegninger, mål, revisjoner, materialer og construction-handoff mangler. |
| Art | Konseptillustratør (`concept_illustrator`) | Delvis på arbeidsgren | Rutes til art-linsen med visuell retning og review-grunnlag. Versjonert konseptmedia, proveniens, før/etter og lock mangler. |
| Art | Storyboardartist (`storyboard_artist`) | Delvis på arbeidsgren | Rutes nå til art-linsen, som viser eksisterende storyboardreferanser. Normalisert handoff mellom Storyboard Room og Role Room, panelrevisjoner og sign-off mangler. |
| Opptakslyd | Produksjonslydmikser (`production_sound_mixer`) | Katalog | Planlagt fagflate for location-/scenelyd, kanal-/radioplan, sound report, take, avvik, filmanifest og post-handoff. |
| Opptakslyd | Boomoperatør (`boom_operator`) | Katalog | Planlagt mobil shot-/takeflate for mikrofon, kanal, radio, problem, room tone og kvittering til mixer. |
| Stunt | Stuntkoordinator (`stunt_coordinator`) | Katalog | Planlagt scene-risiko, performer, rehearsal, medisinsk/sikkerhetsplan, utstyr, tillatelser og go/no-go. |
| Stunt | Stuntdouble (`stunt_double`) | Katalog | Planlagt avgrenset portal for call, rehearsal, kost/HMU, sikkerhetsbrief, samtykke og take-status. |

### Transport, service, publicity og fysisk kontinuitet

| Avdeling | Rolle i hierarkiet | Status nå | Det som er tenkt og det som står igjen |
| --- | --- | --- | --- |
| Transport | Transportansvarlig (`transportation_captain`) | Katalog | Planlagt kjøretøy, sjåfør, rute, last, passasjer, base, drivstoff og avvik koblet til location og production day. |
| Transport | Sjåfør (`driver`) | Katalog | Planlagt mobil rute-/oppdragsflate med tid, kontakt, kjøretøy, kvittering og begrenset persondata. |
| Craft service | Craft services (`craft_services`) | Katalog | Planlagt crew count, tidsvinduer, allergi-/behovssummering, locationpunkt, lager og dagsavvik. |
| Catering | Kokk (`chef`) | Katalog | Planlagt måltidsplan, antall, allergiaggregat, tider, leveransepunkt og bekreftelse uten unødvendige personopplysninger. |
| PR og stills | Presseansvarlig (`unit_publicist`) | Katalog | Planlagt godkjent story-/assetplan, embargo, releases, shot access, klientreview og publiseringshandoff. |
| PR og stills | Stillfotograf (`still_photographer`) | Katalog | Planlagt shot-/sceneoppdrag, tilgang, releases, utvalg, metadata og privat media-handoff. |
| Kostyme | Kostymedesigner (`costume_designer`) | Delvis på arbeidsgren | Rutes til art-linsen og kostyme-handoff. Character/scene-look, continuity, fittings, sourcing, kost og dagsbehov mangler som egen modul. |
| Kostyme | Kostymeansvarlig (`wardrobe_supervisor`) | Delvis på arbeidsgren | Rutes til art-linsen. Item-/look-tracking, fitting, vask/reparasjon, bilder og continuity per take mangler. |
| Set decoration | Set decorator (`set_decorator`) | Delvis på arbeidsgren | Rutes til art-linsen og sets-handoff. Dressing-plan, eierskap/leie, kost, installasjon og strike mangler. |
| Set decoration | On-set dresser (`on_set_dresser`) | Delvis på arbeidsgren | Rutes til art-linsen. Mobil reset-/continuity-flyt med bilder, plassering og take-avvik mangler. |
| Set decoration | Greensperson (`greensperson`) | Delvis på arbeidsgren | Rutes til art-linsen. Sourcing, vedlikehold, vann/sikkerhet, continuity og wrap mangler som fagmodul. |
| Rekvisitt | Rekvisittansvarlig (`property_master`) | Delvis på arbeidsgren | Rutes til art-linsen, som leser kanoniske rekvisitter og avdekker manglende scenekobling. Eierskap/leie, versjon, tilstand og take-handoff mangler. |
| Rekvisitt | Rekvisittassistent (`assistant_property_master`) | Delvis på arbeidsgren | Rutes til art-linsen. Mobil uttak/retur, preset/reset, bilde, skade og delegerte oppgaver mangler. |
| Hår og sminke | Håransvarlig (`key_hair_stylist`) | Delvis på arbeidsgren | Rutes til art-linsen og HMU-handoff. Look, fitting, continuity-bilder, produkter, tid og take-reset mangler. |
| Hår og sminke | Sminkeansvarlig (`key_makeup_artist`) | Delvis på arbeidsgren | Rutes til art-linsen og HMU-handoff. Prosthetics/SFX-makeup, allergi-/samtykkescope, continuity og reset mangler. |
| Konstruksjon | Konstruksjonskoordinator (`construction_coordinator`) | Delvis på arbeidsgren | Rutes til art-linsen og construction-handoff. Tegningsrevisjon, materialer, crew, HMS, milepæler, inspeksjon og kost mangler. |
| Andre | Studio teacher (`studio_teacher`) | Katalog | Planlagt barnets avgrensede dagsplan, arbeid/skole/hvile, guardian-status og compliance uten bredt prosjektinnsyn. |

### Postproduksjon

| Avdeling | Rolle i hierarkiet | Status nå | Det som er tenkt og det som står igjen |
| --- | --- | --- | --- |
| Etterarbeidsledelse | Post supervisor (`post_supervisor`) | Katalog | Planlagt postplan, leveransemanifest, vendor, budsjett, review, approvals, dependencies og final delivery. |
| Etterarbeidsledelse | Postkoordinator (`post_coordinator`) | Katalog | Planlagt ingest-/leveransekø, frister, metadata, versjoner, notater og status under post supervisor. |
| Musikk | Musikkansvarlig (`music_supervisor`) | Katalog | Planlagt cue-/rights-register, brief, kilde, lisens, kost, review og leveranse mot scene/timecode. |
| Musikk | Komponist (`composer`) | Katalog | Planlagt cue-brief, versjon, stems, timecode, review, godkjenning og levering uten tilgang til øvrig økonomi. |
| Musikk | Musiker (`musician`) | Katalog | Planlagt avgrenset session-, materiale-, call-, rettighets- og filoverleveringsflate. |
| Lydetterarbeid | Lyddesigner (`sound_designer`) | Katalog | Planlagt cue-/sceneplan, assets, layers, version, review, stems og mix-handoff. |
| Lydetterarbeid | Lydklipper (`sound_editor`) | Katalog | Planlagt oppgave-/cueflate med timecode, kilde, versjon, status og review. |
| Lydetterarbeid | Foleyartist (`foley_artist`) | Katalog | Planlagt cue sheet, prop, surface, performance, take, fil og levering per timecode. |
| Lydetterarbeid | ADR-tekniker (`adr_engineer`) | Katalog | Planlagt ADR-cue, talent, studio, take, sync, valg, filmanifest og godkjenning. |
| Klipp og farge | Klippeansvarlig (`supervising_editor`) | Katalog | Planlagt editorial status, cut lineage, turnovers, review decisions og låsepunkter. |
| Klipp og farge | Klipper (`video_editor`) | Katalog | Planlagt cut-versjoner, timeline/timecode-notater, review, approvals og leveransemanifest. |
| Klipp og farge | Klippeassistent (`assistant_editor`) | Katalog | Planlagt ingest, sync, bins, proxies, turnovers, QC og oppgavekvittering. |
| Klipp og farge | Colorist (`colorist`) | Katalog | Planlagt color brief, reference stills, version, review, QC og masterleveranse. |
| Visuelle effekter | VFX supervisor (`vfx_supervisor`) | Katalog | Planlagt shot-register, plate/elementer, vendor, bid, version, review, status og final. |
| Visuelle effekter | VFX-artist (`vfx_artist`) | Katalog | Planlagt avgrenset shot-task, input, version, notes, QC og levering. |
| Visuelle effekter | Motion designer (`motion_graphics_artist`) | Katalog | Planlagt grafikk-/title-shot, brand/brief, version, review, font/rettigheter og final delivery. |

### Slik skal hierarkiet bli funksjonelt, ikke bare visuelt

`reportsTo` i katalogen beskriver organisasjonslinjen, men skal ikke alene gi tilgang. For hver rad over må den videre arkitekturen definere:

1. **Assignment:** hvilken konto som faktisk har rollen i prosjektet, eventuelt flere roller.
2. **Scope:** hvilke prosjekt-, scene-, dag-, location- eller asset-ID-er rollen kan se.
3. **Capabilities:** lese, foreslå, kommentere, endre, godkjenne, låse og eksportere som separate grants.
4. **Workspace composition:** hvilke felles moduler rollen ser og hvilke fagmoduler som legges til.
5. **Operational lane:** hvor fagdata lagres, versjoneres og konfliktsikres.
6. **Handoff:** hvilket dokumentert resultat neste rolle mottar, og hva som skjer ved endring.
7. **Accountability:** navngitt eier, frist, evidens, godkjenning, aktivitet og historikk.

Målet er at organisasjonskartet fungerer som konfigurasjon for navigasjon, ansvar og tilgang, mens all produksjonsdata fortsatt lever i den samme prosjektgrafen.

## Konkret startpunkt for neste Claude-økt

1. Les dette dokumentet og de kanoniske kildefilene nevnt over.
2. Bekreft live-SHA før endring; ikke anta at `creatorhubn.com` og `theroleroom.com` følger samme live-gren.
3. Viderefør det typed workspace-registeret, men flytt selve komponentlastingen og tilgangsmetadata ut av `CastingPlannerPanel.tsx`. Lag en eksplisitt migrasjons- og kompatibilitetsstrategi for normaliserte flerrolle-assignments før rollemodellene kopieres videre.
4. Bevar URL-kontrakten `project`, `tab`, `lens`, `surface` og `scene`, inkludert back/forward og refresh.
5. Bruk Troll til E2E, men ikke skriv nye faktapåstander inn i demoen uten verifisert kilde.
6. Merge/deploy og live-verifiser Production Designer / Art Department før status settes til produksjon. Deretter er Production Sound Mixer / Boom neste vertikale rolleleveranse.
