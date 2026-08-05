// CanvasKomponenter.swift — tegneflate, overlay-views og gjenkjenning.

import CoreLocation
import MapKit
import PDFKit
import PencilKit
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers
import Vision

struct LeadgridPencilCanvas: UIViewRepresentable {
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
        var parent: LeadgridPencilCanvas
        var toolPicker: PKToolPicker?
        weak var canvas: PKCanvasView?
        var tegner = false
        /// Verktøyet før dobbelt-tap byttet til viskelær.
        private var forrigeVerktoy: PKTool?

        init(_ parent: LeadgridPencilCanvas) { self.parent = parent }

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

struct StempelView: View {
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

struct TekstboksView: View {
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

struct FigurView: View {
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
struct FigurShape: Shape {
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

struct NodeKoblinger: View {
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
struct NodeView: View {
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
struct ObjektView: View {
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
