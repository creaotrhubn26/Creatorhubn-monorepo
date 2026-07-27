// VisionToolsView.swift
//
// Dedikert UI for de gratis on-device Vision-verktøyene (iOS 18+):
//   - Skann tekst (model releases, skilt, kontrakter) → kopierbar tekst
//   - Klipp ut motiv (transparent bakgrunn) → del/lagre
//
// Motorene bor i Core/Culling/VisionImageTools.swift.

import SwiftUI
import PhotosUI
import UIKit

@available(iOS 18, *)
struct VisionToolsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var item: PhotosPickerItem?
    @State private var sourceImage: UIImage?
    @State private var recognizedText: [String] = []
    @State private var cutout: UIImage?
    @State private var running = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    PhotosPicker(selection: $item, matching: .images) {
                        Label(sourceImage == nil ? "Velg bilde" : "Bytt bilde", systemImage: "photo.badge.plus")
                    }
                    .listRowBackground(CHTheme.surface)
                    if let sourceImage {
                        Image(uiImage: sourceImage)
                            .resizable().scaledToFit()
                            .frame(maxHeight: 180)
                            .frame(maxWidth: .infinity)
                            .listRowBackground(CHTheme.surface)
                    }
                    if running {
                        HStack(spacing: 6) {
                            ProgressView()
                            Text("Analyserer på enheten…").font(.caption).foregroundStyle(CHTheme.textMuted)
                        }
                        .listRowBackground(CHTheme.surface)
                    }
                }

                if !recognizedText.isEmpty {
                    Section("Gjenkjent tekst") {
                        ForEach(recognizedText, id: \.self) { line in
                            Text(line).font(.callout).foregroundStyle(CHTheme.textPrimary)
                        }
                        .listRowBackground(CHTheme.surface)
                        Button {
                            UIPasteboard.general.string = recognizedText.joined(separator: "\n")
                        } label: {
                            Label("Kopier all tekst", systemImage: "doc.on.doc")
                        }
                        .listRowBackground(CHTheme.surface)
                    }
                }

                if let cutout {
                    Section("Motiv-utklipp") {
                        Image(uiImage: cutout)
                            .resizable().scaledToFit()
                            .frame(maxHeight: 180)
                            .frame(maxWidth: .infinity)
                            .listRowBackground(CHTheme.surface)
                        ShareLink(item: Image(uiImage: cutout), preview: SharePreview("Motiv-utklipp", image: Image(uiImage: cutout))) {
                            Label("Del utklipp", systemImage: "square.and.arrow.up")
                        }
                        .listRowBackground(CHTheme.surface)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Vision-verktøy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { Button("Ferdig") { dismiss() } }
            }
            .onChange(of: item) { _, newItem in process(newItem) }
        }
        .chBranded()
    }

    private func process(_ item: PhotosPickerItem?) {
        guard let item else { return }
        recognizedText = []
        cutout = nil
        running = true
        Task {
            guard let data = try? await item.loadTransferable(type: Data.self),
                  let ui = UIImage(data: data),
                  let cg = ui.cgImage else {
                running = false
                return
            }
            sourceImage = ui
            let text = await VisionImageTools.recognizeText(in: cg)
            let cut = await VisionImageTools.subjectCutout(from: cg)
            recognizedText = text
            if let cutCg = cut { cutout = UIImage(cgImage: cutCg) }
            running = false
        }
    }
}
