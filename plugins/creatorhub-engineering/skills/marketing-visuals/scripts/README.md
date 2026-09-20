# Skript — marketing-visuals

Fire skript. De tre siste henger sammen og kjøres i rekkefølge.

Alle leser og skriver i en arbeidsmappe, satt med `LEADGRID_WORK`
(standard: der du står). Mappa må inneholde:

```
assets/   app-skjermbilder + logo, kopiert FLATT fra
          frontend/client/public/leadgrid/app/ og hero/ (ikke mappestrukturen)
fonts/    woff2 lastet ned av render-posters.py
```

`export_layers.py` stopper med en liste over hva som mangler før den rendrer
noe som helst. Det er ikke pedanteri: Chromium avslutter med kode 0 etter å ha
tegnet en ødelagt-bilde-placeholder, og E2E-en nedstrøms tester det bakte laget
— ikke kilden — så en manglende fil ville ellers passert som en stille korrupt
post.

**`person-*.jpg` ligger ikke i repoet.** De tre foto-postene bruker lisensierte
stockbilder. Legg inn egne med samme filnavn, eller fjern de foto-baserte
postene fra `poster_series.py`.

Chromium finnes automatisk: `CHROMIUM_PATH` først, så hvilken som helst
Playwright-revisjon under `/opt/pw-browsers`, så `PATH`.

## `render-posters.py` — frittstående

Rendrer 1080×1080-poster rett til PNG med headless Chromium. Laster ned
skriftene selv. Kjør den for en rask serie uten Mockup Studio.

```bash
python3 render-posters.py --out ./out --assets ../../../../frontend/client/public/leadgrid
```

## Kjeden: poster → lag → Mockup Studio-prosjekter

```bash
export LEADGRID_WORK=$PWD/arbeid
python3 export_layers.py          # klipper ut detaljlagene + graderte fotobakgrunner
python3 make_mockup_projects.py   # bygger ett MockupDoc per post, med lagene bakt inn
```

- **`poster_series.py`** — datatabellen: én `dict` per post med crop-boks,
  overskrift, ingress, CTA og layoutvariant. Rediger denne for å endre serien.
  Kan også kjøres alene for å skrive HTML-ene som PNG-versjonen rendres fra.
- **`export_layers.py`** — `frame_box()` bestemmer boksen hver detalj skal stå
  i, og laget eksporteres i nøyaktig den størrelsen. Det er ikke pynt: hvis
  laget har et annet sideforhold enn boksen, beskjærer Mockup Studios
  `fit:cover` kantene.
- **`make_mockup_projects.py`** — skriver prosjektene til `mockups/`.

## Etterpå: verifiser

Prosjektene skal gjennom E2E-en før de leveres:

```bash
cd apps/resolve-script-manager
npm install && npm run build -- --configLoader runner
npm run e2e:leadgrid-posters -- --dir $LEADGRID_WORK/mockups
```

Den laster hvert prosjekt i en ekte nettleser, sjekker at lagene overlever og
at lerretet males, og legger bevisbilder i
`docs/role-room/e2e-evidence/leadgrid-posters/`. Skjemavalidering alene fanger
ikke beskjæringsfeil — det gjør bildene.
