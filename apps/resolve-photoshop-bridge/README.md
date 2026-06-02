# Resolve ↔ Photoshop edit-bro

Filsystem-basert bro mellom DaVinci Resolve og Post Agent's Photoshop-integrasjon. Lar deg:

1. **Eksportere still fra Resolve** ved playhead → `~/PostAgent/inbox/`
2. **Touche opp i Photoshop** via Post Agent (alle 19 UXP-kommandoer tilgjengelig)
3. **Importere tilbake til Resolve** Media Pool → manuell drag-to-timeline

## Installasjon

Kopier Lua-scriptene til Resolve sin scripts-folder:

```bash
SCRIPTS_DIR="$HOME/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Scripts/Edit"
cp scripts/export-still-to-postagent.lua "$SCRIPTS_DIR/"
cp scripts/insert-from-postagent.lua "$SCRIPTS_DIR/"
```

I Resolve: `Workspace → Scripts → Edit → [scriptnavn]` — to nye menypunkter.

## Bruksflyt

**Resolve → Photoshop:**

1. Plasser playhead på frame du vil retusjere
2. `Workspace → Scripts → Edit → export-still-to-postagent`
3. Stillen havner i `~/PostAgent/inbox/<epoch>_<prosjekt>_<frame>.png` + metadata `.json`
4. I Post Agent — be Claude "åpne det jeg sendte fra Resolve" → den kjører `photoshop_resolve_open_latest`

**Photoshop → Resolve:**

1. Når du er ferdig i Photoshop, be Claude "send det tilbake til Resolve"
2. Claude kaller `photoshop_resolve_export_back` → fil lagres i `~/PostAgent/outbox/`
3. I Resolve: `Workspace → Scripts → Edit → insert-from-postagent` → fil importeres til Media Pool
4. Drag fra Media Pool til timeline manuelt

## Hvorfor manuell timeline-insert?

Resolve sin scripting-API for `InsertGeneratorIntoTimeline` / `AppendIntoTimeline` er knotete med stills. Auto-insert ville krevd nullstilling av playhead, og det kan crasher edit-flyten. Brukeren har bedre kontroll med drag.

## Plugin-kommandoer (Post Agent)

| Kommando | Tool-navn |
|----------|-----------|
| `resolve.listInbox` | `photoshop_resolve_list_inbox` |
| `resolve.openLatest` | `photoshop_resolve_open_latest` |
| `resolve.exportBack` | `photoshop_resolve_export_back` |

## Arkitektur-valg

Filsystem som transport (ikke WebSocket) fordi:
- Resolve Lua-scripting har ikke native HTTP/WS-klient
- Filer er asynkrone: Resolve kan eksportere → Post Agent kan plukke når den vil
- Resolve-scripts kan kjøres når Post Agent er lukket
- Backup/audit-trail bygges naturlig (outbox/.archive/)

`metadata.json`-sidefilen bevarer clip-navn + frame + fps + prosjekt så Photoshop-side vet kontekst (brukes av Firefly-prompts og AI Creative Director).
