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
    /// Notatet finnes ikke i denne flata: enten ikke lastet ned, eller
    /// slettet. Kortet skal si det, ikke late som det fortsatt laster.
    var utilgjengelig: Bool = false
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
                } else if utilgjengelig {
                    VStack(spacing: 6) {
                        Image(systemName: "questionmark.square.dashed")
                            .font(.system(size: 22))
                            .foregroundStyle(CvBrand.textTertiary)
                        Text("Finner ikke notatet")
                            .font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(CvBrand.textSecondary)
                        Text("Slettet, eller tilhører noen andre.")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(CvBrand.textTertiary)
                    }
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
                // Peker kortet på ingenting, er det ingen vits i å tilby å
                // åpne det. Da er det eneste fornuftige å bli kvitt det.
                AapneKnapp(
                    tekst: utilgjengelig ? "Fjern kortet" : "Åpne notatet",
                    ikon: utilgjengelig ? "trash" : "arrow.up.forward.square",
                    farge: utilgjengelig
                        ? CvBrand.red : (kategori?.farge ?? CvBrand.purpleLight),
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

    /// Kaster lyden som er tatt opp så langt, og starter på nytt.
    ///
    /// Dette er «glem de siste minuttene» for lyd-modus. En AAC-fil kan
    /// ikke klippes bakfra mens den skrives, så den eneste ÆRLIGE måten å
    /// fjerne innholdet på er å kaste hele filen og begynne forfra.
    ///
    /// Alternativet — å markere et tidsvindu som «slettet» og hoppe over
    /// det ved avspilling — ville latt bytene ligge. Det er ikke sletting,
    /// det er å skjule. En kunde som nevner en sykdom skal ikke måtte stole
    /// på at avspilleren respekterer et flagg.
    ///
    /// Prisen er at lyden fra før klippet også går tapt. Referatet beholder
    /// alt utenfor vinduet, så møtet er ikke borte — men stemmen er.
    func kastOgStartPaaNytt() async -> Bool {
        forkast()
        return await start()
    }

    /// Stopper og sletter opptaket uten å gi det tilbake.
    ///
    /// Brukes når org-en ikke har åpnet GDPR-nøkkelen: transkripsjonen
    /// beholdes, lyden kastes. Det er hele forskjellen mellom «vi lagrer
    /// ikke rå lyd» og «vi lagrer rå lyd, men later som vi ikke gjør det».
    func forkast() {
        ticker?.invalidate(); ticker = nil
        opptaker?.stop()
        if let url = filUrl { try? FileManager.default.removeItem(at: url) }
        opptaker = nil; filUrl = nil; startet = nil
        tarOpp = false; nivaa = 0
    }

    /// Stopper og gir tilbake bytes, lengde, starttidspunkt og filen.
    ///
    /// Filen slettes IKKE her. Den er den eneste kopien til opplastingen har
    /// gått gjennom, og mister man dekning idet man stopper, er et helt møte
    /// borte. Kalleren sletter den når bytene er trygt lagret.
    func stopp() -> (data: Data, varighet: Double, startet: Date, fil: URL)? {
        ticker?.invalidate(); ticker = nil
        guard let r = opptaker, let url = filUrl, let start = startet else { return nil }
        let varighet = r.currentTime
        r.stop()
        opptaker = nil; tarOpp = false; nivaa = 0
        guard let data = try? Data(contentsOf: url) else { return nil }
        return (data, varighet, start, url)
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

    /// Hva som ble SAGT rundt et gitt sekund.
    ///
    /// Motsatt vei av strokIndekser: gitt et strøk, finn ytringen. Det er
    /// den retningen som betyr noe i praksis — «hva ble sagt da jeg skrev
    /// dette?» er spørsmålet man faktisk stiller.
    static func segmentVed(_ tid: Double, i referat: [Referatsegment],
                           vindu: Double = 4) -> Referatsegment? {
        referat
            .filter { $0.start - vindu <= tid && tid <= $0.start + $0.varighet + vindu }
            .min { abs($0.start - tid) < abs($1.start - tid) }
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
    /// Opptaket ligger fortsatt bare på iPaden.
    var venterPaaOpplasting: Bool = false
    /// Lyden er lagret på serveren, og kan trekkes tilbake (§4 punkt 4).
    var kanTrekkes: Bool = false
    var trekkSamtykke: (() -> Void)? = nil
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
            if venterPaaOpplasting {
                // Sier det rett ut: opptaket finnes bare her. Et møte som
                // ligger på én enhet er et møte man kan miste.
                Label(valgt ? "Trykk for å laste opp på nytt"
                            : "Ligger bare på iPaden",
                      systemImage: "exclamationmark.icloud")
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(CvBrand.yellow)
            } else if valgt, kanTrekkes {
                // §4 punkt 4: kunden skal kunne be om at opptaket slettes.
                // Knappen står på kortet, ikke i en innstillingsmeny — den
                // som får forespørselen er selgeren, midt i samtalen.
                Button { trekkSamtykke?() } label: {
                    Label("Kunden trekker samtykket", systemImage: "trash")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(CvBrand.red)
                        .frame(height: 34)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            } else if harBlekkSynk, spiller.spiller {
                Label("Blekket lyser der du skrev", systemImage: "scribble.variable")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(CvBrand.green)
                    .transition(.opacity)
            }
        }
        .padding(11)
        .frame(width: 260 * skala)
        .flateKort(aktiv: valgt || spiller.spiller || venterPaaOpplasting,
                   aktivFarge: venterPaaOpplasting ? CvBrand.yellow : CvBrand.green)
        .animation(.easeOut(duration: 0.18), value: spiller.spiller)
    }
}

// MARK: - Opptak pågår

/// Vedvarende indikator mens lyd tas opp.
///
/// Før dette var eneste spor et ikon inne i en sammenklappet meny. Man kunne
/// starte opptak, lukke menyen, gjennomføre møtet og gå ut på gata mens det
/// fortsatt gikk. Det er ikke en pyntesak: den du sitter overfor har krav på
/// å vite at han blir tatt opp, og du kan ikke fortelle ham det hvis du ikke
/// vet det selv.
///
/// Derfor er den rød, alltid synlig, og har stoppknappen i seg.
struct NexusOpptakBanner: View {
    let startet: Date
    let nivaa: Double
    /// «Glem de siste to minuttene» — for når kunden nevner noe som ikke
    /// skulle vært tatt opp. Den hører hjemme HER, i banneret selgeren
    /// allerede ser på, ikke i en meny han må lete i mens samtalen går.
    var glemSiste: (() -> Void)? = nil
    let stopp: () -> Void

    @State private var naa = Date()
    private let klokkeslag = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private var gaatt: String {
        let s = max(0, Int(naa.timeIntervalSince(startet)))
        return String(format: "%d:%02d", s / 60, s % 60)
    }

    var body: some View {
        HStack(spacing: 11) {
            // Prikken pulser med lydnivået, ikke med en timer: den viser at
            // mikrofonen faktisk hører noe, ikke bare at appen tror den gjør det.
            Circle()
                .fill(Color.white)
                .frame(width: 10, height: 10)
                .scaleEffect(1 + nivaa * 0.7)
                .animation(.easeOut(duration: 0.12), value: nivaa)

            Text("Tar opp")
                .font(.appScaled(size: 13, weight: .bold))
            Text(gaatt)
                .font(.appScaled(size: 13, weight: .semibold).monospacedDigit())
                .foregroundStyle(.white.opacity(0.85))

            if let glemSiste {
                Button(action: glemSiste) {
                    Text("Glem 2 min")
                        .font(.appScaled(size: 12, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 11)
                        .frame(height: 34)
                        .background(.white.opacity(0.18), in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Glem de siste to minuttene av opptaket")
            }

            Button(action: stopp) {
                Text("Stopp")
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(CvBrand.red)
                    .padding(.horizontal, 14)
                    .frame(height: 34)
                    .background(.white, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .foregroundStyle(.white)
        .padding(.leading, 16)
        .padding(.trailing, 5)
        .padding(.vertical, 5)
        .background(CvBrand.red, in: Capsule())
        .shadow(color: CvBrand.red.opacity(0.5), radius: 10)
        .onReceive(klokkeslag) { naa = $0 }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Tar opp lyd, \(gaatt)")
        .accessibilityHint("Aktiver Stopp for å avslutte opptaket")
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
    /// Miniatyren lagres på objektet som JPEG-base64.
    ///
    /// Den lå tidligere kun i minnet, så den forsvant hver gang notatet ble
    /// lukket — og kortet falt tilbake til et filmikon for alltid. 480 px ved
    /// 0,5 kvalitet er rundt 30 kB, som notatet tåler.
    static func miniatyrBase64(for data: Data) async -> String? {
        guard let bilde = await miniatyr(for: data) else { return nil }
        let maalBredde: CGFloat = 480
        let skala = min(1, maalBredde / max(bilde.size.width, 1))
        let stoerrelse = CGSize(width: bilde.size.width * skala,
                                height: bilde.size.height * skala)
        let mindre = UIGraphicsImageRenderer(size: stoerrelse).image { _ in
            bilde.draw(in: CGRect(origin: .zero, size: stoerrelse))
        }
        return mindre.jpegData(compressionQuality: 0.5)?.base64EncodedString()
    }

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
