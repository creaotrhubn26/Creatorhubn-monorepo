# The Role Room — Story Graph (spillstudio)

Arbeidsnavn **Story Graph**. Vertikal `game_studio` i The Role Room, beta bak
`?mode=game_studio`. Kodemappe `frontend/client/src/components/role-room/narrative/`,
backend `backend/server/role-room-narrative-*.ts`, tabellprefiks `narrative_*`
(migrasjon `0618_role_room_narrative_graph.sql`).

## Produktløftet

Spillstudioer og narrative designere skal kunne tegne en forgrenet historie som en graf —
brett, elementer, forgreninger, jumpere, komponenter med attributter og variabler —
spille den gjennom, og ta den rett inn i Unity, Unreal eller Godot. Målet er å komme
nærmere eller bedre enn Arcweave: samme objektmodell (tapsfri import/eksport), pluss
det Arcweave mangler eller gater bak Team-plan (prosjekthistorikk for alle, grafvalidator,
TTS i spillmodus, skrive-API via MCP, Twine/Ink-import).

## Researchgrunnlag

Arcweave kartlagt 2026-09-14 fra primærkilder (GitHub-repoene `arcweave/*` fullhentet;
docs/blogg via søkeutdrag — arcweave.com var blokkert av egress-proxy). Kjernefunn:

- **Objektmodell:** project → boards (mapper), elements (riktekst tittel/innhold, cover,
  komponenter, attributter), connections (etikett kan inneholde arcscript), branches
  (`if/elseif/else`), jumpers, components (+ attributter), assets, variables, notes.
  Verifisert mot `arcweave-unity-example/…/project.json`.
- **Skript:** arcscript (ANTLR4-grammatikk, MIT): `if elseif else endif`, `= += -= *= /= %=`,
  sammenligning, `is`/`is not`, `&& || !`, innebygde `abs max min random roll round sqr sqrt
  visits show resetVisits reset resetAll`. Kode ligger i `<pre><code>` i element-HTML.
- **Variabler:** global, brett-skopet og (fra 5.11.0, 2026-09-02) komponent-skopet, alle
  modellert som typede attributter.
- **Play Mode:** ett element per tur, Restart, Debugger, Style Editor, delbare lenker,
  embed. Ingen TTS. Ingen lagring av framdrift i nettleser.
- **Eksport/API:** JSON alle planer; Engine-JSON + Markdown/PDF/CSV/XLSX/backup på Pro/Team;
  Web-API kun lesing og kun Team; ingen webhooks; ingen Twine/Ink-import. Plugins for
  Unity 3.0.0, Godot 3.0.0 (.NET), Unreal 2.0.0 (alle 2026-09-02, MIT).
- **Samarbeid:** sanntids-markører, kommentarer m/ @mentions; Project History kun Team.
- **Pris (USD/sete/mnd):** Basic gratis (3 prosjekter, 200 items), Pro $15, Team $25.
- **Kjente hull (reviews):** kun online, rot i store prosjekter, seteprising, planlegging
  uten motor.

Repoets ingredienser: `reactflow@11` og `@tiptap/*` v3 installert; manus-modulen
(`casting_manuscripts/acts/scenes/dialogue`, Fountain/FDX, lås/presence/revisjoner,
scene-relative kommentarer); testet betingelses-DSL i `lead-rules-engine.ts`;
`TableReadPanel` (TTS per karakter); `demoStudioExports.ts` (spillbar HTML-artefakt);
AI-substrat på Claude med kreditt/rate-limit; MCP-server for Role Room.

## Validerte problemområder

1. Fragmentering: narrativ design lever i Twine/Google Docs/Excel uten kobling til motor.
2. Vendor-lock: Arcweaves API er kun lesing, eksport gates bak plan, historikk kun Team.
3. Kvalitet: ingen grafvalidator — døde ender og ukoblede utganger oppdages i motoren.
4. Stemme: dialog må høres, ikke bare leses (TTS mangler hos Arcweave).
5. Samarbeid mellom forfatter, designer og publisher krever kommentarer + versjoner.

## Første vertikale leveranse (Fase 1 — denne PR-serien)

- Egen profession-mode `game_studio` med faner brett / komponenter / variabler /
  ressurser / spill / eksport / historikk (`professionTabs.ts`).
- Datamodell 1:1 med Arcweaves JSON (migrasjon 0618), prosjekt-skopet under
  `casting_projects` med `canAccessRoleRoomProject`.
