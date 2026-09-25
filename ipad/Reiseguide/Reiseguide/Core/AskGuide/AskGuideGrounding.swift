// AskGuideGrounding.swift
//
// «Spør guiden» (pakke 3): ren bygging av instruksjonene til språkmodellen.
// Svaret skal BARE bygge på guideteksten for stedet: tittel, ingress, praktisk
// info, alle kapitlene i fortellingen og synstolkingen på språket appen har
// lastet. Står det ikke der, skal guiden si det rett ut. Svaret kommer på
// brukerens språk i 2–4 setninger som fungerer opplest.
//
// Ingen avhengighet til FoundationModels her, så alt kan enhetstestes.

import Foundation

enum AskGuideGrounding {
    /// Tak på guideteksten i instruksjonene. On-device-modellen har et lite
    /// kontekstvindu (CaptureApp traff grensen på 4096 tokens), så teksten
    /// kappes på en setningsgrense og synstolkingen, som står sist, går først.
    static let maxSourceCharacters = 7_000
    static let maxQuestionCharacters = 300

    /// Nøkler for de tre forslagene i arket (Localizable.xcstrings).
    static let suggestionKeys = ["askGuide.suggestion.1", "askGuide.suggestion.2", "askGuide.suggestion.3"]

    /// Om stedet har noe å svare ut fra.
    static func hasContent(_ poi: GuidePOI) -> Bool {
        poi.summary?.isEmpty == false
            || !poi.practicalInfo.isEmpty
            || poi.variants.narration?.chapters.isEmpty == false
            || poi.variants.audioDescription?.chapters.isEmpty == false
    }

    /// Trimmer og slår sammen mellomrom; nil for tomt. Kappes til maks lengde.
    static func normalizedQuestion(_ raw: String) -> String? {
        let collapsed = raw
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
        guard !collapsed.isEmpty else { return nil }
        return String(collapsed.prefix(maxQuestionCharacters))
    }

    /// Primærtag i små bokstaver: «nb-NO» → «nb».
    static func primaryLanguage(_ code: String) -> String {
        String(code.lowercased().split(separator: "-").first ?? "")
    }

    /// Språkkoder som regnes som samme språk når modellens språkliste sjekkes.
    static func languageCodes(for code: String) -> Set<String> {
        let primary = primaryLanguage(code)
        if ["nb", "nn", "no"].contains(primary) { return ["nb", "nn", "no"] }
        return [primary]
    }

    /// Språknavnet modellen får (på engelsk, som resten av instruksjonene).
    static func languageName(_ code: String) -> String {
        switch primaryLanguage(code) {
        case "nb", "no": return "Norwegian Bokmål"
        case "nn": return "Norwegian Nynorsk"
        case "en": return "English"
        case "da": return "Danish"
        default:
            let primary = primaryLanguage(code)
            return Locale(identifier: "en").localizedString(forLanguageCode: primary) ?? primary
        }
    }

    /// Setningen guiden skal bruke når teksten ikke svarer, på svarspråket.
    static func notInTextSentence(_ code: String) -> String? {
        switch primaryLanguage(code) {
        case "nb", "no", "nn": return "Det står ikke i guideteksten."
        case "en": return "The guide text doesn't say."
        case "da": return "Det fremgår ikke af guideteksten."
        default: return nil
        }
    }

    /// Instruksjonene til økten: regler + guideteksten.
    static func instructions(poi: GuidePOI, answerLanguage: String) -> String {
        let language = languageName(answerLanguage)
        let notInText = notInTextSentence(answerLanguage).map { "say so plainly with this sentence: \"\($0)\"" }
            ?? "say plainly, in \(language), that the guide text does not say"
        return """
        You are the audio guide in the SenseAid Explore app. A visitor is asking about one place: \(poi.title).
        Rules:
        1. Answer ONLY from the GUIDE TEXT below. Do not use any other knowledge, and never guess or add facts.
        2. If the guide text does not answer the question, \(notInText). Then you may say in one sentence what the guide text does tell about.
        3. Answer in \(language), in 2 to 4 short sentences, in plain language that works when read aloud. No lists, headings, markdown or emoji.
        4. The guide text may be in another language than the answer. Translate what you use.

        GUIDE TEXT
        \(sourceText(poi: poi))
        END OF GUIDE TEXT
        """
    }

    /// Selve spørsmålet til modellen.
    static func prompt(question: String) -> String {
        "Visitor's question: \(question)"
    }

    /// Guideteksten i fast rekkefølge, kappet til `maxSourceCharacters`.
    static func sourceText(poi: GuidePOI) -> String {
        var sections: [String] = ["Title: \(poi.title)"]
        if let subtitle = poi.subtitle, !subtitle.isEmpty { sections.append("Subtitle: \(subtitle)") }
        if let location = poi.locationLabel, !location.isEmpty { sections.append("Location: \(location)") }
        if let summary = poi.summary, !summary.isEmpty { sections.append("Summary: \(summary)") }
        if !poi.practicalInfo.isEmpty {
            let lines = poi.practicalInfo.map { "- \($0.label): \($0.value)" }
            sections.append((["Practical information:"] + lines).joined(separator: "\n"))
        }
        for chapter in poi.variants.narration?.chapters ?? [] {
            let heading = chapter.title.map { "Narration, chapter \(chapter.no) (\($0)):" } ?? "Narration, chapter \(chapter.no):"
            sections.append("\(heading)\n\(chapter.scriptText)")
        }
        for chapter in poi.variants.audioDescription?.chapters ?? [] {
            sections.append("Audio description, what the place looks like:\n\(chapter.scriptText)")
        }
        return truncate(sections.joined(separator: "\n\n"), limit: maxSourceCharacters)
    }

    /// Kapper på siste setningsslutt før grensen (ellers hardt) og merker med «…».
    static func truncate(_ text: String, limit: Int) -> String {
        guard text.count > limit else { return text }
        let head = String(text.prefix(limit))
        if let end = head.lastIndex(where: { ".!?".contains($0) }), head.distance(from: head.startIndex, to: end) > limit / 2 {
            return String(head[...end]) + " …"
        }
        return head + " …"
    }
}
