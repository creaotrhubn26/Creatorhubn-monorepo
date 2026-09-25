// NearestUnlockedPOI.swift
//
// Ren logikk for «Spill nærmeste» (pakke 2, item 6, App Intent): nærmeste
// sted brukeren faktisk kan spille av. Låste steder hoppes over helt — en
// Siri-kommando skal aldri lande på paywallen, den skal enten spille noe
// eller si ærlig fra at det ikke er noe å spille. Ingen avhengighet til
// AppIntents/MapKit her, så utvalget kan enhetstestes for seg
// (PlayNearestIntent.perform() selv er ikke testbar — se filens hode der).

import Foundation

enum NearestUnlockedPOI {
    static func find(pois: [GuidePOI], from coordinate: Coordinate, isLocked: (GuidePOI) -> Bool) -> GuidePOI? {
        Geo.sortedByDistance(pois.filter { !isLocked($0) }, from: coordinate).first?.poi
    }
}
