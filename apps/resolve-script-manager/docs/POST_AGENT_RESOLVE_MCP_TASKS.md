# Post Agent × DaVinci Resolve 21.1 MCP

Statusdato: 2026-09-10

## Dokumentasjonsgrunnlag

Beslutning: `GO_WITH_TESTS`. Resolve 21.1 dokumenterer AI Assistant Control, og den installerte Studio-utgaven inneholder både MCP-pakke og versjonsmatchede Python-stubs.

- **[Resolve 21.1 Reference Manual](</Users/danielqazi/Desktop/Resolve Manual.pdf>)**, kapittel 201, side 4318: «Using DaVinci Resolve with AI Assistants». Dokumenterer `File > Setup AI Assistants`, Claude Desktop/Claude Code, naturlig språk, organisering, looks, scripts og direkte Resolve-handlinger. Manualen advarer også om at AI-genererte scripts arver assistentens disk- og nettverkstilgang.
- **Blackmagic `DaVinciResolve.mcpb` 1.0**, installert med Resolve: lokal Node/stdin-proxy og 14 MCP-verktøy. `run_script` er sandboxet; `run_script_unsafe` har full systemtilgang.
- **DaVinciResolveScript.pyi 21.1**, installert utviklerreferanse: brukt for eksakte symboler, signaturer og returtyper før workflows aktiveres.
- **[OpenAI – Developer mode and MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta)**, kontrollert 2026-09-09: ChatGPT bruker Remote MCP, lokal MCP krever Secure MCP Tunnel, og publiserte tool-snapshots/actions styres av workspace-admin/RBAC.

Dokumentasjon → kode → test skal være sporbar. Ingen ny Resolve-operasjon aktiveres før symbolet finnes i 21.1-stubben og har target-binding, read-back og definert rollback-grense.

## Mål

Én sikker Resolve-motor for Post Agent, Claude Desktop og ChatGPT. AI-klientene skal bruke semantiske workflows; de skal aldri få direkte tilgang til `run_script_unsafe` eller sende vilkårlig Python til Resolve.

## Arkitektur

```text
Claude Desktop (lokal MCPB) ─┐
Post Agent UI ───────────────┼─> Post Agent MCP Gateway ─> Blackmagic Resolve MCP ─> Resolve
ChatGPT (Remote MCP) ────────┘             │
                                          ├─ plan / approval / audit
                                          ├─ target binding / read-back
                                          └─ guarded rollback
```

Den lokale Tauri-gatewayen eier Resolve-sesjonen. En fremtidig ekstern ChatGPT-endpoint må bruke en autentisert desktop-relay; skyserveren kan ikke kontakte Resolves lokale MCP-prosess direkte.

## P0 — sikker lokal gateway

- [x] Kartlegg de 14 verktøyene i Blackmagics Resolve 21.1 MCP-pakke.
- [x] Behold rå `run_script` og `run_script_unsafe` utenfor Tauri/frontend-kontrakten.
- [x] Innfør felles `plan → approval → apply → read-back → rollback`.
- [x] Bind planer til stabil prosjekt-ID og timeline-ID.
- [x] Utløp planer etter 30 minutter for å hindre stale writes.
- [x] Begrens inputstørrelse, antall bins, markører og transcript-selects.
- [x] Bruk faste Resolve-scripts og faste LUT-oppskrifter; ignorer ukjent Python-input.
- [x] Logg apply og rollback i Post Agents kjøringshistorikk.
- [x] Legg inn unit-tester for katalog, allowlist, planbygging og inputisolasjon.
- [x] Legg inn E2E-flyt for plan, godkjenning, verifisering og rollback.

## P0 — 12 Resolve-skills

