# The Role Room: rollearkitektur og Troll-lokasjoner

Opprinnelig dato: 14. september 2026

Sist oppdatert: 21. september 2026

Status ved denne oppdateringen: Location, Art Department, Production Sound, Producer, Casting og første Post Supervisor / Post Sound-turnover er levert på Role Room. Dokumentet beskriver i tillegg picture/editorial-utvidelsen i kildekoden. Operativ live-status skal alltid verifiseres mot deployens build-SHA; dette dokumentet er ikke i seg selv deploybevis.

## Kort konklusjon

Den pågående leveransen er fullført. Troll-prosjektets fem grunnlokasjoner har gyldige, kartbare adresser og koordinater, lokasjonsanalysen godtar et eksakt Kartverket-treff selv om treffet mangler matrikkel-/property-ID, og den tidligere produksjonskrasjen fra blandede MUI-versjoner er fjernet. Endringene er merget til `main`, promotert til den dedikerte `live/roleroom`-grenen og bekreftet på `https://theroleroom.com`.

Rollearkitekturen har samtidig fått et tydelig fundament: én produksjon, én delt prosjektgraf og rollebaserte arbeidslinser over de samme dataene. Kodebasen har nå et kanonisk kataloglag med 80 produksjonsroller i 31 avdelinger og dedikerte arbeidsflater for produsent, casting, regissør, filmfotograf, regiassistenter, produksjonsleder, produksjonskoordinator, location, continuity, Art Department, Production Sound og Post Supervisor. Komponentlastingen er flyttet ut av den store planner-komponenten og koblet til det typed lens-registeret; det viktigste som står igjen er serverautoritativ flerrolle-assignment, en felles operasjonskontrakt og en normalisert Production Graph.

### Tillegg 20. september 2026: Production Designer / Art Department

Leveransen ble opprinnelig implementert på `codex/role-room-production-designer` og er nå merget og med i den synkroniserte Role Room-livegrenen.

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

### Tillegg 21. september 2026: Production Sound Mixer / Boom Operator

Produksjonslyd ble implementert på `codex/role-room-production-sound` og er nå merget og med i den synkroniserte Role Room-livegrenen. Arbeidsflaten er metadata-first og oppretter ikke en parallell take-logg: continuity eier de kanoniske take-ID-ene, mens Production Sound legger lydrapport, spor, filnavn, kvalitetsflagg og ADR-behov på de samme ID-ene.

Produksjonslydmikser og boomoperatør rutes nå til `production-sound`-linsen med fem flater:

- dagsbrief med dekning, lydproblemer, ADR-flagg, manglende room tone og uavstemte recorder-filer;
- recorder-, sound roll-, sample rate-, bit depth-, frame rate-, timecode-, akustikk- og radioplan;
- take-rapportering mot continuity med spor, filnavn, kvalitet, problemmerker og ADR;
- room tone, wild tracks, ambience og SFX per dag eller scene;
- CSV-sound report og eksplisitt handoff til DIT, klipp og postlyd.

Tilstanden ligger i `casting_production_days.data.productionSound`, med en selvstendig Drizzle-/SQL-kontrakt for `sound_version`, `sound_updated_by` og `sound_updated_at`. `PATCH /api/role-room/projects/:projectId/production-days/:dayId/production-sound` validerer payload, prosjektgrant, produksjonsdag, scenetilknytning, lokale spor og continuity-take på serveren. Generiske produksjonsdagsskriv kan ikke overskrive lydlinjen. Optimistic concurrency gir synlig `409`; lokalt utkast beholdes til brukeren eksplisitt laster serverversjonen.

Dataintegriteten går begge veier: Production Sound kan ikke opprette lydrapporter for ukjente takes, og continuity kan ikke slette en take som fortsatt har en lydrapport. Dette hindrer foreldreløse rapporter og skjult datatap mellom avdelingene.

Relevante filer:

