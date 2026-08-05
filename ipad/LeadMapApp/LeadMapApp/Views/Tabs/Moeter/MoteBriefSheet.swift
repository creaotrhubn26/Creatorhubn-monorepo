// MoteBriefSheet.swift — AI-møtebriefen («aldri uforberedt til møte»)
//
// Én skjerm som svarer på de tre tingene B2B-kjøpere klager på (82–84 %
// opplever selgere som uforberedte): kan ikke virksomheten (76 %), forstår
// ikke utfordringene (78 %), mangler case (79 %):
//   1. Virksomheten nå — Brreg/regnskap/kjøpssignal (aktive anbud)
//   2. Møteplanen — mål + 3 spørsmål (Gong-prinsippene) + innvendinger
//   3. Innsikt å by på — helst fra org-ens EGNE vunnede case
//
// Demo-modus viser en ferdig demo-brief umiddelbart; ekte modus henter fra
// backend (server-cachet per dag). «Les opp» leser briefen med norsk stemme
// — laget for bilen på vei til møtet.

import SwiftUI
import AVFoundation
import PencilKit

private enum BfBrand {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.08)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
    static let orange = Color(red: 0.98, green: 0.55, blue: 0.10)
    static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let textSecondary = Color.white.opacity(0.65)
    static let textTertiary = Color.white.opacity(0.4)
}

struct MoteBriefSheet: View {
    let selskap: String
    var orgnr: String? = nil
    var kontakt: String? = nil
    var kontaktRolle: String? = nil
    var motetid: String? = nil
    var leadStatus: String? = nil

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    /// «Skissa fra sist»: siste Canvas-notat for selskapet (fase 6 —
    /// sirkelen blir rund visuelt: brief åpner med tegningen din).
    @State private var sisteSkisse: UIImage?

    @State private var brief: MoteBriefDTO?
    @State private var laster = false
    @State private var feil: String?
    @State private var taler = false
    @State private var synth = AVSpeechSynthesizer()

    var body: some View {
        NavigationStack {
            ZStack {
                BfBrand.bg.ignoresSafeArea()
                if let brief {
                    innhold(brief)
                } else if laster {
                    VStack(spacing: 12) {
                        ProgressView().controlSize(.large).tint(BfBrand.purpleLight)
                        Text("Lager møtebrief — Brreg, regnskap, anbud og egne case…")
                            .font(.appScaled(size: 12))
                            .foregroundStyle(BfBrand.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(30)
                } else if let feil {
                    ContentUnavailableView {
                        Label("Kunne ikke lage brief", systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(feil)
                    } actions: {
                        Button("Prøv igjen") { Task { await hent() } }
                            .tint(BfBrand.purpleLight)
                    }
                }
            }
            .navigationTitle("Møtebrief")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { stoppTale(); dismiss() }
                        .tint(BfBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    // Kjøre-modus: les briefen høyt (norsk stemme).
                    Button { talErStopp() } label: {
                        Label(taler ? "Stopp" : "Les opp",
                              systemImage: taler ? "stop.circle.fill" : "speaker.wave.2.fill")
                    }
                    .tint(BfBrand.purpleLight)
                    .disabled(brief == nil)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task { await hent() }
        // «Skissa fra sist»: siste Canvas-notat m/ tegning for selskapet.
        .task {
            guard !DemoModeManager.isActiveNonisolated,
                  let api = appState.api,
                  let notater = try? await api.hentCanvasNotater() else { return }
            guard let match = notater.first(where: {
                ($0.selskap ?? "").caseInsensitiveCompare(selskap) == .orderedSame
                    && !($0.drawingBase64 ?? "").isEmpty
            }), let data = Data(base64Encoded: match.drawingBase64 ?? ""),
               let tegning = try? PKDrawing(data: data),
               !tegning.bounds.isEmpty else { return }
            sisteSkisse = tegning.image(from: tegning.bounds.insetBy(dx: -20, dy: -20),
                                        scale: 1.5)
        }
        .onDisappear { stoppTale() }
    }

    // MARK: Innhold

    private func innhold(_ b: MoteBriefDTO) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // Virksomheten nå — fakta-chips
                VStack(alignment: .leading, spacing: 10) {
                    Text(b.fakta.selskap)
                        .font(.appScaled(size: 18, weight: .bold))
                        .foregroundStyle(.white)
                    FlowChips(chips: faktaChips(b.fakta))
                }
                .padding(14)
                .background(BfBrand.card, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(BfBrand.stroke, lineWidth: 1))

                // Kjøpssignal: selskapet lyser selv ut anbud
                if let anbud = b.fakta.aktiveAnbud, !anbud.isEmpty {
                    seksjon("Kjøpssignal", ikon: "bolt.fill", tint: BfBrand.yellow) {
                        ForEach(anbud, id: \.self) { a in
                            HStack(spacing: 7) {
                                Image(systemName: "doc.text.magnifyingglass")
                                    .font(.appScaled(size: 11))
                                    .foregroundStyle(BfBrand.yellow)
                                Text(a.tittel)
                                    .font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .lineLimit(2)
                                Spacer()
                            }
                        }
                        Text("Selskapet har aktive utlysninger på Doffin — de er i kjøpsmodus.")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(BfBrand.textTertiary)
                    }
                }

                // Skissa fra sist: Canvas-notatet for selskapet, rett i briefen.
                if let skisse = sisteSkisse {
                    seksjon("Skissa fra sist", ikon: "pencil.and.outline",
                            tint: BfBrand.purpleLight) {
                        Image(uiImage: skisse)
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 190)
                            .frame(maxWidth: .infinity)
                            .background(Color.black.opacity(0.35))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10)
                                .stroke(BfBrand.stroke, lineWidth: 1))
                        Button {
                            appState.requestCanvasNotat(selskap: selskap, leadId: nil)
                            dismiss()
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "arrow.up.right.square")
                                    .font(.appScaled(size: 10, weight: .bold))
                                Text("Åpne i Canvas")
                                    .font(.appScaled(size: 11, weight: .bold))
                            }
                            .foregroundStyle(BfBrand.purpleLight)
                        }
                        .buttonStyle(.plain)
                    }
                }

