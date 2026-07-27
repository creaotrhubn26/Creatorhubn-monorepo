// NotesIntelligence.swift
//
// On-device Apple Intelligence for felt-notater: oppsummering + oppgave-
// uttrekk via Foundation Models (iOS 26+). Speiler mønsteret fra Leadgrid
// (TranscriptIntelligence), men er ON-DEVICE-ONLY — CaptureApp har ingen
// notat-AI-backend-endpoint, så når on-device ikke er tilgjengelig viser
// UI-et en tydelig «krever Apple Intelligence»-tilstand i stedet for å kalle
// en server.
//
// Alt er rent + injiserbart (availability + generator bak protokoller) →
// enhetstestbart uten modellen.

import Foundation

// MARK: - Availability (testbar speiling av SystemLanguageModel.Availability)

enum NoteModelAvailability: Equatable, Sendable {
    case available
    case unavailable(Reason)

    enum Reason: Equatable, Sendable {
        case osUnsupported
        case deviceNotEligible
        case appleIntelligenceNotEnabled
        case modelNotReady
        case unsupportedLanguage

        /// Brukervennlig norsk forklaring til UI-et.
        var userMessage: String {
            switch self {
            case .osUnsupported: return "Krever iOS 26 eller nyere."
            case .deviceNotEligible: return "Enheten støtter ikke Apple Intelligence."
            case .appleIntelligenceNotEnabled: return "Slå på Apple Intelligence i Innstillinger."
            case .modelNotReady: return "Modellen lastes ned — prøv igjen om litt."
            case .unsupportedLanguage: return "Norsk støttes ikke på enheten ennå."
            }
        }
    }
}

protocol NoteAvailabilityChecking: Sendable {
    var availability: NoteModelAvailability { get }
}

/// Fallback for iOS < 26 (ingen Foundation Models).
struct NoteUnsupportedOSChecker: NoteAvailabilityChecking {
    var availability: NoteModelAvailability { .unavailable(.osUnsupported) }
}

// MARK: - Resultat + generator-abstraksjon

struct NoteInsights: Sendable, Equatable {
    let summary: String
    let tasks: [String]
}

protocol NoteInsightGenerating: Sendable {
    func generate(from body: String, photo: PhotoMetadata?) async throws -> NoteInsights
}

// MARK: - Fasade

struct NotesIntelligence: Sendable {
    let availability: NoteAvailabilityChecking
    let generator: NoteInsightGenerating?

    enum Failure: Error, Equatable {
        case emptyNote
        case unavailable(NoteModelAvailability.Reason)
    }

    /// Om funksjonen kan kjøres akkurat nå (styrer UI-knappens tilgjengelighet).
    var isAvailable: Bool {
        generator != nil && availability.availability == .available
    }

    /// Grunn til utilgjengelighet (for UI-melding), eller nil hvis tilgjengelig.
    var unavailableReason: NoteModelAvailability.Reason? {
        if generator == nil { return .osUnsupported }
        if case .unavailable(let r) = availability.availability { return r }
        return nil
    }

    func insights(for body: String, photo: PhotoMetadata? = nil) async throws -> NoteInsights {
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw Failure.emptyNote }
        guard let generator, availability.availability == .available else {
            throw Failure.unavailable(unavailableReason ?? .osUnsupported)
        }
        return try await generator.generate(from: trimmed, photo: photo)
    }
}

// MARK: - Produksjons-fabrikk

@MainActor
enum NotesIntelligenceFactory {
    static func make() -> NotesIntelligence {
        if #available(iOS 26, *) {
            return NotesIntelligence(
                availability: LiveNoteAvailabilityChecker(),
                generator: FoundationModelsNoteGenerator()
            )
        }
        return NotesIntelligence(availability: NoteUnsupportedOSChecker(), generator: nil)
    }
}
