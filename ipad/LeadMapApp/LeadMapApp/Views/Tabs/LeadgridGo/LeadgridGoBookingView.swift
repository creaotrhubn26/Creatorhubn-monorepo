// LeadgridGoBookingView.swift
//
// Leadgrid Go — kjøretøy-booking: reserver en delt firmabil i et tidsrom.
// Ser org-ens firmabiler + kommende reservasjoner, og lager nye (konflikt-sjekk
// på server). Kansellér egne. Del av Fase 2 (vision: «Smidig booking»).

import SwiftUI

struct LeadgridGoBookingView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    @State private var fleet: [GoFleetVehicle] = []
    @State private var bookings: [GoBooking] = []
    @State private var loading = false

    // Ny reservasjon
    @State private var selected: GoFleetVehicle?
    @State private var start = Date()
    @State private var end = Date().addingTimeInterval(3600)
    @State private var purpose = ""
    @State private var submitting = false
    @State private var errorMsg: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    newBookingCard
                    upcomingCard
                    Color.clear.frame(height: 20)
                }
                .padding(16)
            }
            .background(NavPOIBrand.bg.ignoresSafeArea())
            .navigationTitle("Kjøretøy-booking")
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
        .task { await load() }
    }

    private func load() async {
        loading = true
        async let f = TripService.shared.fleet(using: appState.api)
        async let b = TripService.shared.bookings(using: appState.api)
        fleet = await f
        bookings = await b
        if selected == nil { selected = fleet.first }
        loading = false
    }

    private var newBookingCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Reserver bil").font(.appScaled(size: 15, weight: .bold)).foregroundStyle(.white)
            if fleet.isEmpty {
                Text("Ingen firmabiler registrert ennå. Sjåfører markerer bilen som «Firmabil» i Min bil.")
                    .font(.appScaled(size: 11)).foregroundStyle(NavPOIBrand.textSecondary)
            } else {
                // Velg bil
                Menu {
                    ForEach(fleet) { v in
                        Button { selected = v } label: { Text("\(v.label)\(v.driverName.map { " · \($0)" } ?? "")") }
                    }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "car.fill").foregroundStyle(NavPOIBrand.purpleLight)
                        Text(selected?.label ?? "Velg bil").font(.appScaled(size: 13, weight: .semibold)).foregroundStyle(.white)
                        Spacer()
                        Image(systemName: "chevron.up.chevron.down").font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textSecondary)
                    }
                    .padding(11).background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                }
                DatePicker("Fra", selection: $start).datePickerStyle(.compact).tint(NavPOIBrand.purpleLight)
                    .font(.appScaled(size: 12)).foregroundStyle(.white)
                DatePicker("Til", selection: $end).datePickerStyle(.compact).tint(NavPOIBrand.purpleLight)
                    .font(.appScaled(size: 12)).foregroundStyle(.white)
                TextField("Formål (valgfritt)", text: $purpose)
                    .font(.appScaled(size: 12)).foregroundStyle(.white).padding(10)
                    .background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                if let e = errorMsg {
                    Text(e).font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(NavPOIBrand.red)
                }
                Button { Task { await submit() } } label: {
                    HStack(spacing: 6) {
                        if submitting { ProgressView().tint(.white) }
                        else { Image(systemName: "calendar.badge.plus").font(.appScaled(size: 13, weight: .bold)) }
                        Text("Reserver").font(.appScaled(size: 13, weight: .bold))
                    }
                    .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(LinearGradient(colors: [NavPOIBrand.purple, NavPOIBrand.purpleLight], startPoint: .leading, endPoint: .trailing), in: RoundedRectangle(cornerRadius: 11))
                }
                .buttonStyle(.plain).disabled(submitting || selected == nil)
            }
        }
        .padding(14)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(NavPOIBrand.stroke, lineWidth: 1))
    }

    private func submit() async {
        guard let v = selected else { return }
        submitting = true; errorMsg = nil
        defer { submitting = false }
        let err = await TripService.shared.createBooking(
            label: v.label, plate: v.plate, startAt: start, endAt: end,
            purpose: purpose, bookedByName: appState.displayName, using: appState.api)
        if let err {
            errorMsg = err == "time_conflict" ? "Bilen er allerede reservert i dette tidsrommet." : "Kunne ikke reservere."
        } else {
            purpose = ""
            await load()
        }
    }

    private var upcomingCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Kommende reservasjoner").font(.appScaled(size: 15, weight: .bold)).foregroundStyle(.white)
            if bookings.isEmpty {
                Text("Ingen kommende reservasjoner.").font(.appScaled(size: 11)).foregroundStyle(NavPOIBrand.textSecondary)
            } else {
                ForEach(bookings) { bookingRow($0) }
            }
        }
        .padding(14)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(NavPOIBrand.stroke, lineWidth: 1))
    }

    private func bookingRow(_ b: GoBooking) -> some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(NavPOIBrand.purpleLight.opacity(0.2))
                Image(systemName: "car.fill").font(.appScaled(size: 12)).foregroundStyle(NavPOIBrand.purpleLight)
            }
            .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 2) {
                Text(b.vehicleLabel).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                Text("\(timeRange(b.startAt, b.endAt)) · \(b.bookedByName ?? "—")")
                    .font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textSecondary).lineLimit(1)
            }
            Spacer()
            if b.isMine == true {
                Button { Task { await TripService.shared.cancelBooking(id: b.id, using: appState.api); await load() } } label: {
                    Text("Avlys").font(.appScaled(size: 10, weight: .bold)).foregroundStyle(NavPOIBrand.red)
                        .padding(.horizontal, 9).padding(.vertical, 6)
                        .background(NavPOIBrand.red.opacity(0.14), in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(10)
        .background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
    }

    private func timeRange(_ s: String, _ e: String) -> String {
        let iso = ISO8601DateFormatter()
        let df = DateFormatter(); df.locale = Locale(identifier: "nb_NO"); df.dateFormat = "d. MMM HH:mm"
        let df2 = DateFormatter(); df2.locale = Locale(identifier: "nb_NO"); df2.dateFormat = "HH:mm"
        guard let sd = iso.date(from: s), let ed = iso.date(from: e) else { return "" }
        let sameDay = Calendar.current.isDate(sd, inSameDayAs: ed)
        return "\(df.string(from: sd))–\(sameDay ? df2.string(from: ed) : df.string(from: ed))"
    }
}
