// StoryGraphProject.swift — prosjektmodell for Story Graph-eksporter (Arcweave-kompatibel
// project.json). Speiler feltnavnene i unity/StoryGraphRuntime.cs (StoryGraphProject,
// FromJObject) og godot/story_graph_runtime.gd (Project, from_dict) linje for linje.
//
// JSON-et er løst typet (ulike nøkler har ulik form: "elements" vs. "branches" vs. et
// "variables"-tre der noen oppføringer er mapper med "children" og skal hoppes over), så
// vi leser det med JSONSerialization til [String: Any] og bygger modellen manuelt —
// samme tilnærming som JObject-vandringen i C#-porten og Dictionary-vandringen i
// GDScript-porten. Ingen tredjeparts-avhengighet.

import Foundation

/// Et element (scene/node) i historien.
public struct StoryGraphElement: Sendable, Equatable {
    public let id: String
    public let customId: String?
    public let titleHtml: String
    public let contentHtml: String
    public let outputs: [String]
    public let components: [String]

    public init(id: String, customId: String?, titleHtml: String, contentHtml: String, outputs: [String], components: [String]) {
        self.id = id
        self.customId = customId
        self.titleHtml = titleHtml
        self.contentHtml = contentHtml
        self.outputs = outputs
        self.components = components
    }

    /// Ren tekst-tittel (samme som `StoryGraphHtml.toPlainText(titleHtml)` i de andre portene).
    public var titleText: String { StoryGraphHtml.toPlainText(titleHtml) }
}

/// En forgrening: ruter automatisk til første sanne betingelse (if/elseif/else).
public struct StoryGraphBranch: Sendable, Equatable {
    public let id: String
    public let ifCondition: String?
    public let elseIfConditions: [String]
    public let elseCondition: String?

    public init(id: String, ifCondition: String?, elseIfConditions: [String], elseCondition: String?) {
        self.id = id
        self.ifCondition = ifCondition
        self.elseIfConditions = elseIfConditions
        self.elseCondition = elseCondition
    }
}

/// En betingelse tilhørende en forgrening. `script == nil` (eller tomt) = alltid sann (else-grenen).
public struct StoryGraphCondition: Sendable, Equatable {
    public let id: String
    public let script: String?
    public let output: String?

    public init(id: String, script: String?, output: String?) {
        self.id = id
        self.script = script
        self.output = output
    }
}

/// En jumper: følges automatisk til `elementId` (med sløyfevakt i sesjonen).
public struct StoryGraphJumper: Sendable, Equatable {
    public let id: String
    public let elementId: String?

    public init(id: String, elementId: String?) {
        self.id = id
        self.elementId = elementId
    }
}

/// En kobling (utgang) mellom to noder, eventuelt med etikett-skript som kjøres ved valg.
public struct StoryGraphConnection: Sendable, Equatable {
    public let id: String
    public let sourceId: String?
    public let targetId: String?
    public let labelHtml: String

    public init(id: String, sourceId: String?, targetId: String?, labelHtml: String) {
        self.id = id
        self.sourceId = sourceId
        self.targetId = targetId
        self.labelHtml = labelHtml
    }
}

/// En rå JSON-verdi slik den kommer fra `variables[id].value` i eksporten. Holdt separat fra
/// `StoryGraphValue` (skript-verdiene) fordi denne kan være `null` før typen er kjent —
/// `StoryGraphValue.coerce(type:from:)` gjør selve konverteringen (speiler `FromJson` + `Coerce`
/// i C#-porten).
public enum StoryGraphJSONValue: Sendable, Equatable {
    case bool(Bool)
    case number(Double)
    case string(String)
    case null

    fileprivate static func from(_ raw: Any?) -> StoryGraphJSONValue {
        guard let raw, !(raw is NSNull) else { return .null }
        // Rekkefølgen er viktig: en JSON-bool kommer fra JSONSerialization som en NSNumber
        // som også svarer `true` på `as? Bool`, så bool-sjekken må komme først.
        if let b = raw as? Bool { return .bool(b) }
        if let n = raw as? NSNumber { return .number(n.doubleValue) }
        if let s = raw as? String { return .string(s) }
        return .null
    }
}

