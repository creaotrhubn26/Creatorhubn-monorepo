// AreaSelection.swift
//
// Hvilket område appen viser (Lørenskog, Nesoddtangen, Oslo …), som ren
// logikk uten CoreLocation eller UI, så valget kan enhetstestes:
//   1. Brukerens eget valg (AppSettings.selectedAreaSlug) vinner, så lenge
//      backend fortsatt har området, eller vi er uten nett og ikke vet noe annet.
//   2. Ellers området med sentrum nærmest brukeren, hvis posisjonen er kjent
//      og området ligger innenfor `maxAutoSelectDistanceM` (en turist i
//      Bergen skal få Oslo, ikke det tilfeldig nærmeste av tre Oslo-områder).
//   3. Ellers Oslo-området (demo-området), eller det første backend har.
// Brukes av AppEnvironment.reconcileArea() og AreaPickerView.

import Foundation

enum AreaSelection {
    /// Reserveområdet når ingenting er valgt og posisjonen er ukjent.
    static let fallbackSlug = AreaStore.demoAreaSlug

    /// Lenger unna enn dette fra alle områdesentre: ikke velg etter posisjon.
    static let maxAutoSelectDistanceM: Double = 50_000

    /// Området med sentrum nærmest `origin`, eller nil hvis ingen er innenfor `maxDistanceM`.
    static func nearest(to origin: Coordinate, in areas: [GuideArea], maxDistanceM: Double = maxAutoSelectDistanceM) -> GuideArea? {
        areas
            .map { (area: $0, distanceM: Geo.distanceM(from: origin, to: $0.center)) }
            .filter { $0.distanceM <= maxDistanceM }
            .min { $0.distanceM < $1.distanceM }?
            .area
    }

    /// Sluggen appen skal laste. `areas` er tom når listen ikke kunne hentes (uten nett).
    static func resolveSlug(storedSlug: String?, areas: [GuideArea], location: Coordinate?) -> String {
        if let storedSlug, areas.isEmpty || areas.contains(where: { $0.slug == storedSlug }) {
            return storedSlug
        }
        if let location, let nearest = nearest(to: location, in: areas) {
            return nearest.slug
        }
        if areas.isEmpty || areas.contains(where: { $0.slug == fallbackSlug }) {
            return fallbackSlug
        }
        return areas[0].slug
    }

    /// Radene i områdevelgeren: listen fra backend, eller bare området som
    /// vises nå når listen ikke kunne hentes (uten nett og uten lagret liste).
    static func pickerAreas(fetched: [GuideArea], current: GuideArea?) -> [GuideArea] {
        if !fetched.isEmpty { return fetched }
        return current.map { [$0] } ?? []
    }

    /// Lokaliseringsnøkkelen for «1 sted» / «4 steder».
    static func placesKey(count: Int) -> String {
        count == 1 ? "area.places.one" : "area.places.other"
    }
}
