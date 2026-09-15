# The Role Room — Story Graph (spillstudio)

Arbeidsnavn **Story Graph**. Vertikal `game_studio` i The Role Room, beta bak
`?mode=game_studio`. Kodemappe `frontend/client/src/components/role-room/narrative/`,
backend `backend/server/role-room-narrative-*.ts`, tabellprefiks `narrative_*`
(migrasjon `0605_role_room_narrative_graph.sql`).

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
- Datamodell 1:1 med Arcweaves JSON (migrasjon 0605), prosjekt-skopet under
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
  (migrasjon `0606_ai_suggestions_narrative_source_type.sql`); «Foreslå med KI» i element-skuffen
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
- **Lokalisering / Translation Mode** (migrasjon 0607, `narrative-format/locale.ts`): in-row
  `i18n`-JSONB på elementer/koblinger/innstillinger, `nb` kanonisk, kodeblokker oversettes aldri
  (`mergeCodeBlocks`). Fane «Oversettelser» med KI-forslag (`narrative-translate.ts`, statsløst),
  locale-velger i Play Mode, `?locale=` på `/story/:token`, locale på alle eksporter.
- **Sanntids-markører + presence** (`websocket-chat.ts` rom `narrative:<projectId>`): avatarer,
  markører på lerretet, valg-ring i kollegaens farge, `narrative:graph_changed`-push etter
  mutasjoner → debounced reload. Ingen CRDT.
- **Lansering**: landingskort «Spillstudio — Story Graph» (beta), login-persona med rollekort
  Spillstudio/Narrativ designer → `?mode=game_studio`, `?signup=game_studio`.
- **Billing** (migrasjon 0608, `game-billing-*`, `game-plan-gate.ts`, `role-room/game/`): planer
  Solo (gratis) / Pro / Studio (plassholderpriser, admin-redigerbare), Stripe checkout/portal/
  webhook, tester-invites. Gating på prosjekteierens plan: delingslenker, spillbar HTML,
  KI-forslag, oversettelser, Twine/Ink-import, elementgrense (402 `plan_required`/`plan_limit`).
- **Runtime-pakker** (`packages/story-graph-runtime/`): JS-pakke med full motor (bygget fra
  `shared/narrative-runtime-pkg`, paritetstest), Unity C# og Godot 4 GDScript for et dokumentert
  arcscript-delsett, felles transkript-format + fixture for manuell paritetssjekk (CHECKLIST.md).
- Ikke gjort (bevisst): `@xyflow/react` v12 (bruker valgte «kun runtime-pakker»), realtime-gating,
  PDF/CSV-eksport, embed-kode.

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
