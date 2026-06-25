// TerritoryDashboardView.swift
//
// iPad-native leder-dashboard for sone-ytelse. Per selger: sone-brudd,
// besøk in/ute, leads in/ute, og status. Native fortrinn: live-kart med
// selgernes posisjon der «utenfor sonen nå» vises i rødt; tap zoomer til
// selgeren. Manager-gated (admin/salgssjef/teamleder).

import SwiftUI
import MapKit

struct TerritoryDashboardView: View {
    @Environment(AppState.self) private var state
    @Environment(\.dismiss) private var dismiss

    @State private var sellers: [SellerStats] = []
    @State private var period = "last_30d"
    @State private var loading = true
    @State private var camera: MapCameraPosition = .region(
        MKCoordinateRegion(center: .init(latitude: 59.9139, longitude: 10.7522),
                           span: .init(latitudeDelta: 2.0, longitudeDelta: 3.0)))

    private let periods: [(String, String)] = [
        ("this_month", "Denne mnd"), ("last_30d", "Siste 30d"), ("ytd", "I år"),
    ]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Periode", selection: $period) {
                    ForEach(periods, id: \.0) { Text($0.1).tag($0.0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.top, 8)
                .onChange(of: period) { Task { await load() } }

                if loading {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    liveMap
                        .frame(height: 220)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .padding()
                    List(sellers) { s in sellerRow(s) }
                        .listStyle(.plain)
                }
            }
            .navigationTitle("Sone-ytelse")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Lukk") { dismiss() } }
            }
            .task { await load() }
        }
    }

    private var liveMap: some View {
        Map(position: $camera) {
            ForEach(sellers.filter { $0.live != nil }) { s in
                if let live = s.live {
                    Annotation(s.displayName ?? "Selger", coordinate: live.coordinate) {
                        Circle()
                            .fill(live.currentlyOutOfGrid ? .red : .green)
                            .frame(width: 14, height: 14)
                            .overlay(Circle().stroke(.white, lineWidth: 2))
                            .onTapGesture {
                                camera = .region(MKCoordinateRegion(
                                    center: live.coordinate,
                                    span: .init(latitudeDelta: 0.1, longitudeDelta: 0.15)))
                            }
                    }
                }
            }
        }
        .mapStyle(.standard(elevation: .flat))
    }

    @ViewBuilder
    private func sellerRow(_ s: SellerStats) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text(s.displayName ?? s.userId).font(.subheadline.bold())
                    Text([s.role, s.teamName].compactMap { $0 }.joined(separator: " · "))
                        .font(.caption2).foregroundStyle(.secondary)
                }
                Spacer()
                statusBadge(s)
            }
            HStack(spacing: 14) {
                metric("Brudd", "\(s.breaches.total)", s.breaches.total > 0 ? .orange : .secondary)
                metric("Besøk i/ute", "\(s.visits.inGrid)/\(s.visits.outOfGrid)",
                       s.visits.outOfGrid > 0 ? .orange : .secondary)
                metric("Leads i/ute", "\(s.leads.inGrid)/\(s.leads.outOfGrid)",
                       s.leads.outOfGrid > 0 ? .orange : .secondary)
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func statusBadge(_ s: SellerStats) -> some View {
        if let live = s.live, live.currentlyOutOfGrid {
            Label("Ute nå", systemImage: "location.slash.fill")
                .font(.caption2.bold()).foregroundStyle(.red)
        } else if s.live != nil {
            Label("I sonen", systemImage: "checkmark.circle").font(.caption2).foregroundStyle(.green)
        } else {
            Text("offline").font(.caption2).foregroundStyle(.secondary)
        }
    }

    private func metric(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(spacing: 1) {
            Text(value).font(.subheadline.bold()).foregroundStyle(color)
            Text(label).font(.caption2).foregroundStyle(.secondary)
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
            let resp = try await api.fetchTerritoryDashboard(organizationId: orgId, period: period)
            self.sellers = resp.sellers
            if let first = resp.sellers.first(where: { $0.live != nil })?.live {
                self.camera = .region(MKCoordinateRegion(
                    center: first.coordinate, span: .init(latitudeDelta: 1.0, longitudeDelta: 1.5)))
            }
        } catch {
            print("[TerritoryDashboard] load failed: \(error)")
        }
    }
}
