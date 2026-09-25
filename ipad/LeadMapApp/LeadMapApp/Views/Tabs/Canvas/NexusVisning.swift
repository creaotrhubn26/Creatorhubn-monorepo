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

    var body: some View {
        if barePanel {
            NavigationStack {
                NexusKoblingerPanel(
                    store: Self.demoStore(),
                    leggPaaFlata: { _ in }, apne: { _ in })
                    .navigationTitle("Henger sammen")
                    .navigationBarTitleDisplayMode(.inline)
            }
            .preferredColorScheme(.dark)
        } else {
            hovedflate
        }
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

                    seksjon("Hva henger sammen",
                            "Lista er ikke et søk. Den er allerede riktig når "
                            + "du åpner den — utledet fra kunde, sted og møte.") {
                        NexusKoblingerPanel(
                            store: Self.demoStore(),
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
