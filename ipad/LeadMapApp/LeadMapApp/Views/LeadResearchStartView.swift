// LeadResearchStartView.swift
//
// Inngangen til "research → leads"-flyten. Bare salgssjef/teamleder
// (eller eksplisitt overstyrte brukere) får se denne — RBAC sjekkes
// både i MapScreen (CTA-en vises ikke uten lead_research.run) og på
// backend (POST 403'er ellers).
//
// Trinnvis input: industri → region → (valgfri målgruppe + mål).
// "Start research" oppretter market_scan-rad + kicker orkestratoren.
// Brukeren navigerer videre til ResearchProgressView som poller
// fasen til 'done' eller 'failed'.
//
// Lead Map fungerer fullstendig uten denne flyten — den er en
// tilleggsfunksjon, ikke en avhengighet.

import SwiftUI

struct LeadResearchStartView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var industry: String = ""
    @State private var region: String = ""
    @State private var targetAudience: String = ""
    @State private var goal: String = ""

    @State private var isStarting = false
    @State private var error: String?
    @State private var started: LeadResearchStartResponse?

    /// Når research er startet og brukeren har bekreftet — vis progress.
    @State private var progressShown = false

    var body: some View {
        NavigationStack {
            Form {
                // Scroll-shy backdrop via clear-form + background-modifier
                Section {
                    Text("Leadgrid plotter nye pins ut fra hva du selger og hvor du leter. Når du starter går vi gjennom markedet og setter pins du kan trålе.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }

                Section("Bransje") {
                    TextField("F.eks. tannlege-klinikk, regnskapsbyrå, treningssenter",
                              text: $industry, axis: .vertical)
                        .lineLimit(1...3)
                }

                Section("Region") {
                    TextField("F.eks. Oslo, Bergen sentrum, Akershus",
                              text: $region, axis: .vertical)
                        .lineLimit(1...3)
                }

                Section("Målgruppe (valgfritt)") {
                    TextField("Hvem retter de seg mot? F.eks. familier, B2B",
                              text: $targetAudience, axis: .vertical)
                        .lineLimit(1...3)
                }

                Section("Mål (valgfritt)") {
                    TextField("Hva er målet med researchen?",
                              text: $goal, axis: .vertical)
                        .lineLimit(1...4)
                }

                Section {
                    Label(
                        "Gridden fungerer som vanlig uten dette — research er en valgfri pin-fabrikk.",
                        systemImage: "info.circle"
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
            }
            .scrollContentBackground(.hidden)
            .background(
                BrandedHeroBackground(.backdrop4, darkenFrom: 0.55, darkenTo: 0.95)
                    .ignoresSafeArea()
            )
            .navigationTitle("Finn nye leads")
        .salesHierarchyBackdrop(.research)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await start() }
                    } label: {
                        if isStarting {
                            ProgressView()
                        } else {
                            Text("Plott gridden")
                        }
                    }
                    .disabled(!canStart || isStarting)
                }
            }
            .alert("Kunne ikke starte", isPresented: errorBinding) {
                Button("OK") { error = nil }
            } message: { Text(error ?? "") }
            .fullScreenCover(item: $started) { resp in
                LeadResearchProgressView(researchId: resp.researchId, displayName: resp.name)
            }
        }
    }

    private var canStart: Bool {
        industry.trimmingCharacters(in: .whitespaces).count >= 2
            && region.trimmingCharacters(in: .whitespaces).count >= 2
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { error != nil }, set: { if !$0 { error = nil } })
    }

    private func start() async {
        guard let api = appState.api else {
            error = "Mangler API-klient"
            return
        }
        isStarting = true
        defer { isStarting = false }
        do {
            let resp = try await api.startLeadResearch(
                industry: industry.trimmingCharacters(in: .whitespaces),
                region: region.trimmingCharacters(in: .whitespaces),
                targetAudience: targetAudience.trimmingCharacters(in: .whitespaces).isEmpty
                    ? nil : targetAudience.trimmingCharacters(in: .whitespaces),
                goal: goal.trimmingCharacters(in: .whitespaces).isEmpty
                    ? nil : goal.trimmingCharacters(in: .whitespaces),
                organizationId: appState.activeOrganizationId
            )
            // Kicker orkestratoren — fire-and-forget på server-siden
            try? await api.runLeadResearch(researchId: resp.researchId)
            started = resp
        } catch {
            self.error = String(describing: error)
        }
    }
}

extension LeadResearchStartResponse: Identifiable {
    public var id: String { researchId }
}
