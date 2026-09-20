---
name: marketing-visuals
description: Produce publish-ready marketing images (Instagram/LinkedIn posts, hero/campaign visuals, app-store shots) for CreatorHub products — Leadgrid, The Role Room, Post Agent — by compositing REAL app screenshots and brand assets from the repo and rendering them to exact-size PNG with headless Chromium. Use when asked for social posts, kampanjebilder, postbilder, annonser, or any branded image deliverable. Covers asset inventory, brand tokens, the render pipeline, Adobe Stock/Express constraints, and the review checklist.
---

# Marketing-visuals — Creatorhubn-monorepo

Lag ekte, publiseringsklare bilder — ikke mockups og ikke CSS-tegnede
placeholdere. Regelen som avgjør kvaliteten: **innholdet skal være produktet**.
Ekte app-skjermbilder fra repoet, ekte logo, ekte farger. Genererte «illustrasjoner»
og generisk stockfoto av folk med mobiler ser billig ut og blir avvist.

## 1. Finn assets før du designer

Alt ligger committet. Aldri bygg et UI-mockup selv når et skjermbilde finnes.

| Hva | Sti |
|---|---|
| Leadgrid app-skjermbilder (**ekte app**) | `frontend/client/public/leadgrid/app/` — `kart`, `leads`, `oversikt`, `moter`, `team`, `salgsledelse`, `leadbook`, `kvalitet`, `kjorebok`, `dorsalg`, `login` (`.png` + `.webp`) |
| Device-innrammet hero-shot | `frontend/client/public/leadgrid/hero/` — `ipad.png` (950×727, RGBA), `iphone.png` (248×520), `macbook.png` |
| Offisiell logo | `frontend/client/public/leadgrid/logo.png` (512×512, RGBA) |
| Offisiell lockup + tagline (fasit på hvordan logoen settes) | `frontend/client/public/leadgrid/og-image.png` |
| Tomme device-rammer til compositing | `leadgrid/device-ipad.png`, `device-iphone.png`, `device-macbook.png` |
| Video-stills (frame-grab med ffmpeg) | `leadgrid/app/tour-*.mp4` + `tour-*-poster.webp` |
| Produkt-/modulbeskrivelser, målgruppe, differensiering | `frontend/client/public/leadgrid-llms.txt` |
| Planer og moduler | `frontend/shared/leadgridPricingConfig.ts` |

`leadgrid/scenes/` er fal.ai-genererte scener — unngå dem når kravet er «ekte app».

**Merk:** skjermbildene er iPad-opptak i to orienteringer — 930×1240 (portrett:
kart, leads, oversikt, moter, team, salgsledelse, leadbook) og 1240×930 (landskap:
dorsalg, kjorebok, kvalitet). Noen er kuttet i kanten allerede i kilden
(`salgsledelse` høyre, `kvalitet` bunn) — beskjær innenfor.

## 2. Merkevare-tokens

Hentet fra `frontend/client/src/pages/leadgrid-landing.tsx` (`PALETTE`) — ikke gjett:

```
bg #0b0518 · bgAlt #13082b · deep #050211
accent #A78BFA · accentBright #C084FC · tekst #F4F0FF · dempet #B9AEDB
```

Lockup: `logo.png` + ordet «Leadgrid» i hvitt, ett vektsnitt (ikke to-farget).
Tagline i sperret versal: «FLERE MULIGHETER. FLERE KUNDER.»

Typografi som fungerer: **Sora** 700/800 (display) + **Manrope** 500/600 (brødtekst),
**Caveat** til håndskrift-aksenter. Google Fonts er nåbart fra sesjonen — last ned
woff2 og referer lokalt (se §3), for containeren har kun DejaVu/Liberation installert.

## 3. Render-pipeline (det som faktisk virker)

Bygg HTML på 1080×1080 og skyt med headless Chromium. Ingen npm-install nødvendig.

