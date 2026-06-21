// MyDayView.swift
//
// "Min dag" — salgskonsulentens daglige arbeidsliste. Speilet fra
// web LeadMapMyDayPanel (PR #616+#617).

import SwiftUI
import MapKit

struct MyDayView: View {
    @Environment(AppState.self) private var state
    @State private var isRefreshing = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    quotaCard
                    summaryCards
                    leadsList
                }
                .padding(.horizontal)
                .padding(.top, 12)
                .padding(.bottom, 32)
            }
            .background(
                BrandedHeroBackground(.backdrop1, darkenFrom: 0.45, darkenTo: 0.95)
                    .ignoresSafeArea()
            )
            .scrollContentBackground(.hidden)
            .navigationTitle("Min dag")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    OrgPickerToolbarMenu()
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await refresh() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .accessibilityLabel("Oppdater")
                }
            }
            .refreshable { await refresh() }
            .task { await refresh() }
        }
    }

    // MARK: - Kvote-kort

    @ViewBuilder
    private var quotaCard: some View {
        if let quota = state.quota, quota.hasTarget {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    Image(systemName: "trophy.fill")
                        .font(.title2)
                        .foregroundStyle(Color(hex: "f97316"))
                    VStack(alignment: .leading) {
                        Text("Kvote \(quota.yearMonth)")
                            .font(.headline)
                        Text("\(formatNok(quota.achievedNok)) av \(formatNok(quota.targetNok))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing) {
                        Text("Projeksjon")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(formatNok(quota.projectedNok))
                            .font(.headline)
                            .foregroundStyle(quota.isOnTrack ? Color(hex: "34d399") : Color(hex: "fbbf24"))
                    }
                }
                ProgressView(value: min(1.0, (quota.progressPct ?? 0) / 100))
                    .tint((quota.progressPct ?? 0) >= 100 ? Color(hex: "34d399") : Color(hex: "c084fc"))
                HStack(spacing: 24) {
                    statCol("Vunnet", "\(quota.wonCount)")
                    statCol("Møter mnd", "\(quota.meetingsBooked)")
                    if quota.commissionEarnedNok > 0 {
                        statCol("Provisjon", formatNok(quota.commissionEarnedNok), tint: Color(hex: "34d399"))
                    }
                }
            }
            .padding()
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private func statCol(_ label: String, _ value: String, tint: Color? = nil) -> some View {
        VStack(alignment: .leading) {
            Text(label).font(.caption2).foregroundStyle(.secondary)
            Text(value).font(.title3).bold().foregroundStyle(tint ?? .primary)
        }
    }

    // MARK: - Sammendrag-kort

    private var summaryCards: some View {
        let overdue = state.workloadLeads.filter(\.isOverdue).count
        let topClaude = state.workloadLeads.filter {
            ($0.claudeRecommendationRank ?? 9999) <= 5
        }.count
        let near = state.workloadLeads.filter {
            ($0.distanceKm ?? 100) < 5
        }.count
        return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            summaryTile("trending.up", color: "c084fc", label: "Mine leads", value: "\(state.workloadLeads.count)")
            summaryTile("calendar.badge.exclamationmark", color: "f87171", label: "Forfalt", value: "\(overdue)")
            summaryTile("sparkles", color: "fbbf24", label: "Topp Claude", value: "\(topClaude)")
            summaryTile("location.fill", color: "34d399", label: "Innen 5 km", value: "\(near)")
        }
    }

    private func summaryTile(_ icon: String, color: String, label: String, value: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon).foregroundStyle(Color(hex: color))
            VStack(alignment: .leading) {
                Text(label).font(.caption2).foregroundStyle(.secondary)
                Text(value).font(.title3).bold()
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Lead-liste

    private var leadsList: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Lead-prioritet")
                .font(.headline)
                .padding(.top, 4)
            if state.workloadLeads.isEmpty && !isRefreshing {
                emptyState
            }
            ForEach(state.workloadLeads) { lead in
                WorkloadLeadRow(lead: lead)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "tray").font(.largeTitle).foregroundStyle(.secondary)
            Text("Ingen tildelte leads")
                .font(.headline)
            Text("Salgssjefen kan auto-tildele leads, eller du kan be om noen.")
                .font(.caption)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
    }

    @MainActor
    private func refresh() async {
        isRefreshing = true
        defer { isRefreshing = false }
        await state.refreshWorkload()
    }
}

// MARK: - Lead-rad