- Backend-ruter `/api/role-room/narrative/projects/:projectId/…` med zod, `{ success, data }`,
  optimistisk låsing (`If-Match` → 409 med gjeldende rad).
- reactflow-canvas med fire nodetyper, koblingsregler som Arcweave, batch-flytting med
  angre/gjør om, Tiptap-editor, brett-sidebar med mapper og søk.
- Komponenter med attributter (7 typer), globale variabler, ressurser via URL.
- Prosjekthistorikk (snapshot + ikke-destruktiv gjenoppretting) for alle.
- Grafvalidator (startelement, uoppnåelige elementer, ukoblede utganger, jumper uten mål).
- MCP: `rr_get_story_graph`, `rr_list_story_components` i `game_studio`-modus.
- Tester: vitest (backend-ruter, graf-operasjoner), Playwright (`narrative-board.spec.ts`).

## Leveranseplan mot markedsledende arbeidsflyt

### Fase 2 — Skript, forgreninger og Play Mode (LEVERT)
- `frontend/shared/narrative-script/`: arcscript-kompatibel lexer, parser (presedensklatring,
  `if/elseif/else/endif` på tvers av kodeblokker), evaluator (typede variabler, koersjon,
  `abs max min random roll round sqr sqrt visits show resetVisits reset resetAll`, nodebudsjett)
  og tolk (`createInterpreter` → `runScript`/`evaluateCondition`, kaster aldri). Ren TS, delt
  med backend. Testkorpus speiler Arcweaves eksempelprosjekt.
- `frontend/shared/narrative-runtime/`: `createPlaySession` (start/choose/back/restart/
  setVariable, jumper med sløyfevakt, auto-ruting i forgrening via `sourceOutputKey`,
  etikett-skript ved valg, komponent-/brett-attributter som skopede variabler) og
  `validateScripts`/`validateStoryGraph` (parse-feil, ukjente variabler, døde referanser).
- Play Mode (`narrative/play/`): rendret element (DOMPurify), valg, Fortsett/Tilbake/Restart,
  debugger (variabler redigerbare, besøk, logg med feil), TTS per komponent via
  `ttsService` (nettleser-stemme standard, AI-stemmer valgfritt), «Rediger element».
- Editor: kodeblokk-knapp, `MentionSpan`-node + «Sett inn referanse» (element/variabel/
  komponent), betingelsesfelt med live syntaks-sjekk og variabel-autocomplete; skript-chip
  på noder; merknader-chip inkluderer nå skriptfeil.
- Backend: `GET /projects/:projectId/validate` og MCP `rr_validate_story_graph` bruker samme
  validator som frontend.
- Utsatt: `@`-autocomplete i editoren (krever `@tiptap/suggestion`), spillsesjon som
  overlever fane-bytte.

### Fase 3 — Interop, deling, AI, MCP-skriving (LEVERT)
- `frontend/shared/narrative-format/`: Arcweave `project.json` 1:1 (`toArcweaveProject` /
  `fromArcweaveProject` med advarsler, prefiks-frie ider, mappetrær, betingelser/`conditions`,
  typede attributter), Markdown (`toMarkdown`), standalone HTML (`buildStandaloneHtml` +
  `toRuntimeSubset`). Ren TS delt av frontend, backend og MCP; rundtur-test mot fixture.
- `frontend/shared/narrative-player/`: vanilla-DOM-spiller over den delte motoren, bygget med
  esbuild til `client/public/embed/narrative-player.js` (`npm run build:narrative-player`,
  kjedet inn i `build`; artefakten er committet).
- Backend: `GET …/export.json` (vedlegg), `GET …/export.md`, `POST …/import` (revisjon «Før import»
  → `replaceGraph`), delingslenker (`POST/GET …/share-links`, `…/:id/revoke`; token lagres kun
  som sha256-hash, råtoken vises én gang), offentlig `GET /public/:token` (renset runtime-graf:
  ingen notater, element-/riktekst-attributter, lagringsnøkler eller prosjekt-id; `no-store`).
- Frontend: Eksport-fanen (`panels/ExportsPanel.tsx`) med nedlasting bygd klient-side, Arcweave-
  import med forhåndsvisning/bekreftelse/merknader, delingslenker; `play/StoryPlayer.tsx` delt
  mellom Play-fanen og offentlig side `pages/story-play.tsx` på `/story/:token` (registrert i
  både `App.tsx` og `casting-main.tsx`; debugger kun ved `view_play`).
