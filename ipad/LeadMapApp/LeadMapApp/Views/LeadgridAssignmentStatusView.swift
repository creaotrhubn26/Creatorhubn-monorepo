// LeadgridAssignmentStatusView.swift
//
// Viser hvem som er tildelt + sett-status + online-status + sist-online.
// For markedssjefen: "har Anna åpnet leaden enda?"

import SwiftUI

struct LeadgridAssignmentStatusView: View {
    let customerId: String
    let api: APIClient
    var canReassign: Bool = false
    var onReassign: ((AssignLevel) -> Void)?

    @State private var status: AssignmentStatusResponse?
    @State private var loading = true

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if loading {
                ProgressView().scaleEffect(0.8)
            } else if let s = status {
                if s.assignedTeamLeaderId == nil && s.assignedUserId == nil {
                    Button(action: { onReassign?(.teamLeader) }) {
                        Label("Ikke tildelt — tildel nå", systemImage: "person.badge.plus")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .disabled(!canReassign)
                } else {
                    if s.assignedTeamLeaderId != nil {
                        assigneeRow(
                            name: s.teamLeaderName,
                            role: "Teamleder",
                            avatar: s.tlAvatar,
                            isOnline: isOnline(s.tlLastOnline),
                            lastOnlineAt: s.tlLastOnline,
                            firstOpenedAt: s.teamLeaderFirstOpenedAt,
                            lastSeenAt: s.teamLeaderLastSeenAt,
                            assignedAt: s.assignedAt,
                            onTap: canReassign ? { onReassign?(.teamLeader) } : nil,
                        )
                    }
                    if s.assignedUserId != nil {
                        assigneeRow(
                            name: s.repName,
                            role: "Rep",
                            avatar: s.repAvatar,
                            isOnline: isOnline(s.repLastOnline),
                            lastOnlineAt: s.repLastOnline,
                            firstOpenedAt: s.repFirstOpenedAt,
                            lastSeenAt: s.repLastSeenAt,
                            assignedAt: s.assignedAt,
                            onTap: canReassign ? { onReassign?(.rep) } : nil,
                        )
                    }
                }
            }
        }
        .task { await load() }
    }

    @ViewBuilder
    private func assigneeRow(
        name: String, role: String, avatar: String?,
        isOnline: Bool, lastOnlineAt: String?,
        firstOpenedAt: String?, lastSeenAt: String?,
        assignedAt: String?,
        onTap: (() -> Void)?
    ) -> some View {
        let initials = name.split(separator: " ").prefix(2)
            .compactMap { $0.first }.map(String.init).joined()
        let hasSeen = firstOpenedAt != nil
        let minutesSinceAssign = minutes(since: assignedAt)
        HStack(spacing: 8) {
            ZStack(alignment: .bottomTrailing) {
                if let url = avatar.flatMap(URL.init) {
                    AsyncImage(url: url) { image in
                        image.resizable()
                    } placeholder: {
                        Circle().fill(Color.purple.opacity(0.20))
                            .overlay(Text(initials).font(.caption2.bold())
                                        .foregroundStyle(.purple))
                    }
                    .frame(width: 24, height: 24)
                    .clipShape(Circle())
                } else {
                    Circle().fill(Color.purple.opacity(0.20))
                        .frame(width: 24, height: 24)
                        .overlay(Text(initials).font(.caption2.bold())
                                    .foregroundStyle(.purple))
                }
                if isOnline {
                    Circle().fill(Color.green).frame(width: 8, height: 8)
                        .overlay(Circle().strokeBorder(Color(.systemBackground), lineWidth: 1))
                }
            }
            VStack(alignment: .leading, spacing: 1) {
                Text(name.isEmpty ? role : name).font(.caption.bold())
                Text(role).font(.caption2).foregroundStyle(.secondary)
            }
            Spacer(minLength: 4)

            // Online-chip
            if isOnline {
                Label("Online", systemImage: "circle.fill")
                    .labelStyle(.titleOnly)
                    .font(.caption2.bold())
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.green.opacity(0.20), in: Capsule())
                    .foregroundStyle(.green)
            } else if let last = lastOnlineAt {
                Text("Sist online \(timeAgo(last))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            // Sett-chip
            if hasSeen, let opened = firstOpenedAt {
                Label("Sett \(timeAgo(opened))", systemImage: "eye.fill")
                    .font(.caption2.bold())
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.green.opacity(0.20), in: Capsule())
                    .foregroundStyle(.green)
            } else {
                let urgent = (minutesSinceAssign ?? 0) > 240
                Label("Ikke sett", systemImage: "clock")
                    .font(.caption2.bold())
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background((urgent ? Color.red : Color.orange).opacity(0.20), in: Capsule())
                    .foregroundStyle(urgent ? .red : .orange)
            }

            if let onTap {
                Button(action: onTap) {
                    Image(systemName: "pencil.circle")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func isOnline(_ iso: String?) -> Bool { LeadgridDate.isOnline(iso) }

    private func timeAgo(_ iso: String) -> String {
        // Kort-form for chip-bruk
        guard let d = LeadgridDate.parse(iso) else { return iso }
        let mins = Int(Date().timeIntervalSince(d) / 60)
        if mins < 1 { return "nå" }
        if mins < 60 { return "\(mins)m" }
        let hours = mins / 60
        if hours < 24 { return "\(hours)t" }
        return "\(hours / 24)d"
    }

    private func minutes(since iso: String?) -> Int? {
        guard let d = LeadgridDate.parse(iso) else { return nil }
        return Int(Date().timeIntervalSince(d) / 60)
    }

    private func load() async {
        do {
            let res = try await api.fetchAssignmentStatus(customerId: customerId)
            await MainActor.run {
                status = res
                loading = false
            }
        } catch {
            await MainActor.run {
                loading = false
            }
        }
    }
}
