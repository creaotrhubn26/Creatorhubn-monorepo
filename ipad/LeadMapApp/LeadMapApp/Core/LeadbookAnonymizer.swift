// LeadbookAnonymizer.swift — on-device navne-redaksjon før publisering (§6)
//
// Backend (leadgrid-leadbook-examples-routes.ts) kjører ALLTID et regex-
// pass ved draft→published (telefon/e-post/org.nr — strukturert PII regex
// takler pålitelig). Navn er for fuzzy for regex alene — doc-en forutsetter
// et LLM/NER-pass. NLTagger (Apples on-device named-entity-recognition,
// alltid tilgjengelig, ingen nettverk, ingen hallusinasjonsrisiko — riktig
// verktøy for NAVNGJENKJENNING, i motsetning til en generativ LLM) kjører
// HER, klient-side, FØR PATCH-en sendes — begge lag treffer sammen.

import Foundation
import NaturalLanguage

enum LeadbookAnonymizer {
    /// Erstatter gjenkjente personnavn med [navn]. Best effort — feiler
    /// aldri (ingen navn funnet = teksten uendret, ikke en feiltilstand).
    static func redactNames(_ text: String) -> String {
        guard !text.isEmpty else { return text }
        let tagger = NLTagger(tagSchemes: [.nameType])
        tagger.string = text
        var result = text
        var ranges: [Range<String.Index>] = []
        tagger.enumerateTags(
            in: text.startIndex..<text.endIndex,
            unit: .word, scheme: .nameType,
            options: [.omitWhitespace, .joinNames]
        ) { tag, range in
            if tag == .personalName { ranges.append(range) }
            return true
        }
        // Bakfra-til-fram så tidligere ranges ikke blir ugyldige av endringer.
        for range in ranges.reversed() {
            result.replaceSubrange(range, with: "[navn]")
        }
        return result
    }

    static func redactTranscript(_ lines: [APIClient.LeadbookTranscriptLineDTO]) -> [APIClient.LeadbookTranscriptLineDTO] {
        lines.map {
            APIClient.LeadbookTranscriptLineDTO(speaker: $0.speaker, text: redactNames($0.text), atSec: $0.atSec)
        }
    }
}
