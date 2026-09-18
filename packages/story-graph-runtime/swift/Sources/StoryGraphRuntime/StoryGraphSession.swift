// StoryGraphSession.swift — spiller en Story Graph-historie. Speiler `StoryGraphSession`
// (Start/Choose/GetVariable/SetVariable/VisitsOf/Restart) og `StoryGraphTranscript` i
// unity/StoryGraphRuntime.cs, og `Session`/`transcript()` i godot/story_graph_runtime.gd:
//
//   ankomst → visits++ → innholdets skript kjøres → utganger er spillerens valg
//   valg → etikett-skriptet kjøres → jumper følges automatisk (sløyfevakt) →
//   forgrening rutes til første sanne betingelse (else = betingelse uten skript) → ingen
//   treff = blindvei
//
// `back()` og `onEvent` finnes ikke i C#-/GDScript-portene (ingen historikk der). De er nye
// for denne (og JS-) porten i denne fasen. `back()` følger nøyaktig samme design som den
// delte TS-motoren (`frontend/shared/narrative-runtime/engine.ts`, funksjonen `back`): gjenopprett
// variabler/besøkstall til slik de var RETT FØR valget som ledet bort fra elementet, og kjør
// elementets innholdsskript på en engangskopi av konteksten for å gjenskape riktig synlig
// if/elseif/else-gren — resultatet av den engangskjøringen skrives ALDRI tilbake til den ekte
// sesjonstilstanden. Skript uten sideeffekter (som denne motoren oppfordrer til) er upåvirket;
// et ikke-idempotent skript i det gjenviste elementet kan i teorien "se" en midlertidig dobbel
// effekt i selve visningen (aldri i persistert tilstand) — samme avveining som i TS-motoren.

import Foundation

/// Et valg (utgående kobling) fra gjeldende visning.
public struct StoryGraphOption: Sendable, Equatable {
    public let connectionId: String
    public let targetId: String
    /// Etikett-HTML uten kodeblokker (til visning).
    public let labelHtml: String

    public init(connectionId: String, targetId: String, labelHtml: String) {
        self.connectionId = connectionId
        self.targetId = targetId
        self.labelHtml = labelHtml
    }

    public var labelText: String { StoryGraphHtml.toPlainText(labelHtml) }
}

/// Gjeldende visning: elementet spilleren står i, med rendret innhold og valgene som er tilgjengelige.
public struct StoryGraphView: Sendable, Equatable {
    public let elementId: String
    public let element: StoryGraphElement
    /// Rendret innhold (betingede seksjoner løst, kodeblokker fjernet).
    public let html: String
    public let options: [StoryGraphOption]
    /// Ingen utganger (element uten koblinger, eller forgrening/jumper uten treff).
    public let deadEnd: Bool
    /// Navn på første festede komponent (taler), eller `nil`.
    public let speakerName: String?

    public init(elementId: String, element: StoryGraphElement, html: String, options: [StoryGraphOption], deadEnd: Bool, speakerName: String?) {
        self.elementId = elementId
        self.element = element
        self.html = html
        self.options = options
        self.deadEnd = deadEnd
        self.speakerName = speakerName
    }

    public var text: String { StoryGraphHtml.toPlainText(html) }
}

/// En hendelse fra sesjonen, egnet for en vertsapp (scene/UI) å reagere på uten å måtte polle
/// `current`. Ikke en del av C#-/GDScript-portene (se filhodet).
public struct StoryGraphEvent: Sendable {
    public enum Kind: String, Sendable {
        case enter, choose, branch, jumper, restart, set, back
    }

    public let step: Int
    public let kind: Kind
    public let elementId: String?
    public let message: String
    /// Variabler som ble endret i forbindelse med denne hendelsen (navn → ny verdi).
    public let changes: [String: StoryGraphValue]
    /// Skriptfeil fra nettopp denne hendelsen (ikke hele sesjonens kumulative advarselliste).
    public let errors: [String]

    public init(step: Int, kind: Kind, elementId: String?, message: String, changes: [String: StoryGraphValue], errors: [String]) {
        self.step = step
        self.kind = kind
        self.elementId = elementId
        self.message = message
        self.changes = changes
        self.errors = errors
    }
}

