// MiniScript.swift — verdityper + tokenizer/parser/evaluator for arcscript-delsettet.
// Speiler `StoryGraphValue`, `ScriptContext` og `MiniScript` i unity/StoryGraphRuntime.cs
// og `Value`/`Interp` i godot/story_graph_runtime.gd. Samme presedens-tabell, samme
// feilmeldinger (så advarsler i `errors`/`Session.Warnings` er sammenlignbare på tvers
// av portene).
//
// Delsett (se ../README.md):
//   tilordning  = += -= *= /= %=          literaler   int, float, bool, 'str' / "str"
//   if / elseif / else / endif rundt prosa (én setning per linje i <pre><code>)
//   sammenligning  == != < > <= >=  is / is not     logikk  and && or || not !
//   aritmetikk  + - * / %  unær - +       funksjoner  visits([ref]) abs min max round sqr sqrt random roll
//   referanser  @[id-eller-customId] (element-visits) / @[variabel-id]

import Foundation

// MARK: - verdier

/// Skript-verdier. Internt er litteraler og aritmetikk ALLTID `.bool`, `.double` eller
/// `.string` — akkurat som C#-/GDScript-portenes tre-verdi-representasjon, der et "heltall"
/// bare er et `double` uten brøkdel. `.int` oppstår KUN når en variabel deklarert med typen
/// "integer"/"int" leses eller skrives (`coerce(type:from:)`), slik at Swift-konsumenter av
/// `getVariable`/`setVariable` får en naturlig typet verdi i stedet for et `.double` uten
/// desimaler. `asDouble` behandler `.int` og `.double` likt overalt, så dette er kun en
/// presentasjonsdetalj ved variabel-grensen — det endrer ingen beregning sammenlignet med
/// C#/GDScript.
public enum StoryGraphValue: Sendable, Equatable {
    case bool(Bool)
    case int(Int)
    case double(Double)
    case string(String)

    public var isString: Bool {
        if case .string = self { return true }
        return false
    }

    /// Speiler `StoryGraphValue.Truthy` i C#-porten.
    public var isTruthy: Bool {
        switch self {
        case .bool(let b): return b
        case .int(let n): return n != 0
        case .double(let d): return d != 0
        case .string(let s): return !s.isEmpty
        }
    }

    /// Speiler `StoryGraphValue.Num` (ukjent/ikke-numerisk streng → 0).
    public var asDouble: Double {
        switch self {
        case .bool(let b): return b ? 1 : 0
        case .int(let n): return Double(n)
        case .double(let d): return d
        case .string(let s): return Double(s.trimmingCharacters(in: .whitespaces)) ?? 0
        }
    }

    /// Tekstlig visning uten anførselstegn (speiler `StoryGraphValue.Str`).
    public var asDisplayString: String {
        switch self {
        case .bool(let b): return b ? "true" : "false"
        case .int(let n): return String(n)
        case .double(let d): return StoryGraphValue.formatNumber(d)
        case .string(let s): return s
        }
    }

    /// Speiler `StoryGraphValue.Format`: heltallige doubler uten desimaler, ellers avrundet til 3.
    public static func formatNumber(_ d: Double) -> String {
        if abs(d - d.rounded()) < 1e-9 {
            return String(clampedInt64(d.rounded()))
        }
        let scaled = (d * 1000).rounded() / 1000
        var text = String(format: "%.3f", scaled)
        while text.hasSuffix("0") { text.removeLast() }
        if text.hasSuffix(".") { text.removeLast() }
        if text == "-0" { text = "0" }
        return text
    }

    private static func clampedInt64(_ d: Double) -> Int64 {
        if d.isNaN { return 0 }
        if d >= Double(Int64.max) { return Int64.max }
        if d <= Double(Int64.min) { return Int64.min }
        return Int64(d)
    }

    private static func clampedInt(_ d: Double) -> Int {
        if d.isNaN { return 0 }
        if d >= Double(Int.max) { return Int.max }
        if d <= Double(Int.min) { return Int.min }
        return Int(d)
    }

    /// Speiler `StoryGraphValue.Coerce(type, v)`.
    public static func coerce(type: String, from value: StoryGraphValue) -> StoryGraphValue {
        switch type {
        case "boolean", "bool":
            return .bool(value.isTruthy)
        case "integer", "int":
            return .int(clampedInt(value.asDouble.rounded(.towardZero)))
        case "float":
            return .double(value.asDouble)
        default:
            return .string(value.asDisplayString)
        }
    }

