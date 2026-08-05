// CanvasArk.swift — sheets: AI-analyse, type-velger og Tidsreise.

import CoreLocation
import MapKit
import PDFKit
import PencilKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers
import Vision

struct CanvasAnalyseSheet: View {
    let drawing: PKDrawing
    let selskap: String
    let leadId: String?
    /// Spatial Memory: hvor objekter/noder/tekster ligger på flata.
    var romligTillegg: String = ""
    /// Spatial Sales Memory: fest analysen i kundens minne-lerret.
    var onFestIMinne: ((CanvasAnalyseDTO) -> Void)? = nil

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var ocrTekst = ""
    @State private var ocrKjort = false
    @State private var analyserer = false
    @State private var resultat: CanvasAnalyseDTO?
    @State private var feil: String?
    /// true = analysert on-device m/ Apple Intelligence (gratis/privat).
    @State private var onDeviceKilde = false

    var body: some View {
        NavigationStack {
            ZStack {
                CvBrand.bg.ignoresSafeArea()
                if let resultat {
                    resultatVisning(resultat)
                } else {
                    tekstVisning
                }
            }
            .navigationTitle(resultat == nil ? "Håndskrift → tekst" : "Analyse")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .tint(CvBrand.textSecondary)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task { await kjorOCR() }
    }

    // Steg 1: gjenkjent tekst (redigerbar før AI-en får den)

    private var tekstVisning: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if !ocrKjort {
                    HStack(spacing: 10) {
                        ProgressView().tint(CvBrand.purpleLight)
                        Text("Leser håndskriften …")
                            .font(.appScaled(size: 13, weight: .semibold))
                            .foregroundStyle(CvBrand.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 30)
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("GJENKJENT TEKST")
                            .font(.appScaled(size: 10, weight: .black))
                            .foregroundStyle(CvBrand.textSecondary)
                            .tracking(0.7)
                        TextEditor(text: $ocrTekst)
                            .font(.appScaled(size: 13))
                            .foregroundStyle(.white)
                            .scrollContentBackground(.hidden)
                            .frame(minHeight: 180)
                            .padding(8)
                            .background(CvBrand.cardHi.opacity(0.6),
                                        in: RoundedRectangle(cornerRadius: 9))
                        Text("Rett gjerne OCR-feil før analysen — AI-en tolker velvillig, men dikter aldri.")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(CvBrand.textTertiary)
                    }
                    .padding(14)
                    .background(CvBrand.card, in: RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14)
                        .stroke(CvBrand.stroke, lineWidth: 1))

                    if let feil {
                        Text(feil)
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(CvBrand.orange)
                    }

                    Button { Task { await analyser() } } label: {
                        HStack(spacing: 7) {
                            if analyserer {
                                ProgressView().controlSize(.small).tint(.white)
                            } else {
                                Image(systemName: "sparkles")
                                    .font(.appScaled(size: 13, weight: .bold))
                            }
                            Text(analyserer ? "Analyserer …" : "Analyser med AI")
                                .font(.appScaled(size: 14, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(
                            LinearGradient(colors: [CvBrand.purple, CvBrand.purpleLight],
                                           startPoint: .leading, endPoint: .trailing),
                            in: RoundedRectangle(cornerRadius: 12))
                        .opacity(kanAnalysere ? 1 : 0.4)
                    }
                    .buttonStyle(.plain)
                    .disabled(!kanAnalysere || analyserer)

                    Text("Oppgavene lander i «Oppgaver fra møtene» på Oversikt, og notatet huskes til neste møtebrief for \(selskap).")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(CvBrand.textTertiary)
                }
            }
            .padding(16)
        }
    }

    private var kanAnalysere: Bool {
        ocrTekst.trimmingCharacters(in: .whitespacesAndNewlines).count >= 10
            || DemoModeManager.isActiveNonisolated
    }

    // Steg 2: strukturert resultat

