// NexusMedieObjekter.swift
//
// Fire nye ting som kan ligge på flata: et annet notat, lyd, video og en
// nettside.
//
// Notat-i-notat er det som gjør Nexus til en graf i stedet for en samling
// endestasjoner. Alt annet man kunne legge på flata var et blad — et bilde,
// en PDF, et kort. Et notat er den første tingen som selv har innhold å gå
// inn i.
//
// Lyden er ikke bare et vedlegg. PencilKit tidsstempler hvert strøk i
// `PKStrokePath.creationDate`, så når vi vet når opptaket startet, kan vi
// regne ut hvilke strøk som ble skrevet mens en gitt del av lyden spilte.
// Dra i sporet, og blekket fra det øyeblikket lyser opp. Ingen ekstra data
// lagres per strøk — tidsstemplene lå der hele tiden.

import SwiftUI
import PencilKit
import AVFoundation
import SafariServices

/// Felles kledning for alt som ligger på flata.
///
/// Aksentfargen er en TILSTAND, ikke en dekorasjon. Et kort i ro har nøytral
/// kant som alt annet i appen; fargen kommer først når kortet er valgt eller
/// gjør noe — spiller av, laster. Fire kort med hver sin permanente
/// signalfarge er fire ting som roper samtidig, og da roper ingen av dem.
private struct FlateKort: ViewModifier {
    var aktiv: Bool = false
    var aktivFarge: Color = CvBrand.purpleLight

    func body(content: Content) -> some View {
        content
            .background(CvBrand.cardHi, in: RoundedRectangle(cornerRadius: 14))
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(aktiv ? aktivFarge : CvBrand.stroke,
                            lineWidth: aktiv ? 1.5 : 1))
            .shadow(color: .black.opacity(0.35), radius: 6, y: 3)
            .animation(.easeOut(duration: 0.18), value: aktiv)
    }
}

private extension View {
    func flateKort(aktiv: Bool = false,
                   aktivFarge: Color = CvBrand.purpleLight) -> some View {
        modifier(FlateKort(aktiv: aktiv, aktivFarge: aktivFarge))
    }
}

/// Handlingen som åpner et kort.
///
/// Dobbelttrykk var usynlig: ingenting på flata fortalte at det fantes. Nå
/// velger ett trykk kortet — som alt annet på flata — og det valgte kortet
/// viser hva som skjer videre. Ett mønster, ikke to.
private struct AapneKnapp: View {
    let tekst: String
    let ikon: String
    let farge: Color
    let handling: () -> Void

