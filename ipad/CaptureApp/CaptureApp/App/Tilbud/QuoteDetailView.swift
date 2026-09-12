import SwiftUI
import UIKit

@MainActor
@Observable
final class QuoteDetailModel {
    let quoteId: String

    private(set) var quote: Quote?
    private(set) var loading = true
    private(set) var errorMessage: String?
    var working = false

    /// In-UI signature state. There is no dedicated quote-sign endpoint,
    /// so we capture the signature, render it, and mark the quote signed
    /// in the UI only (persisted on disk via ``SignatureStorage`` so it
    /// survives re-opening the detail this session).
    private(set) var signaturePNG: Data?
    private(set) var signedAt: Date?

    init(quoteId: String) { self.quoteId = quoteId }

    func load() async {
        guard let client = DashboardClient.make() else {
            errorMessage = DashboardError.signedOut.localizedDescription
            loading = false
            return
        }
        loading = quote == nil
        errorMessage = nil
        do {
            quote = try await client.quote(id: quoteId)
        } catch {
            if quote == nil {
                errorMessage = (error as? DashboardError)?.localizedDescription
                    ?? error.localizedDescription
            }
        }
        loading = false
    }

    func setStatus(_ status: String) async {
        guard let client = DashboardClient.make() else { return }
        working = true
        defer { working = false }
        do {
            try await client.setQuoteStatus(id: quoteId, status: status)
            await load()
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
        }
    }

    func send() async {
        guard let client = DashboardClient.make() else { return }
        working = true
        defer { working = false }
        do {
            try await client.sendQuote(id: quoteId)
            await load()
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
        }
    }

    /// Persist the captured signature in-UI (+ to disk for this session).
    func applySignature(_ capture: SignatureCapture) {
        signaturePNG = capture.pngData
        signedAt = capture.capturedAt
        // Best-effort disk persistence — failure just means it won't
        // survive an app relaunch, which is acceptable for an in-UI mark.
        if let dir = try? SignatureStorage.defaultDirectory() {
            _ = try? SignatureStorage(rootDirectory: dir).save(capture)
        }
    }

    var statusLower: String { (quote?.status ?? "").lowercased() }
}

struct QuoteDetailView: View {
    @State private var model: QuoteDetailModel
    private let summary: Quote
    private let onMutated: () async -> Void

    @State private var showingSignature = false

    init(quoteId: String, summary: Quote, onMutated: @escaping () async -> Void) {
        _model = State(initialValue: QuoteDetailModel(quoteId: quoteId))
        self.summary = summary
        self.onMutated = onMutated
    }

