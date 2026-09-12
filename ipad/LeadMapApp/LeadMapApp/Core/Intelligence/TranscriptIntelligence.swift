// TranscriptIntelligence.swift
//
// GRUNNLAG for on-device transkript-analyse (Apple Intelligence /
// Foundation Models) med backend-Claude som fallback.
//
// Designprinsipp (jf. docs/apple-intelligence-vision-integrasjonsplan):
//   - iOS 26+ Apple Intelligence-enhet → kjør on-device (offline, gratis,
//     personvern). iPhone 15 Pro Max (A17 Pro) er kapabel.
//   - Ellers (eldre OS, ikke-kapabel enhet, modell ikke klar, norsk ikke
//     støttet, on-device kaster guardrail-feil) → fall tilbake til vår
//     eksisterende backend (`APIClient.analyzeTranscript`).
//
// Hele dette laget er RENT og INJISERBART: availability + on-device-analyse
// er bak protokoller, og backend er en closure. Det gjør rute-/fallback-
// logikken enhetstestbar UTEN modellen og UTEN nettverk (Tier 0 i CI).
//
// iOS 27-tillegg (PrivateCloudComputeLanguageModel, Dynamic Profiles) legges
// på som en ekstra tier når Xcode 27-SDK er tilgjengelig — se planen §1.

import Foundation

// MARK: - Availability (testbar speiling av SystemLanguageModel.Availability)

/// Vår egen availability-modell. Speiler `SystemLanguageModel.Availability`,
/// men uten å importere FoundationModels — slik at typen kan brukes i tester
/// (og på plattformer uten FM, f.eks. watchOS < 27) uten å dra inn SDK-et.
enum OnDeviceModelAvailability: Equatable, Sendable {
    case available
    case unavailable(Reason)

    enum Reason: Equatable, Sendable {
        /// OS/SDK har ikke Foundation Models (iOS < 26).
        case osUnsupported
        /// Enheten er ikke Apple Intelligence-kapabel.
        case deviceNotEligible
        /// Apple Intelligence er ikke slått på i Innstillinger.
        case appleIntelligenceNotEnabled
        /// Modellen laster ned / midlertidig utilgjengelig (forbigående).
        case modelNotReady
        /// On-device-modellen støtter ikke norsk på denne enheten.
        case unsupportedLanguage
    }
}

/// Abstraksjon over «er on-device-modellen tilgjengelig akkurat nå?».
/// `Live`-implementasjonen (iOS 26+) leser `SystemLanguageModel.default`.
/// Tester injiserer en mock som returnerer en fast verdi.
protocol OnDeviceAvailabilityChecking: Sendable {
    var availability: OnDeviceModelAvailability { get }
}

/// Fallback-checker for OS uten Foundation Models (iOS < 26). Alltid
/// `.osUnsupported` → ruter til backend.
struct UnsupportedOSAvailabilityChecker: OnDeviceAvailabilityChecking {
    var availability: OnDeviceModelAvailability { .unavailable(.osUnsupported) }
}

// MARK: - On-device analyzer-abstraksjon

/// Abstraksjon over selve on-device-genereringen. Produksjons-
/// implementasjonen bruker `LanguageModelSession` + `@Generable`. Tester
/// injiserer en fake som returnerer et fast `TranscriptAnalysis` (eller
/// kaster, for å teste fallback).
protocol OnDeviceTranscriptAnalyzing: Sendable {
    func analyze(transcript: String, leadName: String) async throws -> TranscriptAnalysis
}

// MARK: - Resultat

enum TranscriptIntelligenceSource: String, Sendable {
    case onDevice
    case backend
}

struct TranscriptIntelligenceResult: Sendable {
    let analysis: TranscriptAnalysis
    /// Hvor analysen faktisk ble kjørt — for UI-badge + telemetri.
    let source: TranscriptIntelligenceSource
}

// MARK: - Fasade (rutelogikk + fallback)

/// Enkelt inngangspunkt for transkript-analyse. Velger on-device når det er
/// trygt, faller ellers tilbake til backend. On-device-feil (guardrail,
/// modell ikke klar underveis) svelges og faller tilbake; backend-feil
/// propageres (siste utvei).
struct TranscriptIntelligence: Sendable {
    let availability: OnDeviceAvailabilityChecking
    let onDevice: OnDeviceTranscriptAnalyzing?
    /// Backend-fallback (i produksjon: `APIClient.analyzeTranscript`).
    let backend: @Sendable (_ transcript: String, _ leadName: String) async throws -> TranscriptAnalysis
    /// On-device-modellen har ~8k tokens kontekst. Vi ruter lengre
    /// transkript rett til backend (tegn-proxy — konservativt).
    let maxCharsForOnDevice: Int

    init(
        availability: OnDeviceAvailabilityChecking,
        onDevice: OnDeviceTranscriptAnalyzing?,
        maxCharsForOnDevice: Int = 6000,
        backend: @escaping @Sendable (_ transcript: String, _ leadName: String) async throws -> TranscriptAnalysis
    ) {
        self.availability = availability
        self.onDevice = onDevice
        self.maxCharsForOnDevice = maxCharsForOnDevice
        self.backend = backend
    }

    /// Om vi VILLE forsøkt on-device for dette transkriptet (uten å kjøre
    /// det). Nyttig for UI («✨ på enheten») + for tester.
    func prefersOnDevice(transcriptLength: Int) -> Bool {
        onDevice != nil
            && availability.availability == .available
            && transcriptLength <= maxCharsForOnDevice
    }

    func analyze(transcript: String, leadName: String) async throws -> TranscriptIntelligenceResult {
        let trimmed = transcript.trimmingCharacters(in: .whitespacesAndNewlines)

        if let onDevice, prefersOnDevice(transcriptLength: trimmed.count) {
            do {
                let analysis = try await onDevice.analyze(transcript: trimmed, leadName: leadName)
                return TranscriptIntelligenceResult(analysis: analysis, source: .onDevice)
            } catch {
                // Guardrail-avslag / modell-feil underveis → fall tilbake til
                // backend i stedet for å feile for brukeren.
                #if DEBUG
                print("[TranscriptIntelligence] on-device feilet, faller tilbake til backend: \(error)")
                #endif
            }
        }

        let analysis = try await backend(trimmed, leadName)
        return TranscriptIntelligenceResult(analysis: analysis, source: .backend)
    }
}

// MARK: - Produksjons-fabrikk

/// Bygger en produksjons-`TranscriptIntelligence` fra en `APIClient`. Velger
/// live on-device-stack på iOS 26+, ellers backend-only.
@MainActor
enum TranscriptIntelligenceFactory {
    static func make(api: APIClient, leadId: String?) -> TranscriptIntelligence {
        var checker: OnDeviceAvailabilityChecking = UnsupportedOSAvailabilityChecker()
        var analyzer: OnDeviceTranscriptAnalyzing? = nil

        if #available(iOS 26, *) {
            checker = LiveOnDeviceAvailabilityChecker()
            analyzer = FoundationModelsTranscriptAnalyzer()
        }

        return TranscriptIntelligence(
            availability: checker,
            onDevice: analyzer,
            backend: { transcript, _ in
                // Backend krever en ekte lead-id. I mock/demo-modus (ingen
                // backendId) finnes ingen fallback → gjør det eksplisitt.
                guard let leadId else { throw TranscriptIntelligenceError.noBackendLead }
                return try await api.analyzeTranscript(leadId: leadId, transcript: transcript)
            }
        )
    }
}

enum TranscriptIntelligenceError: Error {
    /// Ingen backend-lead-id (demo/mock) og on-device var ikke tilgjengelig.
    case noBackendLead
}