private struct WorkloadLeadRow: View {
    let lead: WorkloadLead

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                AsyncImage(url: lead.logoUrl.flatMap(URL.init)) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFit()
                    default:
                        Image(systemName: "globe").foregroundStyle(.secondary)
                    }
                }
                .frame(width: 44, height: 44)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 6))

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(lead.name).font(.headline)
                        statusChip
                        if let rank = lead.claudeRecommendationRank, rank <= 5 {
                            rankChip(rank)
                        }
                        if lead.isOverdue {
                            overdueChip
                        }
                    }
                    if let cat = lead.leadCategory {
                        Text(cat).font(.caption2).foregroundStyle(.secondary)
                    }
                    if let addr = lead.address {
                        Text("\(addr)\(lead.city.map { ", \($0)" } ?? "")")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer(minLength: 0)

                if let km = lead.distanceKm {
                    VStack(alignment: .trailing) {
                        Text(formatDistance(km))
                            .font(.title3).bold()
                            .foregroundStyle(Color(hex: "c084fc"))
                        Text("unna").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }

            if let reason = lead.claudeRecommendationReason {
                Text(reason)
                    .font(.caption)
                    .italic()
                    .padding(8)
                    .background(Color(hex: "fbbf24").opacity(0.12), in: RoundedRectangle(cornerRadius: 6))
                    .overlay(alignment: .leading) {
                        Rectangle()
                            .fill(Color(hex: "fbbf24"))
                            .frame(width: 3)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            HStack(spacing: 6) {
                if let url = lead.appleMapsNavigateURL {
                    actionButton(label: "Naviger", icon: "location.fill", url: url, tint: Color(hex: "c084fc"))
                }
                if let phone = lead.phone, let url = URL(string: "tel:\(phone)") {
                    actionButton(label: "Ring", icon: "phone.fill", url: url, tint: Color(hex: "34d399"))
                }
                if let email = lead.email, let url = URL(string: "mailto:\(email)") {
                    actionButton(label: "E-post", icon: "envelope.fill", url: url, tint: Color(hex: "60a5fa"))
                }
                if let web = lead.websiteUrl, let url = URL(string: web) {
                    actionButton(label: "Nettside", icon: "safari", url: url, tint: .gray)
                }
            }
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(lead.isOverdue ? Color(hex: "f87171") : .clear, lineWidth: 2)
        )
    }

    private func actionButton(label: String, icon: String, url: URL, tint: Color) -> some View {
        Link(destination: url) {
            HStack(spacing: 4) {
                Image(systemName: icon).font(.caption)
                Text(label).font(.caption)
            }
            .padding(.horizontal, 8).padding(.vertical, 4)
            .foregroundStyle(tint)
            .background(tint.opacity(0.12), in: Capsule())
        }
        .accessibilityLabel("\(label) \(lead.name)")
    }

    private var statusChip: some View {
        Text(statusLabel(lead.leadStatus))
            .font(.caption2).bold()
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(statusColor(lead.leadStatus).opacity(0.2), in: Capsule())
            .foregroundStyle(statusColor(lead.leadStatus))
    }

    private func rankChip(_ rank: Int) -> some View {
        HStack(spacing: 2) {
            Image(systemName: "sparkles").font(.caption2)
            Text("#\(rank)").font(.caption2).bold()
        }
        .padding(.horizontal, 6).padding(.vertical, 2)
        .background(Color(hex: "fbbf24").opacity(0.2), in: Capsule())
        .foregroundStyle(Color(hex: "fbbf24"))
        .accessibilityLabel("Claude-prioritet \(rank)")
    }

    private var overdueChip: some View {
        HStack(spacing: 2) {
            Image(systemName: "calendar.badge.exclamationmark").font(.caption2)
            Text("Forfalt").font(.caption2).bold()
        }
        .padding(.horizontal, 6).padding(.vertical, 2)
        .background(Color(hex: "f87171").opacity(0.2), in: Capsule())
        .foregroundStyle(Color(hex: "f87171"))
    }
}

// MARK: - Hjelpe-funksjoner

private func formatDistance(_ km: Double) -> String {
    if km < 1 { return "\(Int(km * 1000)) m" }
    if km < 10 { return String(format: "%.1f km", km).replacingOccurrences(of: ".", with: ",") }
    return "\(Int(km)) km"
}

private func formatNok(_ n: Double) -> String {
    let fmt = NumberFormatter()
    fmt.locale = Locale(identifier: "nb_NO")
    fmt.numberStyle = .decimal
    fmt.maximumFractionDigits = 0
    return "\(fmt.string(from: NSNumber(value: n)) ?? "0") kr"
}

private func statusLabel(_ key: String) -> String {
    switch key {
    case "unvisited": return "Ikke besøkt"
    case "visited": return "Besøkt"
    case "return": return "Returner"
    case "not_present": return "Ikke til stede"
    case "declined": return "Avvist"
    case "interested": return "Interessert"
    case "meeting_booked": return "Møte"
    case "proposal_sent": return "Tilbud"
    case "won": return "Vunnet"
    case "lost": return "Tapt"
    default: return key
    }
}

private func statusColor(_ key: String) -> Color {
    switch key {
    case "won", "interested": return Color(hex: "34d399")
    case "lost", "declined": return Color(hex: "f87171")
    case "return": return Color(hex: "fbbf24")
    case "meeting_booked": return Color(hex: "60a5fa")
    case "proposal_sent": return Color(hex: "c084fc")
    default: return .gray
    }
}

// MARK: - Hex-farge helper

private extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var rgb: UInt64 = 0
        Scanner(string: s).scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}
