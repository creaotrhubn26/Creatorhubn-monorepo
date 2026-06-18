// VisitLogModal.swift
//
// Kjernen i feltsalg-bruken: når du står ved en lead, logg besøket
// med GPS-koordinater + samtale-sammendrag + status-bytte i samme flyt.
//
// GPS-auto-fyll skjer ved sheet-åpning. Hvis du er > 50 m unna leaden,
// vises gul advarsel. > 500 m → rød advarsel (men du kan fortsatt
// lagre — for telefonbesøk osv).

import SwiftUI
import CoreLocation

struct VisitLogModal: View {
    let lead: LeadModel
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var draft = VisitDraft()
    @State private var saving = false
    @State private var errorMessage: String?

    // GPS-state
    @State private var currentLocation: CLLocationCoordinate2D?
    @State private var locationLoading = true
    @State private var locationError: String?
    @State private var distanceMeters: Double?

    var body: some View {
        NavigationStack {
            Form {
                gpsSection
                typeSection
                contactSection
                conversationSection
                followUpSection
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle(lead.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await save() }
                    } label: {
                        if saving {
                            ProgressView()
                        } else {
                            Text("Lagre").fontWeight(.bold)
                        }
                    }
                    .disabled(saving)
                }
            }
            .task { await loadGPS() }
        }
        .interactiveDismissDisabled(saving)
    }

    // MARK: - Sections

    private var gpsSection: some View {
        Section {
            if locationLoading {
                HStack(spacing: 10) {
                    ProgressView()
                    Text("Henter posisjon …")
                        .foregroundStyle(.secondary)
                }
            } else if let err = locationError {
                HStack(spacing: 10) {
                    Image(systemName: "location.slash")
                        .foregroundStyle(.orange)
                    Text(err)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else if let dist = distanceMeters {
                let (color, message): (Color, String) = {
                    if dist < 50 { return (.green, "✓ Du står ved leaden (\(Int(dist)) m unna)") }
                    if dist < 500 { return (.yellow, "Du er \(Int(dist)) m unna — verifiser at riktig lead") }
                    return (.red, "Du er \(Int(dist / 1000)) km unna leaden — antar telefonsamtale?")
                }()
                HStack(spacing: 10) {
                    Image(systemName: dist < 50 ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                        .foregroundStyle(color)
                    Text(message)
                        .font(.caption)
                        .foregroundStyle(color)
                }
            } else {
                EmptyView()
            }
        } header: {
            Text("Din posisjon")
        }
    }

    private var typeSection: some View {
        Section {
            Picker("Type", selection: $draft.type) {
                ForEach(VisitType.allCases, id: \.rawValue) { type in
                    Text(type.label).tag(type)
                }
            }
            .pickerStyle(.menu)
        } header: {
            Text("Type besøk")
        }
    }

    private var contactSection: some View {
        Section {
            TextField("Kontaktperson", text: $draft.contactPerson)
                .textContentType(.name)
                .autocorrectionDisabled()
        } header: {
            Text("Hvem snakket du med?")
        }
    }

    private var conversationSection: some View {
        Section {
            VoiceTextField(
                title: "Hva ble sagt? Hva var stemningen?",
                text: $draft.conversationSummary,
                lineLimit: 3...10,
            )
            TextField("Innvending / avslag-grunn (valgfri)", text: $draft.objectionReason, axis: .vertical)
                .lineLimit(1...3)
            VoiceTextField(
                title: "Interne notater",
                text: $draft.notes,
                lineLimit: 1...4,
            )
        } header: {
            HStack {
                Text("Samtale-sammendrag")
                Spacer()
                Image(systemName: "mic.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("Trykk mikrofonen for å diktere")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var followUpSection: some View {
        Section {
            Picker("Status etter besøk", selection: Binding(
                get: { draft.newStatus ?? lead.status },
                set: { draft.newStatus = $0 == lead.status ? nil : $0 }
            )) {
                ForEach([LeadStatus.interested, .meetingBooked, .declined, .return, .notPresent, .won, .lost], id: \.rawValue) { s in
                    Text(s.label).tag(s)
                }
            }
            TextField("Neste handling", text: $draft.nextAction)
            DatePicker(
                "Følg opp",
                selection: Binding(
                    get: { draft.nextFollowUpAt ?? Date().addingTimeInterval(86400 * 3) },
                    set: { draft.nextFollowUpAt = $0 }
                ),
                displayedComponents: [.date, .hourAndMinute]
            )
        } header: {
            Text("Hva blir neste steg?")
        } footer: {
            Text("Status-endring fyrer Google Ads conversion hvis du markerer som vunnet eller booket møte.")
                .font(.caption2)
        }
    }

    // MARK: - Actions

    private func loadGPS() async {
        do {
            let coord = try await LocationService.shared.currentLocation()
            currentLocation = coord
            draft.latitude = coord.latitude
            draft.longitude = coord.longitude
            distanceMeters = LocationService.shared.distanceMeters(
                from: coord,
                to: CLLocationCoordinate2D(latitude: lead.latitude, longitude: lead.longitude)
            )
        } catch {
            locationError = error.localizedDescription
        }
        locationLoading = false
    }

    private func save() async {
        saving = true
        errorMessage = nil
        do {
            try await appState.enqueueOrSendVisit(leadId: lead.id, body: draft.toJSON())
            await appState.refreshAll()
            // Stopp Live Activity hvis aktiv (PR #642 — #184)
            if #available(iOS 16.1, *) {
                await ActiveVisitManager.shared.stop()
            }
            dismiss()
        } catch is OfflineEnqueuedError {
            errorMessage = "✓ Lagret offline. Sendes når dekning er tilbake."
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            if #available(iOS 16.1, *) {
                await ActiveVisitManager.shared.stop()
            }
            dismiss()
        } catch {
            errorMessage = "Klarte ikke lagre: \(error.localizedDescription)"
        }
        saving = false
    }
}
