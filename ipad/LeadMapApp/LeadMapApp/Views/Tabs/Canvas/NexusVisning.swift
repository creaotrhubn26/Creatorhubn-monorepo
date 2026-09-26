// NexusVisning.swift — DEBUG-only designflate for Nexus.
//
// Rendrer de EKTE viewene med eksempeldata, så det man ser her er det som
// ligger på flata i appen — ikke en mockup som kan drifte fra koden.
//
// Startes med:
//   SIMCTL_CHILD_QA_NEXUS_VISNING=1 xcrun simctl launch <udid> com.creatorhubn.LeadMapApp
//
// Finnes ikke i release-bygg.

#if DEBUG
import SwiftUI
import PencilKit

struct NexusVisning: View {
    @State private var spiller = NexusLydSpiller()
    @State private var lydTid: Double = 34
    @State private var valgtFane = 0

    /// Litt blekk så notat-kortet og blekk-synken viser ekte strøk.
    private static func prøveblekk(strøk: Int, forskjøvet: CGFloat = 0) -> PKDrawing {
        var streker: [PKStroke] = []
        for i in 0..<strøk {
            let y = 40 + CGFloat(i) * 34 + forskjøvet
            let punkter = stride(from: CGFloat(30), to: 250, by: 6).map { x in
                PKStrokePoint(
                    location: CGPoint(x: x, y: y + sin(x / 18) * 7),
                    timeOffset: Double(x) / 900, size: CGSize(width: 4, height: 4),
                    opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
            }
            // Samme konvertering appens egne penner bruker: PencilKit lagrer
            // lys-refererte farger og adapterer ved rendring. Rå .white her
            // ville blitt nesten svart på mørk flate.
            streker.append(PKStroke(
                ink: PKInk(.pen, color: PKInkingTool.convertColor(
                    .white, from: .dark, to: .light)),
                path: PKStrokePath(controlPoints: punkter, creationDate: Date())))
        }
        return PKDrawing(strokes: streker)
    }

    /// QA_NEXUS_VISNING=2 starter rett på koblingspanelet, så det kan
    /// skjermdumpes uten å scrolle i simulatoren.
    private var barePanel: Bool {
        ProcessInfo.processInfo.environment["QA_NEXUS_VISNING"] == "2"
    }

    /// Notatene som er sluppet på prøveflata.
    @State private var slupne: [NexusNotatReferanse] = []
    /// Storen må overleve rendringer. Bygget i body ble den ny for hvert
    /// tastetrykk, og panelet mistet innholdet sitt.
    @State private var store = NexusVisning.demoStore()

    var body: some View {
        if barePanel {
            dragFlate
        } else {
            hovedflate
        }
    }

    /// Panel til venstre, flate til høyre — samme dra-type og samme
    /// dropDestination som i den ekte flata. Det som virker her, virker der.
    private var dragFlate: some View {
        NavigationStack {
            HStack(spacing: 0) {
                NexusKoblingerPanel(
                    store: store,
                    leggPaaFlata: { k in
                        slupne.append(.init(notatId: k.id, tittel: k.tittel))
                    },
                    apne: { _ in })
                    .frame(width: 380)

                Rectangle().fill(CvBrand.stroke).frame(width: 1)

                ZStack {
                    CvBrand.bg
                    // Teller antall slupne som ren tekst: XCUITest kan lese
                    // den uten at vi må gjette på beholder-semantikk.
                    Text("slupne: \(slupne.count)")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(CvBrand.textTertiary)
                        .accessibilityIdentifier("nexus.antall")
                        .frame(maxWidth: .infinity, maxHeight: .infinity,
                               alignment: .bottomTrailing)
                        .padding(10)
                    if slupne.isEmpty {
                        VStack(spacing: 7) {
                            Image(systemName: "hand.draw")
                                .font(.system(size: 30))
                                .foregroundStyle(CvBrand.textTertiary)
                            Text("Dra et notat hit")
                                .font(.appScaled(size: 14, weight: .semibold))
                                .foregroundStyle(CvBrand.textSecondary)
                            Text("Kortet lander der du slipper.")
                                .font(.appScaled(size: 12))
                                .foregroundStyle(CvBrand.textTertiary)
                        }
                    } else {
                        VStack(alignment: .leading, spacing: 16) {
                            ForEach(slupne, id: \.notatId) { r in
                                NexusNotatKort(
                                    tittel: r.tittel, kategori: .mote,
                                    forhaandsvisning: Self.prøveblekk(strøk: 3),
                                    skala: 0.85, valgt: false, apne: {})
                            }
                        }
                        .accessibilityIdentifier("nexus.slupne")
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
                .accessibilityIdentifier("nexus.flate")
                .dropDestination(for: NexusNotatReferanse.self) { ref, _ in
                    guard let r = ref.first else { return false }
                    slupne.append(r)
                    return true
                }
            }
            .navigationTitle("Dra et notat ut på flata")
            .navigationBarTitleDisplayMode(.inline)
        }
        .preferredColorScheme(.dark)
    }

    private var hovedflate: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    seksjon("Et notat på flata",
                            "Ikke en kopi, men et vindu: blekket er det andre "
                            + "notatets faktiske tegning. I ro har kortet "
                            + "nøytral kant som alt annet. Velger du det, "
                            + "sier det hva som skjer videre.") {
                        HStack(alignment: .top, spacing: 18) {
                            VStack(alignment: .leading, spacing: 7) {
                                NexusNotatKort(
                                    tittel: "Neras Direkte — første møte",
                                    kategori: .mote,
                                    forhaandsvisning: Self.prøveblekk(strøk: 4),
                                    skala: 1.0, valgt: false, apne: {})
                                merkelapp("I ro")
                            }
                            VStack(alignment: .leading, spacing: 7) {
                                NexusNotatKort(
                                    tittel: "Neras Direkte — første møte",
                                    kategori: .mote,
                                    forhaandsvisning: Self.prøveblekk(strøk: 4),
                                    skala: 1.0, valgt: true, apne: {})
                                merkelapp("Valgt")
                            }
                            VStack(alignment: .leading, spacing: 7) {
                                NexusNotatKort(
                                    tittel: "Storgata 14 — befaring",
                                    kategori: .befaring,
                                    forhaandsvisning: nil,
                                    skala: 1.0, valgt: false, apne: {})
                                merkelapp("Henter blekket")
                            }
                        }
                    }

                    seksjon("Når noe er galt",
                            "De tre tilstandene som tidligere løy: kortet som "
                            + "sto evig i «laster», opptaket som bare lå på "
                            + "iPaden, og opptaket ingen kunne se gikk.") {
                        VStack(alignment: .leading, spacing: 18) {
                            NexusOpptakBanner(
                                startet: Date().addingTimeInterval(-143),
                                nivaa: 0.6,
                                glemSiste: {}, settMarkor: {},
                                antallMarkorer: 3, stopp: {})
                            HStack(alignment: .top, spacing: 18) {
                                VStack(alignment: .leading, spacing: 7) {
                                    NexusNotatKort(
                                        tittel: "Slettet av en kollega",
                                        kategori: nil,
                                        forhaandsvisning: nil,
                                        utilgjengelig: true,
                                        skala: 1.0, valgt: true, apne: {})
                                    merkelapp("Peker på ingenting")
                                }
                                VStack(alignment: .leading, spacing: 7) {
                                    NexusLydKort(
                                        tittel: "Møte 25. sep",
                                        varighet: 212, skala: 1.0,
                                        spiller: spiller, harBlekkSynk: true,
                                        venterPaaOpplasting: true, valgt: true,
                                        startEllerPause: {}, sokTil: { _ in })
                                    merkelapp("Ikke lagret ennå")
                                }
                            }
                        }
                    }

                    seksjon("Lyd som henger i blekket",
                            "PencilKit tidsstempler hvert strøk. Dra i sporet, "
                            + "så lyser blekket du skrev akkurat da.") {
                        VStack(alignment: .leading, spacing: 14) {
                            NexusLydKort(
                                tittel: "Møte 25. sep",
                                varighet: 212,
                                skala: 1.0,
                                spiller: spiller,
                                harBlekkSynk: true,
                                startEllerPause: {},
                                sokTil: { lydTid = $0 })
                            blekkSynkDemo
                        }
                    }

                    seksjon("Video og nettside",
                            "Samme mønster: kortet viser hva innholdet ER, "
                            + "ikke et generisk ikon.") {
                        VStack(alignment: .leading, spacing: 14) {
                            NexusVideoKort(
                                tittel: "Befaring — lager",
                                varighet: 47, miniatyr: nil, skala: 0.9,
                                spillAv: {})
                            NexusNettsideKort(
                                url: "https://proff.no/selskap/neras-direkte",
                                tittel: "Neras Direkte AS — regnskap",
                                skala: 1.0, apne: {})
                        }
                    }

                    seksjon("Arket som spør",
                            "Befaring og lead åpnet før på blankt ark — de to "
                            + "typene der man står hos kunden og skal huske å "
                            + "spørre om fire ting. Nå står spørsmålene der.") {
                        HStack(alignment: .top, spacing: 18) {
                            ForEach([CanvasPapir.befaring, .leadkort]) { papir in
                                VStack(alignment: .leading, spacing: 7) {
                                    PapirView(papir: papir)
                                        .frame(width: 300, height: 220)
                                        .background(CvBrand.card,
                                                    in: RoundedRectangle(cornerRadius: 14))
                                        .overlay(RoundedRectangle(cornerRadius: 14)
                                            .stroke(CvBrand.stroke, lineWidth: 1))
                                    merkelapp(papir.etikett)
                                }
                            }
                        }
                    }

                    seksjon("Hva henger sammen",
                            "Lista er ikke et søk. Den er allerede riktig når "
                            + "du åpner den — utledet fra kunde, sted og møte.") {
                        NexusKoblingerPanel(
                            store: store,
                            leggPaaFlata: { _ in }, apne: { _ in })
                            .frame(height: 430)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                }
                .padding(22)
            }
            .background(CvBrand.bg)
            .navigationTitle("Nexus")
        }
        .preferredColorScheme(.dark)
    }

