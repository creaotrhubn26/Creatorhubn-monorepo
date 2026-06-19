// LeadgridBillingView.swift
//
// Faktura-historikk + Stripe billing-portal-link for markedssjef.
// Backend:
//   GET  /api/leadgrid/billing/invoices
//   POST /api/leadgrid/billing/portal-session

import SwiftUI

struct LeadgridBillingView: View {
    let api: APIClient

    @State private var invoices: [LeadgridBillingInvoice] = []
    @State private var loading = true
    @State private var errorText: String?
    @State private var portalLoading = false
    @State private var portalUrl: URL?
    @State private var portalError: String?

    var body: some View {
        List {
            Section {
                Button {
                    Task { await openBillingPortal() }
                } label: {
                    HStack {
                        Label("Åpne Stripe billing-portal",
                              systemImage: "creditcard.fill")
                        Spacer()
                        if portalLoading {
                            ProgressView().scaleEffect(0.7)
                        } else {
                            Image(systemName: "arrow.up.right.square")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .disabled(portalLoading)
                if let portalError {
                    Text(portalError).font(.caption).foregroundStyle(.red)
                }
            } footer: {
                Text("Oppdater betalingsmetode, last ned fakturaer, endre plan.")
                    .font(.caption2)
            }

            Section("Fakturaer (\(invoices.count))") {
                if loading && invoices.isEmpty {
                    HStack { Spacer(); ProgressView(); Spacer() }
                        .listRowBackground(Color.clear)
                } else if invoices.isEmpty {
                    Text("Ingen fakturaer ennå.")
                        .foregroundStyle(.secondary)
                        .font(.callout)
                } else {
                    ForEach(invoices) { inv in
                        invoiceRow(inv)
                    }
                }
            }

            if let errorText {
                Section { Text(errorText).foregroundStyle(.red).font(.caption) }
            }
        }
        .navigationTitle("Faktura")
        .task { await load() }
        .refreshable { await load() }
        .sheet(item: Binding(
            get: { portalUrl.map { UrlWrapper(url: $0) } },
            set: { portalUrl = $0?.url }
        )) { wrap in
            SafariSheet(url: wrap.url)
        }
    }

    private struct UrlWrapper: Identifiable {
        let url: URL
        var id: String { url.absoluteString }
    }

    @ViewBuilder
    private func invoiceRow(_ inv: LeadgridBillingInvoice) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                if let number = inv.number {
                    Text(number).font(.headline)
                } else {
                    Text(String(inv.id.prefix(10))).font(.caption.monospaced())
                }
                Spacer()
                Text(inv.formattedAmount).font(.subheadline.bold())
            }
            HStack(spacing: 6) {
                statusChip(inv.status)
                if let start = inv.periodStart, let end = inv.periodEnd {
                    Text("\(LeadgridDate.formatNo(start)) — \(LeadgridDate.formatNo(end))")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                } else if let createdAt = inv.createdAt {
                    Text(LeadgridDate.formatNo(createdAt))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if let pdf = inv.invoicePdfUrl, let url = URL(string: pdf) {
                    Link(destination: url) {
                        Image(systemName: "doc.fill.badge.plus")
                            .foregroundStyle(.purple)
                    }
                }
                if let hosted = inv.hostedInvoiceUrl, let url = URL(string: hosted) {
                    Link(destination: url) {
                        Image(systemName: "arrow.up.right.square")
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private func statusChip(_ status: String) -> some View {
        let (label, color, icon): (String, Color, String) = {
            switch status {
            case "paid": return ("Betalt", .green, "checkmark.circle.fill")
            case "open": return ("Utestående", .orange, "clock.fill")
            case "void": return ("Annullert", .secondary, "xmark.circle.fill")
            case "uncollectible": return ("Avskrevet", .red, "exclamationmark.triangle.fill")
            default: return (status.capitalized, .secondary, "circle")
            }
        }()
        Label(label, systemImage: icon)
            .font(.caption2.bold())
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(color.opacity(0.20), in: Capsule())
            .foregroundStyle(color)
    }

    private func load() async {
        do {
            let resp = try await api.fetchLeadgridBillingInvoices()
            await MainActor.run {
                invoices = resp.invoices
                loading = false
            }
        } catch {
            await MainActor.run {
                errorText = "Kunne ikke laste fakturaer"
                loading = false
            }
        }
    }

    private func openBillingPortal() async {
        await MainActor.run {
            portalLoading = true
            portalError = nil
        }
        do {
            let resp = try await api.createBillingPortalSession()
            guard let url = URL(string: resp.url) else {
                throw APIError.invalidResponse
            }
            await MainActor.run {
                portalUrl = url
                portalLoading = false
            }
        } catch {
            await MainActor.run {
                portalError = "Kunne ikke åpne portal"
                portalLoading = false
            }
        }
    }
}

// MARK: - SafariSheet wrapper (in-app browser for Stripe portal)

import SafariServices

struct SafariSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}