- `frontend/client/src/components/role-room/components/production-sound/ProductionSoundWorkspace.tsx`
- `frontend/client/src/components/role-room/components/production-sound/productionSoundWorkspaceModel.ts`
- `frontend/client/src/components/role-room/services/productionSoundService.ts`
- `backend/server/casting-production-sound.ts`
- `backend/server/casting-production-sound-media.ts`
- `backend/server/casting-production-sound-s3.ts`
- `backend/server/casting-production-routes.ts`
- `backend/migrations/0657_role_room_production_sound.sql`
- `backend/migrations/0658_role_room_production_sound_media.sql`
- `frontend/e2e/role-room-production-sound-troll.spec.ts`

Recorder-ingest er nå også implementert på arbeidsgrenen. Nettleseren beregner SHA-256 inkrementelt og laster WAVE/BWF direkte til den eksisterende private Role Room-bøtten `the-role-room-prod-745600963362-eu-north-1` med resumable multipart ved store filer. Backend verifiserer checksum og filstørrelse, leser RIFF/RF64, `fmt`, `data`, `bext` og iXML med avgrensede S3 range-reads og lagrer bare godkjent metadata. Spoofede eller strukturelt ugyldige WAVE-filer avvises; en gyldig WAVE uten BWF/iXML godtas med synlige advarsler.

Avstemming er eksplisitt og atomisk: metadata kan gi et konservativt forslag når både scene/slate og numerisk take matcher entydig, men brukeren må bekrefte koblingen. Handlingen oppdaterer både `casting_production_sound_media` og `productionSound.takeReports[].recordingFileIds` i samme transaksjon og øker `sound_version`. Den kan ikke omgås gjennom den generiske lydrapport-ruten. Continuity-taken er fortsatt eneste kanoniske take-identitet; ingest oppretter aldri en ny take. Nedlasting bruker fem minutters signert URL og aldri offentlig objektadresse.

Det som står igjen i denne vertikalen er reell ikke-destruktiv validering mot produksjonsbøttens CORS/IAM med en godkjent testfil og delegering/personatilpasning for boomoperatør. Den mottakende post-sound-linsen og turnover-manifestet er nå neste vertikal i avsnittet under. Ikke innfør en offentlig bøtte, en ny filproxy eller en separat take-identitet.