    /// Viser hva blekk-synken gjør: samme tegning, der «lampen» flytter seg.
    private var blekkSynkDemo: some View {
        let tegning = Self.prøveblekk(strøk: 5)
        let synlige = Int((lydTid / 212 * 5).rounded(.down))
        let opplyst = PKDrawing(strokes: Array(
            tegning.strokes.prefix(max(1, min(5, synlige + 1))).suffix(2)))
        return ZStack(alignment: .topLeading) {
            Image(uiImage: tegning.image(
                from: CGRect(x: 0, y: 0, width: 280, height: 220), scale: 1))
                .resizable().frame(width: 280, height: 220)
                .opacity(0.45)
            Image(uiImage: opplyst.image(
                from: CGRect(x: 0, y: 0, width: 280, height: 220), scale: 1))
                .resizable().frame(width: 280, height: 220)
                .colorMultiply(CvBrand.green)
                .shadow(color: CvBrand.green.opacity(0.9), radius: 9)
                .shadow(color: CvBrand.green.opacity(0.6), radius: 18)
                .animation(.easeOut(duration: 0.2), value: synlige)
        }
        .padding(10)
        .background(CvBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14)
            .stroke(CvBrand.stroke, lineWidth: 1))
    }

    private func merkelapp(_ t: String) -> some View {
        Text(t.uppercased())
            .font(.appScaled(size: 9, weight: .bold))
            .tracking(0.8)
            .foregroundStyle(CvBrand.textTertiary)
    }

    @ViewBuilder
    private func seksjon<Innhold: View>(
        _ tittel: String, _ forklaring: String,
        @ViewBuilder innhold: () -> Innhold
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(tittel)
                .font(.appScaled(size: 19, weight: .bold))
                .foregroundStyle(.white)
            Text(forklaring)
                .font(.appScaled(size: 13))
                .foregroundStyle(CvBrand.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
            innhold()
        }
    }

    @MainActor
    private static func demoStore() -> NexusKoblingerStore {
        let s = NexusKoblingerStore()
        s.demoKoblinger = [
                .init(type: "notat", id: "1", tittel: "Neras Direkte — oppfølging",
                      kilde: "lead", begrunnelse: "Samme kunde",
                      tidspunkt: nil, styrke: 100),
                .init(type: "mote", id: "2", tittel: "Befaring i Storgata 14",
                      kilde: "mote", begrunnelse: "Møte med samme kunde",
                      tidspunkt: nil, styrke: 80),
                .init(type: "notat", id: "3", tittel: "Skisse — kundereise",
                      kilde: "sted", begrunnelse: "40 m unna",
                      tidspunkt: nil, styrke: 60),
                .init(type: "notat", id: "4", tittel: "Første idé, før leadet",
                      kilde: "selskap", begrunnelse: "Samme selskap: Neras Direkte",
                      tidspunkt: nil, styrke: 50),
        ]
        s.demoPersoner = [
            .init(navn: "Sindre Andresen", rolle: "Daglig leder", vekt: 100),
            .init(navn: "Karianne Hjallen", rolle: "Styrets leder", vekt: 80),
        ]
        return s
    }
}

#endif
