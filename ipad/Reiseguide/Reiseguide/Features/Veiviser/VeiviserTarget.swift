// VeiviserTarget.swift
//
// Hvilket sted veiviseren (pakke 2, item 5) peker mot: et valgt sted, eller
// «neste sted» — det første ikke-besøkte stedet i områdets rute (sortOrder).
// `resolve` er en ren funksjon uten avhengighet til Observation/
// CoreLocation, så målvalget kan enhetstestes med syntetiske lister.

import Foundation

enum VeiviserTarget: Hashable, Equatable {
    case poi(id: String)
    case nextStop

    /// Finner målet i `pois`. For `.nextStop` hoppes `excludingId` over
    /// (typisk stedet som spilles nå), så veiviseren aldri peker på seg selv.
    static func resolve(
        _ target: VeiviserTarget,
        pois: [GuidePOI],
        visitedIds: Set<String>,
        excludingId: String? = nil
    ) -> GuidePOI? {
        switch target {
        case let .poi(id):
            return pois.first { $0.id == id }
        case .nextStop:
            return pois
                .sorted { $0.sortOrder < $1.sortOrder }
                .first { $0.id != excludingId && !visitedIds.contains($0.id) }
        }
    }
}
