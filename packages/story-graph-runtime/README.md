# Story Graph Runtime

Runtime-pakker for historier laget i **Story Graph** (The Role Room, spillstudio-vertikalen).
Story Graph eksporterer `export.json` i Arcweave-kompatibelt `project.json`-format, så du
har to veier inn i spillmotoren:

| Vei | Full arcscript | Vedlikeholdes av |
|---|---|---|
| Arcweaves MIT-plugins ([Unity](https://github.com/arcweave/arcweave-unity-plugin), [Godot](https://github.com/arcweave/arcweave-godot-plugin), [Unreal](https://github.com/arcweave/arcweave-unreal-plugin)) med samme JSON | ✅ (ANTLR-tolk) | Arcweave |
| **Denne pakken** — én fil per motor, ingen avhengighet utover JSON-parseren | dokumentert delsett (under) | oss |

| Mappe | Innhold |
|---|---|
| `js/` | `@creatorhub/story-graph-runtime` — den delte TypeScript-motoren (samme kode som Play Mode). Full arcscript. `dist/` er committet. |
| `unity/StoryGraphRuntime.cs` | C# (Unity 2020.3+/.NET Standard 2.1, Newtonsoft.Json). Delsett. |
| `godot/story_graph_runtime.gd` | GDScript for Godot 4. Delsett. |
| `swift/` | `StoryGraphRuntime` — Swift Package (iOS 17+/macOS 14+, swift-tools-version 5.9). Delsett, ingen avhengigheter. Se `swift/README.md`. |
| `fixtures/` | `sample-project.json` + `sample-project.expected.txt` — referanse for paritet mellom motorene. |
| `CHECKLIST.md` | Manuell verifisering av C#/GDScript/Swift (kan ikke kompileres i vår CI). |

## API (likt i alle tre)

```
Project.Load(json)              → prosjekt (elementer, forgreninger, jumpere, koblinger, variabler)
Session(project).Start()        → View { ElementId, Element, Html, Text, Options[], DeadEnd, SpeakerName }
session.Choose(connectionId)    → neste View (jumpere følges, forgreninger rutes automatisk)
session.GetVariable(name) / SetVariable(name, value) / VisitsOf(idOrCustomId) / Restart()
Transcript(project)             → deterministisk gjennomspilling som tekst (paritetssjekk)
```

Semantikk (som i Play Mode): ankomst → `visits++` → innholdets skript kjøres → utganger er
spillerens valg; ved valg kjøres etikett-skriptet før målet åpnes; forgrening tar første sanne
betingelse (`else` = betingelse uten skript), ingen treff → blindvei; jumper følges (sløyfevakt 100).

## arcscript-delsettet i C#/GDScript

| Støttet | Ikke støttet (advarsel, ignoreres) |
|---|---|
| tilordning `= += -= *= /= %=` på globale variabler | `show()`, `reset()`, `resetAll()`, `resetVisits()` |
| `if / elseif / else / endif` rundt prose (én setning per linje i kodeblokk) | komponent-attributter som skopede variabler (Arcweave 5.11) |
| `== != < > <= >=`, `is` / `is not`, `and && or \|\| not !`, `+ - * / %`, unær `- +` | |
| `visits()` / `visits(@[id])` / `visits(customId)`, `abs min max round sqr sqrt random roll` | |
| referanser `@[element-id \| customId \| variabel-id]` | |

Element-referanser løses på id, deretter customId (prefiks som `nel_` tolereres). **Bruk
customId** i skript som skal overleve eksport/import — det er den stabile identiteten.

JS-pakken har full arcscript (samme tolk som editoren) og eksponerer i tillegg
`validateStoryGraph`, `playTranscript` og `loadArcweaveProject` (bevarer idene fra project.json).

## Bygg og paritet

```
cd frontend && npm run build:narrative-runtime-pkg     # js/dist + fixtures/*
cd frontend && npx vitest run shared/narrative-runtime/package-parity.test.ts
```

Paritetstesten feiler hvis `js/dist` eller fixtures er utdatert i forhold til kilden
(`frontend/shared/narrative-runtime-pkg`). C#/GDScript verifiseres manuelt mot
`fixtures/sample-project.expected.txt` (se `CHECKLIST.md`).
