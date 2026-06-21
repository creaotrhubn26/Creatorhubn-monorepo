import SwiftUI

/// Detail for a single contract — reads the sections, shows the total +
/// signed state, and exposes the three photographer actions: sign with
/// Apple Pencil, email to the client, and lifecycle status change. Fetches
/// the bare contract object from `GET /api/contracts/:id` and mutates via
/// the `DashboardClient+Admin` endpoints, re-fetching after each change.
@MainActor
@Observable
final class ContractDetailModel {
    let contractId: String

    private(set) var contract: ContractSummary?
    private(set) var loading = true
    private(set) var errorMessage: String?
    var working = false

    init(contractId: String) { self.contractId = contractId }

    var isSigned: Bool {
        (contract?.signatureStatus ?? "").lowercased() == "signed"
            || (contract?.status ?? "").lowercased() == "signed"
            || (contract?.status ?? "").lowercased() == "completed"
    }

    func load() async {
        guard let client = DashboardClient.make() else {
            errorMessage = DashboardError.signedOut.localizedDescription
            loading = false
            return
        }
        loading = contract == nil
        errorMessage = nil
        do {
            contract = try await client.contract(id: contractId)
        } catch {
            if contract == nil {
                errorMessage = (error as? DashboardError)?.localizedDescription
                    ?? error.localizedDescription
            }
        }
        loading = false
    }

    /// Stamp a handwritten signature. `pngData` is the flattened render
    /// from ``SignatureCanvasView`` — we base64-encode it for the backend.
    func sign(with capture: SignatureCapture, signerName: String, signerEmail: String) async {
        guard let client = DashboardClient.make() else { return }
        working = true
        defer { working = false }
        let base64 = "data:image/png;base64,\(capture.pngData.base64EncodedString())"
        do {
            try await client.signContract(
                id: contractId,
                signerName: signerName,
                signerEmail: signerEmail,
                signatureDataBase64: base64,
            )
            await load()
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
        }
    }

    func sendEmail() async {
        guard let client = DashboardClient.make() else { return }
        working = true
        defer { working = false }
        do {
            try await client.sendContract(id: contractId)
            await load()
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
        }
    }

    func setStatus(_ status: String) async {
        guard let client = DashboardClient.make() else { return }
        working = true
        defer { working = false }
        do {
            try await client.setContractStatus(id: contractId, status: status)
            await load()
        } catch {
            errorMessage = (error as? DashboardError)?.localizedDescription ?? error.localizedDescription
        }
    }
}

struct ContractDetailView: View {
    @State private var model: ContractDetailModel
    private let summary: ContractSummary

    @State private var showingSignature = false
    @State private var showingStatusDialog = false

    init(contractId: String, summary: ContractSummary) {
        _model = State(initialValue: ContractDetailModel(contractId: contractId))
        self.summary = summary
    }

