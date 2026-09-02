# Leadgrid dataflyt-audit — 2026-09-02

## Resultat

Denne revisjonen følger aktive Leadgrid-flyter fra SwiftUI-handlingen via iOS-klienten og Express-ruten til tenant-avgrenset PostgreSQL, og tilbake gjennom ny innlasting. Den verifiserer kontrakten i kildekoden, backend-bundle, native tester og ikke-destruktive simulatorflyter. Migrasjonene er kjørt og verifisert i den konfigurerte produksjonsdatabasen; live HTTP-readback verifiseres etter backend-deploy.

Hovedresultat:

- Alle aktive Leadgrid-endepunktfamilier som iOS-klienten refererer til har en registrert backendrute. Kontrakttesten dekker minst 350 unike klientendepunkter.
- Alle `leadgrid_*`-tabeller som en aktiv rute kan opprette ved runtime finnes nå i en eksplisitt SQL-migrasjon.
- Aktiv workspace sendes på vanlige JSON-kall, råkall, multipart-opplastinger og agent-streaming. Serveren validerer medlemskap før organisasjonen blir request-kontekst.
- Lead-opprettelse fra pin, import og visittkort har stabil idempotens og naturlig duplikatkontroll innenfor workspace.
- Notater, favoritter, filer, aktiviteter, møtetid, møtevarighet, møtestatus, møteetterarbeid og ruteendringer har nå varig serverflyt og readback.
- Produksjonsgrensesnittet rapporterer ikke lenger suksess for teamhandlinger uten implementasjon. Mock-kampanjer og genererte møtelenker er begrenset til eksplisitt demo-modus.

## Felles datakontrakt

En muterende flyt regnes som koblet når den oppfyller denne kjeden:

1. UI validerer input, hindrer dobbeltklikk og beholder skjemaet ved feil.
2. Klienten sender kanoniske felt, workspace-kontekst og idempotensnøkkel der retry kan duplisere data.
3. Backend autentiserer bruker, verifiserer workspace-medlemskap og avgrenser berørte rader til valgt organisasjon.
4. Relaterte skriverier utføres atomisk når delvis resultat ville vært feil.
5. UI henter servertilstanden på nytt; lokal optimisme rulles tilbake ved feil.

Rene visningspreferanser — valgt fane, kollapsede paneler, kartstil, Pencil-verktøy og lokal navigasjon — trenger ikke backendflyt. Demo-data er bare tillatt når demo-modus er eksplisitt aktiv.

## Flytmatrise

| Flate | Data som leses | Data som skrives | Verifisert kontrakt |
| --- | --- | --- | --- |
| Oversikt | Leads, metrics, kalender, reminders, aktivitet, prosjekt- og teamaggregater | Kort-/målgruppepolicy og handlinger som går til de underliggende lead-/møteflytene | Aktiv org følger alle kall; camelCase-policyfelter aksepteres; serverdata lastes på nytt |
| Kart | Leads, geometri, discovery, BRREG, Places-detaljer, territorier og ruter | Lead fra pin/kort/import, geo, status, aktivitet, ruter og stopp | Opprettelse er replay-sikker; org.nr., Place ID og normalisert domene dedupliseres per workspace; avbrutt skjema oppretter ikke pin |
| Leads | Leadprofil, status, temperatur, ansvarlig, historikk, notater, favoritt og filer | Status/temperatur, tildeling, notat, favoritt, fil og aktivitet | Klient-, API- og DB-felt samsvarer; filer bruker eksisterende lagring og tenantbundet assosiasjon; readback er serverbasert |
| Møter | Kalenderhendelser, varighet, status og etterarbeid | Tid, varighet, status, avlysning, notat, møtestart, selgertildeling, etterarbeid og oppgaver | Status/varighet ligger på leadets kalenderkontrakt; etterarbeid har stabil request-ID og transaksjon; ferdigstatus leses på tvers av enheter |
| Team | Medlemmer, aktivitet, pipeline, områder og utstyr fra eksisterende teamtjenester | Reelle område-/utstyrs-/medlemshandlinger der API finnes | Ikke-implementert eksport, rapport, sammenligning, import og dashboardtilpasning viser nå «ingen data er endret» i stedet for falsk suksess |
| Leadbook | Maler, eksempler, opptak, Academy, Pondus, profil og innsikt | De eksisterende opprett-/rediger-/publiser-/opptaksflytene | Alle klientendepunktfamilier finnes på backend; demo-/treningssvar er eksplisitt testinnhold, ikke produksjonslagring |
| Salgsledelse | Teammedlemmer, mål, coaching, forecast, godkjenninger og ruter | Eksisterende lederhandlinger via salgsledelses-API-ene | Felles aktiv-org-header hindrer at eldre endepunktfamilier faller tilbake til feil tenant |
| Leadgrid Go | Dagsrute, stopp, kjørebok, bil og teamruter | Planlegging, stoppstatus, bil-/turdata | Route ID, stop ID og organization ID følger hvert write; stop- og ruteoppslag er workspace-avgrenset |
| Kvalitet | Verifiseringskø, maler, selgerstatistikk og årsaker | Verifisert, underkjent, oppfølging og malendringer | Produksjonsmodus bruker QualityService; demo-store brukes bare i demo-modus; resultat lastes på nytt etter submit |
| Anbud | Doffin-søk, overvåkninger, pipeline og tildelte kontrakter | Watch, pipelinefase, notat, ansvarlig og tapsårsak | Runtime-tabellene er migrasjonsdekket; request-ID brukes for relevante opprettelser; camelCase-klientfelt aksepteres |
| Canvas | Notater, versjoner, dokumenter, bibliotek og policy | Tegning, objekter, versjoner, deling, dokumentkobling og analyseutfall | Canvas-policy og analyser aksepterer klientens camelCase; lead-tilknytning valideres mot workspace; avledede oppgaver/logg skrives atomisk |
| Verktøy | Discovery, research, analyse, pitch, billing og øvrige hubmoduler | De respektive modulrutene | Konkurrenter er org-avgrenset; pitch-finalisering er replay-sikker; globale klient-/rutemappinger er kontrakttestet |

