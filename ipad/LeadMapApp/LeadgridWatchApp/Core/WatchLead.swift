// WatchLead.swift
//
// Slank lead-modell for watch-displaying. iPhone-appen sender disse
// via WatchConnectivity (max ~1 KB per lead — Apple anbefaler å holde
// payload under 65 KB). 50 leads → ~50 KB → vi sender topp-50 nærmeste.

import Foundation
import CoreLocation

struct WatchLead: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let address: String?
    let latitude: Double
    let longitude: Double
    let leadStatus: String

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    /// Distanse i meter fra angitt punkt.
    func distance(from location: CLLocation) -> Double {
        let leadLoc = CLLocation(latitude: latitude, longitude: longitude)
        return leadLoc.distance(from: location)
    }

    var statusLabel: String {
        switch leadStatus {
        case "unvisited": return "Ikke besøkt"
        case "visited": return "Besøkt"
        case "meeting_booked": return "Møte booket"
        case "interested": return "Interessert"
        case "won": return "Vunnet"
        default: return leadStatus
        }
    }
}

/// Quick-actions watch-bruker kan utløse på en lead. Sendes tilbake til
/// iPhone via WatchConnectivity som [`action`: String, `leadId`: String].
enum LeadQuickAction: String, Codable, CaseIterable, Sendable {
    case visited
    case called
    case meetingBooked = "meeting_booked"
    case notInterested = "declined"

    var label: String {
        switch self {
        case .visited: return "Besøkt"
        case .called: return "Ringt"
        case .meetingBooked: return "Møte booket"
        case .notInterested: return "Ikke interessert"
        }
    }

    var icon: String {
        switch self {
        case .visited: return "checkmark.circle.fill"
        case .called: return "phone.fill"
        case .meetingBooked: return "calendar"
        case .notInterested: return "xmark.circle.fill"
        }
    }
}
