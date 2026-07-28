// MessagesDemoView.swift
//
// Demo-rute (--demo-messages) som viser auto-huk-teamoppdateringen slik den
// ser ut INNE i Meldinger-tråden — for markedsføring/skjermbilder i sim.
//
// Skriptet fortelling (ingen tap nødvendig → rent skjermopptak):
//   1. To kontekst-bobler (teamet prater).
//   2. Ole sitt shot-oppdaterings-kort glir inn: thumbnails, avhukede scener,
//      «Neste», og backup-status.
//   3. Auto-sikkerhetskopi klatrer 18% → 100% → «Sikret» ✓.
//   4. Galleriet («Se bildene») åpnes automatisk og blar gjennom bildene.
//   5. Ole tar FLERE bilder → SAMME kort oppdateres live: antall øker,
//      nye thumbnails glir inn, og backup kjører på nytt for de nye.

import SwiftUI

struct MessagesDemoView: View {
    @State private var backup: Double = 0.18
    @State private var showCard = false
    @State private var showGallery = false

    // Ekte flat-lay-foto (Unsplash-CDN) med komponert scene som placeholder
    // mens de laster — så videoen aldri viser en tom rute.
    private static func u(_ id: String) -> String {
        "https://images.unsplash.com/photo-\(id)?w=600&q=70&auto=format&fit=crop"
    }

    // Starter med 3 bilder; 2 kommer inn live underveis.
    @State private var thumbs: [ShotThumb] = [
        ShotThumb(imageURL: u("1598440947619-2c35fc9aa908"), scene: .lifestyle, caption: "Oppstilling"),
        ShotThumb(imageURL: u("1616750819456-5cdee9b85d22"), scene: .texture, caption: "Tekstur"),
        ShotThumb(imageURL: u("1629380108599-ea06489d66f5"), scene: .packaging, caption: "Kurv")
    ]
    @State private var scenes: [String] = [
        "Flatlay — full oppstilling", "Teksturbilde — krem", "Flatlay — kurv & ingredienser"
    ]
    @State private var next: [String] = ["Emballasje — hero"]

    private var info: ShotUpdateInfo {
        ShotUpdateInfo(who: "Ole", scenes: scenes, next: next)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                CHTheme.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        leftBubble(sender: "Kari", "Rekker vi flatlay-ene før lunsj?")
                        rightBubble("Ja! Ole er på studio A nå 📸")
                        if showCard {
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Ole")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundStyle(CHTheme.textMuted)
                                    ShotUpdateCard(info: info, thumbs: thumbs, backupProgress: backup)
                                    Text("oppdateres live · nå")
                                        .font(.caption2)
                                        .foregroundStyle(CHTheme.textMuted)
                                }
                                Spacer(minLength: 32)
                            }
                            .transition(.move(edge: .bottom).combined(with: .opacity))
                        }
                        Spacer(minLength: 40)
                    }
                    .padding(18)
                }
            }
            .navigationTitle("Nordic Skin — team")
            .navigationBarTitleDisplayMode(.inline)
        }
        .preferredColorScheme(.dark)
        .tint(CHTheme.accent)
        .fullScreenCover(isPresented: $showGallery) {
            ShotGalleryView(thumbs: thumbs, startIndex: 0)
        }
        .task { await runStory() }
    }

    // MARK: - Fortelling

    @MainActor
    private func runStory() async {
        try? await pause(0.9)
        withAnimation(.spring(response: 0.5, dampingFraction: 0.82)) { showCard = true }
        try? await pause(1.1)
        await climbBackup([0.45, 0.72, 0.9, 1.0])
        try? await pause(1.3)
        // Se bildene → galleri
        showGallery = true
        try? await pause(3.4)
        showGallery = false
        try? await pause(1.1)
        // Ole tar FLERE bilder — samme kort oppdateres live.
        await addShot(
            ShotThumb(imageURL: Self.u("1585652757141-8837d676fac8"), scene: .packaging, caption: "Serum"),
            scene: "Flatlay — serum-duo")
        try? await pause(0.9)
        await addShot(
            ShotThumb(imageURL: Self.u("1613803745799-ba6c10aace85"), scene: .texture, caption: "Detalj"),
            scene: "Detalj — pipette & krem")
        try? await pause(2.0)
    }

    /// Nytt bilde tatt → append thumbnail + scene, og kjør backup på nytt for
    /// det nye bildet (dropp til «laster», klatre til «Sikret»).
    @MainActor
    private func addShot(_ thumb: ShotThumb, scene: String) async {
        withAnimation(.spring(response: 0.45, dampingFraction: 0.8)) {
            thumbs.append(thumb)
            scenes.append(scene)
        }
        withAnimation(.easeInOut(duration: 0.3)) { backup = 0.34 }
        await climbBackup([0.62, 0.85, 1.0], step: 0.7)
    }

    private func climbBackup(_ values: [Double], step: Double = 0.85) async {
        for v in values {
            withAnimation(.easeInOut(duration: 0.5)) { backup = v }
            try? await pause(step)
        }
    }

    private func pause(_ seconds: Double) async throws {
        try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }

    // MARK: - Bobler

    private func leftBubble(sender: String, _ text: String) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(sender)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(CHTheme.textMuted)
                Text(text)
                    .font(.body)
                    .foregroundStyle(CHTheme.textPrimary)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(CHTheme.surfaceElevated, in: RoundedRectangle(cornerRadius: 16))
            }
            Spacer(minLength: 48)
        }
    }

    private func rightBubble(_ text: String) -> some View {
        HStack {
            Spacer(minLength: 48)
            Text(text)
                .font(.body)
                .foregroundStyle(CHTheme.bg)
                .padding(.horizontal, 14).padding(.vertical, 9)
                .background(CHTheme.accent, in: RoundedRectangle(cornerRadius: 16))
        }
    }
}
