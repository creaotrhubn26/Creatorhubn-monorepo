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

### Fase 2 — Skript, forgreninger og Play Mode
`frontend/shared/narrative-script/` (arcscript-kompatibel lexer/parser/evaluator, ren TS,
delt med backend) og `frontend/shared/narrative-runtime/` (tilstand, visits, evaluering av
forgreninger, jumpere). `NarrativePlayPanel` med debugger, restart og TTS per karakter
(voice-mapping fra `TableReadPanel`). Tiptap-mention for `@komponent` / `#brett`.

### Fase 3 — Interop, deling, AI, MCP-skriving
Arcweave-JSON-eksport/-import (`frontend/shared/narrative-format/`), Markdown-eksport,
`narrative_share_links` + offentlig `/play/:token` med inlinet runtime (mønster
`role-room-review-routes.ts` og `demoStudioExports.ts`), `ai-narrative-element-agent.ts`
(generer/forbedre element i karakterens stemme), MCP `rr_draft_element` (utkast-invariant).

### Fase 4 — Forbi Arcweave
Sanntids-markører (socket.io; `yjs@13` ligger ubrukt i backend), lokalisering med
Translation Mode, Twine (`.twee`) og Ink-import, egne runtime-pakker for Unity/Godot,
Stripe-tier, login-persona og landingsside-kort, `@xyflow/react` v12.

## Researchprogram

- Månedlig: sjekk `github.com/arcweave/*` releases (plugin-versjoner, JSON-skjema) og
  `blog.arcweave.com` for modellendringer (som 5.11 skopede variabler). Legg funn i
  `docs/evidence/` med `valid_from`/`valid_to`.
- Brukerintervjuer: 3 norske indie-studioer + 1 narrativ designer i AAA-outsourcing
  (Fase 2-prioritering: Play Mode vs. eksport først).
- Import-korpus: Arcweaves eksempelprosjekter (unity-example, visual-novel-example,
  godot-example) som gullstandard for tapsfri import/eksport i Fase 3.
