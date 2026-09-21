# Story Graph — UX QA (september 2026)

**Dato:** 2026-09-21 · **Omfang:** hele Story Graph (game_studio), scenekortet og review-flyten, landing/login/onboarding · **Miljø:** lokal full stack (Postgres 16 + backend + Vite) med What Follows Us-seeden (34 scener, 38 komponenter, 12 episoder), tre brukere (Studio-eier, Solo-eier, teammedlem) + én prosjektløs bruker · **Viewporter:** 1440×900 og Pixel 5 (393×851) · **Verktøy:** Playwright-harness i scratchpad (ikke committet), axe-core 4.13 (WCAG 2.1 AA), konsoll- og nettverksfangst.

Prod (theroleroom.com) var ikke nåbar fra kjøremiljøet (egress-policy), så gjennomgangen er gjort lokalt på `main` (`888c8770`). Alt som avhenger av eksterne tjenester (Stripe, S3, KI-nøkler, Google Fonts) ble testet som feiltilstander.

## Verdikt

Produktet er funksjonelt komplett og de tunge flytene (review-runder, gjestereview med utdatert-runde-vern, gater med bevis-krav, av-bryter, feil-tilstander) holder. Det som stopper en ny kunde er **inngangen** (ingen registrering, ingen «Nytt prosjekt», villedende prisboks i login) og **mobil** (scenekortet kollapser ikke, hjem er bredere enn skjermen). 36 kuraterte funn: 3 blokkerer, 13 høy, 13 middels, 7 lav. I tillegg 1462 automatiske observasjoner over 201 sidetilstander (oppsummert under).

**Modellvalg:** verdikt og prioritering er gjort med Fable 5.1 (produkt- og produksjonskonsekvens); det mekaniske uttrekket (skjermbilder, axe, konsoll) er skript uten modell.

## Kuraterte funn (prioritert)