                // Fase 3-sløyfen: løftene fra forrige møte — briefen husker.
                if let forrige = b.fakta.forrigeMote {
                    seksjon("Sist vi møttes (\(forrige.dato))", ikon: "clock.arrow.circlepath",
                            tint: BfBrand.yellow) {
                        briefTekst(forrige.notat)
                        ForEach(forrige.lofter, id: \.self) { l in
                            HStack(alignment: .top, spacing: 7) {
                                Image(systemName: "hand.raised.fill")
                                    .font(.appScaled(size: 10))
                                    .foregroundStyle(BfBrand.yellow)
                                Text("Vi lovte: \(l)")
                                    .font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(.white)
                            }
                        }
                    }
                }
                seksjon("Situasjonen", ikon: "building.2.fill", tint: BfBrand.blue) {
                    briefTekst(b.brief.oppsummering)
                }
                seksjon("Mål for møtet", ikon: "target", tint: BfBrand.green) {
                    briefTekst(b.brief.moteMaal)
                    if let eget = b.fakta.selgersMaal, !eget.isEmpty {
                        Text("Ditt mål: \(eget)")
                            .font(.appScaled(size: 11))
                            .foregroundStyle(BfBrand.textSecondary)
                    } else {
                        // «Møte uten mål»-vakta: forskningen er entydig —
                        // uten definert mål blir det et «bli kjent»-møte.
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.appScaled(size: 10))
                                .foregroundStyle(BfBrand.orange)
                            Text("Du har ikke satt eget mål — sett det i Mål & behov (⋯-menyen).")
                                .font(.appScaled(size: 10, weight: .semibold))
                                .foregroundStyle(BfBrand.orange)
                        }
                    }
                }
                // Behovsbanken: akkumulert kundeforståelse på tvers av møter.
                if let kjente = b.fakta.kjenteBehov, !kjente.isEmpty {
                    seksjon("Kjente behov", ikon: "person.text.rectangle.fill",
                            tint: BfBrand.blue) {
                        ForEach(kjente, id: \.self) { behov in
                            HStack(alignment: .top, spacing: 7) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.appScaled(size: 11))
                                    .foregroundStyle(BfBrand.blue)
                                Text(behov)
                                    .font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(.white)
                            }
                        }
                        Text("Grav videre i disse — ikke spør om det vi allerede vet.")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(BfBrand.textTertiary)
                    }
                }
                seksjon("Still disse spørsmålene", ikon: "questionmark.bubble.fill",
                        tint: BfBrand.purpleLight) {
                    ForEach(Array(b.brief.sporsmal.enumerated()), id: \.offset) { i, q in
                        HStack(alignment: .top, spacing: 9) {
                            Text("\(i + 1)")
                                .font(.appScaled(size: 11, weight: .black))
                                .foregroundStyle(BfBrand.purpleLight)
                                .frame(width: 20, height: 20)
                                .background(BfBrand.purple.opacity(0.2), in: Circle())
                            briefTekst(q)
                        }
                    }
                    Text("Spre dem gjennom samtalen — og lytt mer enn du snakker (57/43).")
                        .font(.appScaled(size: 10))
                        .foregroundStyle(BfBrand.textTertiary)
                }
                seksjon("Innsikt å by på", ikon: "lightbulb.max.fill", tint: BfBrand.orange) {
                    briefTekst(b.brief.innsikt)
                }
                if let innv = b.brief.innvendinger, !innv.isEmpty {
                    seksjon("Sannsynlige innvendinger", ikon: "shield.lefthalf.filled",
                            tint: BfBrand.blue) {
                        ForEach(innv, id: \.self) { iv in
                            VStack(alignment: .leading, spacing: 3) {
                                Text("«\(iv.innvending)»")
                                    .font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(.white)
                                Text(iv.svar)
                                    .font(.appScaled(size: 11))
                                    .foregroundStyle(BfBrand.textSecondary)
                            }
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(BfBrand.cardHi.opacity(0.6),
                                        in: RoundedRectangle(cornerRadius: 9))
                        }
                    }
                }
                if let hint = b.brief.smalltalkHint, !hint.isEmpty {
                    seksjon("Åpningen", ikon: "bubble.left.and.bubble.right.fill",
                            tint: BfBrand.green) {
                        briefTekst(hint)
                    }
                }
                Text("Grunnlag: Brønnøysundregistrene, Regnskapsregisteret, Doffin og organisasjonens egne vunnede case. AI-komponert — verifiser tall før du siterer dem.")
                    .font(.appScaled(size: 9))
                    .foregroundStyle(BfBrand.textTertiary)
                    .padding(.top, 2)
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
                    .foregroundStyle(BfBrand.textSecondary)
                    .tracking(0.7)
            }
            inner()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(BfBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(BfBrand.stroke, lineWidth: 1))
    }

    private func briefTekst(_ s: String) -> some View {
        Text(s)
            .font(.appScaled(size: 13))
            .foregroundStyle(.white)
            .fixedSize(horizontal: false, vertical: true)
    }

    private func faktaChips(_ f: MoteBriefFaktaDTO) -> [String] {
        var chips: [String] = []
        if let n = f.naering { chips.append(n) }
        if let a = f.ansatte { chips.append("\(a) ansatte") }
        if let k = f.kommune { chips.append(k) }
        if let oms = f.omsetning {
            let mnok = oms / 1_000_000
            chips.append(String(format: "Omsetning %.1f MNOK%@", mnok,
                                f.regnskapAar.map { " (\($0))" } ?? ""))
        }
        if let res = f.resultat {
            chips.append(res >= 0 ? "Positivt resultat" : "Negativt resultat")
        }
        if let o = f.orgnr { chips.append("Org.nr \(o)") }
        return chips
    }

    // MARK: Henting

    @MainActor
    private func hent() async {
        guard brief == nil else { return }
        if DemoModeManager.isActiveNonisolated {
            brief = Self.demoBrief(selskap: selskap)
            return
        }
        guard let api = appState.api else {
            feil = "Krever innlogget modus."
            return
        }
        laster = true
        defer { laster = false }
        do {
            brief = try await api.hentMoteBrief(
                selskap: selskap, orgnr: orgnr, kontakt: kontakt,
                kontaktRolle: kontaktRolle, motetid: motetid,
                notater: nil, leadStatus: leadStatus)
        } catch {
            feil = "Sjekk nettet — og at «Møter · AI-møtebrief» er aktivert for organisasjonen din."
        }
    }

    // MARK: Opplesning (kjøre-modus)

    private func talErStopp() {
        if taler { stoppTale(); return }
        guard let b = brief else { return }
        var tekst = "Møtebrief for \(b.fakta.selskap). "
        tekst += b.brief.oppsummering + " "
        tekst += "Målet for møtet: \(b.brief.moteMaal) "
        for (i, q) in b.brief.sporsmal.enumerated() {
            tekst += "Spørsmål \(i + 1): \(q) "
        }
        tekst += "Innsikt å by på: \(b.brief.innsikt)"
        let ytring = AVSpeechUtterance(string: tekst)
        ytring.voice = AVSpeechSynthesisVoice(language: "nb-NO")
        ytring.rate = 0.5
        synth.speak(ytring)
        taler = true
    }

    private func stoppTale() {
        synth.stopSpeaking(at: .immediate)
        taler = false
    }

    // MARK: Demo

    static func demoBrief(selskap: String) -> MoteBriefDTO {
        MoteBriefDTO(
            brief: MoteBriefKjerneDTO(
                oppsummering: "\(selskap) er en elektro-entreprenør i vekst (25–50 ansatte, Oslo) med solid omsetning og positivt resultat. De har nylig lyst ut en rammeavtale på Doffin — de er aktivt i kjøpsmodus.",
                moteMaal: "Avdekk beslutningsprosessen rundt el-anlegget til kontorbygget og avtal befaring med teknisk sjef innen fredag.",
                sporsmal: [
                    "Dere lyste nylig ut en rammeavtale — hva er den viktigste endringen dere prøver å få til i år?",
                    "Hva skjer i dag når et prosjekt sprekker på elektro-leveransen — hvem merker det først?",
                    "Hvis dere skulle valgt leverandør i morgen, hvem mer enn deg måtte vært enig?",
                ],
                innsikt: "Lignende kunde vi vant: Byggmester Hansen kuttet prosjektforsinkelser 30 % ved å samle el-leveransene hos én partner — samme mønster kan passe deres rammeavtale.",
                innvendinger: [
                    MoteBriefInnvendingDTO(
                        innvending: "Vi har allerede en leverandør vi er fornøyd med.",
                        svar: "Spør hva som skulle til for at dagens leverandør ble utfordret — posisjonér som nr. 2 til rammeavtalen."),
                    MoteBriefInnvendingDTO(
                        innvending: "Dette er ikke prioritert før neste kvartal.",
                        svar: "Koble til anbudsfristen deres — beslutningsgrunnlaget må uansett lages nå."),
                ],
                smalltalkHint: "Kontoret ligger rett ved den nye Vitaminveien-utbyggingen — spør hvordan byggeperioden har påvirket dem."),
            fakta: MoteBriefFaktaDTO(
                selskap: selskap, orgnr: "912345678", ansatte: 38,
                naering: "Elektrisk installasjonsarbeid", kommune: "Oslo",
                omsetning: 48_500_000, resultat: 3_200_000, regnskapAar: 2025,
                aktiveAnbud: [MoteBriefAnbudDTO(
                    tittel: "Rammeavtale elektrikertjenester 2026–2028",
                    frist: nil)],
                forrigeMote: MoteBriefForrigeMoteDTO(
                    dato: "2026-07-21",
                    notat: "Første møte: kartla behovet for samlet el-leveranse; positiv daglig leder, teknisk sjef må med videre.",
                    lofter: ["Sende referanseliste fra lignende prosjekter",
                             "Komme tilbake med prisindikasjon på rammeavtale"]),
                selgersMaal: "Avdekk beslutningsprosessen og avtal befaring med teknisk sjef innen fredag.",
                kjenteBehov: ["Kortere responstid på service",
                              "Samlet el-leveranse i én avtale"]))
    }
}

