// RoutePlannerSheet.swift
//
// Multi-stopp rute-planlegger (Salgssjef-cockpit → «Planlegg ny rute»,
// Kart-panelets velg-modus → «Legg N i rute»).
// Nivå 1 (2026-08-03): møter (nextFollowUpAt i dag) er faste ANKERE som
// ruta planlegges rundt m/ konflikt-varsel; MKDirections gir ekte kjøretid
// per etappe + ankomsttidspunkt per stopp; besøkstid justerbar; «Start
// rute» lagrer hele planen i AppState.rutePlan (persistert) så ankomst-
// kortet i Kart kan kjede «Neste stopp (2/6)» gjennom hele dagen.

import SwiftUI
import CoreLocation
import MapKit

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

    /// Antatt besøkstid per stopp (min) — inngår i ankomsttidene.
    @State private var besokMin = 20
    /// Ekte kjøretid/distanse per etappe fra MKDirections (indeks = stopp).
    /// Tom til beregningen er ferdig; fallback = 35 km/t-estimat.
    @State private var legMinutter: [Int] = []
    @State private var legKm: [Double] = []
    @State private var beregnerEtapper = false

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
                // Gjenoppta: en aktiv rute ligger i AppState (persistert).
                if let plan = appState.rutePlan, plan.index < plan.stopp.count {
                    aktivRuteBanner(plan)
                }
                Text("Velg stoppene du vil besøke. Møter med avtalt tid blir faste ankere; resten optimeres rundt dem.")
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
                            if let anker = ankerTid(lead) {
                                HStack(spacing: 3) {
                                    Image(systemName: "calendar.badge.clock")
                                        .font(.appScaled(size: 9, weight: .semibold))
                                    Text(Self.klokkeslett.string(from: anker))
                                        .font(.appScaled(size: 10, weight: .bold))
                                        .monospacedDigit()
                                }
                                .foregroundStyle(RBrand.blue)
                                .padding(.horizontal, 7).padding(.vertical, 4)
                                .background(RBrand.blue.opacity(0.15), in: Capsule())
                            }
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
        let tider = ankomstTider()
        return ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                // Sammendrag — ekte MKDirections-tall når beregnet.
                HStack(spacing: 12) {
                    summaryTile("STOPP", "\(ordered.count)", RBrand.purpleLight)
                    summaryTile("DISTANSE", "\(Int(ekteKm.rounded())) km", RBrand.blue)
                    summaryTile("KJØRETID", ekteEtaText, RBrand.green)
                }
                HStack(spacing: 8) {
                    if beregnerEtapper {
                        ProgressView().controlSize(.mini)
                        Text("Beregner ekte kjøretider…")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(RBrand.textTertiary)
                    } else if let ferdig = tider.last {
                        Text("Ferdig ca. \(Self.klokkeslett.string(from: ferdig.addingTimeInterval(Double(besokMin) * 60)))")
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(RBrand.textSecondary)
                    }
                    Spacer()
                    // Besøkstid per stopp — inngår i ankomsttidene.
                    Menu {
                        ForEach([10, 20, 30, 45], id: \.self) { m in
                            Button { besokMin = m } label: {
                                Label("\(m) min per besøk",
                                      systemImage: besokMin == m ? "checkmark" : "clock")
                            }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "clock")
                                .font(.appScaled(size: 10, weight: .semibold))
                            Text("\(besokMin) min/besøk")
                                .font(.appScaled(size: 11, weight: .semibold))
                            Image(systemName: "chevron.down")
                                .font(.appScaled(size: 8, weight: .semibold))
                        }
                        .foregroundStyle(RBrand.textSecondary)
                        .padding(.horizontal, 9).padding(.vertical, 6)
                        .background(RBrand.card, in: Capsule())
                        .overlay(Capsule().stroke(RBrand.stroke, lineWidth: 1))
                    }
                }

                ForEach(Array(ordered.enumerated()), id: \.element.id) { idx, lead in
                    let anker = ankerTid(lead)
                    let ankomst = idx < tider.count ? tider[idx] : nil
                    let forSent = anker != nil && ankomst != nil && ankomst! > anker!
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
                            if let ankomst {
                                HStack(spacing: 5) {
                                    Text("Ankomst ca. \(Self.klokkeslett.string(from: ankomst))")
                                        .font(.appScaled(size: 10, weight: .semibold))
                                        .foregroundStyle(forSent ? Color(red: 0.95, green: 0.3, blue: 0.3)
                                                                 : RBrand.green)
                                        .monospacedDigit()
                                    if forSent, let anker {
                                        Text("⚠ møtet er kl. \(Self.klokkeslett.string(from: anker))")
                                            .font(.appScaled(size: 10, weight: .bold))
                                            .foregroundStyle(Color(red: 0.95, green: 0.3, blue: 0.3))
                                    }
                                }
                            }
                        }
                        Spacer()
                        if let anker {
                            HStack(spacing: 3) {
                                Image(systemName: "calendar.badge.clock")
                                    .font(.appScaled(size: 9, weight: .semibold))
                                Text(Self.klokkeslett.string(from: anker))
                                    .font(.appScaled(size: 10, weight: .bold))
                                    .monospacedDigit()
                            }
                            .foregroundStyle(RBrand.blue)
                            .padding(.horizontal, 7).padding(.vertical, 4)
                            .background(RBrand.blue.opacity(0.15), in: Capsule())
                        }
                    }
                    .padding(12)
                    .background(RBrand.card, in: RoundedRectangle(cornerRadius: 11))
                    .overlay(RoundedRectangle(cornerRadius: 11)
                        .stroke(forSent ? Color(red: 0.95, green: 0.3, blue: 0.3).opacity(0.5)
                                        : RBrand.stroke, lineWidth: 1))
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

    static let klokkeslett: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f
    }()

    private func coord(_ lead: LeadModel) -> CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lead.latitude, longitude: lead.longitude)
    }

    /// Møte-anker: avtalt oppfølging/møte i DAG (nextFollowUpAt) = fast
    /// tidspunkt ruta må planlegges rundt.
    private func ankerTid(_ lead: LeadModel) -> Date? {
        guard let t = lead.nextFollowUpAt,
              Calendar.current.isDateInToday(t),
              t > Date().addingTimeInterval(-3600) else { return nil }
        return t
    }

    /// Estimert kjøreminutter (35 km/t) — brukes til anker-planlegging;
    /// MKDirections finpusser visningstidene etterpå.
    private func estimatMin(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        haversine(a, b) / 1000 / 35.0 * 60
    }

    /// Anker-bevisst rekkefølge: møter (m/ tid) er fast ryggrad i tids-
    /// rekkefølge; frie stopp fylles grådig inn der det er tid til dem
    /// FØR neste møte (nærmeste-nabo + tidssjekk). Rest etter siste anker.
    private func optimize() {
        var pool = candidates.filter { selected.contains($0.id) }
        guard !pool.isEmpty else { return }

        let anchors = pool
            .filter { ankerTid($0) != nil }
            .sorted { (ankerTid($0) ?? .distantFuture) < (ankerTid($1) ?? .distantFuture) }
        pool.removeAll { lead in anchors.contains(where: { $0.id == lead.id }) }

        var result: [LeadModel] = []
        var cursor: CLLocationCoordinate2D
        if let s = startCoord {
            cursor = s
        } else if let ref = anchors.first ?? pool.first {
            cursor = coord(ref)
        } else { return }

        var klokke = Date()
        let besok = Double(besokMin)

        func taNaermeste(fra: CLLocationCoordinate2D) -> LeadModel? {
            guard !pool.isEmpty else { return nil }
            var bestIdx = 0
            var bestDist = Double.greatestFiniteMagnitude
            for (i, lead) in pool.enumerated() {
                let d = haversine(fra, coord(lead))
                if d < bestDist { bestDist = d; bestIdx = i }
            }
            return pool.remove(at: bestIdx)
        }

        for anker in anchors {
            let ankerC = coord(anker)
            let frist = ankerTid(anker) ?? .distantFuture
            // Fyll inn frie stopp så lenge vi fortsatt rekker møtet.
            while let kandidat = pool.min(by: {
                haversine(cursor, coord($0)) < haversine(cursor, coord($1))
            }) {
                let kandidatC = coord(kandidat)
                let etterKandidat = klokke
                    .addingTimeInterval((estimatMin(cursor, kandidatC) + besok
                                         + estimatMin(kandidatC, ankerC)) * 60)
                guard etterKandidat <= frist else { break }
                pool.removeAll { $0.id == kandidat.id }
                result.append(kandidat)
                klokke = klokke.addingTimeInterval(
                    (estimatMin(cursor, kandidatC) + besok) * 60)
                cursor = kandidatC
            }
            // Kjør til møtet — vent til avtalt tid om vi er tidlig ute.
            let ankomst = klokke.addingTimeInterval(estimatMin(cursor, ankerC) * 60)
            klokke = max(ankomst, frist).addingTimeInterval(besok * 60)
            result.append(anker)
            cursor = ankerC
        }

        // Resten: klassisk nærmeste-nabo.
        while let next = taNaermeste(fra: cursor) {
            result.append(next)
            cursor = coord(next)
        }

        ordered = result
        planned = true
        legMinutter = []
        legKm = []
        Task { await beregnEtapper() }
    }

    /// Ekte kjøretid/distanse per etappe (MKDirections, sekvensielt).
    /// Feilende etapper faller tilbake til 35 km/t-estimatet.
    @MainActor
    private func beregnEtapper() async {
        beregnerEtapper = true
        defer { beregnerEtapper = false }
        var mins: [Int] = []
        var kms: [Double] = []
        var prev = startCoord
        for lead in ordered {
            let c = coord(lead)
            if let p = prev {
                if let rute = try? await kjoreRute(fra: p, til: c) {
                    mins.append(max(1, Int(rute.expectedTravelTime / 60)))
                    kms.append(rute.distance / 1000)
                } else {
                    let km = haversine(p, c) / 1000
                    mins.append(max(1, Int(km / 35.0 * 60)))
                    kms.append(km)
                }
            } else {
                mins.append(0)
                kms.append(0)
            }
            prev = c
        }
        legMinutter = mins
        legKm = kms
    }

    private func kjoreRute(fra: CLLocationCoordinate2D,
                           til: CLLocationCoordinate2D) async throws -> MKRoute {
        let req = MKDirections.Request()
        req.source = MKMapItem(placemark: MKPlacemark(coordinate: fra))
        req.destination = MKMapItem(placemark: MKPlacemark(coordinate: til))
        req.transportType = .automobile
        let resp = try await MKDirections(request: req).calculate()
        guard let r = resp.routes.first else {
            throw NSError(domain: "RoutePlanner", code: 1)
        }
        return r
    }

    /// Ankomsttidspunkt per stopp: nå + kjøretid (ekte når beregnet) +
    /// besøkstid; møte-ankere venter til avtalt tid om vi er tidlige.
    private func ankomstTider() -> [Date] {
        var t = Date()
        var out: [Date] = []
        var prev = startCoord
        for (i, lead) in ordered.enumerated() {
            let c = coord(lead)
            let kjorMin: Double
            if i < legMinutter.count {
                kjorMin = Double(legMinutter[i])
            } else if let p = prev {
                kjorMin = estimatMin(p, c)
            } else {
                kjorMin = 0
            }
            t = t.addingTimeInterval(kjorMin * 60)
            if let anker = ankerTid(lead), anker > t { t = anker }
            out.append(t)
            t = t.addingTimeInterval(Double(besokMin) * 60)
            prev = c
        }
        return out
    }

    private var ekteKm: Double {
        legKm.isEmpty ? totalKm : legKm.reduce(0, +)
    }

    private var ekteEtaText: String {
        let minutes = legMinutter.isEmpty
            ? Int((totalKm / 35.0 * 60).rounded())
            : legMinutter.reduce(0, +)
        if minutes >= 60 { return "\(minutes / 60)t \(minutes % 60)m" }
        return "\(minutes) min"
    }

    private var totalKm: Double {
        guard !ordered.isEmpty else { return 0 }
        var total = 0.0
        var prev: CLLocationCoordinate2D? = startCoord
        for lead in ordered {
            let c = coord(lead)
            if let p = prev { total += haversine(p, c) }
            prev = c
        }
        return total / 1000.0
    }

    /// Gjenoppta/avslutt en aktiv (persistert) rute.
    private func aktivRuteBanner(_ plan: AppState.RutePlan) -> some View {
        let neste = plan.stopp[plan.index]
        return HStack(spacing: 10) {
            Image(systemName: "point.topleft.down.curvedto.point.bottomright.up.fill")
                .font(.appScaled(size: 14, weight: .semibold))
                .foregroundStyle(RBrand.purpleLight)
            VStack(alignment: .leading, spacing: 2) {
                Text("Aktiv rute: \(plan.stopp.count - plan.index) stopp igjen")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                Text("Neste: \(neste.name)")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(RBrand.textSecondary)
                    .lineLimit(1)
            }
            Spacer()
            Button {
                appState.requestNavigation(lat: neste.lat, lon: neste.lon,
                                           name: neste.name, address: neste.address,
                                           start: true, transport: "driving")
                dismiss()
            } label: {
                Text("Fortsett")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 7)
                    .background(RBrand.purple, in: Capsule())
            }
            .buttonStyle(.plain)
            Button { appState.avsluttRute() } label: {
                Image(systemName: "xmark")
                    .font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(RBrand.textSecondary)
                    .frame(width: 26, height: 26)
                    .background(RBrand.card, in: Circle())
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .background(RBrand.purple.opacity(0.12), in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11)
            .stroke(RBrand.purple.opacity(0.4), lineWidth: 1))
    }

    /// Start rute: lagre HELE planen (persistert) → naviger til første stopp.
    /// Ankomst-kortet i Kart kjeder «Neste stopp» gjennom resten av dagen.
    private func startRoute() {
        guard !ordered.isEmpty else { return }
        let stopp = ordered.map { lead in
            AppState.RuteStopp(id: lead.id, name: lead.name,
                               address: lead.address ?? "",
                               lat: lead.latitude, lon: lead.longitude,
                               ankerTid: ankerTid(lead))
        }
        appState.startRutePlan(stopp)
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
