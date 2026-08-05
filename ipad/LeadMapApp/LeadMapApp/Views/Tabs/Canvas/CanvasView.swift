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
import MapKit
import PDFKit
import PencilKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers
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
    static let red = Color(red: 0.95, green: 0.30, blue: 0.30)
    static let blue = Color(red: 0.34, green: 0.60, blue: 0.98)
    static let textSecondary = Color.white.opacity(0.65)
    static let textTertiary = Color.white.opacity(0.4)
}

/// Notat-TYPENE (Daniels struktur 2026-08-05): Møte / Lead / Befaring /
/// Salgsplan / Prosjekt / Rute — hver med sitt eget cover. Gamle
/// kategorier beholdes som legacy så eksisterende notater dekoder.
enum CanvasKategori: String, CaseIterable, Identifiable {
    // Strukturen
    case mote = "mote"
    case lead = "lead"
    case befaring = "befaring"
    case salgsplan = "salgsplan"
    case prosjekt = "prosjekt"
    case rute = "rute"
    // Legacy (vises kun på gamle notater)
    case oppfolging = "oppfolging"
    case ide = "ide"
    case kunde = "kunde"
    case internt = "internt"

    var id: String { rawValue }

    /// Typene som tilbys i velger/filter — legacy holdes utenfor.
    static let hovedTyper: [CanvasKategori] =
        [.mote, .lead, .befaring, .salgsplan, .prosjekt, .rute]

    var etikett: String {
        switch self {
        case .mote: return "Møte"
        case .lead: return "Lead"
        case .befaring: return "Befaring"
        case .salgsplan: return "Salgsplan"
        case .prosjekt: return "Prosjekt"
        case .rute: return "Rute"
        case .oppfolging: return "Oppfølging"
        case .ide: return "Idé"
        case .kunde: return "Kunde"
        case .internt: return "Internt"
        }
    }

    var farge: Color {
        switch self {
        case .mote: return CvBrand.purpleLight
        case .lead: return CvBrand.orange
        case .befaring: return CvBrand.green
        case .salgsplan: return CvBrand.yellow
        case .prosjekt: return CvBrand.blue
        case .rute: return Color(red: 0.35, green: 0.85, blue: 0.85)
        case .oppfolging: return CvBrand.blue
        case .ide: return CvBrand.yellow
        case .kunde: return CvBrand.orange
        case .internt: return CvBrand.textSecondary
        }
    }

    var ikon: String {
        switch self {
        case .mote: return "person.2.wave.2.fill"
        case .lead: return "person.crop.rectangle.stack.fill"
        case .befaring: return "binoculars.fill"
        case .salgsplan: return "chart.line.uptrend.xyaxis"
        case .prosjekt: return "hammer.fill"
        case .rute: return "point.topleft.down.curvedto.point.bottomright.up.fill"
        case .oppfolging: return "bell.fill"
        case .ide: return "lightbulb.fill"
        case .kunde: return "building.2.fill"
        case .internt: return "lock.fill"
        }
    }

