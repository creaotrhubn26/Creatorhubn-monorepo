// BusinessCardScannerView.swift
//
// VisionKit DataScannerViewController — skanner visittkort med on-
// device OCR + NSDataDetector for å trekke ut telefon/e-post/web/
// navn. Brukeren bekrefter feltene før vi POSTer som lead.
//
// Krav: iOS 16+, iPad Pro 2018+ med Neural Engine.
// Mac Catalyst støtter IKKE DataScannerViewController — vi eksponerer
// en stubb-variant som gir en «Ikke tilgjengelig på Mac»-melding i
// samme signatur, slik at call-sitene ikke må gates individuelt.
// `ExtractedBusinessCard`-modellen holdes alltid tilgjengelig så
// APIClient.createLeadFromCard fungerer på alle plattformer.

import SwiftUI
import Foundation

// MARK: - Modell (tilgjengelig på alle plattformer)

struct ExtractedBusinessCard: Sendable {
    var name: String = ""
    var title: String = ""
    var company: String = ""
    var email: String = ""
    var phone: String = ""
    var website: String = ""
    var raw: String = ""

    /// Parser tekst-blokken som DataScanner ga oss ved hjelp av
    /// NSDataDetector + heuristikker.
    static func parse(_ text: String) -> ExtractedBusinessCard {
        var card = ExtractedBusinessCard()
        card.raw = text

        if let emailDetector = try? NSDataDetector(
            types: NSTextCheckingResult.CheckingType.link.rawValue,
        ) {
            let matches = emailDetector.matches(
                in: text,
                range: NSRange(text.startIndex..., in: text),
            )
            for m in matches {
                guard let url = m.url else { continue }
                if url.scheme == "mailto" {
                    card.email = url.absoluteString.replacingOccurrences(of: "mailto:", with: "")
                } else if card.website.isEmpty {
                    card.website = url.absoluteString
                }
            }
        }

        if let phoneDetector = try? NSDataDetector(
            types: NSTextCheckingResult.CheckingType.phoneNumber.rawValue,
        ) {
            let matches = phoneDetector.matches(
                in: text,
                range: NSRange(text.startIndex..., in: text),
            )
            if let m = matches.first {
                card.phone = m.phoneNumber ?? ""
            }
        }

        let lines = text.split(separator: "\n").map { String($0).trimmingCharacters(in: .whitespaces) }
        for line in lines {
            if card.name.isEmpty {
                let words = line.split(separator: " ").map { String($0) }
                if words.count >= 2 && words.count <= 4
                   && !line.contains(where: \.isNumber)
                   && !line.contains("@") {
                    card.name = line
                    continue
                }
            }
            if card.title.isEmpty && line != card.name
               && !line.contains("@") && !line.contains(where: \.isNumber) {
                card.title = line
            }
        }

        return card
    }
}

#if !targetEnvironment(macCatalyst)

import VisionKit
import Vision

