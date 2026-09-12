// LeadgridGoFleetSection.swift
//
// Flåteregister — org-EIDE firmabiler registrert sentralt av Go-admin
// (admin/salgssjef), i motsetning til «Min bil» der sjåføren registrerer
// bilen sin selv. Delte biler er bookbare i LeadgridGoBookingView; biler
// kan alternativt tildeles en fast sjåfør fra teamet.
//
// Egen struct (ikke inline i LeadgridGoDashboardView) med vilje: dashboardets
// opake SwiftUI-type skal ikke vokse — jf. KartView-stack-overflow 2026-07-16.

import SwiftUI

struct GoFleetAdminSection: View {
    @Environment(AppState.self) private var appState
    /// Teamet fra /trips/team — brukes til «Tildel sjåfør»-menyen.
    var drivers: [GoDriverSummary]

    @State private var vehicles: [OrgVehicle] = []
    @State private var loading = false
    @State private var showAdd = false
    @State private var errorMsg: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 7) {
                Image(systemName: "car.2.fill").foregroundStyle(NavPOIBrand.purpleLight)
                Text("Flåte").font(.appScaled(size: 16, weight: .bold)).foregroundStyle(.white)
                if !vehicles.isEmpty {
                    Text("\(vehicles.count)").font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(NavPOIBrand.purpleLight)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(NavPOIBrand.purple.opacity(0.2), in: Capsule())
                }
                Spacer()
                Button { showAdd = true } label: {
                    Label("Legg til", systemImage: "plus.circle.fill")
                        .font(.appScaled(size: 11, weight: .bold)).foregroundStyle(NavPOIBrand.purpleLight)
                }
                .buttonStyle(.plain)
            }

            if loading && vehicles.isEmpty {
                ProgressView().tint(.white).frame(maxWidth: .infinity).padding(.vertical, 20)
            } else if vehicles.isEmpty {
                Text("Ingen firmabiler i flåten ennå. Registrer bedriftens biler her — delte biler blir bookbare for hele teamet.")
                    .font(.appScaled(size: 11)).foregroundStyle(NavPOIBrand.textSecondary)
            } else {
                ForEach(vehicles) { vehicleRow($0) }
            }
            if let e = errorMsg {
                Text(e).font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(NavPOIBrand.red)
            }
        }
        .padding(14)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(NavPOIBrand.purple.opacity(0.3), lineWidth: 1))
        .task { await reload() }
        .sheet(isPresented: $showAdd) {
            AddOrgVehicleSheet(drivers: drivers) { await reload() }
        }
    }

    private func reload() async {
        loading = true
        vehicles = await TripService.shared.orgVehicles(using: appState.api)
        loading = false
    }

    private func vehicleRow(_ v: OrgVehicle) -> some View {
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(NavPOIBrand.purple.opacity(0.2))
                Image(systemName: fuelIcon(v.fuel)).foregroundStyle(NavPOIBrand.purpleLight)
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(v.label).font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white).lineLimit(1)
                HStack(spacing: 6) {
                    Text(v.plate).font(.appScaled(size: 10, weight: .semibold, design: .monospaced))
                        .foregroundStyle(NavPOIBrand.textSecondary)
                    if v.isShared {
                        badge("Delt · bookbar", NavPOIBrand.green)
                    } else if let n = v.assignedUserName {
                        badge("Fast: \(n)", NavPOIBrand.purpleLight)
                    }
                    if let eu = v.euControlDue, euSoon(eu) {
                        badge("EU \(euShort(eu))", NavPOIBrand.orange)
                    }
                }
            }
            Spacer()
            Menu {
                if !v.isShared {
                    Button { Task { await patch(v, .init(isShared: true, assignedUserId: "")) } } label: {
                        Label("Gjør delt (bookbar)", systemImage: "person.3.fill")
                    }
                }
                Menu("Tildel fast sjåfør") {
                    ForEach(drivers) { d in
                        Button(d.name) { Task { await patch(v, .init(assignedUserId: d.userId)) } }
                    }
                }
                Divider()
                Button(role: .destructive) { Task { await retire(v) } } label: {
                    Label("Avregistrer", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.appScaled(size: 16)).foregroundStyle(NavPOIBrand.textSecondary)
                    .frame(width: 32, height: 32).contentShape(Rectangle())
            }
        }
        .padding(10)
        .background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
    }

    private func patch(_ v: OrgVehicle, _ p: TripService.OrgVehiclePatch) async {
        errorMsg = nil
        if await TripService.shared.updateOrgVehicle(id: v.id, p, using: appState.api) {
            await reload()
        } else {
            errorMsg = "Kunne ikke oppdatere \(v.label)."
        }
    }

    private func retire(_ v: OrgVehicle) async {
        errorMsg = nil
        if await TripService.shared.retireOrgVehicle(id: v.id, using: appState.api) {
            await reload()
        } else {
            errorMsg = "Kunne ikke avregistrere \(v.label)."
        }
    }

    private func badge(_ text: String, _ tint: Color) -> some View {
        Text(text).font(.appScaled(size: 8, weight: .bold)).foregroundStyle(tint)
            .padding(.horizontal, 5).padding(.vertical, 1)
            .background(tint.opacity(0.15), in: Capsule())
            .lineLimit(1)
    }
}

