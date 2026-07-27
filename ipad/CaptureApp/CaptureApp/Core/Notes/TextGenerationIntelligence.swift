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
}

protocol TextGenerating: Sendable {
    func generate(_ prompt: TextGenPrompt) async throws -> String
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
