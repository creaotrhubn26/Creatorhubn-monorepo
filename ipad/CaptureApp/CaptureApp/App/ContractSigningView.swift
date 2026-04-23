import SwiftUI
import PDFKit
import UIKit

/// Apple Pencil-native contract signing. Renders the contract PDF
/// (or falls back to the term-list when no cached PDF exists) and
/// presents a big "Signer med Pencil"-button that opens the
/// ``SignatureCanvasView`` sheet. Once the photographer finishes
/// signing, we persist the capture, update the local contract row,
/// and enqueue the backend POST — all atomically.
///
/// Signed contracts show the rendered signature PNG at the top of
/// the view + a "Signert X siden" timestamp. Re-signing is
/// explicit ("Gå til kladd + signer på nytt") because accidental
/// re-signs would invalidate the prior binding document.
struct ContractSigningView: View {
    let contractId: String
    let ownerUserId: String

    @State private var contract: Contract?
    @State private var signaturePNGURL: URL?
    @State private var loadError: String?
    @State private var isSigning = false
    @State private var showSignSheet = false
    @State private var infoMessage: String?

    private var store: ContractStore? {
        do {
            let url = try AppDatabase.defaultDiskURL()
            let db = try AppDatabase.openOnDisk(at: url)
            let sigDir = try SignatureStorage.defaultDirectory()
            return ContractStore(
                database: db,
                outbox: Outbox(database: db),
                signatureStorage: SignatureStorage(rootDirectory: sigDir),
            )
        } catch {
            return nil
        }
    }