/// En spillbar sesjon av et lastet Story Graph-prosjekt. Referansetype (`final class`) fordi
/// tilstanden (`current`, variabler, besøkstall, historikk) er mutabel og delt mellom kallene —
/// akkurat som `StoryGraphSession` i C#-porten.
public final class StoryGraphSession {
    private let project: StoryGraphProject
    private let ctx: ScriptContext
    private let script: MiniScript
    private let maxJumps: Int
    private let maxHistory = 200

    private struct Snapshot {
        let elementId: String
        let variables: [String: StoryGraphValue]
        let visits: [String: Int]
    }
    private var history: [Snapshot] = []
    private var step = 0

    public private(set) var current: StoryGraphView?
    /// Fyres for enter/choose/branch/jumper/restart/set/back. `nil` som standard (ingen kostnad hvis ubrukt).
    public var onEvent: ((StoryGraphEvent) -> Void)?

    /// Sesjonens kumulative advarselliste (speiler `Session.Warnings` i C#-porten — skal være
    /// tom for fixture-en, se CHECKLIST.md).
    public var warnings: [String] { ctx.warnings }
    public var isDeadEnd: Bool { current?.deadEnd ?? true }

    public init(project: StoryGraphProject, rng: (() -> Double)? = nil, maxJumps: Int = 100) {
        self.project = project
        self.maxJumps = maxJumps
        let context = ScriptContext()
        if let rng { context.rng = rng }
        ctx = context
        script = MiniScript(context)
        context.resolveElement = { [project] reference in project.findElement(reference)?.id }
        resetState()
    }

    private func resetState() {
        ctx.variables.removeAll()
        ctx.variableTypes.removeAll()
        ctx.visits.removeAll()
        ctx.variableIdToName.removeAll()
        for v in project.variables {
            ctx.variableTypes[v.name] = v.type
            ctx.variables[v.name] = StoryGraphValue.fromDefault(type: v.type, raw: v.defaultValue)
        }
        for v in project.variables {
            ctx.variableIdToName[v.id] = v.name
        }
    }

    @discardableResult
    public func start() -> StoryGraphView? {
        resetState()
        current = nil
        history.removeAll()
        // NB: `project.elements.values.first` er ikke deterministisk i Swift (Dictionary har
        // ingen garantert rekkefølge, i motsetning til C#s Dictionary og Godots Dictionary som i
        // praksis bevarer innsettingsrekkefølgen) — brukes kun når `startingElement` mangler/er
        // ugyldig, noe fixture-prosjektet ikke gjør (se README/rapport for detaljer).
        let startElement = project.findElement(project.startingElement) ?? project.elements.values.first
        guard let startElement else {
            ctx.warnings.append("No starting element.")
            return nil
        }
        return enter(startElement.id, depth: 0)
    }

    @discardableResult
    public func restart() -> StoryGraphView? {
        let v = start()
        emit(.restart, elementId: v?.elementId, message: "Startet på nytt.", changes: [:], errors: [])
        return v
    }

    @discardableResult
    public func choose(connectionId: String) -> StoryGraphView? {
        guard let current else { return nil }
        guard let option = current.options.first(where: { $0.connectionId == connectionId }),
              let conn = project.connections[connectionId] else {
            return current
        }
        history.append(Snapshot(elementId: current.elementId, variables: ctx.variables, visits: ctx.visits))
        if history.count > maxHistory { history.removeFirst(history.count - maxHistory) }

        let warningsBefore = ctx.warnings.count
        ctx.changes.removeAll()
        if StoryGraphHtml.hasScript(conn.labelHtml) {
            _ = script.runHtml(conn.labelHtml)
        }
        emit(.choose, elementId: current.elementId, message: "Valg tatt.", changes: ctx.changes, errors: Array(ctx.warnings[warningsBefore...]))
        return enter(option.targetId, depth: 0)
    }

