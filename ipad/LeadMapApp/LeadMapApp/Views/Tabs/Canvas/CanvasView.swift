// CanvasView.swift — Leadgrid Canvas fase 1 (2026-08-05)
//
// Pencil-first notater koblet til leads: notatliste + PencilKit-tegneflate
// (PKToolPicker gir penn/marker/viskelær/farger/linjal), kategori-chips og
// lead-kobling. Differensiatoren mot Apple Notes er at notatet VET hvilken
// kunde det gjelder — fase 2 kobler det inn i møtesløyfa (logg + brief).
//
// Persistering: leadgrid_canvas_notater (org+bruker) via APIClient+Canvas.
// Demo-modus: in-memory (aldri backend).

import PencilKit
import SwiftUI

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

    private var isDemo: Bool { DemoModeManager.isActiveNonisolated }

    private var filtrerte: [CanvasNotat] {
        let liste = kategoriFilter.map { f in notater.filter { $0.kategori == f } } ?? notater
        return liste.sorted { $0.oppdatert > $1.oppdatert }
    }

    var body: some View {
        GatedView(feature: .leadgridCanvas) {
            innhold
        }
        .background(CvBrand.bg)
        .task { await lastInn() }
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
            Button(role: .destructive) { slett(n) } label: {
                Label("Slett notat", systemImage: "trash")
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
                HStack(spacing: 8) {
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
                    leadKobling
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .background(CvBrand.card)

            Divider().overlay(CvBrand.stroke)

            // Selve tegneflata — PKToolPicker docker seg til bunnen.
            PencilCanvas(drawing: $drawing)
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
        let n = CanvasNotat(
            id: UUID().uuidString.lowercased(),
            tittel: "",
            kategori: kategoriFilter ?? .mote,
            selskap: nil, leadId: nil,
            drawingData: Data(),
            oppdatert: Date(),
            erNy: true)
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
        n.tittel = tittel
        n.kategori = kategori
        n.leadId = kobletLeadId
        n.selskap = kobletSelskap
        n.drawingData = drawing.dataRepresentation()
        n.oppdatert = Date()

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
            if n.erNy {
                let nyId = try await api.opprettCanvasNotat(
                    tittel: n.tittel, kategori: n.kategori.rawValue,
                    selskap: n.selskap, leadId: n.leadId,
                    drawingBase64: n.drawingData.base64EncodedString())
                n.id = nyId
                n.erNy = false
                if valgtId == id { valgtId = nyId }
            } else {
                try await api.oppdaterCanvasNotat(
                    id: n.id, tittel: n.tittel, kategori: n.kategori.rawValue,
                    selskap: n.selskap, leadId: n.leadId,
                    drawingBase64: n.drawingData.base64EncodedString())
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
                oppdatert: ISO8601DateFormatter().date(from: dto.oppdatert ?? "") ?? Date())
        }
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
