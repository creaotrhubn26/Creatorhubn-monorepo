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
    @State private var creationId = UUID()
    @State private var duplicateCandidates: [LeadDuplicateCandidate] = []
    @State private var pendingDuplicateDraft: LeadDraft?

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
        .alert(
            "Mulig duplikat",
            isPresented: Binding(
                get: { pendingDuplicateDraft != nil },
                set: { if !$0 { pendingDuplicateDraft = nil } }
            )
        ) {
            Button("Avbryt", role: .cancel) {
                pendingDuplicateDraft = nil
            }
            Button("Opprett likevel", role: .destructive) {
                guard var draft = pendingDuplicateDraft else { return }
                draft.allowDuplicate = true
                pendingDuplicateDraft = nil
                Task { await createLead(draft) }
            }
        } message: {
            Text(duplicateMessage)
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var headerSection: some View {
        Section {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "mappin.circle.fill")
                    .font(.appScaled(size: 32))
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

    private var duplicateMessage: String {
        let names = duplicateCandidates.prefix(3).map(\.name).joined(separator: ", ")
        return names.isEmpty
            ? "En mulig duplikat finnes allerede i organisasjonen."
            : "Fant mulig eksisterende lead: \(names). Opprett bare hvis dette faktisk er en ny lead."
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
        // Kartverkets offisielle punktsøk i Norge (via KartverketService),
        // Apple CLGeocoder-fallback utenfor/ved bom — samme kilde som
        // MePin-HUD-en så pin og lead får identisk adresse.
        if let hit = await KartverketService.shared.reverseGeocode(
            lat: coordinate.latitude,
            lon: coordinate.longitude,
            using: appState.api
        ) {
            self.resolvedAddress = hit.formatted
            self.geocodeFailed = false
        } else {
            self.geocodeFailed = true
        }
    }

    private func createLead(_ suppliedDraft: LeadDraft? = nil) async {
        guard let api = appState.api else { return }
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        guard !trimmedName.isEmpty else { return }
        guard let organizationId = appState.activeOrganizationId else {
            createError = "Velg en organisasjon før du oppretter lead."
            return
        }
        creating = true
        createError = nil
        defer { creating = false }

        let classification: LeadDraftClassification
        switch temperature {
        case .hot:
            classification = .init(
                temperature: "hot", pipelineStage: "qualified", leadStatus: "interested"
            )
        case .warm, .lukewarm:
            classification = .init(
                temperature: "warm", pipelineStage: "first_contact", leadStatus: "visited"
            )
        case .cold:
            classification = .init(
                temperature: "cold", pipelineStage: "new", leadStatus: "unvisited"
            )
        }
        let selectedIndustry = industries.first(where: { $0.id == industryId })
        let draft = suppliedDraft ?? LeadDraft(
            creationId: creationId,
            organizationId: organizationId,
            name: trimmedName,
            company: LeadDraft.optionalText(company),
            organizationNumber: nil,
            websiteUrl: nil,
            contactName: nil,
            contactRole: nil,
            email: LeadDraft.optionalText(email),
            phone: LeadDraft.optionalText(phone),
            address: resolvedAddress,
            postalCode: nil,
            city: nil,
            country: "NO",
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            googlePlaceId: nil,
            industryId: industryId,
            industry: selectedIndustry?.displayName,
            employeeCountEstimate: nil,
            annualRevenueNokEstimate: nil,
            estimatedValue: nil,
            notes: nil,
            leadTemperature: classification.temperature,
            pipelineStage: classification.pipelineStage,
            leadStatus: classification.leadStatus,
            nextFollowUpAt: nil,
            nextAction: nil,
            locationConfidence: "exact",
            leadSource: "manual_pin_drop",
            projectId: appState.activeProjectId,
            rawText: nil,
            allowDuplicate: false
        )

        let result = await OfflineResilientActions.createLead(api: api, draft: draft)
        switch result {
        case .sent(let response):
            // Success-haptic
            UINotificationFeedbackGenerator().notificationOccurred(.success)
            do {
                let lead = try await api.fetchLead(id: response.id)
                if !appState.leads.contains(where: { $0.id == lead.id }) {
                    appState.leads.append(lead)
                }
            } catch {
                Task { await appState.refreshAll() }
            }
            onCreated(response.id)
            dismiss()
        case .queued:
            createError = "Leaden er lagret offline og sendes automatisk når nettet er tilbake."
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            dismiss()
        case .duplicate(let candidates):
            duplicateCandidates = candidates
            pendingDuplicateDraft = draft
        case .rejected(let message):
            createError = message
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
