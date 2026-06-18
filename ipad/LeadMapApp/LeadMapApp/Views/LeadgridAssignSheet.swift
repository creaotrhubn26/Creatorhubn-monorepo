// LeadgridAssignSheet.swift
//
// 2-stegs tildelings-sheet — markedssjef/teamleder velger:
//   1. Teamleder (markedssjef-flow)
//   2. Salgskonsulent/Promotør (teamleder-flow)
//
// Sortert på workload (færrest aktive leads først) m/ online-prikk.

import SwiftUI

enum AssignLevel {
    case teamLeader
    case rep
    case both  // velg begge i sekvens
}

struct LeadgridAssignSheet: View {
    let customerId: String
    let customerName: String
    let level: AssignLevel
    let api: APIClient
    var onAssigned: (() -> Void)?
    @Environment(\.dismiss) private var dismiss

    @State private var step: AssignLevel
    @State private var teamLeaders: [AssignableUser] = []
    @State private var reps: [AssignableUser] = []
    @State private var pickedTeamLeader: AssignableUser?
    @State private var pickedRep: AssignableUser?
    @State private var note = ""
    @State private var sortBy: SortBy = .workload
    @State private var loading = true
    @State private var submitting = false
    @State private var errorText: String?

    init(customerId: String, customerName: String, level: AssignLevel,
         api: APIClient, onAssigned: (() -> Void)? = nil) {
        self.customerId = customerId
        self.customerName = customerName
        self.level = level
        self.api = api
        self.onAssigned = onAssigned
        _step = State(initialValue: level == .rep ? .rep : .teamLeader)
    }

    enum SortBy: String, CaseIterable {
        case workload = "Minst arbeid"
        case online = "Online først"
        case alphabetical = "Alfabetisk"
    }

    var currentUsers: [AssignableUser] {
        let pool = step == .teamLeader ? teamLeaders : reps
        switch sortBy {
        case .workload: return pool.sorted { $0.activeLeads < $1.activeLeads }
        case .online: return pool.sorted { $0.isOnline && !$1.isOnline }
        case .alphabetical: return pool.sorted { $0.fullName < $1.fullName }
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if level == .both {
                    Picker("Steg", selection: $step) {
                        Text("1. Teamleder").tag(AssignLevel.teamLeader)
                        Text("2. Rep (valgfri)").tag(AssignLevel.rep)
                            .disabled(pickedTeamLeader == nil)
                    }
                    .pickerStyle(.segmented)
                    .padding()
                }
                Picker("Sortering", selection: $sortBy) {
                    ForEach(SortBy.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                if loading {
                    Spacer()
                    ProgressView()
                    Spacer()
                } else if currentUsers.isEmpty {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "person.crop.circle.badge.questionmark")
                            .font(.largeTitle).foregroundStyle(.secondary)
                        Text(step == .teamLeader ?
                              "Ingen teamledere i org-en" :
                              "Ingen salgskonsulenter/promotører i org-en")
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                } else {
                    List {
                        ForEach(currentUsers) { user in
                            UserRow(user: user, selected: isPicked(user)) {
                                pick(user)
                            }
                        }
                        Section {
                            TextField("Notat til mottakeren (valgfri)",
                                      text: $note, axis: .vertical)
                                .lineLimit(2...3)
                        }
                    }
                }
            }
            .navigationTitle(customerName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(action: submitTapped) {
                        if submitting { ProgressView() }
                        else { Text(confirmLabel).bold() }
                    }
                    .disabled(submitting || !canSubmit)
                }
            }
            .alert("Feil", isPresented: .constant(errorText != nil)) {
                Button("OK") { errorText = nil }
            } message: {
                Text(errorText ?? "")
            }
            .task { await load() }
        }
    }

    private var confirmLabel: String {
        if level == .both && step == .teamLeader { return "Neste" }
        return step == .teamLeader ? "Tildel teamleder" : "Tildel rep"
    }

    private var canSubmit: Bool {
        step == .teamLeader ? pickedTeamLeader != nil : pickedRep != nil
    }

    private func isPicked(_ user: AssignableUser) -> Bool {
        step == .teamLeader
            ? user.userId == pickedTeamLeader?.userId
            : user.userId == pickedRep?.userId
    }

    private func pick(_ user: AssignableUser) {
        if step == .teamLeader { pickedTeamLeader = user }
        else { pickedRep = user }
    }

    private func submitTapped() {
        if level == .both && step == .teamLeader {
            step = .rep
            return
        }
        Task { await submit() }
    }

    private func load() async {
        do {
            async let tl = api.fetchAssignableUsers(role: "team_leader")
            async let rep = api.fetchAssignableUsers(role: "rep")
            let (tlRes, repRes) = try await (tl, rep)
            await MainActor.run {
                teamLeaders = tlRes.users
                reps = repRes.users
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke hente brukere: \(error.localizedDescription)"
                loading = false
            }
        }
    }

    private func submit() async {
        submitting = true
        defer { submitting = false }
        do {
            if let tl = pickedTeamLeader {
                try await api.assignTeamLeader(
                    customerId: customerId,
                    teamLeaderUserId: tl.userId,
                    note: note.isEmpty ? nil : note,
                )
            }
            if let rep = pickedRep {
                try await api.assignRep(
                    customerId: customerId,
                    repUserId: rep.userId,
                    note: note.isEmpty ? nil : note,
                )
            }
            await MainActor.run {
                onAssigned?()
                dismiss()
            }
        } catch {
            await MainActor.run {
                errorText = "Tildeling feilet: \(error.localizedDescription)"
            }
        }
    }
}

private struct UserRow: View {
    let user: AssignableUser
    let selected: Bool
    let onTap: () -> Void

    var initials: String {
        user.fullName.split(separator: " ").prefix(2)
            .compactMap { $0.first }.map(String.init).joined()
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                ZStack(alignment: .bottomTrailing) {
                    if let url = user.profileImageUrl.flatMap(URL.init) {
                        AsyncImage(url: url) { image in
                            image.resizable()
                        } placeholder: {
                            Circle().fill(Color.purple.opacity(0.20))
                                .overlay(Text(initials).font(.caption.bold())
                                            .foregroundStyle(.purple))
                        }
                        .frame(width: 36, height: 36)
                        .clipShape(Circle())
                    } else {
                        Circle().fill(Color.purple.opacity(0.20))
                            .frame(width: 36, height: 36)
                            .overlay(Text(initials).font(.caption.bold())
                                        .foregroundStyle(.purple))
                    }
                    if user.isOnline {
                        Circle().fill(Color.green)
                            .frame(width: 10, height: 10)
                            .overlay(Circle().strokeBorder(Color(.systemBackground), lineWidth: 2))
                    }
                }
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(user.fullName.isEmpty ? (user.email ?? "—") : user.fullName)
                            .font(.body.bold())
                        Text(roleLabel(user.role))
                            .font(.caption2)
                            .padding(.horizontal, 6).padding(.vertical, 1)
                            .background(Color.secondary.opacity(0.20), in: Capsule())
                    }
                    Text("\(user.activeLeads) aktive lead\(user.activeLeads == 1 ? "" : "s")"
                            + (user.teamLeaderLeads > 0
                              ? " · \(user.teamLeaderLeads) som teamleder" : ""))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if selected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.purple)
                }
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }

    private func roleLabel(_ role: String) -> String {
        switch role {
        case "teamleder": return "Teamleder"
        case "salgskonsulent": return "Konsulent"
        case "promotor": return "Promotør"
        case "markedssjef": return "Markedssjef"
        case "salgssjef": return "Salgssjef"
        default: return role
        }
    }
}
