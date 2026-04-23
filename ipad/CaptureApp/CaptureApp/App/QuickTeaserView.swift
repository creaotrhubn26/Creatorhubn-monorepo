import SwiftUI

/// Kvikk-teaser-sheet — mellom-sesjoner-flyt hvor fotografen
/// plukker 3-5 hero-frames og sender en shareable URL til klient
/// uten å forlate iPad'en. Tre felt + én knapp, med eligibility-
/// teller som oppdateres live på filter-endring.
///
/// Etter vellykket send viser vi share-URL + copy-to-clipboard +
/// "Åpne i Meldinger" som pre-formaterer en SMS. Fotografen kan
/// også velge å se URL som QR-kode — raskeste måten å gi URL til
/// en klient som står ved siden av med sin egen telefon.
struct QuickTeaserView: View {
    let sessionId: UUID
    let ownerUserId: String
    /// Pre-fill fra det linkede prosjektet hvis vi har det.
    var defaultClientName: String?
    var defaultClientEmail: String?
    var defaultProjectTitle: String?

    @Environment(\.dismiss) private var dismiss
    @State private var clientName: String
    @State private var clientEmail: String
    @State private var projectTitle: String
    @State private var filter: BackendDeliverFilter = .flagged
    @State private var eligibleCount: Int?
    @State private var countLoading = false
    @State private var isSending = false
    @State private var result: BackendDeliverToShowcaseResponse?
    @State private var errorMessage: String?

    init(
        sessionId: UUID,
        ownerUserId: String,
        defaultClientName: String? = nil,
        defaultClientEmail: String? = nil,
        defaultProjectTitle: String? = nil,
    ) {
        self.sessionId = sessionId
        self.ownerUserId = ownerUserId
        self.defaultClientName = defaultClientName
        self.defaultClientEmail = defaultClientEmail
        self.defaultProjectTitle = defaultProjectTitle
        _clientName = State(initialValue: defaultClientName ?? "")
        _clientEmail = State(initialValue: defaultClientEmail ?? "")
        _projectTitle = State(initialValue: defaultProjectTitle ?? "")
    }

    private var service: QuickTeaserService? {
        guard let url = try? AppDatabase.defaultDiskURL(),
              let db = try? AppDatabase.openOnDisk(at: url) else {
            return nil
        }
        // Backend client picks up auth-headers once the auth bridge
        // lands (task #47). For the simulator-drive-by we construct
        // a no-auth client pointed at the dev backend; Keychain
        // injection replaces this in production.
        let backend = BackendClient(
            baseURL: URL(string: "https://creatorhub-backend-rtbl.onrender.com")!,
        )
        return QuickTeaserService(database: db, backend: backend)
    }

    var body: some View {
        NavigationStack {
            Group {
                if let result {
                    successView(result)
                } else {
                    formView
                }
            }
            .navigationTitle("Send teaser")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(result == nil ? "Avbryt" : "Lukk") { dismiss() }
                }
            }
            .task(id: filter) { await refreshEligibleCount() }
        }
    }

    // MARK: - Form

    private var formView: some View {
        Form {
            Section("Klient") {
                TextField("Navn", text: $clientName)
                    .textContentType(.name)
                TextField("E-post", text: $clientEmail)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                TextField("Prosjekt-tittel (valgfritt)", text: $projectTitle)
            }

            Section {
                Picker("Utvalg", selection: $filter) {
                    Text("Kun hero-flaggede").tag(BackendDeliverFilter.flagged)
                    Text("4+ stjerner").tag(BackendDeliverFilter.ratingAtLeast4)
                    Text("Hero eller 4+ stjerner").tag(BackendDeliverFilter.picksOr4Plus)
                }
                .pickerStyle(.inline)
            } footer: {
                eligibleFooter
            }

            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                        .font(.callout)
                }
            }

            Section {
                Button {
                    Task { await send() }
                } label: {
                    HStack {
                        Spacer()
                        if isSending {
                            ProgressView()
                        } else {
                            Label("Send teaser", systemImage: "paperplane.fill")
                                .font(.headline)
                        }
                        Spacer()
                    }
                }
                .disabled(isSending || (eligibleCount ?? 0) == 0)
                .listRowBackground(Color.accentColor)
                .foregroundStyle(.white)
            }
        }
    }

    @ViewBuilder
    private var eligibleFooter: some View {
        if countLoading {
            HStack(spacing: 6) {
                ProgressView().scaleEffect(0.7)
                Text("Teller utvalg…")
            }
        } else if let count = eligibleCount {
            if count == 0 {
                Text("Ingen bilder matcher dette utvalget i denne økten.")
                    .foregroundStyle(.orange)
            } else {
                Text("Vil sende \(count) bilde\(count == 1 ? "" : "r") til \(clientName.isEmpty ? "klienten" : clientName).")
            }
        }
    }

    // MARK: - Success

    private func successView(_ result: BackendDeliverToShowcaseResponse) -> some View {
        VStack(spacing: 20) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 64))
                .foregroundStyle(.green)

            Text("Teaseren er sendt")
                .font(.title2.bold())

            Text("\(result.uploadedImageCount) bilde\(result.uploadedImageCount == 1 ? "" : "r") er lastet opp og galleriet er klart.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            VStack(alignment: .leading, spacing: 8) {
                Text("Klient-URL")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(result.shareUrl)
                    .font(.footnote.monospaced())
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.primary.opacity(0.06)),
                    )
            }
            .padding(.horizontal)

            HStack(spacing: 12) {
                Button {
                    UIPasteboard.general.string = result.shareUrl
                } label: {
                    Label("Kopier URL", systemImage: "doc.on.doc")
                }
                .buttonStyle(.bordered)

                if let smsURL = smsComposeURL(for: result.shareUrl) {
                    Button {
                        UIApplication.shared.open(smsURL)
                    } label: {
                        Label("SMS til klient", systemImage: "message.fill")
                    }
                    .buttonStyle(.borderedProminent)
                }
            }

            if result.reusedExisting {
                Text("Eksisterende galleri ble gjenbrukt — klienten får oppdatering automatisk.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            Spacer()
        }
        .padding(.top, 32)
    }

    // MARK: - Actions

    private func refreshEligibleCount() async {
        guard let service else { return }
        countLoading = true
        defer { countLoading = false }
        do {
            eligibleCount = try await service.eligibleCount(
                sessionId: sessionId,
                ownerUserId: ownerUserId,
                filter: filter,
            )
            // A filter change invalidates a prior error too.
            errorMessage = nil
        } catch {
            eligibleCount = nil
        }
    }

    private func send() async {
        guard let service else {
            errorMessage = "Database/backend ikke tilgjengelig."
            return
        }
        errorMessage = nil
        isSending = true
        defer { isSending = false }
        do {
            result = try await service.deliver(
                sessionId: sessionId,
                ownerUserId: ownerUserId,
                clientName: clientName,
                clientEmail: clientEmail,
                projectTitle: projectTitle,
                filter: filter,
            )
        } catch let failure as QuickTeaserService.Failure {
            errorMessage = String(describing: failure)
        } catch {
            errorMessage = String(describing: error)
        }
    }

    /// Build an ``sms:``-URL that pre-fills body so tap-to-send is
    /// one step. Body is localised Norwegian plus the share URL
    /// inline so the client can tap-to-open from their phone.
    private func smsComposeURL(for shareURL: String) -> URL? {
        let body = "Hei! Her er et lite utvalg bilder fra shootet: \(shareURL)"
        guard let encoded = body.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else {
            return nil
        }
        return URL(string: "sms:&body=\(encoded)")
    }
}