| ID | Alvor | Område | Funn | Heuristikk | Fiks | Str. | PR |
|---|---|---|---|---|---|---|---|
| UX-01 | Blokkerer | Onboarding | **Ny spillstudio-bruker uten prosjekt havner i en blindvei** — Etter innlogging som «Spillstudio» får brukeren prosjektvelgeren med teksten «Du har ingen prosjekter ennå. Opprett et prosjekt i produksjonsmodus først, og bytt så tilbake til spillstudio.» Det finnes ingen «Nytt prosjekt»-handling i spillstudio-modus, og produksjonsmodus er en helt annen flate (film). Første-gangs-opplevelsen stopper her. Bevis: `desktop/login/04-after-login-no-project.png`, `mobile/login/04-after-login-no-project.png` | Bruker­kontroll / ingen blindvei | «Nytt prosjekt» i ProjectPicker (navn → POST /api/role-room/projects via narrativeService med role_room_auth_token) → velger prosjektet → første-gangs-hero med «Start fra mal». | M | B |
| UX-02 | Blokkerer | Onboarding | **Spillstudio-brukere kan ikke registrere seg — login-dialogen kjenner bare eksisterende kontoer** — Landingskortet «Spillstudio» → login-dialog → e-post/passord. En ny bruker får «Ugyldig e-post eller passord» (401). Auto-provisjonering finnes bare for produksjons-/innholdsprodusent-persona (og er der bak kommersiell gate). Det finnes altså ingen vei fra landingssiden til en Solo-konto. Bevis: `desktop/login/03-wrong-password.png` | Konsistens / forventning | Backend: tillat provisjonering for loginAs=game_studio (Solo, uten Stripe) i auth-routes; frontend: «Opprett konto»-tekst på knappen når persona er game_studio. | M | C |
| UX-21 | Blokkerer | Scener | **Scenekortet er ubrukelig på mobil: to-kolonne-layouten kollapser ikke** — ScenesPanel har fast 320 px liste + detalj side om side. På 393 px bredde blir scenekortet ~60 px bredt; alle faner, felt og knapper er avkuttet. Bevis: `mobile/scene-p01/overview.png`, `mobile/scenes/list.png` | Mobil layout | Under md: vis liste ELLER kort (kortet som egen visning med «Tilbake til scener»), og la ?scene= styre visningen. | M | C |
| UX-03 | Høy | Login | **Login-dialogen viser «Team og abonnement — Innholdsprodusent-plan 495 kr» for Spillstudio** — requiresCommercialSetup er false for game_studio, men seksjonen «Team og abonnement» med kontoeier/e-post/rolle og prisboksen «INNHOLDSPRODUSENT-PLAN 495 kr per person» rendres likevel. Spillstudio er gratis (Solo) — dette er direkte villedende og ser ut som et betalingskrav. Bevis: `desktop/login/01-dialog-persona.png` | Match med virkeligheten | Skjul seksjonen når !requiresCommercialSetup (samme gren som dance_studio). | S | A |
| UX-04 | Høy | Login | **Rollekortene «Spillstudio» og «Narrativ designer» har avkuttet og speilvendt tekst** — Kortene viser «Spil…»/«Nar…» øverst og en rotert/speilvendt «Spil»/«Nar» nederst ved siden av kortnavnet. Kortmalen (video-variant) forventer bilde/video; spillkortene har bare ikon. Bevis: `desktop/login/01-dialog-persona.png` | Estetikk / lesbarhet | Bruk den enkle kortvarianten for game_studio-rollene, eller gi kortene fullt navn uten rotert etikett. | S | A |
| UX-08 | Høy | Skall | **Tre lag med overlegg ved første besøk: profil-onboarding + cookie-samtykke + «3 snarveier»-tour** — Ved første åpning ligger «Velkommen til The Role Room»-profilveiviseren under cookie-dialogen, og etter dem kommer FirstTimeTour. Tre modale flater før brukeren ser produktet. Profilveiviseren (bilde, yrke, om meg, tilgjengelighet) er laget for talenter og er irrelevant for en spillstudio-eier. Bevis: `desktop/shell/first-run.png`, `desktop/shell/first-run-dismissed.png` | Minimal kognitiv last | Ikke vis RoleRoomOnboardingDialog i game_studio-modus; vis tour først etter at cookie-samtykke er lukket. | S | A |
| UX-09 | Høy | Skall | **Profil-onboarding kommer tilbake ved hver sidelast etter «minimer»** — onboardingMinimized lagres bare i React-state (RoleRoomDashboardPanel). Hver reload/lenke åpner dialogen på nytt. Bevis: `desktop/shell/first-run.png` | Brukerkontroll | Persistér «minimert» i localStorage (nøkkel per bruker) og respekter den i effekten. | S | A |
| UX-10 | Høy | Skall | **Lukkeknappen på profil-onboardingen mangler tilgjengelig navn** — IconButton med Close-ikon uten aria-label; skjermleser og automatisering finner den ikke. Bevis: — | Tilgjengelighet | aria-label="Lukk" på knappen (RoleRoomOnboardingDialog). | S | A |
| UX-11 | Høy | Skall | **Dobbel topplinje: «Spillstudio-modus»-chipen vises to ganger, og GameShell-topplinjen er nesten tom** — Role Room-skallet har allerede Produksjon-knapp + moduschip; NarrativeWorkspace tegner en ny topplinje med samme chip. På mobil koster de to linjene ~190 px før innholdet starter. Bevis: `mobile/tabs/home.png`, `desktop/tabs/home.png` | Estetikk / plass | Fjern ProfessionModeChip fra GameShell-topplinjen når skallet allerede viser den; på mobil: slå sammen til én linje (meny, prosjekt, bjelle). | S | A |
| UX-12 | Høy | Skall | **«Administrer cookies»-knappen dekker sidebaren (desktop) og innholdskort (mobil)** — Etter samtykke ligger en flytende knapp nederst til venstre oppå «Pris»-fanen i sidebaren, og på mobil oppå KPI-kortet «Spilltest» og scenelisten. Bevis: `desktop/tabs/home.png`, `mobile/tabs/home.png`, `mobile/scenes/list.png` | Synlighet av innhold | Flytt knappen inn i sidebar-bunnen (desktop) / footer (mobil), eller gjør den til et lite ikon med aria-label som ikke overlapper. | S | A |
| UX-18 | Høy | Hjem | **Hjem-siden er bredere enn skjermen på mobil: KPI-kort, status-chips og episoderader kuttes til høyre** — Horisontal scroll på hele siden; tellere («1», «0») og chips («Endringer øn…») er avkuttet. Bevis: `mobile/tabs/home.png`, `mobile/onboarding/06-home-first-time.png` | Mobil layout | Grid med minmax(0,1fr) og flex-wrap på chip-rader; maxWidth 100% på kort. | S | A |
| UX-19 | Høy | Hjem | **«Mal «demo-adventure» lagt inn (NaN rader)»** — Bekreftelsen summerer report[*].inserted, men rapporten har ikke det feltet → NaN. Bevis: `desktop/onboarding/08-home-after-template.png` | Feil i tekst | Summer riktig felt (added/inserted etter API-kontrakt) med fallback 0. | S | A |
| UX-28 | Høy | Eksport | **All eksport (JSON/MD/CSV/HTML/PDF) og delingslenke er deaktivert for et prosjekt med 34 scener fordi «grafen er tom»** — Eksport dekker bare Story Graph-brettene. Et studio som jobber scenebasert (WFU) får ingen PDF/Markdown av manus, replikker eller gater — selv med Studio-plan. Bevis: `desktop/exports/01-after-downloads.png` | Match med mental modell | Kortsiktig: forklar i banneret at eksporten gjelder brettene og lenk til scener; langsiktig: «Manus-PDF» av scener/replikker (ny rute). | M | C |
| UX-29 | Høy | Team | **Prosjekteier uten team-rolle ser verken «Inviter» eller «Ny rolle» — teamet kan aldri startes** — isOwner = membership.role?.isOwnerRole. Et nytt studio har 0 roller, så eieren regnes ikke som eier og får ingen handlinger. Medlemmet vises med «— ingen rolle —» og en ikon-knapp uten navn. Bevis: `desktop/tabs/team.png` | Blindvei | Behandle org-eier (organization_id === userId) som eier; bootstrap standardrollene ved første besøk; aria-label på handlingsknappene. | M | C |
| UX-30 | Høy | Feil | **Rå feilkoder vises til bruker: «forbidden», «internal»** — Ukjent/fremmed projectId → banner «forbidden»; 500 → «internal». Ingen forklaring, ingen vei tilbake til prosjektvelgeren. Bevis: `desktop/errors/01-unknown-project.png`, `desktop/errors/06-api-500-scenes.png` | Feilmeldinger i klartekst | Map feilkoder til norske meldinger («Du har ikke tilgang til dette prosjektet», «Noe gikk galt hos oss») + «Velg et annet prosjekt»-knapp ved 403/404. | S | A |
| UX-35 | Høy | Mobil | **Scenekortets faner (Manus, Replikker, Gater…) og tabeller (replikker) er ikke tilpasset mobil** — Overflow-x på scene-p01/assets, gameplay, gates, lines, script, storyboard, tasks på mobil (etter at UX-21 er løst må hver fane wrappe). Bevis: `mobile/scene-p01/lines.png` | Mobil layout | Tabeller → kortliste på xs; fane-stripe scrollbar. | M | C |
| UX-05 | Middels | Login | **Venstre panel i login-dialogen viser film-karusell («Regissør») for Spillstudio** — Persona-spesifikk kontekst mangler: karusellen sier «Bygg shotliste, koordiner crew» og sitat fra en casting director. Bevis: `desktop/login/01-dialog-persona.png` | Konsistens | Egen karusell-slide for Spillstudio (Story Graph, scener, review) når persona er game_studio. | S | A |
| UX-13 | Middels | Skall | **Hjelpe-FAB («?») dekker innhold (aktivitetsdatoer, KPI-kort, gate-knapper)** — Fast posisjonert knapp nederst til høyre uten sikkerhetsmargin for innhold; på mobil ligger den midt i KPI-kortene. Bevis: `desktop/onboarding/08-home-after-template.png`, `mobile/tabs/home.png` | Synlighet | Legg padding-bottom på innholdsflaten, eller flytt FAB inn i topplinjen i game_studio. | S | A |
| UX-14 | Middels | Skall | **Presence-boksen bruker aria-label på en div (ARIA-forbudt attributt)** — axe: aria-prohibited-attr på div[data-testid="narrative-presence"] aria-label="Ingen andre er her nå" (på alle sider). Bevis: — | Tilgjengelighet | role="status" på boksen (eller flytt teksten til visually-hidden span). | S | A |
| UX-15 | Middels | Skall | **React-advarsler på hver side: Tabs-props (textColor, indicator, selectionFollowsFocus, fullWidth) lekker til DOM** — GameShell sidebar-navigasjonen sender MUI Tabs-props videre til et DOM-element; 4 advarsler per sidelast i konsollen. Bevis: — | Kodekvalitet / konsoll | Ikke spre Tabs-props til Box; bruk `component`/`slotProps` riktig i GameShell. | S | A |
| UX-16 | Middels | Skall | **Aktiv sidebar-fane har for lav kontrast (grønn tekst på grønn bakgrunn)** — axe color-contrast på .Mui-selected i sidebaren (36 forekomster) og på under-faner (Historie, Plan). Bevis: `desktop/tabs/home.png` | Tilgjengelighet | Mørkere bakgrunn eller lysere tekst for valgt fane (mål 4.5:1). | S | A |
| UX-17 | Middels | Skall | **Klikkmål under 32 px i topplinjen på mobil («Åpne meny», bjelle, «Bytt prosjekt» 30×30) og chips (20–24 px)** — Gjelder alle sider. Apple/Google anbefaler ≥ 44 px. Bevis: `mobile/tabs/home.png` | Mobil | size="medium" på IconButtons i topplinjen på xs; større chips i filterrader. | S | A |
| UX-20 | Middels | Hjem | **KPI-fremdriftslinjer mangler tilgjengelig navn** — axe aria-progressbar-name på 5–6 LinearProgress i KPI-kortene og oppgave-fremdrift. Bevis: — | Tilgjengelighet | aria-label="{tittel} {verdi}" på LinearProgress. | S | A |
| UX-22 | Middels | Scener | **Scenelisten scroller hele siden (34 rader) i stedet for å ha egen rulle** — Desktop: kortet blir stående øverst mens listen strekker siden til 2 500 px; på lange lister mister man kortet av syne. Bevis: `desktop/scene-p01/overview.png` | Effektivitet | Egen overflow-y på listekolonnen med sticky søk/filter; kortet sticky. | S | A |
| UX-24 | Middels | Scener | **Sceneliste-<ul> inneholder elementer som ikke er <li>** — axe list-regelen (57 forekomster) — statusrader/skeletons ligger direkte i listen. Bevis: — | Tilgjengelighet | Pakk inn i <li> eller bruk div-basert liste. | S | A |
| UX-25 | Middels | Scenekort | **Episode-velgeren på Manus-fanen viser tomt selv om scenen har episode** — MUI-advarsel «out-of-range value nep_…»: options er nøklet på noe annet enn scenens episodeId, så valgt episode vises blank. Bevis: `desktop/scene-p01/script.png` | Match / data | Bruk samme id i options som i scene.episodeId (episode.id). | S | A |
| UX-26 | Middels | Scenekort | **Manus-felt, taler-velger og opptaksstatus mangler tilgjengelige navn; avkrysning i replikker mangler label** — axe aria-input-field-name (Manus-select, Replikker taler/type/opptak), label (checkbox i replikk-rad). Bevis: — | Tilgjengelighet | label/aria-label på Select og Checkbox. | S | A |
| UX-32 | Middels | Plan | **Produksjonsplanen viser 47 udaterte chips og en tom Gantt; chipene ser ikke klikkbare ut** — «Klikk for å sette datoer» i liten grå tekst; ingen hover/ikon på chipene; ingen forslag (f.eks. «Fordel scener på episoder»). Bevis: `desktop/tabs/plan.png` | Affordance | Chip med kalender-ikon + hover; «Sett datoer»-knapp i popover; grupper udaterte etter type. | S | A |
| UX-34 | Middels | Historie | **Episode-kortenes felt og status-select mangler tilgjengelige navn** — axe aria-input-field-name på 12 felt i episodelisten og på Select. Bevis: — | Tilgjengelighet | label på TextField/Select. | S | A |
| UX-06 | Lav | Login | **MUI-advarsel: rolle-select har «game_studio_owner» utenfor lovlige verdier** — Konsollen: «out-of-range value game_studio_owner for the select component» — rollelisten i skjemaet inneholder ikke spillrollene, så valgt rolle vises tomt. Bevis: — | Feilforebygging | Legg GAME_STUDIO_ROLE_IDS inn i options for rolle-select, eller skjul selecten for persona game_studio. | S | A |
| UX-07 | Lav | Landing | **Hero-bildet på landingssiden lastes fra tredjeparts-CDN (fal.media)** — Når CDN-en er utilgjengelig vises alt-teksten som brødtekst i hero-en. Bildet bør ligge i egen /public eller R2. Bevis: `desktop/landing/01-top.png` | Robusthet | Flytt bildet til frontend/client/public (eller /cdn) og referer lokalt. | S | A |
| UX-23 | Lav | Scener | **Duplikat scenekode deaktiverer «Opprett» uten forklaring** — Riktig at knappen sperres, men brukeren får ikke vite hvorfor. Bevis: `desktop/scenes/new-dialog-duplicate.png` | Feilforebygging | Hjelpetekst «Koden er i bruk» under feltet. | S | A |
| UX-27 | Lav | Scenekort | **«Spill»-fanen og «Brett» er tomme i et prosjekt med 34 scener uten lenke videre** — «Ingen elementer ennå. Tegn historien på et brett først» — ingen knapp til Brett/mal. Bevis: `desktop/tabs/play.png` | Synlighet | CTA «Åpne Brett» / «Start fra mal» i tom-tilstanden. | S | A |
| UX-31 | Lav | Feil | **Ved nettverksfeil vises samme melding to ganger (banner + snackbar)** — «Ingen forbindelse til Story Graph-tjenesten» i både Alert og Snackbar. Bevis: `desktop/errors/05-api-down-home.png` | Redundans | Bare banner med «Prøv igjen» når siden alt viser feilen. | S | A |
| UX-33 | Lav | Karakterer | **Enlinjefelt («Kildestatus», «Første personlige scene») kutter lange tekster** — Innholdet er avsnitt, feltene er single-line. Bevis: `desktop/tabs/characters.png` | Lesbarhet | multiline minRows={2} på tekstfeltene. | S | A |
| UX-36 | Lav | Review | **Modus-velgeren i «Del med reviewer» mangler label** — axe aria-input-field-name på .MuiSelect-select i dialogen. Bevis: `desktop/review/05-share-dialog.png` | Tilgjengelighet | InputLabel «Tilgang» på Select. | S | A |