```bash
# VIKTIG: headless_shell, ikke chrome.
# chrome --window-size=1080,1080 gir viewport 1080x993 -> bunnlinjen klippes.
SB=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
"$SB" --disable-gpu --no-sandbox --hide-scrollbars --force-device-scale-factor=1 \
      --window-size=1080,1080 --virtual-time-budget=6000 \
      --screenshot=out/post.png "file://$PWD/build/post.html"
```

Fonter lastes ned én gang og bakes inn som lokale `@font-face`-URL-er:

```python
# fonts.googleapis.com svarer; hent «latin»-subsettet per vekt
css = get(f"https://fonts.googleapis.com/css2?family={fam}:wght@{w}&display=swap")  # Chrome-UA -> woff2
```

Referanse-implementasjon: `scripts/render-posters.py` i denne skill-mappa.

## 4. Eksterne kilder — hva som er åpent og stengt

| Kilde | Status |
|---|---|
| `fonts.googleapis.com` / `fonts.gstatic.com` | ÅPEN — last ned woff2 |
| Adobe Stock via MCP (`asset_search`) | ÅPEN — men `pricing: "free"`-treff er gratis å lisensiere |
| `stock-apex-images-prod-*.s3.*.amazonaws.com` (etter lisensiering) | ÅPEN — `curl` funker, dette er eneste vei til selve fila |
| `t3/t4.ftcdn.net` (stock-thumbnails) | **STENGT** — proxy 403. Du kan ikke se et stockbilde før du har lisensiert det |
| `photoshop-api.adobe.io` (output fra `image_crop_and_resize`) | **STENGT** for nedlasting — beskjær heller med CSS |
| `asset_inline_preview` | Kun på Adobe-hoster → lisensier først, forhåndsvis etterpå |
| Generativ bildegenerering | **IKKE TILGJENGELIG** i dette miljøet — si det rett ut i stedet for å love det |
| `export_html_to_express` | Har feilet vedvarende (også på tom test-HTML). Ikke bygg leveransen på den; render lokalt |

Ingen PIL/ImageMagick i containeren. All beskjæring og skalering gjøres i CSS
(`overflow:hidden` + absolutt plassert `<img>` med `width`/`left`/`top`).

## 5. Komposisjonsoppskrift

Serie-posten (modul-post):

- Bunn: `radial-gradient` lilla glød øverst høyre + `linear-gradient` mørk base.
- Skjermbildet i et «flytende kort»: `border-radius:22px`, tynn `#C084FC`-kant,
  `box-shadow:0 44px 90px rgba(0,0,0,.72)`, `transform:perspective(1800px)
  rotateY(-13deg) rotateX(2deg)`, lilla glød bak, og la det blø ut av høyre kant.
- Tekstkolonne til venstre: lockup → eyebrow-pille → H1 → ingress → footer-linje.
- Scrim nederst så footer-teksten leser mot skjermbildet.

Hero/kampanje-posten legger på: lisensiert fotoscene i bunn, device med
kontaktskygge så den står på bordet, håndskrift-aksent med SVG-swash, og CTA-pille.
Grading av fotoet: hold `brightness` rundt `.95` og violett `mix-blend-mode:color`
på **~.34 opacity** — legger du mer på, forsvinner scenen til grøt og hele poenget
med fotoet er borte.

## 6. Tekst

Skriv som et menneske, ikke som en kampanje. Start i en situasjon leseren kjenner
(«Mandag morgen. Hvem ringer du først?»), ikke i en funksjonsliste. Korte setninger,
norske hverdagsord, ingen tre-ledds-remser, ingen «sømløs/kraftig/revolusjonerende».

Faktasjekk før publisering:

- **Ingen priser i bildene.** Prisene i `leadgridPricingConfig.ts` er seed-verdier
  som super-admin kan overstyre i runtime.
- Tall i skjermbildene er **demodata** (Nordic Elektro AS, Espen Berg, 1 248 leads).
  Bruk dem som illustrasjon — aldri som kundecase eller resultatpåstand.
- Modulnavn og beskrivelser hentes fra `leadgrid-llms.txt`. «Leadbook/Pondus» og
  premie-/provisjonsverktøyene er IKKE beskrevet der — beskriv dem fra skjermbildet.

