// RelatedPlaces.swift
//
// «Tips til liknende severdighet i nærheten» («etter besøket», 18.09.2026).
// Regnes ut lokalt fra området appen allerede har lastet, så det virker
// uten nett: samme kategori først, deretter kortest avstand fra stedet man
// nettopp besøkte. Ren logikk, testes med syntetiske punkter.

import Foundation

enum RelatedPlaces {
    struct Suggestion: Equatable, Identifiable {
        let poi: GuidePOI
        let distanceM: Double
        let sameCategory: Bool

        var id: String { poi.id }
    }

    static func suggest(for poi: GuidePOI, among all: [GuidePOI], limit: Int = 3) -> [Suggestion] {
        guard limit > 0 else { return [] }
        return all
            .filter { $0.id != poi.id }
            .map { candidate in
                Suggestion(
                    poi: candidate,
                    distanceM: Geo.distanceM(from: poi.coordinate, to: candidate.coordinate),
                    sameCategory: poi.categoryId != nil && candidate.categoryId == poi.categoryId
                )
            }
            .sorted { lhs, rhs in
                if lhs.sameCategory != rhs.sameCategory { return lhs.sameCategory }
                if lhs.distanceM != rhs.distanceM { return lhs.distanceM < rhs.distanceM }
                return lhs.poi.sortOrder < rhs.poi.sortOrder
            }
            .prefix(limit)
            .map { $0 }
    }
}
