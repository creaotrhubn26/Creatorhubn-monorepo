// ShotUpdateCard.swift
//
// Pent, strukturert kort for auto-huk-teamoppdateringer i Meldinger-tråden.
// Erstatter den rå «📸 Ole tok: … · Neste: …»-teksten med et designet kort:
//   • Hvem + antall bilder (grønn kamera-ikon)
//   • Thumbnail-rad av de tatte bildene + «Se bildene» → fullskjerm-galleri
//   • Avhukede scener (grønne checkmarks)
//   • «Neste på lista»-pille
//
// Parseren er bakoverkompatibel: matcher ikke teksten, faller MessageBubble
// tilbake til en vanlig boble.

import SwiftUI

// MARK: - Parser

/// Strukturen bak en «📸 {navn} tok: {scener}[ · Neste: {…}]»-melding.
struct ShotUpdateInfo: Equatable {
    let who: String
    let scenes: [String]
    let next: [String]

    static func parse(_ text: String) -> ShotUpdateInfo? {
        guard text.hasPrefix("📸 ") else { return nil }
        var body = String(text.dropFirst(2)).trimmingCharacters(in: .whitespaces)
        var nextPart = ""
        if let r = body.range(of: " · Neste: ") {
            nextPart = String(body[r.upperBound...])
            body = String(body[..<r.lowerBound])
        }
        guard let tokR = body.range(of: " tok: ") else { return nil }
        let who = String(body[..<tokR.lowerBound]).trimmingCharacters(in: .whitespaces)
        let scenes = splitList(String(body[tokR.upperBound...]))
        let next = splitList(nextPart)
        guard !who.isEmpty, !scenes.isEmpty else { return nil }
        return ShotUpdateInfo(who: who, scenes: scenes, next: next)
    }

    private static func splitList(_ s: String) -> [String] {
        s.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }
}

// MARK: - Thumbnail-modell

/// Én thumbnail i kortet. Ekte meldinger sender `imageURL` (attachment);
/// demoen bruker `gradient` for pene plassholdere uten nettverk.
struct ShotThumb: Identifiable, Equatable {
    let id = UUID()
    var imageURL: String?
    /// Komponert placeholder-scene mens et ekte `imageURL` laster (eller når
    /// ingen URL finnes). Se [MockPhotoView].
    var scene: MockScene?
    var gradient: [Color] = []
    var caption: String = ""
}

// MARK: - Kortet

struct ShotUpdateCard: View {
    let info: ShotUpdateInfo
    var thumbs: [ShotThumb] = []
    var fromMe: Bool = false
    /// Auto-sikkerhetskopi til skyen: 0…1. 1.0 = ferdig (viser checkmark).
    var backupProgress: Double = 1.0

    @State private var galleryStart: Indexed?

    private var countLabel: String {
        let n = max(info.scenes.count, thumbs.count)
        return "\(n) \(n == 1 ? "bilde" : "bilder")"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            header
            if !thumbs.isEmpty { thumbnailRow }
            sceneList
            if !info.next.isEmpty { nextPill }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(CHTheme.surfaceElevated)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(CHTheme.success.opacity(0.30), lineWidth: 1)
        )
        .frame(maxWidth: 320, alignment: .leading)
        .fullScreenCover(item: $galleryStart) { start in
            ShotGalleryView(thumbs: thumbs, startIndex: start.value)
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            ZStack {
                Circle().fill(
                    LinearGradient(colors: [CHTheme.success, CHTheme.success.opacity(0.7)],
                                   startPoint: .topLeading, endPoint: .bottomTrailing))
                Image(systemName: "camera.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text("\(info.who) tok \(countLabel)")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(CHTheme.textPrimary)
                Text("Auto-huket på shot-listen")
                    .font(.caption2)
                    .foregroundStyle(CHTheme.textMuted)
            }
            Spacer(minLength: 8)
            BackupBadge(progress: backupProgress)
        }
    }

