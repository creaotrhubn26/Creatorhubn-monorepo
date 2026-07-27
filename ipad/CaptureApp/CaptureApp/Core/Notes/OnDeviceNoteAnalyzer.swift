// OnDeviceNoteAnalyzer.swift
//
// iOS 26+ on-device-implementasjonen av notat-innsikt via Apple Foundation
// Models. Bak `@available(iOS 26, *)` + `#if canImport(FoundationModels)`
// (deployment target er iOS 17). Fasade + availability-typer i
// NotesIntelligence.swift.

import Foundation

#if canImport(FoundationModels)
import FoundationModels

@available(iOS 26, *)
@Generable
struct NoteInsightsDraft {
    @Guide(description: "Én kort setning på norsk som oppsummerer notatet.")
    var summary: String

    @Guide(description: "Null til fem konkrete oppgaver eller oppfølgingspunkter fra notatet. Korte punkter på norsk.")
    var tasks: [String]

    func toInsights() -> NoteInsights {
        NoteInsights(summary: summary, tasks: tasks)
    }
}

@available(iOS 26, *)
struct LiveNoteAvailabilityChecker: NoteAvailabilityChecking {
    var availability: NoteModelAvailability {
        let model = SystemLanguageModel.default
        switch model.availability {
        case .available:
            let norwegian: Set<String> = ["nb", "nn", "no"]
            let supportsNorwegian = model.supportedLanguages.contains { lang in
                norwegian.contains(lang.languageCode?.identifier ?? "")
            }
            return supportsNorwegian ? .available : .unavailable(.unsupportedLanguage)
        case .unavailable(let reason):
            switch reason {
            case .deviceNotEligible: return .unavailable(.deviceNotEligible)
            case .appleIntelligenceNotEnabled: return .unavailable(.appleIntelligenceNotEnabled)
            case .modelNotReady: return .unavailable(.modelNotReady)
            @unknown default: return .unavailable(.modelNotReady)
            }
        @unknown default:
            return .unavailable(.modelNotReady)
        }
    }
}

@available(iOS 26, *)
struct FoundationModelsNoteGenerator: NoteInsightGenerating {
    func generate(from body: String, photo: PhotoMetadata?) async throws -> NoteInsights {
        let instructions = """
        Du er en assistent for en fotograf som skriver korte felt-notater om \
        shoots, klienter og prosjekter. Oppsummer notatet i én kort setning og \
        trekk ut konkrete oppgaver/oppfølgingspunkter. Hvis notatet har bilde-\
        metadata (EXIF), bruk den til relevant fototeknisk innsikt — f.eks. høy \
        ISO → vurder støyreduksjon, vid blenderåpning → grunn dybdeskarphet/sjekk \
        fokus, lang lukkertid → fare for bevegelsesuskarphet. Svar alltid på norsk.
        """
        let session = LanguageModelSession(instructions: instructions)

        let prompt: String
        if let photo, !photo.isEmpty {
            prompt = """
            Notat:
            \(body)

            Bilde-metadata (EXIF): \(photo.summaryLine)
            """
        } else {
            prompt = body
        }

        let response = try await session.respond(
            to: prompt,
            generating: NoteInsightsDraft.self
        )
        return response.content.toInsights()
    }
}

#endif
