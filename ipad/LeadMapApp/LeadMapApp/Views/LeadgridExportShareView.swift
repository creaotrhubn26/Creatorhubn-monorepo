// LeadgridExportShareView.swift
//
// Eksport-flyt på iPad: velg periode + status-filter, last ned CSV/PDF,
// vis iOS Share-sheet for AirDrop/Mail/Files.

import SwiftUI
import UIKit

struct LeadgridExportShareView: View {
    let api: APIClient
    @Environment(\.dismiss) private var dismiss

    @State private var period: String = "30d"
    @State private var status: String = "all"
    @State private var generating = false
    @State private var fileURL: URL?
    @State private var errorText: String?
    @State private var showShare = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Periode") {
                    Picker("Periode", selection: $period) {
                        Text("7 dager").tag("7d")
                        Text("30 dager").tag("30d")
                        Text("90 dager").tag("90d")
                        Text("Alle").tag("all")
                    }
                    .pickerStyle(.segmented)
                }
                Section("Status-filter") {
                    Picker("Status", selection: $status) {
                        Text("Alle").tag("all")
                        Text("Aktive (ekskl. arkivert)").tag("active")
                        Text("I pipeline").tag("in_pipeline")
                        Text("Kun vunnet 🎉").tag("won")
                        Text("Kun tapt").tag("lost")
                    }
                }

                Section {
                    Button {
                        Task { await generate() }
                    } label: {
                        HStack {
                            if generating { ProgressView() }
                            else { Label("Last ned CSV", systemImage: "square.and.arrow.down") }
                            Spacer()
                        }
                    }
                    .disabled(generating)
                }

                if let errorText {
                    Section { Text(errorText).foregroundStyle(.red) }
                }
            }
            .navigationTitle("Eksporter leads")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                }
            }
            .sheet(isPresented: $showShare) {
                if let url = fileURL {
                    ShareSheet(items: [url])
                }
            }
        }
    }

    private func generate() async {
        generating = true
        errorText = nil
        defer { generating = false }
        do {
            let data = try await api.exportLeadsCsv(period: period, status: status)
            let tmpURL = FileManager.default.temporaryDirectory
                .appendingPathComponent("leads-\(period)-\(Date().timeIntervalSince1970).csv")
            try data.write(to: tmpURL)
            await MainActor.run {
                fileURL = tmpURL
                showShare = true
            }
        } catch {
            await MainActor.run {
                errorText = "Eksport feilet: \(error.localizedDescription)"
            }
        }
    }
}

/// UIKit-wrapper for iOS Share-sheet (UIActivityViewController).
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