/// En global variabel (fra `variables`-treet i eksporten; mappe-noder med "children" er hoppet over).
public struct StoryGraphVariable: Sendable, Equatable {
    /// Nøkkelen i `project.json` sine `variables` (det `@[…]`-mentions viser til).
    public let id: String
    public let name: String
    /// `integer | float | boolean | string` (Arcweaves typenavn).
    public let type: String
    public let defaultValue: StoryGraphJSONValue

    public init(id: String, name: String, type: String, defaultValue: StoryGraphJSONValue) {
        self.id = id
        self.name = name
        self.type = type
        self.defaultValue = defaultValue
    }
}

public enum StoryGraphProjectError: Error, Sendable {
    /// Teksten kunne ikke tolkes som UTF-8.
    case invalidEncoding
    /// JSON-roten er ikke et objekt.
    case invalidRoot
}

/// Et lastet Story Graph-prosjekt. Bygges kun via `load(from:)` / `load(json:)`.
public struct StoryGraphProject: Sendable {
    public let name: String
    public let startingElement: String?
    public let elements: [String: StoryGraphElement]
    public let branches: [String: StoryGraphBranch]
    public let jumpers: [String: StoryGraphJumper]
    public let connections: [String: StoryGraphConnection]
    public let conditions: [String: StoryGraphCondition]
    /// Globale variabler. Rekkefølgen følger ikke nødvendigvis JSON-deklarasjonsrekkefølgen
    /// (JSONSerialization garanterer ikke nøkkelrekkefølge på Linux/Foundation), men ingenting
    /// i denne motoren er avhengig av den — `variables`-linja i transkriptet sorteres uansett
    /// alfabetisk på navn, akkurat som i C#- og GDScript-portene.
    public let variables: [StoryGraphVariable]
    public let componentNames: [String: String]
    public let warnings: [String]

    public init(
        name: String,
        startingElement: String?,
        elements: [String: StoryGraphElement],
        branches: [String: StoryGraphBranch],
        jumpers: [String: StoryGraphJumper],
        connections: [String: StoryGraphConnection],
        conditions: [String: StoryGraphCondition],
        variables: [StoryGraphVariable],
        componentNames: [String: String],
        warnings: [String]
    ) {
        self.name = name
        self.startingElement = startingElement
        self.elements = elements
        self.branches = branches
        self.jumpers = jumpers
        self.connections = connections
        self.conditions = conditions
        self.variables = variables
        self.componentNames = componentNames
        self.warnings = warnings
    }

    public static func load(json: String) throws -> StoryGraphProject {
        guard let data = json.data(using: .utf8) else { throw StoryGraphProjectError.invalidEncoding }
        return try load(from: data)
    }

    public static func load(from data: Data) throws -> StoryGraphProject {
        let parsed = try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
        guard let root = parsed as? [String: Any] else { throw StoryGraphProjectError.invalidRoot }
        return fromDictionary(root)
    }

