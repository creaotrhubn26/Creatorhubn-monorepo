// ActiveVisitAttributes.swift
//
// Delt mellom hovedapp og Widget Extension (LeadMapWidget). Definerer
// ActivityKit-attributtene for 'Pågående besøk'-Live Activity.

import ActivityKit
import Foundation

@available(iOS 16.1, *)
struct ActiveVisitAttributes: ActivityAttributes {
    /// Dynamiske felter som oppdateres mens besøket pågår
    public struct ContentState: Codable, Hashable, Sendable {
        var elapsedSeconds: Int
        var statusLabel: String
    }

    /// Statiske felter satt ved start
    var leadName: String
    var leadAddress: String?
    var startedAt: Date
    var leadId: String
}