- [x] Project Doctor — read-only prosjektkontroll.
- [x] Timeline QC — read-only spor/gap/deaktivert-kontroll.
- [x] Media Health — read-only offline/proxy/duplikat-kontroll.
- [x] Delivery QC — read-only output/framerate/audio/render-kontroll.
- [x] Project Organizer — planlegger og oppretter bare manglende rot-bins; rollback nekter å slette ikke-tomme bins.
- [x] Transcript Editor — lager ny selects-timeline fra eksplisitte clip-ID/frame-utdrag.
- [x] Multicam Director — lager native multicam fra låste/valgte Media Pool-klipp og timecode- eller waveform-synk.
- [x] Audio Post — leser forrige Voice Isolation-state og kan bruke/gjenopprette ny state per spor.
- [x] Color Guardian — genererer en validert LUT i Resolves avgrensede `LUT/MCP`-mappe; påfører den ikke automatisk.
- [x] Review Notes — oppretter sporbare timeline-markører med unik `customData` og presis rollback.
- [x] Batch Render Planner — validerer tre faste profiler mot installerte codecs og legger dem kun i renderkøen.
- [x] V1 Clip Renamer — viser før/etter-navn og binder endringen til item-ID, startframe og gammelt navn.

## P1 — produktintegrasjon

- [ ] La Caption/Transcript Studio sende valgte segmenter direkte til Transcript Editor-planen.
- [ ] La Multicam Studio sende eksplisitte clip-ID-er og forhåndsvise angle/sync-resultat.
- [ ] Hent Role Room review-kommentarer og konverter dem til Review Notes-plan med valg per kommentar.
- [ ] Legg LUT-preview på duplisert timeline/still før brukeren eventuelt påfører looken.
- [ ] Utvid Audio Post med loudness-normalisering og dialog-leveler etter per-format preset.
- [ ] Utvid Project Organizer med forhåndsvisning av flytting/metadata uten å flytte media automatisk.
- [ ] Legg egen `verify`-kommando som kan kjøres på nytt etter en senere Resolve-endring.
- [ ] Persistér krypterte planmetadata på disk slik at en godkjent plan overlever app-restart.
- [ ] Vis detaljert before/after-diff, ikke bare operasjonssammendrag.
- [ ] Legg til idempotency-key per ekstern MCP-kall.

## P1 — dynamisk Resolve-intelligens

- [x] Implementer backend-kall til `get_whats_new` siden 21.0.
- [x] Implementer domeneoppslag med `search_scripting_api` for organizer, transcript, multicam, audio, color, review, render og rename.
- [ ] Cache versjonsbundet API-evidence lokalt og invalider ved Resolve-versjonsbytte.
- [ ] Vis «nytt i denne Resolve-versjonen» i Skills-panelet.
- [ ] Kjør kompatibilitetssjekk før en lagret workflow fra eldre Resolve-versjon utføres.

## P1 — ChatGPT og Claude

- [x] Pakk Post Agent-gatewayen som lokal `.mcpb` for Claude Desktop.
- [x] Bygg tokenisert loopback-bro med tilfeldig port, `0600`-descriptor og maks 64 KiB request.
- [x] Eksponer kun status, skill-katalog, read-only-analyser, planopprettelse, planstatus og API-intelligens.
- [x] Hold `apply` og `rollback` helt utenfor Claude-broen; godkjenning skjer i synlig Post Agent UI.
- [x] La Post Agent hente siste plan opprettet av en ekstern AI-klient.
- [x] Legg kontrakttest for MCP-verktøysnapshot og live loopback-bro.
- [ ] Definer ekstern Remote MCP-verktøykatalog med bare semantiske plan/read-verktøy.
- [ ] Bygg OAuth/RBAC mot eksisterende Role Room MCP-autentisering.
- [ ] Bygg desktop-relay med engangskanal, kort levetid og eksplisitt lokal godkjenning.
- [ ] Koble ChatGPT via Secure MCP Tunnel under utvikling; bruk administrert HTTPS-endpoint i produksjon.
- [ ] Eksponer writes bare for Business/Enterprise/Edu-workspaces som har godkjent verktøysnapshot.
- [ ] Legg per-verktøy policy: read auto, low-risk confirm, destructive double-confirm.
- [ ] Test samme verktøykontrakter fra Claude Desktop, ChatGPT og Post Agent UI.