## Viktigste rettelser

### Workspace og sikkerhet

- Ny request-kontekst løser aktiv organisasjon fra `X-Leadgrid-Organization-Id` og verifiserer medlemskap.
- Lead-, konkurrent-, prosjekt-, rute-, møte-, oppgave-, Canvas- og pitchflyter bruker workspace-scope i stedet for bare bruker-ID.
- Lead-/prosjekt-ID-er fra andre workspaces avvises før lesing eller skriving.

### Leads og samarbeid

- Notater, personlige favoritter, filer og aktivitetshistorikk er flyttet fra lokal/falsk tilstand til serverpersistens.
- Strukturert leadprofil, pipelinefase og temperatur følger hele kontrakten fra skjema til database.
- Lead-opprettelser er idempotente, og naturlige identiteter kontrolleres atomisk innenfor riktig workspace.

### Møter og oppgaver

- Møtevarighet og møtestatus er varige databasefelt.
- Endring av tid, varighet og status oppretter historikk og gir server-readback.
- Etter-møtet-flyten kobler logg og oppgaver i én transaksjon og returnerer samme resultat ved retry.
- «Start møte», «Logg notat», «Endre status», «Avlys» og «Tilordne selger» utfører nå reelle kall og lukker ikke arket før serveren har bekreftet.

### Ærlig produktadferd

- Google Meet-, FaceTime- og telefonlenker som tidligere ble fabrikkert er ikke tilgjengelige i produksjonsmodus uten en reell datakilde.
- Avlysning åpner bare et e-postutkast når kontaktens faktiske e-post finnes; systemet påstår ikke at varsling er sendt.
- Kampanjevelgeren med hardkodede kampanjer og den fabrikerte møtelenken er demo-only.
- Teamhandlinger uten backend viser utilgjengelig status og rapporterer aldri «utført».

## Migrasjoner

- `0490_leadgrid_core_dataflow.sql`: aktivitetsmetadata, møtevarighet/-status, notater, favoritter, konkurrent-workspace, replay-sikkert pitchutfall og gyldig aktivitetstype for oppgaver.
- `0491_leadgrid_lead_files.sql`: tenantbundet kobling mellom lead og eksisterende filobjekt, med opplaster, beskrivelse og tags.
- `0492_leadgrid_runtime_schema_backfill.sql`: eksplisitte deploy-time-skjemaer for Doffin/anbud, Canvas, møteetterarbeid, oppgaver, policyer, ruteplaner og offentlige Leadgrid-innsamlingsflyter.

Migrasjonene er additive og idempotente. Alle tre ble kjørt mot den konfigurerte Neon-produksjonsdatabasen 2026-09-02 under PostgreSQL advisory lock, registrert i `_migrations_applied` og etterkontrollert for tabeller, nøkkelkolonner, constraints og indekser uten mangler.

## Verifikasjon

- `git diff --check`: bestått.
- Vitest: 43 Leadgrid-testfiler, 475 tester, alle bestått.
- Testene dekker klient–rute-kartlegging, runtime-tabell–migrasjonskartlegging, workspace request-kontekst, prosjekt-scope, lead-idempotens og discovery-regresjoner.
- `LeadMapAppTests`: 50 tester, alle bestått på iPad-simulator.
- Ikke-destruktive `LeadMapAppUITests`: mobilskjema, hovedfaner, lead-detalj og tilgjengelighetsaudit bestått på iPhone-simulator. Den destruktive SuperAdmin-entitlementtesten ble bevisst utelatt mot produksjonsdata.
- Full `LeadMapApp` Debug-build mot iOS Simulator SDK: bestått. Eksisterende Swift 6-advarsler gjenstår i andre områder, men ingen compile-feil.
- Backend `npm run build`: bestått og prod-bundle generert.
- Backend `tsc --noEmit`: ingen nye Leadgrid-feil. Baseline stopper fortsatt på `sharp.default` i client-gallery og manglende `adm-zip`-typer i to NextRole-filer.

## Verifikasjonsgrense før produksjon

Kildekontrakt, tester og kompilering er verifisert. Følgende må fortsatt skje i release-løpet:

1. Kjør en innlogget live smoke-test etter backend-deploy og bekreft persistens/readback og workspace-isolasjon.
2. Test retry etter simulert mistet serversvar for lead-opprettelse og møteetterarbeid.
3. Test filopplasting/readback og møteendring/readback fra to enheter.
4. Overvåk 4xx/5xx under første deploy.
