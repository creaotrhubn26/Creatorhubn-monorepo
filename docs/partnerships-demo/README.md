# Partnership-flyten — demo-opptak

24-sekunders gjennomgang av hele Phase 9 bryå-flyten i demo-modus.
`?demo=1` på alle endepunkter — ingen innlogging kreves.

## Video

[`partnerships-demo.mp4`](partnerships-demo.mp4) — 1280×648, 30 fps, 8 frames á 3 sek.

## Frames

| # | Skjermbilde | Hva som vises |
|---|---|---|
| 1 | [01-oversikt.png](01-oversikt.png) | **Oversikt-fanen** med KPI-er: 1 aktiv partnership, 1 prosjekt-invitasjon, 1 talent-forslag, 10 talenter i pool. Status-badge "Aktiv". |
| 2 | [02-tilgjengelighet.png](02-tilgjengelighet.png) | **Tilgjengelighets-fanen** med progress-stigen (profil ✓, vilkår ✓, discoverability på ✓). Pause + Stenge-handlinger. |
| 3 | [03-innkommende.png](03-innkommende.png) | **Innkommende-fanen** med TROLL-prosjektet aksepterert + "Foreslå talenter"-knapp. |
| 4 | [04-foresla-talenter-modal.png](04-foresla-talenter-modal.png) | **ProposeTalentsDialog** med Stella-registret (10 talenter). Elias merket "Allerede foreslått". |
| 5 | [05-bulk-select.png](05-bulk-select.png) | **Bulk multi-select**: 3 valgte talenter, bulk-bar med "Foreslå alle valgte"-knapp. |
| 6 | [06-mine-forslag.png](06-mine-forslag.png) | **Mine forslag-fanen** i ProposeTalentsDialog. |
| 7 | [07-mine-partnerships.png](07-mine-partnerships.png) | **Mine partnerships-fanen** med Daniels produksjon (Aktiv-status). |
| 8 | [08-talent-registry-stella-context.png](08-talent-registry-stella-context.png) | **Talent-registry i Stella-kontekst** (via produksjonsteam-eier åpner søkeknappen). Header viser "Stella Casting — talent-register". |

## Demo-URLer

```
/talents/partnerships?demo=1
/talents/registry?demo=1&agency_type=stella_casting&agency_id=a2222222-2222-2222-2222-2222222222a2
```

## Slik regenererer du

```bash
# 1. Naviger til hver flate i Playwright/Chrome med ?demo=1
# 2. Ta screenshot per flate (siktes til 1728×874 viewport)
# 3. Sett sammen til MP4:
ffmpeg -framerate 1/3 -pattern_type glob -i 'docs/partnerships-demo/*.png' \
  -c:v libx264 -pix_fmt yuv420p -vf "scale=1280:-2" -r 30 \
  docs/partnerships-demo/partnerships-demo.mp4
```

## Tekniske detaljer

- **Demo-modus**: ?demo=1 på alle endepunkter, demo-user (99999...) koblet til Stella demo-agency via migrate 227
- **Demo-fixture**: 1 partnership (accepted) + 1 prosjekt-invitasjon (accepted) + 1 talent-forslag (pending) — alle satt opp via direkte SQL for E2E-verifisering
- **Phase 9-stack**: PR-ene #95 → #164 leverer hele flyten
