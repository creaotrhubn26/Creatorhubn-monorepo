# Claude × Blender Bridge — fase 1 (fundament + kjerneverktøy)

**Dato:** 2026-08-10. Kilde: `~/Desktop/claude_blender_ai_architecture.md` (Daniels
arkitekturdokument). Presedens i repoet: Post Agent↔Photoshop-broen (semantiske
verktøy over WS, ikke exec(code)) + Role Room MCP (register-drevet tool-katalog).

## Mål fase 1

Bevis loopen **Observe → Execute → Render → Inspect** mot ekte Blender (5.2 LTS
lokalt), med semantiske verktøy — IKKE `execute_python()` (dokumentets §4).

## Arkitektur

```
Claude (MCP-klient)
   │ stdio JSON-RPC
mcp/blender_mcp_server.py      ← håndrullet, null deps (Role Room-mønsteret)
   │ HTTP localhost:7717        (IKKE 8765 — higgsfield-squatter-fella)
extension/server.py             ← http.server i tråd + kommando-KØ
   │ bpy.app.timers             (dokumentets §10: aldri bpy fra nettverkstråd)
extension/core.py               ← observer + executor, ren bpy, importerbar headless
   │
Blender
```

`apps/blender-bridge/` med `extension/` (Blender Extension, manifest 4.2+),
`mcp/`, `tests/headless_selftest.py`, `skills/blender-core/SKILL.md`, README.

## Verktøykatalog fase 1 (register-drevet — én kilde for HTTP + MCP)

get_scene · get_selection · inspect_object · create_object (cube/sphere/
cylinder/plane/empty) · delete_object · set_transform · create_material ·
set_material_parameter (Principled-input ved navn) · assign_material ·
create_light (POINT/SUN/SPOT/AREA) · configure_light · create_camera ·
point_camera_at · configure_camera (focal/DOF) · render_preview (EEVEE,
res-param, PNG til fil) · undo_push/undo (AI-transaksjon = undo-gruppe) ·
validate_scene (enkel QA: tellinger, unapplied scale, manglende teksturer)

## Sikkerhet fase 1

Kun localhost-binding; ingen exec av vilkårlig Python; delete_object er eneste
destruktive verktøy (dokumentets permissions-nivåer kommer i fase 5 — noteres i
README). Undo-push før hver muterende operasjon.

## Verifisering

`blender --background --python tests/headless_selftest.py` mot ekte Blender:
scene-ops, materiale, lys, kamera, render 128px (fil eksisterer + >0 bytes),
undo ruller tilbake, validate_scene rapporterer. + MCP-røyk: start Blender m/
extension, kall tools/list + get_scene + render_preview via stdio-serveren.

## Ikke i fase 1

Vision-korreksjonssløyfe (fase 3), scene-resources/blender:// (fase 2),
permissions-UI/hooks (fase 5), subagents (fase 6), Geometry Nodes,
skills-biblioteket utover blender-core (fase 4).