## 7. Sjekkliste før levering

Se på hver rendrede PNG. Disse fire feilene kommer igjen og igjen:

1. **Bunnlinjen klippet** → du brukte `chrome` i stedet for `headless_shell`.
2. **Overskrift som treffer kortet** → sett `h1{max-width}` mindre enn kortets
   venstrekant, og kort ned linjer over ~16 tegn ved 56px.
3. **Beskjæring midt i et UI-element** → flytt `img left/top` til en elementkant;
   et halvt bord eller en avkuttet etikett ser ut som en feil.
4. **Feil logo** → `logo.png` fra repoet, aldri en egentegnet pin.

Lever som faktiske filer (`SendUserFile`) + én artefakt-side med bildetekster for
Instagram og LinkedIn per post.

## 8. Kjente hull og hva som bør forbedres

Dette er ikke ferdig. Ta tak i punktene når oppgaven gir anledning:

**Format og rekkevidde**
- Malen lager kun 1:1 (1080×1080). **4:5 (1080×1350) tar mer plass i feeden**
  på både Instagram og LinkedIn og bør bli standard — malen trenger bare
  variabel `--canvas-h` og justerte y-posisjoner.
- Story/Reels 1080×1920 og carousel (flere slides med felles tekstlogikk)
  finnes ikke ennå.
- `leadgrid/app/tour-*.mp4` er ubrukt. `ffmpeg` følger med Playwright-installasjonen
  (`/opt/pw-browsers/ffmpeg-1011/`) — en kort video med samme tekstoverlegg er
  lavthengende frukt for Reels.

**Scene og compositing**
- Hero-posten bruker et tomt stock-bord. Referansematerialet fra kunden har
  rekvisitter (notatbok med preget logo, penn, plante) som gjør scenen rikere.
  To veier: finn stockfoto med rekvisittene, eller komponer inn en notatbok og
  preg `logo.png` med `mix-blend-mode:overlay` + lav opacity.
- Device-en plasseres med håndtunede `rotateY/rotateX`-verdier. En
  4-punkts homografi (`matrix3d`) mot skjermhjørnene i et ekte foto ville
  gitt riktigere perspektiv — krever at man løser et 8×8-system i Python.

**Innhold**
- Alle tall i bildene er demodata. Ett ekte kundecase med reelle tall ville
  vært sterkere enn ti poster med Nordic Elektro AS.
- Merkevaren har **to konkurrerende tagline-er** i omløp: «Operativsystemet for
  feltsalg» (`og-image.png`) og «Flere muligheter. Flere kunder.» (kundens
  referansebilde). Bør avklares med Daniel og skrives ned ett sted.
- Ingen offisiell typografi er definert i repoet. Sora + Manrope er mitt valg,
  ikke en beslutning. Legg det i en `docs/evidence/`-fil når det bestemmes.
- `leadgridPricingConfig.ts` sier «alle tre feltsalg-modulene» i bundelen, men
  det finnes fire aktive moduler. Internt avvik — ikke siter bundelen før det
  er ryddet.

**Automatisering**
- `scripts/render-posters.py` har posten-dataene inline. Neste steg er å flytte
  dem til en `posts.json` slik at en post kan legges til uten å røre koden.
- Ingen automatisk QA på output. En sjekk som verifiserer eksakt 1080×1080 og
  at tekstkolonnen ikke overlapper kortets bounding box ville fanget tre av de
  fire feilene i §7 uten menneskeøye.
- Hvis `export_html_to_express` blir friskt igjen: samme HTML kan gi et
  redigerbart Express-dokument, slik at markedsavdelingen kan endre tekst selv.

## Prinsipper

- Ekte app-innhold slår enhver illustrasjon. Finn skjermbildet før du tegner noe.
- Si fra om hva som ikke er mulig (generativt bilde, Express-eksport) i stedet for
  å levere en svakere erstatning uten å nevne det.
- Render → se på bildet → rett → render igjen. Aldri lever et bilde du ikke har sett.
