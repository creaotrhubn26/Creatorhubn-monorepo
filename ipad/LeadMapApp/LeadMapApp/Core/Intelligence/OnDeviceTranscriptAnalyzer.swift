// OnDeviceTranscriptAnalyzer.swift
//
// iOS 26+ on-device-implementasjonen av transkript-analyse via Apple
// Foundation Models. Alt her er `@available(iOS 26, *)` og bak
// `#if canImport(FoundationModels)` — deployment target er iOS 17, så
// symbolene finnes kun på nyere OS. (Verifisert: FoundationModels.framework
// FINNES i iOS 26.5-SDK, så dette kompilerer med Xcode 26.6.)
//
// Backend-fallback + rutelogikk ligger i TranscriptIntelligence.swift.

import Foundation

#if canImport(FoundationModels)
import FoundationModels

// MARK: - Guided-generation-skjema (@Generable speiling av TranscriptAnalysis)

/// On-device-modellen fyller denne strukturert (guided generation). Vi mapper
/// til appens eksisterende `TranscriptAnalysis` slik at UI-et (og
/// SmartTranscriptActionsSheet) er uendret — kun kilden byttes.
@available(iOS 26, *)
@Generable
struct TranscriptAnalysisDraft {
    @Guide(description: "Det dikterte notatet ryddet opp på norsk, der 'kunden'/'de' er byttet ut med lead-navnet der det er naturlig. Behold meningen.")
    var resolvedText: String

    @Guide(description: "Null til fem konkrete oppgaver selgeren bør gjøre etter besøket. Korte punkter på norsk.")
    var actionItems: [String]

    @Guide(description: "Foreslått oppfølgingsdato i format ÅÅÅÅ-MM-DD, eller tom streng hvis ingen dato ble nevnt.")
    var followUpDate: String

    @Guide(description: "Stemningen fra besøket. Nøyaktig én av: positiv, negativ, nøytral.")
    var sentiment: String

    @Guide(description: "Tittel på en foreslått kalenderavtale, eller tom streng hvis ingen avtale er relevant.")
    var calendarTitle: String

    @Guide(description: "Dato for kalenderavtalen i format ÅÅÅÅ-MM-DD, eller tom streng.")
    var calendarDate: String

    @Guide(description: "Korte notater til kalenderavtalen, eller tom streng.")
    var calendarNotes: String

    /// Map til appens Decodable-modell (samme form som backend returnerer).
    func toTranscriptAnalysis() -> TranscriptAnalysis {
        let suggestion: TranscriptAnalysis.CalendarSuggestion?
        if calendarTitle.isEmpty || calendarDate.isEmpty {
            suggestion = nil
        } else {
            suggestion = TranscriptAnalysis.CalendarSuggestion(
                title: calendarTitle,
                date: calendarDate,
                notes: calendarNotes.isEmpty ? nil : calendarNotes
            )
        }
        return TranscriptAnalysis(
            resolved_text: resolvedText,
            action_items: actionItems,
            follow_up_date: followUpDate.isEmpty ? nil : followUpDate,
            calendar_suggestion: suggestion,
            sentiment: normalizedSentiment
        )
    }

    private var normalizedSentiment: String {
        let s = sentiment.lowercased()
        if s.contains("posi") { return "positiv" }
        if s.contains("nega") { return "negativ" }
        return "nøytral"
    }
}

// MARK: - Live availability-checker

@available(iOS 26, *)
struct LiveOnDeviceAvailabilityChecker: OnDeviceAvailabilityChecking {
    var availability: OnDeviceModelAvailability {
        let model = SystemLanguageModel.default
        switch model.availability {
        case .available:
            // Personvern/kvalitet: on-device-tilgjengelighet garanterer ikke
            // norsk. Sjekk `supportedLanguages` eksplisitt (finnes i 26.5-SDK)
            // — ellers ruter vi til backend som håndterer norsk trygt.
            let norwegianCodes: Set<String> = ["nb", "nn", "no"]
            let supportsNorwegian = model.supportedLanguages.contains { lang in
                norwegianCodes.contains(lang.languageCode?.identifier ?? "")
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

// MARK: - Live on-device analyzer

@available(iOS 26, *)
struct FoundationModelsTranscriptAnalyzer: OnDeviceTranscriptAnalyzing {
    func analyze(transcript: String, leadName: String) async throws -> TranscriptAnalysis {
        let instructions = """
        Du er en assistent for en norsk feltselger som dikterer korte \
        besøksnotater. Rydd opp notatet, trekk ut konkrete oppgaver, foreslå \
        en oppfølgingsdato hvis nevnt, vurder stemningen, og foreslå en \
        kalenderavtale hvis det er naturlig. Svar alltid på norsk.
        """
        let session = LanguageModelSession(instructions: instructions)

        let name = leadName.isEmpty ? "kunden" : leadName
        let prompt = """
        Lead: \(name)

        Diktert besøksnotat:
        \(transcript)
        """

        let response = try await session.respond(
            to: prompt,
            generating: TranscriptAnalysisDraft.self
        )
        return response.content.toTranscriptAnalysis()
    }
}

#endif
