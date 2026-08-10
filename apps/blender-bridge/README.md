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

## Verktøy (19)

Observer: `get_scene` `get_selection` `inspect_object` `validate_scene`
Executor: `create_object` `delete_object` `set_transform` `create_material`
`set_material_parameter` `assign_material` `create_light` `configure_light`
`create_camera` `point_camera_at` `configure_camera` `render_preview`
`render_final` `undo_push` `undo`

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

## Skills-biblioteket (fase 3–4)

`skills/` — last inn i Claude (kopier/symlink til `.claude/skills/` eller
pek plugin dit): `blender-core` (loopen + sikkerhet), `blender-scene-inspector`
(read-only vurdering), `blender-lighting` (visuell korreksjonssløyfe),
`blender-materials` (PBR-verdier), `blender-camera` (brennvidde/DOF/komposisjon),
`blender-product-render` (orkestrering), `blender-scene-qa` (aldri «done» uten).

## Ikke enda (kommer)

Permissions-nivåer/hooks (delete er eneste destruktive verktøy nå — undo-steg
pushes før hver mutasjon), Geometry Nodes, subagents, stil-skills
(apple-product, automotive, …).
