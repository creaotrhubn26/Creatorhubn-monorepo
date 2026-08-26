# CreatorHub Workspace – tasklist

Grunnlag: `origin/main`
Arbeidsgren: `fix/creatorhub-workspace-workflow`

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

## Oppfølging etter utrulling

- [x] Kjør migrasjon `0451_workspace_team_and_production_map.sql` før ny backend aktiveres. Kjørt og verifisert mot CreatorHub Neon 2026-08-26.
- [ ] Når migrasjon `0451` er bekreftet i alle miljøer, fjern midlertidige runtime `CREATE/ALTER`-guards.
- [ ] Migrer gjenværende data fra `legacy.projects` og kompatibilitets-metadata til kanoniske tabeller, med backfill og avstemmingsrapport.
- [ ] Kjør en rollebasert staging-matrise med eier, editor, viewer og utenforstående på et faktisk prosjekt.
- [ ] Flytt engangsbillettene til et delt lager eller aktiver sticky routing før backend skaleres til flere instanser; dagens 30-sekunders ticket-store er prosesslokal.
- [ ] Migrer den separate browser-klienten for Capture-session-WebSocket til samme scoped ticket-mønster; den bruker fortsatt eldre token-query mot en annen, sesjonsavgrenset kanal.
