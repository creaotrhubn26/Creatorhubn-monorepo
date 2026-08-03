// RoutePlannerSheet.swift
//
// Multi-stopp rute-planlegger (Salgssjef-cockpit → «Planlegg ny rute»).
// Klient-side: velg stopp fra leads → nærmeste-nabo-optimalisert rekkefølge
// → reiseplan med distanse/ETA → «Start rute» via den eksisterende
// Kart-nav-motoren (appState.requestNavigation). Ingen backend.

import SwiftUI
import CoreLocation

// Lokal palett (matcher SlBrand — den globale `Brand` er fil-privat).
fileprivate enum RBrand {
    static let bg           = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card         = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let stroke       = Color.white.opacity(0.08)
    static let purple       = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight  = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let blue         = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let green        = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let textSecondary = Color.white.opacity(0.65)
    static let textTertiary = Color.white.opacity(0.4)
}

struct RoutePlannerSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var selected: Set<String> = []
    @State private var ordered: [LeadModel] = []
    @State private var planned = false

    /// Kart-panelets velg-modus sender forhåndsvalgte lead-id-er
    /// («Legg N i rute») — pickeren åpner ferdig avhuket.
    init(preselected: Set<String> = []) {
        _selected = State(initialValue: preselected)
    }

    // Kandidater: leads med ekte koordinater (dropp 0,0-plassholdere).
    private var candidates: [LeadModel] {
        appState.leads
            .filter { abs($0.latitude) > 0.0001 && abs($0.longitude) > 0.0001 }
            .sorted { ($0.leadScore ?? 0) > ($1.leadScore ?? 0) }
    }

    private var startCoord: CLLocationCoordinate2D? {
        LocationService.shared.currentLocation?.coordinate
    }

    var body: some View {
        NavigationStack {
            ZStack {
                RBrand.bg.ignoresSafeArea()
                if candidates.isEmpty {
                    ContentUnavailableView(
                        "Ingen leads med posisjon",
                        systemImage: "mappin.slash",
                        description: Text("Legg til leads med adresse/koordinater for å planlegge en rute.")
                    )
                } else if planned {
                    plannedItinerary
                } else {
                    picker
                }
            }
            .navigationTitle(planned ? "Reiseplan" : "Planlegg rute")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(planned ? "Endre" : "Avbryt") {
                        if planned { planned = false } else { dismiss() }
                    }.tint(RBrand.textSecondary)
                }
                if !planned {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Planlegg") { optimize() }
                            .fontWeight(.semibold)
                            .tint(RBrand.purpleLight)
                            .disabled(selected.count < 2)
                    }
                }
            }
        }
    }

    // MARK: Velg stopp

    private var picker: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("Velg stoppene du vil besøke. Rekkefølgen optimeres automatisk (korteste kjørerute).")
                    .font(.appScaled(size: 12))
                    .foregroundStyle(RBrand.textSecondary)
                    .padding(.horizontal, 4).padding(.bottom, 4)
                ForEach(candidates) { lead in
                    Button { toggle(lead.id) } label: {
                        HStack(spacing: 12) {
                            Image(systemName: selected.contains(lead.id) ? "checkmark.circle.fill" : "circle")
                                .font(.appScaled(size: 20))
                                .foregroundStyle(selected.contains(lead.id) ? RBrand.purpleLight : RBrand.textTertiary)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(lead.name).font(.appScaled(size: 14, weight: .semibold))
                                    .foregroundStyle(.white).lineLimit(1)
                                Text(lead.address ?? "—").font(.appScaled(size: 11))
                                    .foregroundStyle(RBrand.textSecondary).lineLimit(1)
                            }
                            Spacer()
                            if let s = lead.leadScore {
                                Text("\(s)").font(.appScaled(size: 12, weight: .bold, design: .rounded))
                                    .foregroundStyle(RBrand.textTertiary).monospacedDigit()
                            }
                        }
                        .padding(12)
                        .background(RBrand.card, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(
                            selected.contains(lead.id) ? RBrand.purpleLight.opacity(0.5) : RBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(16)
        }
    }

    // MARK: Reiseplan

    private var plannedItinerary: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                // Sammendrag
                HStack(spacing: 12) {
                    summaryTile("STOPP", "\(ordered.count)", RBrand.purpleLight)
                    summaryTile("DISTANSE", "\(Int(totalKm.rounded())) km", RBrand.blue)
                    summaryTile("KJØRETID", etaText, RBrand.green)
                }

                ForEach(Array(ordered.enumerated()), id: \.element.id) { idx, lead in
                    HStack(spacing: 12) {
                        ZStack {
                            Circle().fill(RBrand.purple.opacity(0.25))
                            Text("\(idx + 1)").font(.appScaled(size: 13, weight: .black))
                                .foregroundStyle(RBrand.purpleLight)
                        }.frame(width: 30, height: 30)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(lead.name).font(.appScaled(size: 14, weight: .semibold))
                                .foregroundStyle(.white).lineLimit(1)
                            Text(lead.address ?? "—").font(.appScaled(size: 11))
                                .foregroundStyle(RBrand.textSecondary).lineLimit(1)
                        }
                        Spacer()
                    }
                    .padding(12)
                    .background(RBrand.card, in: RoundedRectangle(cornerRadius: 11))
                }

                Button { startRoute() } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "location.north.line.fill")
                        Text("Start rute (\(ordered.count) stopp)").font(.appScaled(size: 15, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity).padding(14)
                    .background(
                        LinearGradient(colors: [RBrand.purple, RBrand.purpleLight], startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 12))
                    .shadow(color: RBrand.purple.opacity(0.4), radius: 8, y: 2)
                }
                .buttonStyle(.plain)
                .padding(.top, 4)

                Text("«Start rute» åpner navigasjon til første stopp i Kart. Rekkefølgen over er den anbefalte besøksrekkefølgen.")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(RBrand.textTertiary)
            }
            .padding(16)
        }
    }

    private func summaryTile(_ label: String, _ value: String, _ tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.appScaled(size: 9, weight: .black)).foregroundStyle(RBrand.textTertiary).tracking(0.6)
            Text(value).font(.appScaled(size: 20, weight: .heavy, design: .rounded))
                .foregroundStyle(tint).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(RBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(RBrand.stroke, lineWidth: 1))
    }

    // MARK: Logikk

    private func toggle(_ id: String) {
        if selected.contains(id) { selected.remove(id) } else { selected.insert(id) }
    }

    /// Nærmeste-nabo-heuristikk (TSP): start fra posisjon (el. første stopp),
    /// plukk gjentatte ganger nærmeste ubesøkte.
    private func optimize() {
        var pool = candidates.filter { selected.contains($0.id) }
        guard !pool.isEmpty else { return }
        var result: [LeadModel] = []
        var cursor: CLLocationCoordinate2D
        if let s = startCoord {
            cursor = s
        } else {
            let first = pool.removeFirst()
            result.append(first)
            cursor = CLLocationCoordinate2D(latitude: first.latitude, longitude: first.longitude)
        }
        while !pool.isEmpty {
            var bestIdx = 0
            var bestDist = Double.greatestFiniteMagnitude
            for (i, lead) in pool.enumerated() {
                let d = haversine(cursor, CLLocationCoordinate2D(latitude: lead.latitude, longitude: lead.longitude))
                if d < bestDist { bestDist = d; bestIdx = i }
            }
            let next = pool.remove(at: bestIdx)
            result.append(next)
            cursor = CLLocationCoordinate2D(latitude: next.latitude, longitude: next.longitude)
        }
        ordered = result
        planned = true
    }

    private var totalKm: Double {
        guard !ordered.isEmpty else { return 0 }
        var total = 0.0
        var prev: CLLocationCoordinate2D? = startCoord
        for lead in ordered {
            let c = CLLocationCoordinate2D(latitude: lead.latitude, longitude: lead.longitude)
            if let p = prev { total += haversine(p, c) }
            prev = c
        }
        return total / 1000.0
    }

    private var etaText: String {
        // By-kjøring ~35 km/t inkl. stopp.
        let minutes = Int((totalKm / 35.0 * 60).rounded())
        if minutes >= 60 { return "\(minutes / 60)t \(minutes % 60)m" }
        return "\(minutes) min"
    }

    private func startRoute() {
        guard let first = ordered.first else { return }
        appState.requestNavigation(
            lat: first.latitude, lon: first.longitude,
            name: first.name, address: first.address ?? "", start: true)
        dismiss()
    }

    private func haversine(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        let r = 6_371_000.0
        let dLat = (b.latitude - a.latitude) * .pi / 180
        let dLon = (b.longitude - a.longitude) * .pi / 180
        let lat1 = a.latitude * .pi / 180
        let lat2 = b.latitude * .pi / 180
        let h = sin(dLat / 2) * sin(dLat / 2) + sin(dLon / 2) * sin(dLon / 2) * cos(lat1) * cos(lat2)
        return 2 * r * asin(min(1, sqrt(h)))
    }
}
