// ParityTests.swift — paritet mot ../../fixtures/sample-project.expected.txt (samme fixture som
// C#-/GDScript-portene verifiseres manuelt mot, se ../../CHECKLIST.md), pluss et lite knippe
// MiniScript-enhetstester (presedens, `is not`, deling på null → feil, `visits()`).
//
// `@testable import` brukes fordi `ScriptContext`/`MiniScript` er `internal` i biblioteket
// (samme synlighet som i C#-porten) — testmålet trenger direkte tilgang for å teste tolkeren
// isolert, uten å gå via HTML-fixturer for hvert uttrykk.

import XCTest
@testable import StoryGraphRuntime

// MARK: - paritet mot fixtures/sample-project.json

final class ParityTests: XCTestCase {
    /// `Tests/StoryGraphRuntimeTests/ParityTests.swift` → `swift/fixtures` finnes ikke;
    /// fixture-mappen ligger på pakkenivå (`packages/story-graph-runtime/fixtures`), altså fire
    /// hakk opp fra denne filen: fil → StoryGraphRuntimeTests/ → Tests/ → swift/ → story-graph-runtime/.
    private func fixtureURL(_ name: String) -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("fixtures")
            .appendingPathComponent(name)
    }

    private func loadProject() throws -> StoryGraphProject {
        let data = try Data(contentsOf: fixtureURL("sample-project.json"))
        return try StoryGraphProject.load(from: data)
    }

    /// `StoryGraphTranscript.play(project)` (første valg hver gang) skal være linje-for-linje lik
    /// `sample-project.expected.txt`.
    func testTranscriptMatchesFixtureFirstChoiceEveryTime() throws {
        let project = try loadProject()
        let transcript = StoryGraphTranscript.play(project)
        let expected = try String(contentsOf: fixtureURL("sample-project.expected.txt"), encoding: .utf8)

        let actualLines = transcript.split(separator: "\n", omittingEmptySubsequences: false)
        let expectedLines = expected.split(separator: "\n", omittingEmptySubsequences: false)

        XCTAssertEqual(actualLines.count, expectedLines.count, "Ulikt antall linjer i transkriptet.")
        for (index, pair) in zip(actualLines, expectedLines).enumerated() {
            XCTAssertEqual(pair.0, pair.1, "Avvik på linje \(index + 1).")
        }
    }

    /// Ikke-første-valg-stien (CHECKLIST.md pkt. 6/5): siste valg hver gang skal ende på «Slutt»
    /// etter første valg (start → marked → «gå videre uten å handle» → slutt).
    func testLastChoiceEveryTimeReachesTheEnd() throws {
        let project = try loadProject()
        let transcript = StoryGraphTranscript.play(project, pick: { optionCount, _ in optionCount - 1 })
        XCTAssertTrue(transcript.contains("@ end | Slutt"), "Siste-valg-stien skal ende på «Slutt».")
    }

    /// CHECKLIST.md: «Advarsler er IKKE del av transkriptet, men Session.Warnings skal være tom
    /// for fixture-en.»
    func testSessionReportsNoWarningsForTheFixtureWalkthrough() throws {
        let project = try loadProject()
        let session = StoryGraphSession(project: project, rng: { 0.5 })
        _ = session.start()
        while let view = session.current, !view.deadEnd, !view.options.isEmpty {
            _ = session.choose(connectionId: view.options[0].connectionId)
        }
        XCTAssertTrue(session.warnings.isEmpty, "Fixture-en skal ikke gi advarsler: \(session.warnings)")
    }

    func testFindElementResolvesByCustomIdAndKindPrefix() throws {
        let project = try loadProject()
        XCTAssertEqual(project.findElement("start")?.id, "start")
        XCTAssertEqual(project.findElement("nel_start")?.id, "start", "3-bokstavs-prefiks + understrek skal tolereres.")
        XCTAssertNil(project.findElement("does-not-exist"))
    }
}

// MARK: - MiniScript-enhetstester

final class MiniScriptTests: XCTestCase {
    private func makeContext(_ vars: [String: (type: String, value: StoryGraphValue)]) -> ScriptContext {
        let ctx = ScriptContext()
        for (name, def) in vars {
            ctx.variableTypes[name] = def.type
            ctx.variables[name] = def.value
        }
        return ctx
    }

