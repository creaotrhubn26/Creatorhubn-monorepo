// KjorebokView.swift
//
// Leadgrid Go — elektronisk kjørebok. Viser auto-loggede kjøreturer gruppert på
// måned, med Skatteetaten-kompatible felt. Føreren bekrefter formål (firma/
// privat) per tur — det kreves juridisk at formålet attesteres.
//
// Fase 1 MVP: lokal `TripStore`. Fase 1b: backend-sync + PDF/Excel-eksport.

import SwiftUI
import UIKit

private struct ShareItem: Identifiable { let id = UUID(); let url: URL }

struct KjorebokView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var store = TripStore.shared
    @State private var detector = TripDetector.shared
    @State private var month = Date()
    @State private var syncing = false
    @State private var exporting = false
    @State private var sendingReport = false
    @State private var reportMsg: String?
    @State private var shareItem: ShareItem?

    private var monthTrips: [Trip] { store.trips(inMonth: month) }
    private var summary: (km: Double, amount: Double, tolls: Double) { store.businessSummary(inMonth: month) }

    private var monthLabel: String {
        let f = DateFormatter(); f.locale = Locale(identifier: "nb_NO"); f.dateFormat = "MMMM yyyy"
        return f.string(from: month).capitalized
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    autoTripCard
                    monthPicker
                    summaryCard
                    if store.unconfirmedCount > 0 { unconfirmedBanner }
                    if monthTrips.isEmpty { emptyState }
                    else { ForEach(monthTrips) { tripRow($0) } }
                    exportBar
                    Color.clear.frame(height: 24)
                }
                .padding(18)
            }
            .background(NavPOIBrand.bg.ignoresSafeArea())
            .navigationTitle("Kjørebok")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lukk") { dismiss() }.foregroundStyle(NavPOIBrand.purpleLight).fontWeight(.bold)
                }
            }
            .toolbarBackground(NavPOIBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .task {
            // Synk mot backend (durabel lagring på tvers av enheter).
            syncing = true
            if let server = await TripService.shared.sync(store.trips, using: appState.api) {
                store.replaceAll(server)
            }
            syncing = false
        }
        .sheet(item: $shareItem) { item in ActivityView(items: [item.url]) }
    }

    private func confirmPurpose(_ p: TripPurpose, for t: Trip) {
        store.setPurpose(p, for: t.id)
        Task { await TripService.shared.setPurpose(p, id: t.id, using: appState.api) }
    }

    private func exportPDF() {
        let s = store.businessSummary(inMonth: month)
        let v = appState.vehicleProfile
        guard let url = KjorebokPDF.generate(
            monthLabel: monthLabel,
            trips: store.trips(inMonth: month),
            driverName: appState.displayName,
            vehicleName: v.displayName,
            vehiclePlate: v.plate,
            summary: s
        ) else { return }
        shareItem = ShareItem(url: url)
    }

    private func exportCSV() {
        exporting = true
        Task {
            defer { exporting = false }
            guard let csv = await TripService.shared.exportCSV(using: appState.api) else { return }
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("kjorebok.csv")
            try? csv.data(using: .utf8)?.write(to: url)
            shareItem = ShareItem(url: url)
        }
    }

    /// Samtykke-toggle for background auto-deteksjon (GDPR: av som standard).
    private var autoTripCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Toggle(isOn: Binding(get: { detector.enabled }, set: { detector.setEnabled($0) })) {
                HStack(spacing: 8) {
                    ZStack {
                        Circle().fill((detector.enabled ? NavPOIBrand.green : NavPOIBrand.textTertiary).opacity(0.2))
                        Image(systemName: detector.isDriving ? "car.fill" : "car")
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(detector.enabled ? NavPOIBrand.green : NavPOIBrand.textSecondary)
                    }
                    .frame(width: 32, height: 32)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Automatisk kjørebok").font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                        Text(detector.enabled ? (detector.isDriving ? "Registrerer kjøretur nå…" : "Aktiv — logger kjøreturer i bakgrunnen")
                                               : "Av — logg kun ved navigasjon")
                            .font(.appScaled(size: 10)).foregroundStyle(detector.enabled ? NavPOIBrand.green : NavPOIBrand.textSecondary)
                    }
                }
            }
            .tint(NavPOIBrand.green)
            Text("Når på: kjøreturer registreres automatisk med posisjon i bakgrunnen (også når app-en er lukket). Kun kjøring logges, og du bekrefter formålet selv. Personvern: du kan skru av når som helst.")
                .font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textTertiary)
        }
        .padding(13)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(detector.enabled ? NavPOIBrand.green.opacity(0.4) : NavPOIBrand.stroke, lineWidth: 1))
    }

    private var monthPicker: some View {
        HStack {
            Button { shiftMonth(-1) } label: { Image(systemName: "chevron.left").foregroundStyle(.white).padding(8) }
            Spacer()
            Text(monthLabel).font(.appScaled(size: 15, weight: .bold)).foregroundStyle(.white)
            Spacer()
            Button { shiftMonth(1) } label: { Image(systemName: "chevron.right").foregroundStyle(.white).padding(8) }
        }
        .padding(.horizontal, 6)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(NavPOIBrand.stroke, lineWidth: 1))
    }

    private func shiftMonth(_ delta: Int) {
        if let d = Calendar.current.date(byAdding: .month, value: delta, to: month) { month = d }
    }

    private var summaryCard: some View {
        HStack(spacing: 12) {
            summaryTile(value: String(format: "%.0f km", summary.km), label: "Yrkeskjøring", tint: NavPOIBrand.purpleLight)
            summaryTile(value: "\(Int(summary.amount)) kr", label: "Kjøregodtgjørelse", tint: NavPOIBrand.green)
            summaryTile(value: "\(Int(summary.tolls)) kr", label: "Bom", tint: NavPOIBrand.orange)
        }
    }
    private func summaryTile(value: String, label: String, tint: Color) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.appScaled(size: 17, weight: .black, design: .rounded)).foregroundStyle(.white).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(.appScaled(size: 9, weight: .semibold)).foregroundStyle(tint)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 13)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(NavPOIBrand.stroke, lineWidth: 1))
    }

    private var unconfirmedBanner: some View {
        HStack(spacing: 9) {
            Image(systemName: "exclamationmark.circle.fill").foregroundStyle(NavPOIBrand.orange)
            Text("\(store.unconfirmedCount) tur\(store.unconfirmedCount == 1 ? "" : "er") mangler formål")
                .font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white)
            Spacer()
        }
        .padding(11)
        .background(NavPOIBrand.orange.opacity(0.14), in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(NavPOIBrand.orange.opacity(0.4), lineWidth: 1))
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "book.closed").font(.system(size: 34)).foregroundStyle(NavPOIBrand.textTertiary)
            Text("Ingen turer denne måneden").font(.appScaled(size: 13, weight: .semibold)).foregroundStyle(.white)
            Text("Kjøreturer logges automatisk når du navigerer med bil.")
                .font(.appScaled(size: 11)).foregroundStyle(NavPOIBrand.textSecondary).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 40)
    }

    private func tripRow(_ t: Trip) -> some View {
        let f = DateFormatter(); f.locale = Locale(identifier: "nb_NO"); f.dateFormat = "EEE d. MMM · HH:mm"
        return VStack(alignment: .leading, spacing: 9) {
            HStack {
                Text(f.string(from: t.startDate).capitalized).font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(NavPOIBrand.textSecondary)
                Spacer()
                if t.source == "auto" {
                    Label("Auto", systemImage: "sparkles").font(.appScaled(size: 9, weight: .bold)).foregroundStyle(NavPOIBrand.purpleLight)
                        .padding(.horizontal, 6).padding(.vertical, 2).background(NavPOIBrand.purpleLight.opacity(0.14), in: Capsule())
                }
            }
            HStack(spacing: 8) {
                VStack(spacing: 2) {
                    Image(systemName: "circle.fill").font(.system(size: 7)).foregroundStyle(NavPOIBrand.blue)
                    Rectangle().fill(NavPOIBrand.stroke).frame(width: 1, height: 14)
                    Image(systemName: "mappin.circle.fill").font(.system(size: 10)).foregroundStyle(NavPOIBrand.purpleLight)
                }
                VStack(alignment: .leading, spacing: 6) {
                    Text(t.startPlace).font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                    Text(t.endPlace).font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white).lineLimit(1)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(String(format: "%.1f km", t.distanceKm)).font(.appScaled(size: 13, weight: .bold, design: .rounded)).foregroundStyle(.white).monospacedDigit()
                    Text("\(t.durationMin) min").font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textSecondary)
                }
            }
            if t.vehicleName != nil || t.mileageAmount != nil {
                HStack(spacing: 10) {
                    if let v = t.vehicleName { Label(v, systemImage: "car.fill").font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textSecondary) }
                    if let m = t.mileageAmount { Text("\(Int(m)) kr").font(.appScaled(size: 10, weight: .semibold)).foregroundStyle(NavPOIBrand.green) }
                    if let toll = t.tollAmount, toll > 0 { Text("bom \(Int(toll)) kr").font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.orange) }
                    Spacer()
                }
            }
            // Formål — føreren bekrefter (Skatteetaten-krav).
            HStack(spacing: 6) {
                ForEach([TripPurpose.business, .commute, .privateUse], id: \.self) { p in
                    Button { confirmPurpose(p, for: t) } label: {
                        Label(p.label, systemImage: p.icon)
                            .font(.appScaled(size: 10, weight: .bold))
                            .foregroundStyle(t.purpose == p ? .white : NavPOIBrand.textSecondary)
                            .padding(.horizontal, 9).padding(.vertical, 6)
                            .background(t.purpose == p ? AnyShapeStyle(purposeColor(p)) : AnyShapeStyle(NavPOIBrand.cardHi), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
        }
        .padding(12)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(
            t.purpose == .unconfirmed ? NavPOIBrand.orange.opacity(0.5) : NavPOIBrand.stroke, lineWidth: 1))
    }

    private func purposeColor(_ p: TripPurpose) -> Color {
        switch p {
        case .business:   return NavPOIBrand.purple
        case .commute:    return NavPOIBrand.blue
        case .privateUse: return NavPOIBrand.textSecondary
        case .unconfirmed: return NavPOIBrand.orange
        }
    }

    private var exportBar: some View {
        VStack(spacing: 8) {
            Menu {
                Button { exportPDF() } label: { Label("PDF (brandet kjørebok)", systemImage: "doc.richtext.fill") }
                Button { exportCSV() } label: { Label("CSV (regneark)", systemImage: "tablecells") }
            } label: {
                HStack(spacing: 6) {
                    if exporting { ProgressView().tint(.white) }
                    else { Image(systemName: "square.and.arrow.up").font(.appScaled(size: 13, weight: .bold)) }
                    Text("Eksporter kjørebok").font(.appScaled(size: 13, weight: .bold))
                    Image(systemName: "chevron.down").font(.appScaled(size: 9, weight: .bold))
                }
                .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 13)
                .background(LinearGradient(colors: [NavPOIBrand.purple, NavPOIBrand.purpleLight],
                                           startPoint: .leading, endPoint: .trailing), in: RoundedRectangle(cornerRadius: 12))
            }
            .disabled(exporting || store.trips.isEmpty)

            Button { sendReport() } label: {
                HStack(spacing: 6) {
                    if sendingReport { ProgressView().tint(.white) }
                    else { Image(systemName: "envelope.fill").font(.appScaled(size: 12, weight: .bold)) }
                    Text("Send månedsrapport til e-post").font(.appScaled(size: 12, weight: .bold))
                }
                .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(NavPOIBrand.stroke, lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(sendingReport || store.trips.isEmpty)

            if let m = reportMsg {
                Text(m).font(.appScaled(size: 10, weight: .semibold)).foregroundStyle(NavPOIBrand.green)
            }
            Text("CSV + e-postrapport følger Skatteetatens dokumentasjonskrav (Excel/regnskap/revisjon).")
                .font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textTertiary).multilineTextAlignment(.center)
        }
    }

    private func sendReport() {
        sendingReport = true
        reportMsg = nil
        Task {
            defer { sendingReport = false }
            if let to = await TripService.shared.sendMonthlyReport(using: appState.api) {
                reportMsg = "Rapport sendt til \(to)"
            } else {
                reportMsg = "Kunne ikke sende (e-post ikke satt opp?)"
            }
        }
    }
}

/// UIActivityViewController-wrapper for deling (CSV-eksport).
private struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
