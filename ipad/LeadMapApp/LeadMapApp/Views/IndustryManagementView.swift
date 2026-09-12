// IndustryManagementView.swift
//
// «Mine bransjer» — sales-rep velger hvilke bransjer hen dekker, og på
// hvilket nivå (Generelt/Spesialist/Ekspert). Ett medlem kan markere
// ÉN bransje som primary. Brukes av auto-routing-systemet (mig 329)
// for å foreslå owner på nye leads.
//
// 2 seksjoner:
//   - "Mine spesialiseringer" — eksisterende, med toggle/expertise/primary
//   - "Legg til bransje"      — søkbar liste (gruppert hierarkisk)
//
// Lagre via PUT /api/leadgrid/members/me/industries (replace-all).

import SwiftUI

struct IndustryManagementView: View {
    @Environment(AppState.self) private var appState
    @State private var industries: [Industry] = []
    @State private var myAssignments: [IndustryAssignmentPayload] = []
    @State private var loading = false
    @State private var saving = false
    @State private var error: String?
    @State private var searchQuery = ""
    @State private var showingAddSheet = false

    var body: some View {
        Form {
            if let error {
                Section {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            mySpecializationsSection
            Section {
                Button {
                    showingAddSheet = true
                } label: {
                    Label("Legg til bransje", systemImage: "plus.circle.fill")
                }
            }
        }
        .navigationTitle("Mine bransjer")
        .navigationBarTitleDisplayMode(.large)
        .task { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $showingAddSheet) {
            addBransjeSheet
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    Task { await save() }
                } label: {
                    if saving {
                        ProgressView()
                    } else {
                        Text("Lagre")
                    }
                }
                .disabled(saving)
            }
        }
    }

    // MARK: - Mine spesialiseringer

    @ViewBuilder
    private var mySpecializationsSection: some View {
        Section("Mine spesialiseringer (\(myAssignments.count))") {
            if myAssignments.isEmpty {
                Text("Du har ingen bransjer enda. Trykk «Legg til bransje» nedenfor.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            ForEach(myAssignments.indices, id: \.self) { idx in
                assignmentRow(at: idx)
            }
            .onDelete { offsets in
                myAssignments.remove(atOffsets: offsets)
            }
        }
    }

    @ViewBuilder
    private func assignmentRow(at idx: Int) -> some View {
        let assignment = myAssignments[idx]
        let industry = industries.first(where: { $0.id == assignment.industryId })
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: industry?.sfSymbol ?? "tag.fill")
                    .foregroundStyle(.white)
                    .frame(width: 28, height: 28)
                    .background(industry?.color ?? .purple, in: RoundedRectangle(cornerRadius: 6))
                VStack(alignment: .leading, spacing: 2) {
                    Text(industry?.displayName ?? "Ukjent bransje")
                        .font(.body.weight(.medium))
                    if let code = industry?.code {
                        Text(code).font(.caption2).foregroundStyle(.secondary)
                    }
                }
                Spacer()
                if assignment.isPrimary {
                    Label("Primær", systemImage: "star.fill")
                        .font(.caption2.bold())
                        .foregroundStyle(.yellow)
                }
            }
            Picker("Nivå", selection: Binding(
                get: { myAssignments[idx].expertiseLevel },
                set: { newValue in
                    let old = myAssignments[idx]
                    myAssignments[idx] = IndustryAssignmentPayload(
                        industryId: old.industryId,
                        expertiseLevel: newValue,
                        isPrimary: old.isPrimary,
                        notes: old.notes
                    )
                }
            )) {
                ForEach(ExpertiseLevel.allCases, id: \.self) { lvl in
                    Text(lvl.labelNo).tag(lvl)
                }
            }
            .pickerStyle(.segmented)
            Toggle(isOn: Binding(
                get: { myAssignments[idx].isPrimary },
                set: { newValue in
                    // Maks 1 primary — slå av andre når denne slås på
                    if newValue {
                        for j in myAssignments.indices where j != idx {
                            let other = myAssignments[j]
                            myAssignments[j] = IndustryAssignmentPayload(
                                industryId: other.industryId,
                                expertiseLevel: other.expertiseLevel,
                                isPrimary: false,
                                notes: other.notes
                            )
                        }
                    }
                    let old = myAssignments[idx]
                    myAssignments[idx] = IndustryAssignmentPayload(
                        industryId: old.industryId,
                        expertiseLevel: old.expertiseLevel,
                        isPrimary: newValue,
                        notes: old.notes
                    )
                }
            )) {
                Text("Min primære bransje").font(.callout)
            }
        }
        .padding(.vertical, 6)
    }

    // MARK: - Add-sheet

    @ViewBuilder
    private var addBransjeSheet: some View {
        NavigationStack {
            List {
                let assignedIds = Set(myAssignments.map { $0.industryId })
                let filtered = industries
                    .filter { !assignedIds.contains($0.id) }
                    .filter { ind in
                        searchQuery.isEmpty
                            || ind.nameNo.localizedCaseInsensitiveContains(searchQuery)
                            || ind.code.localizedCaseInsensitiveContains(searchQuery)
                    }
                let customs = filtered.filter { $0.scope == "custom" }
                let globals = filtered.filter { $0.scope == "global" }
                if !customs.isEmpty {
                    Section("Custom (min org)") {
                        ForEach(customs) { ind in pickerRow(ind) }
                    }
                }
                if !globals.isEmpty {
                    Section("Global NACE") {
                        ForEach(globals) { ind in pickerRow(ind) }
                    }
                }
            }
            .navigationTitle("Legg til bransje")
            .searchable(text: $searchQuery, prompt: "Søk bransje eller NACE-kode")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { showingAddSheet = false }
                }
            }
        }
    }

    @ViewBuilder
    private func pickerRow(_ ind: Industry) -> some View {
        Button {
            myAssignments.append(IndustryAssignmentPayload(
                industryId: ind.id,
                expertiseLevel: .general,
                isPrimary: false,
                notes: nil
            ))
            showingAddSheet = false
        } label: {
            HStack(spacing: 10) {
                Image(systemName: ind.sfSymbol)
                    .foregroundStyle(.white)
                    .frame(width: 24, height: 24)
                    .background(ind.color, in: RoundedRectangle(cornerRadius: 5))
                VStack(alignment: .leading, spacing: 2) {
                    Text(ind.nameNo).font(.body)
                    Text(ind.code).font(.caption2).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "plus.circle")
                    .foregroundStyle(.purple)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Data

    private func load() async {
        guard let api = appState.api else { return }
        loading = true
        defer { loading = false }
        do {
            async let i = api.fetchIndustries()
            async let m = api.fetchMyIndustries()
            let (ind, my) = try await (i, m)
            industries = ind
            myAssignments = my.map { assignment in
                IndustryAssignmentPayload(
                    industryId: assignment.industryId,
                    expertiseLevel: ExpertiseLevel(rawValue: assignment.expertiseLevel) ?? .general,
                    isPrimary: assignment.isPrimary,
                    notes: assignment.notes
                )
            }
        } catch {
            self.error = "Kunne ikke laste bransjer: \(error.localizedDescription)"
        }
    }

    private func save() async {
        guard let api = appState.api else { return }
        saving = true
        defer { saving = false }
        do {
            _ = try await api.updateMyIndustries(myAssignments)
            self.error = nil
        } catch {
            self.error = "Kunne ikke lagre: \(error.localizedDescription)"
        }
    }
}
