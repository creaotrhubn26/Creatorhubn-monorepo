// OnDeviceGuideAnswerer.swift
//
// iOS 26+-implementasjonen av «Spør guiden» med Apple Foundation Models, bak
// `#if canImport(FoundationModels)` + `@available(iOS 26, *)` (deployment
// target er iOS 17). Speiler CaptureApp (Core/Notes/OnDeviceNoteAnalyzer.swift)
// og bruker bare iOS 26-flaten som er verifisert i
// docs/evidence/2026-09-ios27-ga-foundationmodels-ci.yaml: SystemLanguageModel
// (availability, supportedLanguages), LanguageModelSession(instructions:),
// respond(to:options:) og GenerationOptions(maximumResponseTokens:).
// iOS 27-protokollene (LanguageModel, LanguageModelExecutor, Private Cloud
// Compute) brukes ikke: CI kompilerer med Xcode 26.

import Foundation

#if canImport(FoundationModels)
import FoundationModels

@available(iOS 26, *)
struct LiveAskGuideAvailabilityChecker: AskGuideAvailabilityChecking {
    func availability(for language: String) -> AskGuideAvailability {
        let model = SystemLanguageModel.default
        switch model.availability {
        case .available:
            // Tilgjengelig modell betyr ikke at språket støttes; sjekk eksplisitt.
            let wanted = AskGuideGrounding.languageCodes(for: language)
            let supported = model.supportedLanguages.contains { lang in
                wanted.contains(lang.languageCode?.identifier ?? "")
            }
            return supported ? .available : .unavailable(.unsupportedLanguage)
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
struct FoundationModelsGuideAnswerer: GuideAnswerGenerating {
    func answer(instructions: String, prompt: String) async throws -> String {
        // Ny økt per spørsmål: hvert svar skal bare bygge på guideteksten, ikke
        // på tidligere spørsmål. 2–4 setninger får god plass i 300 tokens, og
        // taket holder oss unna det lille kontekstvinduet.
        let session = LanguageModelSession(instructions: instructions)
        let options = GenerationOptions(maximumResponseTokens: 300)
        return try await session.respond(to: prompt, options: options).content
    }
}

#endif
