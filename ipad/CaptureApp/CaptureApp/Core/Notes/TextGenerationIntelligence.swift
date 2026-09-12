// TextGenerationIntelligence.swift
//
// On-device tekst-generering (Foundation Models, iOS 26+) for CaptureApp:
// klient-e-postutkast + galleri-beskrivelser. Gjenbruker availability-laget
// fra NotesIntelligence (NoteAvailabilityChecking / NoteModelAvailability /
// LiveNoteAvailabilityChecker). On-device-only, graceful når utilgjengelig.

import Foundation

enum TextGenPrompt: Sendable, Equatable {
    case emailDraft(recipient: String, subject: String, notes: String)
    case galleryDescription(project: String, notes: String)
    /// #9 Generer en konkret shot-list fra en klient-brief. Modellen svarer med
    /// ÉN scene pr linje (ingen nummerering/markdown) → parses av
    /// ``ShotListBriefParser`` til shots som mater auto-huk.
    case shotListFromBrief(brief: String)
}

/// Parser FM-utdata (én scene pr linje) → rene, DEDUPETE scene-strenger.
/// Robust mot nummerering/kulepunkter/markdown OG mot at modellen lager ett
/// shot pr klokkeslett: den stripper ledende tid («16:20 …») og kollapser
/// like shots — så «Brudepar-portretter» hvert 10. min blir ETT shot.
enum ShotListBriefParser {
    static func scenes(from raw: String) -> [String] {
        var seen = Set<String>()
        var out: [String] = []
        for rawLine in raw.split(whereSeparator: \.isNewline) {
            var s = rawLine.trimmingCharacters(in: .whitespaces)
            // Strip ledende «-», «*», «•».
            while let first = s.first, "-*•".contains(first) {
                s = String(s.dropFirst()).trimmingCharacters(in: .whitespaces)
            }
            // Strip ledende «1.» / «1)».
            if let dot = s.firstIndex(where: { $0 == "." || $0 == ")" }),
               s[s.startIndex..<dot].allSatisfy(\.isNumber), s.startIndex != dot {
                s = String(s[s.index(after: dot)...]).trimmingCharacters(in: .whitespaces)
            }
            // Strip ledende klokkeslett «16:20 » / «16.20 ».
            s = stripLeadingTime(s)
            guard s.count >= 3, s.count <= 120 else { continue }
            // Dedupe (case-insensitivt) — bevar rekkefølge, cap på 24.
            let key = s.lowercased()
            if seen.insert(key).inserted { out.append(s) }
            if out.count >= 24 { break }
        }
        return out
    }

    private static func stripLeadingTime(_ s: String) -> String {
        let chars = Array(s)
        var i = 0
        while i < chars.count, chars[i].isNumber { i += 1 }
        guard i >= 1, i <= 2, i < chars.count, chars[i] == ":" || chars[i] == "." else { return s }
        var j = i + 1
        var digits = 0
        while j < chars.count, chars[j].isNumber { j += 1; digits += 1 }
        guard digits == 2, j < chars.count, chars[j] == " " else { return s }
        return String(chars[(j + 1)...]).trimmingCharacters(in: .whitespaces)
    }
}

protocol TextGenerating: Sendable {
    func generate(_ prompt: TextGenPrompt) async throws -> String
    /// Strøm av KUMULATIVE snapshots (hver verdi = alt generert så langt) → lar
    /// UI vise shots dukke opp live mens modellen skriver. Standard-impl faller
    /// tilbake til ett enkelt (ferdig) snapshot for ikke-strømmende motorer.
    func stream(_ prompt: TextGenPrompt) -> AsyncThrowingStream<String, Error>
}

extension TextGenerating {
    func stream(_ prompt: TextGenPrompt) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    continuation.yield(try await generate(prompt))
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

struct TextGenerationIntelligence: Sendable {
    let availability: NoteAvailabilityChecking
    let generator: TextGenerating?

    enum Failure: Error, Equatable {
        case unavailable(NoteModelAvailability.Reason)
    }

    var isAvailable: Bool {
        generator != nil && availability.availability == .available
    }

    var unavailableReason: NoteModelAvailability.Reason? {
        if generator == nil { return .osUnsupported }
        if case .unavailable(let reason) = availability.availability { return reason }
        return nil
    }

    func generate(_ prompt: TextGenPrompt) async throws -> String {
        guard let generator, availability.availability == .available else {
            throw Failure.unavailable(unavailableReason ?? .osUnsupported)
        }
        return try await generator.generate(prompt)
    }

    /// Kumulativ snapshot-strøm (se ``TextGenerating/stream``). Kaster
    /// umiddelbart via strømmen når motoren er utilgjengelig.
    func stream(_ prompt: TextGenPrompt) -> AsyncThrowingStream<String, Error> {
        guard let generator, availability.availability == .available else {
            let reason = unavailableReason ?? .osUnsupported
            return AsyncThrowingStream { $0.finish(throwing: Failure.unavailable(reason)) }
        }
        return generator.stream(prompt)
    }
}

@MainActor
enum TextGenerationIntelligenceFactory {
    static func make() -> TextGenerationIntelligence {
        if #available(iOS 26, *) {
            return TextGenerationIntelligence(
                availability: LiveNoteAvailabilityChecker(),
                generator: FoundationModelsTextGenerator()
            )
        }
        return TextGenerationIntelligence(availability: NoteUnsupportedOSChecker(), generator: nil)
    }
}
