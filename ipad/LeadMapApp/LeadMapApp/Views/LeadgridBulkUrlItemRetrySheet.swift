// LeadgridBulkUrlItemRetrySheet.swift
//
// Fix 5 (mig 0353) — per-URL retry/skip-sheet.
//
// Brukeren tapper en feilet rad i `LeadgridBulkUrlResearchProgressView`.
// Sheet viser:
//   - Full URL + error-message
//   - retry_count + sist-prøvd-tid
//   - "Prøv på nytt" (rerun via /retry-endpointet)
//   - "Marker som irrelevant" (set status='skipped' via /skip-endpointet)
//
// Etter en handling kalles `onChanged` slik at parent kan re-laste detail.

import SwiftUI

@MainActor
struct LeadgridBulkUrlItemRetrySheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    let batchId: String
    let item: BulkUrlBatchItem
    let onChanged: () -> Void

    @State private var detail: BulkUrlItemDetail?
    @State private var isLoading = false
    @State private var isRetrying = false
    @State private var isSkipping = false
    @State private var statusMessage: String?
    @State private var retryResultStatus: BulkUrlItemStatus?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if isLoading {
                        ProgressView("Henter detaljer …")
                            .frame(maxWidth: .infinity, minHeight: 80)
                    } else {
                        headerCard
                        if let err = displayedErrorMessage {
                            errorCard(err)
                        }
                        if let d = detail {
                            metadataCard(d)
                        }
                        actionButtons
                    }
                    if let msg = statusMessage {
                        Text(msg)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .padding(.top, 8)
                    }
                }
                .padding(16)
            }
            .navigationTitle("URL-detaljer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                }
            }
        }
        .task {
            await loadDetail()
        }
    }

    // MARK: - Cards

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("URL")
                .font(.caption2.bold())
                .foregroundStyle(.secondary)
            Text(item.url)
                .font(.callout.monospaced())
                .textSelection(.enabled)
                .lineLimit(3)
            HStack(spacing: 8) {
                statusBadge
                Text("Indeks #\(item.orderIndex + 1)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    private var statusBadge: some View {
        let status = retryResultStatus ?? detail?.status ?? item.status
        let tint: Color = switch status {
        case .pending, .running: .blue
        case .completed: .green
        case .failed: .red
        case .skipped: .gray
        }
        let label = switch status {
        case .pending: "Venter"
        case .running: "Kjører"
        case .completed: "Ferdig"
        case .failed: "Feilet"
        case .skipped: "Hoppet over"
        }
        return Text(label)
            .font(.caption2.bold())
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .foregroundStyle(tint)
            .background(tint.opacity(0.15), in: Capsule())
    }

    private func errorCard(_ err: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Feilmelding", systemImage: "exclamationmark.triangle.fill")
                .font(.caption.bold())
                .foregroundStyle(.red)
            Text(err)
                .font(.callout.monospaced())
                .textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }

    private func metadataCard(_ d: BulkUrlItemDetail) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            metadataRow(label: "Antall forsøk", value: "\(d.retryCount)")
            if let lastAt = d.lastAttemptedAt {
                metadataRow(label: "Sist prøvd", value: formatRelative(lastAt))
            }
            if let started = d.startedAt {
                metadataRow(label: "Startet", value: formatRelative(started))
            }
            if let finished = d.finishedAt {
                metadataRow(label: "Avsluttet", value: formatRelative(finished))
            }
            if let quality = d.qualityScore {
                metadataRow(label: "Lead-kvalitet", value: "\(quality)/100")
            }
        }
        .padding(14)
        .background(Color(.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    private func metadataRow(label: String, value: String) -> some View {
        HStack {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.caption.monospaced())
        }
    }

    private var actionButtons: some View {
        VStack(spacing: 10) {
            Button {
                Task { await retry() }
            } label: {
                if isRetrying {
                    ProgressView().tint(.white).frame(maxWidth: .infinity, minHeight: 44)
                } else {
                    Label("Prøv på nytt", systemImage: "arrow.clockwise.circle.fill")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.purple)
            .disabled(isRetrying || isSkipping || isCurrentlyRunning)

            Button(role: .destructive) {
                Task { await skip() }
            } label: {
                if isSkipping {
                    ProgressView().frame(maxWidth: .infinity, minHeight: 40)
                } else {
                    Label("Marker som irrelevant", systemImage: "minus.circle")
                        .frame(maxWidth: .infinity, minHeight: 40)
                }
            }
            .buttonStyle(.bordered)
            .disabled(isRetrying || isSkipping || isCurrentlyRunning)
        }
    }

    // MARK: - Computed

    private var displayedErrorMessage: String? {
        return detail?.errorMessage ?? item.errorMessage
    }

    private var isCurrentlyRunning: Bool {
        let status = retryResultStatus ?? detail?.status ?? item.status
        return status == .running
    }

    // MARK: - Actions

    private func loadDetail() async {
        guard let api = appState.api else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let d = try await api.fetchBulkUrlItemDetail(batchId: batchId, itemId: item.id)
            detail = d
        } catch {
            statusMessage = "Kunne ikke hente detalj: \(error.localizedDescription)"
        }
    }

    private func retry() async {
        guard let api = appState.api else { return }
        isRetrying = true
        defer { isRetrying = false }
        statusMessage = nil
        do {
            let r = try await api.retryBulkUrlItem(batchId: batchId, itemId: item.id)
            retryResultStatus = r.status
            if r.ok {
                statusMessage = "Retry vellykket — URL prosessert."
                onChanged()
                // Re-last detalj for å vise oppdatert retry_count
                await loadDetail()
            } else {
                statusMessage = "Retry feilet: \(r.errorMessage ?? "ukjent feil")"
                onChanged()
                await loadDetail()
            }
        } catch {
            statusMessage = "Kunne ikke retry: \(error.localizedDescription)"
        }
    }

    private func skip() async {
        guard let api = appState.api else { return }
        isSkipping = true
        defer { isSkipping = false }
        statusMessage = nil
        do {
            _ = try await api.skipBulkUrlItem(batchId: batchId, itemId: item.id)
            statusMessage = "Markert som irrelevant."
            onChanged()
            dismiss()
        } catch {
            statusMessage = "Kunne ikke markere: \(error.localizedDescription)"
        }
    }

    // MARK: - Formatting

    private func formatRelative(_ isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: isoString)
              ?? ISO8601DateFormatter().date(from: isoString)
        else {
            return isoString
        }
        let rel = RelativeDateTimeFormatter()
        rel.unitsStyle = .abbreviated
        return rel.localizedString(for: date, relativeTo: Date())
    }
}
