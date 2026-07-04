// MapLeadStub.swift
// Mock-stub for LeadsMapLead.PinStatus så AddLeadSheet kan gjenbrukes
// uten å være avhengig av kart-preview sin egen modell. I prod erstattes
// dette med ekte LeadStatus-enum delt på tvers av Leadgrid.

import SwiftUI
import MapKit

struct LeadsMapLead {
    enum PinStatus: String, Hashable, CaseIterable {
        case hot, warm, new, customer, meeting, followup
        var label: String {
            switch self {
            case .hot:       return "Hot lead"
            case .warm:      return "Varm lead"
            case .new:       return "Ny lead"
            case .customer:  return "Kunde"
            case .meeting:   return "Møte"
            case .followup:  return "Oppfølging"
            }
        }
        var color: Color {
            switch self {
            case .hot:       return Color(red: 0.95, green: 0.20, blue: 0.20)
            case .warm:      return Color(red: 0.98, green: 0.55, blue: 0.10)
            case .new:       return Color(red: 0.66, green: 0.32, blue: 0.99)
            case .customer:  return Color(red: 0.20, green: 0.85, blue: 0.60)
            case .meeting:   return Color(red: 0.34, green: 0.60, blue: 0.98)
            case .followup:  return Color(red: 0.34, green: 0.60, blue: 0.98)
            }
        }
        var icon: String {
            switch self {
            case .hot:       return "flame.fill"
            case .warm:      return "flame"
            case .new:       return "sparkles"
            case .customer:  return "checkmark.seal.fill"
            case .meeting:   return "calendar"
            case .followup:  return "calendar.badge.clock"
            }
        }
    }
}
