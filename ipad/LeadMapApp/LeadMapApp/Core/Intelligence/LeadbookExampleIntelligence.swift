// LeadbookExampleIntelligence.swift
//
// Leadbook-varianten av TranscriptIntelligence (2026-08-02): rå samtale-
// tekst → strukturert lærings-eksempel (tittel, sammendrag, lærdommer).
//
// Ruting (samme prinsipp som TranscriptIntelligence):
//   1. iOS 26+ Apple Intelligence-enhet + norsk støttet + tekst ≤ 6k tegn
//      → on-device (gratis, privat, ingen entitlement — koster ingenting).
//   2. Ellers → backend `POST /leadbook/examples/structure` (Claude), som
//      er leder- og `leadbookAiStruktur`-entitlement-gated fordi den
//      koster penger. Entitlement-avslag propageres til calleren.
//
// Resultat-typen er backendens `APIClient.StructuredExampleDTO` for begge
// kilder, så UI-mappingen (applyAISuggestions m.fl.) er identisk uansett
// hvor analysen kjørte. On-device fyller ikke dimension_scores/pondus_score
// (for upresist for en liten modell) — de feltene er nil fra den kilden.

import Foundation

// MARK: - Resultat

struct LeadbookExampleIntelligenceResult {
    let structured: APIClient.StructuredExampleDTO
    /// Hvor analysen faktisk ble kjørt — for UI-badge («på enheten»/«sky»).
    let source: TranscriptIntelligenceSource
}

// MARK: - On-device-abstraksjon (testbar, jf. OnDeviceTranscriptAnalyzing)

protocol LeadbookExampleAnalyzing: Sendable {
    func structure(rawText: String) async throws -> APIClient.StructuredExampleDTO
}

// MARK: - Fasade

struct LeadbookExampleIntelligence: Sendable {
    let availability: OnDeviceAvailabilityChecking
    let onDevice: (any LeadbookExampleAnalyzing)?
    /// Backend-fallback (i produksjon: `APIClient.structureLeadbookExample`).
    let backend: @Sendable (_ rawText: String) async throws -> APIClient.StructuredExampleDTO
    /// Samme konservative tegn-tak som TranscriptIntelligence (~8k tokens).
    let maxCharsForOnDevice: Int

    init(
        availability: OnDeviceAvailabilityChecking,
        onDevice: (any LeadbookExampleAnalyzing)?,
        maxCharsForOnDevice: Int = 6000,
        backend: @escaping @Sendable (_ rawText: String) async throws -> APIClient.StructuredExampleDTO
    ) {
        self.availability = availability
        self.onDevice = onDevice
        self.maxCharsForOnDevice = maxCharsForOnDevice
        self.backend = backend
    }

    func prefersOnDevice(rawTextLength: Int) -> Bool {
        onDevice != nil
            && availability.availability == .available
            && rawTextLength <= maxCharsForOnDevice
    }

    func structure(rawText: String) async throws -> LeadbookExampleIntelligenceResult {
        let trimmed = rawText.trimmingCharacters(in: .whitespacesAndNewlines)

        if let onDevice, prefersOnDevice(rawTextLength: trimmed.count) {
            do {
                let structured = try await onDevice.structure(rawText: trimmed)
                return LeadbookExampleIntelligenceResult(structured: structured, source: .onDevice)
            } catch {
                // Guardrail-avslag / modell-feil → fall stille tilbake til
                // backend i stedet for å feile for brukeren.
                #if DEBUG
                print("[LeadbookExampleIntelligence] on-device feilet, faller tilbake til backend: \(error)")
                #endif
            }
        }

        let structured = try await backend(trimmed)
        return LeadbookExampleIntelligenceResult(structured: structured, source: .backend)
    }
}

// MARK: - Produksjons-fabrikk

@MainActor
enum LeadbookExampleIntelligenceFactory {
    static func make(api: APIClient) -> LeadbookExampleIntelligence {
        var checker: OnDeviceAvailabilityChecking = UnsupportedOSAvailabilityChecker()
        var analyzer: (any LeadbookExampleAnalyzing)? = nil

        if #available(iOS 26, *) {
            #if canImport(FoundationModels)
            checker = LiveOnDeviceAvailabilityChecker()
            analyzer = FoundationModelsLeadbookExampleAnalyzer()
            #endif
        }

        return LeadbookExampleIntelligence(
            availability: checker,
            onDevice: analyzer,
            backend: { rawText in
                try await api.structureLeadbookExample(rawText: rawText)
            }
        )
    }
}

// MARK: - On-device-implementasjon (iOS 26+, Foundation Models)

#if canImport(FoundationModels)
import FoundationModels

/// Guided-generation-skjema for lærings-eksempelet. Speiler feltene i
/// backendens structure-prompt (minus scores — se fil-header).
@available(iOS 26, *)
@Generable
struct LeadbookExampleDraft {
    @Guide(description: "Kort beskrivende tittel på norsk, f.eks. 'Prisinnvending snudd med referansekunde'.")
    var title: String

    @Guide(description: "Sammendrag av samtalen i 2-3 setninger på norsk.")
    var summary: String

    @Guide(description: "Utfallet av samtalen. Nøyaktig én av: won, lost, ongoing. Bruk ongoing hvis uklart.")
    var outcome: String

    @Guide(description: "3 til 5 konkrete lærdommer fra samtalen. Korte punkter på norsk. Ikke finn på fakta som ikke står i teksten.")
    var keyLearnings: [String]

    @Guide(description: "0 til 3 forslag til bedre formuleringer selgeren kunne brukt. Tom liste hvis ingen er naturlige.")
    var alternativePhrasings: [String]

    func toStructured() -> APIClient.StructuredExampleDTO {
        APIClient.StructuredExampleDTO(
            title: title.isEmpty ? nil : title,
            summary: summary.isEmpty ? nil : summary,
            outcome: normalizedOutcome,
            transcript: nil,
            keyLearnings: keyLearnings.isEmpty ? nil : keyLearnings,
            alternativePhrasings: alternativePhrasings.isEmpty ? nil : alternativePhrasings,
            dimensionScores: nil,
            featuredDimension: nil,
            pondusScore: nil
        )
    }

    private var normalizedOutcome: String? {
        let o = outcome.lowercased()
        if o.contains("won") || o.contains("vant") { return "won" }
        if o.contains("lost") || o.contains("tapt") { return "lost" }
        if o.contains("ongoing") || o.contains("pågå") { return "ongoing" }
        return nil
    }
}

@available(iOS 26, *)
struct FoundationModelsLeadbookExampleAnalyzer: LeadbookExampleAnalyzing {
    func structure(rawText: String) async throws -> APIClient.StructuredExampleDTO {
        let instructions = """
        Du er en norsk salgscoach. Du får rå tekst fra en salgssamtale \
        (transkript fra tale-til-tekst eller innlimte notater — kan mangle \
        tegnsetting). Lag et kort lærings-eksempel: beskrivende tittel, \
        sammendrag, utfall og konkrete lærdommer. Ikke finn på fakta som \
        ikke står i teksten. Svar alltid på norsk.
        """
        let session = LanguageModelSession(instructions: instructions)

        let response = try await session.respond(
            to: "Samtale:\n\(rawText)",
            generating: LeadbookExampleDraft.self
        )
        return response.content.toStructured()
    }
}

#endif