Skjermbildene ligger i QA-kjøringens scratchpad (`uxqa/shots/<desktop|mobile>/<område>/<navn>.png`) og er sendt i chatten; de committes ikke.

<!-- status:start -->
## Status etter fiks (2026-09-21)

Alle tre PR-delene er levert på samme branch og går i én PR mot `main` (A → B → C var rekkefølgen i arbeidet, ikke i leveransen — de deler filer).

| PR | Levert | Commits |
|---|---|---|
| A (småfiks) | UX-03, UX-04, UX-05, UX-06, UX-08, UX-09, UX-10, UX-11, UX-12, UX-13, UX-14, UX-15, UX-16, UX-17, UX-18, UX-19, UX-20, UX-22, UX-23, UX-24, UX-25, UX-26, UX-27, UX-30, UX-31, UX-32, UX-33, UX-34, UX-36 | `d5ceeb98`, `a3d17bec`, `fb89bf4b`, `1f37013d` + oppfølging |
| B («Nytt prosjekt») | UX-01: ProjectPicker oppretter prosjekt (`POST /api/role-room/projects` med `role_room_auth_token`), velger det og lander på første-gangs-hero | `fb89bf4b` |
| C (større) | UX-02 registrering (`signup: true` + `loginAs: game_studio` → Solo-konto uten Stripe; «Opprett gratis konto» i dialogen), UX-21 mobil liste/kort med «Tilbake til scener», UX-28 «Manus-PDF (scener)» (`GET /projects/:id/scenes/export.pdf`, gated `export_pdf`) + forklaring av brett vs. scener i Eksport, UX-29 team-bootstrap for eier uten rolle (`ensureTeamForOwner` i `GET /me`), UX-35 fanestripe/tabeller på xs | `bb904e80`, `ee9487fb`, `fb89bf4b`, `1f37013d` |

