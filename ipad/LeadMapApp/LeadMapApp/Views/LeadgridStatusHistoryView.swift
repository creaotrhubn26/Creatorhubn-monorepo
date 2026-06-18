// LeadgridStatusHistoryView.swift
//
// Vertikal timeline med alle status-endringer på en lead.
// Henter fra /api/leadgrid/customers/:id/status-history.

import SwiftUI

struct LeadgridStatusHistoryView: View {
    let customerId: String
    let api: APIClient

    @State private var items: [LeadgridStatusHistoryItem] = []
    @State private var loading = true
    @State private var errorText: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if loading {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .padding()
            } else if items.isEmpty {
                Text("Ingen status-endringer registrert")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 24)
                    .frame(maxWidth: .infinity)
            } else {
                ForEach(Array(items.enumerated()), id: \.element.id) { idx, item in
                    HistoryRow(item: item, isLast: idx == items.count - 1)
                }
            }
            if let errorText {
                Text(errorText).font(.caption).foregroundStyle(.red)
            }
        }
        .task { await load() }
    }

    private func load() async {
        do {
            let resp = try await api.fetchLeadgridStatusHistory(customerId: customerId)
            await MainActor.run {
                items = resp.history
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke hente historikk: \(error.localizedDescription)"
                loading = false
            }
        }
    }
}

private struct HistoryRow: View {
    let item: LeadgridStatusHistoryItem
    let isLast: Bool

    var toStatusColor: Color {
        LeadgridCrmStatus(rawValue: item.toStatus)?.color ?? .gray
    }
    var toStatusLabel: String {
        LeadgridCrmStatus(rawValue: item.toStatus)?.label ?? item.toStatus
    }
    var fromStatusLabel: String? {
        guard let f = item.fromStatus else { return nil }
        return LeadgridCrmStatus(rawValue: f)?.label ?? f
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Tråd + prikk
            VStack(spacing: 0) {
                Circle()
                    .fill(toStatusColor)
                    .frame(width: 12, height: 12)
                    .overlay(Circle().strokeBorder(Color(.systemBackground), lineWidth: 2))
                if !isLast {
                    Rectangle()
                        .fill(Color.secondary.opacity(0.20))
                        .frame(width: 2)
                }
            }
            .frame(width: 24)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    if let from = fromStatusLabel {
                        Text(from)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Image(systemName: "arrow.right").font(.caption2).foregroundStyle(.secondary)
                    }
                    Text(toStatusLabel)
                        .font(.caption.bold())
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(toStatusColor.opacity(0.20), in: Capsule())
                        .foregroundStyle(toStatusColor)
                }
                if let note = item.note, !note.isEmpty {
                    Text("\"\(note)\"")
                        .font(.callout)
                        .italic()
                        .foregroundStyle(.primary)
                }
                if item.toStatus == "won", let amt = item.metadata?.wonAmountOere {
                    HStack(spacing: 4) {
                        Image(systemName: "dollarsign.circle.fill")
                            .foregroundStyle(.green)
                        Text("\(amt / 100) kr")
                            .font(.callout.bold())
                            .foregroundStyle(.green)
                        if let rec = item.metadata?.wonRecurringOere, rec > 0 {
                            Text("+ \(rec / 100) kr/mnd")
                                .font(.caption)
                                .foregroundStyle(.green)
                        }
                    }
                }
                if item.toStatus == "lost", let reason = item.metadata?.lostReason {
                    Text("Årsak: \(LeadgridLostReason(rawValue: reason)?.label ?? reason)")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
                HStack(spacing: 8) {
                    if let avatar = item.profileImageUrl, let url = URL(string: avatar) {
                        AsyncImage(url: url) { image in
                            image.resizable()
                        } placeholder: {
                            Circle().fill(Color.secondary.opacity(0.20))
                        }
                        .frame(width: 16, height: 16)
                        .clipShape(Circle())
                    }
                    Text(item.changedByName.isEmpty ? "Bruker" : item.changedByName)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text("·")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(item.formattedChangedAt)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.bottom, isLast ? 0 : 12)
        }
    }
}
