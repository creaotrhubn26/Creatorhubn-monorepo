// LeadgridMarketScanFormView.swift
//
// Sheet-presentert form for å starte en ny Market Scan. Inn:
// tittel + bransje + region + målgruppe + mål + auto-opprett-toggle.
// Ut: en LeadgridMarketScan-rad (med scan_id) som caller kan navigere til
// LeadgridMarketScanDetailView for status-poll.
//
// RBAC: backend gater på leadgrid.market_scan.run; UI gir 403-feilmelding
// hvis bruker mangler tilgang.

import SwiftUI

struct LeadgridMarketScanFormView: View {
    let api: APIClient
    /// Aktiv org-id (settes hvis bruker er medlem av en org — auto-skoper
    /// pin-er til org-en så de havner i riktig Lead Map).
    let organizationId: String?
    /// Caller mottar den ny-startede scanen så de kan åpne detail-view.
    let onStarted: (LeadgridMarketScan) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var input: RunLeadgridMarketScanInput

    @State private var isStarting = false
    @State private var error: String?

    init(
        api: APIClient,
        organizationId: String?,
        onStarted: @escaping (LeadgridMarketScan) -> Void,
    ) {
        self.api = api
        self.organizationId = organizationId
        self.onStarted = onStarted
        var initial = RunLeadgridMarketScanInput.empty
        initial.organizationId = organizationId
        _input = State(initialValue: initial)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Label(
                        "Claude søker i markedet, finner bedrifter via "
                            + "BRREG og Google Places, og plotter dem som "
                            + "pins på Kart-fanen.",
                        systemImage: "info.circle",
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                Section("Tittel (valgfritt)") {
                    TextField(
                        "F.eks. \"Tannleger i Bergen Q3\"",
                        text: $input.name,
                    )
                    .textInputAutocapitalization(.sentences)
                }

                Section("Bransje") {
                    TextField(
                        "F.eks. tannlege-klinikk, regnskapsbyrå, treningssenter",
                        text: $input.industry,
                        axis: .vertical,
                    )
                    .lineLimit(1...3)
                    .textInputAutocapitalization(.sentences)
                }

                Section("Region") {
                    TextField(
                        "F.eks. Oslo, Bergen sentrum, Akershus",
                        text: $input.region,
                        axis: .vertical,
                    )
                    .lineLimit(1...3)
                    .textInputAutocapitalization(.sentences)
                }

                Section("Målgruppe (valgfritt)") {
                    TextField(
                        "Hvem retter de seg mot? F.eks. familier, B2B",
                        text: $input.targetAudience,
                        axis: .vertical,
                    )
                    .lineLimit(1...4)
                    .textInputAutocapitalization(.sentences)
                }

                Section("Mål (valgfritt)") {
                    TextField(
                        "Hva er målet med denne scanen?",
                        text: $input.goal,
                        axis: .vertical,
                    )
                    .lineLimit(1...4)
                    .textInputAutocapitalization(.sentences)
                }

                Section {
                    Toggle(isOn: $input.autoCreateLeads) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Auto-opprett leads")
                                .font(.body)
                            Text(
                                "Funne bedrifter plottes som pins på "
                                    + "Kart-fanen. Du kan også gjøre det "
                                    + "manuelt etterpå.",
                            )
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        }
                    }
                    .tint(.purple)
                }

                if let error {
                    Section {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                            .font(.callout)
                    }
                }
            }
            .navigationTitle("Ny Market Scan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await run() }
                    } label: {
                        if isStarting {
                            ProgressView()
                        } else {
                            Text("Kjør scan")
                                .bold()
                        }
                    }
                    .disabled(!input.isValid || isStarting)
                }
            }
            .disabled(isStarting)
        }
    }

    @MainActor
    private func run() async {
        error = nil
        isStarting = true
        defer { isStarting = false }
        do {
            let scan = try await api.runLeadgridMarketScan(input: input)
            onStarted(scan)
            dismiss()
        } catch {
            self.error = "Kunne ikke starte scan: \(error.localizedDescription)"
        }
    }
}
