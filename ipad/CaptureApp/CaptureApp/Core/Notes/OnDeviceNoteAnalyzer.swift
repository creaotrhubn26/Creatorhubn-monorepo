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

@available(iOS 26, *)
struct FoundationModelsTextGenerator: TextGenerating {
    func generate(_ prompt: TextGenPrompt) async throws -> String {
        let (instructions, userPrompt) = Self.build(prompt)
        let session = LanguageModelSession(instructions: instructions)
        return try await session.respond(to: userPrompt).content
    }

    static func build(_ prompt: TextGenPrompt) -> (instructions: String, prompt: String) {
        switch prompt {
        case .emailDraft(let recipient, let subject, let notes):
            return (
                "Du er en fotograf som skriver profesjonelle, vennlige og korte norske klient-e-poster. Bruk en naturlig, høflig tone.",
                "Skriv en e-post til \(recipient.isEmpty ? "kunden" : recipient). Emne: \(subject). Innhold/stikkord: \(notes)"
            )
        case .galleryDescription(let project, let notes):
            return (
                "Du er en fotograf som skriver korte, innbydende galleri-beskrivelser på norsk.",
                "Skriv en kort beskrivelse for galleriet «\(project)». Stikkord: \(notes)"
            )
        }
    }
}

#endif
