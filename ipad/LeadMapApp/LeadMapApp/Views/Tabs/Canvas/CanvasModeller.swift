// CanvasModeller.swift — modeller, typer, papir og bibliotek for Leadgrid Canvas.
// Splittet ut fra CanvasView.swift (2026-08-05) for kompilatorhelse.

import CoreLocation
import MapKit
import PDFKit
import PencilKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers
import Vision

enum CvBrand {
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
    var type: String        // bilde / lead / kpi / kart / oppgave / pdf
    var x: Double
    var y: Double
    var skala: Double = 1.0
    /// JPEG-base64 for bilde- og kart-objekter (legacy-PDF-sider også).
    var bildeBase64: String? = nil
    var tittel: String? = nil
    var detalj: String? = nil
    var refId: String? = nil
    /// Ekte PDF: referanse til originaldokumentet + sideindeks —
    /// rendres vektor-skarpt via PDFKit, aldri som bilde.
    var dokId: String? = nil
    var side: Int? = nil
}

/// Originaldokument (PDF) lagret tapsfritt i notatet: vektor-rendering
/// på flata og eksport i original kvalitet med annoteringene oppå.
struct CanvasDokument: Codable, Identifiable, Hashable {
    var id: String = UUID().uuidString
    var navn: String
    var base64: String
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
    /// Ekte PDF-håndtering: originaldokumentene i notatet.
    var dokumenter: [CanvasDokument] = []
    /// Papirkurven: satt når notatet er soft-slettet (tømmes etter 30 dager).
    var slettetAt: Date? = nil

    /// Kundeminnet identifiseres på tittel-prefixet (enkel v1-konvensjon).
    var erKundeminne: Bool { tittel.hasPrefix("Kundeminne") }
    /// Mappe-nøkkelen: selskapet notatet er koblet til.
    var mappeNavn: String? {
        let s = (selskap ?? "").trimmingCharacters(in: .whitespaces)
        return s.isEmpty ? nil : s
    }
}

/// Verktøyraden i editoren jobber i moduser — én ting om gangen:
/// Tegn (penn/papir), Sett inn (objekter), Ordne (lasso/flytt).
enum VerktoyModus: String, CaseIterable, Identifiable {
    case tegn, settInn, ordne
    var id: String { rawValue }
    var etikett: String {
        switch self {
        case .tegn: return "Tegn"
        case .settInn: return "Sett inn"
        case .ordne: return "Ordne"
        }
    }
    var ikon: String {
        switch self {
        case .tegn: return "pencil.tip"
        case .settInn: return "plus.square.on.square"
        case .ordne: return "lasso"
        }
    }
}


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