    /// Current best-known contract (live detail if loaded, else the row
    /// summary we navigated from).
    private var current: ContractSummary { model.contract ?? summary }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                if model.loading && model.contract == nil {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else if let message = model.errorMessage, model.contract == nil {
                    ContentUnavailableView("Kunne ikke laste", systemImage: "exclamationmark.icloud", description: Text(message))
                } else {
                    if model.isSigned { signedBanner }
                    if let message = model.errorMessage { inlineError(message) }
                    actions
                    if let sections = current.sections, !sections.isEmpty {
                        sectionsView(sections)
                    }
                }
            }
            .padding()
        }
        .frame(maxWidth: .infinity)
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle(current.title ?? "Kontrakt")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .refreshable { await model.load() }
        .sheet(isPresented: $showingSignature) {
            SignatureCanvasView(
                title: "Signér kontrakt",
                prompt: "Signér med Apple Pencil eller finger for å bekrefte \(current.title ?? "kontrakten").",
            ) { capture in
                guard let capture, !capture.isEmpty else { return }
                let session = SignInService.shared.session
                let name = current.clientName ?? session?.displayName ?? "Signatur"
                let email = current.clientEmail ?? session?.email ?? ""
                Task { await model.sign(with: capture, signerName: name, signerEmail: email) }
            }
            .chBranded()
        }
        .confirmationDialog("Endre status", isPresented: $showingStatusDialog, titleVisibility: .visible) {
            Button("Utkast") { Task { await model.setStatus("draft") } }
            Button("Til signering") { Task { await model.setStatus("pending_signatures") } }
            Button("Signert") { Task { await model.setStatus("signed") } }
            Button("Avbrutt", role: .destructive) { Task { await model.setStatus("cancelled") } }
            Button("Avbryt", role: .cancel) {}
        }
    }

    // MARK: - Header

    private var header: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    Text(current.title ?? "Kontrakt")
                        .font(.title3.bold())
                        .foregroundStyle(CHTheme.textPrimary)
                    Spacer()
                    ContractStatusPill(status: current.status)
                }
                if let number = current.contractNumber, !number.isEmpty {
                    Text("Kontraktnr. \(number)")
                        .font(.caption)
                        .foregroundStyle(CHTheme.textMuted)
                }
                if let client = current.clientName, !client.isEmpty {
                    Label(client, systemImage: "person")
                        .font(.subheadline)
                        .foregroundStyle(CHTheme.textSecondary)
                }
                if let email = current.clientEmail, !email.isEmpty {
                    Label(email, systemImage: "envelope")
                        .font(.subheadline)
                        .foregroundStyle(CHTheme.textSecondary)
                }
                HStack(spacing: 10) {
                    SignatureStatusPill(status: current.signatureStatus)
                    if let total = current.totalAmount, total > 0 {
                        Label(ContractFormat.currency(total), systemImage: "creditcard")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(CHTheme.textPrimary)
                    }
                }
            }
        }
    }

    // MARK: - Signed banner

    private var signedBanner: some View {
        HStack(spacing: 10) {
            Image(systemName: "checkmark.seal.fill")
                .foregroundStyle(CHTheme.success)
                .font(.title3)
            VStack(alignment: .leading, spacing: 2) {
                Text("Signert")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(CHTheme.textPrimary)
                let who = current.signerName ?? current.clientName
                let when = DashboardDate.relative(current.signedAt)
                Text([who, when.isEmpty ? nil : when].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(CHTheme.textSecondary)
            }
            Spacer()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CHTheme.success.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(CHTheme.success.opacity(0.3), lineWidth: 1))
    }

    private func inlineError(_ message: String) -> some View {
        Text(message)
            .font(.caption)
            .foregroundStyle(CHTheme.danger)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CHTheme.danger.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Actions

    private var actions: some View {
        VStack(spacing: 12) {
            if !model.isSigned {
                Button {
                    showingSignature = true
                } label: {
                    Label("Signér med Apple Pencil", systemImage: "signature")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(model.working)
            }

            HStack(spacing: 12) {
                Button {
                    Task { await model.sendEmail() }
                } label: {
                    Label("Send på e-post", systemImage: "paperplane")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(model.working)

                Button {
                    showingStatusDialog = true
                } label: {
                    Label("Endre status", systemImage: "arrow.triangle.2.circlepath")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(model.working)
            }

            if model.working {
                ProgressView().padding(.top, 4)
            }
        }
    }

    // MARK: - Sections

    private func sectionsView(_ sections: [ContractSection]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Innhold")
                .font(.headline)
                .foregroundStyle(CHTheme.textPrimary)
            ForEach(sections) { section in
                CHCard {
                    VStack(alignment: .leading, spacing: 8) {
                        if let title = section.title, !title.isEmpty {
                            Text(title)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(CHTheme.textPrimary)
                        }
                        if let content = section.content, !content.isEmpty {
                            Text(content)
                                .font(.subheadline)
                                .foregroundStyle(CHTheme.textSecondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
            }
        }
    }
}
