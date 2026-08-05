// CanvasView.swift — Leadgrid Canvas fase 1 (2026-08-05)
//
// Pencil-first notater koblet til leads: notatliste + PencilKit-tegneflate
// (PKToolPicker gir penn/marker/viskelær/farger/linjal), kategori-chips og
// lead-kobling. Differensiatoren mot Apple Notes er at notatet VET hvilken
// kunde det gjelder — fase 2 kobler det inn i møtesløyfa (logg + brief).
//
// Persistering: leadgrid_canvas_notater (org+bruker) via APIClient+Canvas.
// Demo-modus: in-memory (aldri backend).

import CoreLocation
import PencilKit
import SwiftUI
import Vision

private enum CvBrand {
    static let bg = Color(red: 0.05, green: 0.04, blue: 0.10)
    static let card = Color(red: 0.10, green: 0.09, blue: 0.16)
    static let cardHi = Color(red: 0.13, green: 0.11, blue: 0.20)
    static let stroke = Color.white.opacity(0.08)
    static let purple = Color(red: 0.66, green: 0.32, blue: 0.99)
    static let purpleLight = Color(red: 0.75, green: 0.45, blue: 1.0)
    static let green = Color(red: 0.20, green: 0.85, blue: 0.60)
    static let yellow = Color(red: 0.98, green: 0.75, blue: 0.14)
    static let orange = Color(red: 0.98, green: 0.55, blue: 0.20)
    static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let textSecondary = Color.white.opacity(0.65)
    static let textTertiary = Color.white.opacity(0.4)
}

/// Kategoriene fra design-mocken — farge + etikett per chip.
enum CanvasKategori: String, CaseIterable, Identifiable {
    case mote = "mote"
    case oppfolging = "oppfolging"
    case rute = "rute"
    case ide = "ide"
    case kunde = "kunde"
    case internt = "internt"

    var id: String { rawValue }

    var etikett: String {
        switch self {
        case .mote: return "Møte"
        case .oppfolging: return "Oppfølging"
        case .rute: return "Rute"
        case .ide: return "Idé"
        case .kunde: return "Kunde"
        case .internt: return "Internt"
        }
    }

    var farge: Color {
        switch self {
        case .mote: return CvBrand.purpleLight
        case .oppfolging: return CvBrand.blue
        case .rute: return CvBrand.green
        case .ide: return CvBrand.yellow
        case .kunde: return CvBrand.orange
        case .internt: return CvBrand.textSecondary
        }
    }
}

/// Klistremerke/stempel oppå tegneflata (fase 4) — posisjon i canvas-
/// punkter, persistert som JSON ved siden av tegningen.
struct CanvasStempel: Codable, Identifiable, Hashable {
    var id: String = UUID().uuidString
    var tegn: String       // emoji
    var x: Double
    var y: Double
}

/// Paletten fra design-mocken («Klistremerker»).
let canvasStempelPalett = ["📍", "⭐️", "✅", "⚠️", "💡", "🔥"]

/// Flyttbar tekstboks oppå flata (fase 5) — «Skriv»-modusen fra mocken.
struct CanvasTekstboks: Codable, Identifiable, Hashable {
    var id: String = UUID().uuidString
    var tekst: String
    var x: Double
    var y: Double
}

/// Lokal notat-modell (speiler CanvasNotatDTO; drawing som rå PKDrawing-data).
struct CanvasNotat: Identifiable, Hashable {
    var id: String
    var tittel: String
    var kategori: CanvasKategori
    var selskap: String?
    var leadId: String?
    var drawingData: Data
    var oppdatert: Date
    /// Opprettet lokalt, ikke lagret i backend enda.
    var erNy: Bool = false
    /// Fase 2 (deling): synlig for hele org-en. Andres delte notater er
    /// read-only (backend-PUT er bruker-scopet uansett).
    var delt: Bool = false
    var erMin: Bool = true
    var eierNavn: String? = nil
    /// Fase 4: hvor notatet ble til + stempel-overlay.
    var lat: Double? = nil
    var lon: Double? = nil
    var stempler: [CanvasStempel] = []
    var tekstbokser: [CanvasTekstboks] = []
}

struct CanvasView: View {
    @Environment(AppState.self) private var appState

    @State private var notater: [CanvasNotat] = []
    @State private var valgtId: String?
    @State private var kategoriFilter: CanvasKategori?
    @State private var lastet = false
    @State private var lagrer = false
    @State private var lagretToast = false

    // Editor-state for valgt notat (kopieres inn/ut ved bytte).
    @State private var tittel = ""
    @State private var kategori: CanvasKategori = .mote
    @State private var kobletLeadId: String?
    @State private var kobletSelskap: String?
    @State private var drawing = PKDrawing()
    @State private var deltMedTeam = false
    @State private var sok = ""
    @State private var visAnalyse = false
    @State private var stempler: [CanvasStempel] = []
    @State private var tekstbokser: [CanvasTekstboks] = []
    @State private var notatLat: Double?
    @State private var notatLon: Double?
    @State private var visStempelPalett = false
    @State private var visFormPalett = false
    @State private var redigererTekstboks: CanvasTekstboks?
    /// Miniatyrer per notat — regenereres når oppdatert-tid endres.
    @State private var thumbs: [String: UIImage] = [:]

    private var isDemo: Bool { DemoModeManager.isActiveNonisolated }