- KI: `backend/server/ai-narrative-element-agent.ts` (`narrative-element-agent`, modus
  next/enhance/branches, `claude-opus-5`, effort medium, cachet system-prompt, tool_choice auto)
  + applier som materialiserer i accept-transaksjonen; ny kildetype `narrative_element`
  (migrasjon `0619_ai_suggestions_narrative_source_type.sql`); «Foreslå med KI» i element-skuffen
  (`editor/NarrativeAiAssist.tsx`, mountes først ved åpning).
- MCP: `rr_export_story_graph` (arcweave | markdown) og `rr_draft_element` (skriv: ukoblet
  utkast på brettet «KI-utkast»/mappe «Utkast» — utkast-invarianten uten migrasjon).
- Tester: vitest (format-lag, agent, ruter, MCP), Playwright `narrative-exports.spec.ts` og
  `narrative-story-play.spec.ts` (harness `?harness=story_play`).
- Utsatt: server-side standalone-HTML-endepunkt, embed-kode (iframe), PDF/CSV.

### Fase 4 — Forbi Arcweave (LEVERT)
- **Import fra Twine og Ink** (`narrative-format/twee.ts`, `ink.ts`, `sniff.ts`): Twee 3 med
  SugarCube (fullt: `<<set/if/elseif/else/link/goto>>`, lenker `[[t|m]] [[t->m]] [[m<-t]]`) og
  Harlowe (best-effort, uverifisert), Ink-delsett (knots/stitches, valg, gathers, diverts, VAR,
  `~`, `{cond: a | b}`; once-only og sekvenser er lossy med advarsel). Samme `POST …/import`
  (`format: arcweave | twee | ink`), filvelger i Eksport-fanen med sniff + forhåndsvisning.
- **Lokalisering / Translation Mode** (migrasjon 0620, `narrative-format/locale.ts`): in-row
  `i18n`-JSONB på elementer/koblinger/innstillinger, `nb` kanonisk, kodeblokker oversettes aldri
  (`mergeCodeBlocks`). Fane «Oversettelser» med KI-forslag (`narrative-translate.ts`, statsløst),
  locale-velger i Play Mode, `?locale=` på `/story/:token`, locale på alle eksporter.
- **Sanntids-markører + presence** (`websocket-chat.ts` rom `narrative:<projectId>`): avatarer,
  markører på lerretet, valg-ring i kollegaens farge, `narrative:graph_changed`-push etter
  mutasjoner → debounced reload. Ingen CRDT.
- **Lansering**: landingskort «Spillstudio — Story Graph» (beta), login-persona med rollekort
  Spillstudio/Narrativ designer → `?mode=game_studio`, `?signup=game_studio`.
- **Billing** (migrasjon 0621, `game-billing-*`, `game-plan-gate.ts`, `role-room/game/`): planer
  Solo (gratis) / Pro / Studio (plassholderpriser, admin-redigerbare), Stripe checkout/portal/
  webhook, tester-invites. Gating på prosjekteierens plan: delingslenker, spillbar HTML,
  KI-forslag, oversettelser, Twine/Ink-import, elementgrense (402 `plan_required`/`plan_limit`).
- **Runtime-pakker** (`packages/story-graph-runtime/`): JS-pakke med full motor (bygget fra
  `shared/narrative-runtime-pkg`, paritetstest), Unity C# og Godot 4 GDScript for et dokumentert
  arcscript-delsett, felles transkript-format + fixture for manuell paritetssjekk (CHECKLIST.md).
- Ikke gjort i Fase 4 (bevisst): `@xyflow/react` v12, realtime-gating, PDF/CSV-eksport, embed-kode —
  alle unntatt realtime-gating levert i Fase 5.

### Fase 5 — Resten av benchmarken (LEVERT)
- **CSV-eksport** (`narrative-format/csv.ts`, alle planer): én rad per element (brett, mappe, id,
  customId, type, tittel, innhold, komponenter, valg, betingelser, jumper-mål, skript, start) +
  vedlegg for variabler og komponenter. Norsk Excel-profil: `;`, CRLF, BOM, formel-prefiks
  nøytraliseres. Klient-side nedlasting, `GET …/export.csv?locale=`, MCP `format: csv`.
  `?locale=` støttes nå også på `export.json`/`export.md`.
