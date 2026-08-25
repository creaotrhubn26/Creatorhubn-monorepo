// LeadgridFollowUpQueueView.swift
//
// Prioritert liste over leads som trenger handling i dag.
//
// Seksjonerer på LeadgridFollowUpBucket (overdue / urgent / today / thisWeek).
// Hvert kort gir hurtigknapper "Gjør nå" / "Avvis" / "Snooze 24t".
//
// Data fra GET /api/leadgrid/intelligence/follow-up-queue. Pull-to-refresh
// + auto-refresh via .task hver gang view appears.

import SwiftUI

struct LeadgridFollowUpQueueView: View {
    let api: APIClient

    @State private var queue: [LeadgridFollowUpItem] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var selectedItem: LeadgridFollowUpItem?
    @State private var toast: String?

    // For å mappe lead-id → tilhørende recommendation (så Avvis kan kalles).
    // Hentes parallelt fra /recommendations slik at vi har id-en når
    // selger trykker Avvis (follow-up-row har kun lead-id, ikke rec-id).
    @State private var recsByLead: [String: LeadgridNBARecommendation] = [:]

    private var grouped: [(bucket: LeadgridFollowUpBucket, items: [LeadgridFollowUpItem])] {
        let dict = Dictionary(grouping: queue, by: { $0.queueBucket })
        return LeadgridFollowUpBucket.allCases
            .compactMap { bucket -> (LeadgridFollowUpBucket, [LeadgridFollowUpItem])? in
                guard let items = dict[bucket], !items.isEmpty else { return nil }
                return (bucket, items)
            }
    }