    private var filtrerte: [CanvasNotat] {
        var liste = kategoriFilter.map { f in notater.filter { $0.kategori == f } } ?? notater
        let q = sok.trimmingCharacters(in: .whitespaces)
        if !q.isEmpty {
            liste = liste.filter {
                $0.tittel.localizedCaseInsensitiveContains(q)
                    || ($0.selskap ?? "").localizedCaseInsensitiveContains(q)
            }
        }
        return liste.sorted { $0.oppdatert > $1.oppdatert }
    }

    /// Er notatet i editoren mitt eget (redigerbart)?
    private var valgtErMin: Bool {
        guard let id = valgtId else { return true }
        return notater.first(where: { $0.id == id })?.erMin ?? true
    }

    var body: some View {
        GatedView(feature: .leadgridCanvas) {
            innhold
        }
        .background(CvBrand.bg)
        .task { await lastInn() }
        // Møter «Tegn i Canvas» → åpne/opprett notat koblet til selskapet.
        .task(id: appState.pendingCanvasRequestedAt) {
            guard let at = appState.pendingCanvasRequestedAt,
                  Date().timeIntervalSince(at) < 60,
                  let selskap = appState.pendingCanvasSelskap else { return }
            let leadId = appState.pendingCanvasLeadId
            appState.clearCanvasDeepLink()
            if !lastet { await lastInn() }
            // Gjenbruk siste notat for selskapet — ellers nytt, pre-koblet.
            if let eksisterende = notater.first(where: {
                $0.erMin && ($0.selskap ?? "").caseInsensitiveCompare(selskap) == .orderedSame
            }) {
                velg(eksisterende)
            } else {
                nyttNotat()
                tittel = "Møte med \(selskap)"
                kategori = .mote
                kobletSelskap = selskap
                kobletLeadId = leadId
            }
        }
    }

    private var innhold: some View {
        HStack(spacing: 0) {
            notatListe
                .frame(width: 300)
            Divider().overlay(CvBrand.stroke)
            if valgtId != nil {
                editor
            } else {
                tomEditor
            }
        }
    }

    // MARK: Venstre kolonne — liste

