import SwiftUI

struct IdPortenStatus: Decodable, Sendable {
    let configured: Bool
    let env: String?
    let loggedIn: Bool
    let expiresAt: String?
    let scope: String?
    let subject: String?
}

@MainActor
@Observable
final class MvaViewModel {
    enum Load { case idle, loading, loaded(IdPortenStatus), failed(String) }
    var load: Load = .idle
    var loggingIn = false
    var note: String?

    func fetch(orgId: String) async {
        load = .loading
        do {
            let s: IdPortenStatus = try await APIClient.shared.get("/api/organizations/\(orgId)/idporten/status")
            load = .loaded(s)
        } catch {
            load = .failed(error.localizedDescription)
        }
    }

    func login(orgId: String) async {
        loggingIn = true; note = nil
        struct Resp: Decodable { let authorizeUrl: String }
        struct Empty: Encodable {}
        do {
            let r: Resp = try await APIClient.shared.post("/api/organizations/\(orgId)/idporten/login", body: Empty())
            if let url = URL(string: r.authorizeUrl) {
                await WebAuth.shared.present(url: url, callbackScheme: nil)
                note = "Fullfør innloggingen med BankID i vinduet. Statusen oppdateres når du er tilbake."
            }
        } catch {
            note = error.localizedDescription
        }
        loggingIn = false
        await fetch(orgId: orgId)
    }
}

struct MvaView: View {
    let orgId: String
    @State private var model = MvaViewModel()

    var body: some View {
        Group {
            switch model.load {
            case .idle, .loading:
                ProgressView("Henter MVA-status…")
            case .failed(let msg):
                ContentUnavailableView("Kunne ikke hente", systemImage: "exclamationmark.triangle", description: Text(msg))
            case .loaded(let s):
                Form {
                    Section("Skatteetaten (ID-porten)") {
                        StatusRow(label: "Tilkobling", value: s.configured ? "Konfigurert" : "Ikke konfigurert",
                                  tint: s.configured ? .green : .red)
                        if let env = s.env { StatusRow(label: "Miljø", value: env, tint: .secondary) }
                        StatusRow(label: "Innlogget", value: s.loggedIn ? "Ja" : "Nei",
                                  tint: s.loggedIn ? .green : .orange)
                        if let subj = s.subject { StatusRow(label: "Person", value: subj, tint: .secondary) }
                        if let exp = s.expiresAt { StatusRow(label: "Utløper", value: String(exp.prefix(16)), tint: .secondary) }
                    }
                    if s.configured {
                        Section {
                            Button {
                                Task { await model.login(orgId: orgId) }
                            } label: {
                                if model.loggingIn { ProgressView() }
                                else { Label(s.loggedIn ? "Logg inn på nytt (BankID)" : "Logg inn med BankID", systemImage: "person.badge.key") }
                            }
                            .disabled(model.loggingIn)
                        } footer: {
                            Text("MVA-meldingen sendes via Altinn med din ID-porten-innlogging. En person med MVA-fullmakt logger inn og representerer virksomheten. Selve valideringen og innsendingen gjøres i web-appen.")
                        }
                    } else {
                        Section { Text("ID-porten er ikke satt opp i dette miljøet ennå.").font(.footnote).foregroundStyle(.secondary) }
                    }
                    if let n = model.note {
                        Section { Text(n).font(.footnote).foregroundStyle(.secondary) }
                    }
                }
            }
        }
        .navigationTitle("MVA")
        .task(id: orgId) { await model.fetch(orgId: orgId) }
    }
}

private struct StatusRow: View {
    let label: String
    let value: String
    let tint: Color
    var body: some View {
        HStack {
            Text(label).font(.subheadline)
            Spacer()
            Text(value).font(.subheadline.weight(.medium)).foregroundStyle(tint)
        }
    }
}
