# Story Graph — studio-guide (onboarding for nye studioer)

Story Graph er The Role Rooms verktøy for spillstudioer: forgrenet narrativ design (≥ Arcweave-paritet)
pluss et produksjons-OS rundt scenene — manusimport, leveransegater med bevis fra CI, review-runder,
spilltest-telemetri og en manusvakt. Denne guiden er veien fra tomt prosjekt til første spilltest.
Alt ligger bak `?mode=game_studio` (beta).

## 0. Planer

| | Solo (gratis) | Pro | Studio |
|---|---|---|---|
| Brett, scener, karakterer, lokasjoner, plattformmål, Play Mode, JSON/Markdown/CSV | ✔ | ✔ | ✔ |
| Manusimport (Word/PDF), regel-manusvakt, spilltest-fane (lesing) | ✔ | ✔ | ✔ |
| Deling, HTML/PDF, KI-forslag, KI-manusvakt, KI-stemmer, referansebilder, oversettelser, Twine/Ink, review-runder, produksjonsplan | – | ✔ | ✔ |
| Team og seter, gjeste-reviewere, runtime-pakker, **CI-bevis-webhook**, **spilltest-telemetri** | – | – | ✔ |
| Prosjekter | 3 | ubegrenset | ubegrenset |

Låste funksjoner viser et banner med «Se planer»; ingenting skrives før planen har funksjonen.

## 0.5 Konto og første prosjekt

1. Landingssiden → kortet «Spillstudio — Story Graph» → «Utforsk». I login-dialogen: «Ny her? Opprett gratis Solo-konto»
   → e-post + passord (minst 8 tegn) → «Opprett gratis konto». Ingen betaling; Pro/Studio kjøpes senere under «Pris».
2. Prosjektvelgeren i spillstudio-modus har «Nytt prosjekt» (navn → «Opprett prosjekt»). Prosjektet åpnes med
   første-gangs-hero og «Start fra mal». Solo tillater tre prosjekter med Story Graph-innhold.
3. Team-fanen: eieren får Eier-rollen og standardrollene automatisk ved første besøk, og kan invitere (Studio: seter fra planen).

## 1. Start fra mal (Hjem → «Start fra mal»)

- **Tomt** — bare skallet.
- **Demo-eventyr** — 1 episode, 6 scener, 4 karakterer, 2 lokasjoner uten IP; alle faner har innhold å klikke på.
- **WFU-utdrag** — tre scener fra vårt eget prosjekt (uten replikker): viser hvordan et scenekort med
  Før/Handling/Kontroll/Etter/Lyd, kildemerker og epoke ser ut i praksis.

Malen skrives gjennom de vanlige service-funksjonene (samme vei som seed-skriptet), så CHECK-er og
revisjoner gjelder. Det tas en revisjon «Før mal» først.

## 2. Manus inn (Scener → «Importer»)

Word/PDF/Markdown/tekst → **alltid dry-run først**: diff per scene og replikk (ny / endret / uendret /
mangler i dokumentet). Ingenting slettes — det som mangler blir åpne spørsmål (`kind = check`).
Kilderegisteret får SHA-256 og verifisert-stempel. Formatkrav: `STORY_GRAPH_MANUSCRIPT_IMPORT.md`.

## 3. Scenekort og gater

> **Manus-PDF:** Eksport → «Manus-PDF (scener)» gir hele manuset (Før/Handling/Kontroll/Etter/Lyd, replikker, gater)
> som PDF uten at prosjektet trenger brett. «PDF (Story Graph)» dekker brettene. Krever Pro/Studio.


Hver scene har Manus (Før/Handling/Kontroll/Etter/Lyd, kildemerker, epoke, episode), Replikker
(cue-ID, taler, EN/NB, opptaksstatus, «Les opp scenen»), Storyboard (rammer, KI-referansebilde),
Gameplay, Oppgaver, Review og seks **leveransegater**: manusdekning → gråboks → karakterer/animasjon →
gjennomspilling → bilde → lyd. Regelen er absolutt: **«bestått» krever bevis** — også fra CI.

## 4. Bygget setter gatene (Integrasjoner → CI-hooks) — Studio

Opprett en hook, legg hemmeligheten i spill-repoets secrets og kall
`packages/story-graph-runtime/ci/post-gate-evidence.sh` fra CI (eller den gjenbrukbare workflowen).
Gaten får status, bevis, commit/run-refs og «Satt av CI»; artefakter (xcresult-zip) lastes ned fra
gate-fanen. Detaljer: `STORY_GRAPH_CI_EVIDENCE.md`.

## 5. Spillet rapporterer (Integrasjoner → spilltest-tokens) — Studio

Runtime-pakken (JS, Swift, Unity, Godot) gir `onEvent`; spillet sender `enter/exit/choice/death/complete`
per scene med et token. Spilltest-fanen viser økter, drop-off, median tid og valgfordeling per build;
hjem-KPI viser verste drop-off. Detaljer: `STORY_GRAPH_PLAYTEST_TELEMETRY.md`.

## 6. Manusvakt (Historie → Manusvakt)

«Kjør regler» er gratis og deterministisk (epoke-brudd, taler uten karakter, replikk uten kilde, gate
uten bevis-ref, gamle spørsmål). «Regler + KI» (Pro/Studio) leser bare scener endret siden sist.
Funn er forslag; «Godta» oppretter et åpent spørsmål til neste manusgjennomgang. Manuset endres aldri
automatisk.

## 7. Review og team

Be om review per scene (snapshot + hash; beslutning avvises hvis scenen endret seg), kommentarer i tråd,
gjeste-reviewere uten konto (Studio), team med roller og seter (Studio).

## 8. Drift

Av-bryter `ROLE_ROOM_GAME_STUDIO_ENABLED=false` gir 503 + banner; Sentry på alle narrative-feil;
migrasjoner tørrkjøres på en Neon-branch før prod (krever secret `NEON_API_KEY` **og** variabel
`NEON_PROJECT_ID`; mangler én av dem, hoppes steget over med gul advarsel); rate-limit på offentlige og muterende ruter;
revisjoner beholdes (siste 50 + én per dag i 90 dager). API-referanse: `STORY_GRAPH_API.md`.