    /// Speiler `Coerce(type, FromJson(raw))`: konverterer prosjektets rå JSON-standardverdi
    /// (som kan være `null`) til en skript-verdi av variabelens deklarerte type.
    public static func fromDefault(type: String, raw: StoryGraphJSONValue) -> StoryGraphValue {
        switch type {
        case "boolean", "bool":
            switch raw {
            case .null: return .bool(false)
            case .bool(let b): return .bool(b)
            case .number(let n): return .bool(n != 0)
            case .string(let s): return .bool(!s.isEmpty)
            }
        case "integer", "int":
            return .int(clampedInt(numericDefault(raw).rounded(.towardZero)))
        case "float":
            return .double(numericDefault(raw))
        default:
            switch raw {
            case .null: return .string("")
            case .bool(let b): return .string(b ? "true" : "false")
            case .number(let n): return .string(formatNumber(n))
            case .string(let s): return .string(s)
            }
        }
    }

    private static func numericDefault(_ raw: StoryGraphJSONValue) -> Double {
        switch raw {
        case .null: return 0
        case .bool(let b): return b ? 1 : 0
        case .number(let n): return n
        case .string(let s): return Double(s.trimmingCharacters(in: .whitespaces)) ?? 0
        }
    }

    /// Speiler `StoryGraphValue.Equal`.
    public static func equal(_ a: StoryGraphValue, _ b: StoryGraphValue) -> Bool {
        if isBool(a) || isBool(b) { return a.isTruthy == b.isTruthy }
        if case .string(let sa) = a, case .string(let sb) = b { return sa == sb }
        if a.isString || b.isString {
            if let na = numericIfParsable(a), let nb = numericIfParsable(b) {
                return abs(na - nb) < 1e-9
            }
            return a.asDisplayString == b.asDisplayString
        }
        return abs(a.asDouble - b.asDouble) < 1e-9
    }

    private static func isBool(_ v: StoryGraphValue) -> Bool {
        if case .bool = v { return true }
        return false
    }

    /// `nil` hvis `v` er en streng som ikke kan tolkes som et tall (speiler `double.TryParse`).
    private static func numericIfParsable(_ v: StoryGraphValue) -> Double? {
        if case .string(let s) = v { return Double(s.trimmingCharacters(in: .whitespaces)) }
        return v.asDouble
    }
}

// MARK: - kjøretidsfeil (aldri kastet til host — samlet i `ScriptContext.warnings`/`Session.warnings`)

struct ScriptRuntimeError: Error {
    let message: String
}

// MARK: - kjøretidskontekst

/// Delt tilstand for én sesjon: variabler, besøkstall, elementoppslag. `internal` — speiler at
/// `ScriptContext` er `internal sealed class` i C#-porten; testmålet ser den via `@testable import`.
final class ScriptContext {
    var variables: [String: StoryGraphValue] = [:]
    var variableTypes: [String: String] = [:]
    var visits: [String: Int] = [:]
    var variableIdToName: [String: String] = [:]
    /// Referanse → element-id, eller `nil`. Satt av `StoryGraphSession`.
    var resolveElement: (String) -> String? = { _ in nil }
    var rng: () -> Double = { 0.5 }
    var currentElementId: String?
    var warnings: [String] = []
    /// Variabelendringer fra siste `runHtml`/statement-kjøring (nullstilles av kalleren før kjøring).
    var changes: [String: StoryGraphValue] = [:]

    func visitsOf(_ elementId: String?) -> Int {
        guard let elementId else { return 0 }
        return visits[elementId] ?? 0
    }
}

// MARK: - tokenizer/parser/evaluator

/// Tolker for arcscript-delsettet. Én instans er bundet til én `ScriptContext` og gjenbrukes
/// for hver linje/uttrykk som kjøres (tokens/posisjon er per-kall-tilstand).
final class MiniScript {
    private enum TokenKind: Equatable { case num, str, ident, mention, op, keyword, end }
    private struct Token { let kind: TokenKind; let text: String; let num: Double }

