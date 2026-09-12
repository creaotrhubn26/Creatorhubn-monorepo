// LeadgridFeedbackSheet.swift
//
// In-app-prompt for aktive kunder: «Hva synes du om Leadgrid?». Sender inn en
// omtale (POST /api/leadgrid/testimonials). Super-admin godkjenner før den
// evt. vises på leadgrid.no. Prefiller navn/firma fra profilen når mulig.

import SwiftUI

struct LeadgridFeedbackSheet: View {
    let api: APIClient
    var prefillName: String = ""
    var prefillOrg: String = ""

    @Environment(\.dismiss) private var dismiss
    @State private var rating: Int = 5
    @State private var quote: String = ""
    @State private var name: String = ""
    @State private var role: String = ""
    @State private var submitting = false
    @State private var done = false
    @State private var errorText: String?

    private var canSend: Bool { quote.trimmingCharacters(in: .whitespacesAndNewlines).count >= 4 }

    var body: some View {
        NavigationStack {
            Form {
                if done {
                    Section {
                        Label("Takk for tilbakemeldingen!", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(.green)
                        Text("Vi leser alt. Hvis vi bruker sitatet på leadgrid.no, spør vi deg først.")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                } else {
                    Section("Hvor fornøyd er du?") {
                        HStack(spacing: 10) {
                            ForEach(1...5, id: \.self) { i in
                                Image(systemName: i <= rating ? "star.fill" : "star")
                                    .font(.title2)
                                    .foregroundStyle(i <= rating ? Color.purple : Color.secondary)
                                    .onTapGesture { rating = i }
                                    .accessibilityLabel("\(i) av 5")
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 4)
                    }
                    Section("Hva synes du om Leadgrid?") {
                        TextField("Fortell oss kort hva du liker (eller savner)…", text: $quote, axis: .vertical)
                            .lineLimit(3...8)
                    }
                    Section("Vises sammen med sitatet (valgfritt)") {
                        TextField("Navn", text: $name)
                        TextField("Rolle / firma", text: $role)
                    }
                    if let errorText {
                        Section { Label(errorText, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) }
                    }
                }
            }
            .navigationTitle("Din mening")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(done ? "Lukk" : "Avbryt") { dismiss() }
                }
                if !done {
                    ToolbarItem(placement: .confirmationAction) {
                        Button {
                            Task { await send() }
                        } label: {
                            if submitting { ProgressView() } else { Text("Send").fontWeight(.semibold) }
                        }
                        .disabled(!canSend || submitting)
                    }
                }
            }
            .onAppear {
                if name.isEmpty { name = prefillName }
                if role.isEmpty { role = prefillOrg }
            }
        }
    }

    private func send() async {
        submitting = true
        errorText = nil
        do {
            try await api.submitLeadgridTestimonial(.init(
                quote: quote.trimmingCharacters(in: .whitespacesAndNewlines),
                rating: rating,
                name: name.trimmingCharacters(in: .whitespaces),
                role: role.trimmingCharacters(in: .whitespaces),
                submitterOrg: prefillOrg
            ))
            done = true
        } catch {
            errorText = "Kunne ikke sende akkurat nå. Prøv igjen litt senere."
        }
        submitting = false
    }
}