**Ikke fikset / delvis (bevisst):**

- **UX-07** (hero-bilde fra fal.media): ikke flyttet — kjøremiljøet kan ikke laste ned bildet, og det er film-landingens flate. Egen liten oppgave.
- **UX-35** delvis: scenekortet er nå én visning på mobil (UX-21), fanestripen scroller og små knapper/chips/Autocomplete-piler har minstemål på xs. Replikk-tabellen er fortsatt en tabell (scroller horisontalt i kortet, ikke på siden).
- Landingssiden/login: «Story Arc»-tekst er film-produktets navn (harness-regelen var for streng), og lav kontrast på markedsføringstekst («Manifest») ligger utenfor Story Graph-omfanget.
- `PostCommentLayer` (Post Agent-komponent, gjenbrukt i review): «✓»/«Svar» 12–16 px høye — ikke endret; bør tas i komponenten, ikke per bruk.
- MUI `Switch size="small"` (24 px) på Replikker («KI-stemmer»): standard MUI-geometri, ikke endret (bryteren har nå aria-label).
- MUI `Autocomplete` med grupper (element-velgeren på Gameplay): axe `list`/`listitem`/`aria-required-parent` kommer fra MUIs gruppert listbox-struktur, ikke vår kode.
- Scenekortets valgte fane: MUI `textColorPrimary` overstyrte fargen vår (spesifisitet) — rettet i siste commit, ikke målt på nytt i tabellen under.
- Harness-regelen «Ukjent projectId gir ingen forklarende melding» slår fortsatt ut, men banneret viser nå «Du har ikke tilgang til dette prosjektet» + «Velg et annet prosjekt» (skjermbilde `desktop/errors/01-unknown-project.png`); regexen i harnessen matchet ikke ordlyden.