    private static func fromDictionary(_ root: [String: Any]) -> StoryGraphProject {
        var elements: [String: StoryGraphElement] = [:]
        for (id, o) in entries(root["elements"]) {
            elements[id] = StoryGraphElement(
                id: id,
                customId: o["customId"] as? String,
                titleHtml: o["title"] as? String ?? "",
                contentHtml: o["content"] as? String ?? "",
                outputs: strings(o["outputs"]),
                components: strings(o["components"])
            )
        }

        var branches: [String: StoryGraphBranch] = [:]
        for (id, o) in entries(root["branches"]) {
            let c = o["conditions"] as? [String: Any]
            branches[id] = StoryGraphBranch(
                id: id,
                ifCondition: c?["ifCondition"] as? String,
                elseIfConditions: strings(c?["elseIfConditions"]),
                elseCondition: c?["elseCondition"] as? String
            )
        }

        var jumpers: [String: StoryGraphJumper] = [:]
        for (id, o) in entries(root["jumpers"]) {
            jumpers[id] = StoryGraphJumper(id: id, elementId: o["elementId"] as? String)
        }

        var connections: [String: StoryGraphConnection] = [:]
        for (id, o) in entries(root["connections"]) {
            connections[id] = StoryGraphConnection(
                id: id,
                sourceId: o["sourceid"] as? String,
                targetId: o["targetid"] as? String,
                labelHtml: o["label"] as? String ?? ""
            )
        }

        var conditions: [String: StoryGraphCondition] = [:]
        for (id, o) in entries(root["conditions"]) {
            conditions[id] = StoryGraphCondition(id: id, script: o["script"] as? String, output: o["output"] as? String)
        }

        var variables: [StoryGraphVariable] = []
        for (id, o) in entries(root["variables"]) {
            if o["children"] != nil { continue } // mappe-node, ikke en variabel
            variables.append(StoryGraphVariable(
                id: id,
                name: o["name"] as? String ?? id,
                type: o["type"] as? String ?? "string",
                defaultValue: StoryGraphJSONValue.from(o["value"])
            ))
        }

        var componentNames: [String: String] = [:]
        for (id, o) in entries(root["components"]) {
            if o["children"] != nil { continue }
            componentNames[id] = o["name"] as? String ?? id
        }

        var warnings: [String] = []
        if let attrs = root["attributes"] as? [String: Any] {
            let hasComponentAttribute = attrs.values.contains { value in
                (value as? [String: Any])?["cType"] as? String == "components"
            }
            if hasComponentAttribute {
                warnings.append("Component attributes are not exposed as variables in this runtime (use the JS package or Arcweave's plugins).")
            }
        }

        return StoryGraphProject(
            name: root["name"] as? String ?? "",
            startingElement: root["startingElement"] as? String,
            elements: elements,
            branches: branches,
            jumpers: jumpers,
            connections: connections,
            conditions: conditions,
            variables: variables,
            componentNames: componentNames,
            warnings: warnings
        )
    }

    /// Iterér over oppføringer i et JSON-objekt der verdien selv er et objekt (speiler `Entries` i C#-porten).
    private static func entries(_ token: Any?) -> [(String, [String: Any])] {
        guard let dict = token as? [String: Any] else { return [] }
        var out: [(String, [String: Any])] = []
        for (key, value) in dict {
            if let v = value as? [String: Any] { out.append((key, v)) }
        }
        return out
    }

    /// Strengene i et JSON-array, ikke-strenger droppet (speiler `Strings` i C#-porten).
    private static func strings(_ token: Any?) -> [String] {
        guard let array = token as? [Any] else { return [] }
        return array.compactMap { $0 as? String }
    }

    /// Slå opp et element på id eller customId (prefiks som "nel_" tolereres). `nil` hvis ukjent.
    public func findElement(_ reference: String?) -> StoryGraphElement? {
        guard let reference, !reference.isEmpty else { return nil }
        if let e = elements[reference] { return e }
        let stripped = Self.stripKindPrefix(reference)
        if stripped != reference, let e = elements[stripped] { return e }
        return elements.values.first { ($0.customId?.isEmpty == false) && $0.customId == reference }
    }

    /// Fjerner et 3-bokstavs små-prefiks + understrek (f.eks. "nel_") fra starten av referansen,
    /// akkurat som `Regex.Replace(reference, "^[a-z]{3}_", "")` i C#-porten.
    private static func stripKindPrefix(_ reference: String) -> String {
        let chars = Array(reference)
        guard chars.count >= 4 else { return reference }
        guard chars[3] == "_" else { return reference }
        for i in 0..<3 where !(chars[i].isASCII && chars[i].isLowercase && chars[i].isLetter) {
            return reference
        }
        return String(chars[4...])
    }
}
