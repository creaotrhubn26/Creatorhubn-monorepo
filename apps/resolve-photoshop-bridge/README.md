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

**Photoshop → Resolve (auto-replace):**

1. Når du er ferdig i Photoshop, be Claude "send det tilbake til Resolve"
2. Claude kaller `photoshop_resolve_export_back` → fil + metadata-sidefil lagres i `~/PostAgent/outbox/`
3. I Resolve: `Workspace → Scripts → Edit → insert-from-postagent`

**Hva som skjer:**
- Hvis metadata-sidefilen har clip-info (eksportert fra timeline-still), kaller scriptet `MediaPoolItem:ReplaceClip(...)` på det ORIGINALE klippet. Timeline-klippet oppdaterer source automatisk — ingen drag nødvendig.
- Hvis ingen clip-info finnes (stand-alone-eksport eller original-clip slettet), faller scriptet tilbake til vanlig `ImportMedia` → ny media-item i Media Pool → drag manuelt.

## Tier 2: kontinuerlig watch-modus

`watch-outbox.lua` poller `~/PostAgent/outbox/` hvert 2 sekund og auto-trigger insert-logikken når nye filer dukker opp. Slipper å kjøre `insert-from-postagent` manuelt:

1. `Workspace → Scripts → Edit → watch-outbox`
2. Scriptet kjører til du stopper Resolve (eller manuelt avbryter)
3. Photoshop-eksporter blir auto-replaced/imported i sanntid

Begrensninger: hvis Resolve crasher må du restarte scriptet. Krever lokal disk (ikke nettverks-sync som kan ha sen mtime-oppdatering).

## Auto-replace-begrensninger

- Original MediaPoolItem må fortsatt eksistere (ikke slettet fra Media Pool)
- Hvis Photoshop endrer dimensjoner radikalt, kan timeline-klippets in/out-points bli forskjøvet
- Filformat: PNG er sikrest (TIFF og JPG også OK, PSD avhenger av Resolve-versjon)

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
