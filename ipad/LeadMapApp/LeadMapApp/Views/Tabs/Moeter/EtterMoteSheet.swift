// EtterMoteSheet.swift — møtemodus + etterarbeidet («hukommelsen og farten»)
//
// Fase 2+3 av møteopplevelsen. Forskningsgrunnlag: 80 % av møtet er glemt
// innen 24 timer (hos kjøperen også), oppfølging innen én time gir 7×
// høyere kvalifisering — og selgere bruker 10–15 min på CRM-plotting per
// møte, som derfor ofte droppes.
//
//   UNDER møtet:  live-transkripsjon (gjenbruker Leadbook-motoren, nb-NO,
//                 auto sky-fallback) og/eller skrevne notater.
//   ETTER møtet:  «Analyser møtet» → strukturert notat + løftene VI ga +
//                 oppgaver m/ frist + ferdig oppfølgings-epost-UTKAST
//                 (aldri auto-send) — klart før parkeringsplassen.
//
// Backend logger møtet → NESTE møtebrief åpner med «hva vi lovte sist».

import SwiftUI

private enum EmBrand {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.08)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
    static let red = Color(red: 0.95, green: 0.30, blue: 0.30)
    static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let textSecondary = Color.white.opacity(0.65)
    static let textTertiary = Color.white.opacity(0.4)
}

struct EtterMoteSheet: View {
    let selskap: String
    var kontakt: String? = nil
    var kontaktEpost: String? = nil
    var moteMaal: String? = nil

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @StateObject private var tale = LiveTranscriptionEngine()
    @State private var notatTekst = ""
    @State private var resultat: EtterarbeidDTO?
    @State private var analyserer = false
    @State private var feil: String?
    @State private var epostKopiert = false