- **Embed-kode**: `/story/:token?embed=1` skjuler toppstripa; «Embed-kode»-knapp ved ny delingslenke
  gir en `<iframe>`-snutt (kopier med umiddelbar «Kopiert!»-tilbakemelding). Vises kun rett etter
  opprettelse fordi bare token-hashen lagres.
- **PDF-eksport** (`backend/server/narrative-pdf.ts`, Pro/Studio via migrasjon 0622 `export_pdf`):
  pdfkit med innebygd DejaVu Sans (æøå), tittelside, per brett elementer med innhold/skript/valg/
  forgreninger/jumpere/notater, vedlegg variabler + komponenter, sidetall. `GET …/export.pdf?locale=`
  → 402 på Solo; knappen er låst med forklarende banner før man trykker (forebygg fremfor forklar).
- Felles traversering `narrative-format/traverse.ts` (Markdown, CSV, PDF).
- **`@xyflow/react` 12.11.6** erstatter `reactflow` 11 fullstendig (også admin/CustomerJourneyBuilder)
  — samme globale `.react-flow__*`-CSS i begge gjør side-om-side utrygt. Typet lerret
  (`NarrativeFlowNode`), `colorMode="dark"`. Evidence: `docs/evidence/2026-09-narrative-canvas-xyflow-12.yaml`.
- Ikke gjort (bevisst): realtime-gating.

### Fase 6 — Produksjons-OS del 1: «Scener & gameplay» + «Review & Godkjenning» (LEVERT)
Fokus valgt 2026-09-16: kjøper = mellomstore studio (10–50), der statuseierskap og review-runder
per scene er daglig smerte. UX-prinsipper: progressive disclosure (liste → kort → faner), alle
states designet (tom/laster/feil/låst/lagret/stale), umiddelbar feedback (autosave ved blur med
«Lagret HH:MM», optimistisk avkryssing), forebygg fremfor forklar (kode foreslås og valideres
unik før lagring; review-knappen deaktivert med forklaring når en runde er åpen; stale-banner
før noen rekker å trykke «Godkjenn»).
- **Datamodell** (`0623_narrative_scenes_and_reviews.sql`): `narrative_scenes` (kode `^[A-Za-z]{1,3}[0-9]{1,4}$`
  unik per prosjekt, tittel/undertittel/lokasjon/utfordring/spillmekanikk/miljø, status, ansvarlig,
  frist, hero-asset), `narrative_scene_links` (scene ⇄ element/brett, reverse-indeks),
  `narrative_scene_frames` (asset XOR URL), `narrative_scene_tasks`, `narrative_scene_reviews`
  (runde, immutabelt snapshot + sha256-hash via trigger, én åpen runde per scene). Kommentarer
  gjenbruker `role_room_editor_comments` med ankerne `narrative_scene`/`narrative_scene_frame`
  (prosjekt-sjekk i ruten). Feature `scene_review` på Pro/Studio; scener og oppgaver ugatet.
- **Backend**: service-seksjon «Fase 6: Scener» (auto-kode «S{n}», 409 `duplicate_code`,
  `requestSceneReview` superseder åpen runde, `decideSceneReview` → 409 `snapshot_stale` m/ gjeldende
  hash eller `review_closed`), ruter under `/projects/:id/scenes…` + `members-lite` (eier + aktive
  medlemmer; leads kan sette ansvarlig uten å være eier), sanntids-push `kind: 'scene'`, inbox- og
  e-postvarsel til ansvarlig/forespørrer (injiserbar `deps.notify`). MCP: `rr_list_game_scenes`,
  `rr_game_scene_review_status` (kun game_studio; `rr_list_scenes` er filmens).
- **Frontend**: fane «Scener & gameplay» (liste 320 px m/ søk + statuschips | scenekort «S12 – Tittel»
  med faner Oversikt/Storyboard/Gameplay/Assets/Oppgaver/Review), `MemberPicker` (avatar + navn,
  fallback «Deg selv»), `sceneOps.ts` (rene regler, vitest), «Åpne i Story Graph» hopper til noden.
  e2e `game-scenes.spec.ts` (flyt + stale-vern + storyboard) og plan-gate-tilfelle for Solo.

