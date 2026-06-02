# Partnership-flyten — demo-opptak (v3 med Phase 9.13)

15-sekunders gjennomgang av bryå-flyten i demo-modus etter Phase 9.13
UX-forbedringer.

## Video

[`partnerships-demo.mp4`](partnerships-demo.mp4) — 1280×648, 30 fps, 5 frames á 3 sek (200 KB).

## Frames

| # | Skjermbilde | Hva som vises |
|---|---|---|
| 1 | [01-oversikt.png](01-oversikt.png) | **Oversikt-fanen** med ALLE Phase 9.10–9.13 forbedringer: demo-banner, "Hva nå?"-kort (lilla gradient), smart-varselbar (gul), klikkbare KPI-er, mini-sparklines (14d), per-prosjekt-progress-strip (TROLL 100%), siste aktivitet-feed med 6 entries |
| 2 | [02-tilgjengelighet.png](02-tilgjengelighet.png) | **Tilgjengelighets-fanen** med progress-stigen + pause/steng-handlinger |
| 3 | [03-mine-partnerships.png](03-mine-partnerships.png) | **Mine partnerships-fanen** med Daniels produksjon (Aktiv-status) |
| 4 | [04-innkommende.png](04-innkommende.png) | **Innkommende-fanen** med "Venter på svar" (Dokumentarprosjekt) og "Aktive prosjekter" (TROLL) — den nye 2-seksjons-strukturen |
| 5 | [05-talent-registry-stella.png](05-talent-registry-stella.png) | **Talent-registry i Stella-kontekst** med pravatar-portretter + **ekte dynamisk sparkline** (Register-oversikt) som leser fra `/agency/registry-overview` |

## Demo-URLer

```
/talents/partnerships?demo=1
/talents/registry?demo=1&agency_type=stella_casting&agency_id=a2222222-2222-2222-2222-2222222222a2
```

## Hva er nytt i v3 (vs v2)

| Endring | PR |
|---|---|
| Demo-banner med ScienceOutlinedIcon | #190 |
| Stavefiks "Bryå" → "Byrå" (4 filer, 30+ steder) | #190 |
| Større avatarer (44→52px) + grønn "Foreslått"-chip | #190 |
| Ingrid Nilsen portrett | #191 |
| Skeleton-loading istedenfor spinner | #191 |
| Empty state-illustrasjoner | #191 |
| **"Hva nå?"-kort** med smart neste-handling | #198 |
| **Klikkbare KPI-er** + hover-animasjon | #198 |
| **Tooltips** på alle KPI-er | #198 |
| **Mini-sparklines** (14d trend) | #199 |
| **Per-prosjekt-progress-strip** med gradient-bar | #199 |
| **Smart-varselbar** for utløp innen 7d | #199 |
| **Ekte sparkline** i Register-oversikt (var fake mock før) | #201 |

## Demo-fixture-data
- Stella Casting demo-byrå
- 1 akseptert partnership (Daniels produksjon)
- 1 akseptert prosjekt-invitasjon (TROLL, utløper om 5d)
- 1 pending prosjekt-invitasjon (Dokumentar, utløper om 3d) — trigger smart-varsel
- 1 akseptert talent-forslag (Elias Berg) — akseptrate 100%
- 6 audit-entries — viser "Siste aktivitet"-feeden
- 10 talenter i pool med pravatar.cc-headshots

## Slik regenererer du

```bash
ffmpeg -framerate 1/3 -pattern_type glob -i 'docs/partnerships-demo/*.png' \
  -c:v libx264 -pix_fmt yuv420p -vf "scale=1280:-2" -r 30 \
  docs/partnerships-demo/partnerships-demo.mp4
```
