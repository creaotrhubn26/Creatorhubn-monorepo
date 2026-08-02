// ShootActivityAttributes.swift
//
// Delt mellom app- og widget-target (som LeadMap deler ActiveVisitAttributes).
// Beskriver «shoot i gang»-Live Activity: låseskjerm + Dynamic Island viser
// øktnavn + antall bilder + tether-status mens fotografen jobber.

import Foundation
import ActivityKit

struct ShootActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var shotCount: Int
        var lastFilename: String?
        var tethered: Bool
    }

    var sessionName: String
    var startedAt: Date
}
