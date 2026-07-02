// MeasureRouteSheets.swift
//
// Lagre / åpne / dele måle-ruter for det utvidede måle-verktøyet på
// Oversikt-mini-kartet (2026-07-02). To sheets:
//
//   SaveMeasureRouteSheet   — bruker gir ruta et navn før den lagres
//   SavedMeasureRoutesSheet — liste over alle lagrede ruter med
//                             åpne + slett + del

import SwiftUI

// MARK: - Farge-palett (matcher OversiktView)

private enum MRS {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.10)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let red = Color(red: 0.95, green: 0.20, blue: 0.20)
    static let textDim = Color.white.opacity(0.55)
    static let textTertiary = Color.white.opacity(0.30)
}

// MARK: - Save

struct SaveMeasureRouteSheet: View {
    let kind: MeasureKind
    let distanceMeters: Double
    let unit: MeasureUnit
    let onSave: (String) -> Void
    let onCancel: () -> Void

    @State private var name: String = ""

    private var defaultName: String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.timeZone = TimeZone(identifier: "Europe/Oslo") ?? .current
        f.dateFormat = "d. MMM HH:mm"
        return "\(kind.label) \(f.string(from: Date()))"
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                summaryCard
                VStack(alignment: .leading, spacing: 8) {
                    Text("NAVN")
                        .font(.system(size: 9, weight: .black, design: .rounded))
                        .tracking(1.0)
                        .foregroundStyle(MRS.textDim)
                    TextField(defaultName, text: $name)
                        .textFieldStyle(.plain)
                        .foregroundStyle(.white)
                        .padding(12)
                        .background(MRS.card, in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(MRS.stroke, lineWidth: 1))
                }
                Text("Ruter lagres på enheten din (opptil 50 stykker).")
                    .font(.caption)
                    .foregroundStyle(MRS.textDim)
                Spacer()
            }
            .padding(18)
            .background(MRS.bg)
            .navigationTitle("Lagre måling")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        onCancel()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .accessibilityLabel("Avbryt")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Lagre") {
                        let n = name.trimmingCharacters(in: .whitespaces)
                        onSave(n.isEmpty ? defaultName : n)
                    }
                    .fontWeight(.bold)
                    .foregroundStyle(MRS.purpleLight)
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }

    private var summaryCard: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(MRS.green.opacity(0.20))
                Image(systemName: kind.icon)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(MRS.green)
            }
            .frame(width: 42, height: 42)
            .overlay(Circle().strokeBorder(MRS.green.opacity(0.35), lineWidth: 1))
            VStack(alignment: .leading, spacing: 2) {
                Text(kind.label.uppercased())
                    .font(.system(size: 9, weight: .black, design: .rounded))
                    .tracking(0.8)
                    .foregroundStyle(MRS.textDim)
                Text(unit.format(distanceMeters))
                    .font(.system(size: 17, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }
            Spacer()
        }
        .padding(14)
        .background(MRS.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(MRS.stroke, lineWidth: 1))
    }
}

// MARK: - Saved list

struct SavedMeasureRoutesSheet: View {
    @Binding var routes: [SavedMeasureRoute]
    let unit: MeasureUnit
    let onOpen: (SavedMeasureRoute) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if routes.isEmpty {
                    emptyState
                } else {
                    ScrollView {
                        LazyVStack(spacing: 8) {
                            ForEach(routes) { route in
                                row(route)
                            }
                        }
                        .padding(14)
                    }
                }
            }
            .background(MRS.bg)
            .navigationTitle("Lagrede målinger")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .accessibilityLabel("Lukk")
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "bookmark.slash")
                .font(.system(size: 32))
                .foregroundStyle(MRS.textTertiary)
            Text("Ingen lagrede målinger")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
            Text("Trykk «Lagre» i måle-banneret for å lagre dagens rute.")
                .font(.caption)
                .foregroundStyle(MRS.textDim)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func row(_ route: SavedMeasureRoute) -> some View {
        let totalMeters: Double = {
            if route.kind == .radius, let r = route.radiusKm { return r * 1000 }
            return MeasureMath.totalDistanceMeters(route.points)
        }()
        return Button {
            onOpen(route)
        } label: {
            HStack(spacing: 12) {
                ZStack {
                    Circle().fill(MRS.purple.opacity(0.22))
                    Image(systemName: route.kind.icon)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(MRS.purpleLight)
                }
                .frame(width: 36, height: 36)
                .overlay(Circle().strokeBorder(MRS.purple.opacity(0.35), lineWidth: 1))
                VStack(alignment: .leading, spacing: 2) {
                    Text(route.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    HStack(spacing: 6) {
                        Text(route.kind.label)
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundStyle(MRS.textDim)
                        Text("·").foregroundStyle(MRS.textTertiary)
                        Text(unit.format(totalMeters))
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(MRS.textDim)
                        if route.kind == .route {
                            Text("·").foregroundStyle(MRS.textTertiary)
                            Text("\(route.points.count) stopp")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(MRS.textDim)
                        }
                    }
                }
                Spacer()
                Menu {
                    ShareLink(item: shareText(for: route)) {
                        Label("Del", systemImage: "square.and.arrow.up")
                    }
                    Button(role: .destructive) {
                        routes = SavedMeasureRoute.remove(id: route.id)
                    } label: {
                        Label("Slett", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(MRS.textDim)
                        .padding(8)
                }
            }
            .padding(10)
            .background(MRS.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(MRS.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func shareText(for route: SavedMeasureRoute) -> String {
        let totalMeters: Double = {
            if route.kind == .radius, let r = route.radiusKm { return r * 1000 }
            return MeasureMath.totalDistanceMeters(route.points)
        }()
        let names = route.points.map(\.displayName).joined(separator: " → ")
        return "\(route.name)\n\(unit.format(totalMeters))\n\(names)"
    }
}
