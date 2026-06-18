// LeadgridScheduledReportsView.swift
//
// Schedulert PDF-rapport-abonnement på iPad.
// Markedssjef kan opprette / aktivere / sende-nå / slette.

import SwiftUI

struct LeadgridScheduledReportsView: View {
    let api: APIClient

    @State private var items: [ScheduledReport] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var showingBulkConfirm = false
    @State private var snackbarText: String?

    var body: some View {
        List {
            if loading {
                HStack { Spacer(); ProgressView(); Spacer() }
            } else if items.isEmpty {
                Text("Ingen schedulerte rapporter ennå.")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .listRowBackground(Color.clear)
                Button {
                    showingBulkConfirm = true
                } label: {
                    Label("Auto-aktiver per person", systemImage: "person.2.fill")
                }
            } else {
                ForEach(items) { sub in
                    ReportRow(sub: sub,
                              onSendNow: { Task { await sendNow(sub.id) } },
                              onToggle: { Task { await toggle(sub) } },
                              onDelete: { Task { await deleteSub(sub.id) } })
                }
            }
            if let errorText {
                Text(errorText).foregroundStyle(.red).font(.caption)
            }
        }
        .navigationTitle("Schedulerte rapporter")
        .marketingDirectorBackdrop(.reports)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        showingBulkConfirm = true
                    } label: {
                        Label("Auto-aktiver per person", systemImage: "person.2.fill")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .alert("Auto-aktiver?", isPresented: $showingBulkConfirm) {
            Button("Avbryt", role: .cancel) {}
            Button("Opprett") { Task { await bulkAutoCreate() } }
        } message: {
            Text("Vil du opprette ukentlig rapport-abonnement for hver selger + teamleder i org-en?")
        }
        .overlay(alignment: .bottom) {
            if let text = snackbarText {
                Text(text)
                    .padding()
                    .background(Color.black.opacity(0.8), in: Capsule())
                    .foregroundStyle(.white)
                    .padding(.bottom, 20)
                    .transition(.move(edge: .bottom))
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        do {
            let res = try await api.fetchScheduledReports()
            await MainActor.run {
                items = res.items
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste: \(error.localizedDescription)"
                loading = false
            }
        }
    }

    private func sendNow(_ id: String) async {
        do {
            try await api.sendScheduledReportNow(id: id)
            await flash("Rapporten sendes innen 1 time")
        } catch { await flash("Feilet: \(error.localizedDescription)") }
    }

    private func toggle(_ sub: ScheduledReport) async {
        do {
            try await api.updateScheduledReport(id: sub.id,
                                                  payload: ["is_active": !sub.isActive])
            await load()
        } catch { await flash("Feilet: \(error.localizedDescription)") }
    }

    private func deleteSub(_ id: String) async {
        do {
            try await api.deleteScheduledReport(id: id)
            await flash("Slettet")
            await load()
        } catch { await flash("Feilet: \(error.localizedDescription)") }
    }

    private func bulkAutoCreate() async {
        do {
            let res = try await api.autoCreateReportsPerPerson()
            await flash("\(res.created) opprettet, \(res.skipped) fantes fra før")
            await load()
        } catch { await flash("Feilet: \(error.localizedDescription)") }
    }

    private func flash(_ text: String) async {
        await MainActor.run {
            withAnimation { snackbarText = text }
        }
        try? await Task.sleep(nanoseconds: 2_500_000_000)
        await MainActor.run {
            withAnimation { snackbarText = nil }
        }
    }
}

private struct ReportRow: View {
    let sub: ScheduledReport
    let onSendNow: () -> Void
    let onToggle: () -> Void
    let onDelete: () -> Void

    private let days = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Text(sub.name).font(.headline)
                scopeChip
                frequencyChip
                typeChip
                if sub.lastSendStatus == "success" {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                        .font(.caption2)
                } else if sub.lastSendStatus == "failed" {
                    Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.red)
                        .font(.caption2)
                }
            }
            Text(scheduleString).font(.caption).foregroundStyle(.secondary)
            HStack(spacing: 12) {
                Label("\((sub.recipientEmails?.count ?? 0) + (sub.recipientUserIds?.count ?? 0))",
                      systemImage: "envelope.fill")
                    .font(.caption2)
                Text("Neste: \(formatNextSend(sub.nextSendAt))")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
        .opacity(sub.isActive ? 1.0 : 0.5)
        .swipeActions(edge: .trailing) {
            Button(role: .destructive, action: onDelete) {
                Label("Slett", systemImage: "trash")
            }
            Button(action: onToggle) {
                Label(sub.isActive ? "Paus" : "Aktiver",
                       systemImage: sub.isActive ? "pause.fill" : "play.fill")
            }
            .tint(sub.isActive ? .orange : .green)
            Button(action: onSendNow) {
                Label("Send nå", systemImage: "paperplane.fill")
            }
            .tint(.purple)
        }
    }

    private var scopeChip: some View {
        let label: String
        let color: Color
        switch sub.scope ?? "org" {
        case "individual": label = "Personlig"; color = .green
        case "team": label = "Team"; color = .orange
        default: label = "Org"; color = .purple
        }
        return Text(label)
            .font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    private var frequencyChip: some View {
        let label: String
        switch sub.frequency {
        case "weekly": label = "Ukentlig"
        case "monthly": label = "Månedlig"
        default: label = "Daglig"
        }
        return Text(label)
            .font(.caption2)
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(Color.secondary.opacity(0.20), in: Capsule())
    }

    private var typeChip: some View {
        let label: String
        switch sub.reportType {
        case "summary": label = "KPI"
        case "leads_list": label = "CSV"
        default: label = "KPI+CSV"
        }
        return Text(label)
            .font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 1)
            .background(Color.purple.opacity(0.20), in: Capsule())
            .foregroundStyle(.purple)
    }

    private var scheduleString: String {
        let time = sub.timeOfDay
        switch sub.frequency {
        case "weekly":
            if let dow = sub.dayOfWeek, dow >= 0, dow < days.count {
                return "Hver \(days[dow]) kl \(time) · Siste \(sub.periodDays) dager"
            }
            return "Ukentlig \(time)"
        case "monthly":
            if let dom = sub.dayOfMonth {
                return "Den \(dom). i mnd. kl \(time) · Siste \(sub.periodDays) dager"
            }
            return "Månedlig"
        default:
            return "Daglig kl \(time) · Siste \(sub.periodDays) dager"
        }
    }

    private func formatNextSend(_ iso: String) -> String {
        guard let d = LeadgridDate.parse(iso) else { return iso }
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "EEE d. MMM HH:mm"
        return f.string(from: d)
    }
}