### Fase 7 — Produksjons-OS del 2: bygg «What Follows Us» i Story Graph (LEVERT)
Mål (bruker 2026-09-17): Story Graph er verktøyet studioet bygger **What Follows Us — Episode One:
The Seeker** med, fra 16 kildedokumenter (åpning P01–P12, spillscener G01–G10/G03A, tilfluktsrom
H01–H03, kultfilm K01–K08, replikkgrunnlag W01–W10 + U-cues, kraftprogresjon, våpen/fraksjoner,
M1-kvalitetskrav, bevegelseskontrakt, implementeringsrapporter). Studioets AGENTS.md-regler er bygd
inn: kildehendelse (W/K) / brukertillegg (U) / forslag (A) / bevart engelsk (E) / ny oversettelse (T)
holdes fra hverandre, ingen replikk strykes stille, ingen gate er bestått uten sitert bevis, og
kildene registreres med SHA-256.
- **Datamodell** (`0624_narrative_production_os.sql`, `0625_game_team.sql`, `0626_narrative_review_share_links.sql`):
  scenekort v2 (Før/Handling/Kontroll/Etter/Lyd/Endring/Bro/tidsnote, kunnskap §E, epoke, episode,
  kildemerker, arbeids-ID; kode med bokstav-suffiks for G03A), `narrative_scene_gates` (seks gater,
  «bestått» krever bevis — CHECK i DB og 400 i API), `narrative_scene_lines` (cue-ID, taler, type,
  EN/NB, opptaksstatus), `narrative_episodes`, `narrative_open_questions` (spørsmål + sjekklister +
  låste beslutninger), `narrative_sources` (SHA-256), komponent-`kind`/`profile`, `narrative_milestones`
  (+ scenekobling), `narrative_platform_targets` (budsjetter, krav m/ status og bevis, visuell retning);
  team (`game_team_role`, `game_team_invite`, `enterprise_team_members.game_role_id`) og gjestelenker
  (`narrative_review_share_links`, `narrative_review_sessions`). Snapshot v2 for review-runder; v1-runder
  fra før avgjøres fortsatt med v1-hash.
- **Backend**: Fase 7-service (CRUD for alt over, prosjektoversikt-aggregat, narrative innboks over
  `role_room_project_notifications` — producer-ACL-en avviser spillstudio-eiere), ruter med
  `production`-sanntidskind, `production_plan`-gating (Pro/Studio) på milepæler, `team_seats`/
  `guest_reviewers` (Studio); kapabilitetssjekk (`scenes.delete`, `review.decide`, `plan.edit`) med
  eier-bypass; `canAccessRoleRoomProject` fjerde gren for game_studio-teammedlemmer; offentlig
  gjeste-router `/api/role-room/narrative/review/:token` (navngitt sesjon, kommentarer via
  `role_room_editor_comments` som `reviewer:<sid>`, beslutning med stale-vern og varsel). MCP:
  `rr_get_scene_card`, `rr_project_overview`. Seed: `npm run seed:story-graph -- --project <id>`
  (idempotent) fra `frontend/shared/narrative-fixtures/what-follows-us.json` (34 scener, 84
  replikker, 12 episoder, 38 komponenter, 70 spørsmål/sjekklister, 13 milepæler, iPad-mål).
- **Frontend**: skall med sidebar (seksjoner, vertikale Tabs så `aria-selected`/testids består),
  mobil-drawer, ⌘K, innboks-bjelle; **Hjem** (KPI-er, neste opp, milepæler, episoder, aktivitet);
  **Historie** (episoder, tidslinje med låste beslutninger, åpne spørsmål/sjekklister, kilderegister);
  scenekort med **Manus / Replikker / Gater**; **Karakterer** og **Lokasjoner** som galleri over
  komponentarkivet (forfatterfasit bak intern-toggle, stemmecast, minnespor, krefter; epoker/
  kontinuitet/rekvisitter; scener + replikker); **Plattform** (iPad Pro M1: engine, OS, enhet, input,
  budsjett, krav med bevis, visuell retning); **Produksjonsplan** (Gantt per bane + liste);
  **Team** (roller, seter, PIN-invitasjon, `/game/invite/:token`); «Del med reviewer» →
  `/story-review/:token` for gjester. e2e: game-shell, game-story-characters, game-plan, game-team,
  game-guest-review (+ eksisterende game-scenes/plan-gate/narrative-board).
- Uttrekk av fixturen: Sonnet-subagenter per dokumentgruppe (mekanisk), verifisert av Fable 5.1 mot
  kildene; evidens i `docs/evidence/2026-09-what-follows-us-source-registry.yaml`.


### Fase 8 — «Next level»: fra manus til spill, KI-manusvakt, salg og drift (PÅGÅR)