    var body: some View {
        Button(action: handling) {
            HStack(spacing: 5) {
                Image(systemName: ikon).font(.appScaled(size: 12, weight: .semibold))
                Text(tekst).font(.appScaled(size: 12, weight: .semibold))
            }
            .foregroundStyle(farge)
            .padding(.horizontal, 12)
            // 44 pt høy: knappen treffes med hanske og i bevegelse.
            .frame(height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Notat-i-notat

/// Et annet notat, som et levende kort på flata.
///
/// Ikke en kopi. Blekket som vises er det andre notatets faktiske tegning,
/// nedskalert. Endrer det seg, endrer kortet seg.
struct NexusNotatKort: View {
    let tittel: String
    let kategori: CanvasKategori?
    /// Det andre notatets tegning, hvis den er lastet.
    let forhaandsvisning: PKDrawing?
    let skala: Double
    /// Kortet er valgt på flata. Først da vises åpne-knappen.
    var valgt: Bool = false
    let apne: () -> Void

    private var bredde: CGFloat { 260 * skala }
    private var hoyde: CGFloat { 180 * skala }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 7) {
                Image(systemName: kategori?.ikon ?? "doc.text.fill")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(kategori?.farge ?? CvBrand.purpleLight)
                Text(tittel.isEmpty ? "Uten tittel" : tittel)
                    .font(.appScaled(size: 13, weight: .bold))
                    .lineLimit(1)
                Spacer(minLength: 4)
            }
            .padding(.horizontal, 11)
            .padding(.vertical, 8)

            Rectangle().fill(CvBrand.stroke).frame(height: 1)

            ZStack {
                CvBrand.card
                if let tegning = forhaandsvisning, !tegning.strokes.isEmpty {
                    // Faktisk blekk fra det andre notatet, ikke et ikon.
                    Image(uiImage: tegning.image(
                        from: tegning.bounds.insetBy(dx: -20, dy: -20),
                        scale: 1))
                        .resizable()
                        .scaledToFit()
                        .padding(6)
                } else if forhaandsvisning == nil {
                    // Skjelett, ikke en spinner: kortet har allerede en form,
                    // og den formen skal ikke bli borte mens blekket hentes.
                    VStack(alignment: .leading, spacing: 9) {
                        ForEach(0..<3, id: \.self) { i in
                            Capsule()
                                .fill(Color.white.opacity(0.07))
                                .frame(width: [150.0, 190.0, 120.0][i], height: 7)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .accessibilityLabel("Henter blekket")
                } else {
                    Text("Tomt ark")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(CvBrand.textSecondary)
                }
            }
            .frame(height: hoyde - 36)
            .clipped()

            if valgt {
                Rectangle().fill(CvBrand.stroke).frame(height: 1)
                AapneKnapp(tekst: "Åpne notatet", ikon: "arrow.up.forward.square",
                           farge: kategori?.farge ?? CvBrand.purpleLight,
                           handling: apne)
                    .frame(maxWidth: .infinity)
            }
        }
        .frame(width: bredde)
        .flateKort(aktiv: valgt, aktivFarge: kategori?.farge ?? CvBrand.purpleLight)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Notat: \(tittel)")
    }
}

// MARK: - Lyd

/// Spiller av et opptak og forteller omverdenen hvor i lyden vi er, så
/// blekket kan følge med.
@MainActor
@Observable
final class NexusLydSpiller: NSObject, AVAudioPlayerDelegate {
    private(set) var spiller = false
    private(set) var posisjon: TimeInterval = 0
    private(set) var lengde: TimeInterval = 0
    private var avspiller: AVAudioPlayer?
    private var ticker: Timer?

    func last(_ data: Data) {
        stopp()
        avspiller = try? AVAudioPlayer(data: data)
        avspiller?.delegate = self
        avspiller?.prepareToPlay()
        lengde = avspiller?.duration ?? 0
        posisjon = 0
    }

    func startEllerPause() {
        guard let avspiller else { return }
        if avspiller.isPlaying {
            avspiller.pause(); spiller = false; ticker?.invalidate()
        } else {
            // Kategorien settes her, ikke ved appstart: et notat uten lyd
            // skal ikke stille om lyden på hele enheten.
            try? AVAudioSession.sharedInstance().setCategory(.playback)
            try? AVAudioSession.sharedInstance().setActive(true)
            avspiller.play(); spiller = true
            ticker = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
                Task { @MainActor in
                    guard let self, let p = self.avspiller else { return }
                    self.posisjon = p.currentTime
                }
            }
        }
    }

    func sokTil(_ t: TimeInterval) {
        avspiller?.currentTime = max(0, min(lengde, t))
        posisjon = avspiller?.currentTime ?? 0
    }

    func stopp() {
        ticker?.invalidate(); ticker = nil
        avspiller?.stop(); avspiller = nil
        spiller = false; posisjon = 0; lengde = 0
    }

    nonisolated func audioPlayerDidFinishPlaying(_ p: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in self.spiller = false; self.ticker?.invalidate() }
    }
}

/// Tar opp lyd til en fil vi siden laster opp som «dokument».
@MainActor
@Observable
final class NexusLydOpptaker: NSObject {
    private(set) var tarOpp = false
    private(set) var startet: Date?
    private(set) var nivaa: Double = 0
    private var opptaker: AVAudioRecorder?
    private var ticker: Timer?
    private(set) var filUrl: URL?

    /// Ber om mikrofontilgang og starter. Returnerer false hvis brukeren sier nei.
    func start() async -> Bool {
        let ok = await withCheckedContinuation { (c: CheckedContinuation<Bool, Never>) in
            AVAudioApplication.requestRecordPermission { c.resume(returning: $0) }
        }
        guard ok else { return false }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("nexus-\(UUID().uuidString).m4a")
        // AAC på 32 kbit/s: en times møte blir ca. 14 MB, som er innenfor
        // taket på opplastingsendepunktet. Tale trenger ikke mer.
        let innstillinger: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 22_050,
            AVNumberOfChannelsKey: 1,
            AVEncoderBitRateKey: 32_000,
        ]
        try? AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
        guard let r = try? AVAudioRecorder(url: url, settings: innstillinger) else { return false }
        r.isMeteringEnabled = true
        guard r.record() else { return false }
        opptaker = r; filUrl = url; startet = Date(); tarOpp = true
        ticker = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, let r = self.opptaker else { return }
                r.updateMeters()
                // −60 dB til 0 dB mappet til 0…1, så stolpen beveger seg
                // synlig på vanlig tale.
                self.nivaa = max(0, min(1, (Double(r.averagePower(forChannel: 0)) + 60) / 60))
            }
        }
        return true
    }

    /// Stopper og gir tilbake bytes + lengde + når opptaket begynte.
    func stopp() -> (data: Data, varighet: Double, startet: Date)? {
        ticker?.invalidate(); ticker = nil
        guard let r = opptaker, let url = filUrl, let start = startet else { return nil }
        let varighet = r.currentTime
        r.stop()
        opptaker = nil; tarOpp = false; nivaa = 0
        defer { try? FileManager.default.removeItem(at: url) }
        guard let data = try? Data(contentsOf: url) else { return nil }
        return (data, varighet, start)
    }
}