// MARK: - Legg til firmabil

struct AddOrgVehicleSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    var drivers: [GoDriverSummary]
    var onSaved: () async -> Void

    @State private var plate = ""
    @State private var name = ""
    @State private var fuel = "unknown"
    @State private var kind = "car"
    @State private var euControlDue: String?
    @State private var isShared = true
    @State private var assignedUserId: String?
    @State private var lookingUp = false
    @State private var didLookup = false
    @State private var saving = false
    @State private var errorMsg: String?

    private static let fuels: [(code: String, label: String)] = [
        ("ev", "El-bil"), ("hybrid", "Hybrid"), ("diesel", "Diesel"),
        ("petrol", "Bensin"), ("unknown", "Ukjent"),
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    // Regnr + Vegvesen-oppslag
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Registreringsnummer").font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(NavPOIBrand.textSecondary)
                        HStack(spacing: 8) {
                            TextField("AB 12345", text: $plate)
                                .font(.appScaled(size: 16, weight: .bold, design: .monospaced))
                                .foregroundStyle(.white)
                                .textInputAutocapitalization(.characters)
                                .autocorrectionDisabled()
                                .padding(11)
                                .background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                            Button { Task { await lookup() } } label: {
                                if lookingUp { ProgressView().tint(.white) }
                                else {
                                    Label("Hent", systemImage: "magnifyingglass")
                                        .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                                }
                            }
                            .padding(.horizontal, 14).padding(.vertical, 12)
                            .background(NavPOIBrand.purple, in: RoundedRectangle(cornerRadius: 11))
                            .buttonStyle(.plain)
                            .disabled(plate.trimmingCharacters(in: .whitespaces).count < 4 || lookingUp)
                        }
                        if didLookup && name.isEmpty {
                            Text("Fant ikke bilen — fyll inn manuelt.")
                                .font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.orange)
                        }
                    }

                    // Navn + drivstoff
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Bil").font(.appScaled(size: 11, weight: .bold)).foregroundStyle(NavPOIBrand.textSecondary)
                        TextField("F.eks. Tesla Model Y", text: $name)
                            .font(.appScaled(size: 13)).foregroundStyle(.white).padding(11)
                            .background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                        Picker("Drivstoff", selection: $fuel) {
                            ForEach(Self.fuels, id: \.code) { Text($0.label).tag($0.code) }
                        }
                        .pickerStyle(.segmented)
                        if let eu = euControlDue {
                            Label("EU-kontroll frist \(eu)", systemImage: "checkmark.seal")
                                .font(.appScaled(size: 10, weight: .semibold)).foregroundStyle(NavPOIBrand.green)
                        }
                    }

                    // Delt vs fast sjåfør
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Bruk").font(.appScaled(size: 11, weight: .bold)).foregroundStyle(NavPOIBrand.textSecondary)
                        Toggle(isOn: $isShared) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Delt firmabil").font(.appScaled(size: 13, weight: .semibold)).foregroundStyle(.white)
                                Text("Bookbar for hele teamet").font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textSecondary)
                            }
                        }
                        .tint(NavPOIBrand.green)
                        if !isShared {
                            Menu {
                                ForEach(drivers) { d in
                                    Button(d.name) { assignedUserId = d.userId }
                                }
                            } label: {
                                HStack(spacing: 8) {
                                    Image(systemName: "person.fill").foregroundStyle(NavPOIBrand.purpleLight)
                                    Text(drivers.first(where: { $0.userId == assignedUserId })?.name ?? "Velg fast sjåfør")
                                        .font(.appScaled(size: 13, weight: .semibold)).foregroundStyle(.white)
                                    Spacer()
                                    Image(systemName: "chevron.up.chevron.down")
                                        .font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textSecondary)
                                }
                                .padding(11).background(NavPOIBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                            }
                        }
                    }

                    if let e = errorMsg {
                        Text(e).font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(NavPOIBrand.red)
                    }

                    Button { Task { await save() } } label: {
                        HStack(spacing: 6) {
                            if saving { ProgressView().tint(.white) }
                            else { Image(systemName: "car.badge.gearshape.fill").font(.appScaled(size: 13, weight: .bold)) }
                            Text("Registrer i flåten").font(.appScaled(size: 13, weight: .bold))
                        }
                        .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 13)
                        .background(LinearGradient(colors: [NavPOIBrand.purple, NavPOIBrand.purpleLight],
                                                   startPoint: .leading, endPoint: .trailing),
                                    in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                    .disabled(saving || plate.trimmingCharacters(in: .whitespaces).count < 4)
                }
                .padding(16)
            }
            .background(NavPOIBrand.bg.ignoresSafeArea())
            .navigationTitle("Ny firmabil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.foregroundStyle(NavPOIBrand.purpleLight)
                }
            }
            .toolbarBackground(NavPOIBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .preferredColorScheme(.dark)
    }

    private func lookup() async {
        lookingUp = true
        defer { lookingUp = false; didLookup = true }
        guard let r = await VehicleService.shared.lookup(plate: plate, using: appState.api) else { return }
        if !r.displayName.isEmpty { name = r.displayName }
        fuel = fuelCode(from: r.fuel)
        euControlDue = r.euControlDue
        kind = {
            switch r.kind {
            case .motorcycle: return "motorcycle"
            case .moped:      return "moped"
            default:          return "car"
            }
        }()
    }

    private func save() async {
        saving = true; errorMsg = nil
        defer { saving = false }
        let draft = TripService.OrgVehicleDraft(
            plate: plate.replacingOccurrences(of: " ", with: "").uppercased(),
            displayName: name.trimmingCharacters(in: .whitespaces),
            fuel: fuel, kind: kind, euControlDue: euControlDue,
            isShared: isShared,
            assignedUserId: isShared ? nil : assignedUserId,
        )
        if let err = await TripService.shared.createOrgVehicle(draft, using: appState.api) {
            errorMsg = err == "plate_exists"
                ? "Bilen er allerede registrert i flåten."
                : "Kunne ikke registrere (\(err))."
            return
        }
        await onSaved()
        dismiss()
    }

    private func fuelCode(from f: VehicleFuel) -> String {
        switch f {
        case .ev: return "ev"; case .hybrid: return "hybrid"
        case .diesel: return "diesel"; case .petrol: return "petrol"
        case .unknown: return "unknown"
        }
    }
}

// MARK: - delte små helpers

func fuelIcon(_ code: String?) -> String {
    switch code {
    case "ev": return "bolt.car.fill"
    case "hybrid": return "leaf.fill"
    case "diesel", "petrol": return "fuelpump.fill"
    default: return "car.fill"
    }
}

func euSoon(_ isoDate: String) -> Bool {
    let df = DateFormatter(); df.dateFormat = "yyyy-MM-dd"
    guard let d = df.date(from: isoDate) else { return false }
    return d.timeIntervalSinceNow < 60 * 86_400   // < 60 dager
}

func euShort(_ isoDate: String) -> String {
    let df = DateFormatter(); df.dateFormat = "yyyy-MM-dd"
    guard let d = df.date(from: isoDate) else { return isoDate }
    let out = DateFormatter(); out.dateFormat = "d. MMM"; out.locale = Locale(identifier: "nb_NO")
    return out.string(from: d)
}