    private static let keywords: Set<String> = ["if", "elseif", "else", "endif", "is", "not", "and", "or", "true", "false"]
    private static let operators = ["==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "%=", "&&", "||", "<", ">", "=", "+", "-", "*", "/", "%", "!", "(", ")", ","]

    private struct Frame { var parent: Bool; var active: Bool; var taken: Bool }

    private let ctx: ScriptContext
    private var toks: [Token] = [Token(kind: .end, text: "", num: 0)]
    private var pos = 0

    init(_ ctx: ScriptContext) {
        self.ctx = ctx
    }

    // MARK: tokenizer

    private static func isDigit(_ c: Character) -> Bool { c.isASCII && c.isNumber }

    private static func matchesOperator(_ op: String, _ chars: [Character], at i: Int) -> Bool {
        let opChars = Array(op)
        guard i + opChars.count <= chars.count else { return false }
        for k in 0..<opChars.count where chars[i + k] != opChars[k] { return false }
        return true
    }

    private static func tokenize(_ src: String) throws -> [Token] {
        var tokens: [Token] = []
        let chars = Array(src)
        let n = chars.count
        var i = 0
        while i < n {
            let c = chars[i]
            if c.isWhitespace { i += 1; continue }
            if c == "@", i + 1 < n, chars[i + 1] == "[" {
                var close = -1
                var j = i
                while j < n { if chars[j] == "]" { close = j; break }; j += 1 }
                guard close >= 0 else { throw ScriptRuntimeError(message: "Unterminated @[ reference") }
                let text = String(chars[(i + 2)..<close]).trimmingCharacters(in: .whitespacesAndNewlines)
                tokens.append(Token(kind: .mention, text: text, num: 0))
                i = close + 1
                continue
            }
            if isDigit(c) || (c == "." && i + 1 < n && isDigit(chars[i + 1])) {
                let start = i
                while i < n && (isDigit(chars[i]) || chars[i] == ".") { i += 1 }
                let numText = String(chars[start..<i])
                guard let value = Double(numText) else { throw ScriptRuntimeError(message: "Invalid number '\(numText)'") }
                tokens.append(Token(kind: .num, text: "", num: value))
                continue
            }
            if c == "'" || c == "\"" {
                let quote = c
                i += 1
                var buf = ""
                while i < n && chars[i] != quote {
                    if chars[i] == "\\" && i + 1 < n { i += 1 }
                    buf.append(chars[i])
                    i += 1
                }
                i += 1
                tokens.append(Token(kind: .str, text: buf, num: 0))
                continue
            }
            if c.isLetter || c == "_" || c == "$" {
                let start = i
                while i < n && (chars[i].isLetter || isDigit(chars[i]) || chars[i] == "_" || chars[i] == "$" || chars[i] == ".") { i += 1 }
                var word = String(chars[start..<i])
                while word.hasPrefix("$") { word.removeFirst() }
                tokens.append(Token(kind: keywords.contains(word) ? .keyword : .ident, text: word, num: 0))
                continue
            }
            guard let op = operators.first(where: { matchesOperator($0, chars, at: i) }) else {
                throw ScriptRuntimeError(message: "Unexpected character '\(c)'")
            }
            tokens.append(Token(kind: .op, text: op, num: 0))
            i += op.count
        }
        tokens.append(Token(kind: .end, text: "", num: 0))
        return tokens
    }

    private var peek: Token { toks[pos] }
    private func isOp(_ s: String) -> Bool { peek.kind == .op && peek.text == s }
    private func isKw(_ s: String) -> Bool { peek.kind == .keyword && peek.text == s }
    private func next() -> Token { let t = toks[pos]; pos += 1; return t }
    private func expect(_ op: String) throws {
        guard isOp(op) else { throw ScriptRuntimeError(message: "Expected '\(op)'") }
        pos += 1
    }

    // MARK: offentlig API (internal — sesjonen er inngangspunktet utad)

    func evaluateCondition(_ script: String) -> Bool {
        if script.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return true }
        do {
            toks = try Self.tokenize(script)
            pos = 0
            let v = try or()
            return v.isTruthy
        } catch {
            ctx.warnings.append("Condition error: \(Self.describe(error)) in '\(script)'")
            return false
        }
    }

    /// Kjør element-/etikett-HTML: utfør kodesegmentene, returner den aktive prosa-HTML-en.
    func runHtml(_ html: String) -> String {
        var frames: [Frame] = []
        var output = ""
        func active() -> Bool { frames.isEmpty || frames[frames.count - 1].active }
        for seg in StoryGraphHtml.splitSegments(html) {
            if !seg.isCode {
                if active() { output += seg.text }
                continue
            }
            for rawLine in seg.text.split(separator: "\n", omittingEmptySubsequences: false) {
                let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
                if line.isEmpty || line.hasPrefix("//") { continue }
                do {
                    toks = try Self.tokenize(line)
                    pos = 0
                    if isKw("if") {
                        pos += 1
                        let parent = active()
                        let on = try parent && or().isTruthy
                        frames.append(Frame(parent: parent, active: on, taken: on))
                    } else if isKw("elseif") {
                        pos += 1
                        guard !frames.isEmpty else { throw ScriptRuntimeError(message: "elseif without if") }
                        var f = frames[frames.count - 1]
                        if f.taken {
                            f.active = false
                        } else {
                            f.active = try f.parent && or().isTruthy
                            f.taken = f.taken || f.active
                        }
                        frames[frames.count - 1] = f
                    } else if isKw("else") {
                        pos += 1
                        guard !frames.isEmpty else { throw ScriptRuntimeError(message: "else without if") }
                        var f = frames[frames.count - 1]
                        f.active = f.parent && !f.taken
                        f.taken = true
                        frames[frames.count - 1] = f
                    } else if isKw("endif") {
                        pos += 1
                        guard !frames.isEmpty else { throw ScriptRuntimeError(message: "endif without if") }
                        frames.removeLast()
                    } else if active() {
                        try statement()
                    }
                } catch {
                    ctx.warnings.append("Script error: \(Self.describe(error)) in '\(line)'")
                }
            }
        }
        return output
    }

