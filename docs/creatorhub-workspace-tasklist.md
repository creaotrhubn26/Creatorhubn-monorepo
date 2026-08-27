# CreatorHub Workspace – tasklist

Grunnlag: P0/P1 på `main` fra `93208107f`, med fremover-integrerte Storyboard-hotfikser fra `e67e1bdb7`.

## Utrullingsstatus 2026-08-27

- [x] Dedikert migreringsjobb har kjørt `0452` under advisory DB-lock: 1 migrasjon brukt, 692 hoppet over.
- [x] Backend og frontend ble verifisert på samme P0/P1-commit før en separat Storyboard-hotfiks deployet fra sidegren.
- [x] Render Key Value er konfigurert, distribuert fanout er obligatorisk, og to-prosess Redis-testen er grønn.
- [x] Capture build `1787807757` er signert og lastet opp til App Store Connect/TestFlight.
- [ ] Deploy den fremover-integrerte `main`-commiten gjennom migrering → Render → health/smoke.
- [ ] Skaler `creatorhub-backend` fra én til to instanser og bekreft begge instanser med Redis-fanout klar.
- [ ] Kjør legitimt autentisert produksjonskall som bekrefter ticket HTTP 201; uautentisert produksjonskall gir forventet 401.
- [ ] Håndhev ticket-kompatibel Capture-minimumsversjon før `REALTIME_ALLOW_LEGACY_TOKEN=false`.

## Ferdig i denne endringen

- [x] Samle prosjekt, workspace-kategori, tilgang, eier og medlemmer i `workspace-bootstrap`.
- [x] Bruke prosjektets profesjon/kategori til navigasjon og faner, også for delte tverrfaglige prosjekter.
- [x] Normalisere lesing av prosjekter fra både `public.projects` og `legacy.projects`.
- [x] Støtte oppdatering og sletting av prosjekter i begge prosjektlagrene.
- [x] Innføre én owner/editor/viewer-modell og bruke den på workspace-ruter og eldre kompatibilitetsruter.
- [x] Fjerne spoofbar identitet fra prosjektopprettelse, bryllupstidslinje og workflow-orchestrering.
- [x] Begrense bryllupshendelser, klienttilgang, Plan B og andre mutations til riktig prosjekt og tilgangsnivå.
- [x] Samle Prosjektplan, Oversikt og Team på kanonisk milestone-API.
- [x] Publisere milestone-endringer til eksisterende bruker-eventkanal og revalidere synlig prosjektplan.
- [x] Implementere Produksjonskart-kontrakter for geokoding, lokasjonsredigering, innsjekk og crew-posisjon.
- [x] Binde delt GPS-posisjon til autentisert brukerprofil og validere koordinater.
- [x] Prosjektavgrense presence og Smart Room-indikatorer.
- [x] Vise lesetilgang i shell og skjule eierstyrt invitasjon for ikke-eiere.
- [x] Flytte team/produksjonskart-skjema til migrasjon `0451`.
- [x] Dekke tilgang, milestones, presence, public/legacy-prosjekter og Produksjonskart med tester.
- [x] Verifisere backend-bundle, frontend-produksjonsbuild og `/workspace` i Chromium.
- [x] Samle Workspace på én prosjektfiltrert bruker-eventkanal med kortlivet engangsbillett; ingen langlivet session-token i bruker-event-WS-URL.
- [x] Koble board, milestones, shotlist, moodboard-presence, chat og Video/Sound Room til den delte prosjektkanalen, inkludert Audio Showcase-, delt bandreview- og Pro Tools-produsenter, med polling som fallback der det allerede finnes.
- [x] Flytte engangsbillettene til PostgreSQL, lagre bare SHA-256-hash og konsumere med atomisk `DELETE ... RETURNING` på tvers av backendinstanser.
- [x] Multiplekse alle `useUserEventStream`-abonnenter over én socket per nettleserfane.
- [x] Kjøre full Workspace-/galleri-/Capture-refetch etter vellykket reconnect.
- [x] Flytte browser-Capture til den delte brukerstrømmen og iPad Capture til en ny engangsbillett ved hver connect/reconnect; ingen langlivet bearer i URL.
- [x] Versjonere wire-formatet som protokoll v1 og dele en diskriminert TypeScript-kontrakt mellom backend og frontend.
- [x] Koble bruker-eventkanalen til Render Key Value med Redis pub/sub, lokallevering, origin-filter og meldingsdeduplisering.
- [x] Kreve Redis ved distribuert drift, eksponere ufølsom fanout-status i health og verifisere event fra prosess B til socket i prosess A.
- [x] Legge gammel `?token=`-støtte bak `REALTIME_ALLOW_LEGACY_TOKEN`; bryteren står på til ticket-builden er håndhevet minimum.

## Oppfølging etter utrulling

- [x] Kjør migrasjon `0451_workspace_team_and_production_map.sql` før ny backend aktiveres. Kjørt og verifisert mot CreatorHub Neon 2026-08-26.
- [ ] Når migrasjon `0451` er bekreftet i alle miljøer, fjern midlertidige runtime `CREATE/ALTER`-guards.
- [ ] Migrer gjenværende data fra `legacy.projects` og kompatibilitets-metadata til kanoniske tabeller, med backfill og avstemmingsrapport.
- [ ] Kjør en rollebasert staging-matrise med eier, editor, viewer og utenforstående på et faktisk prosjekt.
- [x] Kjør migrasjon `0452_realtime_user_event_tickets.sql` før den nye backenden aktiveres. Fullført i workflow-run `33015690144`.
- [x] Koble produksjonsbackenden til eksisterende administrert Render Key Value i samme miljø/region; verifisert uten å logge eller commite tilkoblingsstrengen.
- [ ] Fjern serverens midlertidige `?token=`-kompatibilitet for bruker-event-WebSocket etter at minimum støttet Capture-appversjon bruker ticket-handshake.
