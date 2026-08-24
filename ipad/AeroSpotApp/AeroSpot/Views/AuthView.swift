// AuthView.swift — innloggingsark for arrangører. E-post/passord mot
// CreatorHub-auth, med TOTP-2FA-steg når kontoen krever det.

import SwiftUI

struct AuthView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var password = ""
    @State private var code = ""
    @State private var tempToken: String?
    @State private var error: String?
    @State private var working = false

    private var needs2FA: Bool { tempToken != nil }

    var body: some View {
        NavigationStack {
            Form {
                if needs2FA {
                    Section {
                        TextField("6-sifret kode", text: $code)
                            .keyboardType(.numberPad)
                            .textContentType(.oneTimeCode)
                    } header: {
                        Text("Tofaktor")
                    } footer: {
                        Text("Skriv inn koden fra Authenticator-appen.")
                    }
                } else {
                    Section("Logg inn") {
                        TextField("E-post", text: $email)
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        SecureField("Passord", text: $password)
                            .textContentType(.password)
                    }
                }

                if let error {
                    Section {
                        Text(error).font(.footnote).foregroundStyle(.red)
                    }
                }

                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        HStack {
                            Spacer()
                            Text(working ? "Logger inn…" : (needs2FA ? "Bekreft kode" : "Logg inn")).bold()
                            Spacer()
                        }
                    }
                    .disabled(working || !canSubmit)
                } footer: {
                    Text("Bruker CreatorHub-kontoen din. Ny arrangør? Kontakt daniel@creatorhubn.com.")
                }
            }
            .navigationTitle("Innlogging")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                }
            }
        }
    }

    private var canSubmit: Bool {
        if needs2FA { return code.count >= 6 }
        return !email.isEmpty && !password.isEmpty
    }

    private func submit() async {
        working = true
        error = nil
        let outcome: AuthStore.Outcome
        if let tempToken {
            outcome = await model.auth.complete2FA(tempToken: tempToken, code: code)
        } else {
            outcome = await model.auth.login(email: email, password: password)
        }
        working = false
        switch outcome {
        case .ok:
            Task { await model.logbook.syncFromServer() } // hent/synk loggbok
            dismiss()
        case let .needs2FA(temp):
            tempToken = temp
        case let .failed(message):
            error = message
        }
    }
}
