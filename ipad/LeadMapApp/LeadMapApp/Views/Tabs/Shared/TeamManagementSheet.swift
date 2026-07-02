// TeamManagementSheet.swift
//
// Team-admin (2026-07-02): salgssjef ser liste over alle team, kan
// opprette nytt, redigere navn/farge/emoji/medlemmer, eller slette.
// Bruker delt `AssignableTeamMember`-liste fra parent så vi kan tildele
// selgere/promotører.
//
// 2 nivåer:
//   1. Liste-view: alle team + Ny team-CTA
//   2. Edit-view: redigér ett spesifikt team (åpnes fra liste)
//
// Farge-valg: 8-farger palette-grid + emoji-picker.

import SwiftUI

// MARK: - Brand

private enum TMB {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.10)
    static let textDim = Color.white.opacity(0.55)
    static let textTertiary = Color.white.opacity(0.30)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let red = Color(red: 0.95, green: 0.20, blue: 0.20)
}

// MARK: - Main sheet

struct TeamManagementSheet: View {
    let allMembers: [AssignableTeamMember]
    @State private var store = LeadgridSalesTeamStore.shared
    @State private var editingTeam: LeadgridSalesTeam?
    @State private var confirmDelete: LeadgridSalesTeam?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                TMB.bg.ignoresSafeArea()
                if store.teams.isEmpty {
                    emptyState
                } else {
                    teamList
                }
            }
            .navigationTitle("Administrer team")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 30, height: 30)
                            .background(TMB.cardHi, in: Circle())
                            .overlay(Circle().strokeBorder(TMB.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                ToolbarItem(placement: .principal) {
                    Text("Administrer team")
                        .font(.system(size: 15, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        let new = LeadgridSalesTeam(
                            id: "team-\(UUID().uuidString.prefix(8))",
                            name: "Nytt team",
                            colorHex: TeamColorPalette.all.randomElement()!.hex,
                            leaderId: nil,
                            memberIds: []
                        )
                        editingTeam = new
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "plus")
                                .font(.system(size: 11, weight: .bold))
                            Text("Nytt")
                                .font(.system(size: 12, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(TMB.purple, in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .sheet(item: $editingTeam) { team in
            TeamEditSheet(
                team: team,
                allMembers: allMembers,
                onSave: { updated in
                    store.upsert(updated)
                    editingTeam = nil
                },
                onCancel: {
                    editingTeam = nil
                }
            )
        }
        .alert(
            "Slette \(confirmDelete?.name ?? "team")?",
            isPresented: Binding(
                get: { confirmDelete != nil },
                set: { if !$0 { confirmDelete = nil } }
            )
        ) {
            Button("Avbryt", role: .cancel) { confirmDelete = nil }
            Button("Slett", role: .destructive) {
                if let t = confirmDelete {
                    store.delete(id: t.id)
                }
                confirmDelete = nil
            }
        } message: {
            Text("Medlemmene blir ikke slettet — de blir bare uten team-tilknytning.")
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "person.3.sequence.fill")
                .font(.system(size: 32))
                .foregroundStyle(TMB.textTertiary)
            Text("Ingen team ennå")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
            Text("Trykk «Nytt» øverst for å opprette ditt første team.")
                .font(.caption)
                .foregroundStyle(TMB.textDim)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var teamList: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                ForEach(store.teams) { team in
                    teamRow(team)
                }
            }
            .padding(16)
        }
    }

    private func teamRow(_ team: LeadgridSalesTeam) -> some View {
        HStack(spacing: 12) {
            // Initialer + farge-badge (2 bokstaver fra team-navn)
            ZStack {
                Circle().fill(team.color.opacity(0.25))
                Circle().strokeBorder(team.color, lineWidth: 2)
                Text(team.initials)
                    .font(.system(size: 14, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }
            .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 3) {
                Text(team.name)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text("\(team.memberIds.count) medlem\(team.memberIds.count == 1 ? "" : "mer")")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(TMB.textDim)
                    if team.leaderId != nil {
                        Text("·").foregroundStyle(TMB.textTertiary)
                        Image(systemName: "person.badge.key.fill")
                            .font(.system(size: 8))
                            .foregroundStyle(team.color)
                        Text("Har leder")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(TMB.textDim)
                    }
                }
            }
            Spacer()
            Menu {
                Button {
                    editingTeam = team
                } label: {
                    Label("Rediger", systemImage: "pencil")
                }
                Button(role: .destructive) {
                    confirmDelete = team
                } label: {
                    Label("Slett", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(TMB.textDim)
                    .padding(8)
                    .background(TMB.cardHi, in: Circle())
            }
        }
        .padding(12)
        .background(TMB.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(TMB.stroke, lineWidth: 1))
        .contentShape(RoundedRectangle(cornerRadius: 12))
        .onTapGesture {
            editingTeam = team
        }
    }
}

// MARK: - Edit sheet

struct TeamEditSheet: View {
    @State var team: LeadgridSalesTeam
    let allMembers: [AssignableTeamMember]
    let onSave: (LeadgridSalesTeam) -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationStack {
            ZStack {
                TMB.bg.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 18) {
                        headerPreview
                        nameField
                        colorPalette
                        areaSection
                        membersSection
                        Color.clear.frame(height: 24)
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Rediger team")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        onCancel()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 30, height: 30)
                            .background(TMB.cardHi, in: Circle())
                            .overlay(Circle().strokeBorder(TMB.stroke, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        onSave(team)
                    } label: {
                        Text("Lagre")
                            .font(.system(size: 13, weight: .heavy))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 7)
                            .background(team.color, in: Capsule())
                            .shadow(color: team.color.opacity(0.4), radius: 5, y: 2)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Sections

    private var headerPreview: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle().fill(team.color.opacity(0.25))
                Circle().strokeBorder(team.color, lineWidth: 3)
                Text(team.initials)
                    .font(.system(size: 26, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
            }
            .frame(width: 76, height: 76)
            .shadow(color: team.color.opacity(0.4), radius: 12, y: 4)
            Text(team.name.isEmpty ? "Nytt team" : team.name)
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1)
            Text("\(team.memberIds.count) medlem\(team.memberIds.count == 1 ? "" : "mer")")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(TMB.textDim)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    private var nameField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("NAVN")
                .font(.system(size: 9, weight: .black, design: .rounded))
                .tracking(1.0)
                .foregroundStyle(TMB.textDim)
            TextField("Team-navn", text: $team.name)
                .textFieldStyle(.plain)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .padding(12)
                .background(TMB.card, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TMB.stroke, lineWidth: 1))
        }
    }

    private var areaSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text("ALLOKERT OMRÅDE")
                    .font(.system(size: 9, weight: .black, design: .rounded))
                    .tracking(1.0)
                    .foregroundStyle(TMB.textDim)
                Spacer()
                if team.hasArea {
                    Button {
                        team.areaCenterLat = nil
                        team.areaCenterLng = nil
                        team.areaRadiusKm = nil
                    } label: {
                        Text("Fjern")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(TMB.red)
                    }
                    .buttonStyle(.plain)
                }
            }
            // Radius-slider (kun synlig når area er satt eller kan settes)
            if team.hasArea {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Image(systemName: "circle.dashed")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(team.color)
                        Text("Radius:")
                            .font(.system(size: 11))
                            .foregroundStyle(TMB.textDim)
                        Text(String(format: "%.1f km", team.areaRadiusKm ?? 3.0))
                            .font(.system(size: 12, weight: .heavy, design: .rounded))
                            .foregroundStyle(.white)
                            .monospacedDigit()
                    }
                    Slider(
                        value: Binding(
                            get: { team.areaRadiusKm ?? 3.0 },
                            set: { team.areaRadiusKm = $0 }
                        ),
                        in: 0.5...20,
                        step: 0.5
                    )
                    .tint(team.color)
                }
                .padding(12)
                .background(TMB.card, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).strokeBorder(TMB.stroke, lineWidth: 1))
            } else {
                // «Sett område»-CTA — plasserer default på Oslo sentrum.
                Button {
                    team.areaCenterLat = 59.9139
                    team.areaCenterLng = 10.7522
                    team.areaRadiusKm = 3.0
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 14, weight: .bold))
                        Text("Sett område på kartet")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(team.color)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(team.color.opacity(0.12), in: RoundedRectangle(cornerRadius: 11))
                    .overlay(
                        RoundedRectangle(cornerRadius: 11)
                            .strokeBorder(team.color.opacity(0.4), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var colorPalette: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("FARGE")
                .font(.system(size: 9, weight: .black, design: .rounded))
                .tracking(1.0)
                .foregroundStyle(TMB.textDim)
            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 4),
                spacing: 10
            ) {
                ForEach(TeamColorPalette.all, id: \.hex) { c in
                    let isActive = team.colorHex.lowercased() == c.hex.lowercased()
                    Button {
                        team.colorHex = c.hex
                    } label: {
                        VStack(spacing: 5) {
                            ZStack {
                                Circle().fill(Color(teamHex: c.hex) ?? .purple)
                                if isActive {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 15, weight: .heavy))
                                        .foregroundStyle(.white)
                                }
                            }
                            .frame(width: 38, height: 38)
                            .shadow(color: (Color(teamHex: c.hex) ?? .purple).opacity(0.4), radius: 5, y: 2)
                            Text(c.name)
                                .font(.system(size: 9, weight: .bold, design: .rounded))
                                .foregroundStyle(isActive ? .white : TMB.textDim)
                        }
                        .padding(.vertical, 6)
                        .frame(maxWidth: .infinity)
                        .background(
                            isActive ? TMB.card : Color.clear,
                            in: RoundedRectangle(cornerRadius: 10)
                        )
                        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(
                            isActive ? (Color(teamHex: c.hex) ?? .purple).opacity(0.5) : Color.clear,
                            lineWidth: 1
                        ))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var membersSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text("MEDLEMMER")
                    .font(.system(size: 9, weight: .black, design: .rounded))
                    .tracking(1.0)
                    .foregroundStyle(TMB.textDim)
                Text("\(team.memberIds.count)")
                    .font(.system(size: 9, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6).padding(.vertical, 1)
                    .background(team.color.opacity(0.6), in: Capsule())
            }
            LazyVStack(spacing: 6) {
                ForEach(allMembers) { m in
                    memberRow(m)
                }
            }
        }
    }

    private func memberRow(_ m: AssignableTeamMember) -> some View {
        let isSelected = team.memberIds.contains(m.userId)
        let isLeader = team.leaderId == m.userId
        return HStack(spacing: 10) {
            ZStack {
                Circle().fill(m.role.color.opacity(0.22))
                Circle().strokeBorder(m.role.color.opacity(0.55), lineWidth: 1)
                Text(m.avatarInitials)
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }
            .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 2) {
                Text(m.name)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                HStack(spacing: 5) {
                    Image(systemName: m.role.icon)
                        .font(.system(size: 8))
                    Text(m.role.label)
                        .font(.system(size: 10, weight: .heavy, design: .rounded))
                }
                .foregroundStyle(m.role.color)
            }
            Spacer()
            if isSelected {
                // Leder-toggle
                Button {
                    team.leaderId = isLeader ? nil : m.userId
                } label: {
                    Image(systemName: "person.badge.key.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(isLeader ? team.color : TMB.textTertiary)
                        .padding(6)
                        .background(
                            isLeader ? team.color.opacity(0.2) : Color.clear,
                            in: Circle()
                        )
                        .overlay(Circle().strokeBorder(
                            isLeader ? team.color.opacity(0.55) : TMB.stroke,
                            lineWidth: 1
                        ))
                }
                .buttonStyle(.plain)
                .help(isLeader ? "\(m.name) er teamleder" : "Utnevn til teamleder")
            }
            // Membership-toggle
            Toggle("", isOn: Binding(
                get: { isSelected },
                set: { on in
                    if on {
                        team.memberIds.append(m.userId)
                    } else {
                        team.memberIds.removeAll { $0 == m.userId }
                        if team.leaderId == m.userId {
                            team.leaderId = nil
                        }
                    }
                }
            ))
            .labelsHidden()
            .tint(team.color)
        }
        .padding(10)
        .background(
            isSelected ? team.color.opacity(0.10) : TMB.card,
            in: RoundedRectangle(cornerRadius: 10)
        )
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(
            isSelected ? team.color.opacity(0.4) : TMB.stroke,
            lineWidth: 1
        ))
    }
}