    var body: some View {
        Group {
            if let contract {
                loaded(contract)
            } else if let loadError {
                errorView(loadError)
            } else {
                ProgressView().task { await reload() }
            }
        }
        .navigationTitle("Kontrakt")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showSignSheet) {
            SignatureCanvasView(
                title: "Signer kontrakten",
                prompt: "Undertegner bekrefter at vilkårene over er lest og akseptert.",
                onFinish: { capture in
                    Task { await commit(capture: capture) }
                },
            )
        }
    }

    // MARK: - Loaded

    @ViewBuilder
    private func loaded(_ contract: Contract) -> some View {
        ScrollView {
            VStack(spacing: 20) {
                headerSection(contract)
                if contract.status == .signed, let url = signaturePNGURL {
                    signedSignatureCard(url: url)
                }
                pdfOrTermsSection(contract)
                signActions(contract)
                if let msg = infoMessage {
                    Label(msg, systemImage: "info.circle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
        }
    }

    private func headerSection(_ contract: Contract) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(contract.clientName)
                    .font(.title2.weight(.semibold))
                Spacer()
                statusChip(contract.status)
            }
            if let email = contract.clientEmail {
                Text(email)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if let signedAt = contract.signedAt {
                Label(
                    "Signert \(signedAt.formatted(.relative(presentation: .named)))",
                    systemImage: "checkmark.seal.fill",
                )
                .font(.caption)
                .foregroundStyle(.green)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func statusChip(_ status: Contract.Status) -> some View {
        let (label, color): (String, Color) = {
            switch status {
            case .draft: return ("Kladd", .secondary)
            case .sent: return ("Sendt", .blue)
            case .signed: return ("Signert ✓", .green)
            case .expired: return ("Utløpt", .red)
            }
        }()
        return Text(label)
            .font(.caption.weight(.semibold))
            .padding(.vertical, 4).padding(.horizontal, 10)
            .background(Capsule().fill(color.opacity(0.15)))
            .foregroundStyle(color)
    }

    private func signedSignatureCard(url: URL) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Din signatur")
                .font(.caption)
                .foregroundStyle(.secondary)
            if let image = UIImage(contentsOfFile: url.path) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 120)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(uiColor: .secondarySystemBackground)),
        )
    }

    @ViewBuilder
    private func pdfOrTermsSection(_ contract: Contract) -> some View {
        if let pdfPath = contract.pdfLocalPath,
           let pdf = PDFDocument(url: URL(fileURLWithPath: pdfPath)) {
            PDFKitViewRepresentable(document: pdf)
                .frame(minHeight: 420)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(uiColor: .secondarySystemBackground)),
                )
        } else {
            // Terms-as-text fallback when the PDF hasn't been
            // downloaded to the iPad yet. Still readable + signable.
            VStack(alignment: .leading, spacing: 8) {
                Label("Kontrakts-vilkår (tekst)", systemImage: "doc.text")
                    .font(.headline)
                Text(formatTerms(contract.termsJson))
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(uiColor: .secondarySystemBackground)),
            )
        }
    }

    private func signActions(_ contract: Contract) -> some View {
        VStack(spacing: 12) {
            if contract.status == .signed {
                Button(role: .destructive) {
                    Task { await clearSignature() }
                } label: {
                    Label("Gå til kladd + signer på nytt", systemImage: "arrow.uturn.backward")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(isSigning)
            } else {
                Button {
                    showSignSheet = true
                } label: {
                    Label("Signer med Apple Pencil", systemImage: "pencil.tip")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSigning)
            }
            if isSigning {
                ProgressView()
            }
        }
    }

    private func errorView(_ error: String) -> some View {
        VStack(spacing: 8) {
            Label("Kunne ikke laste kontrakt", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
            Text(error)
                .font(.caption)
                .foregroundStyle(.secondary)
            Button("Prøv igjen") { Task { await reload() } }
                .buttonStyle(.bordered)
        }
        .padding()
    }

    // MARK: - Actions

    private func reload() async {
        guard let store else {
            loadError = "Database ikke tilgjengelig"
            return
        }
        do {
            contract = try await store.load(
                contractId: contractId,
                ownerUserId: ownerUserId,
            )
            if let ref = contract?.signatureDataRef {
                signaturePNGURL = store.signatureStorage.pngURL(forRef: ref)
            } else {
                signaturePNGURL = nil
            }
            loadError = nil
        } catch {
            loadError = String(describing: error)
        }
    }

    private func commit(capture: SignatureCapture?) async {
        guard let store else { return }
        guard let capture else {
            infoMessage = "Signering avbrutt — ingen endring lagret."
            return
        }
        isSigning = true
        defer { isSigning = false }
        do {
            _ = try await store.applySignature(
                contractId: contractId,
                ownerUserId: ownerUserId,
                capture: capture,
            )
            infoMessage = "Signert + lagt i sync-kø."
            await reload()
        } catch {
            infoMessage = "Feil: \(error)"
        }
    }

    private func clearSignature() async {
        guard let store else { return }
        isSigning = true
        defer { isSigning = false }
        do {
            _ = try await store.clearSignature(
                contractId: contractId,
                ownerUserId: ownerUserId,
            )
            infoMessage = "Signaturen er fjernet. Du kan signere på nytt."
            await reload()
        } catch {
            infoMessage = "Feil: \(error)"
        }
    }

    /// Render the terms JSON as a photographer-readable string.
    /// Fully blind parse — we don't know every possible shape the
    /// web contract editor emits, so we stringify unknown values
    /// rather than drop them.
    private func formatTerms(_ termsJson: String) -> String {
        guard let data = termsJson.data(using: .utf8),
              let raw = try? JSONSerialization.jsonObject(with: data),
              let dict = raw as? [String: Any]
        else {
            return termsJson
        }
        return dict
            .sorted { $0.key < $1.key }
            .map { "• \($0.key): \($0.value)" }
            .joined(separator: "\n")
    }
}

// MARK: - PDFKit bridge

/// Thin UIViewRepresentable so SwiftUI can embed PDFView. PDFKit
/// handles Apple Pencil annotations natively, so if we want the
/// photographer to mark up the contract itself (signature box
/// position, initials) we can enable ``enableDataDetectors = true``
/// + add a ``PDFAnnotation`` overlay. For MVP we just render.
private struct PDFKitViewRepresentable: UIViewRepresentable {
    let document: PDFDocument

    func makeUIView(context: Context) -> PDFView {
        let view = PDFView()
        view.document = document
        view.autoScales = true
        view.displayMode = .singlePageContinuous
        view.displayDirection = .vertical
        return view
    }

    func updateUIView(_ uiView: PDFView, context: Context) {
        uiView.document = document
    }
}