/// Hvilke strøk ble skrevet mens lyden spilte?
///
/// PencilKit gir hvert strøk en `creationDate` på stien, og hvert punkt et
/// `timeOffset` fra den. Sammen med opptakets starttidspunkt er det nok til
/// å knytte lyd og blekk sammen uten å lagre noe ekstra.
enum NexusBlekkSynk {

    /// Sekundet i opptaket et strøk ble skrevet. `nil` når strøket ble laget
    /// før eller etter opptaket.
    static func lydtid(for strok: PKStroke, opptakStartet: Date,
                       varighet: Double) -> Double? {
        let skrevet = strok.path.creationDate
        let t = skrevet.timeIntervalSince(opptakStartet)
        guard t >= -0.5, t <= varighet + 0.5 else { return nil }
        return max(0, t)
    }

    /// Strøkene som ble skrevet innenfor `vindu` sekunder rundt `tid`.
    ///
    /// Vinduet er romslig med vilje: man skriver sjelden akkurat idet ordet
    /// sies, og et for stramt vindu gir en tom markering som føles ødelagt.
    static func strokIndekser(i tegning: PKDrawing, vedTid tid: Double,
                              opptakStartet: Date, varighet: Double,
                              vindu: Double = 4) -> [Int] {
        tegning.strokes.enumerated().compactMap { (i, s) in
            guard let t = lydtid(for: s, opptakStartet: opptakStartet,
                                 varighet: varighet) else { return nil }
            return abs(t - tid) <= vindu ? i : nil
        }
    }
}

/// Lydkortet på flata. Spiller av, og viser hvor i opptaket vi er.
struct NexusLydKort: View {
    let tittel: String
    let varighet: Double
    let skala: Double
    let spiller: NexusLydSpiller
    let harBlekkSynk: Bool
    /// Kortet er valgt på flata.
    var valgt: Bool = false
    let startEllerPause: () -> Void
    let sokTil: (Double) -> Void

    private func klokke(_ t: Double) -> String {
        let s = Int(t.rounded())
        return String(format: "%d:%02d", s / 60, s % 60)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 8) {
                Button(action: startEllerPause) {
                    Image(systemName: spiller.spiller ? "pause.circle.fill" : "play.circle.fill")
                        .font(.appScaled(size: 26))
                        .foregroundStyle(CvBrand.green)
                }
                .buttonStyle(.plain)
                VStack(alignment: .leading, spacing: 1) {
                    Text(tittel.isEmpty ? "Opptak" : tittel)
                        .font(.appScaled(size: 13, weight: .bold))
                        .lineLimit(1)
                    Text("\(klokke(spiller.lengde > 0 ? spiller.posisjon : 0)) / \(klokke(varighet))")
                        .font(.appScaled(size: 11).monospacedDigit())
                        .foregroundStyle(CvBrand.textSecondary)
                }
            }
            Slider(
                value: Binding(
                    get: { spiller.lengde > 0 ? spiller.posisjon : 0 },
                    set: { sokTil($0) }),
                in: 0...max(varighet, 0.1))
                .tint(CvBrand.green)
            // Hintet er en TILSTAND, ikke en permanent etikett: det er sant
            // mens lyden går, og da forklarer det det man ser skje i blekket.
            // Alltid synlig ville det vært en reklameplakat på eget kort.
            if harBlekkSynk, spiller.spiller {
                Label("Blekket lyser der du skrev", systemImage: "scribble.variable")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(CvBrand.green)
                    .transition(.opacity)
            }
        }
        .padding(11)
        .frame(width: 260 * skala)
        .flateKort(aktiv: valgt || spiller.spiller, aktivFarge: CvBrand.green)
        .animation(.easeOut(duration: 0.18), value: spiller.spiller)
    }
}

// MARK: - Nettside

/// Nettside som kort. Tapp åpner den i Safari oppå appen, så man ikke
/// mister notatet for å sjekke en pris.
struct NexusNettsideKort: View {
    let url: String
    let tittel: String?
    let skala: Double
    var valgt: Bool = false
    let apne: () -> Void

