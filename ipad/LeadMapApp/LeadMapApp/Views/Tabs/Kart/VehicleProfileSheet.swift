// VehicleProfileSheet.swift
//
// «Min bil»-ark: sett drivstoff + type manuelt (ugated), eller fyll automatisk
// fra Vegvesens kjøretøyregister via regnr-oppslag (VehicleService). Profilen
// skreddersyr POI-default (lade vs bensin), kjøregodtgjørelse-sats og anbefaling.

import SwiftUI

struct VehicleProfileSheet: View {
    @Binding var profile: VehicleProfile
    let api: APIClient?
    @Environment(\.dismiss) private var dismiss

    @State private var plateInput: String = ""
    @State private var looking = false
    @State private var lookupError: String? = nil

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    plateLookupCard
                    fuelPicker
                    kindPicker
                    companyCarToggle
                    effectCard
                    Color.clear.frame(height: 20)
                }
                .padding(20)
            }
            .background(NavPOIBrand.bg.ignoresSafeArea())
            .navigationTitle("Min bil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Ferdig") { dismiss() }.foregroundStyle(NavPOIBrand.purpleLight).fontWeight(.bold)
                }
            }
            .toolbarBackground(NavPOIBrand.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .onAppear { plateInput = profile.plate ?? "" }
    }

    // MARK: regnr-oppslag (Vegvesen)

    private var plateLookupCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass").font(.appScaled(size: 12, weight: .bold)).foregroundStyle(NavPOIBrand.purpleLight)
                Text("Slå opp regnummer").font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                Spacer()
                Text("Vegvesen").font(.appScaled(size: 9, weight: .semibold)).foregroundStyle(NavPOIBrand.textSecondary)
                    .padding(.horizontal, 7).padding(.vertical, 3)
                    .background(NavPOIBrand.cardHi, in: Capsule())
            }
            HStack(spacing: 8) {
                // Norsk skilt-stil: blått felt + hvitt nummer-felt.
                HStack(spacing: 0) {
                    Text("N").font(.appScaled(size: 11, weight: .black)).foregroundStyle(.white)
                        .frame(width: 22).frame(maxHeight: .infinity).background(NavPOIBrand.blue)
                    TextField("EL 12345", text: $plateInput)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .font(.appScaled(size: 16, weight: .black, design: .rounded))
                        .foregroundStyle(.black)
                        .padding(.horizontal, 10).padding(.vertical, 11)
                        .frame(maxWidth: .infinity)
                }
                .background(Color.white, in: RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(.black.opacity(0.25), lineWidth: 1))
                .frame(height: 44)

                Button { Task { await lookup() } } label: {
                    Group {
                        if looking { ProgressView().tint(.white) }
                        else { Text("Søk").font(.appScaled(size: 14, weight: .bold)) }
                    }
                    .foregroundStyle(.white)
                    .frame(width: 66, height: 44)
                    .background(plateValid ? AnyShapeStyle(NavPOIBrand.purple) : AnyShapeStyle(NavPOIBrand.cardHi),
                               in: RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
                .disabled(!plateValid || looking)
            }
            if let err = lookupError {
                Text(err).font(.appScaled(size: 11)).foregroundStyle(NavPOIBrand.red)
            }
            if let name = profile.displayName {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.seal.fill").font(.appScaled(size: 12)).foregroundStyle(NavPOIBrand.green)
                    Text(name).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                    if let p = profile.plate {
                        Text(p).font(.appScaled(size: 10, weight: .semibold, design: .monospaced)).foregroundStyle(NavPOIBrand.textSecondary)
                    }
                }
            }
            Text("Vi henter kun tekniske data (drivstoff, type). Aldri eier-informasjon.")
                .font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textTertiary)
        }
        .padding(14)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(NavPOIBrand.stroke, lineWidth: 1))
    }

    private var plateValid: Bool {
        let t = plateInput.replacingOccurrences(of: " ", with: "")
        return t.count >= 5 && t.count <= 8
    }

    private func lookup() async {
        lookupError = nil
        looking = true
        defer { looking = false }
        let plate = plateInput.replacingOccurrences(of: " ", with: "").uppercased()
        guard let result = await VehicleService.shared.lookup(plate: plate, using: api) else {
            lookupError = "Fant ikke kjøretøyet, eller oppslag er ikke tilgjengelig."
            return
        }
        profile.fuel = result.fuel
        profile.kind = result.kind
        profile.plate = plate
        profile.displayName = result.displayName
    }

    // MARK: manuelle velgere

    private var fuelPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Drivstoff").font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(NavPOIBrand.textSecondary)
            HStack(spacing: 8) {
                ForEach([VehicleFuel.ev, .hybrid, .diesel, .petrol], id: \.self) { f in
                    Button { profile.fuel = f } label: {
                        VStack(spacing: 6) {
                            Image(systemName: f.icon).font(.appScaled(size: 17, weight: .semibold))
                                .foregroundStyle(profile.fuel == f ? .white : NavPOIBrand.purpleLight)
                            Text(f.label).font(.appScaled(size: 10, weight: .bold))
                                .foregroundStyle(profile.fuel == f ? .white : .white.opacity(0.85))
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 11)
                        .background(profile.fuel == f ? AnyShapeStyle(NavPOIBrand.purple) : AnyShapeStyle(NavPOIBrand.card),
                                    in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(profile.fuel == f ? Color.clear : NavPOIBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var kindPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Type").font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(NavPOIBrand.textSecondary)
            HStack(spacing: 8) {
                ForEach(VehicleProfile.Kind.allCases, id: \.self) { k in
                    Button { profile.kind = k } label: {
                        HStack(spacing: 6) {
                            Image(systemName: k.icon).font(.appScaled(size: 13, weight: .semibold))
                            Text(k.rawValue).font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(profile.kind == k ? .white : .white.opacity(0.85))
                        .frame(maxWidth: .infinity).padding(.vertical, 11)
                        .background(profile.kind == k ? AnyShapeStyle(NavPOIBrand.purple) : AnyShapeStyle(NavPOIBrand.card),
                                    in: RoundedRectangle(cornerRadius: 11))
                        .overlay(RoundedRectangle(cornerRadius: 11).stroke(profile.kind == k ? Color.clear : NavPOIBrand.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var companyCarToggle: some View {
        Toggle(isOn: $profile.isCompanyCar) {
            VStack(alignment: .leading, spacing: 1) {
                Text("Firmabil").font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                Text(profile.isCompanyCar ? "Arbeidsgivers bil — kostnad føres på firma" : "Privat bil brukt i jobb")
                    .font(.appScaled(size: 10)).foregroundStyle(NavPOIBrand.textSecondary)
            }
        }
        .tint(NavPOIBrand.green)
        .padding(13)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(NavPOIBrand.stroke, lineWidth: 1))
    }

    // MARK: effekt-forklaring

    private var effectCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("Dette tilpasser vi").font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
            effectRow(icon: profile.fuel.isElectric ? "bolt.fill" : "fuelpump.fill",
                      text: profile.fuel.isElectric ? "Viser ladestasjoner langs ruten" :
                            (profile.fuel.usesFuel ? "Viser bensinstasjoner langs ruten" : "POI skjult til du velger drivstoff"))
            effectRow(icon: "norwegiankronesign.circle.fill",
                      text: "Kjøregodtgjørelse: \(String(format: "%.2f", profile.mileageRate)) kr/km (statens sats)")
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(NavPOIBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(NavPOIBrand.stroke, lineWidth: 1))
    }

    private func effectRow(icon: String, text: String) -> some View {
        HStack(spacing: 9) {
            Image(systemName: icon).font(.appScaled(size: 13, weight: .semibold)).foregroundStyle(NavPOIBrand.purpleLight).frame(width: 20)
            Text(text).font(.appScaled(size: 11)).foregroundStyle(.white.opacity(0.85))
            Spacer()
        }
    }
}
