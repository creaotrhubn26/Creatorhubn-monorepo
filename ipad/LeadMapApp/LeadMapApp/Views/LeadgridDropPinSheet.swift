// LeadgridDropPinSheet.swift
//
// Bottom-sheet for å OPPRETTE NY lead fra en koordinat — typisk fra
// long-press på iPad-kartet eller fra "drop pin here at current
// location" på CenterOnMeFAB.
//
// Backend: POST /api/admin-room/lead-map/leads/from-pin
//   → returnerer { ok: true, id: "<uuid>" }
//
// Sheet'en gjør reverse-geocoding for å vise adresse, lar brukeren
// velge bransje + lead-temperatur, og injekterer det nye lead'et i
// AppState.leads ved suksess slik at pin'en dukker opp umiddelbart.
//
// Form-felter (alle valgfrie unntatt navn):
//   • Navn          (autofokus)
//   • Selskap
//   • Telefon
//   • E-post
//   • Bransje       (Picker, hentet via APIClient.fetchIndustries)
//   • Lead-temp     (segmented: hot/warm/lukewarm/cold, default lukewarm)
//
// Vises som .medium/.large detents.

import SwiftUI
import CoreLocation
import MapKit
import UIKit

@MainActor
struct LeadgridDropPinSheet: View {
    let coordinate: CLLocationCoordinate2D
    /// Kalles ved suksess med ID-en på det nye leadet. MapScreen bruker
    /// dette til å auto-zoome kameraet inn på pin'en.
    let onCreated: (String) -> Void

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    // Form-state
    @State private var name: String = ""
    @State private var company: String = ""
    @State private var phone: String = ""
    @State private var email: String = ""
    @State private var industryId: String? = nil
    @State private var temperature: LeadTemperature = .lukewarm

    // Async-state
    @State private var industries: [Industry] = []
    @State private var loadingIndustries = true
    @State private var resolvedAddress: String? = nil
    @State private var geocodeFailed = false
    @State private var creating = false
    @State private var createError: String? = nil
    @State private var showUrlResearch = false

    @FocusState private var nameFocused: Bool

    private static let brandPurple = Color(red: 0.58, green: 0.20, blue: 0.92)