    private var vertsnavn: String {
        URL(string: url)?.host?.replacingOccurrences(of: "www.", with: "") ?? url
    }

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "globe")
                .font(.appScaled(size: 16, weight: .semibold))
                .foregroundStyle(CvBrand.blue)
                .frame(width: 34, height: 34)
                .background(CvBrand.blue.opacity(0.14), in: RoundedRectangle(cornerRadius: 9))
            VStack(alignment: .leading, spacing: 1) {
                Text(tittel?.isEmpty == false ? tittel! : vertsnavn)
                    .font(.appScaled(size: 13, weight: .bold))
                    .lineLimit(1)
                Text(vertsnavn)
                    .font(.appScaled(size: 11))
                    .foregroundStyle(CvBrand.textSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            if valgt {
                AapneKnapp(tekst: "Åpne", ikon: "arrow.up.forward",
                           farge: CvBrand.blue, handling: apne)
            }
        }
        .padding(.leading, 12)
        .padding(.trailing, valgt ? 4 : 12)
        .padding(.vertical, valgt ? 2 : 10)
        .frame(width: 250 * skala)
        .flateKort(aktiv: valgt, aktivFarge: CvBrand.blue)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Nettside: \(tittel ?? vertsnavn)")
    }
}

/// Safari oppå appen — beholder notatet bak.
struct NexusSafari: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }
    func updateUIViewController(_ c: SFSafariViewController, context: Context) {}
}

// MARK: - Video

/// Videokort. Miniatyren hentes fra første brukbare bilde i klippet, så
/// kortet viser hva videoen er — ikke et generisk filmikon.
struct NexusVideoKort: View {
    let tittel: String
    let varighet: Double
    let miniatyr: UIImage?
    let skala: Double
    var valgt: Bool = false
    let spillAv: () -> Void

    private var bredde: CGFloat { 280 * skala }

    private func klokke(_ t: Double) -> String {
        let s = Int(t.rounded())
        return String(format: "%d:%02d", s / 60, s % 60)
    }

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Group {
                if let miniatyr {
                    Image(uiImage: miniatyr).resizable().scaledToFill()
                } else {
                    // Miniatyren hentes asynkront ut av klippet. Fram til da
                    // skal kortet se ut som en video, ikke som et hull.
                    ZStack {
                        CvBrand.card
                        Image(systemName: "film")
                            .font(.system(size: 34))
                            .foregroundStyle(CvBrand.textTertiary)
                    }
                }
            }
            .frame(width: bredde, height: bredde * 9 / 16)
            .clipShape(RoundedRectangle(cornerRadius: 14))

            LinearGradient(colors: [.clear, .black.opacity(0.65)],
                           startPoint: .center, endPoint: .bottom)
                .frame(width: bredde, height: bredde * 9 / 16)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .allowsHitTesting(false)

            HStack(spacing: 7) {
                // Spill-knappen er selve affordansen her — den er alltid
                // synlig, fordi et videokort uten play-ikon ikke ser ut som
                // en video. Treffområdet er 44 pt.
                Button(action: spillAv) {
                    Image(systemName: "play.circle.fill")
                        .font(.appScaled(size: 26))
                        .foregroundStyle(.white)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Spill av \(tittel.isEmpty ? "videoen" : tittel)")
                Text(tittel.isEmpty ? "Video" : tittel)
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Spacer(minLength: 4)
                Text(klokke(varighet))
                    .font(.appScaled(size: 11).monospacedDigit())
                    .foregroundStyle(.white.opacity(0.85))
            }
            .padding(.horizontal, 8).padding(.bottom, 4)
            .frame(width: bredde, alignment: .leading)
        }
        .overlay(RoundedRectangle(cornerRadius: 14)
            .stroke(valgt ? CvBrand.purpleLight : CvBrand.stroke,
                    lineWidth: valgt ? 1.5 : 1))
        .shadow(color: .black.opacity(0.35), radius: 6, y: 3)
        .animation(.easeOut(duration: 0.18), value: valgt)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Video: \(tittel)")
    }
}

enum NexusVideo {
    /// Første brukbare bilde fra klippet. Ett sekund inn, ikke null — mange
    /// klipp starter på en svart frame.
    static func miniatyr(for data: Data) async -> UIImage? {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("nexus-mini-\(UUID().uuidString).mov")
        guard (try? data.write(to: url)) != nil else { return nil }
        defer { try? FileManager.default.removeItem(at: url) }
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: url))
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 900, height: 900)
        let tid = CMTime(seconds: 1, preferredTimescale: 600)
        guard let cg = try? await generator.image(at: tid).image else { return nil }
        return UIImage(cgImage: cg)
    }

    static func varighet(for data: Data) async -> Double {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("nexus-len-\(UUID().uuidString).mov")
        guard (try? data.write(to: url)) != nil else { return 0 }
        defer { try? FileManager.default.removeItem(at: url) }
        let varighet = try? await AVURLAsset(url: url).load(.duration)
        return varighet.map { CMTimeGetSeconds($0) } ?? 0
    }
}

/// `sheet(item:)` og `fullScreenCover(item:)` krever Identifiable. En URL er
/// unik i seg selv — dette sparer en wrapper-type per bruksted.
extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}