    /// The freshest copy — server detail when loaded, else the row summary.
    private var quote: Quote { model.quote ?? summary }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                if model.loading && model.quote == nil {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else if let message = model.errorMessage, model.quote == nil {
                    ContentUnavailableView("Kunne ikke laste", systemImage: "exclamationmark.icloud", description: Text(message))
                } else {
                    if let services = quote.services, !services.isEmpty {
                        lineItemsCard(services)
                    }
                    totalsCard
                    if model.signaturePNG != nil {
                        signatureCard
                    }
                    actionsCard
                    if let message = model.errorMessage {
                        Text(message)
                            .font(.caption)
                            .foregroundStyle(CHTheme.danger)
                    }
                }
            }
            .padding()
        }
        .frame(maxWidth: .infinity)
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle(quote.clientName ?? quote.title ?? "Tilbud")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .refreshable { await model.load() }
        .sheet(isPresented: $showingSignature) {
            SignatureCanvasView(
                title: "Signér tilbud",
                prompt: "Signér for å godkjenne tilbudet til \(quote.clientName ?? "klienten").",
            ) { capture in
                if let capture, !capture.isEmpty {
                    model.applySignature(capture)
                }
            }
            .chBranded()
        }
    }

    // MARK: - Header

    private var header: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        if let title = quote.title, !title.isEmpty {
                            Text(title).font(.title3.bold()).foregroundStyle(CHTheme.textPrimary)
                        }
                        if let number = quote.quoteNumber, !number.isEmpty {
                            Text("#\(number)")
                                .font(.caption.monospaced())
                                .foregroundStyle(CHTheme.textMuted)
                        }
                    }
                    Spacer()
                    QuoteStatusPill(status: quote.status)
                }
                if let name = quote.clientName, !name.isEmpty {
                    Label(name, systemImage: "person")
                        .font(.subheadline)
                        .foregroundStyle(CHTheme.textSecondary)
                }
                if let email = quote.clientEmail, !email.isEmpty {
                    Label(email, systemImage: "envelope")
                        .font(.subheadline)
                        .foregroundStyle(CHTheme.textSecondary)
                }
                if let desc = quote.description, !desc.isEmpty {
                    Text(desc)
                        .font(.subheadline)
                        .foregroundStyle(CHTheme.textSecondary)
                        .padding(.top, 2)
                }
                HStack(spacing: 16) {
                    if let created = quote.createdAt {
                        Label("Opprettet \(DashboardDate.relative(created))", systemImage: "calendar")
                    }
                    if let valid = quote.validUntil, let date = DashboardDate.parse(valid) {
                        Label("Gyldig til \(date.formatted(.dateTime.day().month()))", systemImage: "clock")
                    }
                }
                .font(.caption2)
                .foregroundStyle(CHTheme.textMuted)
            }
        }
    }

    // MARK: - Line items

    private func lineItemsCard(_ services: [QuoteService]) -> some View {
        CHCard {
            VStack(alignment: .leading, spacing: 12) {
                sectionHeader("Linjeposter", count: services.count)
                ForEach(services) { service in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(alignment: .firstTextBaseline) {
                            Text(service.description.isEmpty ? "Post" : service.description)
                                .font(.subheadline)
                                .foregroundStyle(CHTheme.textPrimary)
                            Spacer()
                            Text(QuoteFormat.kr(service.totalPrice))
                                .font(.subheadline.monospacedDigit())
                                .foregroundStyle(CHTheme.textPrimary)
                        }
                        Text("\(QuoteFormat.qty(service.quantity)) × \(QuoteFormat.kr(service.unitPrice))")
                            .font(.caption)
                            .foregroundStyle(CHTheme.textMuted)
                    }
                    if service.id != services.last?.id {
                        Divider().overlay(CHTheme.border)
                    }
                }
            }
        }
    }

    // MARK: - Totals

    private var totalsCard: some View {
        CHCard {
            VStack(spacing: 8) {
                if let subtotal = quote.subtotal {
                    totalRow("Subtotal", QuoteFormat.kr(subtotal), muted: true)
                }
                if let mva = quote.mva {
                    totalRow("MVA", QuoteFormat.kr(mva), muted: true)
                }
                Divider().overlay(CHTheme.border)
                totalRow("Totalt", QuoteFormat.kr(quote.totalAmount), emphasized: true)
            }
        }
    }

    private func totalRow(_ label: String, _ value: String, muted: Bool = false, emphasized: Bool = false) -> some View {
        HStack {
            Text(label)
                .font(emphasized ? .headline : .subheadline)
                .foregroundStyle(muted ? CHTheme.textSecondary : CHTheme.textPrimary)
            Spacer()
            Text(value)
                .font((emphasized ? Font.headline : Font.subheadline).monospacedDigit())
                .foregroundStyle(emphasized ? CHTheme.accent : (muted ? CHTheme.textSecondary : CHTheme.textPrimary))
        }
    }

    // MARK: - Signature

    private var signatureCard: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Label("Signert", systemImage: "checkmark.seal.fill")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(CHTheme.success)
                    Spacer()
                    if let at = model.signedAt {
                        Text(at.formatted(.dateTime.day().month().hour().minute()))
                            .font(.caption2)
                            .foregroundStyle(CHTheme.textMuted)
                    }
                }
                if let png = model.signaturePNG, let image = UIImage(data: png) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(maxHeight: 90)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(8)
                        .background(Color.white.opacity(0.92), in: RoundedRectangle(cornerRadius: 8))
                }
                Text("Signaturen er lagret på enheten. Tilbud har ingen egen signerings-endepunkt ennå.")
                    .font(.caption2)
                    .foregroundStyle(CHTheme.textMuted)
            }
        }
    }

    // MARK: - Actions

    private var actionsCard: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Handlinger").font(.headline).foregroundStyle(CHTheme.textPrimary)

                Button {
                    Task {
                        await model.send()
                        await onMutated()
                    }
                } label: {
                    Label("Send på e-post", systemImage: "paperplane.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.working || (quote.clientEmail ?? "").isEmpty)

                HStack(spacing: 12) {
                    Button {
                        Task {
                            await model.setStatus("accepted")
                            await onMutated()
                        }
                    } label: {
                        Label("Marker akseptert", systemImage: "checkmark.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(CHTheme.success)
                    .disabled(model.working || model.statusLower == "accepted")

                    Button {
                        Task {
                            await model.setStatus("rejected")
                            await onMutated()
                        }
                    } label: {
                        Label("Avvist", systemImage: "xmark.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(CHTheme.danger)
                    .disabled(model.working || model.statusLower == "rejected")
                }

                Button {
                    showingSignature = true
                } label: {
                    Label(model.signaturePNG == nil ? "Signér" : "Signér på nytt", systemImage: "signature")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(model.working)

                if model.working {
                    HStack {
                        ProgressView()
                        Text("Oppdaterer…").font(.caption).foregroundStyle(CHTheme.textMuted)
                    }
                }
            }
        }
    }

    private func sectionHeader(_ title: String, count: Int) -> some View {
        HStack {
            Text(title).font(.headline).foregroundStyle(CHTheme.textPrimary)
            Text("\(count)").font(.subheadline).foregroundStyle(CHTheme.textMuted)
            Spacer()
        }
    }
}
