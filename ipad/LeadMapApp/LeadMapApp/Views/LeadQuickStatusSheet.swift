// LeadQuickStatusSheet.swift
//
// Bottom-sheet med 5 STORE status-knapper. Vises i stedet for den fulle
// LeadDetailSheet når brukeren tap-per en pin på kartet — feltsalg
// trenger raskt å oppdatere status, ikke vade gjennom enrichment +
// strategi + pitch-deck.
//
// "Detaljer"-knapp åpner den fulle LeadDetailSheet for dyp-dykk.
//
// Bruker eksisterende endpoint: PATCH
// /api/admin-room/lead-map/leads/:id/status

import SwiftUI

struct LeadQuickStatusSheet: View {
    let lead: LeadModel
    var onOpenFullDetail: () -> Void
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var updating = false
    @State private var lastStatus: LeadStatus?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            header
            quickActions
            statusButtons
            // "Detaljer"-shortcut nederst åpner den fulle LeadDetailSheet
            // når brukeren faktisk trenger det (research/strategi/pitch).
            Button {
                onOpenFullDetail()
            } label: {
                HStack {
                    Image(systemName: "info.circle")
                    Text("Detaljer + research")
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption2)
                }
                .padding(12)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
        }
        .padding()
        .background(Color(.systemBackground).ignoresSafeArea())
    }

    // MARK: - Header

    @ViewBuilder
    private var header: some View {
        HStack(alignment: .top, spacing: 12) {
            logoOrInitials
            VStack(alignment: .leading, spacing: 3) {
                Text(lead.name).font(.headline)
                if let addr = addressLine {
                    Text(addr).font(.caption).foregroundStyle(.secondary).lineLimit(2)
                }
                HStack(spacing: 6) {
                    statusChip
                    if let score = lead.leadScore ?? lead.aiOpportunityScore {
                        Label("Score \(score)", systemImage: "sparkles")
                            .font(.caption2.bold())
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Color.purple.opacity(0.15), in: Capsule())
                            .foregroundStyle(.purple)
                    }
                    if let t = lead.leadTemperature?.lowercased(), t == "hot" || t == "ready" {
                        Label("Hot", systemImage: "flame.fill")
                            .font(.caption2.bold())
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Color.orange.opacity(0.15), in: Capsule())
                            .foregroundStyle(.orange)
                    }
                }
            }
            Spacer(minLength: 0)
            Button { dismiss() } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private var logoOrInitials: some View {
        Group {
            if let urlStr = lead.logoUrl, let url = URL(string: urlStr) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFit()
                    default:
                        Text(lead.name.prefix(2).uppercased())
                            .font(.caption.bold())
                    }
                }
                .frame(width: 48, height: 48)
                .background(.white)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                Text(lead.name.prefix(2).uppercased())
                    .font(.caption.bold())
                    .frame(width: 48, height: 48)
                    .background(Color.purple.opacity(0.2), in: RoundedRectangle(cornerRadius: 8))
                    .foregroundStyle(.purple)
            }
        }
    }

    private var statusChip: some View {
        Text(lead.status.label)
            .font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(statusColor.opacity(0.18), in: Capsule())
            .foregroundStyle(statusColor)
    }

    private var statusColor: Color {
        switch lead.status {
        case .won, .interested: return Color(red: 0.20, green: 0.85, blue: 0.60)
        case .meetingBooked, .proposalSent: return Color(red: 0.66, green: 0.32, blue: 0.99)
        case .declined, .lost: return Color(red: 0.97, green: 0.44, blue: 0.44)
        case .return: return Color(red: 0.98, green: 0.75, blue: 0.14)
        case .notPresent: return Color(red: 0.55, green: 0.60, blue: 0.68)
        default: return Color(red: 0.376, green: 0.647, blue: 0.980)
        }
    }

    private var addressLine: String? {
        let parts = [lead.address, lead.postalCode, lead.city].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " ")
    }

    // MARK: - Quick actions (ring/maps/web)

    @ViewBuilder
    private var quickActions: some View {
        HStack(spacing: 8) {
            if let phone = lead.phone, !phone.isEmpty,
               let url = URL(string: "tel:\(phone.replacingOccurrences(of: " ", with: ""))") {
                quickActionLink(label: "Ring", icon: "phone.fill", tint: .green, url: url)
            }
            quickActionLink(
                label: "Naviger",
                icon: "location.fill",
                tint: Color(red: 0.66, green: 0.32, blue: 0.99),
                url: URL(string: "https://maps.apple.com/?daddr=\(lead.latitude),\(lead.longitude)&dirflg=d")!
            )
            if let email = lead.email, !email.isEmpty,
               let url = URL(string: "mailto:\(email)") {
                quickActionLink(label: "E-post", icon: "envelope.fill", tint: .blue, url: url)
            }
            if let site = lead.websiteUrl, !site.isEmpty,
               let url = URL(string: site) {
                quickActionLink(label: "Nettside", icon: "safari", tint: .gray, url: url)
            }
        }
    }

    private func quickActionLink(label: String, icon: String, tint: Color, url: URL) -> some View {
        Link(destination: url) {
            VStack(spacing: 4) {
                Image(systemName: icon).font(.subheadline)
                Text(label).font(.caption2)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(tint.opacity(0.15), in: RoundedRectangle(cornerRadius: 8))
            .foregroundStyle(tint)
        }
    }

    // MARK: - Status-knapper (5 store)

    @ViewBuilder
    private var statusButtons: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("OPPDATER STATUS")
                .font(.caption2.bold())
                .foregroundStyle(.secondary)
            let cols = [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())]
            LazyVGrid(columns: cols, spacing: 8) {
                statusBigButton(.interested, label: "Interessert", icon: "heart.fill",
                                tint: Color(red: 0.20, green: 0.85, blue: 0.60))
                statusBigButton(.notPresent, label: "Ikke til stede", icon: "minus.circle",
                                tint: Color(red: 0.55, green: 0.60, blue: 0.68))
                statusBigButton(.return, label: "Kom tilbake", icon: "arrow.clockwise",
                                tint: Color(red: 0.98, green: 0.75, blue: 0.14))
                statusBigButton(.declined, label: "Avslått", icon: "xmark",
                                tint: Color(red: 0.97, green: 0.44, blue: 0.44))
                statusBigButton(.meetingBooked, label: "Book møte", icon: "calendar",
                                tint: Color(red: 0.66, green: 0.32, blue: 0.99))
                statusBigButton(.won, label: "Vunnet", icon: "star.fill",
                                tint: Color(red: 0.99, green: 0.78, blue: 0.20))
            }
            if let lastStatus, !updating {
                Text("Oppdatert til \(lastStatus.label)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .transition(.opacity)
            }
        }
    }

    @ViewBuilder
    private func statusBigButton(
        _ status: LeadStatus,
        label: String,
        icon: String,
        tint: Color
    ) -> some View {
        Button {
            Task { await update(to: status) }
        } label: {
            VStack(spacing: 4) {
                Image(systemName: icon).font(.title3)
                Text(label).font(.caption2.bold())
            }
            .frame(maxWidth: .infinity, minHeight: 64)
            .background(tint.opacity(status == lead.status ? 0.30 : 0.15),
                        in: RoundedRectangle(cornerRadius: 10))
            .foregroundStyle(tint)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(tint.opacity(status == lead.status ? 0.6 : 0), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(updating || status == lead.status)
    }

    // MARK: - Update

    @MainActor
    private func update(to newStatus: LeadStatus) async {
        guard let api = appState.api else { return }
        updating = true
        defer { updating = false }
        do {
            try await api.updateStatus(leadId: lead.id, status: newStatus.rawValue)
            withAnimation { lastStatus = newStatus }
            await appState.refreshAll()
            // Lukker sheet automatisk etter en kort fade så feltsalg
            // ser bekreftelsen, men kommer raskt tilbake til kartet.
            try? await Task.sleep(nanoseconds: 600_000_000)
            dismiss()
        } catch {
            print("[QuickStatus] update failed: \(error)")
        }
    }
}
