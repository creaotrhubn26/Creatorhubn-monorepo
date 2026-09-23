// AskGuideIntelligence.swift
//
// «Spør guiden» (pakke 3): fasaden over Apple Intelligence (Foundation Models,
// iOS 26+). Samme mønster som CaptureApp (Core/Notes/NotesIntelligence.swift og
// TextGenerationIntelligence.swift): availability og generator bak protokoller,
// så alt utenom selve modellkallet kan enhetstestes. On-device-only: når
// modellen ikke er tilgjengelig skjules knappen og Innstillinger forklarer
// hvorfor. Ingen server, ingen mikrofon-tillatelse (tastaturets diktering
// holder). Selve modellkallet ligger i OnDeviceGuideAnswerer.swift.

import Foundation
import Observation

enum AskGuideAvailability: Equatable, Sendable {
    case available
    case unavailable(Reason)

    enum Reason: Equatable, Sendable {
        case osUnsupported
        case deviceNotEligible
        case appleIntelligenceNotEnabled
        case modelNotReady
        case unsupportedLanguage

        /// Forklaringen i Innstillinger (Localizable.xcstrings).
        var messageKey: String {
            switch self {
            case .osUnsupported: return "askGuide.unavailable.os"
            case .deviceNotEligible: return "askGuide.unavailable.device"
            case .appleIntelligenceNotEnabled: return "askGuide.unavailable.disabled"
            case .modelNotReady: return "askGuide.unavailable.notReady"
            case .unsupportedLanguage: return "askGuide.unavailable.language"
            }
        }
    }
}

protocol AskGuideAvailabilityChecking: Sendable {
    /// Om modellen kan svare på `language` (BCP 47, f.eks. «nb» eller «en»).
    func availability(for language: String) -> AskGuideAvailability
}

protocol GuideAnswerGenerating: Sendable {
    func answer(instructions: String, prompt: String) async throws -> String
}

/// iOS < 26: ingen Foundation Models.
struct UnsupportedOSAskGuideChecker: AskGuideAvailabilityChecking {
    func availability(for language: String) -> AskGuideAvailability {
        .unavailable(.osUnsupported)
    }
}

struct AskGuideIntelligence: Sendable {
    let checker: any AskGuideAvailabilityChecking
    let generator: (any GuideAnswerGenerating)?

    enum Failure: Error, Equatable {
        case unavailable(AskGuideAvailability.Reason)
        case emptyAnswer
    }

    func availability(for language: String) -> AskGuideAvailability {
        guard generator != nil else { return .unavailable(.osUnsupported) }
        return checker.availability(for: language)
    }

    func isAvailable(for language: String) -> Bool {
        availability(for: language) == .available
    }

    /// Svar på spørsmålet, trimmet. Kaster `Failure` når modellen ikke kan brukes
    /// eller svaret er tomt, og modellens egne feil videre.
    func answer(instructions: String, prompt: String, language: String) async throws -> String {
        if case let .unavailable(reason) = availability(for: language) {
            throw Failure.unavailable(reason)
        }
        guard let generator else { throw Failure.unavailable(.osUnsupported) }
        let raw = try await generator.answer(instructions: instructions, prompt: prompt)
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { throw Failure.emptyAnswer }
        return text
    }

    /// Den ekte motoren: Foundation Models på iOS 26+, ellers utilgjengelig.
    static let live: AskGuideIntelligence = makeLive()

    private static func makeLive() -> AskGuideIntelligence {
        #if canImport(FoundationModels)
        if #available(iOS 26, *) {
            return AskGuideIntelligence(
                checker: LiveAskGuideAvailabilityChecker(),
                generator: FoundationModelsGuideAnswerer()
            )
        }
        #endif
        return AskGuideIntelligence(checker: UnsupportedOSAskGuideChecker(), generator: nil)
    }
}

/// Tilstanden i «Spør guiden»-arket: spørsmål, venter, svar eller feil.
@MainActor
@Observable
final class AskGuideSession {
    enum Phase: Equatable {
        case idle
        case thinking
        case answered(String)
        case failed(Failure)
    }

    enum Failure: Equatable {
        case emptyQuestion
        case unavailable(AskGuideAvailability.Reason)
        case generation

        var messageKey: String {
            switch self {
            case .emptyQuestion: return "askGuide.error.empty"
            case let .unavailable(reason): return reason.messageKey
            case .generation: return "askGuide.error.generation"
            }
        }
    }

    let poi: GuidePOI
    /// Svarspråket: brukerens valgte guidespråk.
    let language: String

    var question = ""
    private(set) var askedQuestion: String?
    private(set) var phase: Phase = .idle
    /// Øker når et svar eller en feil kommer; arket annonserer og flytter fokus på den.
    private(set) var resultCount = 0

    private let intelligence: AskGuideIntelligence
    @ObservationIgnored private(set) var currentTask: Task<Void, Never>?

    init(poi: GuidePOI, language: String, intelligence: AskGuideIntelligence) {
        self.poi = poi
        self.language = language
        self.intelligence = intelligence
    }

    var isThinking: Bool { phase == .thinking }

    /// Stiller spørsmålet i feltet, eller `text` (forslagene). Et nytt spørsmål
    /// avbryter et som fortsatt venter.
    func ask(_ text: String? = nil) {
        guard let normalized = AskGuideGrounding.normalizedQuestion(text ?? question) else {
            finish(.failed(.emptyQuestion))
            return
        }
        currentTask?.cancel()
        askedQuestion = normalized
        phase = .thinking
        let instructions = AskGuideGrounding.instructions(poi: poi, answerLanguage: language)
        let prompt = AskGuideGrounding.prompt(question: normalized)
        let answerLanguage = self.language
        let engine = self.intelligence
        currentTask = Task { [weak self] in
            let result: Phase
            do {
                let answer = try await engine.answer(instructions: instructions, prompt: prompt, language: answerLanguage)
                result = .answered(answer)
            } catch AskGuideIntelligence.Failure.unavailable(let reason) {
                result = .failed(.unavailable(reason))
            } catch {
                result = .failed(.generation)
            }
            guard !Task.isCancelled else { return }
            self?.finish(result)
        }
    }

    func cancel() {
        currentTask?.cancel()
        currentTask = nil
        if phase == .thinking { phase = .idle }
    }

    private func finish(_ result: Phase) {
        phase = result
        resultCount += 1
    }
}