    private static func describe(_ error: Error) -> String {
        (error as? ScriptRuntimeError)?.message ?? "\(error)"
    }

    // MARK: setninger

    private func isAssignOp(_ text: String) -> Bool {
        if text == "=" { return true }
        guard text.count == 2, text.hasSuffix("="), let first = text.first else { return false }
        return "+-*/%".contains(first)
    }

    private func statement() throws {
        if peek.kind == .ident, toks[pos + 1].kind == .op, isAssignOp(toks[pos + 1].text) {
            let name = next().text
            let op = next().text
            let rhs = try or()
            guard let currentType = ctx.variableTypes[name], let cur = ctx.variables[name] else {
                throw ScriptRuntimeError(message: "Unknown variable '\(name)'")
            }
            let val: StoryGraphValue
            switch op {
            case "=":
                val = rhs
            case "+=":
                val = (cur.isString || rhs.isString) ? .string(cur.asDisplayString + rhs.asDisplayString) : .double(cur.asDouble + rhs.asDouble)
            case "-=":
                val = .double(cur.asDouble - rhs.asDouble)
            case "*=":
                val = .double(cur.asDouble * rhs.asDouble)
            case "/=":
                let d = rhs.asDouble
                guard d != 0 else { throw ScriptRuntimeError(message: "Division by zero") }
                val = .double(cur.asDouble / d)
            default: // "%="
                let d = rhs.asDouble
                guard d != 0 else { throw ScriptRuntimeError(message: "Modulo by zero") }
                val = .double(cur.asDouble.truncatingRemainder(dividingBy: d))
            }
            let coerced = StoryGraphValue.coerce(type: currentType, from: val)
            ctx.variables[name] = coerced
            ctx.changes[name] = coerced
            return
        }
        _ = try or() // uttrykk-setning (funksjonskall) — verdien forkastes
    }

    // MARK: uttrykksgrammatikk (lav → høy presedens): or, and, is/is not, == !=, < > <= >=, + -, * / %, unær, primær

    private func or() throws -> StoryGraphValue {
        var l = try and()
        while isKw("or") || isOp("||") {
            pos += 1
            let r = try and()
            l = .bool(l.isTruthy || r.isTruthy)
        }
        return l
    }

    private func and() throws -> StoryGraphValue {
        var l = try isExpr()
        while isKw("and") || isOp("&&") {
            pos += 1
            let r = try isExpr()
            l = .bool(l.isTruthy && r.isTruthy)
        }
        return l
    }

    private func isExpr() throws -> StoryGraphValue {
        var l = try equality()
        while isKw("is") {
            pos += 1
            var neg = false
            if isKw("not") { neg = true; pos += 1 }
            let r = try equality()
            l = .bool(StoryGraphValue.equal(l, r) != neg)
        }
        return l
    }

    private func equality() throws -> StoryGraphValue {
        var l = try relational()
        while isOp("==") || isOp("!=") {
            let op = next().text
            let r = try relational()
            l = .bool(StoryGraphValue.equal(l, r) == (op == "=="))
        }
        return l
    }

    private func relational() throws -> StoryGraphValue {
        var l = try additive()
        while isOp("<") || isOp(">") || isOp("<=") || isOp(">=") {
            let op = next().text
            let a = l.asDouble
            let b = try additive().asDouble
            switch op {
            case "<": l = .bool(a < b)
            case ">": l = .bool(a > b)
            case "<=": l = .bool(a <= b)
            default: l = .bool(a >= b)
            }
        }
        return l
    }

    private func additive() throws -> StoryGraphValue {
        var l = try multiplicative()
        while isOp("+") || isOp("-") {
            let op = next().text
            let r = try multiplicative()
            if op == "+" {
                l = (l.isString || r.isString) ? .string(l.asDisplayString + r.asDisplayString) : .double(l.asDouble + r.asDouble)
            } else {
                l = .double(l.asDouble - r.asDouble)
            }
        }
        return l
    }