    var body: some View {
        NavigationStack {
            Form {
                headerSection
                contactSection
                classificationSection
                actionSection
            }
            .navigationTitle("Ny lead her")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await createLead() }
                    } label: {
                        if creating {
                            ProgressView().tint(Self.brandPurple)
                        } else {
                            Text("Lag lead").bold()
                        }
                    }
                    .disabled(creating || name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .sheet(isPresented: $showUrlResearch) {
                // Vi gjenbruker URL-research-flyten. statusMessage er en
                // binding-passthrough — vi cacher kun lokalt her.
                StandaloneUrlResearchSheet()
            }
            .task {
                nameFocused = true
                await loadIndustries()
                await reverseGeocode()
            }
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var headerSection: some View {
        Section {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "mappin.circle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(Self.brandPurple)
                VStack(alignment: .leading, spacing: 4) {
                    if let addr = resolvedAddress {
                        Text(addr)
                            .font(.subheadline.bold())
                            .foregroundStyle(.primary)
                    } else if geocodeFailed {
                        Text("Adresse ikke tilgjengelig offline")
                            .font(.subheadline.bold())
                            .foregroundStyle(.secondary)
                    } else {
                        HStack(spacing: 6) {
                            ProgressView().controlSize(.mini)
                            Text("Slår opp adresse …")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Text(coordinatesString)
                        .font(.caption2.monospaced())
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    @ViewBuilder
    private var contactSection: some View {
        Section("Kontakt") {
            TextField("Navn", text: $name)
                .focused($nameFocused)
                .textInputAutocapitalization(.words)
                .submitLabel(.next)
            TextField("Selskap", text: $company)
                .textInputAutocapitalization(.words)
            TextField("Telefon", text: $phone)
                .keyboardType(.phonePad)
            TextField("E-post", text: $email)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        }
    }

    @ViewBuilder
    private var classificationSection: some View {
        Section("Klassifisering") {
            // Bransje-picker
            if loadingIndustries {
                HStack {
                    Text("Bransje")
                    Spacer()
                    ProgressView().controlSize(.mini)
                }
            } else if industries.isEmpty {
                HStack {
                    Text("Bransje")
                    Spacer()
                    Text("Ingen tilgjengelig")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else {
                Picker("Bransje", selection: $industryId) {
                    Text("Ingen").tag(String?.none)
                    ForEach(industries) { ind in
                        HStack {
                            Image(systemName: ind.sfSymbol)
                                .foregroundStyle(ind.color)
                            Text(ind.displayName)
                        }
                        .tag(String?.some(ind.id))
                    }
                }
            }
            // Temperatur-picker (segmented)
            VStack(alignment: .leading, spacing: 8) {
                Text("Lead-temperatur")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Picker("Lead-temperatur", selection: $temperature) {
                    ForEach(LeadTemperature.allCases, id: \.self) { t in
                        Image(systemName: t.icon).tag(t)
                    }
                }
                .pickerStyle(.segmented)
                Text(temperature.label)
                    .font(.caption2)
                    .foregroundStyle(temperature.background)
            }
        }
    }

    @ViewBuilder
    private var actionSection: some View {
        Section {
            Button {
                showUrlResearch = true
            } label: {
                Label("Forsk på denne adressen først", systemImage: "sparkle.magnifyingglass")
                    .foregroundStyle(Self.brandPurple)
            }
            if let err = createError {
                Text(err)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        } footer: {
            Text("Brukerens posisjon er ikke endret. Pin'en lagres med koordinatene du valgte.")
        }
    }

    // MARK: - Computed

    private var coordinatesString: String {
        String(format: "%.6f, %.6f", coordinate.latitude, coordinate.longitude)
    }

    // MARK: - Async

    private func loadIndustries() async {
        loadingIndustries = true
        defer { loadingIndustries = false }
        guard let api = appState.api else { return }
        do {
            let list = try await api.fetchIndustries()
            // Sortér: org-custom først (sannsynligvis mest relevant), så
            // global etter display_order.
            self.industries = list.sorted { lhs, rhs in
                if lhs.isCustom != rhs.isCustom { return lhs.isCustom }
                if lhs.displayOrder != rhs.displayOrder { return lhs.displayOrder < rhs.displayOrder }
                return lhs.nameNo.localizedCaseInsensitiveCompare(rhs.nameNo) == .orderedAscending
            }
        } catch {
            // Stille — picker blir bare tom. Bruker kan lage lead uten bransje.
            print("[DropPin] fetchIndustries failed: \(error)")
            self.industries = []
        }
    }

    private func reverseGeocode() async {
        let geocoder = CLGeocoder()
        let loc = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        do {
            let placemarks = try await geocoder.reverseGeocodeLocation(loc)
            if let p = placemarks.first {
                self.resolvedAddress = formatPlacemark(p)
                self.geocodeFailed = false
            } else {
                self.geocodeFailed = true
            }
        } catch {
            self.geocodeFailed = true
        }
    }

    private func formatPlacemark(_ p: CLPlacemark) -> String {
        var parts: [String] = []
        if let thoroughfare = p.thoroughfare {
            if let subThoroughfare = p.subThoroughfare {
                parts.append("\(thoroughfare) \(subThoroughfare)")
            } else {
                parts.append(thoroughfare)
            }
        }
        if let postal = p.postalCode, let city = p.locality {
            parts.append("\(postal) \(city)")
        } else if let city = p.locality {
            parts.append(city)
        }
        if parts.isEmpty, let country = p.country { parts.append(country) }
        return parts.joined(separator: ", ")
    }

    private func createLead() async {
        guard let api = appState.api else { return }
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { return }
        creating = true
        createError = nil
        defer { creating = false }
        do {
            let newId = try await api.createLeadAtPin(
                name: trimmedName,
                company: company,
                phone: phone,
                email: email,
                industryId: industryId,
                leadTemperature: temperature.rawValue,
                latitude: coordinate.latitude,
                longitude: coordinate.longitude,
                address: resolvedAddress,
                locationConfidence: "exact",
                leadSource: "manual_pin_drop"
            )
            // Success-haptic
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            // Fetch det ferskt opprettede leadet og append til AppState så
            // pin dukker opp umiddelbart uten å vente på neste full refresh.
            do {
                let lead = try await api.fetchLead(id: newId)
                if !appState.leads.contains(where: { $0.id == lead.id }) {
                    appState.leads.append(lead)
                }
            } catch {
                // Pinnen kommer på neste refresh — trigge en i bakgrunnen.
                Task { await appState.refreshAll() }
            }
            onCreated(newId)
            dismiss()
        } catch {
            createError = "Kunne ikke lage lead. Prøv igjen."
            print("[DropPin] createLeadAtPin failed: \(error)")
        }
    }
}

/// Tynt wrapper rundt LeadgridUrlResearchView for stand-alone presentasjon
/// (sheet-i-sheet). LeadgridUrlResearchView krever et `Binding<String?>`-
/// statusMessage som ellers eies av LeadgridImportSheet.
@MainActor
private struct StandaloneUrlResearchSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var statusMessage: String? = nil

    var body: some View {
        NavigationStack {
            LeadgridUrlResearchView(statusMessage: $statusMessage)
                .navigationTitle("URL-research")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Lukk") { dismiss() }
                    }
                }
        }
    }
}