    private var thumbnailRow: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                ForEach(Array(thumbs.prefix(4).enumerated()), id: \.element.id) { idx, thumb in
                    Button { galleryStart = Indexed(idx) } label: {
                        ShotThumbView(thumb: thumb)
                            .frame(width: 62, height: 62)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(CHTheme.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                Spacer(minLength: 0)
            }
            Button { galleryStart = Indexed(0) } label: {
                HStack(spacing: 6) {
                    Image(systemName: "photo.on.rectangle.angled")
                    Text(thumbs.count > 4 ? "Se alle \(thumbs.count) bilder" : "Se bildene")
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.right").font(.caption2)
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(CHTheme.accent)
                .padding(.horizontal, 12).padding(.vertical, 9)
                .frame(maxWidth: .infinity)
                .background(CHTheme.accent.opacity(0.12),
                            in: RoundedRectangle(cornerRadius: 11, style: .continuous))
            }
            .buttonStyle(.plain)
        }
    }

    private var sceneList: some View {
        VStack(alignment: .leading, spacing: 7) {
            ForEach(info.scenes, id: \.self) { scene in
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.footnote)
                        .foregroundStyle(CHTheme.success)
                    Text(scene)
                        .font(.footnote)
                        .foregroundStyle(CHTheme.textSecondary)
                    Spacer(minLength: 0)
                }
            }
        }
    }

    private var nextPill: some View {
        HStack(spacing: 6) {
            Image(systemName: "arrow.forward.circle.fill")
                .foregroundStyle(CHTheme.accent)
            Text("Neste: \(info.next.joined(separator: ", "))")
                .foregroundStyle(CHTheme.textSecondary)
                .lineLimit(1)
        }
        .font(.caption.weight(.semibold))
        .padding(.horizontal, 11).padding(.vertical, 7)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CHTheme.accent.opacity(0.10),
                    in: RoundedRectangle(cornerRadius: 11, style: .continuous))
    }
}

// MARK: - Backup-merke (auto-sikkerhetskopi % → checkmark)

/// Viser fremdrift på auto-sikkerhetskopi av de tatte bildene. Under 100%:
/// en liten ring + prosent. Ved 100%: sky-checkmark + «Sikret».
struct BackupBadge: View {
    let progress: Double

    var body: some View {
        if progress >= 1 {
            HStack(spacing: 5) {
                Image(systemName: "checkmark.icloud.fill")
                    .font(.caption)
                    .foregroundStyle(CHTheme.success)
                Text("Sikret")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(CHTheme.textMuted)
            }
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background(CHTheme.success.opacity(0.12), in: Capsule())
        } else {
            HStack(spacing: 6) {
                ZStack {
                    Circle().stroke(CHTheme.border, lineWidth: 3)
                    Circle().trim(from: 0, to: max(progress, 0.02))
                        .stroke(CHTheme.accent, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                }
                .frame(width: 16, height: 16)
                Text("\(Int(progress * 100))%")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(CHTheme.accentSoft)
                    .monospacedDigit()
            }
            .padding(.horizontal, 8).padding(.vertical, 5)
            .background(CHTheme.surface, in: Capsule())
        }
    }
}

/// Wrapper så `.fullScreenCover(item:)` (krever Identifiable) kan bruke en Int.
private struct Indexed: Identifiable { let value: Int; var id: Int { value }
    init(_ v: Int) { value = v } }

// MARK: - Thumbnail-visning (ekte bilde eller demo-gradient)

struct ShotThumbView: View {
    let thumb: ShotThumb

    var body: some View {
        base
            .overlay(alignment: .bottomLeading) {
                if !thumb.caption.isEmpty {
                    Text(thumb.caption)
                        .font(.system(size: 8.5, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5).padding(.vertical, 2)
                        .background(.black.opacity(0.38), in: Capsule())
                        .padding(4)
                }
            }
    }

    /// Ekte bilde (AsyncImage) → mens det laster, komponert scene → ellers gradient.
    @ViewBuilder
    private var base: some View {
        if let url = thumb.imageURL, let u = URL(string: url) {
            AsyncImage(url: u) { phase in
                if let image = phase.image {
                    image.resizable().scaledToFill()
                } else {
                    placeholder
                }
            }
        } else {
            placeholder
        }
    }

    @ViewBuilder
    private var placeholder: some View {
        if let scene = thumb.scene {
            MockPhotoView(scene: scene)
        } else {
            let colors = thumb.gradient.isEmpty
                ? [CHTheme.surface, CHTheme.surfaceElevated] : thumb.gradient
            LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }
}

// MARK: - Fullskjerm-galleri («Se bildene»)

struct ShotGalleryView: View {
    let thumbs: [ShotThumb]
    let startIndex: Int
    @Environment(\.dismiss) private var dismiss
    @State private var selection: Int = 0

    var body: some View {
        NavigationStack {
            ZStack {
                CHTheme.bgDeep.ignoresSafeArea()
                TabView(selection: $selection) {
                    ForEach(Array(thumbs.enumerated()), id: \.element.id) { idx, thumb in
                        VStack(spacing: 16) {
                            ShotThumbView(thumb: thumb)
                                .aspectRatio(3.0 / 4.0, contentMode: .fit)
                                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                                .padding(.horizontal, 24)
                            if !thumb.caption.isEmpty {
                                Text(thumb.caption)
                                    .font(.headline)
                                    .foregroundStyle(CHTheme.textPrimary)
                            }
                        }
                        .tag(idx)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .always))
            }
            .navigationTitle("\(selection + 1) av \(thumbs.count)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lukk") { dismiss() }
                }
            }
        }
        .onAppear { selection = min(max(startIndex, 0), max(thumbs.count - 1, 0)) }
    }
}