    private func multiplicative() throws -> StoryGraphValue {
        var l = try unary()
        while isOp("*") || isOp("/") || isOp("%") {
            let op = next().text
            let a = l.asDouble
            let b = try unary().asDouble
            if op == "*" {
                l = .double(a * b)
            } else {
                guard b != 0 else { throw ScriptRuntimeError(message: op == "/" ? "Division by zero" : "Modulo by zero") }
                l = .double(op == "/" ? a / b : a.truncatingRemainder(dividingBy: b))
            }
        }
        return l
    }

    private func unary() throws -> StoryGraphValue {
        if isOp("!") || isKw("not") {
            pos += 1
            return .bool(!(try unary().isTruthy))
        }
        if isOp("-") {
            pos += 1
            return .double(-(try unary().asDouble))
        }
        if isOp("+") {
            pos += 1
            return .double(try unary().asDouble)
        }
        return try primary()
    }

    private func primary() throws -> StoryGraphValue {
        let t = next()
        switch t.kind {
        case .num:
            return .double(t.num)
        case .str:
            return .string(t.text)
        case .mention:
            if let vn = ctx.variableIdToName[t.text], let vv = ctx.variables[vn] { return vv }
            if let direct = ctx.variables[t.text] { return direct }
            return .string(ctx.resolveElement(t.text) ?? t.text)
        case .keyword:
            if t.text == "true" { return .bool(true) }
            if t.text == "false" { return .bool(false) }
            throw ScriptRuntimeError(message: "Unexpected keyword '\(t.text)'")
        case .ident:
            if isOp("(") { return try call(t.text) }
            if let v = ctx.variables[t.text] { return v }
            throw ScriptRuntimeError(message: "Unknown identifier '\(t.text)'")
        case .op:
            if t.text == "(" {
                let v2 = try or()
                try expect(")")
                return v2
            }
            throw ScriptRuntimeError(message: "Unexpected token")
        case .end:
            throw ScriptRuntimeError(message: "Unexpected end of expression")
        }
    }

    private func toPositiveInt(_ d: Double) -> Int {
        guard d.isFinite else { return 1 }
        let floored = d.rounded(.down)
        if floored < 1 { return 1 }
        if floored > Double(Int.max) { return Int.max }
        return Int(floored)
    }

    private func call(_ name: String) throws -> StoryGraphValue {
        try expect("(")
        var values: [StoryGraphValue] = []
        var refs: [String?] = []
        while !isOp(")") {
            if peek.kind == .mention {
                let m = next()
                refs.append(m.text)
                values.append(.string(m.text))
            } else if peek.kind == .ident, !(toks[pos + 1].kind == .op && toks[pos + 1].text == "("), ctx.variables[peek.text] == nil {
                let m = next()
                refs.append(m.text)
                values.append(.string(m.text))
            } else {
                let v = try or()
                values.append(v)
                refs.append(v.isString ? v.asDisplayString : nil)
            }
            if isOp(",") { pos += 1 } else { break }
        }
        try expect(")")
        func n(_ i: Int) -> Double { i < values.count ? values[i].asDouble : 0 }
        switch name {
        case "visits":
            if values.isEmpty { return .double(Double(ctx.visitsOf(ctx.currentElementId))) }
            let ref = refs.first.flatMap { $0 } ?? ""
            return .double(Double(ctx.visitsOf(ctx.resolveElement(ref))))
        case "abs":
            return .double(abs(n(0)))
        case "sqr":
            let x = n(0)
            return .double(x * x)
        case "sqrt":
            let x = n(0)
            guard x >= 0 else { throw ScriptRuntimeError(message: "sqrt of negative") }
            return .double(x.squareRoot())
        case "round":
            return .double(n(0).rounded(.toNearestOrAwayFromZero))
        case "min":
            return .double((0..<values.count).map(n).min() ?? 0)
        case "max":
            return .double((0..<values.count).map(n).max() ?? 0)
        case "random":
            return .double(ctx.rng())
        case "roll":
            let sides = toPositiveInt(n(0))
            let count = values.count > 1 ? toPositiveInt(n(1)) : 1
            var sum = 0.0
            for _ in 0..<count { sum += 1 + (ctx.rng() * Double(sides)).rounded(.down) }
            return .double(sum)
        case "show", "reset", "resetAll", "resetVisits":
            ctx.warnings.append("Unsupported function '\(name)()' ignored (subset runtime).")
            return .double(0)
        default:
            throw ScriptRuntimeError(message: "Unknown function '\(name)'")
        }
    }
}