    private func resultatVisning(_ r: CanvasAnalyseDTO) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                seksjon("Oppsummering", ikon: "doc.text.fill", tint: CvBrand.blue) {
                    Text(r.oppsummering)
                        .font(.appScaled(size: 13))
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }
                if let oppgaver = r.oppgaver, !oppgaver.isEmpty {
                    seksjon("Oppgaver", ikon: "checklist", tint: CvBrand.green) {
                        ForEach(oppgaver, id: \.self) { o in
                            HStack(spacing: 7) {
                                Image(systemName: "circle")
                                    .font(.appScaled(size: 10))
                                    .foregroundStyle(CvBrand.green)
                                Text(o.tittel)
                                    .font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(.white)
                                Spacer()
                                if let f = o.frist, !f.isEmpty {
                                    Text(f)
                                        .font(.appScaled(size: 10, weight: .bold))
                                        .foregroundStyle(CvBrand.green)
                                        .padding(.horizontal, 7).padding(.vertical, 3)
                                        .background(CvBrand.green.opacity(0.15), in: Capsule())
                                }
                            }
                        }
                        Text("Lagret i oppgavelista — huk av under «Oppgaver fra møtene» på Oversikt.")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(CvBrand.textTertiary)
                    }
                }
                if let lofter = r.lofter, !lofter.isEmpty {
                    seksjon("Det vi lovte", ikon: "hand.raised.fill", tint: CvBrand.yellow) {
                        ForEach(lofter, id: \.self) { l in
                            HStack(alignment: .top, spacing: 7) {
                                Image(systemName: "checkmark.seal")
                                    .font(.appScaled(size: 11))
                                    .foregroundStyle(CvBrand.yellow)
                                Text(l)
                                    .font(.appScaled(size: 12))
                                    .foregroundStyle(.white)
                            }
                        }
                    }
                }
                HStack(spacing: 5) {
                    Image(systemName: onDeviceKilde ? "iphone" : "cloud")
                        .font(.appScaled(size: 9, weight: .bold))
                    Text(onDeviceKilde
                         ? "Analysert på enheten — Apple Intelligence (privat, uten kostnad)"
                         : "Analysert i skyen")
                        .font(.appScaled(size: 10))
                }
                .foregroundStyle(CvBrand.textTertiary)
                Text("Notatet er logget — neste møtebrief for \(selskap) åpner med dette.")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(CvBrand.textTertiary)
                if let fest = onFestIMinne {
                    Button {
                        fest(r)
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "brain.head.profile")
                                .font(.appScaled(size: 12, weight: .bold))
                            Text("Fest i kundeminnet")
                                .font(.appScaled(size: 13, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(CvBrand.cardHi, in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12)
                            .stroke(CvBrand.purpleLight.opacity(0.5), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                Button { dismiss() } label: {
                    Text("Ferdig")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            LinearGradient(colors: [CvBrand.purple, CvBrand.purpleLight],
                                           startPoint: .leading, endPoint: .trailing),
                            in: RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
            .padding(16)
        }
    }

    private func seksjon(_ tittel: String, ikon: String, tint: Color,
                         @ViewBuilder inner: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 6) {
                Image(systemName: ikon)
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(tint)
                Text(tittel.uppercased())
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(CvBrand.textSecondary)
                    .tracking(0.7)
            }
            inner()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CvBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(CvBrand.stroke, lineWidth: 1))
    }

    // MARK: OCR + AI

    /// PKDrawing → bilde (2×) → Vision-håndskriftgjenkjenning (nb + en).
    @MainActor
    private func kjorOCR() async {
        defer { ocrKjort = true }
        guard !drawing.bounds.isEmpty else {
            ocrTekst = ""
            return
        }
        let bilde = drawing.image(from: drawing.bounds, scale: 2.0)
        guard let cg = bilde.cgImage else { return }
        let tekst: String = await withCheckedContinuation { cont in
            let request = VNRecognizeTextRequest { req, _ in
                let obs = req.results as? [VNRecognizedTextObservation] ?? []
                // Spatial Memory: håndskriftens PLASSERING følger med —
                // Vision-boks (0-1, origo nede-venstre) → ni soner.
                let linjer = obs.compactMap { o -> String? in
                    guard let tekst = o.topCandidates(1).first?.string else { return nil }
                    let midtX = o.boundingBox.midX
                    let midtY = 1 - o.boundingBox.midY
                    let rad = midtY < 0.34 ? "øvre" : (midtY < 0.67 ? "midtre" : "nedre")
                    let kol = midtX < 0.34 ? "venstre" : (midtX < 0.67 ? "midt" : "høyre")
                    return "\(tekst) [\(rad) \(kol)]"
                }
                cont.resume(returning: linjer.joined(separator: "\n"))
            }
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["nb-NO", "en-US"]
            request.usesLanguageCorrection = true
            DispatchQueue.global(qos: .userInitiated).async {
                let handler = VNImageRequestHandler(cgImage: cg, options: [:])
                do { try handler.perform([request]) }
                catch { cont.resume(returning: "") }
            }
        }
        ocrTekst = tekst
        if tekst.isEmpty {
            feil = "Fant ingen tekst i tegningen — skriv/rediger teksten under manuelt, eller tegn tydeligere bokstaver."
        }
    }

    @MainActor
    private func analyser() async {
        feil = nil
        // Apple Intelligence: prøv on-device Foundation Models først
        // (iOS 26+, norsk-gate) — gratis, privat, offline. Backend
        // persisterer resultatet (oppgaver + møtelogg) uten AI-kost.
        if !DemoModeManager.isActiveNonisolated {
            analyserer = true
            let fullTekst = romligTillegg.isEmpty
                ? ocrTekst
                : ocrTekst + "\n\nOBJEKTER PÅ FLATA (plassering): " + romligTillegg
            if let lokal = await CanvasIntelligence.analyserOnDevice(
                tekst: fullTekst, selskap: selskap) {
                analyserer = false
                onDeviceKilde = true
                resultat = lokal
                if let api = appState.api {
                    Task { try? await api.persisterCanvasAnalyse(
                        selskap: selskap.isEmpty ? nil : selskap,
                        leadId: leadId, resultat: lokal) }
                }
                return
            }
            analyserer = false
        }
        if DemoModeManager.isActiveNonisolated {
            resultat = CanvasAnalyseDTO(
                oppsummering: "Godt møte hos \(selskap): interesse for løsning og bedre oversikt over ruter. Neste steg er å sende forslag til opplegg og avtale demo.",
                oppgaver: [
                    CanvasAnalyseOppgaveDTO(tittel: "Send tilbud", frist: "torsdag"),
                    CanvasAnalyseOppgaveDTO(tittel: "Avtal demo", frist: "neste uke"),
                    CanvasAnalyseOppgaveDTO(tittel: "Oppfølging", frist: "om 1 uke"),
                ],
                lofter: ["Sende forslag til opplegg"])
            return
        }
        guard let api = appState.api else {
            feil = "Krever innlogget modus."
            return
        }
        analyserer = true
        defer { analyserer = false }
        do {
            let full = romligTillegg.isEmpty
                ? ocrTekst
                : ocrTekst + "\n\nOBJEKTER PÅ FLATA (plassering): " + romligTillegg
            resultat = try await api.analyserCanvasNotat(
                selskap: selskap.isEmpty ? nil : selskap,
                tekst: full, leadId: leadId)
        } catch {
            feil = "Analysen feilet — sjekk nettet, og at «Møter · AI-møtebrief» er aktivert (Canvas-analysen bruker samme AI-nøkkel)."
        }
    }
}


// MARK: - StempelView (fase 4: klistremerke oppå flata)

/// Dra for å flytte, hold for å fjerne. Posisjon i canvas-punkter.

struct CanvasTypeVelger: View {
    let onVelg: (CanvasKategori) -> Void
    @Environment(\.dismiss) private var dismiss