### Regresjon — full kjøring (alle 8 specs, desktop + mobil)

Tellinger per sidetilstand (siste kjøring per tilstand; «info» utelatt). Før = `main` `888c8770`, etter = branchen etter PR A/B/C (`fb89bf4b`), 201 → 156 tilstander (færre fordi blindveier og dubletter forsvant).

| Måling | Før | Etter |
|---|---|---|
| Konsollfeil/-advarsler | 339 | 78 |
| axe color-contrast | 145 | 104 |
| Nettverkskall ≥ 400 / feilet | 119 | 36 |
| axe aria-prohibited-attr | 143 | 0 |
| Klikkmål < 32 px (mobil) | 69 | 70 |
| axe list (ul med ikke-li) | 67 | 41 |
| Horisontal overflow (side bredere enn viewport) | 25 | 3 |
| Tekst-sjekk («Story Arc», «undefined», «NaN») | 11 | 10 |
| axe aria-input-field-name | 13 | 4 |
| axe aria-progressbar-name | 14 | 2 |
| Avkuttet tekst (ellipsis) | 11 | 4 |
| axe scrollable-region-focusable | 10 | 0 |
| Blindvei (handling uten vei videre) | 8 | 0 |
| axe label | 4 | 3 |
| Manglende tilbakemelding | 2 | 2 |
| axe document-title | 2 | 2 |
| axe html-has-lang | 2 | 2 |
| axe button-name | 2 | 0 |
| axe listitem | 1 | 1 |
| axe aria-required-parent | 1 | 1 |
| axe aria-required-children | 1 | 1 |
| Manglende element | 1 | 1 |
| Flyt | 1 | 0 |
| Feilforebygging | 1 | 0 |
| Manglende tilgjengelig navn | 1 | 0 |

