// VisionDemoView.swift
//
// Deterministisk demo (--demo-ai --demo-vision) som auto-kjører den on-device
// tekst-gjenkjenningen (VisionImageTools.recognizeText) på et generert «model
// release»-bilde — så Vision-motoren kan vises uten å plukke bilde manuelt.

import SwiftUI
import UIKit

@available(iOS 18, *)
struct VisionDemoView: View {
    @State private var source: UIImage?
    @State private var lines: [String] = []
    @State private var running = true

    var body: some View {
        NavigationStack {
            Form {
                Section("Kilde (generert «model release»)") {
                    if let source {
                        Image(uiImage: source)
                            .resizable().scaledToFit()
                            .frame(maxHeight: 220).frame(maxWidth: .infinity)
                            .listRowBackground(CHTheme.surface)
                    }
                }
                Section("Gjenkjent tekst — på enheten") {
                    if running {
                        HStack(spacing: 6) { ProgressView(); Text("Leser…").foregroundStyle(CHTheme.textMuted) }
                            .listRowBackground(CHTheme.surface)
                    }
                    ForEach(lines, id: \.self) { line in
                        Text(line).font(.callout).foregroundStyle(CHTheme.textPrimary)
                            .listRowBackground(CHTheme.surface)
                    }
                    if !lines.isEmpty {
                        Button {
                            UIPasteboard.general.string = lines.joined(separator: "\n")
                        } label: { Label("Kopier all tekst", systemImage: "doc.on.doc") }
                        .listRowBackground(CHTheme.surface)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(CHTheme.bg.ignoresSafeArea())
            .navigationTitle("Vision — tekst-scan")
            .navigationBarTitleDisplayMode(.inline)
        }
        .chBranded()
        .task { await run() }
    }

    private func run() async {
        let image = Self.renderSample()
        source = image
        if let cg = image.cgImage {
            lines = await VisionImageTools.recognizeText(in: cg)
        }
        running = false
    }

    private static func renderSample() -> UIImage {
        let size = CGSize(width: 820, height: 520)
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
            let text = """
            MODELLKONTRAKT

            Navn: Kari Nordmann
            Prosjekt: Nordic Skin høst 2026
            Dato: 08.08.2026
            E-post: kari@nordicskin.no

            Signatur: ______________
            """
            let attrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 34, weight: .medium),
                .foregroundColor: UIColor.black
            ]
            text.draw(in: CGRect(x: 40, y: 36, width: 740, height: 448), withAttributes: attrs)
        }
    }
}
