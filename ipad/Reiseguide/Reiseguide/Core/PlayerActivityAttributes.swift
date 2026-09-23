// PlayerActivityAttributes.swift
//
// Delt mellom hovedappen og widget-extension-target-et (ReiseguideWidgets):
// ActivityKit-attributtene for «Nå spilles»-Live Activity på låseskjerm og i
// Dynamic Island (pakke 2, item 6). Denne fila kompileres inn i BEGGE
// targets (se project.yml, ReiseguideWidgets.sources).
//
// Alle tekster i ContentState er allerede lokalisert av hovedappen
// (PlayerActivityManager) — widget-extension-target-et har ikke
// L10n/appens .lproj-bundle tilgjengelig, så vi sender ferdig tekst i
// stedet for nøkler.
//
// Mac Catalyst har ikke ActivityKit — hele fila gates ut, samme mønster som
// LeadMap (LeadMapApp/Core/ActiveVisitAttributes.swift). Reiseguide bygger
// ikke for Catalyst i dag, men guarden koster ingenting og holder
// mønsteret identisk.

#if !targetEnvironment(macCatalyst)

import ActivityKit
import Foundation

@available(iOS 16.1, *)
struct PlayerActivityAttributes: ActivityAttributes {
    /// Dynamiske felter som oppdateres mens fortellingen spilles.
    public struct ContentState: Codable, Hashable, Sendable {
        /// «Akershus festning» (kapitteltittelen, kan mangle).
        var chapterTitle: String?
        /// Ferdig-lokalisert, f.eks. «Kapittel 2 av 5».
        var chapterProgressText: String
        /// Ferdig-lokalisert, f.eks. «Spiller» / «Pause».
        var statusText: String
        var isPlaying: Bool
        /// Brukes til ProgressView(timerInterval:) mens isPlaying er true,
        /// så systemet animerer fremdriften uten at appen må oppdatere hvert
        /// sekund. Regnes ut på nytt (PlayerActivityManager) ved hvert
        /// kapittelbytte og spill/pause, så evt. drift ved annen
        /// avspillingshastighet enn 1× rettes opp igjen fort.
        var playbackRangeStart: Date
        var playbackRangeEnd: Date
        /// Statisk fremdrift (0...1) brukt når isPlaying er false.
        var pausedProgress: Double
        /// Ferdig-lokalisert avstand til neste stopp, f.eks. «150 m til neste stopp».
        /// Nil når ukjent (ingen posisjon ennå, eller ingen flere stopp igjen).
        var distanceText: String?
        /// Full tale-oppsummering for VoiceOver (kombinerer alt over).
        var accessibilitySummary: String
    }

    /// Statiske felter satt ved start.
    var poiTitle: String
    var poiId: String
}

#endif  // !macCatalyst