    var body: some View {
        NavigationStack {
            ZStack {
                EmBrand.bg.ignoresSafeArea()
                if let resultat {
                    resultatVisning(resultat)
                } else {
                    fangstVisning
                }
            }
            .navigationTitle(resultat == nil ? "Møtet — \(selskap)" : "Etterarbeid")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") {
                        if tale.isRecording { tale.stop() }
                        dismiss()
                    }
                    .tint(EmBrand.textSecondary)
                }
            }
        }
        .preferredColorScheme(.dark)
        .onDisappear { if tale.isRecording { tale.stop() } }
    }

    // MARK: Fangst (under møtet)

    private var samletTekst: String {
        [tale.transcript, tale.liveSegment, notatTekst]
            .filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .joined(separator: "\n")
    }

    private var fangstVisning: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // Live-transkripsjon (Leadbook-motoren)
                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        Image(systemName: "waveform")
                            .font(.appScaled(size: 12, weight: .bold))
                            .foregroundStyle(tale.isRecording ? EmBrand.red : EmBrand.purpleLight)
                        Text(tale.isRecording
                             ? "Transkriberer… \(tidsFormat(tale.elapsedSeconds))"
                             : "Transkriber møtet")
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                        if tale.usingCloudFallback {
                            Text("sky")
                                .font(.appScaled(size: 9, weight: .bold))
                                .foregroundStyle(EmBrand.yellow)
                                .padding(.horizontal, 6).padding(.vertical, 2)
                                .background(EmBrand.yellow.opacity(0.15), in: Capsule())
                        }
                        Spacer()
                        Button {
                            if tale.isRecording { tale.stop() }
                            else { Task { await tale.requestPermissions(); tale.start() } }
                        } label: {
                            Image(systemName: tale.isRecording ? "stop.circle.fill" : "mic.circle.fill")
                                .font(.appScaled(size: 26))
                                .foregroundStyle(tale.isRecording ? EmBrand.red : EmBrand.purpleLight)
                        }
                        .buttonStyle(.plain)
                    }
                    if !tale.transcript.isEmpty || !tale.liveSegment.isEmpty {
                        Text(tale.transcript + (tale.liveSegment.isEmpty ? "" : " \(tale.liveSegment)"))
                            .font(.appScaled(size: 12))
                            .foregroundStyle(EmBrand.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10)
                            .background(EmBrand.cardHi.opacity(0.6),
                                        in: RoundedRectangle(cornerRadius: 9))
                    }
                    if let taleFeil = tale.error {
                        Text(taleFeil)
                            .font(.appScaled(size: 10))
                            .foregroundStyle(EmBrand.red)
                    }
                }
                .padding(14)
                .background(EmBrand.card, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(EmBrand.stroke, lineWidth: 1))

                // Skrevne notater (i tillegg eller i stedet)
                VStack(alignment: .leading, spacing: 8) {
                    Text("NOTATER")
                        .font(.appScaled(size: 10, weight: .black))
                        .foregroundStyle(EmBrand.textSecondary)
                        .tracking(0.7)
                    TextEditor(text: $notatTekst)
                        .font(.appScaled(size: 13))
                        .foregroundStyle(.white)
                        .scrollContentBackground(.hidden)
                        .frame(minHeight: 120)
                        .padding(8)
                        .background(EmBrand.cardHi.opacity(0.6),
                                    in: RoundedRectangle(cornerRadius: 9))
                }
                .padding(14)
                .background(EmBrand.card, in: RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(EmBrand.stroke, lineWidth: 1))

                if let feil {
                    Text(feil)
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(EmBrand.red)
                }

                // Analyser — hele etterarbeidet i ett trykk.
                Button { Task { await analyser() } } label: {
                    HStack(spacing: 7) {
                        if analyserer {
                            ProgressView().controlSize(.small).tint(.white)
                        } else {
                            Image(systemName: "sparkles")
                                .font(.appScaled(size: 13, weight: .bold))
                        }
                        Text(analyserer ? "Analyserer møtet…" : "Analyser møtet")
                            .font(.appScaled(size: 14, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(
                        LinearGradient(colors: [EmBrand.purple, EmBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 12))
                    .opacity(kanAnalysere ? 1 : 0.4)
                }
                .buttonStyle(.plain)
                .disabled(!kanAnalysere || analyserer)

                Text("Notat, løfter, oppgaver og oppfølgings-epost genereres — og løftene huskes til neste møtebrief. E-posten er alltid et utkast; ingenting sendes automatisk.")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(EmBrand.textTertiary)
            }
            .padding(16)
        }
    }

    private var kanAnalysere: Bool {
        samletTekst.trimmingCharacters(in: .whitespacesAndNewlines).count >= 20
            || DemoModeManager.isActiveNonisolated
    }

    // MARK: Resultat (etter møtet)

    private func resultatVisning(_ r: EtterarbeidDTO) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                // Måloppnåelse: ærlig vurdering mot selgerens eget mål.
                if let vurdering = r.maalVurdering, !vurdering.isEmpty {
                    seksjon("Måloppnåelse", ikon: "target", tint: maalTint(vurdering)) {
                        Text(vurdering)
                            .font(.appScaled(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                seksjon("Møtenotat", ikon: "doc.text.fill", tint: EmBrand.blue) {
                    Text(r.notat)
                        .font(.appScaled(size: 13))
                        .foregroundStyle(.white)
                        .fixedSize(horizontal: false, vertical: true)
                }
                // Behovsbanken: det møtet lærte oss om kunden.
                if let nye = r.nyeBehov, !nye.isEmpty {
                    seksjon("Nye behov", ikon: "person.text.rectangle.fill", tint: EmBrand.blue) {
                        ForEach(nye, id: \.self) { b in
                            HStack(alignment: .top, spacing: 7) {
                                Image(systemName: "plus.circle.fill")
                                    .font(.appScaled(size: 11))
                                    .foregroundStyle(EmBrand.blue)
                                Text(b)
                                    .font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(.white)
                            }
                        }
                        Text("Lagt i behovsbanken — neste møtebrief graver videre i disse.")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(EmBrand.textTertiary)
                    }
                }
                if let lofter = r.lofter, !lofter.isEmpty {
                    seksjon("Det vi lovte", ikon: "hand.raised.fill", tint: EmBrand.yellow) {
                        ForEach(lofter, id: \.self) { l in
                            HStack(alignment: .top, spacing: 7) {
                                Image(systemName: "checkmark.seal")
                                    .font(.appScaled(size: 11))
                                    .foregroundStyle(EmBrand.yellow)
                                Text(l)
                                    .font(.appScaled(size: 12))
                                    .foregroundStyle(.white)
                            }
                        }
                        Text("Huskes automatisk — neste møtebrief åpner med disse.")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(EmBrand.textTertiary)
                    }
                }
                if let oppgaver = r.oppgaver, !oppgaver.isEmpty {
                    seksjon("Oppgaver", ikon: "checklist", tint: EmBrand.green) {
                        ForEach(oppgaver, id: \.self) { o in
                            HStack(spacing: 7) {
                                Image(systemName: "circle")
                                    .font(.appScaled(size: 10))
                                    .foregroundStyle(EmBrand.green)
                                Text(o.tittel)
                                    .font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(.white)
                                Spacer()
                                if let f = o.frist, !f.isEmpty {
                                    Text(f)
                                        .font(.appScaled(size: 10, weight: .bold))
                                        .foregroundStyle(EmBrand.green)
                                        .padding(.horizontal, 7).padding(.vertical, 3)
                                        .background(EmBrand.green.opacity(0.15), in: Capsule())
                                }
                            }
                        }
                    }
                }
                if let epost = r.epost {
                    seksjon("Oppfølgings-epost (utkast)", ikon: "envelope.fill",
                            tint: EmBrand.purpleLight) {
                        Text(epost.emne)
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(.white)
                        Text(epost.brodtekst)
                            .font(.appScaled(size: 12))
                            .foregroundStyle(EmBrand.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                        HStack(spacing: 8) {
                            Button {
                                UIPasteboard.general.string = "\(epost.emne)\n\n\(epost.brodtekst)"
                                epostKopiert = true
                            } label: {
                                Label(epostKopiert ? "Kopiert" : "Kopier",
                                      systemImage: epostKopiert ? "checkmark" : "doc.on.doc")
                                    .font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 12).padding(.vertical, 8)
                                    .background(EmBrand.cardHi, in: RoundedRectangle(cornerRadius: 9))
                                    .overlay(RoundedRectangle(cornerRadius: 9)
                                        .stroke(EmBrand.stroke, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                            Button { aapneIMail(epost) } label: {
                                Label("Åpne i Mail", systemImage: "paperplane.fill")
                                    .font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 12).padding(.vertical, 8)
                                    .background(EmBrand.purple.opacity(0.35),
                                                in: RoundedRectangle(cornerRadius: 9))
                                    .overlay(RoundedRectangle(cornerRadius: 9)
                                        .stroke(EmBrand.purple.opacity(0.5), lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                        Text("Send innen timen — 80 % av møtet er glemt innen 24 timer.")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(EmBrand.textTertiary)
                    }
                }
                Button { dismiss() } label: {
                    Text("Ferdig")
                        .font(.appScaled(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(
                            LinearGradient(colors: [EmBrand.purple, EmBrand.purpleLight],
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
                    .foregroundStyle(EmBrand.textSecondary)
                    .tracking(0.7)
            }
            inner()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EmBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(EmBrand.stroke, lineWidth: 1))
    }

    // MARK: Handlinger

    @MainActor
    private func analyser() async {
        if tale.isRecording { tale.stop() }
        feil = nil
        if DemoModeManager.isActiveNonisolated {
            resultat = Self.demoResultat(selskap: selskap, kontakt: kontakt)
            return
        }
        guard let api = appState.api else {
            feil = "Krever innlogget modus."
            return
        }
        analyserer = true
        defer { analyserer = false }
        do {
            resultat = try await api.sendMoteEtterarbeid(
                selskap: selskap, tekst: samletTekst,
                kontakt: kontakt, moteMaal: moteMaal)
        } catch {
            feil = "Analysen feilet — sjekk nettet, og at «Møter · AI-møtebrief» er aktivert for organisasjonen."
        }
    }

    private func aapneIMail(_ epost: EtterarbeidEpostDTO) {
        let til = kontaktEpost ?? ""
        var comps = URLComponents(string: "mailto:\(til)")
        comps?.queryItems = [
            URLQueryItem(name: "subject", value: epost.emne),
            URLQueryItem(name: "body", value: epost.brodtekst),
        ]
        if let url = comps?.url { UIApplication.shared.open(url) }
    }

    private func tidsFormat(_ s: Int) -> String {
        String(format: "%d:%02d", s / 60, s % 60)
    }

    private func maalTint(_ vurdering: String) -> Color {
        let v = vurdering.lowercased()
        if v.hasPrefix("nådd") { return EmBrand.green }
        if v.hasPrefix("delvis") { return EmBrand.yellow }
        return EmBrand.red
    }

    // MARK: Demo

    static func demoResultat(selskap: String, kontakt: String?) -> EtterarbeidDTO {
        EtterarbeidDTO(
            notat: "Godt møte hos \(selskap): de skal samle el-leveransene i én rammeavtale fra Q4 og er misfornøyde med responstiden hos dagens leverandør. \(kontakt ?? "Kontakten") er positiv, men teknisk sjef må godkjenne. Neste steg er befaring av kontorbygget og et prisforslag på rammeavtalen.",
            lofter: [
                "Sende prisforslag på rammeavtale innen torsdag",
                "Ta med referanse fra Byggmester Hansen-prosjektet",
            ],
            oppgaver: [
                EtterarbeidOppgaveDTO(tittel: "Prisforslag rammeavtale", frist: "torsdag"),
                EtterarbeidOppgaveDTO(tittel: "Book befaring med teknisk sjef", frist: "neste uke"),
            ],
            statusForslag: "tilbud_sendes",
            epost: EtterarbeidEpostDTO(
                emne: "Takk for møtet i dag — neste steg",
                brodtekst: "Hei \(kontakt ?? "")!\n\nTakk for et godt møte i dag. Som avtalt sender jeg prisforslag på rammeavtalen innen torsdag, sammen med referansen fra et tilsvarende prosjekt.\n\nForeslår at vi booker befaringen med teknisk sjef i neste uke — jeg sender noen tidspunkter i morgen.\n\nMvh"),
            maalVurdering: "Delvis nådd: befaring er avtalt i prinsippet, men teknisk sjef er ennå ikke booket inn.",
            nyeBehov: ["Rask oppstart før Q4", "Én kontaktperson for hele leveransen"])
    }
}