Klikkmål-telleren gikk ikke ned i full kjøring fordi flere sider nå rendres helt (scenekortet på mobil var før ~60 px bredt og ble ikke målt); oppfølgingsrunden under tar den ned. Gjenværende horisontal overflow etter full kjøring: `desktop/tabs/boards`, `mobile/tabs/boards`, `mobile/tabs/platform` (Brett = react-flow-lerret på desktop, forventet).

### Regresjon — oppfølgingsrunde (scenekort, onboarding, feiltilstander; desktop + mobil)

Etter regresjonen ble seks nye funn rettet (`1f37013d` + oppfølging: betinget rendering av liste/kort, én feilboks ved 403, kompakt cookie-pille, DOM-nesting, episode-select, fane-opasitet/kontrast, `ListItem`-struktur, «Idé»-chip 6:1, Autocomplete-piler 36 px). Tabellen sammenligner de samme 13 sidetilstandene (sceneliste + scenekort P01, desktop og mobil) over tre kjøringer; onboarding- og feiltilstandene ble også kjørt på nytt og er dekket av full-tabellen over.

| Måling | Før | Etter A/B/C | Etter oppfølging |
|---|---|---|---|
| axe color-contrast | 11 | 10 | 5 |
| Konsollfeil/-advarsler | 14 | 1 | 1 |
| Nettverkskall ≥ 400 / feilet | 12 | 0 | 0 |
| axe list (ul med ikke-li) | 11 | 8 | 1 |
| axe aria-prohibited-attr | 11 | 0 | 0 |
| axe label | 3 | 3 | 3 |
| Klikkmål < 32 px (mobil) | 3 | 2 | 2 |
| axe document-title | 2 | 2 | 2 |
| axe html-has-lang | 2 | 2 | 2 |
| Horisontal overflow (side bredere enn viewport) | 3 | 0 | 0 |
| axe aria-input-field-name | 3 | 0 | 0 |
| axe listitem | 1 | 1 | 1 |
| axe aria-required-parent | 1 | 1 | 1 |
| Avkuttet tekst (ellipsis) | 1 | 1 | 1 |
| axe aria-required-children | 1 | 1 | 1 |

