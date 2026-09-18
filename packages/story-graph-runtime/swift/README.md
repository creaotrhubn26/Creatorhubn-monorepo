# StoryGraphRuntime (Swift Package)

Tredje port av Story Graph-runtimen (se `../README.md`) — samme delsett av arcscript som
`../unity/StoryGraphRuntime.cs` og `../godot/story_graph_runtime.gd`, skrevet som en idiomatisk
Swift Package uten tredjeparts-avhengigheter (kun Foundation: `JSONSerialization` for å lese den
løst typede eksport-JSON-en, `NSRegularExpression` for HTML-hjelperne).

**Kompileres IKKE i CI** (ingen Swift-toolchain i dette repoets byggemiljø). Verifiser lokalt med
`swift test` og sjekklisten under, akkurat som C#-/GDScript-portene verifiseres manuelt mot
`../CHECKLIST.md`.

## Legge pakken til et Xcode-prosjekt

**Lokal Swift Package (anbefalt under utvikling):**

1. Xcode → File → Add Package Dependencies… → Add Local…
2. Velg `packages/story-graph-runtime/swift` (denne mappen).
3. Legg `StoryGraphRuntime`-produktet til target-en din (iPad-app, spillklient, …).

**Fra kode/CI uten Xcode-UI**, i en annen pakkes `Package.swift`:

```swift
.package(path: "../packages/story-graph-runtime/swift")
// og i target-en:
.product(name: "StoryGraphRuntime", package: "swift")
```

Krever iOS 17 / macOS 14 eller nyere (swift-tools-version 5.9).

## API

```swift
import StoryGraphRuntime

let data = try Data(contentsOf: exportURL)
let project = try StoryGraphProject.load(from: data)     // eller .load(json: jsonString)

let session = StoryGraphSession(project: project)
session.onEvent = { event in
    // event.kind: .enter .choose .branch .jumper .restart .set .back
    // event.elementId, event.message, event.changes, event.errors — se StoryGraphSession.swift
}

var view = session.start()                    // StoryGraphView?
view?.element.titleText                        // ren tekst-tittel
view?.text                                      // rendret innhold, betingede seksjoner løst
view?.options                                   // [StoryGraphOption] { connectionId, targetId, labelHtml/labelText }
view?.deadEnd                                   // ingen valg / forgrening-uten-treff

view = session.choose(connectionId: view!.options[0].connectionId)
view = session.back()                           // gå tilbake ett steg (se merknad under)
view = session.restart()

session.getVariable("gold")                     // StoryGraphValue?  (.bool/.int/.double/.string)
session.setVariable("gold", .int(10))
session.visits(of: "market")                    // id ELLER customId
session.warnings                                // kumulativ advarselliste for sesjonen
```

`StoryGraphValue` er en typet verdi-enum (`.bool/.int/.double/.string`) — se doc-kommentaren i
`Sources/StoryGraphRuntime/MiniScript.swift` for hvorfor `.int` finnes som en egen case selv om
C#-/GDScript-portene kun har `bool/double/string` internt (det er en presentasjonsdetalj ved
variabel-grensen, ikke en beregningsforskjell).

`back()` og `onEvent` finnes IKKE i C#-/GDScript-portene (ingen historikk/hendelser der). De er
nye for denne (og JS-) porten i denne fasen — se doc-kommentaren øverst i
`Sources/StoryGraphRuntime/StoryGraphSession.swift` for nøyaktig semantikk og den ene kjente
avveiningen (`back()` kan i teorien vise en midlertidig dobbel skript-effekt i selve
gjenvisningen av et ikke-idempotent element, aldri i persistert tilstand — samme design som i
`frontend/shared/narrative-runtime/engine.ts`).

## Arcscript-delsettet

Identisk delsett som C#-/GDScript-portene (se `../README.md` for den fulle tabellen):

| Støttet | Ikke støttet (advarsel, ignoreres) |
|---|---|
| tilordning `= += -= *= /= %=` på globale variabler | `show()`, `reset()`, `resetAll()`, `resetVisits()` |
| `if / elseif / else / endif` rundt prose (én setning per linje i kodeblokk) | komponent-attributter som skopede variabler |
| `== != < > <= >=`, `is` / `is not`, `and && or \|\| not !`, `+ - * / %`, unær `- +` | |
| `visits()` / `visits(@[id])` / `visits(customId)`, `abs min max round sqr sqrt random roll` | |
| referanser `@[element-id \| customId \| variabel-id]` | |

Element-referanser løses på id, deretter customId (prefiks som `nel_` tolereres). **Bruk
customId** i skript som skal overleve eksport/import.

## Filer

| Fil | Innhold |
|---|---|
| `Sources/StoryGraphRuntime/StoryGraphProject.swift` | Prosjektmodell + `load(from:)`/`load(json:)`. |
| `Sources/StoryGraphRuntime/StoryGraphSession.swift` | Spilling: `start/choose/back/restart/getVariable/setVariable/visits(of:)`, `onEvent`, `StoryGraphTranscript`. |
| `Sources/StoryGraphRuntime/MiniScript.swift` | `StoryGraphValue`-enumen + tokenizer/parser/evaluator for arcscript-delsettet. |
| `Sources/StoryGraphRuntime/HtmlSegments.swift` | HTML → prosa/kode-segmenter, entitet-dekoding, mention → `@[id]`. |
| `Tests/StoryGraphRuntimeTests/ParityTests.swift` | Paritet mot `../fixtures/sample-project.expected.txt` + MiniScript-enhetstester. |

## Verifisering (manuell, se ../CHECKLIST.md for hele lista)

```bash
cd packages/story-graph-runtime/swift
swift test
```

`ParityTests` bygger transkriptet med `StoryGraphTranscript.play(project)` og sammenligner det
linje for linje mot `../fixtures/sample-project.expected.txt` — samme fixture og format som
C#-/GDScript-verifiseringen. Testene kjører aldri i CI i dette repoet (ingen Swift-toolchain);
kjør dem lokalt eller i Xcode ved endringer i denne mappen.