### Manualens eksempelprompter

- [x] Timeline breakdown, offline media og markører → Project Doctor / Timeline QC / Media Health.
- [x] Kontroller prosjektinnstillinger og leveringsoppsett → Delivery QC.
- [x] Organiser prosjekt/media → Project Organizer med plan og rollback.
- [x] Opprett looks → Color Guardian genererer LUT uten automatisk påføring.
- [x] Batch-render ProRes 422 HQ, H.265 4K og H.264 proxy → codec-validering, eksplisitt preview og kø-only plan; `StartRendering` er ikke tilgjengelig.
- [x] Sekvensielt navn på V1-klipp → ID/startframe-låst før/etter-preview og betinget rollback som nekter å overskrive nyere endringer.
- [ ] Fargede cut-markører per spor + CSV → unik `customData`, kontrollert rapportsti.
- [ ] Bruk eksisterende LUT på node 2 → duplisert timeline/grade-versjon før påføring.
- [ ] Sammenlign prosjektinnstillinger → read-only snapshot uten å forlate/lagre feil prosjekt.
- [ ] Reframe til 9:16 → duplisert timeline, custom settings og separat Smart Reframe-kontroll.

## P2 — automatisering og agentorkestrering

- [ ] Director Agent lager intensjon og plan.
- [ ] Editor Agent utfører kun godkjent timeline-operasjon.
- [ ] Audio og Color Agents arbeider på avgrenset timeline-/spor-kopi.
- [ ] QC Agent leser resultatet tilbake og kan blokkere levering.
- [ ] Orchestrator tillater bare én writer mot samme timeline om gangen.
- [ ] Invalider aktiv plan når prosjekt/timeline/marker-hash endres.
- [ ] Kjør Delivery QC automatisk etter render-complete.
- [ ] Kjør Media Health automatisk etter relink/import.

## P2 — læring og evaluering

- [ ] Lag eksplisitt opt-in for prosjekt-/kundeprofilbasert læring.
- [ ] Lær klipptempo, shot duration, transition-appetitt, kameravalg og look-intensitet fra godkjente differ.
- [ ] Ikke lagre kundemedier eller transkripsjoner i global profil.
- [ ] Lag fixture-prosjekter for bryllup, musikkvideo, corporate, podcast og dokumentar.
- [ ] Evaluer target-ID, idempotens, ingen overskriving, read-back og rollback per workflow.
- [ ] Legg golden contract-test for alle eksterne MCP-verktøy.
- [ ] Legg release-monitor for Resolve/MCP/API-endringer med lav støy.

## Verifiseringskrav

- Rust unit/integrasjonstester skal passere.
- TypeScript og Vite production build skal passere.
- Playwright skal verifisere plan/apply/rollback i webview-laget.
- Live Resolve-tester skal som standard være read-only.
- En muterende live-test krever et eksplisitt testprosjekt og skal alltid rydde opp via rollback.

## Rollback- og kompatibilitetsregler

- Project/timeline-ID må fortsatt matche den godkjente planen.
- Markører slettes bare via Post Agents unike `customData`.
- Bins slettes bare dersom de ble opprettet av planen og fortsatt er tomme.
- Multicam-items slettes ikke dersom de er tatt i bruk på en timeline.
- LUT-er kan bare opprettes/slettes under Resolves `LUT/MCP`-område.
- Renderrollback sletter bare jobb-ID-ene planen opprettet og nekter dersom en jobb er startet eller ferdig.
- Navnerollback krever at item-ID, startframe og Post Agent-navn fortsatt matcher; nyere brukerendringer overskrives ikke.
- `run_script_unsafe` forblir blokkert for UI, Claude, ChatGPT og remote MCP.