    var body: some View {
        List {
            if loading && queue.isEmpty {
                HStack { Spacer(); ProgressView(); Spacer() }
                    .listRowBackground(Color.clear)
            } else if queue.isEmpty {
                ContentUnavailableView(
                    "Køen er tom",
                    systemImage: "checkmark.seal.fill",
                    description: Text("Du har ingen leads som trenger handling akkurat nå.")
                )
                .listRowBackground(Color.clear)
            } else {
                ForEach(grouped, id: \.bucket) { group in
                    Section {
                        ForEach(group.items) { item in
                            queueRow(item)
                                .listRowBackground(Color.clear)
                        }
                    } header: {
                        sectionHeader(group.bucket, count: group.items.count)
                    }
                }
            }
            if let errorText {
                Section { Text(errorText).foregroundStyle(.red) }
            }
        }
        .navigationTitle("Følg-opp-kø")
        .marketingDirectorBackdrop(.crmHome)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if let toast {
                    Text(toast)
                        .font(.caption.bold())
                        .foregroundStyle(.purple)
                }
            }
        }
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: $selectedItem) { item in
            // Sheet med intelligence-panel for å bestemme/eksekvere handling.
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(item.name)
                            .font(.title3.bold())
                        if let city = item.city, !city.isEmpty {
                            Label(city, systemImage: "mappin.circle.fill")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        LeadgridIntelligencePanel(leadId: item.leadId, api: api)
                    }
                    .padding()
                }
                .navigationTitle("Handling")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Lukk") { selectedItem = nil }
                    }
                }
            }
        }
    }

    // ── Sub-views ─────────────────────────────────────────────────

    private func sectionHeader(_ bucket: LeadgridFollowUpBucket, count: Int) -> some View {
        HStack(spacing: 6) {
            Label(bucket.title.uppercased(), systemImage: bucket.systemIcon)
                .font(.caption.bold())
                .foregroundStyle(bucket.color)
            Spacer()
            Text("\(count)")
                .font(.caption.bold())
                .padding(.horizontal, 6).padding(.vertical, 2)
                .background(bucket.color.opacity(0.20), in: Capsule())
                .foregroundStyle(bucket.color)
        }
    }

    @ViewBuilder
    private func queueRow(_ item: LeadgridFollowUpItem) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            // Topp: navn + temperature + score
            HStack(spacing: 8) {
                if let temp = item.temperatureEnum {
                    Label(temp.label.uppercased(), systemImage: temp.systemIcon)
                        .font(.caption2.bold())
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(temp.color.opacity(0.20), in: Capsule())
                        .foregroundStyle(temp.color)
                }
                Text(item.name)
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                if let score = item.leadScore {
                    Text("\(score)")
                        .font(.caption.bold())
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color.purple.opacity(0.15), in: Capsule())
                        .foregroundStyle(.purple)
                }
            }

            // Action-type + channel badge
            if let action = item.nextBestAction {
                HStack(spacing: 6) {
                    Image(systemName: LeadgridActionType.icon(for: action))
                        .font(.caption)
                        .foregroundStyle(.purple)
                    Text(LeadgridActionType.label(for: action))
                        .font(.caption.bold())
                        .foregroundStyle(.primary)
                    if let chan = item.nextBestActionChannel,
                       let ch = LeadgridChannel(rawValue: chan) {
                        Text("·").foregroundStyle(.secondary)
                        Label(ch.label, systemImage: ch.systemIcon)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            // Reason
            if let reason = item.nextBestActionReason, !reason.isEmpty {
                Text(reason)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Forfall + sist kontakt
            HStack(spacing: 10) {
                if let due = item.nextFollowUpAt, let d = LeadgridDate.parse(due) {
                    Label(formatRelative(d), systemImage: "calendar.badge.clock")
                        .font(.caption2)
                        .foregroundStyle(d < Date() ? .red : .secondary)
                }
                if let last = item.lastContactedAt, let d = LeadgridDate.parse(last) {
                    Label("Sist: \(formatRelative(d))", systemImage: "clock.fill")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            // Hurtigknapper
            HStack(spacing: 8) {
                Button {
                    selectedItem = item
                } label: {
                    Label("Gjør nå", systemImage: "arrow.right.circle.fill")
                        .font(.caption.bold())
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.purple)
                .controlSize(.small)

                Button {
                    Task { await dismissRec(for: item.leadId) }
                } label: {
                    Label("Avvis", systemImage: "xmark")
                        .font(.caption.bold())
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.secondary)
                .controlSize(.small)

                Button {
                    Task { await snoozeRec(for: item.leadId) }
                } label: {
                    Label("Snooze 24t", systemImage: "moon.zzz")
                        .font(.caption.bold())
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(.orange)
                .controlSize(.small)
            }
        }
        .padding(.vertical, 6)
    }

    // ── Logic ────────────────────────────────────────────────────

    private func load() async {
        loading = true
        do {
            async let queueTask = api.fetchFollowUpQueue()
            async let recsTask = api.fetchNBARecommendations(limit: 200)
            let newQueue = try await queueTask
            let newRecs = (try? await recsTask) ?? []
            await MainActor.run {
                self.queue = newQueue
                // Build lead-id → rec-map for hurtig oppslag i Avvis/Snooze.
                self.recsByLead = Dictionary(
                    newRecs.map { ($0.leadId, $0) },
                    uniquingKeysWith: { first, _ in first }
                )
                self.loading = false
                self.errorText = nil
            }
        } catch {
            await MainActor.run {
                self.errorText = "Kunne ikke laste køen: \(error.localizedDescription)"
                self.loading = false
            }
        }
    }

    private func dismissRec(for leadId: String) async {
        guard let rec = recsByLead[leadId] else {
            await MainActor.run { self.toast = "Ingen rec å avvise" }
            return
        }
        do {
            _ = try await api.dismissRecommendation(rec.id)
            await MainActor.run {
                self.queue.removeAll { $0.leadId == leadId }
                self.recsByLead.removeValue(forKey: leadId)
                self.toast = "Avvist"
            }
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            await MainActor.run { self.toast = nil }
        } catch {
            await MainActor.run { self.toast = "Avvis feilet" }
        }
    }

    private func snoozeRec(for leadId: String) async {
        // Snooze er ikke et backend-endepunkt ennå — vi bruker dismiss +
        // toaster så selger får signal om at det er en plan, ikke en feil.
        guard let rec = recsByLead[leadId] else { return }
        do {
            _ = try await api.dismissRecommendation(rec.id)
            await MainActor.run {
                self.queue.removeAll { $0.leadId == leadId }
                self.recsByLead.removeValue(forKey: leadId)
                self.toast = "Snooze 24t — backend ikke implementert ennå"
            }
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            await MainActor.run { self.toast = nil }
        } catch {
            await MainActor.run { self.toast = "Snooze feilet" }
        }
    }

    private func formatRelative(_ date: Date) -> String {
        let mins = Int(Date().timeIntervalSince(date) / 60)
        let abs = abs(mins)
        if mins < 0 {
            // Future
            if abs < 60 { return "om \(abs)m" }
            if abs < 24 * 60 { return "om \(abs / 60)t" }
            return "om \(abs / 1440)d"
        }
        if abs < 60 { return "\(abs)m siden" }
        if abs < 24 * 60 { return "\(abs / 60)t siden" }
        return "\(abs / 1440)d siden"
    }
}