/// Enkel flow-layout for fakta-chips.
private struct FlowChips: View {
    let chips: [String]
    var body: some View {
        FlexWrap(spacing: 6) {
            ForEach(chips, id: \.self) { c in
                Text(c)
                    .font(.appScaled(size: 10, weight: .semibold))
                    .foregroundStyle(BfBrand.textSecondary)
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(BfBrand.cardHi, in: Capsule())
                    .overlay(Capsule().stroke(BfBrand.stroke, lineWidth: 1))
            }
        }
    }
}

/// Minimal wrap-layout (iOS 16+ Layout) — chips brytes over flere linjer.
private struct FlexWrap: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maks = proposal.width ?? 320
        var x: CGFloat = 0, y: CGFloat = 0, radH: CGFloat = 0
        for sub in subviews {
            let s = sub.sizeThatFits(.unspecified)
            if x + s.width > maks, x > 0 { x = 0; y += radH + spacing; radH = 0 }
            x += s.width + spacing
            radH = max(radH, s.height)
        }
        return CGSize(width: maks, height: y + radH)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maks = bounds.width
        var x: CGFloat = 0, y: CGFloat = 0, radH: CGFloat = 0
        for sub in subviews {
            let s = sub.sizeThatFits(.unspecified)
            if x + s.width > maks, x > 0 { x = 0; y += radH + spacing; radH = 0 }
            sub.place(at: CGPoint(x: bounds.minX + x, y: bounds.minY + y),
                      proposal: ProposedViewSize(s))
            x += s.width + spacing
            radH = max(radH, s.height)
        }
    }
}
