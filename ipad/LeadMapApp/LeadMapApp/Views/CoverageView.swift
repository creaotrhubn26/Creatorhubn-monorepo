// CoverageView.swift
//
// iPad-native territorie-dekning for managere: stat-fliser + MapKit-kart med
// foreldreløse leads (rødt) og grids (blått). Native fortrinn: «Tegn manglende
// sone» åpner Apple Pencil-editoren rett fra dekningsvisningen, så manageren
// kan tegne en grid over de foreldreløse leadsene umiddelbart.
//
// Data: APIClient.fetchCoverage + fetchOrgTerritories.

import SwiftUI
import MapKit

struct CoverageView: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss

    @State private var coverage: CoverageResult?
    @State private var territories: [Territory] = []
    @State private var loading = true
    @State private var showDraw = false
    @State private var camera: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: .init(latitude: 59.9139, longitude: 10.7522),
            span: .init(latitudeDelta: 1.5, longitudeDelta: 2.5)))

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if loading {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let cov = coverage {
                    statTiles(cov)
                    coverageMap(cov)
                } else {
                    ContentUnavailableView("Ingen dekningsdata", systemImage: "map")
                }
            }
            .navigationTitle("Territorie-dekning")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Lukk") { dismiss() } }
                ToolbarItem(placement: .topBarTrailing) {
                    if state.canCreateAnnotations {
                        Button {
                            showDraw = true
                        } label: {
                            Label("Tegn manglende sone", systemImage: "pencil.and.outline")
                        }
                    }
                }
            }
            .sheet(isPresented: $showDraw, onDismiss: { Task { await load() } }) {
                AnnotationDrawingView(initialRegion: camera.region)
            }
            .task { await load() }
        }
    }

    private func statTiles(_ cov: CoverageResult) -> some View {
        HStack(spacing: 10) {
            tile("\(cov.total)", "Leads", .primary)
            tile("\(cov.covered)", "Dekket", .green)
            tile("\(cov.orphans)", "Foreldreløse", cov.orphans > 0 ? .red : .green)
            tile("\(Int(cov.coveragePct))%", "Dekning", .blue)
        }
        .padding()
    }

    private func tile(_ value: String, _ label: String, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.title2.bold()).foregroundStyle(color)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private func coverageMap(_ cov: CoverageResult) -> some View {
        Map(position: $camera) {
            ForEach(territories) { t in gridOverlay(t) }
            ForEach(cov.orphanLeads) { o in orphanOverlay(o) }
        }
        .mapStyle(.standard(elevation: .flat))
    }

    @MapContentBuilder
    private func gridOverlay(_ t: Territory) -> some MapContent {
        let coords = t.polygonCoordinates
        if coords.count >= 3 {
            MapPolygon(coordinates: coords)
                .stroke(.blue, lineWidth: 2)
                .foregroundStyle(.blue.opacity(0.10))
        }
        if let c = t.center, let r = t.radiusM {
            MapCircle(center: c, radius: CLLocationDistance(r))
                .stroke(.blue, lineWidth: 2)
                .foregroundStyle(.blue.opacity(0.10))
        }
    }

    @MapContentBuilder
    private func orphanOverlay(_ o: CoverageOrphan) -> some MapContent {
        if let c = o.coordinate {
            Annotation(o.name ?? "Uten sone", coordinate: c) {
                Circle()
                    .fill(.red)
                    .frame(width: 12, height: 12)
                    .overlay(Circle().stroke(.white, lineWidth: 1))
            }
        }
    }

    private func load() async {
        guard let api = state.api, let orgId = state.activeOrganizationId else {
            loading = false
            return
        }
        loading = true
        defer { loading = false }
        do {
            async let cov = api.fetchCoverage(organizationId: orgId)
            async let terr = api.fetchOrgTerritories(organizationId: orgId)
            self.coverage = try await cov
            self.territories = try await terr
            if let first = self.coverage?.orphanLeads.first(where: { $0.coordinate != nil })?.coordinate {
                self.camera = .region(MKCoordinateRegion(
                    center: first, span: .init(latitudeDelta: 0.5, longitudeDelta: 0.8)))
            }
        } catch {
            print("[Coverage] load failed: \(error)")
        }
    }
}
