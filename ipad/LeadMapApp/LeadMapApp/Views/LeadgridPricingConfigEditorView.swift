// LeadgridPricingConfigEditorView.swift
//
// Super-admin-editor for Leadgrid offentlig pris-config (del 3 av 3).
// Redigerer tiers + tilleggsmoduler (Dørsalg/Kvalitet/Go) + bundle og lagrer
// til PUT /api/leadgrid/pricing-config. Endringene slår direkte gjennom på
// leadgrid.no (landing leser samme config) og speiles i web-admin-editoren.
//
// Vises kun via SuperAdminHubView (allerede gated på appState.isSuperAdmin).

import SwiftUI

struct LeadgridPricingConfigEditorView: View {
    let api: APIClient

    @State private var config = LeadgridPricingConfig(
        tiers: [], modules: [],
        bundle: LeadgridPricingBundle(active: false, priceAgency: 0, label: "")
    )
    @State private var loaded = false
    @State private var loading = true
    @State private var saving = false
    @State private var errorText: String?
    @State private var savedNote: String?

    var body: some View {
        Form {
            if loading && !loaded {
                Section {
                    HStack { Spacer(); ProgressView(); Spacer() }
                }
            } else if loaded {
                infoSection
                tiersSection
                modulesSection
                bundleSection
                saveSection
            }

            if let errorText {
                Section {
                    Label(errorText, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("Leadgrid-priser")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }

    // MARK: - Seksjoner

    private var infoSection: some View {
        Section {
            Label(
                "Dette styrer prisene og tilleggsmodulene på leadgrid.no direkte. "
                + "Endringer vises på nettsiden uten ny utrulling (kan ta opptil ~60 sek pga. caching).",
                systemImage: "globe.europe.africa.fill"
            )
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
    }

    private var tiersSection: some View {
        ForEach($config.tiers) { $tier in
            Section("Plan — \(tier.name.isEmpty ? tier.key : tier.name)") {
                TextField("Navn", text: $tier.name)
                numberRow("Pris (kr/mnd)", value: $tier.price)
                TextField("Tagline", text: $tier.tagline, axis: .vertical)
                TextField("Pris-notat", text: $tier.priceNote, axis: .vertical)
                TextField("CTA-knapp", text: $tier.cta)
                Toggle("Mest populær", isOn: $tier.popular)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Punkter (én per linje)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    TextField("Punkter", text: featuresText($tier), axis: .vertical)
                        .lineLimit(3...8)
                }
            }
        }
    }

    private var modulesSection: some View {
        ForEach($config.modules) { $mod in
            Section {
                TextField("Tittel", text: $mod.title)
                TextField("Beskrivelse", text: $mod.desc, axis: .vertical)
                numberRow("Pris Solo Pro (kr/mnd)", value: $mod.priceSoloPro)
                numberRow("Pris Agency (kr/mnd)", value: $mod.priceAgency)
                TextField("Aksentfarge (hex)", text: $mod.accent)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                Toggle("Vis på nettsiden", isOn: $mod.active)
            } header: {
                HStack {
                    Circle()
                        .fill(Color(hex: mod.accent))
                        .frame(width: 10, height: 10)
                    Text("Modul — \(mod.title.isEmpty ? mod.key : mod.title)")
                }
            }
        }
    }

    private var bundleSection: some View {
        Section("Pakke (bundle)") {
            TextField("Tekst", text: $config.bundle.label, axis: .vertical)
            numberRow("Pris Agency (kr/mnd)", value: $config.bundle.priceAgency)
            Toggle("Vis på nettsiden", isOn: $config.bundle.active)
        }
    }

    private var saveSection: some View {
        Section {
            Button {
                Task { await save() }
            } label: {
                HStack {
                    if saving { ProgressView().padding(.trailing, 4) }
                    Text(saving ? "Lagrer …" : "Lagre — går live på leadgrid.no")
                        .fontWeight(.semibold)
                    Spacer()
                    Image(systemName: "square.and.arrow.up.on.square.fill")
                }
            }
            .disabled(saving)

            if let savedNote {
                Label(savedNote, systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                    .font(.footnote)
            }
        }
    }

    // MARK: - Helpers

    private func numberRow(_ title: String, value: Binding<Int>) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField("0", value: value, format: .number)
                .multilineTextAlignment(.trailing)
                .keyboardType(.numberPad)
                .frame(maxWidth: 100)
        }
    }

    /// features[] ↔ tekst med én linje per punkt.
    private func featuresText(_ tier: Binding<LeadgridPricingTier>) -> Binding<String> {
        Binding(
            get: { tier.wrappedValue.features.joined(separator: "\n") },
            set: { tier.wrappedValue.features = $0.components(separatedBy: "\n") }
        )
    }

    // MARK: - Data

    private func load() async {
        loading = true
        errorText = nil
        do {
            let fetched = try await api.fetchLeadgridPricingConfig()
            config = fetched
            loaded = true
        } catch {
            errorText = "Kunne ikke hente pris-config: \(error.localizedDescription)"
        }
        loading = false
    }

    private func save() async {
        saving = true
        errorText = nil
        savedNote = nil
        // Rens: dropp tomme punkt-linjer før lagring.
        var clean = config
        clean.tiers = clean.tiers.map { tier in
            var t = tier
            t.features = t.features.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            return t
        }
        do {
            try await api.saveLeadgridPricingConfig(clean)
            config = clean
            savedNote = "Lagret — endringene er nå live på leadgrid.no."
        } catch {
            errorText = "Lagring feilet: \(error.localizedDescription)"
        }
        saving = false
    }
}

// Lokal hex→Color (samme mønster som øvrige Views; init er private per fil).
private extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var rgb: UInt64 = 0
        Scanner(string: s).scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