    private let kolonner = [GridItem(.flexible()), GridItem(.flexible()),
                            GridItem(.flexible())]

    var body: some View {
        NavigationStack {
            ZStack {
                CvBrand.bg.ignoresSafeArea()
                ScrollView {
                    LazyVGrid(columns: kolonner, spacing: 12) {
                        ForEach(CanvasKategori.hovedTyper) { type in
                            Button { onVelg(type) } label: {
                                VStack(spacing: 10) {
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 14)
                                            .fill(type.coverGradient)
                                        Image(systemName: type.ikon)
                                            .font(.appScaled(size: 28, weight: .semibold))
                                            .foregroundStyle(.white.opacity(0.95))
                                    }
                                    .frame(height: 96)
                                    .overlay(RoundedRectangle(cornerRadius: 14)
                                        .stroke(type.farge.opacity(0.5), lineWidth: 1))
                                    Text(type.etikett)
                                        .font(.appScaled(size: 13, weight: .bold))
                                        .foregroundStyle(.white)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Nytt Canvas")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Avbryt") { dismiss() }
                        .tint(CvBrand.textSecondary)
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}


// MARK: - FigurView (fase 6: flyttbar + skalerbar form)

/// Dra flytter, klyp skalerer (0.3–4×), hold fjerner.

struct TidsreiseSheet: View {
    let notatId: String
    let naavaerende: PKDrawing
    let onGjenopprett: (PKDrawing) -> Void

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var versjoner: [CanvasVersjonDTO] = []
    @State private var posisjon: Double = 0
    @State private var lastet = false

    private var valgtIndeks: Int {
        min(Int(posisjon.rounded()), maxIndeks)
    }
    /// Siste posisjon = nåværende tilstand.
    private var maxIndeks: Int { versjoner.count }

    var body: some View {
        NavigationStack {
            ZStack {
                CvBrand.bg.ignoresSafeArea()
                VStack(spacing: 14) {
                    if !lastet {
                        ProgressView().tint(CvBrand.purpleLight)
                            .frame(maxHeight: .infinity)
                    } else if versjoner.isEmpty {
                        VStack(spacing: 8) {
                            Image(systemName: "clock.arrow.2.circlepath")
                                .font(.appScaled(size: 30))
                                .foregroundStyle(CvBrand.textTertiary)
                            Text("Ingen versjoner enda — historikken bygges hver gang du lagrer med endringer.")
                                .font(.appScaled(size: 12))
                                .foregroundStyle(CvBrand.textSecondary)
                                .multilineTextAlignment(.center)
                                .frame(maxWidth: 320)
                        }
                        .frame(maxHeight: .infinity)
                    } else {
                        // Tidslinje-badges: typens utvikling (Idé → Prosjekt …)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(Array(versjoner.enumerated()), id: \.offset) { i, v in
                                    let k = CanvasKategori(rawValue: v.kategori) ?? .mote
                                    VStack(spacing: 3) {
                                        Text(Self.dagLabel(v.opprettet))
                                            .font(.appScaled(size: 9, weight: .bold))
                                            .foregroundStyle(i == valgtIndeks
                                                             ? .white : CvBrand.textTertiary)
                                        Text(k.etikett)
                                            .font(.appScaled(size: 9, weight: .black))
                                            .foregroundStyle(k.farge)
                                            .padding(.horizontal, 7).padding(.vertical, 2)
                                            .background(k.farge.opacity(0.15), in: Capsule())
                                    }
                                    .padding(.horizontal, 6).padding(.vertical, 5)
                                    .background(i == valgtIndeks
                                                ? CvBrand.cardHi : Color.clear,
                                                in: RoundedRectangle(cornerRadius: 8))
                                    .onTapGesture { posisjon = Double(i) }
                                }
                                VStack(spacing: 3) {
                                    Text("Nå")
                                        .font(.appScaled(size: 9, weight: .bold))
                                        .foregroundStyle(valgtIndeks == maxIndeks
                                                         ? .white : CvBrand.textTertiary)
                                    Image(systemName: "sparkle")
                                        .font(.appScaled(size: 9))
                                        .foregroundStyle(CvBrand.purpleLight)
                                }
                                .padding(.horizontal, 8).padding(.vertical, 5)
                                .background(valgtIndeks == maxIndeks
                                            ? CvBrand.cardHi : Color.clear,
                                            in: RoundedRectangle(cornerRadius: 8))
                                .onTapGesture { posisjon = Double(maxIndeks) }
                            }
                            .padding(.horizontal, 16)
                        }

                        // Forhåndsvisningen av valgt tidspunkt
                        Group {
                            if let bilde = bildeForValgt() {
                                Image(uiImage: bilde)
                                    .resizable()
                                    .scaledToFit()
                            } else {
                                Text("Tom tegning på dette tidspunktet")
                                    .font(.appScaled(size: 12))
                                    .foregroundStyle(CvBrand.textTertiary)
                            }
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.black.opacity(0.35),
                                    in: RoundedRectangle(cornerRadius: 14))
                        .padding(.horizontal, 16)

                        // Slideren: mandag → fredag → nå.
                        Slider(value: $posisjon, in: 0...Double(maxIndeks), step: 1)
                            .tint(CvBrand.purple)
                            .padding(.horizontal, 20)

                        if valgtIndeks < maxIndeks {
                            Button {
                                if let tegning = tegningForValgt() {
                                    onGjenopprett(tegning)
                                }
                            } label: {
                                Text("Gjenopprett dette tidspunktet")
                                    .font(.appScaled(size: 13, weight: .bold))
                                    .foregroundStyle(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(
                                        LinearGradient(colors: [CvBrand.purple, CvBrand.purpleLight],
                                                       startPoint: .leading, endPoint: .trailing),
                                        in: RoundedRectangle(cornerRadius: 12))
                            }
                            .buttonStyle(.plain)
                            .padding(.horizontal, 16)
                        }
                    }
                }
                .padding(.vertical, 14)
            }
            .navigationTitle("Tidsreise")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }
                        .tint(CvBrand.textSecondary)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task {
            defer { lastet = true }
            guard let api = appState.api else { return }
            versjoner = (try? await api.hentCanvasVersjoner(notatId: notatId)) ?? []
            posisjon = Double(versjoner.count)   // start på «Nå»
        }
    }

    private func tegningForValgt() -> PKDrawing? {
        guard valgtIndeks < versjoner.count,
              let b64 = versjoner[valgtIndeks].drawingBase64,
              let data = Data(base64Encoded: b64) else { return nil }
        return try? PKDrawing(data: data)
    }

    private func bildeForValgt() -> UIImage? {
        let tegning: PKDrawing?
        if valgtIndeks == maxIndeks {
            tegning = naavaerende
        } else {
            tegning = tegningForValgt()
        }
        guard let t = tegning, !t.bounds.isEmpty else { return nil }
        return t.image(from: t.bounds.insetBy(dx: -30, dy: -30), scale: 1.5)
    }

    private static func dagLabel(_ iso: String?) -> String {
        guard let iso, let d = ISO8601DateFormatter().date(from: iso) else { return "–" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "EEE d.M"
        return f.string(from: d)
    }
}