Nettverks- og konsolltallene som står igjen er de bevisste feilprobene (backend nede, 401/403/500/503) — de skal feile. Gjenværende overflow i delmengden: —.

**Modellvalg:** verdikt, prioritering og alt med produksjonskonsekvens (auth-provisjonering, team-bootstrap, PDF-rute, hook-rekkefølge) er gjort med Fable 5.1; de mekaniske PR A-rettelsene (tekster, aria, testids, kontrast) ble delegert til tre Sonnet-subagenter på disjunkte filsett og verifisert med tsc, vitest, e2e og harness-kjøring.
<!-- status:end -->

## Automatiske observasjoner

### Tilgjengelighet (axe, kun serious/critical)

| Regel | Maks forekomster per side | Sider desktop | Sider mobil | Hva |
|---|---|---|---|---|
| `color-contrast` | 46 | 113 | 32 | Valgt sidebar-fane, under-faner, chips, dimmet tekst |
| `aria-prohibited-attr` | 1 | 87 | 56 | aria-label på div (presence-boksen) — alle sider |
| `list` | 3 | 44 | 23 | <ul> med barn som ikke er <li> (sceneliste, prosjektvelger, komponentlister) |
| `aria-progressbar-name` | 6 | 9 | 6 | KPI-fremdrift, oppgave-fremdrift |
| `aria-input-field-name` | 15 | 8 | 5 | Select/tekstfelt uten label (episoder, plattform, manus, replikker, delingsdialog) |
| `scrollable-region-focusable` | 1 | 2 | 8 | Scrollbar liste uten tastaturfokus (mobil sceneliste, alert) |
| `label` | 8 | 3 | 1 | Checkbox i replikk-rad, felt i delingsbekreftelse |
| `document-title` | 1 | 1 | 1 | Side uten <title> etter nettleser-tilbake |
| `html-has-lang` | 1 | 1 | 1 | Side uten lang etter nettleser-tilbake |
| `button-name` | 7 | 1 | 1 | Ikon-knapper i Team uten navn |
| `aria-required-children` | 1 | 1 | 0 | Autocomplete-listbox (koblingsvelger) |
| `aria-required-parent` | 25 | 1 | 0 | Autocomplete-option (koblingsvelger) |
| `listitem` | 2 | 1 | 0 | <li> utenfor liste (koblingsvelger) |

### Konsoll (React/MUI-advarsler, per sidelast)

- 273× `error: Warning: React does not recognize the `…` prop on a DOM element. If you intentionally want it to appear`
- 91× `error: Warning: Received `…` for a non-boolean attribute `…`. If you want to write it to the DOM, pass a strin`
- 8× `warning: MUI: You have provided an out-of-range value `…` for the select component. Consider providing a value`
- 8× `error: Failed to load resource: net::ERR_CONNECTION_REFUSED`
- 6× `error: Failed to load resource: the server responded with a status of 403 (Forbidden)`
- 2× `error: Failed to load resource: the server responded with a status of 503 (Service Unavailable)`
- 2× `error: Failed to load resource: the server responded with a status of 401 (Unauthorized)`
- 2× `error: Failed to load resource: the server responded with a status of 500 (Internal Server Error)`

### Mobil

- Horisontal overflow (siden bredere enn skjermen) på 22 mobil-tilstander: member/02-home, member/04-scene, onboarding/06-home-first-time, scene-p01/assets, scene-p01/gameplay, scene-p01/gates, scene-p01/lines, scene-p01/overview, scene-p01/playtest, scene-p01/review, scene-p01/script, scene-p01/storyboard, scene-p01/tasks, shell/drawer, shell/first-run, shell/first-run-dismissed, shell/inbox, solo/scene-playtest, solo/scene-review, tabs/boards, tabs/home, tabs/platform. Desktop: brett-lerretet (forventet, react-flow).
- Klikkmål under 32 px (topplinje og chips), hyppigste: «Åpne meny» (77), «Bytt prosjekt» (73), «0» (70), «NY SCENE» (35), «IMPORTER» (25), «Alle» (25), «Idé» (25), «Under arbeid» (25).

