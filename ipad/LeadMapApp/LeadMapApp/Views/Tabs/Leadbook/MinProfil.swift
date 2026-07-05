// MinProfil.swift — Profil-modal for Lars Kristensen (LK) (2026-06-30)

import SwiftUI

struct MinProfilSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var toast: String?
    /// Focal point: 0 = center, ±0.6 = edge (generøst for portrett-i-landscape).
    @State private var focalOffset: CGSize = .zero
    @State private var focalScale: CGFloat = 1.0
    @State private var showFocalEditor = false
    @State private var didAutoDetectFace = false

    /// «daniel@…» → «portrait-daniel». Faller tilbake til `portrait-lars`
    /// hvis brukerens asset ikke er lagt til enda (bevarer visuelt før
    /// per-bruker-portraits leveres av backend).
    private var portraitAsset: String {
        guard let email = appState.userEmail,
              let local = email.split(separator: "@").first else {
            return "portrait-lars"
        }
        let candidate = "portrait-\(local.lowercased())"
        return UIImage(named: candidate) != nil ? candidate : "portrait-lars"
    }

    /// Cache av utledet e-post + telefon for hero-linjen. Telefon
    /// hardkodes inntil backend eksponerer et profilfelt.
    private var heroContact: String {
        let email = appState.userEmail ?? "ukjent@leadgrid.no"
        return "\(email) · +47 41 23 45 67"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        hero
                        kpiRow
                        infoCard
                        achievementsCard
                        actionsRow
                        Color.clear.frame(height: 20)
                    }
                    .padding(20)
                }
                if let t = toast {
                    VStack {
                        Spacer().frame(height: 60)
                        Label(t, systemImage: "checkmark.circle.fill")
                            .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                            .padding(.horizontal, 12).padding(.vertical, 8)
                            .background(LBrand.green, in: Capsule())
                        Spacer()
                    }
                }
            }
            .navigationTitle("Min profil")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { autoDetectFaceIfNeeded() }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Menu {
                        Button {} label: { Label("Endre passord", systemImage: "key.fill") }
                        Button {} label: { Label("Notifikasjoner", systemImage: "bell.fill") }
                        Button {} label: { Label("Personvern", systemImage: "lock.shield.fill") }
                        Divider()
                        Button(role: .destructive) {} label: { Label("Logg ut", systemImage: "rectangle.portrait.and.arrow.right") }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.appScaled(size: 16, weight: .semibold))
                            .foregroundStyle(LBrand.purpleLight)
                    }
                }
            }
        }
        .macCatalystSheetSize(minWidth: 900, minHeight: 720)
    }

    /// Kjør Vision-ansiktsdetektor hvis brukeren ikke har overstyrt focal point.
    /// Setter focalOffset slik at ansiktet havner i øvre tredjedel av heroen.
    private func autoDetectFaceIfNeeded() {
        guard !didAutoDetectFace, focalOffset == .zero, focalScale == 1.0 else { return }
        FaceDetector.detectFaceCenter(in: portraitAsset) { center in
            guard let center else { return }
            let suggested = FaceDetector.focalOffset(faceCenter: center)
            withAnimation(.easeInOut(duration: 0.6)) {
                focalOffset = suggested
                didAutoDetectFace = true
            }
            toast = "AI fant ansiktet — bildet er sentrert"
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { toast = nil }
        }
    }

    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            // Bilde av Lars i hero — m/ brukerstyrt focal point
            GeometryReader { geo in
                Image(portraitAsset)
                    .resizable()
                    .scaledToFill()
                    .scaleEffect(focalScale)
                    .offset(
                        x: focalOffset.width * geo.size.width,
                        y: focalOffset.height * geo.size.height
                    )
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped()
            }
            .frame(maxWidth: .infinity)
            .frame(height: 360)
            .clipped()
            LinearGradient(
                colors: [.clear, .black.opacity(0.75)],
                startPoint: .top, endPoint: .bottom
            )
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 7) {
                    HStack(spacing: 4) {
                        Circle().fill(LBrand.green).frame(width: 8, height: 8)
                        Text("ONLINE").font(.appScaled(size: 9, weight: .black))
                            .foregroundStyle(LBrand.green).tracking(0.8)
                    }
                    Text("·").foregroundStyle(LBrand.textTertiary)
                    Text("OSLO & AKERSHUS").font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(.white.opacity(0.7)).tracking(0.8)
                }
                Text(appState.displayName)
                    .font(.appScaled(size: 30, weight: .heavy))
                    .foregroundStyle(.white)
                HStack(spacing: 6) {
                    Image(systemName: "crown.fill").font(.appScaled(size: 11))
                        .foregroundStyle(LBrand.yellow)
                    Text("Salgssjef")
                        .font(.appScaled(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                    Text("·").foregroundStyle(LBrand.textTertiary)
                    Text("Leadgrid AS")
                        .font(.appScaled(size: 12))
                        .foregroundStyle(.white.opacity(0.7))
                }
                Text(heroContact)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(.white.opacity(0.6))
            }
            .padding(20)
            // Flytende «Juster bildet»-knapp øverst-høyre på heroen
            VStack {
                HStack {
                    Spacer()
                    Button { showFocalEditor = true } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "arrow.up.and.down.and.arrow.left.and.right")
                                .font(.appScaled(size: 11, weight: .bold))
                            Text("Juster bildet").font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(.black.opacity(0.55), in: Capsule())
                        .overlay(Capsule().stroke(.white.opacity(0.2), lineWidth: 1))
                    }.buttonStyle(.plain)
                }
                Spacer()
            }
            .padding(14)
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(LBrand.purple.opacity(0.3), lineWidth: 1))
        .sheet(isPresented: $showFocalEditor) {
            FocalPointEditorSheet(
                imageName: portraitAsset,
                offset: $focalOffset,
                scale: $focalScale
            )
        }
    }

    private var kpiRow: some View {
        HStack(spacing: 10) {
            kpiTile("Pondus", "82", LBrand.purpleLight, "circle.hexagongrid.fill")
            kpiTile("Pipeline", "12,3 mill", LBrand.green, "chart.line.uptrend.xyaxis")
            kpiTile("Møter denne mnd", "27", LBrand.blue, "calendar.badge.checkmark")
            kpiTile("Lukket Q2", "8,4 mill", LBrand.orange, "trophy.fill")
        }
    }

    private func kpiTile(_ label: String, _ value: String, _ tint: Color, _ icon: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.appScaled(size: 11, weight: .bold)).foregroundStyle(tint)
                Text(label.uppercased())
                    .font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            Text(value)
                .font(.appScaled(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    private var infoCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("INFO").font(.appScaled(size: 10, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
            VStack(spacing: 10) {
                infoRow(icon: "person.badge.shield.checkmark.fill", label: "Rolle", value: "Salgssjef · Full admin-tilgang", tint: LBrand.yellow)
                infoRow(icon: "map.fill", label: "Område", value: "Oslo & Akershus", tint: LBrand.green)
                infoRow(icon: "person.3.fill", label: "Team", value: "6 medlemmer", tint: LBrand.purpleLight)
                infoRow(icon: "calendar", label: "Hos Leadgrid siden", value: "Mars 2024", tint: LBrand.blue)
                infoRow(icon: "circle.hexagongrid.fill", label: "Pondus-score", value: "82 · Sterk pondus", tint: LBrand.purpleLight)
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private func infoRow(icon: String, label: String, value: String, tint: Color) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(tint.opacity(0.22))
                Image(systemName: icon).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(tint)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                Text(value).font(.appScaled(size: 13, weight: .semibold)).foregroundStyle(.white)
            }
            Spacer()
        }
    }

    private var achievementsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "rosette").foregroundStyle(LBrand.yellow)
                Text("ACHIEVEMENTS").font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                Spacer()
                Text("4 av 12")
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(LBrand.textTertiary)
            }
            HStack(spacing: 10) {
                badge(icon: "trophy.fill", title: "Q2 vinner", color: LBrand.yellow, earned: true)
                badge(icon: "flame.fill", title: "10 dager streak", color: LBrand.orange, earned: true)
                badge(icon: "star.fill", title: "Topp pondus", color: LBrand.purpleLight, earned: true)
                badge(icon: "checkmark.seal.fill", title: "Akademi 50%", color: LBrand.green, earned: false)
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private func badge(icon: String, title: String, color: Color, earned: Bool) -> some View {
        VStack(spacing: 6) {
            ZStack {
                Circle().fill(earned ? color.opacity(0.22) : LBrand.cardHi)
                Image(systemName: icon)
                    .font(.appScaled(size: 18, weight: .bold))
                    .foregroundStyle(earned ? color : LBrand.textTertiary)
            }
            .frame(width: 52, height: 52)
            Text(title)
                .font(.appScaled(size: 10, weight: .bold))
                .foregroundStyle(earned ? .white : LBrand.textTertiary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(LBrand.cardHi.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
        .opacity(earned ? 1 : 0.5)
    }

    private var actionsRow: some View {
        HStack(spacing: 10) {
            Button {
                toast = "Profil-redigering åpnet"
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { toast = nil }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "pencil").font(.appScaled(size: 12, weight: .bold))
                    Text("Rediger profil").font(.appScaled(size: 13, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(
                    LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 11)
                )
            }.buttonStyle(.plain)
            Button {
                toast = "Bilde-opplasting åpnet"
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { toast = nil }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "camera.fill").font(.appScaled(size: 12, weight: .bold))
                    Text("Bytt bilde").font(.appScaled(size: 13, weight: .bold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity).padding(.vertical, 12)
                .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.stroke, lineWidth: 1))
            }.buttonStyle(.plain)
        }
    }
}

// MARK: - FocalPointEditorSheet
// Lar brukeren posisjonere bildet i klippramen ved å dra og pinch-zoome.

struct FocalPointEditorSheet: View {
    let imageName: String
    @Binding var offset: CGSize
    @Binding var scale: CGFloat

    @Environment(\.dismiss) private var dismiss

    // Live drag/zoom state — kommitres til offset/scale ved Lagre
    @State private var draftOffset: CGSize = .zero
    @State private var draftScale: CGFloat = 1.0
    @GestureState private var dragDelta: CGSize = .zero
    @GestureState private var pinchDelta: CGFloat = 1.0

    // Aspect-rasjo for klippramen (samme som hero)
    private let cropAspect: CGFloat = 16.0 / 9.0  // 360pt høyt på iPad-bredde

    private var currentOffset: CGSize {
        CGSize(
            width: draftOffset.width + dragDelta.width,
            height: draftOffset.height + dragDelta.height
        )
    }
    private var currentScale: CGFloat { max(0.5, min(3.0, draftScale * pinchDelta)) }

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                VStack(spacing: 18) {
                    headerText
                    cropPreview
                    avatarPreview
                    controls
                    Spacer()
                }
                .padding(20)
            }
            .navigationTitle("Juster bildet")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        offset = currentOffset
                        scale = currentScale
                        dismiss()
                    } label: {
                        Text("Lagre").font(.appScaled(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(
                                LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                               startPoint: .leading, endPoint: .trailing),
                                in: RoundedRectangle(cornerRadius: 10)
                            )
                    }
                }
            }
            .onAppear {
                draftOffset = offset
                draftScale = scale
            }
        }
    }

    private var headerText: some View {
        VStack(spacing: 6) {
            Text("Dra for å flytte · klyp for å zoome")
                .font(.appScaled(size: 13, weight: .semibold))
                .foregroundStyle(.white)
            Text("Sørg for at ansiktet er innenfor klippramen i begge forhåndsvisninger.")
                .font(.appScaled(size: 11))
                .foregroundStyle(LBrand.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    /// Stor klippramme der brukeren drar
    private var cropPreview: some View {
        GeometryReader { geo in
            let cropW = geo.size.width
            let cropH = cropW / cropAspect
            ZStack {
                // Bildet
                Image(imageName)
                    .resizable()
                    .scaledToFill()
                    .scaleEffect(currentScale)
                    .offset(
                        x: currentOffset.width * cropW,
                        y: currentOffset.height * cropH
                    )
                    .frame(width: cropW, height: cropH)
                    .clipped()
                // Grid-linjer for tredjedels-regelen
                gridOverlay
                // Subtilt fadet hjørner
                RoundedRectangle(cornerRadius: 14)
                    .stroke(LBrand.purpleLight.opacity(0.7), lineWidth: 2)
            }
            .frame(width: cropW, height: cropH)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .position(x: cropW / 2, y: cropH / 2)
            .frame(width: cropW, height: cropH)
            .gesture(
                DragGesture()
                    .updating($dragDelta) { val, state, _ in
                        state = CGSize(
                            width: val.translation.width / cropW,
                            height: val.translation.height / cropH
                        )
                    }
                    .onEnded { val in
                        draftOffset.width  += val.translation.width / cropW
                        draftOffset.height += val.translation.height / cropH
                        clampOffset()
                    }
            )
            .simultaneousGesture(
                MagnificationGesture()
                    .updating($pinchDelta) { val, state, _ in state = val }
                    .onEnded { val in
                        draftScale = max(0.5, min(3.0, draftScale * val))
                        clampOffset()
                    }
            )
        }
        .aspectRatio(cropAspect, contentMode: .fit)
        .frame(maxWidth: .infinity)
    }

    /// Liten avatar-forhåndsvisning slik den vil se ut som rund profil-thumbnail
    private var avatarPreview: some View {
        HStack(spacing: 14) {
            VStack(spacing: 5) {
                ZStack {
                    Image(imageName)
                        .resizable()
                        .scaledToFill()
                        .scaleEffect(currentScale)
                        .offset(
                            x: currentOffset.width * 64,
                            y: currentOffset.height * 64
                        )
                        .frame(width: 64, height: 64)
                        .clipShape(Circle())
                }
                .overlay(Circle().stroke(LBrand.purpleLight.opacity(0.5), lineWidth: 1.5))
                Text("Liten avatar").font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
            }
            VStack(spacing: 5) {
                ZStack {
                    Image(imageName)
                        .resizable()
                        .scaledToFill()
                        .scaleEffect(currentScale)
                        .offset(
                            x: currentOffset.width * 110,
                            y: currentOffset.height * 110
                        )
                        .frame(width: 110, height: 110)
                        .clipShape(Circle())
                }
                .overlay(Circle().stroke(LBrand.purpleLight.opacity(0.5), lineWidth: 1.5))
                Text("Stor avatar").font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
            }
            VStack(spacing: 5) {
                ZStack {
                    GeometryReader { geo in
                        Image(imageName)
                            .resizable()
                            .scaledToFill()
                            .scaleEffect(currentScale)
                            .offset(
                                x: currentOffset.width * geo.size.width,
                                y: currentOffset.height * geo.size.height
                            )
                            .frame(width: geo.size.width, height: geo.size.height)
                            .clipped()
                    }
                }
                .frame(width: 160, height: 90)
                .clipShape(RoundedRectangle(cornerRadius: 11))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(LBrand.purpleLight.opacity(0.5), lineWidth: 1.5))
                Text("Hero").font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
            }
            Spacer()
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    private var controls: some View {
        VStack(spacing: 12) {
            HStack(spacing: 10) {
                Button {
                    withAnimation {
                        draftScale = max(0.5, draftScale - 0.2)
                        clampOffset()
                    }
                } label: {
                    Image(systemName: "minus.magnifyingglass")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(LBrand.cardHi, in: Circle())
                }.buttonStyle(.plain)
                Slider(value: $draftScale, in: 0.5...3.0) {
                    Text("Zoom")
                } minimumValueLabel: {
                    Image(systemName: "minus").foregroundStyle(LBrand.textTertiary)
                } maximumValueLabel: {
                    Image(systemName: "plus").foregroundStyle(LBrand.textTertiary)
                }
                .tint(LBrand.purpleLight)
                Button {
                    withAnimation {
                        draftScale = min(3.0, draftScale + 0.2)
                        clampOffset()
                    }
                } label: {
                    Image(systemName: "plus.magnifyingglass")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .background(LBrand.cardHi, in: Circle())
                }.buttonStyle(.plain)
            }
            Button {
                withAnimation {
                    draftOffset = .zero
                    draftScale = 1.0
                }
            } label: {
                HStack(spacing: 5) {
                    Image(systemName: "arrow.counterclockwise").font(.appScaled(size: 11, weight: .bold))
                    Text("Tilbakestill").font(.appScaled(size: 12, weight: .semibold))
                }
                .foregroundStyle(LBrand.purpleLight)
                .padding(.horizontal, 14).padding(.vertical, 8)
                .background(LBrand.purple.opacity(0.18), in: Capsule())
                .overlay(Capsule().stroke(LBrand.purple.opacity(0.4), lineWidth: 1))
            }.buttonStyle(.plain)
        }
    }

    private var gridOverlay: some View {
        GeometryReader { geo in
            Path { p in
                // Tredjedels-vertikal
                p.move(to: CGPoint(x: geo.size.width / 3, y: 0))
                p.addLine(to: CGPoint(x: geo.size.width / 3, y: geo.size.height))
                p.move(to: CGPoint(x: geo.size.width * 2 / 3, y: 0))
                p.addLine(to: CGPoint(x: geo.size.width * 2 / 3, y: geo.size.height))
                // Tredjedels-horisontal
                p.move(to: CGPoint(x: 0, y: geo.size.height / 3))
                p.addLine(to: CGPoint(x: geo.size.width, y: geo.size.height / 3))
                p.move(to: CGPoint(x: 0, y: geo.size.height * 2 / 3))
                p.addLine(to: CGPoint(x: geo.size.width, y: geo.size.height * 2 / 3))
            }
            .stroke(.white.opacity(0.25), lineWidth: 0.8)
        }
        .allowsHitTesting(false)
    }

    /// Holder offset innenfor rimelig grense. For portrett-i-landscape har vi mye
    /// vertikalt slingrings-rom, så vi tillater ±0.7 i Y, ±0.4 i X.
    private func clampOffset() {
        let yLimit: CGFloat = 0.7
        let xLimit: CGFloat = 0.4
        draftOffset.width  = max(-xLimit, min(xLimit, draftOffset.width))
        draftOffset.height = max(-yLimit, min(yLimit, draftOffset.height))
    }
}