@available(iOS 16.0, *)
struct BusinessCardScannerView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var state
    @StateObject private var coordinator = ScannerCoordinator()
    @State private var saving = false
    @State private var error: String?
    @State private var idempotencyKey = UUID()
    /// «Fant: X AS (org.nr …)» fra BRREG-koblingen — vises et øyeblikk
    /// etter lagring så selgeren ser at leaden ble beriket.
    @State private var brregMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                    if coordinator.extracted == nil {
                        scannerView
                    } else {
                        confirmView
                    }
                } else {
                    unsupportedView
                }
            }
            .navigationTitle("Skann visittkort")
        .salesHierarchyBackdrop(.promotor)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Avbryt") { dismiss() }
                }
            }
        }
    }

    private var scannerView: some View {
        ZStack(alignment: .bottom) {
            DataScannerRepresentable(coordinator: coordinator)
            VStack(spacing: 8) {
                Text("Pek kameraet mot et visittkort")
                    .font(.headline)
                    .padding()
                    .background(.ultraThinMaterial, in: Capsule())
                if !coordinator.lastObservedText.isEmpty {
                    Text("Leser: \(coordinator.lastObservedText.prefix(60))…")
                        .font(.caption)
                        .foregroundStyle(.white)
                        .padding(8)
                        .background(Color.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 8))
                }
            }
            .padding(.bottom, 40)
        }
    }

    @ViewBuilder
    private var confirmView: some View {
        if let extracted = coordinator.extracted {
            Form {
                Section("Funnet på visittkortet") {
                    TextField("Navn / bedrift", text: Binding(
                        get: { extracted.name },
                        set: { coordinator.update(\.name, to: $0) }
                    ))
                    TextField("Tittel", text: Binding(
                        get: { extracted.title },
                        set: { coordinator.update(\.title, to: $0) }
                    ))
                    TextField("E-post", text: Binding(
                        get: { extracted.email },
                        set: { coordinator.update(\.email, to: $0) }
                    ))
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    TextField("Telefon", text: Binding(
                        get: { extracted.phone },
                        set: { coordinator.update(\.phone, to: $0) }
                    ))
                    .keyboardType(.phonePad)
                    TextField("Nettside", text: Binding(
                        get: { extracted.website },
                        set: { coordinator.update(\.website, to: $0) }
                    ))
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                }
                if let brregMsg = brregMessage {
                    Label(brregMsg, systemImage: "checkmark.seal.fill")
                        .font(.caption)
                        .foregroundStyle(.green)
                        .multilineTextAlignment(.leading)
                        .padding(.horizontal)
                }
                if let err = error {
                    Text(err).foregroundStyle(.red).font(.caption)
                }
                Section {
                    Button {
                        Task { await save() }
                    } label: {
                        HStack {
                            if saving { ProgressView() }
                            Text(saving ? "Lagrer…" : "Lagre som lead")
                                .fontWeight(.bold)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .disabled(saving || extracted.name.isEmpty)
                    Button("Skann på nytt") {
                        coordinator.reset()
                        error = nil
                    }
                }
            }
        }
    }

    private var unsupportedView: some View {
        VStack(spacing: 12) {
            Image(systemName: "camera.metering.unknown")
                .font(.appScaled(size: 56))
                .foregroundStyle(.secondary)
            Text("Skanning ikke støttet")
                .font(.headline)
            Text("Visittkort-scanner krever iPadOS 16+ og en iPad Pro/Air med Neural Engine (2018 eller nyere).")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
    }

    @MainActor
    private func save() async {
        guard let api = state.api, let extracted = coordinator.extracted else { return }
        saving = true; error = nil
        defer { saving = false }
        do {
            let response = try await api.createLeadFromCard(
                extracted: extracted,
                organizationId: state.activeOrganizationId,
                idempotencyKey: idempotencyKey
            )
            // Refresh workload for å vise nylig opprettet
            await state.refreshAll()
            if let brreg = response.brreg {
                brregMessage = brreg.status == "linked"
                    ? "Fant i Brønnøysund: \(brreg.matchedName ?? "ukjent navn") (org.nr \(brreg.orgNr)) — leaden berikes automatisk."
                    : "BRREG-forslag: \(brreg.matchedName ?? "?") (org.nr \(brreg.orgNr)) — bekreft i lead-kortet."
                // La selgeren rekke å lese koblingen før arket lukkes.
                try? await Task.sleep(nanoseconds: 2_200_000_000)
            }
            dismiss()
        } catch {
            self.error = "Lagring feilet: \(error.localizedDescription)"
        }
    }
}

// MARK: - Coordinator

@available(iOS 16.0, *)
@MainActor
final class ScannerCoordinator: NSObject, ObservableObject {
    @Published var lastObservedText: String = ""
    @Published var extracted: ExtractedBusinessCard?

    func handleScan(_ items: [RecognizedItem]) {
        // Aggreger all tekst fra siste batch
        let lines: [String] = items.compactMap { item in
            if case .text(let txt) = item { return txt.transcript }
            return nil
        }
        let combined = lines.joined(separator: "\n")
        if combined.isEmpty { return }
        lastObservedText = combined
        // Trekk ut med regex + NSDataDetector
        extracted = ExtractedBusinessCard.parse(combined)
    }

    func update<T>(_ keyPath: WritableKeyPath<ExtractedBusinessCard, T>, to value: T) {
        guard var current = extracted else { return }
        current[keyPath: keyPath] = value
        extracted = current
    }

    func reset() {
        extracted = nil
        lastObservedText = ""
    }
}

// MARK: - UIViewControllerRepresentable

@available(iOS 16.0, *)
struct DataScannerRepresentable: UIViewControllerRepresentable {
    let coordinator: ScannerCoordinator

    func makeCoordinator() -> Bridge { Bridge(parent: self) }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let vc = DataScannerViewController(
            recognizedDataTypes: [.text()],
            qualityLevel: .accurate,
            recognizesMultipleItems: true,
            isHighFrameRateTrackingEnabled: true,
            isHighlightingEnabled: true,
        )
        vc.delegate = context.coordinator
        Task { @MainActor in
            try? vc.startScanning()
        }
        return vc
    }

    func updateUIViewController(_ uiViewController: DataScannerViewController, context: Context) {}

    final class Bridge: NSObject, DataScannerViewControllerDelegate {
        let parent: DataScannerRepresentable
        init(parent: DataScannerRepresentable) { self.parent = parent }

        func dataScanner(
            _ dataScanner: DataScannerViewController,
            didUpdate updatedItems: [RecognizedItem],
            allItems: [RecognizedItem],
        ) {
            // Throttle: kun process når vi har 3+ tekst-elementer
            // (typisk for visittkort: navn/tittel/kontakt)
            if allItems.count >= 3 {
                Task { @MainActor in
                    self.parent.coordinator.handleScan(allItems)
                }
            }
        }
    }
}

#else  // macCatalyst — DataScanner ikke tilgjengelig; vis fallback-melding.

import SwiftUI

@available(iOS 16.0, *)
struct BusinessCardScannerView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ContentUnavailableView(
                "Ikke tilgjengelig på Mac",
                systemImage: "camera.fill",
                description: Text("Visittkort-skanning krever iPhone eller iPad-kamera. Åpne appen på en mobil enhet.")
            )
            .navigationTitle("Skann visittkort")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                }
            }
        }
    }
}

#endif  // targetEnvironment
