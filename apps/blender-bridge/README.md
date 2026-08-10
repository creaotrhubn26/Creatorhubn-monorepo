# Claude × Blender Bridge

Semantisk AI-bro mellom Claude og Blender — fase 1 av arkitekturen i
`docs/specs/2026-08-10-blender-bridge-fase1-design.md` (basert på Daniels
arkitekturdokument). Claude opererer Blender gjennom **kontrollerte,
semantiske verktøy** — aldri `exec()` av vilkårlig Python.

```
Claude (MCP) → mcp/blender_mcp_server.py → HTTP :7717 → kommando-kø
             → bpy.app.timers (main thread) → extension/core.py → bpy
```

## Oppsett

1. **Installer extensionen**: Blender → Edit → Preferences → Add-ons →
   Install from Disk → pek på `extension/`-mappen (eller symlink den inn i
   Blenders extensions-katalog). Aktiver «Claude Bridge». N-panelet «Claude»
   viser bro-adressen.
2. **Koble Claude Code**:
   ```bash
   claude mcp add blender -- python3 "$(pwd)/apps/blender-bridge/mcp/blender_mcp_server.py"
   ```
3. Blender må kjøre med extensionen aktiv når verktøyene brukes.

## Verktøy (27)

Observer: `get_scene` `get_selection` `inspect_object` `validate_scene`
Executor: `create_object` `delete_object` `set_transform` `create_material`
`set_material_parameter` `assign_material` `create_light` `configure_light`
`create_camera` `point_camera_at` `configure_camera` `render_preview`
`render_final` `undo_push` `undo`
Geometry Nodes: `create_geometry_nodes` `gn_add_node` `gn_connect`
`gn_set_input` `gn_expose_parameter` `gn_set_parameter` `gn_get_graph`
`gn_evaluated_stats`

Katalogen bor i `extension/core.py` (`TOOLS`) — én kilde for både HTTP
(`GET /tools`) og MCP `tools/list`.

## Scene-resources (fase 2)

Blender-tilstanden er adresserbar som MCP-resources — hent KUN den delen av
scene-grafen som er relevant: `blender://scene` `blender://selection`
`blender://context` `blender://render/settings` `blender://object/<navn>`
`blender://material/<navn>` `blender://camera/<navn>` `blender://collection/<navn>`.
HTTP: `GET /resources` + `GET /resource?uri=…`. Katalog + resolver i
`extension/resources.py`.

## Vision-loopen

`render_preview` skriver PNG til fil og returnerer stien — Claude leser bildet,
inspiserer visuelt, og korrigerer med nye verktøykall (Observe → Execute →
Render → Inspect).

## Testing

```bash
# kjerneverktøyene mot ekte bpy (CI-bart):
blender --background --python apps/blender-bridge/tests/headless_selftest.py

# broen headless (for E2E/curl):
blender --background --python apps/blender-bridge/tests/run_headless_server.py
curl http://127.0.0.1:7717/health
```

## Permissions (fase 5)

Hvert verktøy har nivå: **safe** (kjøres alltid) · **modify** (kjøres når
«Auto-godkjenn endringer» er PÅ i N-panelet — default) · **destructive**
(krever ALLTID klikk i panelet; kan ikke godkjennes over HTTP — agenten kan
ikke godkjenne seg selv). Gated kall returnerer `approval_id`; Claude poller
med `check_approval`. Panelet viser ventende godkjenninger + operasjonslogg.
`render_final` leverer alltid `qa` (validate_scene) i resultatet.
Headless CI: `BRIDGE_AUTO_APPROVE=1` (settes av mennesket som starter prosessen).

## Skills-biblioteket (fase 3–4)

`skills/` — last inn i Claude (kopier/symlink til `.claude/skills/` eller
pek plugin dit): `blender-core` (loopen + sikkerhet), `blender-scene-inspector`
(read-only vurdering), `blender-lighting` (visuell korreksjonssløyfe),
`blender-materials` (PBR-verdier), `blender-camera` (brennvidde/DOF/komposisjon),
`blender-product-render` (orkestrering), `blender-scene-qa` (aldri «done» uten).

## Ikke enda (kommer)

Subagents, stil-skills (apple-product, automotive, …),
«Angre hele AI-oppgaven»-knapp (undo-steg pushes per mutasjon i dag).