    /// Cover-gradienten — notatets «bokforside» i lista og velgeren.
    var coverGradient: LinearGradient {
        LinearGradient(colors: [farge.opacity(0.55), farge.opacity(0.18)],
                       startPoint: .topLeading, endPoint: .bottomTrailing)
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

/// Smart Layers: lagene som kan slås av/på i editoren.
enum CanvasLag: String, CaseIterable, Identifiable {
    case bilder, pdf, kart, crm, oppgaver, former, stempler, tekst, noder

    var id: String { rawValue }

    var etikett: String {
        switch self {
        case .bilder: return "Bilder"
        case .pdf: return "PDF-dokumenter"
        case .kart: return "Kart-utsnitt"
        case .crm: return "CRM-kort (lead/KPI/kalender)"
        case .oppgaver: return "Oppgaver"
        case .former: return "Former"
        case .stempler: return "Stempler"
        case .tekst: return "Tekstbokser"
        case .noder: return "Tankekart-noder"
        }
    }
}

/// Penn-galleriet: seks penner for feltselgeren. Pen/Marker er PencilKits
/// egne; Map Marker og Planning Pen er presets; Laser og Arrow er MODUSER
/// (strøk som toner bort / strøk som blir perfekte piler).
enum PennValg: String, CaseIterable, Identifiable {
    case pen, marker, kartMarkor, laser, pil, planlegging

    var id: String { rawValue }

    var etikett: String {
        switch self {
        case .pen: return "Penn"
        case .marker: return "Marker"
        case .kartMarkor: return "Kart-markør"
        case .laser: return "Laser"
        case .pil: return "Pil-penn"
        case .planlegging: return "Plan-penn"
        }
    }

    var ikon: String {
        switch self {
        case .pen: return "pencil.tip"
        case .marker: return "highlighter"
        case .kartMarkor: return "mappin.and.ellipse"
        case .laser: return "rays"
        case .pil: return "arrow.up.right"
        case .planlegging: return "pencil.and.ruler"
        }
    }

    /// PKInkingTool-preset (farger konverteres til lys-referanse så de
    /// vises riktig i mørk rendring).
    var verktoy: PKInkingTool {
        func farge(_ c: UIColor) -> UIColor {
            PKInkingTool.convertColor(c, from: .dark, to: .light)
        }
        switch self {
        case .pen:
            return PKInkingTool(.pen, color: farge(.white), width: 4)
        case .marker:
            return PKInkingTool(.marker,
                                color: farge(UIColor(red: 0.98, green: 0.75, blue: 0.14, alpha: 1)),
                                width: 18)
        case .kartMarkor:
            return PKInkingTool(.marker,
                                color: farge(UIColor(red: 0.98, green: 0.45, blue: 0.20, alpha: 1)),
                                width: 8)
        case .laser:
            return PKInkingTool(.pen,
                                color: farge(UIColor(red: 1.0, green: 0.25, blue: 0.25, alpha: 1)),
                                width: 5)
        case .pil:
            return PKInkingTool(.pen, color: farge(.white), width: 4)
        case .planlegging:
            return PKInkingTool(.pen,
                                color: farge(UIColor(red: 0.34, green: 0.60, blue: 0.98, alpha: 1)),
                                width: 2)
        }
    }
}

/// Undo-historikk: tidsstemplet snapshot av tegningen.
struct CanvasSnapshot: Hashable {
    let tid: Date
    let data: Data
    let strokAntall: Int
}

/// Objekt-laget (fase 8): bilder + lead-/KPI-/kart-/oppgave-kort som
/// ligger UNDER blekket (tegn oppå = annoter). Lasso/objekt-modusen
/// gjør dem flyttbare/skalerbare; ellers går all touch til Pencil.
struct CanvasObjekt: Codable, Identifiable, Hashable {
    var id: String = UUID().uuidString
    var type: String        // bilde / lead / kpi / kart / oppgave
    var x: Double
    var y: Double
    var skala: Double = 1.0
    /// JPEG-base64 for bilde- og kart-objekter.
    var bildeBase64: String? = nil
    var tittel: String? = nil
    var detalj: String? = nil
    var refId: String? = nil
}

/// Levende tankekart/brainstorm-node (fase 7): boblene er OBJEKTER —
/// «+» føder koblet barn, dra flytter (streken følger), tap redigerer
/// teksten (Scribble: skriv i boblen med Pencil). Brainstorm = noder
/// uten forelder (frittstående lapper).
struct CanvasNode: Codable, Identifiable, Hashable {
    var id: String = UUID().uuidString
    var parentId: String? = nil
    var tekst: String = ""
    var x: Double
    var y: Double
    var fargeHex: String = "#B973FF"
}

/// Flyttbar OG skalerbar figur oppå flata (fase 6) — «Former» som ekte
/// objekter: dra flytter, klyp skalerer, hold fjerner. Tegnes i SwiftUI
/// (utenfor PencilKit) så fargene aldri inverteres i mørk modus.
struct CanvasFigur: Codable, Identifiable, Hashable {
    var id: String = UUID().uuidString
    var form: String       // rektangel/sirkel/pil/linje
    var x: Double
    var y: Double
    var skala: Double = 1.0
    var fargeHex: String = "#FFFFFF"
    /// Rotasjon i grader (to-finger-vri).
    var rotasjon: Double = 0
    /// Fra shape recognition: eksakt størrelse (ellers 200×160 × skala).
    var bredde: Double? = nil
    var hoyde: Double? = nil
}

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
    var figurer: [CanvasFigur] = []
    var papir: CanvasPapir = .blank
    var noder: [CanvasNode] = []
    var sider: Int = 1
    var objekter: [CanvasObjekt] = []
    /// Universalsøk: OCR av blekk + PDF-tekst + bilde-OCR + tekster.
    var sokbarTekst: String = ""
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
    @State private var figurer: [CanvasFigur] = []
    @State private var papir: CanvasPapir = .blank
    @State private var noder: [CanvasNode] = []
    @State private var sider: Int = 1
    @State private var redigererNode: CanvasNode?
    @State private var objekter: [CanvasObjekt] = []
    /// Lasso/objekt-modus: touch går til objektene (flytt/skaler) i
    /// stedet for pennen. Av = tegn fritt OPPÅ objektene (annoter).
    @State private var objektModus = false
    @State private var bildeValg: PhotosPickerItem?
    @State private var bildeVelgerAapen = false
    @State private var pdfVelgerAapen = false
    /// Faner: flere notater åpne samtidig (session — bytt uten å miste noe;
    /// velg() auto-lagrer forrige notat stille).
    @State private var aapneFaner: [String] = []
    @State private var pennValg: PennValg = .pen
    /// Multi-select (Lasso-modus): tap velger flere — dra én, alle følger.
    @State private var valgte: Set<String> = []
    @State private var bibliotek: [BibliotekElement] = BibliotekElement.lastAlle()
    @State private var lagrerElementNavn = false
    @State private var elementNavn = ""
    @State private var visTidsreise = false
    /// Spatial Search: søk i notatet → flata scroller til treffet.
    @State private var visEditorSok = false
    @State private var editorSok = ""
    @State private var sokTreff: [CGPoint] = []
    @State private var sokTreffIndeks = 0
    /// Smart Layers: lag som er slått AV (rendring + eksport).
    @State private var skjulteLag: Set<String> = []
    /// Live collab v1: delt notat oppdatert av kollega → puls-banner.
    @State private var kollegaOppdatering: String?
    /// Undo-HISTORIKK (ikke bare angre): snapshots per notat m/ tidspunkt —
    /// hopp tilbake til et hvilket som helst punkt.
    @State private var historikk: [String: [CanvasSnapshot]] = [:]
    @State private var notatLat: Double?
    @State private var notatLon: Double?
    @State private var visStempelPalett = false
    @State private var visFormPalett = false
    @State private var redigererTekstboks: CanvasTekstboks?
    @State private var visTypeVelger = false
    @State private var formFarge: UIColor = .white
    /// Pencil-first: kun Pencil tegner (håndflata kan hvile på skjermen).
    @AppStorage("canvas.kunPencil") private var kunPencil = false
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
                    || $0.sokbarTekst.localizedCaseInsensitiveContains(q)
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
                Button { visTypeVelger = true } label: {
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

            // Context Awareness: Canvas VET hvor du er, hvilket møte du
            // har og hvilken rute du kjører — foreslår riktig notat.
            if let forslag = kontekstForslag() {
                Button {
                    forslag.handling()
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: forslag.ikon)
                            .font(.appScaled(size: 12, weight: .bold))
                            .foregroundStyle(CvBrand.purpleLight)
                        Text(forslag.tekst)
                            .font(.appScaled(size: 11, weight: .semibold))
                            .foregroundStyle(.white)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 4)
                        Image(systemName: "arrow.right.circle.fill")
                            .font(.appScaled(size: 14))
                            .foregroundStyle(CvBrand.purpleLight)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 10)
                    .background(CvBrand.purple.opacity(0.16),
                                in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12)
                        .stroke(CvBrand.purple.opacity(0.45), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 16).padding(.bottom, 10)
            }
            // Søk (tittel/selskap)
            HStack(spacing: 7) {
                Image(systemName: "magnifyingglass")
                    .font(.appScaled(size: 12, weight: .semibold))
                    .foregroundStyle(CvBrand.textTertiary)
                TextField("Søk — også i håndskrift, PDF og bilder …", text: $sok)
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
                    ForEach(CanvasKategori.hovedTyper) { k in
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
                    // Typens cover — notatets «bokforside» før første strøk.
                    ZStack {
                        Rectangle().fill(n.kategori.coverGradient)
                        Image(systemName: n.kategori.ikon)
                            .font(.appScaled(size: 16, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.9))
                    }
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
            // Faner: flere dokumenter åpne samtidig — bytt med ett tap.
            if aapneFaner.count > 1 { faneRad }
            // Live collab: kollega har endret det delte notatet.
            if let hvem = kollegaOppdatering {
                Button {
                    kollegaOppdatering = nil
                    Task {
                        await lastInn()
                        if let id = valgtId,
                           let n = notater.first(where: { $0.id == id }) {
                            velg(n)
                        }
                    }
                } label: {
                    HStack(spacing: 7) {
                        Circle().fill(CvBrand.green).frame(width: 7, height: 7)
                        Text("\(hvem) oppdaterte notatet — trykk for å laste inn")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(.white)
                        Spacer()
                        Image(systemName: "arrow.clockwise.circle.fill")
                            .font(.appScaled(size: 14))
                            .foregroundStyle(CvBrand.green)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(CvBrand.green.opacity(0.16))
                }
                .buttonStyle(.plain)
            }
            // Topp: tittel + kategori + lead-kobling + lagre (ekstrahert).
            editorTopp

            Divider().overlay(CvBrand.stroke)

            // Stempel-palett («Klistremerker» fra design-mocken).
            if valgtErMin {
                HStack(spacing: 8) {
                    // Lasso/objekt-modus: flytt og skaler objektene under
                    // blekket — av igjen for å tegne oppå (annotere).
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            objektModus.toggle()
                            valgte.removeAll()
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "lasso")
                                .font(.appScaled(size: 10, weight: .bold))
                            Text(objektModus ? "Flytter" : "Lasso")
                                .font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(objektModus ? .white : CvBrand.textSecondary)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(objektModus
                                    ? CvBrand.orange.opacity(0.5) : CvBrand.cardHi,
                                    in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .help("Flytt/skaler bilder og kort — av for å tegne oppå")
                    if objektModus && !valgte.isEmpty {
                        Text("\(valgte.count) valgt")
                            .font(.appScaled(size: 10, weight: .black))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 8).padding(.vertical, 4)
                            .background(CvBrand.orange.opacity(0.5), in: Capsule())
                        Button {
                            slettValgte()
                        } label: {
                            Image(systemName: "trash")
                                .font(.appScaled(size: 11, weight: .bold))
                                .foregroundStyle(CvBrand.red)
                                .frame(width: 26, height: 26)
                                .background(CvBrand.red.opacity(0.15), in: Circle())
                        }
                        .buttonStyle(.plain)
                        Button {
                            elementNavn = ""
                            lagrerElementNavn = true
                        } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "square.and.arrow.down.on.square")
                                    .font(.appScaled(size: 9, weight: .bold))
                                Text("Lagre element")
                                    .font(.appScaled(size: 10, weight: .bold))
                            }
                            .foregroundStyle(CvBrand.green)
                            .padding(.horizontal, 9).padding(.vertical, 5)
                            .background(CvBrand.green.opacity(0.15), in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                    // Element-biblioteket: gjenbrukbare elementer.
                    if !bibliotek.isEmpty {
                        Menu {
                            ForEach(bibliotek) { el in
                                Menu(el.navn) {
                                    Button {
                                        settInnElement(el)
                                    } label: {
                                        Label("Sett inn", systemImage: "plus.square.on.square")
                                    }
                                    Button(role: .destructive) {
                                        bibliotek.removeAll { $0.id == el.id }
                                        BibliotekElement.lagreAlle(bibliotek)
                                    } label: {
                                        Label("Slett fra biblioteket", systemImage: "trash")
                                    }
                                }
                            }
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "books.vertical.fill")
                                    .font(.appScaled(size: 10, weight: .bold))
                                Text("Bibliotek")
                                    .font(.appScaled(size: 11, weight: .bold))
                            }
                            .foregroundStyle(CvBrand.textSecondary)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(CvBrand.cardHi, in: Capsule())
                        }
                    }
                    // «Sett inn»: bilder + levende kort fra resten av appen.
                    Menu {
                        Button {
                            bildeVelgerAapen = true
                        } label: {
                            Label("Bilde fra Bilder", systemImage: "photo")
                        }
                        Button {
                            pdfVelgerAapen = true
                        } label: {
                            Label("PDF — tilbud/kontrakt/plantegning",
                                  systemImage: "doc.fill")
                        }
                        Menu {
                            ForEach(appState.leads.sorted {
                                ($0.leadScore ?? 0) > ($1.leadScore ?? 0)
                            }.prefix(20), id: \.id) { lead in
                                Button(lead.name) { settInnLeadKort(lead) }
                            }
                        } label: {
                            Label("Lead-kort", systemImage: "person.crop.rectangle")
                        }
                        Menu {
                            ForEach(appState.leads.sorted {
                                ($0.leadScore ?? 0) > ($1.leadScore ?? 0)
                            }.prefix(20), id: \.id) { lead in
                                Button(lead.name) { settInnStakeholderKart(lead) }
                            }
                        } label: {
                            Label("Stakeholder-kart (Visual CRM)",
                                  systemImage: "person.3.sequence.fill")
                        }
                        Menu {
                            Button("Leads totalt") { settInnKPI(nokkel: "leads") }
                            Button("Hot leads") { settInnKPI(nokkel: "hot") }
                            Button("Pipeline-verdi") { settInnKPI(nokkel: "pipeline") }
                        } label: {
                            Label("KPI (live)", systemImage: "chart.bar.fill")
                        }
                        Button {
                            objekter.append(CanvasObjekt(
                                type: "kalender", x: 400, y: 260,
                                tittel: "Neste møte", refId: "neste"))
                            objektModus = true
                        } label: {
                            Label("Neste møte (live)", systemImage: "calendar")
                        }
                        Button {
                            Task { await settInnKartUtsnitt() }
                        } label: {
                            Label("Kart-utsnitt", systemImage: "map")
                        }
                        Menu {
                            ForEach(oppgaveKandidater, id: \.id) { o in
                                Button(o.tittel) { settInnOppgave(o) }
                            }
                        } label: {
                            Label("Oppgave", systemImage: "checklist")
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "plus.square.on.square")
                                .font(.appScaled(size: 10, weight: .bold))
                            Text("Sett inn")
                                .font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(CvBrand.textSecondary)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(CvBrand.cardHi, in: Capsule())
                    }
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
                                figurer.append(CanvasFigur(
                                    form: form.nokkel,
                                    x: 340 + Double(figurer.count % 4) * 40,
                                    y: 260 + Double(figurer.count / 4) * 40,
                                    fargeHex: formFarge.somHex))
                            } label: {
                                Image(systemName: form.ikon)
                                    .font(.appScaled(size: 15, weight: .semibold))
                                    .foregroundStyle(Color(formFarge))
                                    .frame(width: 30, height: 30)
                                    .background(CvBrand.cardHi, in: RoundedRectangle(cornerRadius: 7))
                            }
                            .buttonStyle(.plain)
                        }
                        Text("Dra · klyp for størrelse · hold for å fjerne")
                            .font(.appScaled(size: 9))
                            .foregroundStyle(CvBrand.textTertiary)
                        // Fargevalg for formene
                        ForEach(Array(CanvasForm.fargePalett.enumerated()), id: \.offset) { _, f in
                            Button {
                                formFarge = f
                            } label: {
                                Circle()
                                    .fill(Color(f))
                                    .frame(width: 20, height: 20)
                                    .overlay(Circle().stroke(
                                        formFarge == f ? Color.white : CvBrand.stroke,
                                        lineWidth: formFarge == f ? 2 : 1))
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
                    // Penn-galleriet: seks penner — laser og pil er moduser.
                    Menu {
                        ForEach(PennValg.allCases) { valg in
                            Button {
                                pennValg = valg
                            } label: {
                                Label(valg.etikett
                                      + (valg == .laser ? " (toner bort)" : "")
                                      + (valg == .pil ? " (strøk → pil)" : ""),
                                      systemImage: valg.ikon)
                            }
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: pennValg.ikon)
                                .font(.appScaled(size: 10, weight: .bold))
                            Text(pennValg.etikett)
                                .font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(pennValg == .pen
                                         ? CvBrand.textSecondary : CvBrand.purpleLight)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(pennValg == .pen
                                    ? CvBrand.cardHi : CvBrand.purple.opacity(0.25),
                                    in: Capsule())
                    }
                    // Spatial Search: søk «Pris» → flata flyr dit.
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            visEditorSok.toggle()
                            if !visEditorSok { sokTreff = []; editorSok = "" }
                        }
                    } label: {
                        Image(systemName: "magnifyingglass.circle\(visEditorSok ? ".fill" : "")")
                            .font(.appScaled(size: 13, weight: .bold))
                            .foregroundStyle(visEditorSok ? CvBrand.purpleLight : CvBrand.textSecondary)
                            .frame(width: 28, height: 26)
                            .background(CvBrand.cardHi, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    // Smart Layers: slå lag av og på.
                    Menu {
                        ForEach(CanvasLag.allCases) { lag in
                            Button {
                                if skjulteLag.contains(lag.rawValue) {
                                    skjulteLag.remove(lag.rawValue)
                                } else {
                                    skjulteLag.insert(lag.rawValue)
                                }
                            } label: {
                                Label(lag.etikett,
                                      systemImage: skjulteLag.contains(lag.rawValue)
                                          ? "eye.slash" : "eye")
                            }
                        }
                        if !skjulteLag.isEmpty {
                            Divider()
                            Button("Vis alle lag") { skjulteLag.removeAll() }
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "square.3.layers.3d")
                                .font(.appScaled(size: 10, weight: .bold))
                            Text(skjulteLag.isEmpty ? "Lag" : "Lag (\(skjulteLag.count) av)")
                                .font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(skjulteLag.isEmpty
                                         ? CvBrand.textSecondary : CvBrand.orange)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(skjulteLag.isEmpty
                                    ? CvBrand.cardHi : CvBrand.orange.opacity(0.2),
                                    in: Capsule())
                    }
                    // Time Travel: se hvordan idéene utviklet seg over dager.
                    if valgtId != nil, !isDemo {
                        Button {
                            visTidsreise = true
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "clock.arrow.2.circlepath")
                                    .font(.appScaled(size: 10, weight: .bold))
                                Text("Tidsreise")
                                    .font(.appScaled(size: 11, weight: .bold))
                            }
                            .foregroundStyle(CvBrand.textSecondary)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(CvBrand.cardHi, in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                    // Undo-HISTORIKK: hopp til et hvilket som helst punkt.
                    if let id = valgtId, let liste = historikk[id], liste.count > 1 {
                        Menu {
                            ForEach(Array(liste.reversed().enumerated()), id: \.offset) { i, snap in
                                Button {
                                    gjenopprett(snap)
                                } label: {
                                    Label("\(Self.klokkeslett(snap.tid)) · \(snap.strokAntall) strøk"
                                          + (i == 0 ? " (nå)" : ""),
                                          systemImage: i == 0 ? "checkmark.circle" : "arrow.uturn.backward.circle")
                                }
                                .disabled(i == 0)
                            }
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "clock.arrow.circlepath")
                                    .font(.appScaled(size: 10, weight: .bold))
                                Text("Historikk")
                                    .font(.appScaled(size: 11, weight: .bold))
                            }
                            .foregroundStyle(CvBrand.textSecondary)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(CvBrand.cardHi, in: Capsule())
                        }
                    }
                    // Pencil-first: håndflata hviler trygt når kun Pencil tegner.
                    Button {
                        kunPencil.toggle()
                    } label: {
                        Image(systemName: kunPencil ? "applepencil.tip" : "hand.draw")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(kunPencil ? CvBrand.purpleLight : CvBrand.textSecondary)
                            .frame(width: 28, height: 26)
                            .background(kunPencil
                                        ? CvBrand.purple.opacity(0.25) : CvBrand.cardHi,
                                        in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .help(kunPencil ? "Kun Pencil tegner" : "Finger og Pencil tegner")
                    // Levende tankekart/brainstorm: noder som bygges videre på.
                    if papir == .tankekart || papir == .brainstorm {
                        Button {
                            let ny = CanvasNode(
                                parentId: nil,
                                tekst: "",
                                x: 360 + Double(noder.count % 4) * 60,
                                y: 240 + Double(noder.count / 4) * 60)
                            noder.append(ny)
                            redigererNode = ny
                        } label: {
                            HStack(spacing: 5) {
                                Image(systemName: "plus.bubble")
                                    .font(.appScaled(size: 10, weight: .bold))
                                Text("Node")
                                    .font(.appScaled(size: 11, weight: .bold))
                            }
                            .foregroundStyle(CvBrand.purpleLight)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(CvBrand.purple.opacity(0.25), in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                    // Flersidig flate: gått tom for plass? Utvid nedover.
                    Button {
                        sider = min(20, sider + 1)
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "plus.rectangle.on.rectangle")
                                .font(.appScaled(size: 10, weight: .bold))
                            Text("Side")
                                .font(.appScaled(size: 11, weight: .bold))
                            if sider > 1 {
                                Text("\(sider)")
                                    .font(.appScaled(size: 10, weight: .black))
                                    .foregroundStyle(CvBrand.purpleLight)
                            }
                        }
                        .foregroundStyle(CvBrand.textSecondary)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(CvBrand.cardHi, in: Capsule())
                    }
                    .buttonStyle(.plain)
                    .help("Mer plass — malen gjentas på neste side")
                    // Papir-maler (Daniels liste): SWOT/Kanban/Pipeline/…
                    Menu {
                        ForEach(CanvasPapir.allCases) { pv in
                            Button {
                                papir = pv
                            } label: {
                                Label(pv.etikett, systemImage: pv.ikon)
                            }
                        }
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: papir.ikon)
                                .font(.appScaled(size: 10, weight: .bold))
                            Text(papir == .blank ? "Papir" : papir.etikett)
                                .font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(papir == .blank
                                         ? CvBrand.textSecondary : CvBrand.purpleLight)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(papir == .blank
                                    ? CvBrand.cardHi : CvBrand.purple.opacity(0.25),
                                    in: Capsule())
                    }
                    Spacer()
                }
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(CvBrand.card.opacity(0.6))
            }

            if visEditorSok {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(CvBrand.textTertiary)
                    TextField("Søk i notatet — også håndskrift …", text: $editorSok)
                        .font(.appScaled(size: 12))
                        .foregroundStyle(.white)
                        .textFieldStyle(.plain)
                        .onSubmit { Task { await finnTreffIEditor() } }
                    if !sokTreff.isEmpty {
                        Text("\(sokTreffIndeks + 1)/\(sokTreff.count)")
                            .font(.appScaled(size: 10, weight: .bold))
                            .foregroundStyle(CvBrand.purpleLight)
                        Button {
                            sokTreffIndeks = (sokTreffIndeks + 1) % sokTreff.count
                        } label: {
                            Image(systemName: "chevron.down.circle.fill")
                                .font(.appScaled(size: 14))
                                .foregroundStyle(CvBrand.purpleLight)
                        }
                        .buttonStyle(.plain)
                    }
                    Button {
                        Task { await finnTreffIEditor() }
                    } label: {
                        Text("Finn")
                            .font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(CvBrand.purple, in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 12).padding(.vertical, 7)
                .background(CvBrand.card.opacity(0.8))
            }
            // Selve tegneflata — PKToolPicker docker seg til bunnen.
            // Andres delte notater: kun visning (PUT er uansett eier-scopet).
            GeometryReader { geo in
            ScrollViewReader { scrollProxy in
            ScrollView(.vertical, showsIndicators: true) {
            ZStack(alignment: .topLeading) {
                CvBrand.bg
                // Spatial Search: usynlig anker + pulserende markering.
                if sokTreffIndeks < sokTreff.count {
                    let treff = sokTreff[sokTreffIndeks]
                    Circle()
                        .stroke(CvBrand.yellow, lineWidth: 3)
                        .frame(width: 90, height: 90)
                        .position(treff)
                        .id("sokTreffAnker")
                        .allowsHitTesting(false)
                        .shadow(color: CvBrand.yellow.opacity(0.7), radius: 10)
                }
                // Malen gjentas per side («+ Side» = aldri tom for plass).
                VStack(spacing: 0) {
                    ForEach(0..<sider, id: \.self) { _ in
                        PapirView(papir: papir)
                            .frame(height: geo.size.height)
                    }
                }
                // Objekt-laget: bilder/kort UNDER blekket — tegn oppå for å
                // annotere. I objekt-modus rutes touch hit (canvas er av).
                ForEach(objekter.filter { !erLagSkjult($0.type) }) { obj in
                    ObjektView(objekt: obj,
                               redigerbar: valgtErMin && objektModus,
                               liveInnhold: liveInnhold(obj),
                               erValgt: valgte.contains(obj.id),
                               onToggleValg: {
                                   if valgte.contains(obj.id) { valgte.remove(obj.id) }
                                   else { valgte.insert(obj.id) }
                               },
                               onFlyttFelles: { d in flyttValgte(d) },
                               onEndre: { ny in
                                   if let i = objekter.firstIndex(where: { $0.id == obj.id }) {
                                       objekter[i] = ny
                                   }
                               },
                               onSlett: {
                                   objekter.removeAll { $0.id == obj.id }
                               })
                }
                // Tankekart: koblingslinjene tegnes under nodene.
                if !noder.isEmpty && !skjulteLag.contains(CanvasLag.noder.rawValue) {
                    NodeKoblinger(noder: noder)
                }
                PencilCanvas(drawing: $drawing,
                             redigerbar: valgtErMin && !objektModus,
                             kunPencil: kunPencil,
                             onFormGjenkjent: { figur in
                                 figurer.append(figur)
                             },
                             pennValg: pennValg)
                ForEach(skjulteLag.contains(CanvasLag.stempler.rawValue) ? [] : stempler) { st in
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
                ForEach(skjulteLag.contains(CanvasLag.former.rawValue) ? [] : figurer) { fig in
                    FigurView(figur: fig, redigerbar: valgtErMin,
                              onEndre: { ny in
                                  if let i = figurer.firstIndex(where: { $0.id == fig.id }) {
                                      figurer[i] = ny
                                  }
                              },
                              onSlett: {
                                  figurer.removeAll { $0.id == fig.id }
                              })
                }
                ForEach(skjulteLag.contains(CanvasLag.noder.rawValue) ? [] : noder) { node in
                    NodeView(node: node, redigerbar: valgtErMin,
                             onEndre: { ny in
                                 if let i = noder.firstIndex(where: { $0.id == node.id }) {
                                     noder[i] = ny
                                 }
                             },
                             onNyttBarn: {
                                 let barn = CanvasNode(
                                     parentId: node.id,
                                     tekst: "",
                                     x: node.x + Double.random(in: 120...190),
                                     y: node.y + Double.random(in: -80...110))
                                 noder.append(barn)
                                 redigererNode = barn
                             },
                             onRediger: { redigererNode = node },
                             onSlett: {
                                 // Barn beholdes som frittstående lapper.
                                 for i in noder.indices where noder[i].parentId == node.id {
                                     noder[i].parentId = nil
                                 }
                                 noder.removeAll { $0.id == node.id }
                             })
                }
                ForEach(skjulteLag.contains(CanvasLag.tekst.rawValue) ? [] : tekstbokser) { tb in
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
            .frame(height: geo.size.height * CGFloat(sider))
            .dropDestination(for: Data.self) { biter, plassering in
                guard valgtErMin, let data = biter.first,
                      UIImage(data: data) != nil else { return false }
                leggTilBilde(data, ved: plassering)
                return true
            }
            }
            .onChange(of: sokTreffIndeks) { _, _ in
                withAnimation(.easeInOut(duration: 0.4)) {
                    scrollProxy.scrollTo("sokTreffAnker", anchor: .center)
                }
            }
            .onChange(of: sokTreff) { _, ny in
                guard !ny.isEmpty else { return }
                withAnimation(.easeInOut(duration: 0.4)) {
                    scrollProxy.scrollTo("sokTreffAnker", anchor: .center)
                }
            }
            }
            }
            .alert("Lagre som element", isPresented: $lagrerElementNavn) {
                TextField("Navn på elementet", text: $elementNavn)
                Button("Lagre") { lagreValgteSomElement() }
                Button("Avbryt", role: .cancel) {}
            } message: {
                Text("De valgte objektene gjenbrukes fra Bibliotek-menyen i alle notater.")
            }
            .alert("Node", isPresented: Binding(
                get: { redigererNode != nil },
                set: { if !$0 { redigererNode = nil } })) {
                TextField("Tekst i noden", text: Binding(
                    get: { redigererNode?.tekst ?? "" },
                    set: { ny in
                        redigererNode?.tekst = ny
                        if let rn = redigererNode,
                           let i = noder.firstIndex(where: { $0.id == rn.id }) {
                            noder[i].tekst = ny
                        }
                    }))
                Button("Ferdig") { redigererNode = nil }
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
                               leadId: kobletLeadId,
                               romligTillegg: romligBeskrivelse())
        }
        .photosPicker(isPresented: $bildeVelgerAapen, selection: $bildeValg,
                      matching: .images)
        .fileImporter(isPresented: $pdfVelgerAapen,
                      allowedContentTypes: [.pdf]) { resultat in
            if case .success(let url) = resultat {
                importerPDF(fra: url)
            }
        }
        .alert("PDF-import", isPresented: Binding(
            get: { feilVedImport != nil },
            set: { if !$0 { feilVedImport = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(feilVedImport ?? "")
        }
        .onChange(of: bildeValg) { _, valg in
            guard let valg else { return }
            Task {
                if let data = try? await valg.loadTransferable(type: Data.self) {
                    leggTilBilde(data)
                }
                bildeValg = nil
            }
        }
        .sheet(isPresented: $visTidsreise) {
            if let id = valgtId {
                TidsreiseSheet(notatId: id, naavaerende: drawing) { gjenopprettet in
                    taSnapshot()
                    drawing = gjenopprettet
                    visTidsreise = false
                }
            }
        }
        // Live collab v1: delte notater poller etter kollega-endringer.
        .task(id: valgtId) {
            guard let id = valgtId,
                  let notat = notater.first(where: { $0.id == id }),
                  !notat.erMin || notat.delt,
                  !isDemo else { return }
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 6_000_000_000)
                guard valgtId == id, let api = appState.api,
                      let ferske = try? await api.hentCanvasNotater(),
                      let fersk = ferske.first(where: { $0.id == id }) else { continue }
                let lokalOppdatert = notater.first(where: { $0.id == id })?.oppdatert
                let fjernTid = ISO8601DateFormatter().date(from: fersk.oppdatert ?? "")
                if let ft = fjernTid, let lt = lokalOppdatert,
                   ft > lt.addingTimeInterval(2) {
                    kollegaOppdatering = fersk.eierNavn ?? "En kollega"
                }
            }
        }
        .sheet(isPresented: $visTypeVelger) {
            CanvasTypeVelger { valgt in
                visTypeVelger = false
                nyttNotat(type: valgt)
            }
            .presentationDetents([.medium])
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

    private func nyttNotat(type: CanvasKategori = .mote) {
        papir = CanvasPapir.standardFor(type)
        // Lagre det som står i editoren først (best effort, uten å vente).
        if valgtId != nil { Task { await lagre(stille: true) } }
        let pos = KartLocationManager.shared.currentCoordinate
        let n = CanvasNotat(
            id: UUID().uuidString.lowercased(),
            tittel: "",
            kategori: type,
            selskap: nil, leadId: nil,
            drawingData: Data(),
            oppdatert: Date(),
            erNy: true,
            lat: pos?.latitude, lon: pos?.longitude,
            papir: CanvasPapir.standardFor(type))
        notater.insert(n, at: 0)
        velg(n)
    }

    private func velg(_ n: CanvasNotat) {
        // Bytte av notat = lagre det forrige stille (tegninger skal ikke dø).
        if let gjeldende = valgtId, gjeldende != n.id {
            Task { await lagre(stille: true) }
        }
        valgtId = n.id
        if !aapneFaner.contains(n.id) {
            aapneFaner.append(n.id)
            if aapneFaner.count > 6 { aapneFaner.removeFirst() }
        }
        tittel = n.tittel
        kategori = n.kategori
        kobletLeadId = n.leadId
        kobletSelskap = n.selskap
        deltMedTeam = n.delt
        stempler = n.stempler
        tekstbokser = n.tekstbokser
        figurer = n.figurer
        papir = n.papir
        noder = n.noder
        sider = max(1, n.sider)
        objekter = n.objekter
        objektModus = false
        notatLat = n.lat
        notatLon = n.lon
        drawing = (try? PKDrawing(data: n.drawingData)) ?? PKDrawing()
        lagretToast = false
        valgte.removeAll()
        taSnapshot()
    }

    private func slett(_ n: CanvasNotat) {
        notater.removeAll { $0.id == n.id }
        aapneFaner.removeAll { $0 == n.id }
        if valgtId == n.id { valgtId = aapneFaner.last }
        guard !isDemo, !n.erNy, let api = appState.api else { return }
        Task { try? await api.slettCanvasNotat(id: n.id) }
    }

    @MainActor
    private func lagre(stille: Bool = false) async {
        guard let id = valgtId,
              let idx = notater.firstIndex(where: { $0.id == id }) else { return }
        var n = notater[idx]
        guard n.erMin else { return }   // andres delte notater lagres aldri
        taSnapshot()
        n.tittel = tittel
        n.kategori = kategori
        n.leadId = kobletLeadId
        n.selskap = kobletSelskap
        n.delt = deltMedTeam
        n.stempler = stempler
        n.tekstbokser = tekstbokser
        n.figurer = figurer
        n.papir = papir
        n.noder = noder
        n.sider = sider
        n.objekter = objekter
        n.lat = notatLat
        n.lon = notatLon
        n.sokbarTekst = await byggSokbarTekst()
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
            let figurerJSON = (try? JSONEncoder().encode(n.figurer))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
            let noderJSON = (try? JSONEncoder().encode(n.noder))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
            let objekterJSON = (try? JSONEncoder().encode(n.objekter))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
            if n.erNy {
                let nyId = try await api.opprettCanvasNotat(
                    tittel: n.tittel, kategori: n.kategori.rawValue,
                    selskap: n.selskap, leadId: n.leadId,
                    drawingBase64: n.drawingData.base64EncodedString(),
                    delt: n.delt, lat: n.lat, lon: n.lon,
                    stempler: stemplerJSON, tekstbokser: tekstbokserJSON,
                    figurer: figurerJSON, papir: n.papir.rawValue,
                    noder: noderJSON, sider: n.sider, objekter: objekterJSON,
                    sokbarTekst: n.sokbarTekst)
                n.id = nyId
                n.erNy = false
                if valgtId == id { valgtId = nyId }
            } else {
                try await api.oppdaterCanvasNotat(
                    id: n.id, tittel: n.tittel, kategori: n.kategori.rawValue,
                    selskap: n.selskap, leadId: n.leadId,
                    drawingBase64: n.drawingData.base64EncodedString(),
                    delt: n.delt, lat: n.lat, lon: n.lon,
                    stempler: stemplerJSON, tekstbokser: tekstbokserJSON,
                    figurer: figurerJSON, papir: n.papir.rawValue,
                    noder: noderJSON, sider: n.sider, objekter: objekterJSON,
                    sokbarTekst: n.sokbarTekst)
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
                    .flatMap { try? JSONDecoder().decode([CanvasTekstboks].self, from: $0) } ?? [],
                figurer: (dto.figurer?.data(using: .utf8))
                    .flatMap { try? JSONDecoder().decode([CanvasFigur].self, from: $0) } ?? [],
                papir: CanvasPapir(rawValue: dto.papir ?? "blank") ?? .blank,
                noder: (dto.noder?.data(using: .utf8))
                    .flatMap { try? JSONDecoder().decode([CanvasNode].self, from: $0) } ?? [],
                sider: max(1, dto.sider ?? 1),
                objekter: (dto.objekter?.data(using: .utf8))
                    .flatMap { try? JSONDecoder().decode([CanvasObjekt].self, from: $0) } ?? [],
                sokbarTekst: dto.sokbarTekst ?? "")
        }
        genererThumbs()
        if let api = appState.api {
            oppgaverCache = (try? await api.hentMoteOppgaver()) ?? []
        }
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
    /// Alt innhold skal med i eksporten: blekk + objekter + noder — en
    /// signert kontrakt beskjæres aldri til bare signaturen.
    private func eksportBounds() -> CGRect {
        var samlet = drawing.bounds.isEmpty ? CGRect.null : drawing.bounds
        for obj in objekter {
            var stor = CGSize(width: 380 * obj.skala, height: 110)
            if let b64 = obj.bildeBase64, let data = Data(base64Encoded: b64),
               let img = UIImage(data: data) {
                stor = CGSize(width: img.size.width * obj.skala,
                              height: img.size.height * obj.skala)
            }
            samlet = samlet.union(CGRect(x: obj.x - stor.width / 2,
                                         y: obj.y - stor.height / 2,
                                         width: stor.width, height: stor.height))
        }
        for node in noder {
            samlet = samlet.union(CGRect(x: node.x - 110, y: node.y - 40,
                                         width: 220, height: 80))
        }
        return samlet.isNull
            ? CGRect(x: 0, y: 0, width: 800, height: 600)
            : samlet.insetBy(dx: -40, dy: -40)
    }

    private func komponertBilde() -> UIImage {
        let bounds = eksportBounds()
        let base = drawing.image(from: bounds, scale: 2.0)
        let renderer = UIGraphicsImageRenderer(size: base.size)
        return renderer.image { rctx in
            // Mørk bakgrunn + papir-malen — deles slik flata faktisk ser ut.
            UIColor(red: 0.05, green: 0.04, blue: 0.10, alpha: 1).setFill()
            rctx.fill(CGRect(origin: .zero, size: base.size))
            papir.tegn(i: rctx.cgContext, storrelse: base.size)
            // Objekt-laget under blekket — som på skjermen.
            for obj in objekter {
                let punkt = CGPoint(x: (obj.x - bounds.minX) * 2.0,
                                    y: (obj.y - bounds.minY) * 2.0)
                if let b64 = obj.bildeBase64,
                   let data = Data(base64Encoded: b64),
                   let img = UIImage(data: data) {
                    let b = CGSize(width: img.size.width * obj.skala,
                                   height: img.size.height * obj.skala)
                    img.draw(in: CGRect(x: punkt.x - b.width / 2,
                                        y: punkt.y - b.height / 2,
                                        width: b.width, height: b.height))
                } else if let tittel = obj.tittel {
                    let bredde: CGFloat = 380 * obj.skala
                    let rekt = CGRect(x: punkt.x - bredde / 2, y: punkt.y - 55,
                                      width: bredde, height: 110)
                    let ctx = rctx.cgContext
                    ctx.setFillColor(UIColor(red: 0.13, green: 0.11, blue: 0.20, alpha: 1).cgColor)
                    let bane = UIBezierPath(roundedRect: rekt, cornerRadius: 18)
                    ctx.addPath(bane.cgPath)
                    ctx.fillPath()
                    (tittel as NSString).draw(
                        at: CGPoint(x: rekt.minX + 22, y: rekt.minY + 18),
                        withAttributes: [.font: UIFont.boldSystemFont(ofSize: 30),
                                         .foregroundColor: UIColor.white])
                    ((obj.detalj ?? "") as NSString).draw(
                        at: CGPoint(x: rekt.minX + 22, y: rekt.minY + 62),
                        withAttributes: [.font: UIFont.systemFont(ofSize: 24),
                                         .foregroundColor: UIColor.white.withAlphaComponent(0.6)])
                }
            }
            base.draw(at: .zero)
            for st in stempler {
                let punkt = CGPoint(x: (st.x - bounds.minX) * 2.0,
                                    y: (st.y - bounds.minY) * 2.0)
                (st.tegn as NSString).draw(
                    at: punkt,
                    withAttributes: [.font: UIFont.systemFont(ofSize: 64)])
            }
            for fig in figurer {
                guard let ctx = UIGraphicsGetCurrentContext() else { continue }
                ctx.saveGState()
                ctx.setStrokeColor(UIColor(hex: fig.fargeHex).cgColor)
                ctx.setLineWidth(8 * fig.skala)
                let senter = CGPoint(x: (fig.x - bounds.minX) * 2.0,
                                     y: (fig.y - bounds.minY) * 2.0)
                ctx.translateBy(x: senter.x, y: senter.y)
                ctx.rotate(by: CGFloat(fig.rotasjon) * .pi / 180)
                let dimSkala = (fig.bredde ?? 200) / 200
                CanvasForm.fra(fig.form)?
                    .banePath(senter: .zero, skala: fig.skala * dimSkala * 2.0)
                    .forEach { ctx.addPath($0); ctx.strokePath() }
                ctx.restoreGState()
            }
            if let ctx = UIGraphicsGetCurrentContext() {
                // Koblingslinjer + noder (tankekart/brainstorm) i eksporten.
                ctx.setStrokeColor(UIColor.white.withAlphaComponent(0.3).cgColor)
                ctx.setLineWidth(4)
                let pos = Dictionary(uniqueKeysWithValues: noder.map {
                    ($0.id, CGPoint(x: ($0.x - bounds.minX) * 2.0,
                                    y: ($0.y - bounds.minY) * 2.0)) })
                for node in noder {
                    guard let pid = node.parentId, let fra = pos[pid],
                          let til = pos[node.id] else { continue }
                    ctx.move(to: fra)
                    ctx.addLine(to: til)
                    ctx.strokePath()
                }
                for node in noder {
                    guard let punkt = pos[node.id] else { continue }
                    let bredde: CGFloat = 220
                    let rekt = CGRect(x: punkt.x - bredde / 2, y: punkt.y - 40,
                                      width: bredde, height: 80)
                    ctx.setStrokeColor(UIColor(hex: node.fargeHex).cgColor)
                    ctx.setLineWidth(4)
                    ctx.strokeEllipse(in: rekt)
                    (node.tekst as NSString).draw(
                        at: CGPoint(x: rekt.minX + 24, y: punkt.y - 16),
                        withAttributes: [
                            .font: UIFont.boldSystemFont(ofSize: 26),
                            .foregroundColor: UIColor.white,
                        ])
                }
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

    private var oppgaveKandidater: [MoteOppgaveDTO] {
        if isDemo {
            return [MoteOppgaveDTO(id: "demo-o1", selskap: "Nordic Elektro AS",
                                   tittel: "Prisforslag rammeavtale",
                                   frist: "torsdag", status: "open"),
                    MoteOppgaveDTO(id: "demo-o2", selskap: "Nordic Elektro AS",
                                   tittel: "Book befaring", frist: "neste uke",
                                   status: "open")]
        }
        return oppgaverCache
    }
    @State private var oppgaverCache: [MoteOppgaveDTO] = []

    /// Universalsøk-indeksen: alt tekstlig i notatet + rask OCR av blekket.
    /// Kjøres ved lagring (.fast-nivå — indeksering, ikke presisjon).
    private func byggSokbarTekst() async -> String {
        var deler: [String] = []
        deler.append(contentsOf: tekstbokser.map(\.tekst))
        deler.append(contentsOf: noder.map(\.tekst))
        deler.append(contentsOf: objekter.compactMap(\.tittel))
        deler.append(contentsOf: objekter.compactMap(\.detalj))
        if !drawing.bounds.isEmpty, let cg = drawing
            .image(from: drawing.bounds, scale: 1.5).cgImage {
            let tekst: String = await withCheckedContinuation { cont in
                let req = VNRecognizeTextRequest { r, _ in
                    let linjer = (r.results as? [VNRecognizedTextObservation] ?? [])
                        .compactMap { $0.topCandidates(1).first?.string }
                    cont.resume(returning: linjer.joined(separator: " "))
                }
                req.recognitionLevel = .fast
                req.recognitionLanguages = ["nb-NO", "en-US"]
                DispatchQueue.global(qos: .utility).async {
                    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
                    do { try handler.perform([req]) }
                    catch { cont.resume(returning: "") }
                }
            }
            deler.append(tekst)
        }
        return deler.filter { !$0.isEmpty }.joined(separator: " ").prefix(18_000)
            .description
    }

    /// PDF-annotering: tilbud/kontrakter/ordreskjema/plantegninger inn som
    /// side-objekter under blekket — marker med tusjen, skriv med tekst-
    /// bokser/Scribble, signer og tegn med pennen. Del som PDF etterpå.
    private func importerPDF(fra url: URL) {
        let tilgang = url.startAccessingSecurityScopedResource()
        defer { if tilgang { url.stopAccessingSecurityScopedResource() } }
        guard let dok = PDFDocument(url: url) else { return }
        let antall = min(dok.pageCount, 12)
        var y: Double = 60
        for i in 0..<antall {
            guard let side = dok.page(at: i) else { continue }
            let ramme = side.bounds(for: .mediaBox)
            let bredde: CGFloat = 760
            let hoyde = ramme.height / max(ramme.width, 1) * bredde
            let bilde = side.thumbnail(of: CGSize(width: bredde * 2,
                                                  height: hoyde * 2),
                                       for: .mediaBox)
            guard let jpeg = bilde.jpegData(compressionQuality: 0.7) else { continue }
            y += Double(hoyde) / 2
            objekter.append(CanvasObjekt(
                type: "pdf", x: 430, y: y, skala: 0.5,
                bildeBase64: jpeg.base64EncodedString(),
                tittel: antall > 1
                    ? "\(url.deletingPathExtension().lastPathComponent) · s. \(i + 1)"
                    : url.deletingPathExtension().lastPathComponent,
                detalj: String((side.string ?? "").prefix(2000))))
            y += Double(hoyde) / 2 + 40
        }
        // Flata må være høy nok for alle sidene (nominell sidehøyde ~900pt).
        sider = min(20, max(sider, Int(ceil(y / 900)) + 1))
        if dok.pageCount > antall {
            feilVedImport = "PDF-en har \(dok.pageCount) sider — de første \(antall) ble lagt inn."
        }
    }
    @State private var feilVedImport: String?

    /// Bilde inn: nedskaler til maks 1200px + JPEG 0.7 (holder JSON-capen).
    private func leggTilBilde(_ data: Data, ved punkt: CGPoint? = nil) {
        guard var bilde = UIImage(data: data) else { return }
        let maks: CGFloat = 1200
        if max(bilde.size.width, bilde.size.height) > maks {
            let faktor = maks / max(bilde.size.width, bilde.size.height)
            let ny = CGSize(width: bilde.size.width * faktor,
                            height: bilde.size.height * faktor)
            bilde = UIGraphicsImageRenderer(size: ny).image { _ in
                bilde.draw(in: CGRect(origin: .zero, size: ny))
            }
        }
        guard let jpeg = bilde.jpegData(compressionQuality: 0.7) else { return }
        let objektId = UUID().uuidString
        objekter.append(CanvasObjekt(
            id: objektId,
            type: "bilde",
            x: punkt.map(\.x).map(Double.init) ?? 420,
            y: punkt.map(\.y).map(Double.init) ?? 320,
            bildeBase64: jpeg.base64EncodedString()))
        objektModus = true
        // Bilde-OCR i bakgrunnen → teksten blir søkbar.
        if let cg = bilde.cgImage {
            Task.detached(priority: .utility) {
                let req = VNRecognizeTextRequest()
                req.recognitionLevel = .fast
                req.recognitionLanguages = ["nb-NO", "en-US"]
                let handler = VNImageRequestHandler(cgImage: cg, options: [:])
                try? handler.perform([req])
                let tekst = (req.results ?? [])
                    .compactMap { $0.topCandidates(1).first?.string }
                    .joined(separator: " ")
                guard !tekst.isEmpty else { return }
                await MainActor.run {
                    if let i = objekter.firstIndex(where: { $0.id == objektId }) {
                        objekter[i].detalj = String(tekst.prefix(2000))
                    }
                }
            }
        }
    }

    private func settInnLeadKort(_ lead: LeadModel) {
        objekter.append(CanvasObjekt(
            type: "lead", x: 400, y: 260,
            tittel: lead.name,
            detalj: "Score \(lead.leadScore ?? 0)"
                + (lead.estimatedValue.map { " · kr \(Int($0 / 1000))k" } ?? ""),
            refId: lead.id))
        objektModus = true
    }

    /// Living Canvas: KPI-kortet lagrer NØKKELEN — verdien slås opp live
    /// ved hver rendring (CRM endres → kortet endres).
    private func settInnKPI(nokkel: String) {
        objekter.append(CanvasObjekt(
            type: "kpi", x: 400, y: 260, refId: nokkel))
        objektModus = true
    }

    /// Live-oppslag for kortene: ferske tall fra appState ved hver
    /// rendring — refreshAll/websocket → Canvas oppdateres av seg selv.
    private func liveInnhold(_ obj: CanvasObjekt) -> (String, String)? {
        switch obj.type {
        case "lead":
            guard let id = obj.refId,
                  let lead = appState.leads.first(where: { $0.id == id })
            else { return nil }
            return (lead.name,
                    "Score \(lead.leadScore ?? 0)"
                    + (lead.estimatedValue.map { " · kr \(Int($0 / 1000))k" } ?? "")
                    + " · \(lead.status.rawValue)")
        case "kpi":
            switch obj.refId {
            case "leads": return ("Leads", "\(appState.leads.count)")
            case "hot":
                let hot = appState.leads.filter { ($0.leadScore ?? 0) >= 70 }.count
                return ("Hot leads", "\(hot)")
            case "pipeline":
                let sum = appState.leads.compactMap(\.estimatedValue).reduce(0, +)
                return ("Pipeline", "kr \(Int(sum / 1000))k")
            default: return nil
            }
        case "oppgave":
            guard let id = obj.refId else { return nil }
            if let o = oppgaverCache.first(where: { $0.id == id }) {
                return (o.tittel,
                        [o.selskap, o.frist].compactMap { $0 }.joined(separator: " · "))
            }
            // Ikke i åpne-lista lenger = fullført.
            return (obj.tittel ?? "Oppgave", "✓ Fullført")
        case "kalender":
            let neste = appState.calendar
                .filter { $0.eventType == "meeting" && ($0.datetime ?? .distantPast) > Date() }
                .sorted { ($0.datetime ?? .distantPast) < ($1.datetime ?? .distantPast) }
                .first
            guard let m = neste, let tid = m.datetime else {
                return ("Neste møte", "Ingen planlagt")
            }
            let f = DateFormatter()
            f.locale = Locale(identifier: "nb_NO")
            f.dateFormat = "EEE d. MMM HH:mm"
            return ("Neste møte", "\(m.leadName) · \(f.string(from: tid))")
        default:
            return nil
        }
    }

    private func settInnOppgave(_ o: MoteOppgaveDTO) {
        objekter.append(CanvasObjekt(
            type: "oppgave", x: 400, y: 260,
            tittel: o.tittel,
            detalj: [o.selskap, o.frist].compactMap { $0 }.joined(separator: " · "),
            refId: o.id))
        objektModus = true
    }

    /// Kart-utsnitt: MKMapSnapshotter av notatets posisjon (eller Oslo).
    @MainActor
    private func settInnKartUtsnitt() async {
        let senter = CLLocationCoordinate2D(
            latitude: notatLat ?? 59.913, longitude: notatLon ?? 10.753)
        let opts = MKMapSnapshotter.Options()
        opts.region = MKCoordinateRegion(
            center: senter,
            span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.03))
        opts.size = CGSize(width: 440, height: 280)
        opts.traitCollection = UITraitCollection(userInterfaceStyle: .dark)
        guard let snap = try? await MKMapSnapshotter(options: opts).start(),
              let jpeg = snap.image.jpegData(compressionQuality: 0.75) else { return }
        objekter.append(CanvasObjekt(
            type: "kart", x: 430, y: 300,
            bildeBase64: jpeg.base64EncodedString(),
            tittel: kobletSelskap))
        objektModus = true
    }

    /// Editor-toppen (ekstrahert — type-sjekker-avlastning).
    private var editorTopp: some View {
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
                            ForEach(CanvasKategori.hovedTyper) { k in
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
                    if !drawing.bounds.isEmpty || !objekter.isEmpty {
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
    }

    /// Fane-raden (ekstrahert — type-sjekker-avlastning).
    private var faneRad: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(aapneFaner, id: \.self) { fid in
                    if let notat = notater.first(where: { $0.id == fid }) {
                        faneChip(fid, notat: notat)
                    }
                }
            }
            .padding(.horizontal, 12).padding(.top, 6)
        }
        .background(CvBrand.bg)
    }

    private func faneChip(_ fid: String, notat: CanvasNotat) -> some View {
        let aktiv = fid == valgtId
        return HStack(spacing: 6) {
            Circle()
                .fill(notat.kategori.farge)
                .frame(width: 7, height: 7)
            Text(notat.tittel.isEmpty ? "Uten tittel" : notat.tittel)
                .font(.appScaled(size: 11, weight: aktiv ? .bold : .semibold))
                .foregroundStyle(aktiv ? Color.white : CvBrand.textSecondary)
                .lineLimit(1)
            Button {
                aapneFaner.removeAll { $0 == fid }
                if valgtId == fid {
                    if let neste = aapneFaner.last,
                       let n = notater.first(where: { $0.id == neste }) {
                        velg(n)
                    } else {
                        valgtId = nil
                    }
                }
            } label: {
                Image(systemName: "xmark")
                    .font(.appScaled(size: 8, weight: .bold))
                    .foregroundStyle(CvBrand.textTertiary)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 11).padding(.vertical, 7)
        .frame(maxWidth: 190)
        .background(aktiv ? CvBrand.cardHi : CvBrand.card.opacity(0.6),
                    in: UnevenRoundedRectangle(
                        topLeadingRadius: 9, bottomLeadingRadius: 0,
                        bottomTrailingRadius: 0, topTrailingRadius: 9))
        .overlay(Rectangle()
            .fill(aktiv ? CvBrand.purple : Color.clear)
            .frame(height: 2), alignment: .bottom)
        .contentShape(Rectangle())
        .onTapGesture {
            if !aktiv, let n = notater.first(where: { $0.id == fid }) {
                velg(n)
            }
        }
    }

    /// Spatial Memory: hvor ligger objektene/nodene på flata? Ni soner
    /// (øvre/midtre/nedre × venstre/midt/høyre) — AI-en får rommet.
    private func romligBeskrivelse() -> String {
        let ramme = eksportBounds()
        func sone(_ x: Double, _ y: Double) -> String {
            let fx = (x - ramme.minX) / max(ramme.width, 1)
            let fy = (y - ramme.minY) / max(ramme.height, 1)
            let rad = fy < 0.34 ? "øvre" : (fy < 0.67 ? "midtre" : "nedre")
            let kol = fx < 0.34 ? "venstre" : (fx < 0.67 ? "midt" : "høyre")
            return "\(rad) \(kol)"
        }
        var linjer: [String] = []
        for tb in tekstbokser where !tb.tekst.isEmpty {
            linjer.append("tekst «\(tb.tekst)» (\(sone(tb.x, tb.y)))")
        }
        for node in noder where !node.tekst.isEmpty {
            let kobling = node.parentId != nil ? ", koblet i tankekartet" : ""
            linjer.append("node «\(node.tekst)» (\(sone(node.x, node.y))\(kobling))")
        }
        for obj in objekter {
            if let tittel = liveInnhold(obj)?.0 ?? obj.tittel, !tittel.isEmpty {
                linjer.append("\(obj.type)-kort «\(tittel)» (\(sone(obj.x, obj.y)))")
            }
        }
        return linjer.isEmpty ? "" : linjer.joined(separator: "; ")
    }

    // MARK: Spatial Search + Smart Layers

    private func erLagSkjult(_ objektType: String) -> Bool {
        switch objektType {
        case "bilde": return skjulteLag.contains(CanvasLag.bilder.rawValue)
        case "pdf": return skjulteLag.contains(CanvasLag.pdf.rawValue)
        case "kart": return skjulteLag.contains(CanvasLag.kart.rawValue)
        case "lead", "kpi", "kalender":
            return skjulteLag.contains(CanvasLag.crm.rawValue)
        case "oppgave": return skjulteLag.contains(CanvasLag.oppgaver.rawValue)
        default: return false
        }
    }

    /// Spatial Search: finn treff i tekstbokser/noder/objekter — og i
    /// HÅNDSKRIFTEN (on-demand OCR m/ posisjon) → flata scroller dit.
    @MainActor
    private func finnTreffIEditor() async {
        let q = editorSok.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return }
        var treff: [CGPoint] = []
        for tb in tekstbokser where tb.tekst.localizedCaseInsensitiveContains(q) {
            treff.append(CGPoint(x: tb.x, y: tb.y))
        }
        for node in noder where node.tekst.localizedCaseInsensitiveContains(q) {
            treff.append(CGPoint(x: node.x, y: node.y))
        }
        for obj in objekter {
            let tittel = liveInnhold(obj)?.0 ?? obj.tittel ?? ""
            let detalj = liveInnhold(obj)?.1 ?? obj.detalj ?? ""
            if tittel.localizedCaseInsensitiveContains(q)
                || detalj.localizedCaseInsensitiveContains(q) {
                treff.append(CGPoint(x: obj.x, y: obj.y))
            }
        }
        // Håndskriften: OCR med bounding boxes → canvas-koordinater.
        if !drawing.bounds.isEmpty {
            let ramme = drawing.bounds
            let bilde = drawing.image(from: ramme, scale: 1.5)
            if let cg = bilde.cgImage {
                let bokser: [CGRect] = await withCheckedContinuation { cont in
                    let req = VNRecognizeTextRequest { r, _ in
                        let obs = r.results as? [VNRecognizedTextObservation] ?? []
                        let funn = obs.compactMap { o -> CGRect? in
                            guard let tekst = o.topCandidates(1).first?.string,
                                  tekst.localizedCaseInsensitiveContains(q)
                            else { return nil }
                            return o.boundingBox
                        }
                        cont.resume(returning: funn)
                    }
                    req.recognitionLevel = .accurate
                    req.recognitionLanguages = ["nb-NO", "en-US"]
                    DispatchQueue.global(qos: .userInitiated).async {
                        let handler = VNImageRequestHandler(cgImage: cg, options: [:])
                        do { try handler.perform([req]) }
                        catch { cont.resume(returning: []) }
                    }
                }
                for boks in bokser {
                    // Vision: 0-1, origo nede-venstre → canvas-punkter.
                    treff.append(CGPoint(
                        x: ramme.minX + boks.midX * ramme.width,
                        y: ramme.minY + (1 - boks.midY) * ramme.height))
                }
            }
        }
        sokTreffIndeks = 0
        sokTreff = treff
    }

    // MARK: Context Awareness

    struct KontekstForslag {
        let ikon: String
        let tekst: String
        let handling: () -> Void
    }

    /// Prioritet: pågående/nært møte > aktiv rute > fysisk nær en lead.
    private func kontekstForslag() -> KontekstForslag? {
        // 1) Møte innen ±30 min → møtenotatet for selskapet.
        let naa = Date()
        if let mote = appState.calendar
            .filter({ $0.eventType == "meeting" })
            .compactMap({ m -> (CalendarEvent, Date)? in
                guard let t = m.datetime else { return nil }
                return abs(t.timeIntervalSince(naa)) < 30 * 60 ? (m, t) : nil
            })
            .min(by: { abs($0.1.timeIntervalSince(naa)) < abs($1.1.timeIntervalSince(naa)) }) {
            let selskap = mote.0.leadName
            let minutter = Int(mote.1.timeIntervalSince(naa) / 60)
            let nar = minutter > 1 ? "om \(minutter) min" : "nå"
            return KontekstForslag(
                ikon: "person.2.wave.2.fill",
                tekst: "Møte med \(selskap) \(nar) — åpne møtenotatet",
                handling: { aapneEllerOpprett(selskap: selskap, type: .mote) })
        }
        // 2) Aktiv rute → rutenotatet.
        if let plan = appState.rutePlan, plan.index < plan.stopp.count {
            let stopp = plan.stopp[plan.index]
            return KontekstForslag(
                ikon: "point.topleft.down.curvedto.point.bottomright.up.fill",
                tekst: "Aktiv rute — neste: \(stopp.name). Åpne rutenotatet",
                handling: { aapneEllerOpprett(selskap: stopp.name, type: .rute) })
        }
        // 3) Fysisk nær en lead (<300 m) → lead-notatet.
        if let pos = KartLocationManager.shared.currentCoordinate {
            let her = CLLocation(latitude: pos.latitude, longitude: pos.longitude)
            if let naer = appState.leads
                .map({ ($0, her.distance(from: CLLocation(latitude: $0.latitude,
                                                          longitude: $0.longitude))) })
                .filter({ $0.1 < 300 })
                .min(by: { $0.1 < $1.1 }) {
                let lead = naer.0
                return KontekstForslag(
                    ikon: "mappin.and.ellipse",
                    tekst: "Du er hos \(lead.name) — åpne notatet",
                    handling: { aapneEllerOpprett(selskap: lead.name, type: .lead,
                                                  leadId: lead.id) })
            }
        }
        return nil
    }

    /// Åpne siste notat for selskapet — eller opprett nytt pre-koblet.
    private func aapneEllerOpprett(selskap: String, type: CanvasKategori,
                                   leadId: String? = nil) {
        if let eksisterende = notater.first(where: {
            $0.erMin && ($0.selskap ?? "").caseInsensitiveCompare(selskap) == .orderedSame
        }) {
            velg(eksisterende)
        } else {
            nyttNotat(type: type)
            tittel = "\(type.etikett) — \(selskap)"
            kobletSelskap = selskap
            kobletLeadId = leadId
        }
    }

    // MARK: Visual CRM (stakeholder-kart)

    /// Stakeholder-kartet: selskapet i midten, rollene rundt — flytt,
    /// koble videre, bygg organisasjonen slik den faktisk er.
    private func settInnStakeholderKart(_ lead: LeadModel) {
        papir = .tankekart
        kobletSelskap = lead.name
        kobletLeadId = lead.id
        let senterId = UUID().uuidString
        noder.append(CanvasNode(id: senterId, parentId: nil,
                                tekst: lead.name, x: 470, y: 330,
                                fargeHex: "#B973FF"))
        let roller: [(String, Double, Double, String)] = [
            ("CEO", 250, 160, "#FA7333"),
            ("CFO", 690, 160, "#F9BF24"),
            ("Innkjøp", 210, 430, "#33D999"),
            ("IT", 470, 540, "#579BF9"),
            ("Prosjekt", 720, 430, "#59D9D9"),
        ]
        for (navn, x, y, farge) in roller {
            noder.append(CanvasNode(parentId: senterId, tekst: navn,
                                    x: x, y: y, fargeHex: farge))
        }
    }

    // MARK: Multi-select + bibliotek

    /// Dra ETT valgt element → alle valgte følger.
    private func flyttValgte(_ d: CGSize) {
        for i in figurer.indices where valgte.contains(figurer[i].id) {
            figurer[i].x += d.width; figurer[i].y += d.height
        }
        for i in stempler.indices where valgte.contains(stempler[i].id) {
            stempler[i].x += d.width; stempler[i].y += d.height
        }
        for i in tekstbokser.indices where valgte.contains(tekstbokser[i].id) {
            tekstbokser[i].x += d.width; tekstbokser[i].y += d.height
        }
        for i in objekter.indices where valgte.contains(objekter[i].id) {
            objekter[i].x += d.width; objekter[i].y += d.height
        }
    }

    private func slettValgte() {
        figurer.removeAll { valgte.contains($0.id) }
        stempler.removeAll { valgte.contains($0.id) }
        tekstbokser.removeAll { valgte.contains($0.id) }
        objekter.removeAll { valgte.contains($0.id) }
        valgte.removeAll()
    }

    /// Valgte objekter → gjenbrukbart element (posisjoner normalisert
    /// rundt tyngdepunktet).
    private func lagreValgteSomElement() {
        let f = figurer.filter { valgte.contains($0.id) }
        let st = stempler.filter { valgte.contains($0.id) }
        let tb = tekstbokser.filter { valgte.contains($0.id) }
        let ob = objekter.filter { valgte.contains($0.id) }
        let alleX = f.map(\.x) + st.map(\.x) + tb.map(\.x) + ob.map(\.x)
        let alleY = f.map(\.y) + st.map(\.y) + tb.map(\.y) + ob.map(\.y)
        guard !alleX.isEmpty else { return }
        let cx = alleX.reduce(0, +) / Double(alleX.count)
        let cy = alleY.reduce(0, +) / Double(alleY.count)
        var el = BibliotekElement(
            navn: elementNavn.isEmpty ? "Element \(bibliotek.count + 1)" : elementNavn,
            figurer: f, stempler: st, tekstbokser: tb, objekter: ob)
        for i in el.figurer.indices { el.figurer[i].x -= cx; el.figurer[i].y -= cy }
        for i in el.stempler.indices { el.stempler[i].x -= cx; el.stempler[i].y -= cy }
        for i in el.tekstbokser.indices { el.tekstbokser[i].x -= cx; el.tekstbokser[i].y -= cy }
        for i in el.objekter.indices { el.objekter[i].x -= cx; el.objekter[i].y -= cy }
        bibliotek.append(el)
        if bibliotek.count > 30 { bibliotek.removeFirst() }
        BibliotekElement.lagreAlle(bibliotek)
    }

    /// Sett inn et bibliotek-element (nye id-er, sentrert på flata).
    private func settInnElement(_ el: BibliotekElement) {
        let cx: Double = 430, cy: Double = 320
        for var f in el.figurer { f.id = UUID().uuidString; f.x += cx; f.y += cy; figurer.append(f) }
        for var st in el.stempler { st.id = UUID().uuidString; st.x += cx; st.y += cy; stempler.append(st) }
        for var tb in el.tekstbokser { tb.id = UUID().uuidString; tb.x += cx; tb.y += cy; tekstbokser.append(tb) }
        for var ob in el.objekter { ob.id = UUID().uuidString; ob.x += cx; ob.y += cy; objekter.append(ob) }
        objektModus = true
    }

    /// Snapshot av tegningen — kun når den faktisk er endret (cap 20).
    private func taSnapshot() {
        guard let id = valgtId else { return }
        let data = drawing.dataRepresentation()
        var liste = historikk[id] ?? []
        guard liste.last?.data != data else { return }
        liste.append(CanvasSnapshot(tid: Date(), data: data,
                                    strokAntall: drawing.strokes.count))
        if liste.count > 20 { liste.removeFirst(liste.count - 20) }
        historikk[id] = liste
    }

    /// Gjenopprett et punkt i historikken — nåværende tilstand snapshotes
    /// først, så angringen kan angres.
    private func gjenopprett(_ snap: CanvasSnapshot) {
        taSnapshot()
        drawing = (try? PKDrawing(data: snap.data)) ?? PKDrawing()
    }

    private static func klokkeslett(_ d: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f.string(from: d)
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
                        leadId: nil, drawingData: Data(), oppdatert: Date(),
                        papir: .mote),
            CanvasNotat(id: "demo-c2", tittel: "Oppfølging — Byggmester Hansen AS",
                        kategori: .oppfolging, selskap: "Byggmester Hansen AS",
                        leadId: nil, drawingData: Data(),
                        oppdatert: Date().addingTimeInterval(-3600)),
            CanvasNotat(id: "demo-c3", tittel: "Ruteplan — Grünerløkka",
                        kategori: .rute, selskap: nil,
                        leadId: nil, drawingData: Data(),
                        oppdatert: Date().addingTimeInterval(-7200),
                        papir: .rute),
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
    var kunPencil: Bool = false
    /// Shape recognition: hold pennen stille på slutten av strøket →
    /// strøket byttes ut med perfekt form (Apple Notes-oppførselen).
    var onFormGjenkjent: ((CanvasFigur) -> Void)? = nil
    /// Penn-galleriet: preset/modus fra velgeren.
    var pennValg: PennValg = .pen

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.drawing = drawing
        canvas.drawingPolicy = kunPencil ? .pencilOnly : .anyInput
        // Gjennomsiktig — papir-malen (SWOT/Kanban/…) ligger i laget bak.
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.overrideUserInterfaceStyle = .dark
        canvas.alwaysBounceVertical = false
        canvas.delegate = context.coordinator
        // Verktøylinja (penn/marker/viskelær/farger) — systemets egen.
        let picker = PKToolPicker()
        context.coordinator.toolPicker = picker
        picker.setVisible(true, forFirstResponder: canvas)
        picker.addObserver(canvas)
        // Apple Pencil: dobbelt-tap bytter penn↔viskelær, squeeze (Pencil
        // Pro) viser/skjuler verktøylinja. Pressure/tilt/prediction/lav
        // latency er native i PencilKit — dette er «papirfølelsen»-pluss.
        let pencil = UIPencilInteraction()
        pencil.delegate = context.coordinator
        canvas.addInteraction(pencil)
        context.coordinator.canvas = canvas
        DispatchQueue.main.async { canvas.becomeFirstResponder() }
        return canvas
    }

    func updateUIView(_ canvas: PKCanvasView, context: Context) {
        // Ekstern endring (notat-bytte) → oppdater uten delegat-løkke.
        if canvas.drawing != drawing && !context.coordinator.tegner {
            canvas.drawing = drawing
        }
        canvas.isUserInteractionEnabled = redigerbar
        canvas.drawingPolicy = kunPencil ? .pencilOnly : .anyInput
        // Penn-galleriet: bytt verktøy når valget endres (ikke ellers —
        // brukeren kan justere fritt i toolpickeren etterpå).
        if context.coordinator.anvendtPenn != pennValg {
            context.coordinator.anvendtPenn = pennValg
            context.coordinator.toolPicker?.selectedTool = pennValg.verktoy
            if pennValg == .laser {
                context.coordinator.laserStartAntall = canvas.drawing.strokes.count
            }
        }
        context.coordinator.parent = self
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate,
                             UIPencilInteractionDelegate {
        var parent: PencilCanvas
        var toolPicker: PKToolPicker?
        weak var canvas: PKCanvasView?
        var tegner = false
        /// Verktøyet før dobbelt-tap byttet til viskelær.
        private var forrigeVerktoy: PKTool?

        init(_ parent: PencilCanvas) { self.parent = parent }

        /// Dobbelt-tap på Pencil: penn ↔ viskelær (systeminnstillingen
        /// «bytt til forrige verktøy» respekteres implisitt — vi husker).
        func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
            guard let picker = toolPicker else { return }
            if picker.selectedTool is PKEraserTool, let forrige = forrigeVerktoy {
                picker.selectedTool = forrige
                forrigeVerktoy = nil
            } else {
                forrigeVerktoy = picker.selectedTool
                picker.selectedTool = PKEraserTool(.vector)
            }
        }

        /// Pencil Pro squeeze: vis/skjul verktøylinja (mer flate å tegne på).
        @available(iOS 17.5, *)
        func pencilInteraction(_ interaction: UIPencilInteraction,
                               didReceiveSqueeze squeeze: UIPencilInteraction.Squeeze) {
            guard squeeze.phase == .ended,
                  let picker = toolPicker, let canvas else { return }
            picker.setVisible(!picker.isVisible, forFirstResponder: canvas)
            canvas.becomeFirstResponder()
        }

        func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView) { tegner = true }
        func canvasViewDidEndUsingTool(_ canvasView: PKCanvasView) { tegner = false }
        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            // Penn-moduser: laser toner bort, pil-pennen snapper hvert strøk.
            if canvasView.drawing.strokes.count > forrigeAntallStrok,
               let siste = canvasView.drawing.strokes.last {
                if anvendtPenn == .laser {
                    forrigeAntallStrok = canvasView.drawing.strokes.count
                    parent.drawing = canvasView.drawing
                    planleggLaserFjerning(canvasView)
                    return
                }
                if anvendtPenn == .pil, let onForm = parent.onFormGjenkjent {
                    let punkter = siste.path.map(\.location)
                    if let a = punkter.first, let b = punkter.last,
                       hypot(b.x - a.x, b.y - a.y) > 40 {
                        let farge = PKInkingTool.convertColor(
                            siste.ink.color, from: .light, to: .dark).somHex
                        let vinkel = atan2(b.y - a.y, b.x - a.x) * 180 / .pi
                        var uten = canvasView.drawing
                        uten.strokes.removeLast()
                        canvasView.drawing = uten
                        parent.drawing = uten
                        forrigeAntallStrok = uten.strokes.count
                        onForm(CanvasFigur(
                            form: "pil",
                            x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
                            fargeHex: farge, rotasjon: Double(vinkel),
                            bredde: hypot(b.x - a.x, b.y - a.y) / 0.9,
                            hoyde: hypot(b.x - a.x, b.y - a.y) * 0.35))
                        return
                    }
                }
            }
            // Form-snap: sjekk siste strøk for «hold på slutten» + kjent form.
            if let onForm = parent.onFormGjenkjent,
               canvasView.drawing.strokes.count > forrigeAntallStrok,
               let siste = canvasView.drawing.strokes.last,
               let figur = FormGjenkjenner.gjenkjenn(siste) {
                var uten = canvasView.drawing
                uten.strokes.removeLast()
                canvasView.drawing = uten
                parent.drawing = uten
                forrigeAntallStrok = uten.strokes.count
                onForm(figur)
                return
            }
            forrigeAntallStrok = canvasView.drawing.strokes.count
            parent.drawing = canvasView.drawing
        }
        var forrigeAntallStrok = 0
        var anvendtPenn: PennValg?
        var laserStartAntall = 0

        /// Laser: strøket toner bort etter 1,2 s (FIFO fra laser-start).
        private func planleggLaserFjerning(_ canvasView: PKCanvasView) {
            let posisjon = laserStartAntall
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self, weak canvasView] in
                guard let self, let canvasView,
                      canvasView.drawing.strokes.count > posisjon else { return }
                var uten = canvasView.drawing
                uten.strokes.remove(at: posisjon)
                canvasView.drawing = uten
                self.parent.drawing = uten
                self.forrigeAntallStrok = uten.strokes.count
            }
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
    /// Spatial Memory: hvor objekter/noder/tekster ligger på flata.
    var romligTillegg: String = ""

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

    /// Farger for formene — konverteres m/ PKInkingTool.convertColor slik
    /// at de IKKE inverteres av PencilKits mørk-modus-rendring (Daniels
    /// funn: hvite former ble mørke).
    static let fargePalett: [UIColor] = [
        .white,
        UIColor(red: 0.75, green: 0.45, blue: 1.0, alpha: 1),
        UIColor(red: 0.20, green: 0.85, blue: 0.60, alpha: 1),
        UIColor(red: 0.98, green: 0.75, blue: 0.14, alpha: 1),
        UIColor(red: 0.98, green: 0.45, blue: 0.30, alpha: 1),
        UIColor(red: 0.34, green: 0.60, blue: 0.98, alpha: 1),
    ]

    var nokkel: String {
        switch self {
        case .rektangel: return "rektangel"
        case .sirkel: return "sirkel"
        case .pil: return "pil"
        case .linje: return "linje"
        }
    }

    static func fra(_ nokkel: String) -> CanvasForm? {
        allCases.first { $0.nokkel == nokkel }
    }

    /// CGPath-er for kompositt-rendring (deling/PDF) — speiler FigurView.
    func banePath(senter: CGPoint, skala: Double) -> [CGPath] {
        let s = skala
        switch self {
        case .rektangel:
            return [CGPath(rect: CGRect(x: senter.x - 90 * s, y: senter.y - 60 * s,
                                        width: 180 * s, height: 120 * s), transform: nil)]
        case .sirkel:
            return [CGPath(ellipseIn: CGRect(x: senter.x - 75 * s, y: senter.y - 75 * s,
                                             width: 150 * s, height: 150 * s), transform: nil)]
        case .pil:
            let p1 = CGMutablePath()
            p1.move(to: CGPoint(x: senter.x - 90 * s, y: senter.y))
            p1.addLine(to: CGPoint(x: senter.x + 90 * s, y: senter.y))
            p1.move(to: CGPoint(x: senter.x + 55 * s, y: senter.y - 28 * s))
            p1.addLine(to: CGPoint(x: senter.x + 90 * s, y: senter.y))
            p1.addLine(to: CGPoint(x: senter.x + 55 * s, y: senter.y + 28 * s))
            return [p1]
        case .linje:
            let p = CGMutablePath()
            p.move(to: CGPoint(x: senter.x - 100 * s, y: senter.y))
            p.addLine(to: CGPoint(x: senter.x + 100 * s, y: senter.y))
            return [p]
        }
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


// MARK: - CanvasTypeVelger (fase 6: strukturen — velg cover)

/// «Nytt notat» åpner denne: seks covers (Møte/Lead/Befaring/Salgsplan/
/// Prosjekt/Rute) — strukturen styrer kategorien fra første strøk.
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
private struct FigurView: View {
    let figur: CanvasFigur
    let redigerbar: Bool
    let onEndre: (CanvasFigur) -> Void
    let onSlett: () -> Void

    @State private var dragOffset: CGSize = .zero
    @State private var pinchSkala: CGFloat = 1.0
    @State private var vriVinkel: Angle = .zero

    var body: some View {
        let form = CanvasForm.fra(figur.form) ?? .rektangel
        let visSkala = figur.skala * pinchSkala
        FigurShape(form: form)
            .stroke(Color(UIColor(hex: figur.fargeHex)),
                    style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))
            .frame(width: (figur.bredde ?? 200) * visSkala,
                   height: (figur.hoyde ?? 160) * visSkala)
            .contentShape(Rectangle())
            .rotationEffect(.degrees(figur.rotasjon) + vriVinkel)
            .position(x: figur.x + dragOffset.width,
                      y: figur.y + dragOffset.height)
            .gesture(redigerbar ? DragGesture()
                .onChanged { dragOffset = $0.translation }
                .onEnded { v in
                    var ny = figur
                    ny.x += v.translation.width
                    ny.y += v.translation.height
                    dragOffset = .zero
                    onEndre(ny)
                } : nil)
            .simultaneousGesture(redigerbar ? MagnificationGesture()
                .onChanged { pinchSkala = $0 }
                .onEnded { v in
                    var ny = figur
                    ny.skala = min(4.0, max(0.3, ny.skala * v))
                    pinchSkala = 1.0
                    onEndre(ny)
                } : nil)
            .simultaneousGesture(redigerbar ? RotationGesture()
                .onChanged { vriVinkel = $0 }
                .onEnded { v in
                    var ny = figur
                    ny.rotasjon += v.degrees
                    vriVinkel = .zero
                    onEndre(ny)
                } : nil)
            .onLongPressGesture(minimumDuration: 0.6) {
                if redigerbar { onSlett() }
            }
    }
}

/// SwiftUI-Shape som speiler CanvasForm.banePath — normalisert til ramma.
private struct FigurShape: Shape {
    let form: CanvasForm

    func path(in rect: CGRect) -> Path {
        var p = Path()
        let midY = rect.midY
        switch form {
        case .rektangel:
            p.addRect(rect.insetBy(dx: rect.width * 0.05, dy: rect.height * 0.12))
        case .sirkel:
            let side = min(rect.width, rect.height) * 0.9
            p.addEllipse(in: CGRect(x: rect.midX - side / 2,
                                    y: rect.midY - side / 2,
                                    width: side, height: side))
        case .pil:
            p.move(to: CGPoint(x: rect.minX + rect.width * 0.05, y: midY))
            p.addLine(to: CGPoint(x: rect.maxX - rect.width * 0.05, y: midY))
            p.move(to: CGPoint(x: rect.maxX - rect.width * 0.24, y: midY - rect.height * 0.17))
            p.addLine(to: CGPoint(x: rect.maxX - rect.width * 0.05, y: midY))
            p.addLine(to: CGPoint(x: rect.maxX - rect.width * 0.24, y: midY + rect.height * 0.17))
        case .linje:
            p.move(to: CGPoint(x: rect.minX, y: midY))
            p.addLine(to: CGPoint(x: rect.maxX, y: midY))
        }
        return p
    }
}

// MARK: - UIColor ↔ hex (figur-farger)

extension UIColor {
    var somHex: String {
        var r: CGFloat = 1, g: CGFloat = 1, b: CGFloat = 1, a: CGFloat = 1
        getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02X%02X%02X",
                      Int(r * 255), Int(g * 255), Int(b * 255))
    }
}

// MARK: - CanvasPapir (papir-maler — Daniels liste 2026-08-05)

/// Malen tegnes UNDER PencilKit-flata: strukturen (SWOT-rutenett, Kanban-
/// kolonner, møteseksjoner …) ligger fast mens blekket lever oppå. Én
/// delt spec driver både skjerm (SwiftUI Canvas) og eksport (CGContext).
enum CanvasPapir: String, CaseIterable, Identifiable {
    case blank
    case brainstorm
    case mote
    case salgsstrategi
    case rute
    case tankekart
    case swot
    case kanban
    case pipeline
    case territorium

    var id: String { rawValue }

    var etikett: String {
        switch self {
        case .blank: return "Blank"
        case .brainstorm: return "Brainstorm"
        case .mote: return "Møte"
        case .salgsstrategi: return "Salgsstrategi"
        case .rute: return "Rute"
        case .tankekart: return "Tankekart"
        case .swot: return "SWOT"
        case .kanban: return "Kanban"
        case .pipeline: return "Pipeline"
        case .territorium: return "Territorium"
        }
    }

    var ikon: String {
        switch self {
        case .blank: return "square"
        case .brainstorm: return "bubbles.and.sparkles"
        case .mote: return "list.bullet.rectangle"
        case .salgsstrategi: return "chart.line.uptrend.xyaxis"
        case .rute: return "point.topleft.down.curvedto.point.bottomright.up.fill"
        case .tankekart: return "brain.head.profile"
        case .swot: return "square.grid.2x2"
        case .kanban: return "rectangle.split.3x1"
        case .pipeline: return "arrow.right.square"
        case .territorium: return "map"
        }
    }

    /// Fornuftig default per notattype.
    static func standardFor(_ type: CanvasKategori) -> CanvasPapir {
        switch type {
        case .mote: return .mote
        case .rute: return .rute
        case .salgsplan: return .salgsstrategi
        case .prosjekt: return .kanban
        default: return .blank
        }
    }

    /// Spec: linjer + ellipser + etiketter i 0–1-normaliserte koordinater.
    struct Spec {
        var linjer: [(CGPoint, CGPoint)] = []
        var ellipser: [CGRect] = []
        var etiketter: [(String, CGPoint)] = []
        var rutenett: CGFloat = 0   // >0 = rutenett med denne avstanden (pt)
        var prikker: Bool = false
    }

    var spec: Spec {
        switch self {
        case .blank:
            return Spec()
        case .brainstorm:
            return Spec(
                ellipser: [CGRect(x: 0.36, y: 0.30, width: 0.28, height: 0.13)],
                etiketter: [("IDÉ", CGPoint(x: 0.475, y: 0.355))],
                prikker: true)
        case .mote:
            return Spec(
                linjer: [(CGPoint(x: 0.03, y: 0.30), CGPoint(x: 0.97, y: 0.30)),
                         (CGPoint(x: 0.03, y: 0.74), CGPoint(x: 0.97, y: 0.74))],
                etiketter: [("AGENDA", CGPoint(x: 0.04, y: 0.045)),
                            ("NOTATER", CGPoint(x: 0.04, y: 0.315)),
                            ("NESTE STEG", CGPoint(x: 0.04, y: 0.755))])
        case .salgsstrategi:
            return Spec(
                linjer: [(CGPoint(x: 0.03, y: 0.26), CGPoint(x: 0.97, y: 0.26)),
                         (CGPoint(x: 0.03, y: 0.50), CGPoint(x: 0.97, y: 0.50)),
                         (CGPoint(x: 0.03, y: 0.74), CGPoint(x: 0.97, y: 0.74))],
                etiketter: [("MÅL", CGPoint(x: 0.04, y: 0.045)),
                            ("TILTAK", CGPoint(x: 0.04, y: 0.275)),
                            ("ANSVARLIG", CGPoint(x: 0.04, y: 0.515)),
                            ("FRIST", CGPoint(x: 0.04, y: 0.755))])
        case .rute:
            var s = Spec()
            for i in 0..<8 {
                let y = 0.09 + Double(i) * 0.115
                s.ellipser.append(CGRect(x: 0.025, y: y - 0.022, width: 0.032, height: 0.044))
                s.etiketter.append(("\(i + 1)", CGPoint(x: 0.036, y: y - 0.011)))
                s.linjer.append((CGPoint(x: 0.08, y: y), CGPoint(x: 0.97, y: y)))
            }
            return s
        case .tankekart:
            return Spec(
                linjer: [(CGPoint(x: 0.42, y: 0.42), CGPoint(x: 0.18, y: 0.18)),
                         (CGPoint(x: 0.58, y: 0.42), CGPoint(x: 0.82, y: 0.18)),
                         (CGPoint(x: 0.42, y: 0.55), CGPoint(x: 0.18, y: 0.78)),
                         (CGPoint(x: 0.58, y: 0.55), CGPoint(x: 0.82, y: 0.78))],
                ellipser: [CGRect(x: 0.37, y: 0.41, width: 0.26, height: 0.15),
                           CGRect(x: 0.07, y: 0.10, width: 0.20, height: 0.11),
                           CGRect(x: 0.73, y: 0.10, width: 0.20, height: 0.11),
                           CGRect(x: 0.07, y: 0.76, width: 0.20, height: 0.11),
                           CGRect(x: 0.73, y: 0.76, width: 0.20, height: 0.11)],
                etiketter: [("TEMA", CGPoint(x: 0.47, y: 0.475))])
        case .swot:
            return Spec(
                linjer: [(CGPoint(x: 0.50, y: 0.02), CGPoint(x: 0.50, y: 0.98)),
                         (CGPoint(x: 0.02, y: 0.50), CGPoint(x: 0.98, y: 0.50))],
                etiketter: [("STYRKER", CGPoint(x: 0.04, y: 0.04)),
                            ("SVAKHETER", CGPoint(x: 0.54, y: 0.04)),
                            ("MULIGHETER", CGPoint(x: 0.04, y: 0.53)),
                            ("TRUSLER", CGPoint(x: 0.54, y: 0.53))])
        case .kanban:
            return Spec(
                linjer: [(CGPoint(x: 1.0 / 3, y: 0.02), CGPoint(x: 1.0 / 3, y: 0.98)),
                         (CGPoint(x: 2.0 / 3, y: 0.02), CGPoint(x: 2.0 / 3, y: 0.98))],
                etiketter: [("Å GJØRE", CGPoint(x: 0.11, y: 0.04)),
                            ("I GANG", CGPoint(x: 0.45, y: 0.04)),
                            ("FERDIG", CGPoint(x: 0.78, y: 0.04))])
        case .pipeline:
            var s = Spec()
            let navn = ["NY", "KONTAKTET", "MØTE", "TILBUD", "VUNNET"]
            for i in 1..<5 {
                let x = Double(i) / 5
                s.linjer.append((CGPoint(x: x, y: 0.02), CGPoint(x: x, y: 0.98)))
            }
            for (i, n) in navn.enumerated() {
                s.etiketter.append((n, CGPoint(x: Double(i) / 5 + 0.055, y: 0.04)))
            }
            return s
        case .territorium:
            var s = Spec(rutenett: 44)
            s.etiketter.append(("N ↑", CGPoint(x: 0.93, y: 0.03)))
            return s
        }
    }

    /// Eksport: tegn malen inn i CGContext (samme spec som skjermen).
    func tegn(i ctx: CGContext, storrelse: CGSize) {
        let sp = spec
        let strek = UIColor.white.withAlphaComponent(0.10)
        ctx.setStrokeColor(strek.cgColor)
        ctx.setLineWidth(2)
        for (a, b) in sp.linjer {
            ctx.move(to: CGPoint(x: a.x * storrelse.width, y: a.y * storrelse.height))
            ctx.addLine(to: CGPoint(x: b.x * storrelse.width, y: b.y * storrelse.height))
            ctx.strokePath()
        }
        for e in sp.ellipser {
            ctx.strokeEllipse(in: CGRect(x: e.minX * storrelse.width,
                                         y: e.minY * storrelse.height,
                                         width: e.width * storrelse.width,
                                         height: e.height * storrelse.height))
        }
        if sp.rutenett > 0 {
            let steg = sp.rutenett * 2
            var x: CGFloat = 0
            while x < storrelse.width {
                ctx.move(to: CGPoint(x: x, y: 0))
                ctx.addLine(to: CGPoint(x: x, y: storrelse.height))
                x += steg
            }
            var y: CGFloat = 0
            while y < storrelse.height {
                ctx.move(to: CGPoint(x: 0, y: y))
                ctx.addLine(to: CGPoint(x: storrelse.width, y: y))
                y += steg
            }
            ctx.strokePath()
        }
        for (tekst, punkt) in sp.etiketter {
            (tekst as NSString).draw(
                at: CGPoint(x: punkt.x * storrelse.width,
                            y: punkt.y * storrelse.height),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 22, weight: .black),
                    .foregroundColor: UIColor.white.withAlphaComponent(0.25),
                ])
        }
    }
}

/// Skjerm-rendring av papiret (SwiftUI Canvas — samme spec som eksport).
struct PapirView: View {
    let papir: CanvasPapir

    var body: some View {
        Canvas { ctx, size in
            let sp = papir.spec
            let strek = Color.white.opacity(0.10)
            for (a, b) in sp.linjer {
                var p = Path()
                p.move(to: CGPoint(x: a.x * size.width, y: a.y * size.height))
                p.addLine(to: CGPoint(x: b.x * size.width, y: b.y * size.height))
                ctx.stroke(p, with: .color(strek), lineWidth: 1.5)
            }
            for e in sp.ellipser {
                let rekt = CGRect(x: e.minX * size.width, y: e.minY * size.height,
                                  width: e.width * size.width, height: e.height * size.height)
                ctx.stroke(Path(ellipseIn: rekt), with: .color(strek), lineWidth: 1.5)
            }
            if sp.rutenett > 0 {
                var p = Path()
                var x: CGFloat = 0
                while x < size.width {
                    p.move(to: CGPoint(x: x, y: 0))
                    p.addLine(to: CGPoint(x: x, y: size.height))
                    x += sp.rutenett
                }
                var y: CGFloat = 0
                while y < size.height {
                    p.move(to: CGPoint(x: 0, y: y))
                    p.addLine(to: CGPoint(x: size.width, y: y))
                    y += sp.rutenett
                }
                ctx.stroke(p, with: .color(Color.white.opacity(0.05)), lineWidth: 1)
            }
            if sp.prikker {
                var y: CGFloat = 20
                while y < size.height {
                    var x: CGFloat = 20
                    while x < size.width {
                        ctx.fill(Path(ellipseIn: CGRect(x: x - 1, y: y - 1, width: 2, height: 2)),
                                 with: .color(Color.white.opacity(0.10)))
                        x += 28
                    }
                    y += 28
                }
            }
            for (tekst, punkt) in sp.etiketter {
                ctx.draw(
                    Text(tekst)
                        .font(.system(size: 12, weight: .black))
                        .foregroundColor(Color.white.opacity(0.28)),
                    at: CGPoint(x: punkt.x * size.width, y: punkt.y * size.height),
                    anchor: .topLeading)
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - NodeView + NodeKoblinger (fase 7: levende tankekart/brainstorm)

/// Koblingslinjene forelder→barn, tegnet under nodene. Følger med når
/// noder dras (posisjonene leses live fra node-arrayet).
private struct NodeKoblinger: View {
    let noder: [CanvasNode]

    var body: some View {
        Canvas { ctx, _ in
            let posisjoner = Dictionary(uniqueKeysWithValues: noder.map { ($0.id, CGPoint(x: $0.x, y: $0.y)) })
            for node in noder {
                guard let pid = node.parentId, let fra = posisjoner[pid] else { continue }
                var p = Path()
                p.move(to: fra)
                let til = CGPoint(x: node.x, y: node.y)
                let midt = CGPoint(x: (fra.x + til.x) / 2, y: (fra.y + til.y) / 2)
                p.addQuadCurve(to: til,
                               control: CGPoint(x: midt.x, y: midt.y - 24))
                ctx.stroke(p, with: .color(Color.white.opacity(0.30)),
                           style: StrokeStyle(lineWidth: 2, lineCap: .round))
            }
        }
        .allowsHitTesting(false)
    }
}

/// Selve boblen: dra flytter (streken følger), tap redigerer teksten
/// (Scribble: skriv rett i feltet med Pencil), «+» føder koblet barn,
/// hold fjerner (barna blir frittstående).
private struct NodeView: View {
    let node: CanvasNode
    let redigerbar: Bool
    let onEndre: (CanvasNode) -> Void
    let onNyttBarn: () -> Void
    let onRediger: () -> Void
    let onSlett: () -> Void

    @State private var dragOffset: CGSize = .zero

    private var farge: Color { Color(UIColor(hex: node.fargeHex)) }

    var body: some View {
        HStack(spacing: 0) {
            Text(node.tekst.isEmpty ? "…" : node.tekst)
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(3)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 16).padding(.vertical, 10)
        }
        .frame(minWidth: 90, maxWidth: 220)
        .background(farge.opacity(0.22), in: Capsule())
        .overlay(Capsule().stroke(farge.opacity(0.75), lineWidth: 2))
        .overlay(alignment: .bottomTrailing) {
            if redigerbar {
                Button(action: onNyttBarn) {
                    Image(systemName: "plus")
                        .font(.appScaled(size: 10, weight: .black))
                        .foregroundStyle(.white)
                        .frame(width: 22, height: 22)
                        .background(farge, in: Circle())
                        .shadow(color: .black.opacity(0.4), radius: 3)
                }
                .buttonStyle(.plain)
                .offset(x: 8, y: 8)
            }
        }
        .position(x: node.x + dragOffset.width,
                  y: node.y + dragOffset.height)
        .onTapGesture { if redigerbar { onRediger() } }
        .gesture(redigerbar ? DragGesture()
            .onChanged { dragOffset = $0.translation }
            .onEnded { v in
                var ny = node
                ny.x += v.translation.width
                ny.y += v.translation.height
                dragOffset = .zero
                onEndre(ny)
            } : nil)
        .onLongPressGesture(minimumDuration: 0.6) {
            if redigerbar { onSlett() }
        }
    }
}

// MARK: - ObjektView (fase 8: bilder + levende kort under blekket)

/// Bilde-, lead-, KPI-, kart- og oppgave-objekter. I objekt-modus:
/// dra flytter, klyp skalerer, hold fjerner. Ellers er laget passivt
/// og blekket tegnes oppå (annotering).
private struct ObjektView: View {
    let objekt: CanvasObjekt
    let redigerbar: Bool
    /// Living Canvas: ferskt (tittel, detalj) fra appState — overstyrer
    /// snapshotet i objektet.
    var liveInnhold: (String, String)? = nil
    var erValgt: Bool = false
    var onToggleValg: (() -> Void)? = nil
    var onFlyttFelles: ((CGSize) -> Void)? = nil
    let onEndre: (CanvasObjekt) -> Void
    let onSlett: () -> Void

    @State private var dragOffset: CGSize = .zero
    @State private var pinchSkala: CGFloat = 1.0

    var body: some View {
        innhold
            .scaleEffect(pinchSkala)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(erValgt ? CvBrand.blue
                            : (redigerbar ? CvBrand.orange.opacity(0.8) : .clear),
                            style: StrokeStyle(lineWidth: erValgt ? 3 : 2, dash: [6, 4]))
            )
            .position(x: objekt.x + dragOffset.width,
                      y: objekt.y + dragOffset.height)
            .onTapGesture { if redigerbar { onToggleValg?() } }
            .gesture(redigerbar ? DragGesture()
                .onChanged { dragOffset = $0.translation }
                .onEnded { v in
                    dragOffset = .zero
                    if erValgt, let felles = onFlyttFelles {
                        felles(v.translation)
                    } else {
                        var ny = objekt
                        ny.x += v.translation.width
                        ny.y += v.translation.height
                        onEndre(ny)
                    }
                } : nil)
            .simultaneousGesture(redigerbar ? MagnificationGesture()
                .onChanged { pinchSkala = $0 }
                .onEnded { v in
                    var ny = objekt
                    ny.skala = min(3.0, max(0.25, ny.skala * v))
                    pinchSkala = 1.0
                    onEndre(ny)
                } : nil)
            .onLongPressGesture(minimumDuration: 0.6) {
                if redigerbar { onSlett() }
            }
            .allowsHitTesting(redigerbar)
    }

    @ViewBuilder
    private var innhold: some View {
        if let b64 = objekt.bildeBase64,
           let data = Data(base64Encoded: b64),
           let img = UIImage(data: data) {
            // Bilde / kart-utsnitt
            VStack(spacing: 0) {
                Image(uiImage: img)
                    .resizable()
                    .scaledToFit()
                    .frame(width: img.size.width * objekt.skala,
                           height: img.size.height * objekt.skala)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                if objekt.type == "kart", let tittel = objekt.tittel, !tittel.isEmpty {
                    Text(tittel)
                        .font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(CvBrand.textSecondary)
                        .padding(.top, 3)
                }
            }
            .shadow(color: .black.opacity(0.35), radius: 6, y: 3)
        } else {
            // Lead-/KPI-/oppgave-/kalender-kort — live når mulig.
            HStack(spacing: 10) {
                Image(systemName: kortIkon)
                    .font(.appScaled(size: 15, weight: .semibold))
                    .foregroundStyle(kortFarge)
                    .frame(width: 34, height: 34)
                    .background(kortFarge.opacity(0.18), in: RoundedRectangle(cornerRadius: 9))
                VStack(alignment: .leading, spacing: 2) {
                    Text(liveInnhold?.0 ?? objekt.tittel ?? "")
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    let detalj = liveInnhold?.1 ?? objekt.detalj ?? ""
                    if !detalj.isEmpty {
                        Text(detalj)
                            .font(.appScaled(size: 11))
                            .foregroundStyle(CvBrand.textSecondary)
                            .lineLimit(1)
                    }
                }
                if liveInnhold != nil {
                    Circle().fill(CvBrand.green)
                        .frame(width: 6, height: 6)
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .frame(minWidth: 170)
            .background(CvBrand.cardHi, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14)
                .stroke(kortFarge.opacity(0.4), lineWidth: 1))
            .shadow(color: .black.opacity(0.35), radius: 6, y: 3)
            .scaleEffect(objekt.skala)
        }
    }

    private var kortIkon: String {
        switch objekt.type {
        case "lead": return "person.crop.rectangle.fill"
        case "kpi": return "chart.bar.fill"
        case "oppgave": return "checklist"
        case "kalender": return "calendar"
        default: return "square.dashed"
        }
    }

    private var kortFarge: Color {
        switch objekt.type {
        case "lead": return CvBrand.orange
        case "kpi": return CvBrand.blue
        case "oppgave": return CvBrand.green
        default: return CvBrand.purpleLight
        }
    }
}


// MARK: - FormGjenkjenner (shape recognition — hold på slutten → perfekt form)

/// Apple Notes-oppførselen: tegn en sirkel/rektangel/linje/pil og HOLD
/// pennen stille (≥0,45 s) før du løfter → strøket byttes ut med en
/// perfekt CanvasFigur i strøkets farge. Formen er et objekt: dra
/// flytter, klyp skalerer, to-finger-vri roterer, hold fjerner.
enum FormGjenkjenner {

    static func gjenkjenn(_ strok: PKStroke) -> CanvasFigur? {
        let punkter = strok.path.map { $0 }
        guard punkter.count >= 8 else { return nil }

        // 1) Hold-deteksjon: siste 0,45 s innenfor 14 pt.
        guard let sisteTid = punkter.last?.timeOffset else { return nil }
        let hale = punkter.filter { $0.timeOffset > sisteTid - 0.45 }
        guard hale.count >= 3, let sistePkt = punkter.last?.location else { return nil }
        let haleSpredning = hale.map { hypot($0.location.x - sistePkt.x,
                                             $0.location.y - sistePkt.y) }.max() ?? 0
        guard haleSpredning < 14 else { return nil }

        // Halen (holdet) skal ikke forstyrre geometrien.
        let aktive = punkter.filter { $0.timeOffset <= sisteTid - 0.45 }
            .map(\.location)
        guard aktive.count >= 6 else { return nil }

        let xs = aktive.map(\.x), ys = aktive.map(\.y)
        let boks = CGRect(x: xs.min()!, y: ys.min()!,
                          width: xs.max()! - xs.min()!,
                          height: ys.max()! - ys.min()!)
        guard boks.width > 24 || boks.height > 24 else { return nil }
        let farge = PKInkingTool.convertColor(strok.ink.color,
                                              from: .light, to: .dark).somHex
        let senter = CGPoint(x: boks.midX, y: boks.midY)
        let diagonal = hypot(boks.width, boks.height)
        let lukket = hypot(aktive.first!.x - aktive.last!.x,
                           aktive.first!.y - aktive.last!.y) < diagonal * 0.22

        if lukket {
            // SIRKEL: jevn avstand til senter.
            let radier = aktive.map { hypot($0.x - senter.x, $0.y - senter.y) }
            let snitt = radier.reduce(0, +) / CGFloat(radier.count)
            let avvik = radier.map { abs($0 - snitt) }.reduce(0, +) / CGFloat(radier.count)
            if snitt > 12, avvik / snitt < 0.16 {
                return CanvasFigur(form: "sirkel",
                                   x: senter.x, y: senter.y,
                                   fargeHex: farge,
                                   bredde: snitt * 2 / 0.45, hoyde: snitt * 2 / 0.45)
                // (FigurShape-sirkelen fyller 90 % av min(b,h) — 2r/0.9 ≈ /0.45 av halv)
            }
            // REKTANGEL: punktene klemmer seg til boks-kantene.
            let kantavvik = aktive.map { p -> CGFloat in
                min(abs(p.x - boks.minX), abs(p.x - boks.maxX),
                    abs(p.y - boks.minY), abs(p.y - boks.maxY))
            }.reduce(0, +) / CGFloat(aktive.count)
            if kantavvik < diagonal * 0.055 {
                return CanvasFigur(form: "rektangel",
                                   x: senter.x, y: senter.y,
                                   fargeHex: farge,
                                   bredde: boks.width / 0.9,
                                   hoyde: boks.height / 0.76)
            }
            return nil
        }

        // ÅPEN form: LINJE eller PIL — avvik fra korden.
        let a = aktive.first!, b = aktive.last!
        let korde = hypot(b.x - a.x, b.y - a.y)
        guard korde > 40 else { return nil }
        let maksAvvik = aktive.map { p -> CGFloat in
            abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / korde
        }.max() ?? 0
        let vinkel = atan2(b.y - a.y, b.x - a.x) * 180 / .pi

        if maksAvvik < korde * 0.06 {
            return CanvasFigur(form: "linje",
                               x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
                               fargeHex: farge, rotasjon: Double(vinkel),
                               bredde: korde, hoyde: 40)
        }
        // PIL: rett hoveddel + skarp retur nær enden (spissen tegnet i ett).
        if maksAvvik < korde * 0.30 {
            let sisteFjerdedel = aktive.suffix(max(4, aktive.count / 4))
            let vendinger = zip(sisteFjerdedel, sisteFjerdedel.dropFirst())
                .map { hypot($1.x - $0.x, $1.y - $0.y) }
            let haleLengde = vendinger.reduce(0, +)
            if haleLengde > korde * 0.25, haleLengde < korde * 0.9 {
                return CanvasFigur(form: "pil",
                                   x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
                                   fargeHex: farge, rotasjon: Double(vinkel),
                                   bredde: korde / 0.9, hoyde: korde * 0.35)
            }
        }
        return nil
    }
}

// MARK: - BibliotekElement (element-biblioteket — brukeren lagrer ting)

/// Gjenbrukbart element: en samling objekter normalisert rundt tyngde-
/// punktet, lagret lokalt (UserDefaults, cap 30 / ~2 MB).
struct BibliotekElement: Codable, Identifiable {
    var id: String = UUID().uuidString
    var navn: String
    var figurer: [CanvasFigur] = []
    var stempler: [CanvasStempel] = []
    var tekstbokser: [CanvasTekstboks] = []
    var objekter: [CanvasObjekt] = []

    private static let nokkel = "canvas.bibliotek"

    static func lastAlle() -> [BibliotekElement] {
        guard let data = UserDefaults.standard.data(forKey: nokkel) else { return [] }
        return (try? JSONDecoder().decode([BibliotekElement].self, from: data)) ?? []
    }

    static func lagreAlle(_ elementer: [BibliotekElement]) {
        guard let data = try? JSONEncoder().encode(elementer),
              data.count < 2_000_000 else { return }
        UserDefaults.standard.set(data, forKey: nokkel)
    }
}

// MARK: - TidsreiseSheet (Time Travel — se idéene utvikle seg)

/// Slider over notatets versjoner (mandag → fredag): tegningen OG typen
/// per tidspunkt (Idé → Prosjekt → Lead-utviklingen synlig som badges).
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