### Nettverk

- Ingen uventede 4xx/5xx fra Story Graph-API-et i normale flyter. Forventede: 401 (feil passord), 402 (Solo-gating), 403 (fremmed prosjekt), 409 (gjest på utdatert runde), 503 (av-bryter).
- Eksterne avhengigheter som lastes fra klienten: Google Fonts (Poppins/Inter), `apis.google.com/js/api.js` på den offentlige gjeste-siden, hero-bilde fra `fal.media` på landingssiden. Alle feilet i kjøremiljøet (egress) og degraderte pent, men bør vurderes for personvern/robusthet.

## Det som fungerer godt

- Review-flyten: forespørsel → kommentar → «scenen er endret siden runden» → ny runde → beslutning, med rundehistorikk og innboksvarsel.
- Gjestereview: identitet → runde med Før/Handling/Kontroll/Etter/Lyd + replikker + diskusjon; beslutning på utdatert runde avvises med klar melding («be studioet om en ny lenke»).
- Gater: «Bestått» er deaktivert til bevis er fylt (G01), og bevisene fra seeden vises med kilde og tidspunkt.
- Solo-gating: alle låste funksjoner har plan-banner med «Se planer», og låste knapper er tydelig deaktivert.
- Feil-tilstander: «Ingen forbindelse til Story Graph-tjenesten» + Prøv igjen; skeletons ved treg respons; av-bryter gir helsidebanner.
- Duplikat scenekode sperres live i «Ny scene».
- Autosave med «Lagret HH:MM» på scenekortet fungerer på Oversikt og Manus.

## Fiks-plan

| PR | Innhold | Funn |
|---|---|---|
| A | Småfiks (tekster, tilstander, a11y, mobil-brekk, kontrast, konsoll) | UX-03, UX-04, UX-08, UX-09, UX-10, UX-11, UX-12, UX-18, UX-19, UX-30, UX-05, UX-13, UX-14, UX-15, UX-16, UX-17, UX-20, UX-22, UX-24, UX-25, UX-26, UX-32, UX-34, UX-06, UX-07, UX-23, UX-27, UX-31, UX-33, UX-36 |
| B | «Nytt prosjekt» i spillstudio-modus (ProjectPicker) | UX-01 |
| C | Større: registrering for Spillstudio, mobil scenekort (liste/kort-visning), Team-eier uten rolle, scene-eksport (manus-PDF), mobil scenefaner | UX-02, UX-21, UX-28, UX-29, UX-35 |

Rekkefølge: A → B → C. Hver PR verifiseres med `npm run test:unit:narrative`, frontend `tsc`, berørte e2e-specs og en ny kjøring av QA-harnessen (regresjon på skjermbilder/axe).

## Metode og reproduksjon

1. Lokal Postgres 16 (`initdb` som `postgres`), `drizzle-kit push` for baseline (`users` m.fl.), deretter alle `backend/migrations/*.sql` i `sort -V`-rekkefølge med en enkel runner (fortsett-ved-feil; 185 filer utenfor Story Graph feilet på manglende Leadgrid/Drizzle-tabeller og er irrelevante her). `users` fikk `password`/`username` lagt til manuelt (Drizzle-baselinen mangler dem).
2. Brukere opprettet direkte i DB (bcrypt), innlogget via `POST /api/auth/login` med `loginAs: game_studio`. Studio-plan via `game_subscription status=comp`; medlem via `enterprise_team_members org_kind=game_studio`.
3. `npm run seed:story-graph -- --project what-follows-us-local` (34/38/12/84/18/25/70/13/1).
4. Playwright-harness (7 specs + av-bryter) med `login()` via localStorage (`role_room_auth_session`/`role_room_auth_token`), onboarding-status stubbet til `requiresOnboarding:false` etter første-besøk-fangst, tour-nøkler forhåndssatt. Per tilstand: skjermbilde, axe (wcag2a/2aa/21aa), konsoll, nettverk ≥ 400, overflow, klikkmål, tekst-sjekk («undefined», «NaN», «Story Arc»).

Kjente begrensninger: fonter falt tilbake til systemfont (Google Fonts blokkert); KI-/S3-/Stripe-flater testet kun som feiltilstander; e-postvarsler ikke verifisert.