Verdikt 2026-09-18: Story Graph var et register — alt skrevet inn for hånd, gater satt manuelt,
ingenting flyter tilbake fra spillbygget eller manusdokumentene. Fase 8 lukker tre løkker
(manus → Story Graph, spillbygg → gater, Story Graph → spill) med WFU som første bruker, og gjør
vertikalen salgsklar. Rekkefølge: 8a drift → 8b manusimport → 8c CI-bevis → 8d manusvakt →
8e Swift-runtime + spilltest → 8f lesning/referansebilder → 8g salgsklar. Én PR per del.

- **8a Drift-fundament (LEVERT):** server-side av-bryter `ROLE_ROOM_GAME_STUDIO_ENABLED`
  (`backend/server/game-studio-kill-switch.ts`; alt under `/api/role-room/narrative` og `/api/game`
  svarer 503 `game_studio_disabled`, frontend viser helsidebanner); Sentry-fangst i narrative-rutenes
  `wrap()` via `captureBackendException` (no-op uten DSN); alle `req.params` gjennom `param()`
  (backend-tsc 877 → 842 feil, 0 i narrative-rutene); per-token rate-limit på `/public/:token`
  (`narrative-rate-limit.ts`, 120/min — ikke IP, som er lik for alle bak Renders proxy);
  Neon-branch-tørrkjøring av migrasjoner før prod i `auto-migrate-on-push.yml`
  (`backend/scripts/neon-branch-dry-run.sh`; hoppes over til `NEON_API_KEY`/`NEON_PROJECT_ID` er lagt inn;
  evidens `docs/evidence/2026-09-neon-branch-migration-dry-run.yaml`); perf-vakt
  `shared/narrative-runtime/perf.test.ts` (2 000 elementer / ~3 000 koblinger: validering og 300 valg
  under 1,5 s).
- **8b Manusimport (LEVERT):** Word/PDF/Markdown/tekst → scener og replikker med dry-run-diff
  (ny / endret / uendret / mangler i dokumentet); ingenting slettes — det som mangler blir åpne
  spørsmål (`kind = check`); kilderegisteret får SHA-256 og verifisert-stempel; taler matches mot
  karakterer. Parser + diff er ren TS (`narrative-document-import.ts`), skriving i én transaksjon
  gjennom service-funksjonene. Formatkrav i `docs/role-room/STORY_GRAPH_MANUSCRIPT_IMPORT.md`.
  UI: «Importer» i Scener-fanen (`ImportDocumentDialog.tsx`). e2e: `game-scene-import.spec.ts`.
- **8c CI-bevis-webhook (LEVERT):** spillbygget setter leveransegater med bevis via HMAC-signert
  webhook (`X-StoryGraph-Signature-256`) + bevis-artefakter (xcresult-zip) til S3 via
  `narrative_assets.storage_key` (ny kind `file`); «bestått» uten bevis avvises også fra CI
  (`setSceneGate`, `checked_by = 'ci:<hookId>'`); Integrasjoner-fane (hooks, hemmelighet vist én gang,
  leveringslogg); «Satt av CI» + «Last ned bevis» på gate-fanen; `post-gate-evidence.sh` og
  gjenbrukbar workflow `story-graph-gate-evidence.yml` for spill-repoet. Handlere montert i `index.ts`
  FØR `express.json()` (rå body). Migrasjon `0643_narrative_ci_hooks.sql`. Docs
  `docs/role-room/STORY_GRAPH_CI_EVIDENCE.md`, evidens `2026-09-story-graph-ci-evidence-webhook.yaml`.
- **8d–8g:** se planen i sesjonsloggen; oppdateres her etter hvert som delene leveres.


## Researchprogram

- Månedlig: sjekk `github.com/arcweave/*` releases (plugin-versjoner, JSON-skjema) og
  `blog.arcweave.com` for modellendringer (som 5.11 skopede variabler). Legg funn i
  `docs/evidence/` med `valid_from`/`valid_to`.
- Brukerintervjuer: 3 norske indie-studioer + 1 narrativ designer i AAA-outsourcing
  (Fase 2-prioritering: Play Mode vs. eksport først).
- Import-korpus: Arcweaves eksempelprosjekter (unity-example, visual-novel-example,
  godot-example) som gullstandard for tapsfri import/eksport (rundtur-testen i
  `narrative-format.test.ts` speiler unity-eksempelets form; kjør de ekte filene gjennom
  Eksport-fanen ved hver Arcweave-release).
