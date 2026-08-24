// TipEngine.swift — formulerer ETT prioritert, naturlig fototips fra
// FrameSignals (Vision) + aviation-kontekst.
//
// Lag 3: bruker Apple Intelligence sin on-device Foundation Model når den
// er tilgjengelig (iOS 26+, Apple Intelligence på). Faller ellers tilbake
// til deterministiske regler — samme signaler, kortere formulering. Ingen
// nett, ingen data forlater enheten.

import Foundation

#if canImport(FoundationModels)
import FoundationModels
#endif

struct LiveTip: Sendable, Equatable {
    let text: String
    /// Høyere = viktigere (styrer om et nytt tips overskriver et eldre).
    let priority: Int
    let source: Source

    enum Source: Sendable { case rule, appleIntelligence }
}

struct TipContext: Sendable {
    var aircraftType: String?
    var distanceKm: Double?
    var lightLabel: String?
    var recommendedShutter: String?
    var currentShutter: String?
}

enum TipEngine {
    /// Regel-tips: rangert liste, viktigst først. Alltid tilgjengelig.
    static func ruleTips(signals: FrameSignals, context: TipContext) -> [LiveTip] {
        var tips: [LiveTip] = []

        if let tilt = signals.horizonTiltDeg, abs(tilt) > 1.5 {
            let dir = tilt > 0 ? "høyre" : "venstre"
            tips.append(LiveTip(
                text: "Horisonten heller \(String(format: "%.0f", abs(tilt)))° — rett opp mot \(dir).",
                priority: 70, source: .rule
            ))
        }

        if signals.highlightClippingRatio > 0.3 {
            tips.append(LiveTip(
                text: "Himmelen brenner ut — trekk eksponeringen ned ⅓–⅔ EV.",
                priority: 80, source: .rule
            ))
        } else if signals.averageLuminance < 0.2 {
            tips.append(LiveTip(
                text: "Undereksponert — løft eksponeringen eller åpne blenderen.",
                priority: 75, source: .rule
            ))
        }

        if let center = signals.subjectCenter {
            if center.x > 0.42 && center.x < 0.58 {
                tips.append(LiveTip(
                    text: "Flyet er midtstilt — plasser det i en tredjedel for mer dynamikk.",
                    priority: 55, source: .rule
                ))
            } else if center.y < 0.5 {
                // Flyet i øvre halvdel — sjekk luft foran
                tips.append(LiveTip(
                    text: "La det være mer luft foran flyet enn bak i bevegelsesretningen.",
                    priority: 50, source: .rule
                ))
            }
        }

        if let rec = context.recommendedShutter, let cur = context.currentShutter, rec != cur {
            tips.append(LiveTip(
                text: "Lukkeren står på \(cur) — anbefalt \(rec) for dette flyet.",
                priority: 85, source: .rule
            ))
        }

        return tips.sorted { $0.priority > $1.priority }
    }

    /// Beste tips akkurat nå: Apple Intelligence hvis mulig, ellers regel.
    static func bestTip(signals: FrameSignals, context: TipContext) async -> LiveTip? {
        let rules = ruleTips(signals: signals, context: context)
        guard let top = rules.first else { return nil }

        #if canImport(FoundationModels)
        if #available(iOS 26.0, *), await appleIntelligenceAvailable() {
            if let refined = await refineWithAppleIntelligence(rules: rules, context: context) {
                return refined
            }
        }
        #endif
        return top
    }

    #if canImport(FoundationModels)
    @available(iOS 26.0, *)
    private static func appleIntelligenceAvailable() async -> Bool {
        SystemLanguageModel.default.availability == .available
    }

    @available(iOS 26.0, *)
    private static func refineWithAppleIntelligence(
        rules: [LiveTip], context: TipContext
    ) async -> LiveTip? {
        let facts = rules.prefix(3).map(\.text).joined(separator: " ")
        let ctx = [
            context.aircraftType.map { "Fly: \($0)." },
            context.distanceKm.map { "Avstand: \(String(format: "%.1f", $0)) km." },
            context.lightLabel.map { "Lys: \($0)." },
        ].compactMap { $0 }.joined(separator: " ")

        let instructions = """
        Du er en erfaren flyfotograf som coacher gjennom søkeren. Gi ETT kort, \
        konkret tips på norsk (maks 15 ord). Ikke list opp flere ting — velg det \
        viktigste. Ingen innledning.
        """
        let prompt = "\(ctx) Observasjoner: \(facts) Hva bør fotografen gjøre nå?"

        do {
            let session = LanguageModelSession(instructions: instructions)
            let response = try await session.respond(to: prompt)
            let text = response.content.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { return nil }
            return LiveTip(text: text, priority: rules.first?.priority ?? 60, source: .appleIntelligence)
        } catch {
            return nil
        }
    }
    #endif
}