    private func run(_ ctx: ScriptContext, _ code: String) {
        _ = MiniScript(ctx).runHtml("<pre><code>\(code)</code></pre>")
    }

    /// `*` binder sterkere enn `+`: 2 + 3 * 4 = 14, ikke 20.
    func testArithmeticPrecedence() {
        let ctx = makeContext(["x": ("float", .double(0))])
        run(ctx, "x = 2 + 3 * 4")
        XCTAssertEqual(ctx.variables["x"], .double(14))
        XCTAssertTrue(ctx.warnings.isEmpty)
    }

    /// `and` binder sterkere enn `or`: true or false and false → true or (false and false) → true.
    func testLogicalPrecedence() {
        let ctx = makeContext(["x": ("boolean", .bool(false))])
        run(ctx, "x = true or false and false")
        XCTAssertEqual(ctx.variables["x"], .bool(true))
    }

    /// Sammenligning binder sterkere enn `is`/`is not`: 1 + 1 is 2 → (1+1) is 2 → true.
    func testComparisonBindsTighterThanIs() {
        let ctx = makeContext(["x": ("boolean", .bool(false))])
        run(ctx, "x = 1 + 1 is 2")
        XCTAssertEqual(ctx.variables["x"], .bool(true))
    }

    func testIsNot() {
        let ctx = makeContext(["x": ("boolean", .bool(false))])
        run(ctx, "x = 1 is not 2")
        XCTAssertEqual(ctx.variables["x"], .bool(true))
        run(ctx, "x = 1 is not 1")
        XCTAssertEqual(ctx.variables["x"], .bool(false))
    }

    func testDivisionByZeroIsCollectedAsErrorNotThrown() {
        let ctx = makeContext(["x": ("float", .double(1))])
        run(ctx, "x = 1 / 0")
        XCTAssertEqual(ctx.warnings.count, 1)
        XCTAssertTrue(ctx.warnings[0].contains("Division by zero"), ctx.warnings[0])
        // Tilordningen skal ikke ha skjedd siden setningen feilet.
        XCTAssertEqual(ctx.variables["x"], .double(1))
    }

    func testModuloByZeroIsCollectedAsError() {
        let ctx = makeContext(["x": ("float", .double(1))])
        run(ctx, "x = 1 % 0")
        XCTAssertTrue(ctx.warnings.contains { $0.contains("Modulo by zero") }, "\(ctx.warnings)")
    }

    func testVisitsOfCurrentElement() {
        let ctx = makeContext(["hits": ("integer", .int(0))])
        ctx.currentElementId = "scene_a"
        ctx.visits["scene_a"] = 3
        run(ctx, "hits = visits()")
        XCTAssertEqual(ctx.variables["hits"], .int(3))
    }

    /// Bar identifikator som IKKE er en kjent variabel tolkes som en element-referanse, akkurat
    /// som en `@[…]`-mention — begge går gjennom `resolveElement`.
    func testVisitsOfIdentifierAndMentionReference() {
        let ctx = makeContext(["hits": ("integer", .int(0))])
        ctx.resolveElement = { ref in ref == "scene_b" ? "scene-b-id" : nil }
        ctx.visits["scene-b-id"] = 7

        run(ctx, "hits = visits(scene_b)")
        XCTAssertEqual(ctx.variables["hits"], .int(7))

        run(ctx, "hits = visits(@[scene_b])")
        XCTAssertEqual(ctx.variables["hits"], .int(7))
    }

    func testUnknownVariableAssignmentIsCollectedAsError() {
        let ctx = makeContext([:])
        run(ctx, "missing = 5")
        XCTAssertTrue(ctx.warnings.contains { $0.contains("Unknown variable") }, "\(ctx.warnings)")
    }

    /// `if/elseif/else/endif` velger første sanne gren, akkurat som i C#-/GDScript-portene.
    func testIfElseifElseSelectsFirstTrueBranch() {
        let ctx = makeContext(["gold": ("integer", .int(5)), "picked": ("string", .string(""))])
        let html = """
        <pre><code>if gold >= 10</code></pre><p>rik</p>\
        <pre><code>elseif gold > 0</code></pre><p>middels</p>\
        <pre><code>else</code></pre><p>fattig</p>\
        <pre><code>endif</code></pre>
        """
        let output = MiniScript(ctx).runHtml(html)
        XCTAssertEqual(StoryGraphHtml.toPlainText(output), "middels")
    }
}
