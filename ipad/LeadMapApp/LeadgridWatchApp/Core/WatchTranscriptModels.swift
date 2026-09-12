// WatchTranscriptModels.swift
//
// GRUNNLAG for transkript-analyse fra Apple Watch.
//
// watchOS 26.5-SDK har INGEN FoundationModels (verifisert) — on-device LLM
// på klokka krever watchOS 27. Til da er klokka en TYNN KLIENT: den dikterer
// et kort notat (system-diktering), sender det til iPhone via
// WatchConnectivity, og iPhone kjører den delte `TranscriptIntelligence`
// (on-device på telefonen, ELLER backend) og sender resultatet tilbake.
//
// Når watchOS 27 + Xcode 27-SDK er på plass kan `requestAnalysis` gjøres
// on-device rett på klokka — samme resultat-modell, ingen flate-endring.
//
// Message-typene MÅ speile phone-siden (WatchSession.swift). Egne kopier
// fordi watch- og iOS-target har separate kildetrær (samme mønster som
// WatchPondusMessageType).

import Foundation

enum WatchTranscriptMessageType {
    /// Watch → iPhone: «analyser dette dikterte notatet».
    static let analyzeRequest = "transcript.analyze.request"
    /// iPhone → Watch: ferdig analyse.
    static let analyzeResult = "transcript.analyze.result"
}

/// Resultatet iPhone sender tilbake (avledet av `TranscriptAnalysis`).
struct WatchTranscriptResult: Identifiable, Sendable, Equatable {
    let id: String            // requestId
    let resolvedText: String
    let actionItems: [String]
    let followUpDate: String?
    let sentiment: String
    /// "onDevice" eller "backend" — vises som liten kilde-merking.
    let source: String
}

/// Observerbar tilstand for dikterings-flyten på klokka.
@MainActor
final class WatchTranscriptStore: ObservableObject {
    static let shared = WatchTranscriptStore()

    @Published var isAnalyzing = false
    @Published private(set) var pendingRequestId: String?
    @Published var result: WatchTranscriptResult?
    @Published var errorText: String?

    func begin(requestId: String) {
        isAnalyzing = true
        pendingRequestId = requestId
        result = nil
        errorText = nil
    }

    /// Kalles når iPhone svarer. Ignorerer svar på gamle forespørsler.
    func complete(_ r: WatchTranscriptResult) {
        guard r.id == pendingRequestId else { return }
        result = r
        isAnalyzing = false
        pendingRequestId = nil
    }

    func reset() {
        isAnalyzing = false
        pendingRequestId = nil
        result = nil
        errorText = nil
    }
}