    private var notatListe: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Image(systemName: "pencil.and.outline")
                    .font(.appScaled(size: 16, weight: .bold))
                    .foregroundStyle(CvBrand.purpleLight)
                Text("Canvas")
                    .font(.appScaled(size: 19, weight: .black))
                    .foregroundStyle(.white)
                Spacer()
                Button { nyttNotat() } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "plus")
                            .font(.appScaled(size: 11, weight: .black))
                        Text("Nytt")
                            .font(.appScaled(size: 12, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(
                        LinearGradient(colors: [CvBrand.purple, CvBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule())
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 10)

            // Søk (tittel/selskap)
            HStack(spacing: 7) {
                Image(systemName: "magnifyingglass")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(CvBrand.textTertiary)
                TextField("Søk i notater …", text: $sok)
                    .font(.appScaled(size: 12))
                    .foregroundStyle(.white)
                    .textFieldStyle(.plain)
                if !sok.isEmpty {
                    Button { sok = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.appScaled(size: 12))
                            .foregroundStyle(CvBrand.textTertiary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 10).padding(.vertical, 8)
            .background(CvBrand.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(CvBrand.stroke, lineWidth: 1))
            .padding(.horizontal, 16).padding(.bottom, 10)

            // Kategori-filter
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    filterChip(nil, etikett: "Alle")
                    ForEach(CanvasKategori.allCases) { k in
                        filterChip(k, etikett: k.etikett)
                    }
                }
                .padding(.horizontal, 16)
            }
            .padding(.bottom, 10)

            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(filtrerte) { n in
                        notatRad(n)
                    }
                    if filtrerte.isEmpty && lastet {
                        VStack(spacing: 8) {
                            Image(systemName: "pencil.tip.crop.circle")
                                .font(.appScaled(size: 28))
                                .foregroundStyle(CvBrand.textTertiary)
                            Text("Ingen notater enda — trykk «Nytt» og tegn i vei.")
                                .font(.appScaled(size: 12))
                                .foregroundStyle(CvBrand.textSecondary)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.top, 40).padding(.horizontal, 20)
                    }
                }
                .padding(.horizontal, 12).padding(.bottom, 16)
            }
        }
        .background(CvBrand.bg)
    }

    private func filterChip(_ k: CanvasKategori?, etikett: String) -> some View {
        let aktiv = kategoriFilter == k
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { kategoriFilter = k }
        } label: {
            Text(etikett)
                .font(.appScaled(size: 11, weight: .bold))
                .foregroundStyle(aktiv ? .white : CvBrand.textSecondary)
                .padding(.horizontal, 11).padding(.vertical, 6)
                .background(aktiv ? CvBrand.purple.opacity(0.4) : CvBrand.card,
                            in: Capsule())
                .overlay(Capsule().stroke(
                    aktiv ? CvBrand.purple.opacity(0.6) : CvBrand.stroke, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func notatRad(_ n: CanvasNotat) -> some View {
        let aktiv = n.id == valgtId
        return Button { velg(n) } label: {
            HStack(spacing: 10) {
            // Miniatyr av tegningen (genereres asynkront, caches).
            Group {
                if let img = thumbs[n.id] {
                    Image(uiImage: img)
                        .resizable().scaledToFill()
                } else {
                    Image(systemName: "scribble.variable")
                        .font(.appScaled(size: 14))
                        .foregroundStyle(CvBrand.textTertiary)
                }
            }
            .frame(width: 46, height: 46)
            .background(Color.black.opacity(0.35))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(CvBrand.stroke, lineWidth: 1))
            VStack(alignment: .leading, spacing: 6) {
                Text(n.tittel.isEmpty ? "Uten tittel" : n.tittel)
                    .font(.appScaled(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(n.kategori.etikett)
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(n.kategori.farge)
                        .padding(.horizontal, 7).padding(.vertical, 2)
                        .background(n.kategori.farge.opacity(0.15), in: Capsule())
                    if !n.erMin, let eier = n.eierNavn, !eier.isEmpty {
                        Text(eier)
                            .font(.appScaled(size: 9, weight: .bold))
                            .foregroundStyle(CvBrand.blue)
                            .padding(.horizontal, 7).padding(.vertical, 2)
                            .background(CvBrand.blue.opacity(0.15), in: Capsule())
                            .lineLimit(1)
                    } else if n.delt {
                        Image(systemName: "person.2.fill")
                            .font(.appScaled(size: 9))
                            .foregroundStyle(CvBrand.blue)
                    }
                    if let selskap = n.selskap, !selskap.isEmpty {
                        Text(selskap)
                            .font(.appScaled(size: 10))
                            .foregroundStyle(CvBrand.textSecondary)
                            .lineLimit(1)
                    }
                    Spacer(minLength: 4)
                    Text(Self.kortDato(n.oppdatert))
                        .font(.appScaled(size: 9))
                        .foregroundStyle(CvBrand.textTertiary)
                }
            }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(aktiv ? CvBrand.purple.opacity(0.14) : CvBrand.card,
                        in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(
                aktiv ? CvBrand.purple.opacity(0.5) : CvBrand.stroke, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            if n.erMin {
                Button(role: .destructive) { slett(n) } label: {
                    Label("Slett notat", systemImage: "trash")
                }
            }
        }
    }

    // MARK: Høyre kolonne — editor

    private var tomEditor: some View {
        VStack(spacing: 12) {
            Image(systemName: "pencil.and.outline")
                .font(.appScaled(size: 42))
                .foregroundStyle(CvBrand.purple.opacity(0.5))
            Text("Velg et notat — eller lag et nytt")
                .font(.appScaled(size: 15, weight: .bold))
                .foregroundStyle(.white)
            Text("Tegn med Apple Pencil eller fingeren. Koble notatet til en lead, så finner du det igjen der det hører hjemme.")
                .font(.appScaled(size: 12))
                .foregroundStyle(CvBrand.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 340)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var editor: some View {
        VStack(spacing: 0) {
            // Topp: tittel + kategori + lead-kobling + lagre
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    TextField("Tittel på notatet", text: $tittel)
                        .font(.appScaled(size: 17, weight: .bold))
                        .foregroundStyle(.white)
                        .textFieldStyle(.plain)
                    Spacer()
                    // Fase 3: håndskrift → tekst → AI (oppgaver + møtelogg).
                    Button { visAnalyse = true } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "sparkles")
                                .font(.appScaled(size: 12, weight: .bold))
                            Text("Analyser")
                                .font(.appScaled(size: 13, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 9)
                        .background(CvBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                        .overlay(RoundedRectangle(cornerRadius: 10)
                            .stroke(CvBrand.purple.opacity(0.5), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    Button { Task { await lagre() } } label: {
                        HStack(spacing: 6) {
                            if lagrer {
                                ProgressView().controlSize(.small).tint(.white)
                            } else {
                                Image(systemName: lagretToast
                                      ? "checkmark" : "square.and.arrow.down.fill")
                                    .font(.appScaled(size: 12, weight: .bold))
                            }
                            Text(lagretToast ? "Lagret" : "Lagre")
                                .font(.appScaled(size: 13, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14).padding(.vertical, 9)
                        .background(lagretToast
                                    ? CvBrand.green.opacity(0.4)
                                    : CvBrand.purple,
                                    in: RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                    .disabled(lagrer)
                }
                if !valgtErMin {
                    HStack(spacing: 6) {
                        Image(systemName: "eye.fill")
                            .font(.appScaled(size: 10, weight: .bold))
                        Text("Delt av \(notater.first(where: { $0.id == valgtId })?.eierNavn ?? "kollega") — kun visning")
                            .font(.appScaled(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(CvBrand.blue)
                }
                HStack(spacing: 8) {
                    // Del med teamet (kun egne notater)
                    if valgtErMin {
                        Button {
                            deltMedTeam.toggle()
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: deltMedTeam
                                      ? "person.2.fill" : "person.2")
                                    .font(.appScaled(size: 10, weight: .bold))
                                Text(deltMedTeam ? "Delt" : "Del")
                                    .font(.appScaled(size: 11, weight: .bold))
                            }
                            .foregroundStyle(deltMedTeam ? CvBrand.blue : CvBrand.textSecondary)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(deltMedTeam
                                        ? CvBrand.blue.opacity(0.15) : CvBrand.cardHi,
                                        in: Capsule())
                            .overlay(Capsule().stroke(
                                deltMedTeam ? CvBrand.blue.opacity(0.4) : CvBrand.stroke,
                                lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                        .help("Del notatet med hele teamet (kun visning for andre)")
                    }
                    // Kategori-velger
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(CanvasKategori.allCases) { k in
                                Button {
                                    kategori = k
                                } label: {
                                    Text(k.etikett)
                                        .font(.appScaled(size: 10, weight: .bold))
                                        .foregroundStyle(kategori == k ? .white : k.farge)
                                        .padding(.horizontal, 9).padding(.vertical, 5)
                                        .background(kategori == k
                                                    ? k.farge.opacity(0.5)
                                                    : k.farge.opacity(0.12),
                                                    in: Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    Spacer(minLength: 8)
                    // Stedfestet: forhåndsvis posisjonen på Kart-fanen.
                    if let lat = notatLat, let lon = notatLon {
                        Button {
                            appState.requestNavigation(
                                lat: lat, lon: lon,
                                name: tittel.isEmpty ? "Canvas-notat" : tittel,
                                address: kobletSelskap ?? "",
                                start: false)
                        } label: {
                            Image(systemName: "mappin.circle.fill")
                                .font(.appScaled(size: 15))
                                .foregroundStyle(CvBrand.orange)
                        }
                        .buttonStyle(.plain)
                        .help("Notatet ble til her — vis på kartet")
                    }
                    // Del tegningen som bilde eller PDF (stempler+tekst inn).
                    if !drawing.bounds.isEmpty {
                        Menu {
                            ShareLink(
                                item: Image(uiImage: komponertBilde()),
                                preview: SharePreview(
                                    tittel.isEmpty ? "Canvas-notat" : tittel,
                                    image: Image(uiImage: komponertBilde()))
                            ) {
                                Label("Del som bilde", systemImage: "photo")
                            }
                            if let pdfURL = pdfFil() {
                                ShareLink(item: pdfURL) {
                                    Label("Del som PDF", systemImage: "doc.richtext")
                                }
                            }
                        } label: {
                            Image(systemName: "square.and.arrow.up")
                                .font(.appScaled(size: 13, weight: .bold))
                                .foregroundStyle(CvBrand.textSecondary)
                                .frame(width: 30, height: 30)
                                .background(CvBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                        }
                    }
                    leadKobling
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(CvBrand.card)

            Divider().overlay(CvBrand.stroke)

            // Stempel-palett («Klistremerker» fra design-mocken).
            if valgtErMin {
                HStack(spacing: 8) {
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            visStempelPalett.toggle()
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "seal.fill")
                                .font(.appScaled(size: 10, weight: .bold))
                            Text("Stempler")
                                .font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(visStempelPalett ? .white : CvBrand.textSecondary)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(visStempelPalett
                                    ? CvBrand.purple.opacity(0.4) : CvBrand.cardHi,
                                    in: Capsule())
                    }
                    .buttonStyle(.plain)
                    if visStempelPalett {
                        ForEach(canvasStempelPalett, id: \.self) { tegn in
                            Button {
                                stempler.append(CanvasStempel(
                                    tegn: tegn, x: 220 + Double(stempler.count % 5) * 56,
                                    y: 160 + Double(stempler.count / 5) * 56))
                            } label: {
                                Text(tegn).font(.system(size: 22))
                            }
                            .buttonStyle(.plain)
                        }
                        Text("Dra for å flytte · hold for å fjerne")
                            .font(.appScaled(size: 9))
                            .foregroundStyle(CvBrand.textTertiary)
                    }
                    // «Former» fra mocken: legges inn som ekte penn-strøk
                    // (kan viskes/lassoes som alt annet).
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            visFormPalett.toggle()
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "square.on.circle")
                                .font(.appScaled(size: 10, weight: .bold))
                            Text("Former")
                                .font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(visFormPalett ? .white : CvBrand.textSecondary)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(visFormPalett
                                    ? CvBrand.purple.opacity(0.4) : CvBrand.cardHi,
                                    in: Capsule())
                    }
                    .buttonStyle(.plain)
                    if visFormPalett {
                        ForEach(CanvasForm.allCases, id: \.self) { form in
                            Button {
                                drawing.strokes.append(form.somStroke(
                                    senter: CGPoint(x: 340, y: 260)))
                            } label: {
                                Image(systemName: form.ikon)
                                    .font(.appScaled(size: 15, weight: .semibold))
                                    .foregroundStyle(.white)
                                    .frame(width: 30, height: 30)
                                    .background(CvBrand.cardHi, in: RoundedRectangle(cornerRadius: 7))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    // «Skriv»: flyttbar tekstboks.
                    Button {
                        let ny = CanvasTekstboks(
                            tekst: "", x: 340, y: 180 + Double(tekstbokser.count % 6) * 44)
                        tekstbokser.append(ny)
                        redigererTekstboks = ny
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "textformat")
                                .font(.appScaled(size: 10, weight: .bold))
                            Text("Tekst")
                                .font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(CvBrand.textSecondary)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(CvBrand.cardHi, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    Spacer()
                }
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(CvBrand.card.opacity(0.6))
            }

            // Selve tegneflata — PKToolPicker docker seg til bunnen.
            // Andres delte notater: kun visning (PUT er uansett eier-scopet).
            ZStack(alignment: .topLeading) {
                PencilCanvas(drawing: $drawing, redigerbar: valgtErMin)
                ForEach(stempler) { st in
                    StempelView(stempel: st, redigerbar: valgtErMin,
                                onFlytt: { ny in
                                    if let i = stempler.firstIndex(where: { $0.id == st.id }) {
                                        stempler[i] = ny
                                    }
                                },
                                onSlett: {
                                    stempler.removeAll { $0.id == st.id }
                                })
                }
                ForEach(tekstbokser) { tb in
                    TekstboksView(boks: tb, redigerbar: valgtErMin,
                                  onFlytt: { ny in
                                      if let i = tekstbokser.firstIndex(where: { $0.id == tb.id }) {
                                          tekstbokser[i] = ny
                                      }
                                  },
                                  onRediger: { redigererTekstboks = tb },
                                  onSlett: {
                                      tekstbokser.removeAll { $0.id == tb.id }
                                  })
                }
            }
            .alert("Tekstboks", isPresented: Binding(
                get: { redigererTekstboks != nil },
                set: { if !$0 { redigererTekstboks = nil } })) {
                TextField("Tekst", text: Binding(
                    get: { redigererTekstboks?.tekst ?? "" },
                    set: { ny in
                        redigererTekstboks?.tekst = ny
                        if let rb = redigererTekstboks,
                           let i = tekstbokser.firstIndex(where: { $0.id == rb.id }) {
                            tekstbokser[i].tekst = ny
                        }
                    }))
                Button("Ferdig") {
                    // Tom boks ved lukking = angret opprettelse.
                    if let rb = redigererTekstboks,
                       rb.tekst.trimmingCharacters(in: .whitespaces).isEmpty {
                        tekstbokser.removeAll { $0.id == rb.id }
                    }
                    redigererTekstboks = nil
                }
            }
        }
        .sheet(isPresented: $visAnalyse) {
            CanvasAnalyseSheet(drawing: drawing,
                               selskap: kobletSelskap ?? tittel,
                               leadId: kobletLeadId)
        }
    }

    /// Lead-kobling: chip når koblet, meny for å velge/fjerne.
    private var leadKobling: some View {
        Menu {
            if kobletLeadId != nil {
                Button(role: .destructive) {
                    kobletLeadId = nil
                    kobletSelskap = nil
                } label: {
                    Label("Fjern kobling", systemImage: "link.badge.plus")
                }
                Divider()
            }
            ForEach(appState.leads.sorted {
                ($0.leadScore ?? 0) > ($1.leadScore ?? 0)
            }.prefix(30), id: \.id) { lead in
                Button {
                    kobletLeadId = lead.id
                    kobletSelskap = lead.name
                } label: {
                    Text(lead.name)
                }
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: kobletSelskap == nil ? "link" : "building.2.fill")
                    .font(.appScaled(size: 10, weight: .bold))
                Text(kobletSelskap ?? "Koble til lead")
                    .font(.appScaled(size: 11, weight: .bold))
                    .lineLimit(1)
            }
            .foregroundStyle(kobletSelskap == nil ? CvBrand.textSecondary : CvBrand.green)
            .padding(.horizontal, 11).padding(.vertical, 6)
            .background(kobletSelskap == nil
                        ? CvBrand.cardHi
                        : CvBrand.green.opacity(0.14), in: Capsule())
            .overlay(Capsule().stroke(
                kobletSelskap == nil ? CvBrand.stroke : CvBrand.green.opacity(0.4),
                lineWidth: 1))
        }
    }

    // MARK: Handlinger

    private func nyttNotat() {
        // Lagre det som står i editoren først (best effort, uten å vente).
        if valgtId != nil { Task { await lagre(stille: true) } }
        let pos = KartLocationManager.shared.currentCoordinate
        let n = CanvasNotat(
            id: UUID().uuidString.lowercased(),
            tittel: "",
            kategori: kategoriFilter ?? .mote,
            selskap: nil, leadId: nil,
            drawingData: Data(),
            oppdatert: Date(),
            erNy: true,
            lat: pos?.latitude, lon: pos?.longitude)
        notater.insert(n, at: 0)
        velg(n)
    }

    private func velg(_ n: CanvasNotat) {
        // Bytte av notat = lagre det forrige stille (tegninger skal ikke dø).
        if let gjeldende = valgtId, gjeldende != n.id {
            Task { await lagre(stille: true) }
        }
        valgtId = n.id
        tittel = n.tittel
        kategori = n.kategori
        kobletLeadId = n.leadId
        kobletSelskap = n.selskap
        deltMedTeam = n.delt
        stempler = n.stempler
        tekstbokser = n.tekstbokser
        notatLat = n.lat
        notatLon = n.lon
        drawing = (try? PKDrawing(data: n.drawingData)) ?? PKDrawing()
        lagretToast = false
    }

    private func slett(_ n: CanvasNotat) {
        notater.removeAll { $0.id == n.id }
        if valgtId == n.id { valgtId = nil }
        guard !isDemo, !n.erNy, let api = appState.api else { return }
        Task { try? await api.slettCanvasNotat(id: n.id) }
    }

    @MainActor
    private func lagre(stille: Bool = false) async {
        guard let id = valgtId,
              let idx = notater.firstIndex(where: { $0.id == id }) else { return }
        var n = notater[idx]
        guard n.erMin else { return }   // andres delte notater lagres aldri
        n.tittel = tittel
        n.kategori = kategori
        n.leadId = kobletLeadId
        n.selskap = kobletSelskap
        n.delt = deltMedTeam
        n.stempler = stempler
        n.tekstbokser = tekstbokser
        n.lat = notatLat
        n.lon = notatLon
        n.drawingData = drawing.dataRepresentation()
        n.oppdatert = Date()
        oppdaterThumb(n)

        if isDemo {
            n.erNy = false
            notater[idx] = n
            if !stille { visLagret() }
            return
        }
        guard let api = appState.api else { return }
        if !stille { lagrer = true }
        defer { if !stille { lagrer = false } }
        do {
            let stemplerJSON = (try? JSONEncoder().encode(n.stempler))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
            let tekstbokserJSON = (try? JSONEncoder().encode(n.tekstbokser))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
            if n.erNy {
                let nyId = try await api.opprettCanvasNotat(
                    tittel: n.tittel, kategori: n.kategori.rawValue,
                    selskap: n.selskap, leadId: n.leadId,
                    drawingBase64: n.drawingData.base64EncodedString(),
                    delt: n.delt, lat: n.lat, lon: n.lon,
                    stempler: stemplerJSON, tekstbokser: tekstbokserJSON)
                n.id = nyId
                n.erNy = false
                if valgtId == id { valgtId = nyId }
            } else {
                try await api.oppdaterCanvasNotat(
                    id: n.id, tittel: n.tittel, kategori: n.kategori.rawValue,
                    selskap: n.selskap, leadId: n.leadId,
                    drawingBase64: n.drawingData.base64EncodedString(),
                    delt: n.delt, lat: n.lat, lon: n.lon,
                    stempler: stemplerJSON, tekstbokser: tekstbokserJSON)
            }
            notater[idx] = n
            if !stille { visLagret() }
        } catch {
            print("[Canvas] lagring feilet: \(error)")
        }
    }

    private func visLagret() {
        lagretToast = true
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_800_000_000)
            lagretToast = false
        }
    }

    @MainActor
    private func lastInn() async {
        defer { lastet = true }
        if isDemo {
            if notater.isEmpty { notater = Self.demoNotater() }
            return
        }
        guard let api = appState.api else { return }
        guard let dtoer = try? await api.hentCanvasNotater() else { return }
        notater = dtoer.compactMap { dto in
            CanvasNotat(
                id: dto.id,
                tittel: dto.tittel,
                kategori: CanvasKategori(rawValue: dto.kategori) ?? .mote,
                selskap: dto.selskap,
                leadId: dto.leadId,
                drawingData: Data(base64Encoded: dto.drawingBase64 ?? "") ?? Data(),
                oppdatert: ISO8601DateFormatter().date(from: dto.oppdatert ?? "") ?? Date(),
                delt: dto.delt ?? false,
                erMin: dto.erMin ?? true,
                eierNavn: dto.eierNavn,
                lat: dto.lat, lon: dto.lon,
                stempler: (dto.stempler?.data(using: .utf8))
                    .flatMap { try? JSONDecoder().decode([CanvasStempel].self, from: $0) } ?? [],
                tekstbokser: (dto.tekstbokser?.data(using: .utf8))
                    .flatMap { try? JSONDecoder().decode([CanvasTekstboks].self, from: $0) } ?? [])
        }
        genererThumbs()
    }

    /// Miniatyrer: PKDrawing → 92pt-bilde (2× av 46pt-ruta), av-main.
    private func genererThumbs() {
        let kilder = notater.map { ($0.id, $0.drawingData) }
        Task.detached(priority: .utility) {
            var nye: [String: UIImage] = [:]
            for (id, data) in kilder {
                guard !data.isEmpty,
                      let tegning = try? PKDrawing(data: data),
                      !tegning.bounds.isEmpty else { continue }
                let img = tegning.image(from: tegning.bounds, scale: 0.35)
                nye[id] = img
            }
            let resultat = nye
            await MainActor.run { thumbs.merge(resultat) { _, ny in ny } }
        }
    }

    /// Tegning + stempler → ett bilde (deling). Stemplene tegnes på
    /// samme koordinater som overlayet.
    private func komponertBilde() -> UIImage {
        let bounds = drawing.bounds.isEmpty
            ? CGRect(x: 0, y: 0, width: 800, height: 600)
            : drawing.bounds.insetBy(dx: -40, dy: -40)
        let base = drawing.image(from: bounds, scale: 2.0)
        guard !stempler.isEmpty else { return base }
        let renderer = UIGraphicsImageRenderer(size: base.size)
        return renderer.image { _ in
            base.draw(at: .zero)
            for st in stempler {
                let punkt = CGPoint(x: (st.x - bounds.minX) * 2.0,
                                    y: (st.y - bounds.minY) * 2.0)
                (st.tegn as NSString).draw(
                    at: punkt,
                    withAttributes: [.font: UIFont.systemFont(ofSize: 64)])
            }
            for tb in tekstbokser where !tb.tekst.isEmpty {
                let punkt = CGPoint(x: (tb.x - bounds.minX) * 2.0,
                                    y: (tb.y - bounds.minY) * 2.0)
                (tb.tekst as NSString).draw(
                    at: punkt,
                    withAttributes: [
                        .font: UIFont.boldSystemFont(ofSize: 34),
                        .foregroundColor: UIColor.white,
                    ])
            }
        }
    }

    /// PDF til temp-fil for ShareLink (én side = komposittbildet).
    private func pdfFil() -> URL? {
        let bilde = komponertBilde()
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(tittel.isEmpty ? "canvas-notat" : tittel.replacingOccurrences(of: "/", with: "-")).pdf")
        let pdfRenderer = UIGraphicsPDFRenderer(
            bounds: CGRect(origin: .zero, size: bilde.size))
        do {
            try pdfRenderer.writePDF(to: url) { ctx in
                ctx.beginPage()
                bilde.draw(at: .zero)
            }
            return url
        } catch { return nil }
    }

    private func oppdaterThumb(_ n: CanvasNotat) {
        guard !n.drawingData.isEmpty,
              let tegning = try? PKDrawing(data: n.drawingData),
              !tegning.bounds.isEmpty else { return }
        thumbs[n.id] = tegning.image(from: tegning.bounds, scale: 0.35)
    }

    private static func kortDato(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        if Calendar.current.isDateInToday(d) {
            f.dateFormat = "HH:mm"
        } else {
            f.dateFormat = "d. MMM"
        }
        return f.string(from: d)
    }

    // MARK: Demo

    private static func demoNotater() -> [CanvasNotat] {
        [
            CanvasNotat(id: "demo-c1", tittel: "Møte med Nordic Elektro AS",
                        kategori: .mote, selskap: "Nordic Elektro AS",
                        leadId: nil, drawingData: Data(), oppdatert: Date()),
            CanvasNotat(id: "demo-c2", tittel: "Oppfølging — Byggmester Hansen AS",
                        kategori: .oppfolging, selskap: "Byggmester Hansen AS",
                        leadId: nil, drawingData: Data(),
                        oppdatert: Date().addingTimeInterval(-3600)),
            CanvasNotat(id: "demo-c3", tittel: "Ruteplan — Grünerløkka",
                        kategori: .rute, selskap: nil,
                        leadId: nil, drawingData: Data(),
                        oppdatert: Date().addingTimeInterval(-7200)),
            CanvasNotat(id: "demo-c4", tittel: "Brainstorm — nye kampanjeideer",
                        kategori: .ide, selskap: nil,
                        leadId: nil, drawingData: Data(),
                        oppdatert: Date().addingTimeInterval(-90000)),
        ]
    }
}

// MARK: - PencilKit-innpakning

/// PKCanvasView + PKToolPicker i SwiftUI. Tegningen bindes ut ved hver
/// endring (delegat) — «Lagre» serialiserer via dataRepresentation().
private struct PencilCanvas: UIViewRepresentable {
    @Binding var drawing: PKDrawing
    var redigerbar: Bool = true

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.drawing = drawing
        canvas.drawingPolicy = .anyInput   // finger OG pencil (fase 1)
        canvas.backgroundColor = UIColor(red: 0.05, green: 0.04, blue: 0.10, alpha: 1)
        canvas.overrideUserInterfaceStyle = .dark
        canvas.alwaysBounceVertical = false
        canvas.delegate = context.coordinator
        // Verktøylinja (penn/marker/viskelær/farger) — systemets egen.
        let picker = PKToolPicker()
        context.coordinator.toolPicker = picker
        picker.setVisible(true, forFirstResponder: canvas)
        picker.addObserver(canvas)
        DispatchQueue.main.async { canvas.becomeFirstResponder() }
        return canvas
    }

    func updateUIView(_ canvas: PKCanvasView, context: Context) {
        // Ekstern endring (notat-bytte) → oppdater uten delegat-løkke.
        if canvas.drawing != drawing && !context.coordinator.tegner {
            canvas.drawing = drawing
        }
        canvas.isUserInteractionEnabled = redigerbar
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        var parent: PencilCanvas
        var toolPicker: PKToolPicker?
        var tegner = false

        init(_ parent: PencilCanvas) { self.parent = parent }

        func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView) { tegner = true }
        func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView) { tegner = false }
        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            parent.drawing = canvasView.drawing
        }
    }
}

// MARK: - CanvasAnalyseSheet (fase 3: håndskrift → tekst → AI)

/// To steg: (1) Vision-OCR på tegningen → redigerbar tekst, (2) Claude
/// strukturerer → oppsummering + oppgaver + løfter. Backend lagrer
/// oppgavene i oppgavelista og notatet i møteloggen (brief-sløyfa).
struct CanvasAnalyseSheet: View {
    let drawing: PKDrawing
    let selskap: String
    let leadId: String?

    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var ocrTekst = ""
    @State private var ocrKjort = false
    @State private var analyserer = false
    @State private var resultat: CanvasAnalyseDTO?
    @State private var feil: String?

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
                Text("Notatet er logget — neste møtebrief for \(selskap) åpner med dette.")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(CvBrand.textTertiary)
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
                let linjer = (req.results as? [VNRecognizedTextObservation] ?? [])
                    .compactMap { $0.topCandidates(1).first?.string }
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
            resultat = try await api.analyserCanvasNotat(
                selskap: selskap.isEmpty ? nil : selskap,
                tekst: ocrTekst, leadId: leadId)
        } catch {
            feil = "Analysen feilet — sjekk nettet, og at «Møter · AI-møtebrief» er aktivert (Canvas-analysen bruker samme AI-nøkkel)."
        }
    }
}


// MARK: - StempelView (fase 4: klistremerke oppå flata)

/// Dra for å flytte, hold for å fjerne. Posisjon i canvas-punkter.
private struct StempelView: View {
    let stempel: CanvasStempel
    let redigerbar: Bool
    let onFlytt: (CanvasStempel) -> Void
    let onSlett: () -> Void

    @State private var dragOffset: CGSize = .zero

    var body: some View {
        Text(stempel.tegn)
            .font(.system(size: 34))
            .shadow(color: .black.opacity(0.5), radius: 3)
            .position(x: stempel.x + dragOffset.width,
                      y: stempel.y + dragOffset.height)
            .gesture(redigerbar ? DragGesture()
                .onChanged { dragOffset = $0.translation }
                .onEnded { v in
                    var ny = stempel
                    ny.x += v.translation.width
                    ny.y += v.translation.height
                    dragOffset = .zero
                    onFlytt(ny)
                } : nil)
            .onLongPressGesture(minimumDuration: 0.5) {
                if redigerbar { onSlett() }
            }
    }
}


// MARK: - CanvasForm (fase 5: «Former» som ekte penn-strøk)

/// Formene legges inn som PKStroke — de kan viskes, lassoes og flyttes
/// med PencilKits egne verktøy, akkurat som håndtegnede strøk.
enum CanvasForm: CaseIterable {
    case rektangel, sirkel, pil, linje

    var ikon: String {
        switch self {
        case .rektangel: return "rectangle"
        case .sirkel: return "circle"
        case .pil: return "arrow.right"
        case .linje: return "minus"
        }
    }

    func somStroke(senter: CGPoint) -> PKStroke {
        let punkter: [CGPoint]
        switch self {
        case .rektangel:
            punkter = Self.polylinje([
                CGPoint(x: senter.x - 90, y: senter.y - 60),
                CGPoint(x: senter.x + 90, y: senter.y - 60),
                CGPoint(x: senter.x + 90, y: senter.y + 60),
                CGPoint(x: senter.x - 90, y: senter.y + 60),
                CGPoint(x: senter.x - 90, y: senter.y - 60),
            ])
        case .sirkel:
            punkter = (0...72).map { i in
                let v = Double(i) / 72 * 2 * .pi
                return CGPoint(x: senter.x + 75 * cos(v), y: senter.y + 75 * sin(v))
            }
        case .pil:
            punkter = Self.polylinje([
                CGPoint(x: senter.x - 90, y: senter.y),
                CGPoint(x: senter.x + 90, y: senter.y),
            ]) + Self.polylinje([
                CGPoint(x: senter.x + 55, y: senter.y - 28),
                CGPoint(x: senter.x + 90, y: senter.y),
                CGPoint(x: senter.x + 55, y: senter.y + 28),
            ])
        case .linje:
            punkter = Self.polylinje([
                CGPoint(x: senter.x - 100, y: senter.y),
                CGPoint(x: senter.x + 100, y: senter.y),
            ])
        }
        let kontroll = punkter.map {
            PKStrokePoint(location: $0, timeOffset: 0,
                          size: CGSize(width: 4, height: 4),
                          opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
        }
        return PKStroke(ink: PKInk(.pen, color: .white),
                        path: PKStrokePath(controlPoints: kontroll,
                                           creationDate: Date()))
    }

    /// Tette mellompunkter langs hjørnene → jevn strek.
    private static func polylinje(_ hjorner: [CGPoint]) -> [CGPoint] {
        guard hjorner.count > 1 else { return hjorner }
        var ut: [CGPoint] = []
        for i in 0..<(hjorner.count - 1) {
            let a = hjorner[i], b = hjorner[i + 1]
            let steg = max(2, Int(hypot(b.x - a.x, b.y - a.y) / 8))
            for t in 0...steg {
                let f = CGFloat(t) / CGFloat(steg)
                ut.append(CGPoint(x: a.x + (b.x - a.x) * f,
                                  y: a.y + (b.y - a.y) * f))
            }
        }
        return ut
    }
}

// MARK: - TekstboksView (fase 5: flyttbar tekst)

private struct TekstboksView: View {
    let boks: CanvasTekstboks
    let redigerbar: Bool
    let onFlytt: (CanvasTekstboks) -> Void
    let onRediger: () -> Void
    let onSlett: () -> Void

    @State private var dragOffset: CGSize = .zero

    var body: some View {
        Text(boks.tekst.isEmpty ? "Tekst …" : boks.tekst)
            .font(.appScaled(size: 17, weight: .bold))
            .foregroundStyle(boks.tekst.isEmpty ? CvBrand.textTertiary : .white)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(CvBrand.card.opacity(0.7), in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8)
                .stroke(CvBrand.purple.opacity(0.35), lineWidth: 1))
            .position(x: boks.x + dragOffset.width,
                      y: boks.y + dragOffset.height)
            .onTapGesture { if redigerbar { onRediger() } }
            .gesture(redigerbar ? DragGesture()
                .onChanged { dragOffset = $0.translation }
                .onEnded { v in
                    var ny = boks
                    ny.x += v.translation.width
                    ny.y += v.translation.height
                    dragOffset = .zero
                    onFlytt(ny)
                } : nil)
            .onLongPressGesture(minimumDuration: 0.5) {
                if redigerbar { onSlett() }
            }
    }
}
