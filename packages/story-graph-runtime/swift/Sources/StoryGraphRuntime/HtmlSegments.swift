// HtmlSegments.swift — HTML-hjelpere for element-/etikett-innhold. Speiler
// `StoryGraphHtml` i unity/StoryGraphRuntime.cs og `Html` i godot/story_graph_runtime.gd
// regel for regel: samme regex-mønstre, samme rekkefølge på erstatninger.
//
// Konvensjonen i Story Graph-eksporten: skript ligger i <pre><code>…</code></pre>-blokker
// inni element-/etikett-HTML-en. Mentions (@-referanser satt inn av editoren) er
// <span class="mention …" data-id="…">visningstekst</span> inni kodeblokka og løses her
// til den kompakte `@[id]`-formen som MiniScript.swift tokeniserer.
//
// enum uten cases brukes som navnerom (som en `static class` i C#).

import Foundation

public enum StoryGraphHtml {
    /// Ett stykke av elementets HTML: enten synlig prosa, eller en kodeblokk (skript).
    public struct Segment: Sendable, Equatable {
        public let isCode: Bool
        public let text: String

        public init(isCode: Bool, text: String) {
            self.isCode = isCode
            self.text = text
        }
    }

    // MARK: - regex-mønstre (identiske med C#-/GDScript-porten)

