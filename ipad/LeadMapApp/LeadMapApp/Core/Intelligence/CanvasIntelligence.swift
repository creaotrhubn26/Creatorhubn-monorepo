// CanvasIntelligence.swift
//
// Apple Intelligence for Leadgrid Canvas: OCR-teksten fra håndskrift
// analyseres ON-DEVICE via Foundation Models (iOS 26+, gratis, privat,
// offline) når modellen finnes og støtter norsk — ellers returnerer
// fasaden nil og kalleren bruker backend-Claude som før.
//
// Samme mønster som TranscriptIntelligence/OnDeviceTranscriptAnalyzer:
// alt bak `#if canImport(FoundationModels)` + `@available(iOS 26, *)`,
// norsk-gate via `supportedLanguages`.

import Foundation

enum CanvasIntelligence {

    /// On-device-analyse av gjenkjent håndskrift. nil = ikke tilgjengelig
    /// (eldre OS/enhet, Apple Intelligence av, eller norsk ustøttet) —
    /// kalleren faller da tilbake til backend.
    static func analyserOnDevice(tekst: String,
                                 selskap: String) async -> CanvasAnalyseDTO? {
        #if canImport(FoundationModels)
        if #available(iOS 26, *) {
            guard case .available = LiveOnDeviceAvailabilityChecker().availability
            else { return nil }
            do {
                return try await FoundationModelsCanvasAnalyzer()
                    .analyser(tekst: tekst, selskap: selskap)
            } catch {
                // On-device feilet (kontekst/avbrudd) → stille backend-fallback.
                return nil
            }
        }
        #endif
        return nil
    }
}

#if canImport(FoundationModels)
import FoundationModels

/// Guided generation-skjema for canvas-analysen. Oppgaver/frister som
/// parallelle lister (indeks-parret) — samme flate form som transkript-
/// skjemaet, som er verifisert på enhet.
@available(iOS 26, *)
@Generable
struct CanvasAnalyseDraft {
    @Guide(description: "2-4 setninger på norsk som fanger essensen av møtenotatet: situasjon, behov, neste steg.")
    var oppsummering: String

    @Guide(description: "Null til åtte konkrete gjøremål fra notatet, korte punkter på norsk. Kun det som faktisk står i teksten.")
    var oppgaver: [String]

    @Guide(description: "Frist-hint per gjøremål i samme rekkefølge («torsdag», «neste uke»), tom streng når ingen frist ble nevnt. Samme antall elementer som gjøremålene.")
    var frister: [String]

    @Guide(description: "Ting selgeren lovte kunden, korte punkter på norsk. Tom liste hvis ingen løfter.")
    var lofter: [String]

    func somDTO() -> CanvasAnalyseDTO {
        CanvasAnalyseDTO(
            oppsummering: oppsummering,
            oppgaver: oppgaver.enumerated().map { i, tittel in
                CanvasAnalyseOppgaveDTO(
                    tittel: tittel,
                    frist: i < frister.count && !frister[i].isEmpty ? frister[i] : nil)
            },
            lofter: lofter)
    }
}

@available(iOS 26, *)
struct FoundationModelsCanvasAnalyzer {
    func analyser(tekst: String, selskap: String) async throws -> CanvasAnalyseDTO {
        let instructions = """
        Du er notat-assistenten til en norsk B2B-feltselger. Teksten er \
        gjenkjent fra håndskrift (OCR) og kan ha feil — tolk velvillig, \
        men ikke dikt opp innhold. Linjene kan ha plassering i klammer \
        («[øvre høyre]») og en OBJEKTER PÅ FLATA-seksjon: ting som ligger \
        nær hverandre hører ofte sammen — nevn slike koblinger i \
        oppsummeringen når de gir mening. Svar alltid på norsk.
        """
        let session = LanguageModelSession(instructions: instructions)
        let prompt = """
        Selskap: \(selskap.isEmpty ? "ukjent" : selskap)

        Håndskrevet møtenotat (OCR):
        \(tekst)
        """
        let response = try await session.respond(
            to: prompt,
            generating: CanvasAnalyseDraft.self)
        return response.content.somDTO()
    }
}
#endif