Faggrunnlaget for første scope er [ScreenSkills' Production Sound Mixer-sjekkliste](https://www.screenskills.com/skills-checklists/scripted-film-and-tv/production-sound-department/production-sound-mixer-skills/), [Sound Devices 833-brukerveiledning](https://cdn.sounddevices.com/wp-content/uploads/2023/02/833-v9.20-User-Guide.pdf), [EBU Tech 3285 for Broadcast Wave Format](https://tech.ebu.ch/publications/tech3285) og [AES' iXML-standardarbeid](https://aes2.org/standards/standards-development/new-projects/). De underbygger behovet for planlegging, akustiske risikoer, recorder-/sporoppsett, wild tracks, daglig sound report og interoperabel metadataoverlevering. Produktet skal fortsatt valideres med faktiske norske lydteam før scope utvides.

Verifisering på arbeidsgrenen:

- 54 målrettede frontendtester og 192 målrettede backendtester bestod;
- frontend- og backend-typecheck bestod;
- frontendens nye lydfiler bestod ESLint uten warnings eller errors;
- frontend- og backend-produksjonsbuild bestod, inkludert Role Room-index, geo-prerender og host-ruter;
- tre autentiserte Troll-E2E-scenarier bestod på Chromium: komplett arbeidsflyt med direkte S3-opplasting og eksplisitt avstemming, garanti mot automatisk avstemming og mobilflyt;
- mobil-E2E bestod i stående og liggende visning med minimum 44 px trykkflate og uten horisontal overflow;
- testen observerte ingen ukontrollerte React-/JavaScript-feil og ingen feil fra presence-/selftapes-endepunktene som tidligere var problematiske;
- CSV-eksporten nøytraliserer formel-prefikser i brukerdata før filen åpnes i et regneark;
- SQL-migrasjon, Drizzle-skjema og runtime-guard bruker samme `sound_*`-kolonner; `0657` kolliderer ikke med dagens `origin/main`.

### Tillegg 21. september 2026: Post Supervisor / Post Sound-turnover

Post Supervisor, Post Coordinator, postlyd og editorial rutes på arbeidsgrenen til den nye `post-production`-linsen. Første vertikal dekker den kritiske overleveringen fra Production Sound til mottakende postavdeling uten å kopiere eller flytte mediefiler:

- Production Sound eller produksjonsledelsen velger en produksjonsdag og et eksplisitt sett recorderfiler;
- serveren bygger et uforanderlig snapshot av medie-ID, privat storage-object-ID, SHA-256, størrelse, lydrapportversjon og continuity-kobling;
- manifestet går gjennom `draft → ready → received → accepted`, eller `received → qc_issues → ready` ved retur;
- Post Sound kan registrere og løse QC-avvik med alvorlighet, aktør og tidspunkt;
- endring i lydrapport, checksum, størrelse, take-kobling, slettet fil eller nye dagsfiler vises som change impact før neste statusovergang;
- et manifest kan merkes `superseded`, men blir aldri stille overskrevet eller slettet fra historikken.

Arbeidsflaten har fire flater: Oversikt, Turnovers, QC og Historikk. Den fungerer i stående og liggende mobil-/nettbrettvisning, har minst 44 px trykkflater og bevarer URL-kontrakten `project`, `tab`, `lens` og `surface`.

Persistence er én prosjektavgrenset og optimistisk låst ledger i `role_room_post_production_operations`. SQL-migrasjon `0660` og Drizzle-tabellen beskriver samme constraints. Nettleseren kan ikke levere egne storage keys, bucket-navn, aktører eller tidsstempler; backend bygger disse fra den eksisterende private Production Sound-tabellen og innlogget sesjon. Mediebytes forblir i `role_room_storage_objects` og S3-bøtten `the-role-room-prod-745600963362-eu-north-1`.

Tilgang er fail-closed og delt i to grants:

- `canPreparePostTurnover` for produsent-/produksjonsledelse, Production Sound og Post Supervisor/Coordinator;
- `canReviewPostTurnover` for produsent, Post Supervisor/Coordinator, postlyd og editorial.

Relevante filer:

- `frontend/client/src/components/role-room/components/post-production/PostProductionWorkspace.tsx`
- `frontend/client/src/components/role-room/components/post-production/postProductionWorkspaceModel.ts`
- `frontend/client/src/components/role-room/services/postProductionService.ts`
- `frontend/client/src/components/role-room/components/production/workspaceLensComponents.ts`
- `backend/server/casting-production-post-production.ts`
- `backend/server/casting-production-routes.ts`
- `backend/migrations/0660_role_room_post_production_operations.sql`
- `backend/migrations/role-room-schema.ts`
- `frontend/e2e/role-room-post-production-troll.spec.ts`

Før live-status kan settes må hele relevante regresjonspakken bestå, migrasjonen kjøres gjennom releaseflyten, `live/roleroom` promoteres eksplisitt og den autentiserte Troll-flyten kontrolleres på `theroleroom.com`. Videre post-iterasjoner skal utvide samme manifestkjerne til VFX, color, musikk og final delivery – ikke opprette parallelle asset-ID-er per avdeling.

### Tillegg 21. september 2026: Picture/editorial-turnover

Picture-turnover er bygget som en ny kildetype i den eksisterende Post Supervisor-ledgeren, ikke som et separat review- eller filsystem. Den autoritative kilden er `project_video_versions` i Video Room, og den eksisterende `storage_object_id` peker videre til det private objektet i `role_room_storage_objects`.

Dataflyten er:

```text
casting_projects.creatorhub_project_id
  -> projects.id (samme prosjekteier)
  -> project_video_versions.project_id
  -> role_room_storage_objects.id
  -> picture-snapshot i role_room_post_production_operations
```

Klienten sender bare valgt Video Room-versjons-ID. Backend løser prosjektkoblingen, krever at CreatorHub-prosjektet tilhører samme eier som Role Room-prosjektet, og godtar bare aktive storage objects med positiv størrelse og gyldig SHA-256. Bucket-navn og object key eksponeres ikke. Et snapshot lagrer versjon, status, privat storage-object-ID, checksum, størrelse, varighet og seneste versjonsnummer ved opprettelse.

Samme state machine brukes for lyd og picture: `draft → ready → received → accepted`, med retur via `qc_issues` og historisk `superseded`. Change impact stopper stille levering dersom prosjektkoblingen, filreferansen, checksum eller størrelse er endret. Statusendring og nyere tilgjengelig picture-versjon vises som eksplisitte varsler og krever refresh før videre overgang.

UI-en har fortsatt bare Oversikt, Turnovers, QC og Historikk. I Turnovers velges `Opptakslyd` eller `Picture / klipp`. Ulinket prosjekt, ugyldig binding og mangel på S3-verifiserte Video Room-versjoner har egne tomtilstander. En sikker dypkobling åpner korrekt Video Room når bindingen er gyldig.

Dette gjenbruker migrasjon `0660`; ingen ny tabell eller parallell asset-identitet er nødvendig. Målrettede domene-, API- og frontendtester samt en autentisert Troll-E2E dekker både historisk lydkompatibilitet og picture-flyten.

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

På Production Sound-arbeidsgrenen speiler `0658_role_room_production_sound_media.sql` og `role-room-schema.ts` også den normaliserte recorderfil-tabellen. Tabellen peker på det eksisterende `role_room_storage_objects`-objektet, prosjektet og produksjonsdagen; status og continuity-take må være konsistente. Selve S3-objektet forblir i felles privat lagring og dupliseres ikke i fagtabellen.

Post Production-turnover følger samme kontrakt: `0660_role_room_post_production_operations.sql` og `roleRoomPostProductionOperations` i Drizzle beskriver én versjonert ledger per prosjekt. Manifestene refererer eksisterende `casting_production_sound_media` eller `project_video_versions` og den kanoniske raden i `role_room_storage_objects`; de lagrer aldri bucket, objektsti eller en kopi av filen.

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
- `frontend/client/src/components/role-room/components/production/workspaceLensRegistry.ts`: typed kobling mellom prosjektrolle, linse, URL-atferd, workspace-kind og lazy komponentnøkkel.
- `frontend/client/src/components/role-room/components/production/workspaceLensComponents.ts`: sentral lazy-lasting av alle dedikerte rolleflater.
- `frontend/client/src/components/role-room/components/CastingPlannerPanel.tsx`: dagens ruting, lens/surface/scene-dyplenker og komposisjon. Dette er foreløpig orkestratoren, men er for stor.
- `backend/migrations/role-room-schema.ts`: kanonisk Drizzle-skjema.
- `backend/server/casting-project-ownership.ts`: serverens fail-closed prosjekt- og operasjonsrettigheter.
- `backend/server/casting-production-routes.ts`: versjonerte produksjons-, koordinasjons-, continuity- og location-operasjoner.
- `backend/server/role-room-storage-key.ts`: kanoniske private S3-nøkler.
- `frontend/client/src/components/role-room/components/art-department/`: produksjonsdesignerens komposisjon og konservative scenegrunnlag.
- `backend/server/casting-production-art-department.ts`: streng art-kontrakt, validering og servereid audit.
- `frontend/client/src/components/role-room/components/production-sound/`: produksjonslydens fem flater over samme produksjonsdag og continuity-takes.
- `backend/server/casting-production-sound.ts`: streng lydkontrakt og normalisering; mutasjonen ligger i `casting-production-routes.ts`.
- `frontend/client/src/components/role-room/components/post-production/`: turnover-, mottaks-, QC- og historikkkomposisjon for Post Supervisor og Post Sound.
- `backend/server/casting-production-post-production.ts`: streng manifest-state machine, validering og change impact; persistence-ruten ligger i `casting-production-routes.ts`.

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
| Production Designer / Art Department | Dedikert linse | `components/art-department/`, fem flater over scenegrunnlag, visuell retning, beslutninger, avdelinger og handoff. Versjonert API/Drizzle-lane og E2E er på `main` og Role Room-livegrenen. |
| Production Sound Mixer / Boom Operator | Dedikert linse | `components/production-sound/`, fem flater for dagsbrief, oppsett, continuity-koblede takes, BWF/iXML-recorderingest, ekstraopptak og post-handoff. Egen per-dag-versjon, grant, privat Role Room-S3, eksplisitt avstemming, validering og E2E er på `main` og Role Room-livegrenen. |
| Post Supervisor / Post Sound / Editorial | Dedikert linse | `components/post-production/`, fire flater for manifest, mottak, QC og historikk over eksisterende private Production Sound- og Video Room-picturefiler. Felles prosjektledger, state machine, grants, change impact og E2E finnes. |
| Casting | Dedikert linse | `components/casting/`, rolle-, talent-, audition-, shortlist- og beslutningsflyt samlet i `casting`-linsen. Casting Director, lokal casting og statistcasting rutes gjennom registeret. |
| Produsent | Dedikert linse | `components/producer-role/`, prosjektpuls og styring over de eksisterende fagdataene; executive producer, producer og line producer rutes gjennom registeret. |
| Andre fagroller | Katalogført eller delt faglinse | Kostyme, hår/sminke, rekvisitt, set og konstruksjon bruker delt `art-department`; postlyd og editorial bruker `post-production`. Transport, catering, PR, musikk, VFX og flere assistentroller mangler fortsatt egne moduler eller bruker en bredere delt flate. |

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
- `0f0cfa6c8` Production Designer / Art Department
- `881b2b141` producer- og casting-linser
- `4b2cecd7a` Production Sound
- `290df2f9a` sikker Production Sound-opprydding og recorder-integritet

### Data- og konfliktmodell som skal gjenbrukes

Nye rolleflater skal følge samme mønster:

1. Les fra den delte prosjektgrafen.
2. Legg fagspesifikke operasjoner i en avgrenset servereid lane.
3. Bruk monoton versjon og optimistic concurrency; en `409` skal gi synlig sammenligning, aldri stille overskriving.
4. Logg aktør, tidspunkt og før/etter eller revisjon.
5. Hold lokale utkast separat, med tydelig «lokalt»/«synkronisert»-status.
6. Bruk private S3-objekter med kortlivede URL-er og prosjekt-/organisasjonsscope for media.
7. La kommentarer være bredere enn mutasjonsrettighet, men håndhev begge på serveren.

Eksisterende eksempler er `management_version`, `coordination_version`, `continuity_version` og `sound_version` på produksjonsdagen, `role_room_location_operations.version` per lokasjon, `role_room_art_department_operations.version` per prosjekt og `role_room_post_production_operations.version` per prosjekt.

## Det som står igjen

### Prioritet 1: stabiliser rollen som plattformkontrakt

1. **Fullfør det sentrale workspace-registeret.** Lens-navn, støttede roller, workspace-kind, URL-atferd og komponentnøkkel ligger nå i ett typed register, og lazy komponentlasting er flyttet ut av `CastingPlannerPanel.tsx`. Det som står igjen er å registrere prop-adaptere, standardflate og permission bundle slik at den store nested render-kjeden kan erstattes uten å miste de ulike workspace-kontraktene.
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

1. **Post Supervisor / Post Sound / Picture-turnover — implementert.** Bevar én ledger og én asset-identitet. Neste post-iterasjon utvider samme manifestkjerne til VFX, color, musikk og final delivery.
2. **Rekvisitt, set, kostyme og hår/sminke.** Bruk samme asset-/continuity-kjerne med eierskap, tilstand, bilder før/etter, hvem/hvilken scene og dagsbehov. Art-linsen er shellen; bygg fagmoduler, ikke nye apper.
3. **Transport, sikkerhet, catering og unit-logistikk.** Knyttes til production day, location, crew count, call time og avvik.
4. **Editorial, VFX og musikk.** Bruk turnover-ledgerens manifest-, versjons-, QC- og reviewkjerne over samme scene-/take-/asset-identitet. Legg til rights/proveniens der domenet krever det.
5. **Kamera-, lys- og grip-delegering.** La DoP-linsen delegere shot-, utstyrs-, rigg- og rapportoppgaver med avgrensede grants til operator, AC, DIT, gaffer og key grip.
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
- Rolleoppløsning og workspace-ruting har et typed register og sentral komponentlasting, men prop-komposisjon og deler av permission-/renderlogikken er fremdeles håndkodet i den store `CastingPlannerPanel.tsx`.
- En bruker kan ikke ha flere normaliserte prosjektroller gjennom dagens unike `casting_user_roles`-rad.
- Mange avdelinger er katalogført, men mangler dedikert eller modulær department-workspace.
- Production Graph og automatisk, forhåndsvisbar change impact er ikke ferdig.
- Art-linsen har versjonert fagdata og eksisterende storyboardreferanser, men mangler egne S3-opplastinger, tegningsrevisjoner, før/etter-sammenligning, formell regissør-/produsentgodkjenning og automatisk konsekvensanalyse mot budsjett og opptaksplan.
- Production Sound har versjonert metadata, direkte/resumable recorder-opplasting til privat Role Room-S3, server-side BWF/iXML-analyse og eksplisitt, transaksjonell continuity-avstemming. Mottakende post-sound-linse og turnover-manifest er implementert på arbeidsgren. Produksjonsgodkjent live-smoke av CORS/IAM og feltvalidering med faktiske recorderfiler mangler fortsatt. Avstemming skal forbli eksplisitt; metadataforslag skal ikke automatisk endre take-data.
- Post Production dekker Production Sound- og picture-turnover, men EDL/XML/AAF, proxy-/masterlinje, picture lock, VFX pulls, color, musikkrettigheter, final masters og eksterne vendor-portaler er ikke implementert.

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
| Produsenter | Ansvarlig produsent (`executive_producer`) | Levert | Eksplisitt producer-lens gir prosjektpuls og styringsinnganger over de delte fagdataene. Neste er egne greenlight-/finansieringsporter og mer finmasket klient-/eiergodkjenning. |
| Produsenter | Produsent (`producer`) | Levert | Prosjektpuls, beslutninger, budsjett, casting, location sign-off, risiko og leveranse ligger i producer-linsen og workspace-registeret. Neste er samlet Production Graph-change impact og sterkere milepælstyring. |
| Produsenter | Linjeprodusent (`line_producer`) | Levert | Rutes til producer-linsen over management, coordination og location uten parallelle data. Neste er tydeligere dagskost-, avtale- og bemanningspersona innen samme komposisjon. |
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
| Casting | Castingansvarlig (`casting_director`) | Levert | Roller, Talents, auditions, shortlist og beslutninger er samlet i en eksplisitt casting-lens med registerruting. Neste er enda sterkere kontrakt-/bookinghandoff mot produksjonsdag. |
| Casting | Lokal castingansvarlig (`local_casting_director`) | Levert | Rutes til samme casting-lens over kanoniske roller og Talents. Geografisk scope og mer finmasket delegering er fortsatt neste steg. |
| Casting | Statistansvarlig (`extras_casting_director`) | Levert | Rutes til casting-linsen. Bakgrunnsgrupper, fitting, transport og dagsinnsjekk trenger fortsatt en egen modul i linsen. |
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
| Art | Produksjonsdesigner (`production_designer`) | Levert | Dedikert, versjonert art-linse samler sceneplan, designintensjon, beslutninger, storyboardgrunnlag og fag-handoffs. Neste er private S3-revisjoner, formell sign-off og change impact. |
| Art | Settdesigner (`set_designer`) | Delvis | Rutes til art-linsen og kan arbeide i sceneplan og sets-handoff. Egen modul for tegninger, mål, revisjoner, materialer og construction-handoff mangler. |
| Art | Konseptillustratør (`concept_illustrator`) | Delvis | Rutes til art-linsen med visuell retning og review-grunnlag. Versjonert konseptmedia, proveniens, før/etter og lock mangler. |
| Art | Storyboardartist (`storyboard_artist`) | Delvis | Rutes nå til art-linsen, som viser eksisterende storyboardreferanser. Normalisert handoff mellom Storyboard Room og Role Room, panelrevisjoner og sign-off mangler. |
| Opptakslyd | Produksjonslydmikser (`production_sound_mixer`) | Levert | Dedikert fagflate for akustisk plan, recorder/timecode, spor, continuity-koblede sound reports, room tone/wild tracks, direkte BWF/iXML-ingest til privat S3 og eksplisitt filavstemming. Post-sound-turnover er levert; live CORS/IAM-smoke med godkjent testfil og feltvalidering gjenstår. |
| Opptakslyd | Boomoperatør (`boom_operator`) | Levert | Rutes til samme mobilresponsive lydflate med avgrenset sound-grant. Neste er tydeligere delegering per mikrofon/take og et smalere boom-persona dersom feltbruk viser behov. |
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
| Kostyme | Kostymedesigner (`costume_designer`) | Delvis | Rutes til art-linsen og kostyme-handoff. Character/scene-look, continuity, fittings, sourcing, kost og dagsbehov mangler som egen modul. |
| Kostyme | Kostymeansvarlig (`wardrobe_supervisor`) | Delvis | Rutes til art-linsen. Item-/look-tracking, fitting, vask/reparasjon, bilder og continuity per take mangler. |
| Set decoration | Set decorator (`set_decorator`) | Delvis | Rutes til art-linsen og sets-handoff. Dressing-plan, eierskap/leie, kost, installasjon og strike mangler. |
| Set decoration | On-set dresser (`on_set_dresser`) | Delvis | Rutes til art-linsen. Mobil reset-/continuity-flyt med bilder, plassering og take-avvik mangler. |
| Set decoration | Greensperson (`greensperson`) | Delvis | Rutes til art-linsen. Sourcing, vedlikehold, vann/sikkerhet, continuity og wrap mangler som fagmodul. |
| Rekvisitt | Rekvisittansvarlig (`property_master`) | Delvis | Rutes til art-linsen, som leser kanoniske rekvisitter og avdekker manglende scenekobling. Eierskap/leie, versjon, tilstand og take-handoff mangler. |
| Rekvisitt | Rekvisittassistent (`assistant_property_master`) | Delvis | Rutes til art-linsen. Mobil uttak/retur, preset/reset, bilde, skade og delegerte oppgaver mangler. |
| Hår og sminke | Håransvarlig (`key_hair_stylist`) | Delvis | Rutes til art-linsen og HMU-handoff. Look, fitting, continuity-bilder, produkter, tid og take-reset mangler. |
| Hår og sminke | Sminkeansvarlig (`key_makeup_artist`) | Delvis | Rutes til art-linsen og HMU-handoff. Prosthetics/SFX-makeup, allergi-/samtykkescope, continuity og reset mangler. |
| Konstruksjon | Konstruksjonskoordinator (`construction_coordinator`) | Delvis | Rutes til art-linsen og construction-handoff. Tegningsrevisjon, materialer, crew, HMS, milepæler, inspeksjon og kost mangler. |
| Andre | Studio teacher (`studio_teacher`) | Katalog | Planlagt barnets avgrensede dagsplan, arbeid/skole/hvile, guardian-status og compliance uten bredt prosjektinnsyn. |

### Postproduksjon

| Avdeling | Rolle i hierarkiet | Status nå | Det som er tenkt og det som står igjen |
| --- | --- | --- | --- |
| Etterarbeidsledelse | Post supervisor (`post_supervisor`) | Levert | Dedikert post-linse med Production Sound- og picture-manifest, mottak, QC, change impact, godkjenning og historikk. Postplan, vendor, budsjett og final delivery er neste moduler. |
| Etterarbeidsledelse | Postkoordinator (`post_coordinator`) | Levert | Rutes til samme post-linse med prepare/review-grants og sporbar kø. Frister, vendor-kommunikasjon og bredere leveransetyper mangler. |
| Musikk | Musikkansvarlig (`music_supervisor`) | Katalog | Planlagt cue-/rights-register, brief, kilde, lisens, kost, review og leveranse mot scene/timecode. |
| Musikk | Komponist (`composer`) | Katalog | Planlagt cue-brief, versjon, stems, timecode, review, godkjenning og levering uten tilgang til øvrig økonomi. |
| Musikk | Musiker (`musician`) | Katalog | Planlagt avgrenset session-, materiale-, call-, rettighets- og filoverleveringsflate. |
| Lydetterarbeid | Lyddesigner (`sound_designer`) | Delvis | Rutes til post-linsen og kan motta, QC-behandle og godkjenne Production Sound-turnover. Cue-/sceneplan, assets, layers, stems og mix-handoff mangler. |
| Lydetterarbeid | Lydklipper (`sound_editor`) | Delvis | Rutes til post-linsen for mottak og QC. Oppgave-/cueflate med timecode, kilde og versjon er neste modul. |
| Lydetterarbeid | Foleyartist (`foley_artist`) | Delvis | Rutes til post-linsen for turnoverinnsyn og QC. Cue sheet, prop, surface, performance og levering per timecode mangler. |
| Lydetterarbeid | ADR-tekniker (`adr_engineer`) | Delvis | Rutes til post-linsen for turnoverinnsyn og QC. ADR-cue, talent, studio, take, sync og filmanifest mangler. |
| Klipp og farge | Klippeansvarlig (`supervising_editor`) | Delvis | Rutes til post-linsen og kan motta/QC-behandle picture- og lydturnover fra de kanoniske kildene. Editorial status, cut lineage og picture-lock mangler. |
| Klipp og farge | Klipper (`video_editor`) | Delvis | Rutes til post-linsen med Video Room-versjoner som picture-kilde. Timeline/timecode-oppgaver, cut lineage og lock mangler. |
| Klipp og farge | Klippeassistent (`assistant_editor`) | Delvis | Rutes til post-linsen for ingest-/QC-arbeid. Sync, bins, proxies, EDL/XML/AAF og teknisk leveransekontroll mangler. |
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
3. Viderefør det typed workspace-registeret. Komponentlastingen er flyttet ut; neste steg er prop-adaptere, standardflate og permission bundles slik at den nested render-kjeden i `CastingPlannerPanel.tsx` kan fjernes trygt. Lag en eksplisitt migrasjons- og kompatibilitetsstrategi for normaliserte flerrolle-assignments før rollemodellene kopieres videre.
4. Bevar URL-kontrakten `project`, `tab`, `lens`, `surface` og `scene`, inkludert back/forward og refresh.
5. Bruk Troll til E2E, men ikke skriv nye faktapåstander inn i demoen uten verifisert kilde.
6. Verifiser alltid picture/editorial-turnover mot live build-SHA og et faktisk eierkoblet prosjekt før produksjonsstatus settes. Neste vertikale leveranse bør være prop/set/wardrobe-continuity eller transport/unit-logistikk; VFX/color/musikk skal senere bruke samme turnover-kjerne og kanoniske asset-ID-er.