    /// Gå tilbake til forrige visning (se filhodet for hva dette betyr semantisk). Returnerer
    /// gjeldende visning uendret hvis det ikke finnes historikk å gå tilbake til.
    @discardableResult
    public func back() -> StoryGraphView? {
        guard let snap = history.popLast() else { return current }
        ctx.variables = snap.variables
        ctx.visits = snap.visits
        ctx.currentElementId = snap.elementId
        guard let element = project.elements[snap.elementId] else {
            current = nil
            emit(.back, elementId: snap.elementId, message: "Elementet finnes ikke lenger.", changes: [:], errors: [])
            return nil
        }
        let preview = ScriptContext()
        preview.variables = snap.variables
        preview.variableTypes = ctx.variableTypes
        preview.visits = snap.visits
        preview.variableIdToName = ctx.variableIdToName
        preview.resolveElement = ctx.resolveElement
        preview.rng = ctx.rng
        preview.currentElementId = snap.elementId
        let previewScript = MiniScript(preview)
        let html = previewScript.runHtml(element.contentHtml)
        let options = buildOptions(for: element)
        let view = StoryGraphView(elementId: element.id, element: element, html: html, options: options, deadEnd: options.isEmpty, speakerName: speakerName(for: element))
        current = view
        emit(.back, elementId: element.id, message: "Gikk tilbake.", changes: [:], errors: preview.warnings)
        return view
    }

    public func getVariable(_ name: String) -> StoryGraphValue? {
        ctx.variables[name]
    }

    public func setVariable(_ name: String, _ value: StoryGraphValue) {
        guard let type = ctx.variableTypes[name] else {
            ctx.warnings.append("Unknown variable '\(name)'")
            return
        }
        let coerced = StoryGraphValue.coerce(type: type, from: value)
        ctx.variables[name] = coerced
        emit(.set, elementId: current?.elementId, message: "Debugger: \(name) satt.", changes: [name: coerced], errors: [])
    }

    /// Antall besøk på et element, gitt id ELLER customId. 0 hvis referansen er ukjent.
    public func visits(of reference: String) -> Int {
        ctx.visitsOf(project.findElement(reference)?.id)
    }

    // MARK: internt

    private func enter(_ id: String, depth: Int) -> StoryGraphView? {
        if depth > maxJumps {
            let warningsBefore = ctx.warnings.count
            ctx.warnings.append("Stopped: more than \(maxJumps) consecutive jumps (loop?).")
            let view = deadEndView(id)
            current = view
            emit(.jumper, elementId: id, message: "Stoppet: for mange hopp på rad.", changes: [:], errors: Array(ctx.warnings[warningsBefore...]))
            return view
        }
        ctx.currentElementId = id
        ctx.visits[id] = ctx.visitsOf(id) + 1

        if let jumper = project.jumpers[id] {
            guard let target = project.findElement(jumper.elementId) else {
                let view = deadEndView(id)
                current = view
                emit(.jumper, elementId: id, message: "Jumper uten mål.", changes: [:], errors: [])
                return view
            }
            emit(.jumper, elementId: id, message: "Jumper fulgt.", changes: [:], errors: [])
            return enter(target.id, depth: depth + 1)
        }

        if let branch = project.branches[id] {
            var order: [String] = []
            if let ifCondition = branch.ifCondition { order.append(ifCondition) }
            order.append(contentsOf: branch.elseIfConditions)
            if let elseCondition = branch.elseCondition { order.append(elseCondition) }

            let warningsBefore = ctx.warnings.count
            for conditionId in order {
                guard let condition = project.conditions[conditionId] else { continue }
                let scriptText = condition.script
                let take = (scriptText?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) || script.evaluateCondition(scriptText ?? "")
                if !take { continue }
                if let outputId = condition.output, let next = project.connections[outputId], let targetId = next.targetId {
                    emit(.branch, elementId: id, message: "Forgrening: betingelse traff.", changes: [:], errors: Array(ctx.warnings[warningsBefore...]))
                    return enter(targetId, depth: depth + 1)
                }
                let view = deadEndView(id)
                current = view
                emit(.branch, elementId: id, message: "Forgrening: betingelsen traff, men utgangen er ikke koblet.", changes: [:], errors: Array(ctx.warnings[warningsBefore...]))
                return view
            }
            let view = deadEndView(id)
            current = view
            emit(.branch, elementId: id, message: "Forgrening: ingen betingelse traff.", changes: [:], errors: Array(ctx.warnings[warningsBefore...]))
            return view
        }

        guard let element = project.elements[id] else {
            ctx.warnings.append("Element '\(id)' does not exist.")
            return current
        }

        let warningsBefore = ctx.warnings.count
        ctx.changes.removeAll()
        let html = script.runHtml(element.contentHtml)
        let options = buildOptions(for: element)
        let view = StoryGraphView(
            elementId: id,
            element: element,
            html: html,
            options: options,
            deadEnd: options.isEmpty,
            speakerName: speakerName(for: element)
        )
        current = view
        emit(.enter, elementId: id, message: "Ankomst.", changes: ctx.changes, errors: Array(ctx.warnings[warningsBefore...]))
        return view
    }

