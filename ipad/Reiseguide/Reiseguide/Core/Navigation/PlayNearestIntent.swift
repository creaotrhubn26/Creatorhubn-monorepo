// PlayNearestIntent.swift
//
// «Spill nærmeste» (pakke 2, item 6, Daniel-godkjent): Siri, Snarveier-appen
// og handlingsknappen kan starte fortellingen om nærmeste ulåste severdighet
// uten å åpne kartet først. Mønsteret er hentet direkte fra
// ipad/LeadMapApp/LeadMapApp/Core/PondusAppIntents.swift (bevist å
// kompilere i dette monorepoet mot samme iOS 17-mål) — samme
// ReiseguideIntentBridge-mønster som AppStateBridge der.
//
// Dialogtekstene under er bevisst rene Swift-strenger (nb/en/da-switch), ikke
// via Localizable.xcstrings/L10n: PondusAppIntents.swift gjør det samme
// (rene norske literals for IntentDialog), og hvorvidt AppIntents-dialoger
// kan spille via et String Catalog-nøkkeloppslag fra en kjøretids-String er
// UNVERIFIED i dette miljøet (ingen Xcode/SDK-headere tilgjengelig for å
// bekrefte). Å mirrore det beviste mønsteret er tryggere enn å gjette.
//
// Låsen respekteres (env.isLocked): en Siri-kommando skal aldri lande midt i
// en paywall den ikke kan se — den spiller enten noe, eller sier ærlig fra.

import AppIntents
import CoreLocation
import Foundation

@available(iOS 17.0, *)
struct PlayNearestPOIIntent: AppIntent {
    static let title: LocalizedStringResource = "Spill nærmeste"
    static let description = IntentDescription(
        "Spiller av fortellingen om nærmeste severdighet du har tilgang til i SenseAid Explore."
    )
    static let openAppWhenRun: Bool = true

    /// Hvor lenge intentet venter på en posisjon før det gir opp (kald
    /// oppstart trenger tid til CoreLocation faktisk svarer).
    private static let locationTimeout: Duration = .seconds(6)

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        guard let env = ReiseguideIntentBridge.shared.environment else {
            return .result(dialog: dialog(
                nb: "Åpner SenseAid Explore …",
                en: "Opening SenseAid Explore …",
                da: "Åbner SenseAid Explore …"
            ))
        }
        let uiLanguage = env.settings.uiLanguage

        env.location.requestAndStart()
        guard let fix = await Self.awaitFix(location: env.location, timeout: Self.locationTimeout) else {
            return .result(dialog: dialog(
                nb: "Fant ikke posisjonen din ennå. Åpner SenseAid Explore.",
                en: "Couldn't find your location yet. Opening SenseAid Explore.",
                da: "Kunne ikke finde din position endnu. Åbner SenseAid Explore."
            ))
        }

        guard let nearest = NearestUnlockedPOI.find(pois: env.store.pois, from: fix.coordinate, isLocked: { env.isLocked($0) }) else {
            return .result(dialog: dialog(
                nb: "Fant ingen severdighet du har tilgang til i nærheten.",
                en: "Couldn't find a nearby place you have access to.",
                da: "Fandt ingen seværdighed i nærheden, som du har adgang til."
            ))
        }

        env.player.start(poi: nearest)
        let title = nearest.title
        return .result(dialog: Self.localizedDialog(
            uiLanguage,
            nb: "Spiller av \(title).",
            en: "Playing \(title).",
            da: "Afspiller \(title)."
        ))
    }

    @MainActor
    private func dialog(nb: String, en: String, da: String) -> IntentDialog {
        let bridgeLang = ReiseguideIntentBridge.shared.environment?.settings.uiLanguage
        return Self.localizedDialog(bridgeLang ?? "nb", nb: nb, en: en, da: da)
    }

    /// Velger dialogteksten for UI-språket; norsk når språket er ukjent.
    private static func localizedDialog(_ uiLanguage: String, nb: String, en: String, da: String) -> IntentDialog {
        switch uiLanguage {
        case "en": return IntentDialog(stringLiteral: en)
        case "da": return IntentDialog(stringLiteral: da)
        default: return IntentDialog(stringLiteral: nb)
        }
    }

    /// Poller `location.fix` til den kommer eller tiden løper ut — enklere
    /// og trygt nok for et engangskall enn en delegate/continuation-bro.
    @MainActor
    private static func awaitFix(location: LocationService, timeout: Duration) async -> LocationFix? {
        if let fix = location.fix { return fix }
        let deadline = ContinuousClock.now + timeout
        while location.fix == nil, ContinuousClock.now < deadline {
            try? await Task.sleep(for: .milliseconds(250))
        }
        return location.fix
    }
}
