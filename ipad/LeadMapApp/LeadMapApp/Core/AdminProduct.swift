// AdminProduct.swift
//
// Multi-produkt-paritet for Admin Room (PR #827):
// `?product=role_room|leadgrid` på business-plan, outreach-templates og
// industry-targets. iPad-en er primært et Leadgrid-verktøy, så
// `.leadgrid` er default.
//
// Bevares i UserDefaults så valget husker mellom app-launches.

import Foundation

/// Hvilket produkt en super-admin er i kontekst for i Admin Room-flatene.
/// Backend-konstantene er "role_room" og "leadgrid" (se mig 0335 +
/// admin-room-business-plan-routes.ts / admin-room-outreach-routes.ts).
enum AdminProductKey: String, Codable, CaseIterable, Sendable, Identifiable {
    case roleRoom = "role_room"
    case leadgrid = "leadgrid"

    var id: String { rawValue }

    /// Visnings-navn for UI (matcher PRODUCT_LABEL i backend).
    var displayName: String {
        switch self {
        case .roleRoom: return "The Role Room"
        case .leadgrid: return "Leadgrid"
        }
    }

    /// Kort visnings-navn for kompakt UI (pille-toggle, chips).
    var shortName: String {
        switch self {
        case .roleRoom: return "Role Room"
        case .leadgrid: return "Leadgrid"
        }
    }

    /// SF Symbols-ikon for product-velgeren.
    var systemImage: String {
        switch self {
        case .roleRoom: return "film.fill"
        case .leadgrid: return "map.fill"
        }
    }
}

/// UserDefaults-nøkkel for persistert produkt-valg.
/// Speiler `?bizProduct=` URL-state på web-AdminRoom.
enum AdminProductDefaultsKey {
    static let activeProduct = "rr.admin_room.active_product"
}