    private static let codeBlockRegex = unsafeRegex(#"<pre(?:\s[^>]*)?>\s*<code(?:\s[^>]*)?>([\s\S]*?)</code>\s*</pre>"#, caseInsensitive: true)
    private static let mentionRegex = unsafeRegex(#"<span([^>]*)>([\s\S]*?)</span>"#, caseInsensitive: true)
    private static let tagRegex = unsafeRegex(#"<[^>]+>"#, caseInsensitive: false)
    private static let dataIdRegex = unsafeRegex(#"data-id\s*=\s*"([^"]*)""#, caseInsensitive: true)
    private static let brRegex = unsafeRegex(#"<br\s*/?>"#, caseInsensitive: true)
    private static let paraJoinRegex = unsafeRegex(#"</p>\s*<p[^>]*>"#, caseInsensitive: true)
    private static let blockCloseRegex = unsafeRegex(#"</(p|div|li|h[1-6]|blockquote|pre)>"#, caseInsensitive: true)
    private static let listItemRegex = unsafeRegex(#"<li[^>]*>"#, caseInsensitive: true)
    private static let whitespaceRunRegex = unsafeRegex(#"[ \t]+"#, caseInsensitive: false)
    private static let blankLineRunRegex = unsafeRegex(#"\n{3,}"#, caseInsensitive: false)
    private static let entityRegex = unsafeRegex(#"&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);"#, caseInsensitive: false)

    private static let entities: [String: String] = [
        "amp": "&", "lt": "<", "gt": ">", "quot": "\"", "apos": "'", "nbsp": " ",
        "aring": "å", "Aring": "Å", "aelig": "æ", "AElig": "Æ", "oslash": "ø", "Oslash": "Ø",
        "eacute": "é", "egrave": "è", "uuml": "ü", "ouml": "ö", "auml": "ä",
        "ndash": "–", "mdash": "—", "hellip": "…", "laquo": "«", "raquo": "»",
    ]

    /// Regex-mønstrene over er alle konstante og testet mot fixture-en; en byggefeil her ville
    /// være en programmeringsfeil, ikke en runtime-tilstand, så vi krasjer tidlig i stedet for å
    /// spre `nil` gjennom hele API-et (speiler at C#-portens `static readonly Regex`-felt heller
    /// aldri feiler ved kompilerte, konstante mønstre).
    private static func unsafeRegex(_ pattern: String, caseInsensitive: Bool) -> NSRegularExpression {
        // swiftlint:disable:next force_try
        try! NSRegularExpression(pattern: pattern, options: caseInsensitive ? [.caseInsensitive] : [])
    }

    // MARK: - offentlig API

    /// Element-HTML → ordnede prosa/kode-segmenter (kode: mentions → @[id], entiteter dekodet).
    public static func splitSegments(_ html: String) -> [Segment] {
        guard !html.isEmpty else { return [] }
        var list: [Segment] = []
        var last = html.startIndex
        for match in matches(codeBlockRegex, in: html) {
            guard let matchRange = Range(match.range, in: html) else { continue }
            if matchRange.lowerBound > last {
                let chunk = String(html[last..<matchRange.lowerBound])
                if !isBlank(chunk) { list.append(Segment(isCode: false, text: chunk)) }
            }
            let inner = groupString(match, group: 1, in: html) ?? ""
            list.append(Segment(isCode: true, text: prepareCode(inner)))
            last = matchRange.upperBound
        }
        if last < html.endIndex {
            let chunk = String(html[last...])
            if !isBlank(chunk) { list.append(Segment(isCode: false, text: chunk)) }
        }
        return list
    }

    public static func stripCodeBlocks(_ html: String) -> String {
        guard !html.isEmpty else { return "" }
        return replaceAll(codeBlockRegex, in: html, with: "")
    }

    public static func hasScript(_ html: String) -> Bool {
        guard !html.isEmpty else { return false }
        return firstMatch(codeBlockRegex, in: html) != nil
    }

    /// Speil av den delte `htmlToPlainText`: avsnitt → linjeskift, tagger fjernet, entiteter dekodet.
    public static func toPlainText(_ html: String) -> String {
        guard !html.isEmpty else { return "" }
        var t = replaceAll(brRegex, in: html, with: "\n")
        t = replaceAll(blockCloseRegex, in: t, with: "\n")
        t = replaceAll(listItemRegex, in: t, with: "- ")
        t = replaceAll(tagRegex, in: t, with: "")
        t = decodeEntities(t).replacingOccurrences(of: "\u{00a0}", with: " ")
        let lines = t.split(separator: "\n", omittingEmptySubsequences: false).map { line -> String in
            replaceAll(whitespaceRunRegex, in: String(line), with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        }
        t = lines.joined(separator: "\n")
        t = replaceAll(blankLineRunRegex, in: t, with: "\n\n")
        return t.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public static func decodeEntities(_ s: String) -> String {
        guard !s.isEmpty, s.contains("&") else { return s }
        let ms = matches(entityRegex, in: s)
        guard !ms.isEmpty else { return s }
        var result = ""
        var last = s.startIndex
        for m in ms {
            guard let matchRange = Range(m.range, in: s) else { continue }
            result += s[last..<matchRange.lowerBound]
            let name = groupString(m, group: 1, in: s) ?? ""
            result += decodedEntity(name) ?? String(s[matchRange])
            last = matchRange.upperBound
        }
        result += s[last...]
        return result
    }

    // MARK: - internt

    private static func prepareCode(_ inner: String) -> String {
        var code = replaceMentions(inner)
        code = replaceAll(brRegex, in: code, with: "\n")
        code = replaceAll(paraJoinRegex, in: code, with: "\n")
        return decodeEntities(replaceAll(tagRegex, in: code, with: ""))
    }

    private static func replaceMentions(_ inner: String) -> String {
        guard !inner.isEmpty else { return inner }
        let ms = matches(mentionRegex, in: inner)
        guard !ms.isEmpty else { return inner }
        var result = ""
        var last = inner.startIndex
        for m in ms {
            guard let matchRange = Range(m.range, in: inner) else { continue }
            result += inner[last..<matchRange.lowerBound]
            let attrs = groupString(m, group: 1, in: inner) ?? ""
            let innerText = groupString(m, group: 2, in: inner) ?? ""
            if let dataId = firstMatchGroup(dataIdRegex, group: 1, in: attrs), !dataId.isEmpty {
                result += "@[" + dataId + "]"
            } else {
                result += decodeEntities(replaceAll(tagRegex, in: innerText, with: ""))
            }
            last = matchRange.upperBound
        }
        result += inner[last...]
        return result
    }

    private static func decodedEntity(_ name: String) -> String? {
        if name.hasPrefix("#x") {
            guard let value = UInt32(name.dropFirst(2), radix: 16), let scalar = Unicode.Scalar(value) else { return nil }
            return String(Character(scalar))
        }
        if name.hasPrefix("#") {
            guard let value = UInt32(name.dropFirst(1)), let scalar = Unicode.Scalar(value) else { return nil }
            return String(Character(scalar))
        }
        return entities[name]
    }

    private static func isBlank(_ s: String) -> Bool {
        s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private static func matches(_ regex: NSRegularExpression, in text: String) -> [NSTextCheckingResult] {
        guard !text.isEmpty else { return [] }
        let full = NSRange(text.startIndex..<text.endIndex, in: text)
        return regex.matches(in: text, range: full)
    }

    private static func firstMatch(_ regex: NSRegularExpression, in text: String) -> NSTextCheckingResult? {
        guard !text.isEmpty else { return nil }
        let full = NSRange(text.startIndex..<text.endIndex, in: text)
        return regex.firstMatch(in: text, range: full)
    }

    private static func firstMatchGroup(_ regex: NSRegularExpression, group: Int, in text: String) -> String? {
        guard let m = firstMatch(regex, in: text) else { return nil }
        return groupString(m, group: group, in: text)
    }

    private static func groupString(_ match: NSTextCheckingResult, group: Int, in text: String) -> String? {
        guard group < match.numberOfRanges else { return nil }
        let r = match.range(at: group)
        guard r.location != NSNotFound, let range = Range(r, in: text) else { return nil }
        return String(text[range])
    }

    private static func replaceAll(_ regex: NSRegularExpression, in text: String, with replacement: String) -> String {
        guard !text.isEmpty else { return text }
        let full = NSRange(text.startIndex..<text.endIndex, in: text)
        let template = NSRegularExpression.escapedTemplate(for: replacement)
        return regex.stringByReplacingMatches(in: text, range: full, withTemplate: template)
    }
}
