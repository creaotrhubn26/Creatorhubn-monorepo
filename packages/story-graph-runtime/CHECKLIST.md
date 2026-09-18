# Manuell sjekkliste — C#/GDScript/Swift-lasterne

CI kompilerer ikke C#, GDScript eller Swift. Kjør denne lista lokalt ved endringer i
`unity/StoryGraphRuntime.cs`, `godot/story_graph_runtime.gd`, `swift/Sources/StoryGraphRuntime/`,
motoren (`frontend/shared/narrative-runtime`, `narrative-script`) eller fixtures.

## 0. Referanse

```
cd frontend && npm run build:narrative-runtime-pkg
node ../packages/story-graph-runtime/js/examples/transcript.mjs   # == fixtures/sample-project.expected.txt
```

## 1. Unity (C#)

1. Nytt Unity-prosjekt (2021.3 LTS eller nyere). Bekreft at `com.unity.nuget.newtonsoft-json`
   er i Package Manager (er standard i 2020.3+).
2. Kopier `unity/StoryGraphRuntime.cs` til `Assets/StoryGraph/` og `fixtures/sample-project.json`
   til `Assets/StreamingAssets/`.
3. Legg et tomt GameObject med dette skriptet og trykk Play:
   ```csharp
   using UnityEngine; using System.IO; using CreatorHub.StoryGraph;
   public class StoryGraphParity : MonoBehaviour {
     void Start() {
       var json = File.ReadAllText(Path.Combine(Application.streamingAssetsPath, "sample-project.json"));
       var project = StoryGraphProject.Load(json);
       var transcript = StoryGraphTranscript.Play(project);
       File.WriteAllText(Path.Combine(Application.persistentDataPath, "transcript.txt"), transcript);
       Debug.Log(transcript);
     }
   }
   ```
4. `diff transcript.txt fixtures/sample-project.expected.txt` → tom diff = paritet.
5. Ingen kompileringsfeil/advarsler fra `StoryGraphRuntime.cs` i Console.
6. Kjør en gang til med `pick: (n, step) => n - 1` (alltid siste valg) og bekreft at den ender på
   `@ end | Slutt` etter første valg (ikke-første-valg-stien).

## 2. Godot 4 (GDScript)

1. Nytt Godot 4.2+-prosjekt. Kopier `godot/story_graph_runtime.gd` til `res://story_graph/` og
   `fixtures/sample-project.json` til `res://story_graph/`.
2. Scene med én Node og dette skriptet, kjør scenen:
   ```gdscript
   extends Node
   func _ready() -> void:
       var project := StoryGraphRuntime.Project.load_json(FileAccess.get_file_as_string("res://story_graph/sample-project.json"))
       var transcript := StoryGraphRuntime.transcript(project)
       var f := FileAccess.open("user://transcript.txt", FileAccess.WRITE)
       f.store_string(transcript)
       print(transcript)
   ```
3. `diff <user-dir>/transcript.txt fixtures/sample-project.expected.txt` → tom diff = paritet.
4. Ingen parse-feil i Output ved lasting av `story_graph_runtime.gd` (Godot parser hele fila
   ved første `load`; inner-klassene `Project`, `Session`, `Interp`, `Html`, `Value` skal ikke
   kollidere med innebygde navn).
5. `StoryGraphRuntime.transcript(project, 12, func(n, _s): return n - 1)` ender på `@ end | Slutt`.

## 3. Swift Package

CI har ingen Swift-toolchain, så `swift test` må kjøres lokalt (macOS med Xcode 15+, eller Linux
med Swift 5.9+ installert) ved endringer i `swift/Sources/StoryGraphRuntime/`.

1. ```bash
   cd packages/story-graph-runtime/swift
   swift test
   ```
2. Forventet: `ParityTests` (paritet mot `sample-project.expected.txt`, inkludert
   ikke-første-valg-stien) og `MiniScriptTests` (presedens, `is not`, deling på null,
   `visits()`) bestått, ingen bygge-advarsler fra `StoryGraphRuntime`-targeten.
3. `ParityTests.testSessionReportsNoWarningsForTheFixtureWalkthrough` dekker samme krav som
   punkt 4 under («Session.Warnings skal være tom for fixture-en»).

## 4. Hva som SKAL være likt

- Elementrekkefølge, tekst (`/` mellom avsnitt), valg-etiketter, `(end)`, `vars:`-linja
  (kun globale variabler, sortert på navn; bool `true/false`, heltall uten desimaler,
  desimaltall avrundet til 3, strenger JSON-quotet).
- Advarsler er IKKE del av transkriptet, men `Session.Warnings`/`session.warnings` skal være tom
  for fixture-en (i alle tre porter).

## 5. Kjente avvik (dokumentert, ikke feil)

- `show()`/`reset*()` og komponent-attributter støttes ikke i C#/GDScript/Swift (advarsel).
- Flyttall formateres med motorens `ToString`/`str()`/`String(format:)` — små avvik utover 3
  desimaler kan forekomme; fixture-en bruker heltall.
- Swift-porten har `back()` og `onEvent` (historikk/hendelser) som IKKE finnes i C#-/GDScript-
  portene — se `swift/Sources/StoryGraphRuntime/StoryGraphSession.swift` (filhode) for semantikk.
  Disse påvirker ikke `StoryGraphTranscript.play(...)`-paritetstesten.
- Swift-porten faller tilbake til `project.elements.values.first` (ikke-deterministisk
  rekkefølge i Swifts `Dictionary`) hvis `startingElement` mangler/er ugyldig — i motsetning til
  C#s og Godots ordnede `Dictionary`. Fixture-prosjektet har alltid en gyldig `startingElement`,
  så dette rammer ikke paritetstesten, men bør fikses (stabil id-sortering) før et prosjekt uten
  gyldig startelement caches i produksjon.
