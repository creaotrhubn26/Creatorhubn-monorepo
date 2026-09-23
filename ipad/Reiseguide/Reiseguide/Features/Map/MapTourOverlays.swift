// MapTourOverlays.swift
//
// Kartlagene under markørene: turruta (svak, stiplet accent-linje mellom
// områdets steder i sortOrder), lydsonen rundt hvert sted (`triggerRadiusM`,
// svak sirkel) og ruta til valgt sted (tydelig gangrute, eller stiplet
// luftlinje som reserve). Alt her er dekorativt: kartlag er ikke egne
// VoiceOver-elementer, og det samme sies i markørene, rutetiketten og
// kartoppsummeringen.

import MapKit
import SwiftUI

@MainActor
enum MapTourOverlays {
    @MapContentBuilder
    static func content(tourPois: [GuidePOI], zonePois: [GuidePOI], routeLine: MapRouteLine?) -> some MapContent {
        let tour = TourRoute.coordinates(tourPois).map(\.clCoordinate)
        if !tour.isEmpty {
            MapPolyline(coordinates: tour)
                .stroke(AppColor.accent.opacity(0.45), style: tourStroke)
        }
        ForEach(zonePois, id: \.id) { poi in
            MapCircle(center: poi.coordinate.clCoordinate, radius: CLLocationDistance(poi.triggerRadiusM))
                .foregroundStyle(AppColor.accent.opacity(0.08))
                .stroke(AppColor.accent.opacity(0.3), lineWidth: 1)
        }
        if let routeLine {
            MapPolyline(coordinates: routeLine.coordinates.map(\.clCoordinate))
                .stroke(AppColor.accent, style: routeLine.isWalkingRoute ? walkingStroke : straightLineStroke)
        }
    }

    private static var tourStroke: StrokeStyle {
        StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round, dash: [2, 8])
    }

    private static var walkingStroke: StrokeStyle {
        StrokeStyle(lineWidth: 6, lineCap: .round, lineJoin: .round)
    }

    private static var straightLineStroke: StrokeStyle {
        StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round, dash: [8, 8])
    }
}