    private func deadEndView(_ id: String) -> StoryGraphView {
        let element = project.elements[id] ?? StoryGraphElement(id: id, customId: nil, titleHtml: "", contentHtml: "", outputs: [], components: [])
        return StoryGraphView(elementId: id, element: element, html: "", options: [], deadEnd: true, speakerName: nil)
    }

    private func buildOptions(for element: StoryGraphElement) -> [StoryGraphOption] {
        var options: [StoryGraphOption] = []
        for outputId in element.outputs {
            guard let connection = project.connections[outputId], let targetId = connection.targetId else { continue }
            let targetExists = project.elements[targetId] != nil || project.branches[targetId] != nil || project.jumpers[targetId] != nil
            guard targetExists else { continue }
            options.append(StoryGraphOption(connectionId: connection.id, targetId: targetId, labelHtml: StoryGraphHtml.stripCodeBlocks(connection.labelHtml)))
        }
        return options
    }

    private func speakerName(for element: StoryGraphElement) -> String? {
        for componentId in element.components {
            if let name = project.componentNames[componentId] { return name }
        }
        return nil
    }

    private func emit(_ kind: StoryGraphEvent.Kind, elementId: String?, message: String, changes: [String: StoryGraphValue], errors: [String]) {
        guard let onEvent else { return }
        step += 1
        onEvent(StoryGraphEvent(step: step, kind: kind, elementId: elementId, message: message, changes: changes, errors: errors))
    }
}

// MARK: - transkript (paritetssjekk)

/// Deterministisk gjennomspilling som tekst — samme format som C#-/GDScript-portene
/// (`StoryGraphTranscript.Play` / `StoryGraphRuntime.transcript`). Diffes mot
/// `fixtures/sample-project.expected.txt` i `ParityTests`.
public enum StoryGraphTranscript {
    public static func play(_ project: StoryGraphProject, maxSteps: Int = 12, pick: ((Int, Int) -> Int)? = nil) -> String {
        let session = StoryGraphSession(project: project, rng: { 0.5 })
        let names = project.variables.map(\.name).sorted()
        var lines: [String] = []

        func formatVariable(_ value: StoryGraphValue?) -> String {
            guard let value else { return "\"\"" }
            switch value {
            case .bool(let b): return b ? "true" : "false"
            case .int(let n): return String(n)
            case .double(let d): return StoryGraphValue.formatNumber(d)
            case .string(let s):
                let escaped = s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "\"", with: "\\\"")
                return "\"\(escaped)\""
            }
        }

        func dump(_ view: StoryGraphView?) {
            guard let view else { lines.append("(no view)"); return }
            let ident: String
            if let customId = view.element.customId?.trimmingCharacters(in: .whitespacesAndNewlines), !customId.isEmpty {
                ident = customId
            } else {
                ident = view.elementId
            }
            lines.append("@ \(ident) | \(view.element.titleText.trimmingCharacters(in: .whitespacesAndNewlines))")
            let text = view.text.trimmingCharacters(in: .whitespacesAndNewlines)
            if !text.isEmpty {
                let parts = text.split(whereSeparator: { $0.isNewline }).map(String.init)
                lines.append("  " + parts.joined(separator: " / "))
            }
            for (i, option) in view.options.enumerated() {
                lines.append("  \(i + 1)) \(option.labelText.trimmingCharacters(in: .whitespacesAndNewlines))")
            }
            if view.deadEnd { lines.append("  (end)") }
            let varsLine = names.map { "\($0)=\(formatVariable(session.getVariable($0)))" }.joined(separator: " ")
            lines.append("  vars: \(varsLine)")
        }

        var view = session.start()
        dump(view)
        var stepIndex = 0
        while stepIndex < maxSteps, let v = view, !v.deadEnd, !v.options.isEmpty {
            let idx: Int
            if let pick {
                idx = min(max(pick(v.options.count, stepIndex), 0), v.options.count - 1)
            } else {
                idx = 0
            }
            lines.append("> choose \(idx + 1)")
            view = session.choose(connectionId: v.options[idx].connectionId)
            dump(view)
            stepIndex += 1
        }
        return lines.joined(separator: "\n") + "\n"
    }
}
