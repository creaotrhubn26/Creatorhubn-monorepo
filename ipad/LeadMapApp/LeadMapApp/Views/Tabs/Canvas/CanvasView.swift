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
@preconcurrency import Vision

struct CanvasView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase

    @State private var notater: [CanvasNotat] = []
    @State private var valgtId: String?
    @State private var kategoriFilter: CanvasKategori?
    @State private var lastet = false
    @State private var lagrer = false
    @State private var lagretToast = false
    @State private var saveStatus: [String: CanvasSaveStatus] = [:]
    @State private var saveCoordinator = CanvasSaveCoordinator()
    @State private var editGeneration: [String: Int] = [:]
    @State private var dirtyNoteIDs: Set<String> = []
    @State private var deletingNoteIDs: Set<String> = []
    @State private var autosaveTask: Task<Void, Never>?
    @State private var draftTask: Task<Void, Never>?
    @State private var loadedCanvasScope = "__not_loaded__"
    @State private var editorGeneration = UUID()
    @State private var dokumentZoom: CGFloat = 1
    @GestureState private var pinchZoom: CGFloat = 1
    @State private var canvasViewportWidth: CGFloat = Self.logiskSidebredde
    @State private var underHydrering = false
    @State private var visNotatlisteSheet = false

    // Editor-state for valgt notat (kopieres inn/ut ved bytte).
    @State private var tittel = ""
    @State private var kategori: CanvasKategori = .mote
    @State private var kobletLeadId: String?
    @State private var kobletSelskap: String?
    @State private var drawing = PKDrawing()
    @State private var deltMedTeam = false
    @State private var sok = ""
    @State private var visAnalyse = false
    @State private var analyseKontekst: CanvasEditorContext?
    @State private var stempler: [CanvasStempel] = []
    @State private var tekstbokser: [CanvasTekstboks] = []
    @State private var figurer: [CanvasFigur] = []
    @State private var papir: CanvasPapir = .blank
    @State private var noder: [CanvasNode] = []
    @State private var sider: Int = 1
    @State private var redigererNode: CanvasNode?
    @State private var objekter: [CanvasObjekt] = []
    // Ekte PDF-håndtering: originaldokumentene i notatet (vektor).
    @State private var dokumenter: [CanvasDokument] = []
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
    @State private var pennSelectionRevision = 0
    /// Multi-select (Lasso-modus): tap velger flere — dra én, alle følger.
    @State private var valgte: Set<String> = []
    @State private var bibliotek: [BibliotekElement] = BibliotekElement.lastAlle()
    @State private var lagrerElementNavn = false
    @State private var elementNavn = ""
    @State private var visTidsreise = false
    @State private var tidsreiseKontekst: CanvasEditorContext?
    /// Spatial Search: søk i notatet → flata scroller til treffet.
    @State private var visEditorSok = false
    @State private var editorSok = ""
    @State private var sokTreff: [CGPoint] = []
    @State private var sokTreffIndeks = 0
    /// Smart Layers: lag som er slått AV (rendring + eksport).
    @State private var skjulteLag: Set<String> = []
    /// Rolle-policy: org→leder→selger styrer Canvas-funksjonene.
    @State private var rollePolicy = OversiktPolicyDTO()
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
    /// Følg iPad-innstillingen som standard; eksplisitt overstyring beholdes.
    @AppStorage("canvas.inputMode") private var canvasInputModeRaw =
        CanvasInputMode.system.rawValue
    /// Miniatyrer per notat — regenereres når oppdatert-tid endres.
    @State private var thumbs: [String: UIImage] = [:]
    // Mapper per kunde (Daniel 2026-08-05): mappe = selskapet notatet er
    // koblet til — utledes automatisk, ingen manuell mappe-styring.
    @State private var valgtMappe: String?
    @State private var visPapirkurv = false
    @State private var papirkurvNotater: [CanvasNotat] = []
    // Verktøyraden jobber i moduser: Tegn / Sett inn / Ordne.
    @State private var verktoyModus: VerktoyModus = .tegn
    // Auto-tittel: OCR av øverste håndskrift-linje mens man skriver.
    @State private var autoTittelTask: Task<Void, Never>?
    // PDF-analyse: importert PDF leses av AI med en gang.
    @State private var pdfAnalyseTekst: String?
    @State private var pdfAnalyseNavn = ""
    @State private var visPdfAnalyse = false
    @State private var pdfAnalyseKontekst: CanvasEditorContext?
    /// Tilbuds-diff: navnet på forrige versjon analysen sammenlignes med.
    @State private var pdfAnalyseSammenlign: String?
    // Markering → møtepunkt: tusj over en PDF-side foreslår teksten under.
    @State private var markeringForslag: MarkeringForslag?
    @State private var markeringsTask: Task<Void, Never>?
    // Leser-modus + «Send til kontakten».
    @State private var lesDokument: CanvasDokument?
    @State private var sendDokument: CanvasDokument?
    @State private var sendKontekst: CanvasEditorContext?
    // Ekte multi-penn: WebSocket-relay for delte notater.
    @State private var realtime = CanvasRealtime()

    private static let logiskSidebredde: CGFloat = 1_024
    private static let logiskSidehoyde: CGFloat = 1_448
    private static let adaptivListegrense: CGFloat = 900
    private static let minimumDokumentZoom: CGFloat = 0.25

    private var effektivDokumentZoom: CGFloat {
        min(2.5, max(Self.minimumDokumentZoom, dokumentZoom * pinchZoom))
    }

    private var isDemo: Bool { DemoModeManager.isActiveNonisolated }

    private var canvasInputMode: CanvasInputMode {
        CanvasInputMode(rawValue: canvasInputModeRaw) ?? .system
    }

    /// Råverdien forlater aldri prosessen. CanvasDraftStore bruker kun
    /// SHA-256 av denne som katalognavn, slik at kladder ikke kan blandes
    /// mellom bruker eller aktiv organisasjon.
    private var canvasDraftScope: String? {
        Self.canvasDraftScope(
            email: appState.userEmail,
            organizationID: appState.activeOrganizationId)
    }

    private struct CanvasEditorContext: Equatable {
        let noteID: String
        let editorGeneration: UUID
        let editGeneration: Int
        let revision: Int
        let drawingData: Data
        let romligBeskrivelse: String
        let selskap: String?
        let leadID: String?
        let kontaktEpost: String?
    }

    private func gjeldendeEditorKontekst() -> CanvasEditorContext? {
        guard let noteID = valgtId else { return nil }
        return CanvasEditorContext(
            noteID: noteID,
            editorGeneration: editorGeneration,
            editGeneration: editGeneration[noteID, default: 0],
            revision: notater.first(where: { $0.id == noteID })?.revision ?? 0,
            drawingData: drawing.dataRepresentation(),
            romligBeskrivelse: romligBeskrivelse(),
            selskap: kobletSelskap,
            leadID: kobletLeadId,
            kontaktEpost: kontaktEpost)
    }

    private func erGjeldende(
        _ context: CanvasEditorContext?, krevSammeEditGeneration: Bool = false
    ) -> Bool {
        guard let context,
              valgtId == context.noteID,
              editorGeneration == context.editorGeneration else { return false }
        return !krevSammeEditGeneration
            || editGeneration[context.noteID, default: 0] == context.editGeneration
    }

    private static func canvasDraftScope(
        email: String?, organizationID: String?
    ) -> String? {
        guard let email = email?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased(),
              !email.isEmpty,
              let organizationID = organizationID?
                .trimmingCharacters(in: .whitespacesAndNewlines),
              !organizationID.isEmpty else { return nil }
        return "\(email)|\(organizationID)"
    }

    /// RBAC i tre lag: superadmin (entitlement per org) → org/admin
    /// (salgslederes funksjoner) → salgsleder (selgernes funksjoner).
    private func kan(_ f: LeadgridFeature) -> Bool {
        guard EntitlementStore.shared.canUse(f) else { return false }
        guard let nokkel = Self.policyNokkel(f) else { return true }
        return !rolleSkjulteForMeg.contains(nokkel)
    }

    private static func policyNokkel(_ f: LeadgridFeature) -> String? {
        switch f {
        case .canvasDeling: return "deling"
        case .canvasPdf: return "pdf"
        case .canvasBilder: return "bilder"
        case .canvasLiveKort: return "livekort"
        case .canvasTidsreise: return "tidsreise"
        case .canvasKundeminne: return "kundeminne"
        case .canvasBibliotek: return "bibliotek"
        case .canvasAnalyse: return "analyse"
        default: return nil
        }
    }

    private var erAdminRolle: Bool {
        appState.isSuperAdmin || ["admin", "owner"].contains(appState.roleInOrg ?? "")
    }
    private var erLederRolle: Bool {
        erAdminRolle || ["markedssjef", "salgssjef", "teamleder"].contains(appState.roleInOrg ?? "")
    }
    private var rolleSkjulteForMeg: Set<String> {
        if erAdminRolle { return [] }
        return Set(erLederRolle ? rollePolicy.leder : rollePolicy.selger)
    }

    private func rolleBinding(_ nokkel: String, gruppe: String) -> Binding<Bool> {
        Binding(
            get: {
                let liste = gruppe == "selger" ? rollePolicy.selger : rollePolicy.leder
                return !liste.contains(nokkel)
            },
            set: { synlig in
                var liste = gruppe == "selger" ? rollePolicy.selger : rollePolicy.leder
                if synlig { liste.removeAll { $0 == nokkel } }
                else if !liste.contains(nokkel) { liste.append(nokkel) }
                if gruppe == "selger" { rollePolicy.selger = liste }
                else { rollePolicy.leder = liste }
                guard !isDemo, let api = appState.api else { return }
                Task { try? await api.lagreCanvasRollePolicy(
                    malgruppe: gruppe, skjulteFunksjoner: liste) }
            })
    }

    private static let policyFunksjoner: [(String, String)] = [
        ("deling", "Deling i teamet"), ("pdf", "PDF-annotering"),
        ("bilder", "Bilder"), ("livekort", "Levende kort"),
        ("tidsreise", "Tidsreise"), ("kundeminne", "Kundeminnet"),
        ("bibliotek", "Element-bibliotek"), ("analyse", "AI-analyse"),
    ]

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
        return !deletingNoteIDs.contains(id)
            && (notater.first(where: { $0.id == id })?.erMin ?? true)
    }

    private var rolleKanSkriveCanvas: Bool {
        if appState.isSuperAdmin { return true }
        let rolle = (appState.roleInOrg ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        return rolle != "viewer"
    }

    /// Eierskap alene er ikke skrivetilgang: rolle og live-kanalen kan gjøre
    /// et eget notat skrivebeskyttet mens det står åpent.
    private var kanRedigereValgtNotat: Bool {
        valgtErMin && rolleKanSkriveCanvas && realtime.canWrite != false
    }

    private var skrivebeskyttetForklaring: String {
        if !valgtErMin {
            let eier = notater.first(where: { $0.id == valgtId })?.eierNavn
                ?? "kollega"
            return "Delt av \(eier) — kun visning"
        }
        if !rolleKanSkriveCanvas {
            return "Rollen din har kun lesetilgang"
        }
        return "Skrivetilgangen ble endret — kun visning"
    }

    private var valgtSaveStatus: CanvasSaveStatus {
        valgtId.flatMap { saveStatus[$0] } ?? .idle
    }

    private var saveKnappPresentasjon: (tekst: String, ikon: String, farge: Color) {
        switch valgtSaveStatus {
        case .queued: return ("Venter …", "clock", CvBrand.purple)
        case .saving: return ("Lagrer …", "clock.arrow.circlepath", CvBrand.purple)
        case .saved: return ("Lagret", "checkmark", CvBrand.green.opacity(0.45))
        case .failed: return ("Prøv igjen", "exclamationmark.arrow.circlepath", CvBrand.red)
        case .conflict: return ("Konflikt", "exclamationmark.triangle.fill", CvBrand.orange)
        case .idle: return ("Lagre", "square.and.arrow.down.fill", CvBrand.purple)
        }
    }

    var body: some View {
        GatedView(feature: .leadgridCanvas) {
            innhold
        }
        .background(CvBrand.bg)
        .task(id: canvasDraftScope) { await lastInn() }
        .onChange(of: appState.activeOrganizationId) { gammelOrg, _ in
            // Organisasjonen er allerede byttet når callbacken kjører. Ta
            // derfor kun en lokal snapshot under den gamle scopingen; aldri
            // send den via API-klienten med ny org-header.
            guard let gammelScope = Self.canvasDraftScope(
                email: appState.userEmail,
                organizationID: gammelOrg),
                  let request = snapshotAvGjeldendeNotat() else { return }
            lagreLokalKladd(request, scope: gammelScope)
        }
        .onChange(of: scenePhase) { _, fase in
            if fase != .active { _ = leggGjeldendeLagringIKo(stille: true) }
        }
        .onDisappear {
            _ = leggGjeldendeLagringIKo(stille: true)
            autosaveTask?.cancel()
            draftTask?.cancel()
            autoTittelTask?.cancel()
            markeringsTask?.cancel()
            realtime.koblFra()
        }
        // QA-hook (mockups/verifisering): generer en ekte PDF i minnet og
        // kjør hele import-pipelinen (vektor-sider + analyse-arket).
        // QA_PDF=1 → med analyse-ark; QA_PDF=2 → kun sidene på flata.
        .task {
            let modus = ProcessInfo.processInfo.environment["QA_PDF"]
            guard isDemo, ["1", "2", "3", "4"].contains(modus ?? ""),
                  dokumenter.isEmpty else { return }
            try? await Task.sleep(nanoseconds: 800_000_000)
            if let n = notater.first { velg(n) }
            let a4 = CGRect(x: 0, y: 0, width: 595, height: 842)
            let data = UIGraphicsPDFRenderer(bounds: a4).pdfData { ctx in
                ctx.beginPage()
                let tittelAttr: [NSAttributedString.Key: Any] = [
                    .font: UIFont.boldSystemFont(ofSize: 26)]
                let brodAttr: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 13)]
                ("Tilbud — Nordic Elektro AS" as NSString)
                    .draw(at: CGPoint(x: 48, y: 60), withAttributes: tittelAttr)
                let linjer = ["Totalsum: kr 480 000 eks. mva.",
                              "Leveranse: 6 uker fra signering",
                              "Betaling: 10 % forskudd",
                              "Forbehold: befaring av føringsveier før endelig pris",
                              "Omfang: 42 punkter — belysning, føringsveier, tavlearbeid"]
                for (i, linje) in linjer.enumerated() {
                    (linje as NSString).draw(
                        at: CGPoint(x: 48, y: 140 + CGFloat(i) * 28),
                        withAttributes: brodAttr)
                }
                ctx.beginPage()
                ("Vedlegg — fremdriftsplan" as NSString)
                    .draw(at: CGPoint(x: 48, y: 60), withAttributes: tittelAttr)
            }
            importerPDFData(data, navn: "Tilbud-Nordic-Elektro")
            if modus != "1" { visPdfAnalyse = false }
        }
        // QA_PDF=3 → leser-modus; QA_PDF=4 → markering-kortet.
        .task {
            let modus = ProcessInfo.processInfo.environment["QA_PDF"]
            guard isDemo, modus == "3" || modus == "4" else { return }
            try? await Task.sleep(nanoseconds: 2_200_000_000)
            if modus == "3" {
                lesDokument = dokumenter.first
            } else if let objekt = objekter.first(where: { $0.type == "pdf" }) {
                markeringForslag = MarkeringForslag(
                    tekst: "Forbehold: befaring av føringsveier før endelig pris",
                    punkt: CGPoint(x: objekt.x, y: objekt.y - 80),
                    dokNavn: "Tilbud-Nordic-Elektro")
            }
        }
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
        GeometryReader { geo in
            let viserFastListe = geo.size.width >= Self.adaptivListegrense
            HStack(spacing: 0) {
                if viserFastListe {
                    notatListe
                        .frame(width: min(360, max(260, geo.size.width * 0.30)))
                    Divider().overlay(CvBrand.stroke)
                }
                if valgtId != nil {
                    editor
                } else if viserFastListe {
                    tomEditor
                } else {
                    notatListe
                }
            }
            .toolbar {
                if !viserFastListe, valgtId != nil {
                    ToolbarItem(placement: .topBarLeading) {
                        Button { visNotatlisteSheet = true } label: {
                            Label("Notater", systemImage: "sidebar.left")
                                .frame(minWidth: 44, minHeight: 44)
                        }
                        .accessibilityHint("Åpner listen over Canvas-notater")
                    }
                }
            }
        }
        .sheet(isPresented: $visNotatlisteSheet) {
            NavigationStack {
                notatListe
                    .navigationTitle("Canvas-notater")
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Ferdig") { visNotatlisteSheet = false }
                        }
                    }
            }
            .presentationDetents([.medium, .large])
        }
        .background { canvasTastatursnarveier }
    }

    private var canvasTastatursnarveier: some View {
        ZStack {
            Button { Task { await lagre() } } label: { EmptyView() }
                .keyboardShortcut("s", modifiers: .command)
                .disabled(!kanRedigereValgtNotat)
            Button { nyttNotat() } label: { EmptyView() }
                .keyboardShortcut("n", modifiers: .command)
                .disabled(!rolleKanSkriveCanvas)
            Button { visEditorSok = true } label: { EmptyView() }
                .keyboardShortcut("f", modifiers: .command)
        }
        .frame(width: 0, height: 0)
        .opacity(0)
        .accessibilityHidden(true)
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
                .frame(minHeight: 44)
                .disabled(!rolleKanSkriveCanvas)
                .accessibilityLabel("Opprett nytt Canvas-notat")
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
            if !visPapirkurv {
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
            }

            if visPapirkurv {
                papirkurvListe
            } else if !sok.trimmingCharacters(in: .whitespaces).isEmpty {
                // Søk går alltid på tvers av alle mapper.
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(filtrerte) { n in
                            notatRad(n)
                        }
                        if filtrerte.isEmpty && lastet {
                            Text("Ingen treff.")
                                .font(.appScaled(size: 12))
                                .foregroundStyle(CvBrand.textSecondary)
                                .padding(.top, 40)
                        }
                    }
                    .padding(.horizontal, 12).padding(.bottom, 16)
                }
            } else if let mappe = valgtMappe {
                mappeInnhold(mappe)
            } else {
                mappeOversikt
            }
        }
        .background(CvBrand.bg)
    }

    // MARK: Canvas-oversikten — mapper per kunde + papirkurv

    private struct KundeMappe: Identifiable {
        let navn: String
        let antall: Int
        let harKundeminne: Bool
        let siste: Date
        var id: String { navn }
    }

    private var kategoriFiltrerte: [CanvasNotat] {
        kategoriFilter.map { f in notater.filter { $0.kategori == f } } ?? notater
    }

    /// Mappene utledes av lead-koblingen: én mappe per selskap.
    private var mapper: [KundeMappe] {
        var grupper: [String: [CanvasNotat]] = [:]
        for n in kategoriFiltrerte {
            guard let navn = n.mappeNavn else { continue }
            grupper[navn, default: []].append(n)
        }
        return grupper.map { navn, liste in
            KundeMappe(navn: navn, antall: liste.count,
                       harKundeminne: liste.contains { $0.erKundeminne },
                       siste: liste.map(\.oppdatert).max() ?? .distantPast)
        }
        .sorted { $0.siste > $1.siste }
    }

    private var loseNotater: [CanvasNotat] {
        kategoriFiltrerte.filter { $0.mappeNavn == nil }
            .sorted { $0.oppdatert > $1.oppdatert }
    }

    /// Notatene i en mappe — kundeminnet ligger alltid festet øverst.
    private func notaterIMappe(_ navn: String) -> [CanvasNotat] {
        kategoriFiltrerte
            .filter { $0.mappeNavn?.caseInsensitiveCompare(navn) == .orderedSame }
            .sorted {
                if $0.erKundeminne != $1.erKundeminne { return $0.erKundeminne }
                return $0.oppdatert > $1.oppdatert
            }
    }

    private var mappeOversikt: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 8) {
                if !mapper.isEmpty {
                    seksjonsTittel("Kunder", ikon: "folder.fill")
                    ForEach(mapper) { m in mappeRad(m) }
                }
                if !loseNotater.isEmpty {
                    seksjonsTittel("Uten kunde", ikon: "tray")
                        .padding(.top, mapper.isEmpty ? 0 : 8)
                    ForEach(loseNotater) { n in notatRad(n) }
                }
                if mapper.isEmpty && loseNotater.isEmpty && lastet {
                    VStack(spacing: 8) {
                        Image(systemName: "pencil.tip.crop.circle")
                            .font(.appScaled(size: 28))
                            .foregroundStyle(CvBrand.textTertiary)
                        Text("Ingen notater enda — trykk «Nytt» og tegn i vei.")
                            .font(.appScaled(size: 12))
                            .foregroundStyle(CvBrand.textSecondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 40).padding(.horizontal, 20)
                }
                papirkurvInngang
                    .padding(.top, 12)
            }
            .padding(.horizontal, 12).padding(.bottom, 16)
        }
    }

    private func seksjonsTittel(_ tekst: String, ikon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: ikon)
                .font(.appScaled(size: 10, weight: .bold))
                .foregroundStyle(CvBrand.textTertiary)
            Text(tekst.uppercased())
                .font(.appScaled(size: 10, weight: .black))
                .foregroundStyle(CvBrand.textTertiary)
                .kerning(0.8)
            Spacer()
        }
        .padding(.horizontal, 4).padding(.top, 2)
    }

    private func mappeRad(_ m: KundeMappe) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.15)) { valgtMappe = m.navn }
        } label: {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(CvBrand.purple.opacity(0.18))
                    Image(systemName: "folder.fill")
                        .font(.appScaled(size: 16, weight: .semibold))
                        .foregroundStyle(CvBrand.purpleLight)
                }
                .frame(width: 46, height: 46)
                VStack(alignment: .leading, spacing: 5) {
                    Text(m.navn)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    HStack(spacing: 6) {
                        Text("\(m.antall) notat\(m.antall == 1 ? "" : "er")")
                            .font(.appScaled(size: 10))
                            .foregroundStyle(CvBrand.textSecondary)
                        if m.harKundeminne {
                            Text("Kundeminne")
                                .font(.appScaled(size: 9, weight: .bold))
                                .foregroundStyle(CvBrand.green)
                                .padding(.horizontal, 7).padding(.vertical, 2)
                                .background(CvBrand.green.opacity(0.15), in: Capsule())
                        }
                        Spacer(minLength: 4)
                        Text(Self.kortDato(m.siste))
                            .font(.appScaled(size: 9))
                            .foregroundStyle(CvBrand.textTertiary)
                    }
                }
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(CvBrand.textTertiary)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CvBrand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(CvBrand.stroke, lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .hoverEffect(.lift)
    }

    private func mappeInnhold(_ navn: String) -> some View {
        let liste = notaterIMappe(navn)
        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 8) {
                tilbakeRad(tittel: navn)
                Button {
                    nyttNotat(type: .lead)
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "plus")
                            .font(.appScaled(size: 10, weight: .black))
                        Text("Nytt i mappa")
                            .font(.appScaled(size: 11, weight: .bold))
                    }
                    .foregroundStyle(CvBrand.purpleLight)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background(CvBrand.purple.opacity(0.14),
                                in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10)
                        .stroke(CvBrand.purple.opacity(0.4), lineWidth: 1))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                ForEach(liste) { n in
                    if n.erKundeminne {
                        kundeminneRad(n)
                    } else {
                        notatRad(n)
                    }
                }
                if liste.isEmpty {
                    Text("Ingen notater i denne mappa.")
                        .font(.appScaled(size: 12))
                        .foregroundStyle(CvBrand.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 30)
                }
            }
            .padding(.horizontal, 12).padding(.bottom, 16)
        }
    }

    private func kundeminneRad(_ n: CanvasNotat) -> some View {
        notatRad(n)
            .overlay(alignment: .topTrailing) {
                Text("KUNDEMINNE")
                    .font(.appScaled(size: 8, weight: .black))
                    .foregroundStyle(CvBrand.green)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(CvBrand.green.opacity(0.18), in: Capsule())
                    .padding(6)
            }
    }

    private func tilbakeRad(tittel: String) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.15)) {
                valgtMappe = nil
                visPapirkurv = false
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "chevron.left")
                    .font(.appScaled(size: 11, weight: .black))
                    .foregroundStyle(CvBrand.purpleLight)
                Text(tittel)
                    .font(.appScaled(size: 13, weight: .black))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Spacer()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.vertical, 2)
    }

    private var papirkurvInngang: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.15)) { visPapirkurv = true }
            Task { await lastPapirkurv() }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "trash")
                    .font(.appScaled(size: 11, weight: .semibold))
                Text("Papirkurv")
                    .font(.appScaled(size: 11, weight: .bold))
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.appScaled(size: 10, weight: .bold))
            }
            .foregroundStyle(CvBrand.textSecondary)
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(CvBrand.card.opacity(0.6), in: RoundedRectangle(cornerRadius: 10))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var papirkurvListe: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 8) {
                tilbakeRad(tittel: "Papirkurv")
                Text("Slettede notater ligger her i 30 dager før de tømmes for godt.")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(CvBrand.textTertiary)
                ForEach(papirkurvNotater) { n in papirkurvRad(n) }
                if papirkurvNotater.isEmpty {
                    Text("Papirkurven er tom.")
                        .font(.appScaled(size: 12))
                        .foregroundStyle(CvBrand.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 30)
                }
            }
            .padding(.horizontal, 12).padding(.bottom, 16)
        }
    }

    private func papirkurvRad(_ n: CanvasNotat) -> some View {
        HStack(spacing: 10) {
            ZStack {
                Rectangle().fill(n.kategori.coverGradient)
                Image(systemName: n.kategori.ikon)
                    .font(.appScaled(size: 14, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.9))
            }
            .frame(width: 40, height: 40)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .opacity(0.6)
            VStack(alignment: .leading, spacing: 4) {
                Text(n.tittel.isEmpty ? "Uten tittel" : n.tittel)
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let slettet = n.slettetAt {
                    Text("Slettet \(Self.kortDato(slettet))")
                        .font(.appScaled(size: 9))
                        .foregroundStyle(CvBrand.textTertiary)
                }
            }
            Spacer(minLength: 6)
            Button {
                gjenopprettFraPapirkurv(n)
            } label: {
                Text("Gjenopprett")
                    .font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(CvBrand.green)
                    .padding(.horizontal, 9).padding(.vertical, 5)
                    .background(CvBrand.green.opacity(0.15), in: Capsule())
            }
            .buttonStyle(.plain)
            .disabled(!rolleKanSkriveCanvas)
            Button {
                slettPermanent(n)
            } label: {
                Image(systemName: "trash.fill")
                    .font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(CvBrand.red)
                    .frame(width: 44, height: 44)
                    .background(CvBrand.red.opacity(0.15), in: Circle())
            }
            .buttonStyle(.plain)
            .disabled(!rolleKanSkriveCanvas)
        }
        .padding(10)
        .background(CvBrand.card.opacity(0.7), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(CvBrand.stroke, lineWidth: 1))
    }

    @MainActor
    private func lastPapirkurv() async {
        guard !isDemo, let api = appState.api else { return }
        guard let dtoer = try? await api.hentCanvasNotater(papirkurv: true) else { return }
        papirkurvNotater = dtoer.map { Self.fraDTO($0) }
    }

    private func gjenopprettFraPapirkurv(_ n: CanvasNotat) {
        guard rolleKanSkriveCanvas else { return }
        papirkurvNotater.removeAll { $0.id == n.id }
        var tilbake = n
        tilbake.slettetAt = nil
        notater.insert(tilbake, at: 0)
        guard !isDemo, let api = appState.api else { return }
        Task { @MainActor in
            do {
                let revision = try await api.gjenopprettCanvasNotat(
                    id: n.id, revision: n.revision)
                if let i = notater.firstIndex(where: { $0.id == n.id }) {
                    notater[i].revision = revision
                }
            } catch {
                notater.removeAll { $0.id == n.id }
                papirkurvNotater.insert(n, at: 0)
                saveStatus[n.id] = erRevisjonskonflikt(error)
                    ? .conflict : .failed(error.localizedDescription)
            }
        }
    }

    private func slettPermanent(_ n: CanvasNotat) {
        guard rolleKanSkriveCanvas else { return }
        papirkurvNotater.removeAll { $0.id == n.id }
        guard !isDemo, let api = appState.api else { return }
        Task { @MainActor in
            do {
                try await api.slettCanvasNotat(
                    id: n.id, revision: n.revision, permanent: true)
            } catch {
                papirkurvNotater.insert(n, at: 0)
                saveStatus[n.id] = erRevisjonskonflikt(error)
                    ? .conflict : .failed(error.localizedDescription)
            }
        }
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
        // Pencil Hover: kortet løfter seg når pennen svever over.
        .hoverEffect(.lift)
        .contextMenu {
            if n.erMin && rolleKanSkriveCanvas {
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

    private var editorKjerne: some View {
        VStack(spacing: 0) {
            // Faner: flere dokumenter åpne samtidig — bytt med ett tap.
            if aapneFaner.count > 1 { faneRad }
            // Multi-penn: hvem tegner i notatet akkurat nå.
            if !realtime.deltakere.isEmpty {
                HStack(spacing: 7) {
                    Circle().fill(CvBrand.green).frame(width: 7, height: 7)
                    Text("Tegner sammen med deg: \(realtime.deltakere.joined(separator: ", "))")
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(.white)
                    Spacer()
                }
                .padding(.horizontal, 14).padding(.vertical, 7)
                .background(CvBrand.green.opacity(0.14))
            }
            // Live collab: kollega har endret det delte notatet.
            if let hvem = kollegaOppdatering {
                Button {
                    kollegaOppdatering = nil
                    handterSamarbeidsReload()
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
            editorToppMedTegneobservasjon

            Divider().overlay(CvBrand.stroke)

            // Verktøyraden i moduser: Tegn / Sett inn / Ordne + ⋯.
            if kanRedigereValgtNotat { verktoyRad }

            if visEditorSok { editorSokRad }
            // Selve tegneflata — PKToolPicker docker seg til bunnen.
            // Andres delte notater: kun visning (PUT er uansett eier-scopet).
            canvasArbeidsflate
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
    }

    private var editorMedAnalyse: some View {
        editorKjerne
        .sheet(isPresented: $visAnalyse) {
            let context = analyseKontekst
            CanvasAnalyseSheet(
                               drawing: context.flatMap {
                                   try? PKDrawing(data: $0.drawingData)
                               } ?? PKDrawing(),
                               selskap: context?.selskap ?? tittel,
                               leadId: context?.leadID,
                               romligTillegg: context?.romligBeskrivelse ?? "",
                               onFestIMinne: kan(.canvasKundeminne) ? { resultat in
                                   guard erGjeldende(context),
                                         kanRedigereValgtNotat else { return }
                                   visAnalyse = false
                                   festIMinne(resultat,
                                              selskap: context?.selskap ?? tittel,
                                              leadId: context?.leadID)
                               } : nil)
        }
        .sheet(isPresented: $visPdfAnalyse) {
            let context = pdfAnalyseKontekst
            PdfAnalyseSheet(
                tekst: pdfAnalyseTekst ?? "",
                dokumentNavn: pdfAnalyseNavn,
                sammenlignetMed: pdfAnalyseSammenlign,
                selskap: context?.selskap ?? tittel,
                leadId: context?.leadID,
                onFestPaaFlata: { oppsummering in
                    guard erGjeldende(context),
                          kanRedigereValgtNotat else { return }
                    // Oppsummeringen som tekstboks ved siden av dokumentet.
                    tekstbokser.append(CanvasTekstboks(
                        tekst: "📄 " + oppsummering, x: 60, y: 140))
                },
                onLagPunktObjekter: { punkter in
                    guard erGjeldende(context),
                          kanRedigereValgtNotat else { return }
                    // Punktene som kort på flata — synlige der du annoterer.
                    var y: Double = 160
                    for p in punkter {
                        objekter.append(CanvasObjekt(
                            type: "oppgave", x: 1010, y: y,
                            tittel: "📌 " + p.tittel,
                            detalj: p.frist ?? "Ta opp på møtet"))
                        y += 84
                    }
                })
        }
        .sheet(item: $lesDokument) { dok in
            PdfLeserSheet(dokument: dok)
        }
    }

    private var editorMedDokumentflyt: some View {
        editorMedAnalyse
        .sheet(item: $sendDokument, onDismiss: {
            sendKontekst = nil
        }) { dok in
            let context = sendKontekst
            if erGjeldende(context),
               let url = eksporterDokument(dok),
               let epost = context?.kontaktEpost {
                MailComposerView(
                    til: epost,
                    emne: "\(dok.navn) — \(context?.selskap ?? "")",
                    brodtekst: "Hei!\n\nVedlagt ligger «\(dok.navn)» med kommentarene fra møtet.\n\nMvh",
                    vedleggURL: url,
                    vedleggNavn: "\(dok.navn).pdf") { sendte in
                    sendDokument = nil
                    guard sendte, !isDemo, let api = appState.api else { return }
                    let logg = CanvasAnalyseDTO(
                        oppsummering: "Sendte annotert «\(dok.navn)» til \(epost)",
                        oppgaver: [], lofter: [])
                    Task { try? await api.persisterCanvasAnalyse(
                        selskap: context?.selskap, leadId: context?.leadID,
                        resultat: logg) }
                }
            }
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
            guard let noteID = valgtId else {
                bildeValg = nil
                return
            }
            let generation = editorGeneration
            // Tøm valget med en gang. En sen Photos-respons skal verken bli
            // hengende i velgeren eller havne i notatet brukeren byttet til.
            bildeValg = nil
            Task { @MainActor in
                guard let data = try? await valg.loadTransferable(type: Data.self),
                      valgtId == noteID, editorGeneration == generation else { return }
                leggTilBilde(data)
            }
        }
    }

    private var editorMedTidsreise: some View {
        editorMedDokumentflyt
        .sheet(isPresented: $visTidsreise, onDismiss: {
            tidsreiseKontekst = nil
        }) {
            if let context = tidsreiseKontekst {
                let id = context.noteID
                TidsreiseSheet(
                    notatId: id,
                    revision: context.revision,
                    naavaerende: (try? PKDrawing(
                        data: context.drawingData)) ?? PKDrawing()
                ) { dto in
                    let gjenopprettet = Self.fraDTO(dto)
                    let skalHydrere = erGjeldende(
                        context, krevSammeEditGeneration: true)
                    saveCoordinator.cancel(noteID: id)
                    dirtyNoteIDs.remove(id)
                    editGeneration[id, default: 0] += 1
                    saveStatus[id] = .saved
                    fjernLokalKladd(noteID: id, scope: canvasDraftScope)
                    if let indeks = notater.firstIndex(where: { $0.id == id }) {
                        notater[indeks] = gjenopprettet
                    }
                    if skalHydrere {
                        hydrate(gjenopprettet)
                    }
                    visTidsreise = false
                }
            }
        }
    }

    private var editorMedSamarbeid: some View {
        editorMedTidsreise
        // Live collab v1: delte notater poller etter kollega-endringer.
        .task(id: valgtId) {
            guard let id = valgtId,
                  let notat = notater.first(where: { $0.id == id }),
                  !notat.erMin || notat.delt,
                  !isDemo else { return }
            let generation = editorGeneration
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 6_000_000_000)
                guard !Task.isCancelled, valgtId == id,
                      editorGeneration == generation,
                      let api = appState.api else { return }
                guard let ferske = try? await api.hentCanvasNotater() else { continue }
                guard !Task.isCancelled, valgtId == id,
                      editorGeneration == generation else { return }
                guard let fersk = ferske.first(where: { $0.id == id }) else { continue }
                let lokalOppdatert = notater.first(where: { $0.id == id })?.oppdatert
                let fjernTid = ISO8601DateFormatter().date(from: fersk.oppdatert ?? "")
                if let ft = fjernTid, let lt = lokalOppdatert,
                   ft > lt.addingTimeInterval(2) {
                    kollegaOppdatering = fersk.eierNavn ?? "En kollega"
                }
            }
        }
    }

    private var editorMedEndringssporing: some View {
        editorMedSamarbeid
        .onChange(of: kategori) { _, _ in markerUlagret() }
        .onChange(of: kobletLeadId) { _, _ in markerUlagret() }
        .onChange(of: kobletSelskap) { _, _ in markerUlagret() }
        .onChange(of: deltMedTeam) { _, _ in markerUlagret() }
        .onChange(of: stempler) { _, _ in markerUlagret() }
        .onChange(of: tekstbokser) { _, _ in markerUlagret() }
        .onChange(of: figurer) { _, _ in markerUlagret() }
        .onChange(of: papir) { _, _ in markerUlagret() }
        .onChange(of: noder) { _, _ in markerUlagret() }
        .onChange(of: sider) { _, _ in markerUlagret() }
        .onChange(of: objekter) { _, _ in markerUlagret() }
        .onChange(of: dokumenter) { _, _ in markerUlagret() }
        .onChange(of: notatLat) { _, _ in markerUlagret() }
        .onChange(of: notatLon) { _, _ in markerUlagret() }
    }

    private var editor: some View {
        editorMedEndringssporing
        .sheet(isPresented: $visTypeVelger) {
            CanvasTypeVelger { valgt in
                visTypeVelger = false
                nyttNotat(type: valgt)
            }
            .presentationDetents([.medium])
        }
    }

    /// Lead-kobling: chip når koblet, meny for å velge/fjerne.
    // MARK: Verktøyraden — moduser (Tegn / Sett inn / Ordne + ⋯)

    private var verktoyRad: some View {
        HStack(spacing: 8) {
            modusVelger
            Divider().frame(height: 20).overlay(CvBrand.stroke)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    switch verktoyModus {
                    case .tegn: tegnVerktoy
                    case .settInn: settInnVerktoy
                    case .ordne: ordneVerktoy
                    case .panorer:
                        HStack(spacing: 4) {
                            Label("Dra for å panorere",
                                  systemImage: "hand.draw.fill")
                                .font(.appScaled(size: 11, weight: .semibold))
                                .foregroundStyle(CvBrand.purpleLight)
                            Button {
                                justerDokumentZoom(-0.15)
                            } label: {
                                Image(systemName: "minus")
                                    .frame(width: 44, height: 44)
                            }
                            .buttonStyle(.plain)
                            .keyboardShortcut("-", modifiers: .command)
                            .accessibilityLabel("Zoom ut")
                            Button {
                                tilpassDokumentbredde()
                            } label: {
                                Text("\(Int(effektivDokumentZoom * 100)) %")
                                    .font(.appScaled(size: 10, weight: .bold))
                                    .frame(minWidth: 58, minHeight: 44)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Tilpass dokumentbredden")
                            Button {
                                justerDokumentZoom(0.15)
                            } label: {
                                Image(systemName: "plus")
                                    .frame(width: 44, height: 44)
                            }
                            .buttonStyle(.plain)
                            .keyboardShortcut("+", modifiers: .command)
                            .accessibilityLabel("Zoom inn")
                        }
                    }
                }
            }
            sokKnapp
            mereMeny
        }
        .padding(.horizontal, 12).padding(.vertical, 6)
        .background(CvBrand.card.opacity(0.6))
    }

    private var modusVelger: some View {
        HStack(spacing: 3) {
            ForEach(VerktoyModus.allCases) { m in
                Button {
                    byttModus(m)
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: m.ikon)
                            .font(.appScaled(size: 10, weight: .bold))
                        Text(m.etikett)
                            .font(.appScaled(size: 11, weight: .bold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)
                            .fixedSize(horizontal: true, vertical: false)
                    }
                    .foregroundStyle(verktoyModus == m ? .white : CvBrand.textSecondary)
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(verktoyModus == m ? CvBrand.purple.opacity(0.5) : .clear,
                                in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(CvBrand.cardHi, in: Capsule())
    }

    private func byttModus(_ m: VerktoyModus) {
        withAnimation(.easeInOut(duration: 0.15)) {
            verktoyModus = m
            // Ordne = lasso-modusen: objektene under blekket blir flyttbare.
            objektModus = (m == .ordne)
            if m != .ordne { valgte.removeAll() }
        }
    }

    private func justerDokumentZoom(_ delta: CGFloat) {
        withAnimation(.easeInOut(duration: 0.18)) {
            dokumentZoom = min(
                2.5,
                max(Self.minimumDokumentZoom, dokumentZoom + delta))
        }
    }

    private func tilpassDokumentbredde() {
        withAnimation(.easeInOut(duration: 0.22)) {
            dokumentZoom = min(
                2.5,
                max(Self.minimumDokumentZoom,
                    (canvasViewportWidth - 24) / Self.logiskSidebredde))
        }
    }

    /// Tegn: penn-galleriet, papir-malen og tankekart-noder.
    @ViewBuilder private var tegnVerktoy: some View {
        Menu {
            ForEach(PennValg.allCases) { valg in
                Button {
                    pennValg = valg
                    pennSelectionRevision &+= 1
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
    }

    /// Sett inn: objekter, stempler, former, tekst og biblioteket.
    @ViewBuilder private var settInnVerktoy: some View {
        Menu {
            if kan(.canvasBilder) {
                Button {
                    bildeVelgerAapen = true
                } label: {
                    Label("Bilde fra Bilder", systemImage: "photo")
                }
            }
            if kan(.canvasPdf) {
                Button {
                    pdfVelgerAapen = true
                } label: {
                    Label("PDF — tilbud/kontrakt/plantegning",
                          systemImage: "doc.fill")
                }
            }
            if kan(.canvasLiveKort) {
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
                startKartUtsnitt()
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
            }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: "plus.square.on.square")
                    .font(.appScaled(size: 10, weight: .bold))
                Text("Objekt")
                    .font(.appScaled(size: 11, weight: .bold))
            }
            .foregroundStyle(CvBrand.textSecondary)
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(CvBrand.cardHi, in: Capsule())
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
        }
        // Formene legges inn som objekter: dra/klyp/vri, hold for å fjerne.
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
                        .frame(width: 44, height: 44)
                        .background(CvBrand.cardHi, in: RoundedRectangle(cornerRadius: 7))
                }
                .buttonStyle(.plain)
            }
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
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
            }
        }
        // Element-biblioteket: gjenbrukbare elementer.
        if !bibliotek.isEmpty && kan(.canvasBibliotek) {
            Menu {
                ForEach(bibliotek) { el in
                    Menu(el.eierNavn.flatMap { $0.isEmpty ? nil : "\(el.navn) · \($0)" }
                         ?? (el.delt == true ? "\(el.navn) · delt" : el.navn)) {
                        Button {
                            settInnElement(el)
                        } label: {
                            Label("Sett inn", systemImage: "plus.square.on.square")
                        }
                        if el.erMin ?? true {
                            Button {
                                settElementDeling(el, delt: el.delt != true)
                            } label: {
                                Label(el.delt == true
                                      ? "Slutt å dele med teamet"
                                      : "Del med teamet",
                                      systemImage: el.delt == true
                                      ? "person.2.slash" : "person.2.fill")
                            }
                            Button(role: .destructive) {
                                bibliotek.removeAll { $0.id == el.id }
                                BibliotekElement.lagreAlle(bibliotek)
                                if !isDemo, let api = appState.api {
                                    Task { try? await api.slettCanvasBibliotekElement(id: el.id) }
                                }
                            } label: {
                                Label("Slett fra biblioteket", systemImage: "trash")
                            }
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
    }

    /// Ordne: lasso-modusen — velg, flytt, slett og lagre elementer.
    @ViewBuilder private var ordneVerktoy: some View {
        if valgte.isEmpty {
            Text("Trykk på objekter for å velge — dra for å flytte")
                .font(.appScaled(size: 10))
                .foregroundStyle(CvBrand.textTertiary)
        } else {
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
                    .frame(width: 44, height: 44)
                    .background(CvBrand.red.opacity(0.15), in: Circle())
            }
            .buttonStyle(.plain)
            if kan(.canvasBibliotek) {
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
        }
    }

    /// Spatial Search: søk «Pris» → flata flyr dit.
    private var sokKnapp: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.15)) {
                visEditorSok.toggle()
                if !visEditorSok { sokTreff = []; editorSok = "" }
            }
        } label: {
            Image(systemName: "magnifyingglass.circle\(visEditorSok ? ".fill" : "")")
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(visEditorSok ? CvBrand.purpleLight : CvBrand.textSecondary)
                .frame(width: 44, height: 44)
                .background(CvBrand.cardHi, in: Capsule())
        }
        .buttonStyle(.plain)
    }

    /// ⋯-menyen: alt som ikke hører hjemme i en modus.
    private var mereMeny: some View {
        Menu {
            if valgtId != nil, !isDemo, kan(.canvasTidsreise) {
                Button {
                    guard let noteID = valgtId else { return }
                    Task { @MainActor in
                        if dirtyNoteIDs.contains(noteID) {
                            _ = leggGjeldendeLagringIKo(stille: true)
                        }
                        await saveCoordinator.wait(for: noteID)
                        guard valgtId == noteID,
                              saveStatus[noteID] != .conflict else { return }
                        tidsreiseKontekst = gjeldendeEditorKontekst()
                        visTidsreise = true
                    }
                } label: {
                    Label("Tidsreise", systemImage: "clock.arrow.2.circlepath")
                }
            }
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
                    Label("Historikk", systemImage: "clock.arrow.circlepath")
                }
            }
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
                Label(skjulteLag.isEmpty ? "Lag" : "Lag (\(skjulteLag.count) av)",
                      systemImage: "square.3.layers.3d")
            }
            // RBAC: org/leder styrer teamets Canvas-funksjoner.
            if erLederRolle && !isDemo {
                Menu {
                    Section("Selgernes Canvas") {
                        ForEach(Self.policyFunksjoner, id: \.0) { nokkel, navn in
                            Toggle(navn, isOn: rolleBinding(nokkel, gruppe: "selger"))
                        }
                    }
                    if erAdminRolle {
                        Section("Salgsledernes Canvas") {
                            ForEach(Self.policyFunksjoner, id: \.0) { nokkel, navn in
                                Toggle(navn, isOn: rolleBinding(nokkel, gruppe: "leder"))
                            }
                        }
                    }
                } label: {
                    Label("Tilgang", systemImage: "person.badge.key.fill")
                }
            }
            Divider()
            Button {
                sider = min(20, sider + 1)
            } label: {
                Label(sider > 1 ? "Ny side (nå \(sider))" : "Ny side",
                      systemImage: "plus.rectangle.on.rectangle")
            }
            Menu {
                ForEach(CanvasInputMode.allCases) { mode in
                    Button {
                        canvasInputModeRaw = mode.rawValue
                    } label: {
                        Label(
                            mode.etikett
                                + (canvasInputMode == mode ? " ✓" : ""),
                            systemImage: mode == .pencilOnly
                                ? "applepencil.tip" : "hand.draw")
                    }
                }
            } label: {
                Label("Tegneinput: \(canvasInputMode.etikett)",
                      systemImage: "applepencil.and.scribble")
            }
        } label: {
            Image(systemName: "ellipsis.circle")
                .font(.appScaled(size: 13, weight: .bold))
                .foregroundStyle(CvBrand.textSecondary)
                .frame(width: 44, height: 44)
                .background(CvBrand.cardHi, in: Capsule())
        }
    }

    private var leadKobling: some View {
        Menu {
            if kobletLeadId != nil || kobletSelskap != nil {
                // Spatial Sales Memory: hele kundeforholdet på ETT lerret.
                if kan(.canvasKundeminne) {
                    Button {
                        if let selskap = kobletSelskap {
                            aapneKundeminne(selskap: selskap, leadId: kobletLeadId)
                        }
                    } label: {
                        Label("Åpne kundeminnet", systemImage: "brain.head.profile")
                    }
                }
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

    private struct CanvasSaveRequest {
        var notat: CanvasNotat
        let editGeneration: Int
        let scope: String?
    }

    private struct DecodedCanvasDraft: Sendable {
        let note: CanvasNotat
        let generation: Int
        let savedAt: Date
    }

    private func nyttNotat(type: CanvasKategori = .mote) {
        guard rolleKanSkriveCanvas else { return }
        _ = leggGjeldendeLagringIKo(stille: true)
        let pos = KartLocationManager.shared.currentCoordinate
        var n = CanvasNotat(
            id: UUID().uuidString.lowercased(),
            tittel: "",
            kategori: type,
            selskap: nil, leadId: nil,
            drawingData: Data(),
            oppdatert: Date(),
            erNy: true,
            lat: pos?.latitude, lon: pos?.longitude,
            papir: CanvasPapir.standardFor(type))
        // Ny fra mappe-visningen → pre-koblet til kunden.
        if !visPapirkurv, let mappe = valgtMappe {
            n.selskap = mappe
            n.leadId = notaterIMappe(mappe).compactMap(\.leadId).first
        }
        notater.insert(n, at: 0)
        hydrate(n)
    }

    private func velg(_ n: CanvasNotat) {
        guard valgtId != n.id else {
            visNotatlisteSheet = false
            return
        }
        // Payloaden kopieres synkront før valgtId/editor-state endres.
        _ = leggGjeldendeLagringIKo(stille: true)
        hydrate(notater.first(where: { $0.id == n.id }) ?? n)
    }

    private func hydrate(_ n: CanvasNotat) {
        underHydrering = true
        autoTittelTask?.cancel()
        markeringsTask?.cancel()
        let hydrateGeneration = UUID()
        editorGeneration = hydrateGeneration
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
        dokumenter = n.dokumenter
        hentManglendeDokumenter(noteID: n.id, generation: editorGeneration)
        objektModus = false
        verktoyModus = .tegn
        markeringForslag = nil
        notatLat = n.lat
        notatLon = n.lon
        drawing = (try? PKDrawing(data: n.drawingData)) ?? PKDrawing()
        // Multi-penn: delte notater kobles til live-rommet — resten ikke.
        if n.delt, !n.erNy, !isDemo, let token = appState.authToken {
            realtime.koble(notatId: n.id, token: token,
                           strokAntall: drawing.strokes.count)
        } else {
            realtime.koblFra()
        }
        saveStatus[n.id] = saveStatus[n.id] ?? .idle
        valgte.removeAll()
        visNotatlisteSheet = false
        taSnapshot()
        DispatchQueue.main.async {
            if valgtId == n.id, editorGeneration == hydrateGeneration {
                underHydrering = false
            }
        }
    }

    private func slett(_ n: CanvasNotat) {
        guard n.erMin, rolleKanSkriveCanvas else { return }
        let scope = canvasDraftScope
        Task { @MainActor in
            guard scope == canvasDraftScope else { return }
            guard !deletingNoteIDs.contains(n.id) else { return }
            // Ta et immutable sluttsnapshot før slettelåsen settes. Etter
            // låsen kan lifecycle-callbacks ikke legge en sen PUT bak DELETE.
            let sisteLagring: Task<Void, Never>?
            if valgtId == n.id {
                autosaveTask?.cancel()
                sisteLagring = leggGjeldendeLagringIKo(stille: true)
            } else {
                sisteLagring = nil
            }
            deletingNoteIDs.insert(n.id)
            defer { deletingNoteIDs.remove(n.id) }
            if let sisteLagring { await sisteLagring.value }
            // En delete må stå etter alle create/update-operasjoner for samme
            // UUID. Å kansellere en URLSession-task kan ikke trekke tilbake en
            // POST som allerede er committet på serveren.
            await saveCoordinator.wait(for: n.id)
            guard scope == canvasDraftScope else { return }
            let siste = notater.first(where: { $0.id == n.id }) ?? n
            do {
                if !isDemo, let api = appState.api {
                    do {
                        try await api.slettCanvasNotat(
                            id: siste.id,
                            revision: siste.revision)
                    } catch let error as APIError where error.isNotFound {
                        // Et helt lokalt notat har ingen serverrad; 404 er da
                        // den ønskede slutt-tilstanden.
                    }
                }
                guard scope == canvasDraftScope else { return }
                fjernNotatLokalt(siste.id, scope: scope)
            } catch {
                saveStatus[n.id] = erRevisjonskonflikt(error)
                    ? .conflict : .failed(error.localizedDescription)
            }
        }
    }

    @MainActor
    private func fjernNotatLokalt(_ noteID: String, scope: String?) {
        fjernLokalKladd(noteID: noteID, scope: scope)
        notater.removeAll { $0.id == noteID }
        aapneFaner.removeAll { $0 == noteID }
        dirtyNoteIDs.remove(noteID)
        editGeneration.removeValue(forKey: noteID)
        saveStatus.removeValue(forKey: noteID)
        guard valgtId == noteID else { return }
        if let nesteId = aapneFaner.last ?? notater.first?.id,
           let neste = notater.first(where: { $0.id == nesteId }) {
            hydrate(neste)
        } else {
            valgtId = nil
            realtime.koblFra()
            drawing = PKDrawing()
        }
    }

    @MainActor
    private func lagre(stille: Bool = false) async {
        guard let task = leggGjeldendeLagringIKo(stille: stille) else { return }
        if !stille { await task.value }
    }

    /// Lager hele payloaden uten `await`, oppdaterer den lokale modellen og
    /// legger deretter den immutable kopien i en per-note serialisert kø.
    @MainActor
    @discardableResult
    private func leggGjeldendeLagringIKo(stille: Bool) -> Task<Void, Never>? {
        guard let request = snapshotAvGjeldendeNotat() else { return nil }
        let noteID = request.notat.id
        saveStatus[noteID] = .queued
        lagreLokalKladd(request)
        return saveCoordinator.enqueue(noteID: noteID) {
            await persister(request, stille: stille)
        }
    }

    @MainActor
    private func snapshotAvGjeldendeNotat() -> CanvasSaveRequest? {
        guard let id = valgtId,
              !deletingNoteIDs.contains(id),
              let idx = notater.firstIndex(where: { $0.id == id }) else { return nil }
        var n = notater[idx]
        guard n.erMin, rolleKanSkriveCanvas,
              realtime.canWrite != false else { return nil }
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
        // Dokumenter uten gjenlevende side-objekter fjernes fra metadata.
        // Fjern bare metadatareferansen. Blobben er immutable og beholdes
        // server-side til permanent note-delete/GC; save skal aldri hard-slette.
        dokumenter.removeAll { d in !objekter.contains { $0.dokId == d.id } }
        n.dokumenter = dokumenter
        n.lat = notatLat
        n.lon = notatLon
        n.drawingData = drawing.dataRepresentation()
        n.oppdatert = Date()
        notater[idx] = n
        oppdaterThumb(n)
        return CanvasSaveRequest(
            notat: n,
            editGeneration: editGeneration[id, default: 0],
            scope: canvasDraftScope)
    }

    /// Encoding og fil-I/O skjer utenfor MainActor. Store-actoren beholder
    /// bare høyeste generation, så Task-rekkefølge kan ikke rulle kladden
    /// bakover.
    private func lagreLokalKladd(
        _ request: CanvasSaveRequest, scope overrideScope: String? = nil
    ) {
        guard let scope = overrideScope ?? request.scope else { return }
        let note = request.notat
        let generation = request.editGeneration
        Task.detached(priority: .utility) {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .millisecondsSince1970
            guard let data = try? encoder.encode(note) else { return }
            try? await CanvasDraftStore.shared.save(
                noteID: note.id,
                generation: generation,
                encodedNote: data,
                scope: scope)
        }
    }

    private func fjernLokalKladd(
        noteID: String, scope: String?, upToGeneration: Int? = nil
    ) {
        guard let scope else { return }
        Task {
            await CanvasDraftStore.shared.remove(
                noteID: noteID,
                scope: scope,
                upToGeneration: upToGeneration)
        }
    }

    private func lesLokaleKladder(scope: String?) async -> [DecodedCanvasDraft] {
        guard let scope else { return [] }
        let records = await CanvasDraftStore.shared.load(scope: scope)
        return await Task.detached(priority: .utility) {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .millisecondsSince1970
            return records.compactMap { record in
                guard let note = try? decoder.decode(
                    CanvasNotat.self, from: record.encodedNote),
                      note.id == record.noteID,
                      note.erMin else { return nil }
                return DecodedCanvasDraft(
                    note: note,
                    generation: record.generation,
                    savedAt: record.savedAt)
            }
        }.value
    }

    @MainActor
    private func persister(_ request: CanvasSaveRequest, stille _: Bool) async {
        guard request.scope == canvasDraftScope else { return }
        var n = request.notat
        let noteID = n.id
        // En tidligere queued POST kan ha fullført mens denne payloaden ventet.
        // Rebase bare server-state; innholdet forblir snapshotet.
        if let aktuell = notater.first(where: { $0.id == noteID }) {
            n.erNy = aktuell.erNy
            n.revision = aktuell.revision
        }
        saveStatus[noteID] = .saving
        if isDemo {
            fullforLagring(
                request: request,
                revision: max(1, n.revision),
                dokumenter: n.dokumenter)
            return
        }
        guard let api = appState.api else {
            saveStatus[noteID] = .failed("Ingen aktiv tilkobling. Prøv igjen.")
            return
        }
        do {
            if !n.erNy {
                for i in n.dokumenter.indices
                where n.dokumenter[i].opplastet != true
                    && !n.dokumenter[i].base64.isEmpty {
                    let d = n.dokumenter[i]
                    try await api.lastOppCanvasDokument(
                        notatId: n.id, dokId: d.id,
                        navn: d.navn, base64: d.base64)
                    guard request.scope == canvasDraftScope else { return }
                    n.dokumenter[i].opplastet = true
                }
            }
            n.sokbarTekst = await byggSokbarTekst(for: n)
            guard request.scope == canvasDraftScope else { return }
            let persistenteDokumenter = n.dokumenter.map { d in
                var kopi = d
                kopi.base64 = ""
                return kopi
            }
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
            let dokumenterJSON = (try? JSONEncoder().encode(persistenteDokumenter))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
            func revisionertPut(_ revision: Int,
                                dokumenterJSON: String) async throws -> Int {
                guard request.scope == canvasDraftScope else {
                    throw CancellationError()
                }
                return try await api.oppdaterCanvasNotat(
                    id: n.id, tittel: n.tittel, kategori: n.kategori.rawValue,
                    selskap: n.selskap, leadId: n.leadId,
                    drawingBase64: n.drawingData.base64EncodedString(),
                    delt: n.delt, lat: n.lat, lon: n.lon,
                    stempler: stemplerJSON, tekstbokser: tekstbokserJSON,
                    figurer: figurerJSON, papir: n.papir.rawValue,
                    noder: noderJSON, sider: n.sider, objekter: objekterJSON,
                    sokbarTekst: n.sokbarTekst, dokumenter: dokumenterJSON,
                    revision: revision)
            }
            let nyRevision: Int
            if n.erNy {
                let resultat = try await api.opprettCanvasNotat(
                    id: n.id, tittel: n.tittel, kategori: n.kategori.rawValue,
                    selskap: n.selskap, leadId: n.leadId,
                    drawingBase64: n.drawingData.base64EncodedString(),
                    delt: n.delt, lat: n.lat, lon: n.lon,
                    stempler: stemplerJSON, tekstbokser: tekstbokserJSON,
                    figurer: figurerJSON, papir: n.papir.rawValue,
                    noder: noderJSON, sider: n.sider, objekter: objekterJSON,
                    sokbarTekst: n.sokbarTekst, dokumenter: dokumenterJSON)
                guard request.scope == canvasDraftScope else { return }
                guard resultat.id == noteID else {
                    saveStatus[noteID] = .failed("Tjeneren returnerte feil notat-ID.")
                    return
                }
                n.erNy = false
                n.revision = resultat.revision
                oppdaterRevisjonLokalt(noteID: noteID,
                                       revision: resultat.revision)
                var lastetOppDokument = false
                for i in n.dokumenter.indices
                where n.dokumenter[i].opplastet != true
                    && !n.dokumenter[i].base64.isEmpty {
                    let d = n.dokumenter[i]
                    try await api.lastOppCanvasDokument(
                        notatId: n.id, dokId: d.id,
                        navn: d.navn, base64: d.base64)
                    guard request.scope == canvasDraftScope else { return }
                    n.dokumenter[i].opplastet = true
                    lastetOppDokument = true
                }
                if lastetOppDokument || !resultat.created {
                    let oppdatertDokumentJSON = (try? JSONEncoder().encode(
                        n.dokumenter.map { dokument in
                            var metadata = dokument
                            metadata.base64 = ""
                            return metadata
                        }))
                        .flatMap { String(data: $0, encoding: .utf8) } ?? "[]"
                    nyRevision = try await revisionertPut(
                        resultat.revision,
                        dokumenterJSON: oppdatertDokumentJSON)
                } else {
                    nyRevision = resultat.revision
                }
            } else {
                nyRevision = try await revisionertPut(
                    n.revision, dokumenterJSON: dokumenterJSON)
            }
            fullforLagring(
                request: request,
                revision: nyRevision,
                dokumenter: n.dokumenter,
                sokbarTekst: n.sokbarTekst)
        } catch {
            guard request.scope == canvasDraftScope else { return }
            saveStatus[noteID] = erRevisjonskonflikt(error)
                ? .conflict : .failed(error.localizedDescription)
            print("[Canvas] lagring feilet: \(error)")
        }
    }

    @MainActor
    private func fullforLagring(request: CanvasSaveRequest, revision: Int,
                                dokumenter lagredeDokumenter: [CanvasDokument],
                                sokbarTekst: String? = nil) {
        guard request.scope == canvasDraftScope else { return }
        let noteID = request.notat.id
        if let idx = notater.firstIndex(where: { $0.id == noteID }) {
            notater[idx].erNy = false
            notater[idx].revision = revision
            if let sokbarTekst { notater[idx].sokbarTekst = sokbarTekst }
            for lagret in lagredeDokumenter where lagret.opplastet == true {
                if let dokumentIndex = notater[idx].dokumenter.firstIndex(
                    where: { $0.id == lagret.id }) {
                    notater[idx].dokumenter[dokumentIndex].opplastet = true
                }
                if valgtId == noteID,
                   let editorIndex = dokumenter.firstIndex(where: { $0.id == lagret.id }) {
                    dokumenter[editorIndex].opplastet = true
                }
            }
        }
        if editGeneration[noteID, default: 0] == request.editGeneration {
            dirtyNoteIDs.remove(noteID)
            saveStatus[noteID] = .saved
            fjernLokalKladd(
                noteID: noteID,
                scope: request.scope,
                upToGeneration: request.editGeneration)
        } else {
            // Et nyere editor-snapshot finnes. Resultatet er gyldig som
            // server-revision, men må aldri presenteres som «alt lagret».
            saveStatus[noteID] = .queued
        }
    }

    @MainActor
    private func oppdaterRevisjonLokalt(noteID: String, revision: Int) {
        guard let idx = notater.firstIndex(where: { $0.id == noteID }) else { return }
        notater[idx].erNy = false
        notater[idx].revision = revision
    }

    private func erRevisjonskonflikt(_ error: Error) -> Bool {
        guard let apiError = error as? APIError else { return false }
        switch apiError {
        case .statusCode(412), .statusCode(428),
             .serverError(412, _), .serverError(428, _):
            return true
        default:
            return false
        }
    }

    private func markerUlagret() {
        guard !underHydrering, let noteID = valgtId,
              !deletingNoteIDs.contains(noteID),
              kanRedigereValgtNotat else { return }
        editGeneration[noteID, default: 0] += 1
        let generation = editGeneration[noteID, default: 0]
        dirtyNoteIDs.insert(noteID)
        if saveStatus[noteID] != .conflict {
            saveStatus[noteID] = .queued
        }
        autosaveTask?.cancel()
        autosaveTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            guard !Task.isCancelled,
                  valgtId == noteID,
                  editGeneration[noteID] == generation,
                  dirtyNoteIDs.contains(noteID),
                  saveStatus[noteID] != .conflict else { return }
            _ = leggGjeldendeLagringIKo(stille: true)
        }
        draftTask?.cancel()
        draftTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 350_000_000)
            guard !Task.isCancelled,
                  valgtId == noteID,
                  editGeneration[noteID] == generation,
                  dirtyNoteIDs.contains(noteID),
                  let request = snapshotAvGjeldendeNotat() else { return }
            lagreLokalKladd(request)
        }
    }

    private func startLastInnValgtFraServer() {
        guard let noteID = valgtId else { return }
        let generation = editorGeneration
        Task { @MainActor in
            await lastInnValgtFraServer(noteID: noteID, generation: generation)
        }
    }

    private func handterSamarbeidsReload() {
        guard let noteID = valgtId else { return }
        if dirtyNoteIDs.contains(noteID)
            || saveCoordinator.pendingNoteIDs.contains(noteID) {
            saveStatus[noteID] = .conflict
            return
        }
        startLastInnValgtFraServer()
    }

    @MainActor
    private func lastInnValgtFraServer(noteID: String, generation: UUID) async {
        guard valgtId == noteID, editorGeneration == generation,
              let api = appState.api else { return }
        do {
            let dtoer = try await api.hentCanvasNotater()
            guard !Task.isCancelled, valgtId == noteID,
                  editorGeneration == generation else { return }
            guard let dto = dtoer.first(where: { $0.id == noteID }) else {
                saveStatus[noteID] = .failed("Notatet finnes ikke lenger på serveren.")
                return
            }
            saveCoordinator.cancel(noteID: noteID)
            fjernLokalKladd(noteID: noteID, scope: canvasDraftScope)
            let ferskt = Self.fraDTO(dto)
            if let idx = notater.firstIndex(where: { $0.id == noteID }) {
                notater[idx] = ferskt
            } else {
                notater.insert(ferskt, at: 0)
            }
            saveStatus[noteID] = .idle
            hydrate(ferskt)
        } catch {
            if !Task.isCancelled, valgtId == noteID,
               editorGeneration == generation {
                saveStatus[noteID] = .failed(error.localizedDescription)
            }
        }
    }

    @MainActor
    private func lastInn() async {
        let scope = canvasDraftScope
        let scopeToken = scope ?? "__no_authenticated_scope__"
        if loadedCanvasScope != scopeToken {
            nullstillCanvasForNyttScope(scopeToken)
        }
        defer {
            if canvasDraftScope == scope {
                lastet = true
            }
        }
        if isDemo {
            if notater.isEmpty { notater = Self.demoNotater() }
            return
        }
        let lokaleKladder = await lesLokaleKladder(scope: scope)
        guard !Task.isCancelled, canvasDraftScope == scope else { return }
        guard let api = appState.api else {
            gjenopprettKladderUtenServer(lokaleKladder)
            return
        }
        guard let dtoer = try? await api.hentCanvasNotater() else {
            guard !Task.isCancelled, canvasDraftScope == scope else { return }
            gjenopprettKladderUtenServer(lokaleKladder)
            return
        }
        guard !Task.isCancelled, canvasDraftScope == scope else { return }
        let eksisterende = Dictionary(uniqueKeysWithValues: notater.map { ($0.id, $0) })
        let lokaltBeskyttet = dirtyNoteIDs.union(saveCoordinator.pendingNoteIDs)
        let serverRevisjoner = Dictionary(uniqueKeysWithValues: dtoer.map {
            ($0.id, $0.revision ?? 0)
        })
        var innlastede = dtoer.map { dto -> CanvasNotat in
            let ferskt = Self.fraDTO(dto)
            // Automatisk refresh skal aldri erstatte editorens eget aktive
            // snapshot. Konflikt/reload håndteres eksplisitt i statusbanneret.
            if (dto.id == valgtId || lokaltBeskyttet.contains(dto.id)),
               let lokalt = eksisterende[dto.id], lokalt.erMin {
                return lokalt
            }
            return ferskt
        }
        let bareLokale = eksisterende.values.filter { lokalt in
            lokalt.erNy && !innlastede.contains(where: { $0.id == lokalt.id })
        }
        innlastede.append(contentsOf: bareLokale)
        let gjenopptak = flettInnLokaleKladder(
            lokaleKladder,
            i: &innlastede,
            eksisterende: eksisterende,
            lokaltBeskyttet: lokaltBeskyttet,
            serverRevisjoner: serverRevisjoner,
            scope: scope)
        notater = innlastede
        genererThumbs()
        for request in gjenopptak {
            _ = saveCoordinator.enqueue(noteID: request.notat.id) {
                await persister(request, stille: true)
            }
        }
        if let api = appState.api {
            let oppgaver = try? await api.hentMoteOppgaver()
            guard !Task.isCancelled, canvasDraftScope == scope else { return }
            oppgaverCache = oppgaver ?? []
            if let p = try? await api.hentCanvasRollePolicy() {
                guard !Task.isCancelled, canvasDraftScope == scope else { return }
                rollePolicy = p
            }
            // Org-delt bibliotek: backend er sannheten — lokale elementer
            // som ikke finnes der lastes opp én gang (migrering fra
            // UserDefaults-æraen).
            if let dtos = try? await api.hentCanvasBibliotek() {
                guard !Task.isCancelled, canvasDraftScope == scope else { return }
                var synket = dtos.compactMap { BibliotekElement.fraDTO($0) }
                let lokale = bibliotek.filter { l in
                    (l.erMin ?? true) && !synket.contains { $0.id == l.id }
                }
                for var l in lokale {
                    l.erMin = true
                    if (try? await api.lagreCanvasBibliotekElement(
                        id: l.id, navn: l.navn,
                        innhold: l.innholdJSON, delt: false)) != nil {
                        guard !Task.isCancelled, canvasDraftScope == scope else { return }
                        synket.append(l)
                    }
                }
                guard !Task.isCancelled, canvasDraftScope == scope else { return }
                bibliotek = synket
                BibliotekElement.lagreAlle(bibliotek)
            }
        }
    }

    @MainActor
    private func nullstillCanvasForNyttScope(_ scopeToken: String) {
        saveCoordinator.cancelAll()
        autosaveTask?.cancel()
        draftTask?.cancel()
        autoTittelTask?.cancel()
        markeringsTask?.cancel()
        realtime.koblFra()
        loadedCanvasScope = scopeToken
        lastet = false
        notater.removeAll()
        papirkurvNotater.removeAll()
        aapneFaner.removeAll()
        valgtId = nil
        saveStatus.removeAll()
        editGeneration.removeAll()
        dirtyNoteIDs.removeAll()
        deletingNoteIDs.removeAll()
        drawing = PKDrawing()
        stempler.removeAll()
        tekstbokser.removeAll()
        figurer.removeAll()
        noder.removeAll()
        objekter.removeAll()
        dokumenter.removeAll()
        sokTreff.removeAll()
        kollegaOppdatering = nil
        bibliotek.removeAll()
        oppgaverCache.removeAll()
        rollePolicy = OversiktPolicyDTO()
    }

    @MainActor
    private func gjenopprettKladderUtenServer(
        _ kladder: [DecodedCanvasDraft]
    ) {
        var perID = Dictionary(uniqueKeysWithValues: notater.map { ($0.id, $0) })
        for kladd in kladder {
            if dirtyNoteIDs.contains(kladd.note.id)
                || saveCoordinator.pendingNoteIDs.contains(kladd.note.id) {
                continue
            }
            perID[kladd.note.id] = kladd.note
            editGeneration[kladd.note.id] = max(
                editGeneration[kladd.note.id, default: 0],
                kladd.generation)
            dirtyNoteIDs.insert(kladd.note.id)
            saveStatus[kladd.note.id] = .failed(
                "Lagret lokalt – koble til nettet og prøv igjen.")
        }
        notater = perID.values.sorted { $0.oppdatert > $1.oppdatert }
        genererThumbs()
    }

    /// Returnerer bare kladder som kan gjenopptas automatisk uten å krysse
    /// en serverrevisjon. Ved avvik beholdes det lokale innholdet synlig,
    /// men settes i konflikt i stedet for å bli overskrevet.
    @MainActor
    private func flettInnLokaleKladder(
        _ kladder: [DecodedCanvasDraft],
        i innlastede: inout [CanvasNotat],
        eksisterende: [String: CanvasNotat],
        lokaltBeskyttet: Set<String>,
        serverRevisjoner: [String: Int],
        scope: String?
    ) -> [CanvasSaveRequest] {
        var requests: [CanvasSaveRequest] = []
        let pending = saveCoordinator.pendingNoteIDs
        for kladd in kladder {
            let id = kladd.note.id
            // Minneversjonen er nyere enn en disk-kladd når brukeren allerede
            // redigerer eller lagrer dette notatet i samme prosess.
            if lokaltBeskyttet.contains(id), eksisterende[id] != nil { continue }

            if let index = innlastede.firstIndex(where: { $0.id == id }) {
                innlastede[index] = kladd.note
            } else {
                innlastede.append(kladd.note)
            }
            editGeneration[id] = max(
                editGeneration[id, default: 0], kladd.generation)
            dirtyNoteIDs.insert(id)

            let kanGjenopptas: Bool
            if let serverRevision = serverRevisjoner[id] {
                kanGjenopptas = serverRevision == kladd.note.revision
            } else {
                kanGjenopptas = kladd.note.erNy
            }
            if kanGjenopptas, !pending.contains(id) {
                saveStatus[id] = .queued
                requests.append(CanvasSaveRequest(
                    notat: kladd.note,
                    editGeneration: kladd.generation,
                    scope: scope))
            } else if !pending.contains(id) {
                saveStatus[id] = .conflict
            }
        }
        return requests
    }

    // MARK: Markering → møtepunkt

    struct MarkeringForslag: Equatable {
        let tekst: String
        let punkt: CGPoint
        let dokNavn: String
    }

    /// E-posten til den koblede lead-kontakten (for «Send til …»).
    private var kontaktEpost: String? {
        guard let id = kobletLeadId,
              let lead = appState.leads.first(where: { $0.id == id }),
              let epost = lead.email, !epost.isEmpty else { return nil }
        return epost
    }

    /// Visningsrekten til en PDF-side på flata (samme matte som eksporten).
    @MainActor
    private func pdfVisningsRect(_ objekt: CanvasObjekt,
                                 dok: CanvasDokument) -> CGRect? {
        guard let pdfd = PdfDokumentCache.dokument(for: dok),
              let side = pdfd.page(at: objekt.side ?? 0) else { return nil }
        let sr = side.bounds(for: .mediaBox)
        let bredde = 1520 * objekt.skala
        let hoyde = sr.height / max(sr.width, 1) * bredde
        return CGRect(x: objekt.x - bredde / 2, y: objekt.y - hoyde / 2,
                      width: bredde, height: hoyde)
    }

    /// Tusj-strøket er ferdig: finn PDF-siden under, slå opp teksten i
    /// dokumentet (ekte tekst, ikke OCR) og vis forslags-kortet.
    @MainActor
    private func foreslaaMarkering(boks: CGRect) {
        let midt = CGPoint(x: boks.midX, y: boks.midY)
        for objekt in objekter where objekt.type == "pdf" && objekt.dokId != nil {
            guard let dok = dokumenter.first(where: { $0.id == objekt.dokId }),
                  let flateRect = pdfVisningsRect(objekt, dok: dok),
                  flateRect.contains(midt),
                  let pdfd = PdfDokumentCache.dokument(for: dok),
                  let side = pdfd.page(at: objekt.side ?? 0) else { continue }
            let sr = side.bounds(for: .mediaBox)
            let sx = (boks.minX - flateRect.minX) / flateRect.width * sr.width
            let sw = boks.width / flateRect.width * sr.width
            let syTopp = (boks.minY - flateRect.minY) / flateRect.height * sr.height
            let sh = max(boks.height / flateRect.height * sr.height, 14)
            let sideRect = CGRect(x: sx, y: sr.height - syTopp - sh,
                                  width: sw, height: sh)
            let tekst = side.selection(for: sideRect)?.string?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard tekst.count >= 3 else { return }
            withAnimation(.easeInOut(duration: 0.15)) {
                markeringForslag = MarkeringForslag(
                    tekst: String(tekst.prefix(240)),
                    punkt: CGPoint(x: boks.midX,
                                   y: max(60, boks.minY - 52)),
                    dokNavn: dok.navn)
            }
            return
        }
    }

    private func markeringsKort(_ forslag: MarkeringForslag) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("«\(forslag.tekst)»")
                .font(.appScaled(size: 11, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(3)
            HStack(spacing: 8) {
                Button {
                    taOppMarkering(forslag)
                } label: {
                    Label("Ta opp på møtet", systemImage: "pin.fill")
                        .font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 9).padding(.vertical, 5)
                        .background(CvBrand.purple, in: Capsule())
                }
                .buttonStyle(.plain)
                if kan(.canvasKundeminne),
                   let selskap = kobletSelskap, !selskap.isEmpty {
                    Button {
                        let dto = CanvasAnalyseDTO(
                            oppsummering: "Fra «\(forslag.dokNavn)»: \(forslag.tekst)",
                            oppgaver: [], lofter: [])
                        markeringForslag = nil
                        festIMinne(dto, selskap: selskap, leadId: kobletLeadId)
                    } label: {
                        Label("Kundeminnet", systemImage: "brain")
                            .font(.appScaled(size: 10, weight: .bold))
                            .foregroundStyle(CvBrand.green)
                            .padding(.horizontal, 9).padding(.vertical, 5)
                            .background(CvBrand.green.opacity(0.15), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
                Button {
                    withAnimation(.easeInOut(duration: 0.12)) {
                        markeringForslag = nil
                    }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.appScaled(size: 14))
                        .foregroundStyle(CvBrand.textTertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(10)
        .frame(maxWidth: 380)
        .background(CvBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12)
            .stroke(CvBrand.purple.opacity(0.6), lineWidth: 1.5))
        .shadow(color: .black.opacity(0.45), radius: 10, y: 4)
    }

    /// Markeringen → møtesløyfa (oppgave + møtelogg) + 📌-kort på flata.
    private func taOppMarkering(_ forslag: MarkeringForslag) {
        objekter.append(CanvasObjekt(
            type: "oppgave",
            x: forslag.punkt.x, y: forslag.punkt.y - 60,
            tittel: "📌 \(String(forslag.tekst.prefix(60)))",
            detalj: "Ta opp på møtet"))
        withAnimation(.easeInOut(duration: 0.12)) { markeringForslag = nil }
        guard !isDemo, let api = appState.api else { return }
        let selskap = kobletSelskap
        let leadID = kobletLeadId
        let dto = CanvasAnalyseDTO(
            oppsummering: "Markert i «\(forslag.dokNavn)»: \(forslag.tekst)",
            oppgaver: [CanvasAnalyseOppgaveDTO(
                tittel: String(forslag.tekst.prefix(80)), frist: nil)],
            lofter: [])
        Task { try? await api.persisterCanvasAnalyse(
            selskap: selskap, leadId: leadID, resultat: dto) }
    }

    // MARK: Tilbuds-diff

    /// Forrige dokument i samme kundemappe (eller notatet) → tekst til
    /// sammenligning i AI-analysen. Lazy-henter bytes ved behov.
    @MainActor
    private func forrigeDokumentTekst(unntattDokId: String) async
        -> (navn: String, tekst: String)? {
        var kandidat = dokumenter.last { $0.id != unntattDokId }
        if kandidat == nil, let selskap = kobletSelskap, !selskap.isEmpty {
            for n in notater
            where n.mappeNavn?.caseInsensitiveCompare(selskap) == .orderedSame {
                if let d = n.dokumenter.last(where: { $0.id != unntattDokId }) {
                    kandidat = d
                    break
                }
            }
        }
        guard var dok = kandidat else { return nil }
        if dok.base64.isEmpty {
            if let cachet = Self.dokumentByteCache[dok.id] {
                dok.base64 = cachet
            } else if !isDemo, let api = appState.api,
                      let hentet = try? await api.hentCanvasDokument(dokId: dok.id) {
                dok.base64 = hentet.base64
            }
        }
        guard let data = Data(base64Encoded: dok.base64),
              let pdf = PDFDocument(data: data) else { return nil }
        var tekst = ""
        for i in 0..<min(pdf.pageCount, 10) {
            tekst += (pdf.page(at: i)?.string ?? "") + "\n"
        }
        let ren = tekst.trimmingCharacters(in: .whitespacesAndNewlines)
        guard ren.count > 40 else { return nil }
        return (dok.navn, String(ren.prefix(6_000)))
    }

    /// Lazy-dokumenter: notat-lista bærer kun metadata — bytene hentes
    /// først når notatet åpnes, og caches i minnet per dokId.
    private static var dokumentByteCache: [String: String] = [:]

    private func hentManglendeDokumenter(noteID: String, generation: UUID) {
        // Allerede hentet i denne økta? Fyll fra minnecachen.
        for (i, d) in dokumenter.enumerated()
        where d.base64.isEmpty {
            if let cachet = Self.dokumentByteCache[d.id] {
                dokumenter[i].base64 = cachet
                dokumenter[i].opplastet = true
            }
        }
        let manglende = dokumenter.filter { $0.base64.isEmpty }
        guard !manglende.isEmpty, !isDemo, let api = appState.api else { return }
        Task { @MainActor in
            for d in manglende {
                guard valgtId == noteID, editorGeneration == generation else { return }
                guard let hentet = try? await api.hentCanvasDokument(dokId: d.id)
                else { continue }
                guard valgtId == noteID, editorGeneration == generation else { return }
                Self.dokumentByteCache[d.id] = hentet.base64
                if let i = dokumenter.firstIndex(where: { $0.id == d.id }) {
                    dokumenter[i].base64 = hentet.base64
                    dokumenter[i].opplastet = true
                }
            }
        }
    }

    /// Backend-datoer kommer fra toISOString() og har millisekunder —
    /// plain ISO8601DateFormatter avviser dem, så prøv begge variantene.
    private static func isoDato(_ s: String?) -> Date? {
        guard let s, !s.isEmpty else { return nil }
        let medBrok = ISO8601DateFormatter()
        medBrok.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return medBrok.date(from: s) ?? ISO8601DateFormatter().date(from: s)
    }

    private static func fraDTO(_ dto: CanvasNotatDTO) -> CanvasNotat {
        CanvasNotat(
            id: dto.id,
            tittel: dto.tittel,
            kategori: CanvasKategori(rawValue: dto.kategori) ?? .mote,
            selskap: dto.selskap,
            leadId: dto.leadId,
            drawingData: Data(base64Encoded: dto.drawingBase64 ?? "") ?? Data(),
            oppdatert: Self.isoDato(dto.oppdatert) ?? Date(),
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
            sokbarTekst: dto.sokbarTekst ?? "",
            dokumenter: (dto.dokumenter?.data(using: .utf8))
                .flatMap { try? JSONDecoder().decode([CanvasDokument].self, from: $0) } ?? [],
            slettetAt: Self.isoDato(dto.slettetAt),
            revision: dto.revision ?? 0)
    }

    /// Auto-tittel: øverste gjenkjente håndskrift-linje blir tittelen.
    @MainActor
    private func foreslaTittelFraBlekk(noteID: String, generation: UUID,
                                       drawing kopi: PKDrawing) async {
        guard valgtId == noteID, editorGeneration == generation,
              tittel.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        guard !kopi.strokes.isEmpty, !kopi.bounds.isEmpty else { return }
        // Mørk modus: strøkene er lagret i lys-referanse — render på hvitt.
        let bilde = kopi.image(from: kopi.bounds, scale: 2)
        let kandidat: String? = await Task.detached(priority: .utility) { () -> String? in
            guard let cg = bilde.cgImage else { return nil }
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.recognitionLanguages = ["nb-NO", "en-US"]
            let handler = VNImageRequestHandler(cgImage: cg)
            try? handler.perform([request])
            // Vision har origo nede til venstre → størst midY = øverste linja.
            let topp = request.results?.max { $0.boundingBox.midY < $1.boundingBox.midY }
            return topp?.topCandidates(1).first?.string
        }.value
        guard let ren = kandidat?.trimmingCharacters(in: .whitespacesAndNewlines),
              ren.count >= 3 else { return }
        // Ikke overskriv noe brukeren har rukket å skrive selv.
        if valgtId == noteID, editorGeneration == generation,
           tittel.trimmingCharacters(in: .whitespaces).isEmpty {
            tittel = String(ren.prefix(60))
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

    /// Ekte PDF-eksport: originalsidene tegnes som VEKTOR (teksten forblir
    /// søkbar og skarp) — blekket som ligger over hver side legges oppå
    /// som gjennomsiktig overlay. Ingen rasterisering av dokumentet.
    private func eksporterDokument(_ dok: CanvasDokument) -> URL? {
        guard let data = Data(base64Encoded: dok.base64),
              let pdf = PDFDocument(data: data) else { return nil }
        let sideObjekter = objekter
            .filter { $0.dokId == dok.id && $0.side != nil }
            .sorted { ($0.side ?? 0) < ($1.side ?? 0) }
        guard !sideObjekter.isEmpty,
              let forste = pdf.page(at: sideObjekter[0].side ?? 0) else { return nil }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(dok.navn.replacingOccurrences(of: "/", with: "-"))-annotert.pdf")
        let renderer = UIGraphicsPDFRenderer(
            bounds: forste.bounds(for: .mediaBox))
        do {
            try renderer.writePDF(to: url) { ctx in
                for objekt in sideObjekter {
                    guard let side = pdf.page(at: objekt.side ?? 0) else { continue }
                    let sr = side.bounds(for: .mediaBox)
                    ctx.beginPage(withBounds: CGRect(origin: .zero, size: sr.size),
                                  pageInfo: [:])
                    let cg = ctx.cgContext
                    // PDF-koordinater har origo nede til venstre → flipp.
                    cg.saveGState()
                    cg.translateBy(x: 0, y: sr.height)
                    cg.scaleBy(x: 1, y: -1)
                    side.draw(with: .mediaBox, to: cg)
                    cg.restoreGState()
                    // Blekket over akkurat denne siden på flata.
                    let visningBredde = 1520 * objekt.skala
                    let visningHoyde = sr.height / max(sr.width, 1) * visningBredde
                    let flateRect = CGRect(x: objekt.x - visningBredde / 2,
                                           y: objekt.y - visningHoyde / 2,
                                           width: visningBredde,
                                           height: visningHoyde)
                    if !drawing.strokes.isEmpty,
                       drawing.bounds.intersects(flateRect) {
                        // Strøkene er lagret i lys-referanse → riktig på hvitt.
                        let blekk = drawing.image(from: flateRect, scale: 2)
                        blekk.draw(in: CGRect(origin: .zero, size: sr.size))
                    }
                    // Alle overlays over denne siden følger med i eksporten:
                    // stempler, tekstbokser og figurer.
                    let skalering = sr.width / max(visningBredde, 1)
                    func tilSide(_ p: CGPoint) -> CGPoint {
                        CGPoint(x: (p.x - flateRect.minX) * skalering,
                                y: (p.y - flateRect.minY) * skalering)
                    }
                    for st in stempler
                    where flateRect.contains(CGPoint(x: st.x, y: st.y)) {
                        let p = tilSide(CGPoint(x: st.x, y: st.y))
                        let str = 24 * skalering / max(objekt.skala, 0.01) * 0.5
                        (st.tegn as NSString).draw(
                            at: CGPoint(x: p.x - str / 2, y: p.y - str / 2),
                            withAttributes: [.font: UIFont.systemFont(ofSize: str)])
                    }
                    for tb in tekstbokser
                    where flateRect.contains(CGPoint(x: tb.x, y: tb.y))
                        && !tb.tekst.isEmpty {
                        let p = tilSide(CGPoint(x: tb.x, y: tb.y))
                        (tb.tekst as NSString).draw(
                            in: CGRect(x: p.x - 90 * skalering, y: p.y - 10 * skalering,
                                       width: 220 * skalering, height: 120 * skalering),
                            withAttributes: [
                                .font: UIFont.boldSystemFont(ofSize: 12 * skalering / max(objekt.skala, 0.01) * 0.5),
                                .foregroundColor: UIColor(red: 0.1, green: 0.1, blue: 0.35, alpha: 1)])
                    }
                    for fig in figurer
                    where flateRect.contains(CGPoint(x: fig.x, y: fig.y)) {
                        guard let form = CanvasForm.allCases
                            .first(where: { $0.nokkel == fig.form }) else { continue }
                        let b = (fig.bredde ?? 200) * fig.skala * skalering
                        let h = (fig.hoyde ?? 160) * fig.skala * skalering
                        let sentrum = tilSide(CGPoint(x: fig.x, y: fig.y))
                        let rekt = CGRect(x: -b / 2, y: -h / 2, width: b, height: h)
                        cg.saveGState()
                        cg.translateBy(x: sentrum.x, y: sentrum.y)
                        cg.rotate(by: fig.rotasjon * .pi / 180)
                        cg.addPath(FigurShape(form: form).path(in: rekt).cgPath)
                        cg.setStrokeColor(UIColor(hex: fig.fargeHex).cgColor)
                        cg.setLineWidth(max(2, 3 * skalering))
                        cg.strokePath()
                        cg.restoreGState()
                    }
                }
            }
            return url
        } catch { return nil }
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
    private func byggSokbarTekst(for notat: CanvasNotat) async -> String {
        var deler: [String] = []
        deler.append(contentsOf: notat.tekstbokser.map(\.tekst))
        deler.append(contentsOf: notat.noder.map(\.tekst))
        deler.append(contentsOf: notat.objekter.compactMap(\.tittel))
        deler.append(contentsOf: notat.objekter.compactMap(\.detalj))
        let snapshotDrawing = try? PKDrawing(data: notat.drawingData)
        if let snapshotDrawing, !snapshotDrawing.bounds.isEmpty,
           let cg = snapshotDrawing
            .image(from: snapshotDrawing.bounds, scale: 1.5).cgImage {
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
        guard let data = try? Data(contentsOf: url) else { return }
        importerPDFData(data, navn: url.deletingPathExtension().lastPathComponent)
    }

    /// Ekte PDF-håndtering: originaldokumentet lagres tapsfritt, sidene
    /// rendres vektor-skarpt via PDFKit — aldri som bilder.
    ///
    /// `internal` (ikke `private`) med vilje: dette er handoff-punktet for
    /// «Åpne i Canvas» fra andre faner (f.eks. Leadbook Innsikt-rapport) —
    /// caller må selv navigere til `Destination.canvas` (entitlement-gatet,
    /// egen NavigationStack) FØR denne kalles; se FullInsiktReportSheet.
    func importerPDFData(_ data: Data, navn: String) {
        guard let dok = PDFDocument(data: data) else { return }
        guard data.count <= 10_000_000 else {
            feilVedImport = "PDF-en er over 10 MB — komprimer den og prøv igjen."
            return
        }
        let antall = min(dok.pageCount, 20)
        let dokument = CanvasDokument(navn: navn, base64: data.base64EncodedString())
        dokumenter.append(dokument)
        Self.dokumentByteCache[dokument.id] = dokument.base64
        var y: Double = 60
        var fullTekst = ""
        for i in 0..<antall {
            guard let side = dok.page(at: i) else { continue }
            let ramme = side.bounds(for: .mediaBox)
            let bredde: CGFloat = 760
            let hoyde = ramme.height / max(ramme.width, 1) * bredde
            y += Double(hoyde) / 2
            objekter.append(CanvasObjekt(
                type: "pdf", x: 430, y: y, skala: 0.5,
                tittel: antall > 1 ? "\(navn) · s. \(i + 1)" : navn,
                detalj: String((side.string ?? "").prefix(2000)),
                dokId: dokument.id, side: i))
            fullTekst += (side.string ?? "") + "\n"
            y += Double(hoyde) / 2 + 40
        }
        // AI leser dokumentet med en gang: viktig oppsummering + punkter
        // du kan sende rett til møtesløyfa — annotér videre imens. Finnes
        // en tidligere versjon i samme kundemappe, sammenlignes de.
        let renTekst = fullTekst.trimmingCharacters(in: .whitespacesAndNewlines)
        if kan(.canvasAnalyse), renTekst.count > 40 {
            let nyTekst = String(renTekst.prefix(12_000))
            let dokId = dokument.id
            let noteID = valgtId
            let generation = editorGeneration
            Task { @MainActor in
                let forrige = await forrigeDokumentTekst(unntattDokId: dokId)
                guard valgtId == noteID, editorGeneration == generation else { return }
                if let forrige {
                    pdfAnalyseTekst = "NY VERSJON:\n" + nyTekst
                        + "\n\nFORRIGE VERSJON («\(forrige.navn)») — sammenlign "
                        + "versjonene og fremhev endringer i pris, frister og "
                        + "forbehold først i oppsummeringen:\n" + forrige.tekst
                    pdfAnalyseSammenlign = forrige.navn
                } else {
                    pdfAnalyseTekst = nyTekst
                    pdfAnalyseSammenlign = nil
                }
                pdfAnalyseNavn = navn
                pdfAnalyseKontekst = gjeldendeEditorKontekst()
                // QA-moduser 2-4 verifiserer andre flater — hold arket lukket.
                let qa = ProcessInfo.processInfo.environment["QA_PDF"] ?? ""
                visPdfAnalyse = !["2", "3", "4"].contains(qa)
            }
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
        let noteID = valgtId
        let generation = editorGeneration
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
                    guard valgtId == noteID,
                          editorGeneration == generation else { return }
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
    private func startKartUtsnitt() {
        guard let noteID = valgtId else { return }
        let generation = editorGeneration
        let latitude = notatLat ?? 59.913
        let longitude = notatLon ?? 10.753
        let selskap = kobletSelskap
        Task { @MainActor in
            await settInnKartUtsnitt(
                noteID: noteID,
                generation: generation,
                latitude: latitude,
                longitude: longitude,
                selskap: selskap)
        }
    }

    @MainActor
    private func settInnKartUtsnitt(noteID: String, generation: UUID,
                                    latitude: Double, longitude: Double,
                                    selskap: String?) async {
        guard valgtId == noteID, editorGeneration == generation else { return }
        let senter = CLLocationCoordinate2D(
            latitude: latitude, longitude: longitude)
        let opts = MKMapSnapshotter.Options()
        opts.region = MKCoordinateRegion(
            center: senter,
            span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.03))
        opts.size = CGSize(width: 440, height: 280)
        opts.traitCollection = UITraitCollection(userInterfaceStyle: .dark)
        guard let snap = try? await MKMapSnapshotter(options: opts).start(),
              let jpeg = snap.image.jpegData(compressionQuality: 0.75) else { return }
        guard valgtId == noteID, editorGeneration == generation else { return }
        objekter.append(CanvasObjekt(
            type: "kart", x: 430, y: 300,
            bildeBase64: jpeg.base64EncodedString(),
            tittel: selskap))
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
                        .disabled(!kanRedigereValgtNotat)
                        .onChange(of: tittel) { _, _ in markerUlagret() }
                    Spacer()
                    // Fase 3: håndskrift → tekst → AI (oppgaver + møtelogg).
                    if kan(.canvasAnalyse) {
                    Button {
                        guard kanRedigereValgtNotat else { return }
                        analyseKontekst = gjeldendeEditorKontekst()
                        visAnalyse = true
                    } label: {
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
                    .disabled(!kanRedigereValgtNotat)
                    }
                    Button { Task { await lagre() } } label: {
                        HStack(spacing: 6) {
                            if valgtSaveStatus.isBusy {
                                ProgressView().controlSize(.small).tint(.white)
                            } else {
                                Image(systemName: saveKnappPresentasjon.ikon)
                                    .font(.appScaled(size: 12, weight: .bold))
                            }
                            Text(saveKnappPresentasjon.tekst)
                                .font(.appScaled(size: 13, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .frame(minHeight: 44)
                        .background(saveKnappPresentasjon.farge,
                                    in: RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                    .disabled(!kanRedigereValgtNotat
                              || valgtSaveStatus.isBusy
                              || valgtSaveStatus == .conflict)
                    .accessibilityLabel(saveKnappPresentasjon.tekst)
                    .accessibilityHint("Lagrer bare det åpne notatet")
                }
                if !kanRedigereValgtNotat {
                    HStack(spacing: 6) {
                        Image(systemName: "eye.fill")
                            .font(.appScaled(size: 10, weight: .bold))
                        Text(skrivebeskyttetForklaring)
                            .font(.appScaled(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(CvBrand.blue)
                }
                switch valgtSaveStatus {
                case .failed(let melding):
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.circle.fill")
                        Text(melding).lineLimit(2)
                        Spacer(minLength: 8)
                        Button("Prøv igjen") { Task { await lagre() } }
                            .buttonStyle(.bordered)
                            .frame(minHeight: 44)
                    }
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(CvBrand.red)
                    .accessibilityElement(children: .contain)
                case .conflict:
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle.fill")
                        Text("En nyere versjon finnes på serveren. Lokale endringer er beholdt.")
                        Spacer(minLength: 8)
                        Button("Last inn serverversjon") {
                            startLastInnValgtFraServer()
                        }
                        .buttonStyle(.bordered)
                        .frame(minHeight: 44)
                    }
                    .font(.appScaled(size: 11, weight: .semibold))
                    .foregroundStyle(CvBrand.orange)
                default:
                    EmptyView()
                }
                HStack(spacing: 8) {
                    // Del med teamet (kun egne notater, RBAC-gated)
                    if kanRedigereValgtNotat && kan(.canvasDeling) {
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
                    .disabled(!kanRedigereValgtNotat)
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
                    // Dokumentene i notatet: leser-modus, sidehopp og send.
                    if !dokumenter.isEmpty {
                        Menu {
                            ForEach(dokumenter) { dok in
                                Menu(dok.navn) {
                                    Button {
                                        lesDokument = dok
                                    } label: {
                                        Label("Åpne i leser (søk + zoom)",
                                              systemImage: "book")
                                    }
                                    if let epost = kontaktEpost {
                                        Button {
                                            sendKontekst = gjeldendeEditorKontekst()
                                            sendDokument = dok
                                        } label: {
                                            Label("Send til \(epost)",
                                                  systemImage: "paperplane")
                                        }
                                    }
                                    let sideObjs = objekter
                                        .filter { $0.dokId == dok.id }
                                        .sorted { ($0.side ?? 0) < ($1.side ?? 0) }
                                    if sideObjs.count > 1 {
                                        Divider()
                                        ForEach(sideObjs, id: \.id) { o in
                                            Button("Gå til side \((o.side ?? 0) + 1)") {
                                                sokTreff = [CGPoint(x: o.x, y: o.y)]
                                                sokTreffIndeks = 0
                                            }
                                        }
                                    }
                                }
                            }
                        } label: {
                            Image(systemName: "doc.text")
                                .font(.appScaled(size: 13, weight: .bold))
                                .foregroundStyle(CvBrand.purpleLight)
                                .frame(width: 44, height: 44)
                                .background(CvBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                        }
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
                            // Ekte PDF-eksport: original vektor-kvalitet
                            // (søkbar tekst) med annoteringene oppå.
                            ForEach(dokumenter) { dok in
                                if let url = eksporterDokument(dok) {
                                    ShareLink(item: url) {
                                        Label("Del «\(dok.navn)» (annotert PDF)",
                                              systemImage: "doc.badge.arrow.up")
                                    }
                                }
                            }
                        } label: {
                            Image(systemName: "square.and.arrow.up")
                                .font(.appScaled(size: 13, weight: .bold))
                                .foregroundStyle(CvBrand.textSecondary)
                                .frame(width: 44, height: 44)
                                .background(CvBrand.cardHi, in: RoundedRectangle(cornerRadius: 8))
                        }
                    }
                    leadKobling
                        .disabled(!kanRedigereValgtNotat)
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
        let visningstittel = notat.tittel.isEmpty ? "Uten tittel" : notat.tittel
        return HStack(spacing: 2) {
            Button {
                if !aktiv, let n = notater.first(where: { $0.id == fid }) {
                    velg(n)
                }
            } label: {
                HStack(spacing: 6) {
                    Circle()
                        .fill(notat.kategori.farge)
                        .frame(width: 7, height: 7)
                    Text(visningstittel)
                        .font(.appScaled(size: 11, weight: aktiv ? .bold : .semibold))
                        .foregroundStyle(aktiv ? Color.white : CvBrand.textSecondary)
                        .lineLimit(1)
                }
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Åpne \(visningstittel)")
            .accessibilityValue(aktiv ? "Valgt" : "")
            .accessibilityAddTraits(aktiv ? .isSelected : [])
            Button {
                let lukkerAktivtNotat = valgtId == fid
                if lukkerAktivtNotat {
                    _ = leggGjeldendeLagringIKo(stille: true)
                }
                aapneFaner.removeAll { $0 == fid }
                if lukkerAktivtNotat {
                    if let neste = aapneFaner.last,
                       let n = notater.first(where: { $0.id == neste }) {
                        hydrate(n)
                    } else {
                        valgtId = nil
                        realtime.koblFra()
                    }
                }
            } label: {
                Image(systemName: "xmark")
                    .font(.appScaled(size: 8, weight: .bold))
                    .foregroundStyle(CvBrand.textTertiary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Lukk \(visningstittel)")
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
        .accessibilityElement(children: .contain)
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

    // MARK: Spatial Sales Memory (kundeminnet — hele forholdet på ett lerret)

    /// ETT org-delt lerret per kunde: første notat, befarings-bilder,
    /// tilbud, AI-oppsummeringer, kontrakter — alt der brukeren la det.
    private func aapneKundeminne(selskap: String, leadId: String?) {
        if let minne = notater.first(where: {
            $0.tittel.hasPrefix("Kundeminne")
                && ($0.selskap ?? "").caseInsensitiveCompare(selskap) == .orderedSame
        }) {
            velg(minne)
            return
        }
        nyttNotat(type: .lead)
        tittel = "Kundeminne — \(selskap)"
        kobletSelskap = selskap
        kobletLeadId = leadId
        deltMedTeam = true   // minnet tilhører hele teamet
        papir = .blank
        Task { await lagre(stille: true) }
    }

    /// Nederste kant av alt innhold — nye minner limes under.
    private func innholdMaxY() -> Double {
        var maks: Double = 120
        if !drawing.bounds.isEmpty { maks = max(maks, drawing.bounds.maxY) }
        maks = max(maks, tekstbokser.map(\.y).max() ?? 0)
        maks = max(maks, noder.map(\.y).max() ?? 0)
        maks = max(maks, objekter.map(\.y).max() ?? 0)
        maks = max(maks, figurer.map(\.y).max() ?? 0)
        return maks
    }

    /// «Fest i kundeminnet»: datert AI-oppsummering + oppgaver limes inn
    /// som tekstbokser under eksisterende innhold — minnet vokser
    /// kronologisk nedover, år for år.
    private func festIMinne(_ resultat: CanvasAnalyseDTO,
                            selskap: String, leadId: String?) {
        aapneKundeminne(selskap: selskap, leadId: leadId)
        let df = DateFormatter()
        df.locale = Locale(identifier: "nb_NO")
        df.dateFormat = "d. MMM yyyy"
        var y = innholdMaxY() + 90
        tekstbokser.append(CanvasTekstboks(
            tekst: "📌 \(df.string(from: Date())) — \(String(resultat.oppsummering.prefix(220)))",
            x: 430, y: y))
        for oppgave in (resultat.oppgaver ?? []).prefix(4) {
            y += 52
            tekstbokser.append(CanvasTekstboks(
                tekst: "☐ \(oppgave.tittel)"
                    + (oppgave.frist.map { " (\($0))" } ?? ""),
                x: 430, y: y))
        }
        sider = min(20, max(sider, Int(ceil((y + 200) / 900))))
        Task { await lagre(stille: true) }
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
    private func startCanvasSok() {
        let query = editorSok.trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty, let noteID = valgtId else { return }
        let generation = editorGeneration
        Task { @MainActor in
            await finnTreffIEditor(
                query: query, noteID: noteID, generation: generation)
        }
    }

    @MainActor
    private func finnTreffIEditor(query q: String, noteID: String,
                                  generation: UUID) async {
        guard valgtId == noteID, editorGeneration == generation else { return }
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
        guard valgtId == noteID, editorGeneration == generation else { return }
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

    private var editorToppMedTegneobservasjon: some View {
        editorTopp
            .task {
                // Multi-penn: kollegaens strøk legges rett i tegningen.
                realtime.onNyeStrok = { delta, _, noteID in
                    guard valgtId == noteID else { return }
                    realtime.registrerMottatte(antall: delta.strokes.count)
                    var nyTegning = drawing
                    nyTegning.append(delta)
                    drawing = nyTegning
                }
            }
            .onChange(of: drawing.strokes.count) { _, _ in
                handterTegningEndret()
            }
            .onChange(of: drawing.strokes.count) { gammelt, nytt in
                planleggMarkeringsforslag(fra: gammelt, til: nytt)
            }
            .onChange(of: drawing.strokes.count) {
                planleggAutoTittel()
            }
    }

    private var editorSokRad: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.appScaled(size: 11))
                .foregroundStyle(CvBrand.textTertiary)
            TextField("Søk i notatet — også håndskrift …", text: $editorSok)
                .font(.appScaled(size: 12))
                .foregroundStyle(.white)
                .textFieldStyle(.plain)
                .onSubmit { startCanvasSok() }
            if !sokTreff.isEmpty {
                Text("\(sokTreffIndeks + 1)/\(sokTreff.count)")
                    .font(.appScaled(size: 10, weight: .bold))
                    .foregroundStyle(CvBrand.purpleLight)
                Button {
                    sokTreffIndeks = (sokTreffIndeks + 1) % sokTreff.count
                } label: {
                    Image(systemName: "chevron.down.circle.fill")
                        .font(.appScaled(size: 14))
                        .frame(width: 44, height: 44)
                        .foregroundStyle(CvBrand.purpleLight)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Neste søkeresultat")
            }
            Button { startCanvasSok() } label: {
                Text("Finn")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(minWidth: 44, minHeight: 44)
                    .padding(.horizontal, 6)
                    .background(CvBrand.purple, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12).padding(.vertical, 2)
        .background(CvBrand.card.opacity(0.8))
    }

    private var canvasArbeidsflate: some View {
        GeometryReader { canvasGeo in
            ScrollViewReader { scrollProxy in
                ScrollView([.horizontal, .vertical], showsIndicators: true) {
                    canvasDokumentLag
                        .allowsHitTesting(verktoyModus != .panorer)
                        .frame(
                            width: Self.logiskSidebredde,
                            height: Self.logiskSidehoyde * CGFloat(sider),
                            alignment: .topLeading)
                        .scaleEffect(effektivDokumentZoom, anchor: .topLeading)
                        .frame(
                            width: Self.logiskSidebredde * effektivDokumentZoom,
                            height: Self.logiskSidehoyde * CGFloat(sider)
                                * effektivDokumentZoom,
                            alignment: .topLeading)
                        .dropDestination(for: Data.self, action: handterBildeDrop)
                }
                .scrollDisabled(verktoyModus != .panorer)
                .simultaneousGesture(dokumentZoomGesture)
                .onChange(of: sokTreffIndeks) { _, _ in
                    scrollTilAktivtSokTreff(scrollProxy)
                }
                .onChange(of: sokTreff) { _, nyeTreff in
                    guard !nyeTreff.isEmpty else { return }
                    scrollTilAktivtSokTreff(scrollProxy)
                }
                .onAppear { canvasViewportWidth = canvasGeo.size.width }
                .onChange(of: canvasGeo.size.width) { _, nyBredde in
                    canvasViewportWidth = nyBredde
                }
            }
        }
    }

    private var canvasDokumentLag: some View {
        ZStack(alignment: .topLeading) {
            CvBrand.bg
            if let forslag = markeringForslag {
                markeringsKort(forslag)
                    .position(forslag.punkt)
                    .zIndex(60)
            }
            if sokTreffIndeks < sokTreff.count {
                Circle()
                    .stroke(CvBrand.yellow, lineWidth: 3)
                    .frame(width: 90, height: 90)
                    .position(sokTreff[sokTreffIndeks])
                    .id("sokTreffAnker")
                    .allowsHitTesting(false)
                    .shadow(color: CvBrand.yellow.opacity(0.7), radius: 10)
            }
            VStack(spacing: 0) {
                ForEach(0..<sider, id: \.self) { _ in
                    PapirView(papir: papir)
                        .frame(width: Self.logiskSidebredde,
                               height: Self.logiskSidehoyde)
                }
            }
            canvasObjektLag
            canvasTankekartKoblinger
            canvasPencilLag
            canvasStempelLag
            canvasFigurLag
            canvasNodeLag
            canvasTekstLag
        }
    }

    private func handterBildeDrop(_ biter: [Data], _ plassering: CGPoint) -> Bool {
        guard kanRedigereValgtNotat,
              kan(.canvasBilder),
              let data = biter.first,
              UIImage(data: data) != nil else { return false }
        leggTilBilde(data, ved: CGPoint(
            x: plassering.x / effektivDokumentZoom,
            y: plassering.y / effektivDokumentZoom))
        return true
    }

    private func scrollTilAktivtSokTreff(_ scrollProxy: ScrollViewProxy) {
        withAnimation(.easeInOut(duration: 0.4)) {
            scrollProxy.scrollTo("sokTreffAnker", anchor: .center)
        }
    }

    private func handterTegningEndret() {
        markerUlagret()
        realtime.sendNyeStrok(fra: drawing)
    }

    private func planleggMarkeringsforslag(fra gammeltAntall: Int,
                                           til nyttAntall: Int) {
        // Tusj-strøk over en PDF-side foreslås som møtepunkt.
        guard nyttAntall > gammeltAntall,
              pennValg == .marker,
              kanRedigereValgtNotat,
              let sisteStrok = drawing.strokes.last else { return }
        let boks = sisteStrok.renderBounds
        let noteID = valgtId
        let generation = editorGeneration
        markeringsTask?.cancel()
        markeringsTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 700_000_000)
            guard !Task.isCancelled,
                  valgtId == noteID,
                  editorGeneration == generation else { return }
            foreslaaMarkering(boks: boks)
        }
    }

    private func planleggAutoTittel() {
        // Tittelen skriver seg selv etter siste strøk, men resultatet er
        // bundet til editor-generasjonen som startet analysen.
        guard kanRedigereValgtNotat,
              tittel.trimmingCharacters(in: .whitespaces).isEmpty,
              let noteID = valgtId else { return }
        let generation = editorGeneration
        let drawingSnapshot = drawing
        autoTittelTask?.cancel()
        autoTittelTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            guard !Task.isCancelled else { return }
            await foreslaTittelFraBlekk(
                noteID: noteID,
                generation: generation,
                drawing: drawingSnapshot)
        }
    }

    @ViewBuilder private var canvasObjektLag: some View {
        ForEach(objekter.filter { !erLagSkjult($0.type) }) { objekt in
            ObjektView(
                objekt: objekt,
                redigerbar: kanRedigereValgtNotat && objektModus,
                pdfDok: dokument(for: objekt),
                liveInnhold: liveInnhold(objekt),
                erValgt: valgte.contains(objekt.id),
                onToggleValg: { toggleValgtObjekt(objekt.id) },
                onFlyttFelles: flyttValgte,
                onEndre: { oppdaterObjekt($0, id: objekt.id) },
                onSlett: { slettObjekt(objekt.id) })
        }
    }

    @ViewBuilder private var canvasTankekartKoblinger: some View {
        if !noder.isEmpty && !skjulteLag.contains(CanvasLag.noder.rawValue) {
            NodeKoblinger(noder: noder)
        }
    }

    private var canvasPencilLag: some View {
        LeadgridPencilCanvas(
            drawing: $drawing,
            pennValg: $pennValg,
            noteID: valgtId,
            redigerbar: kanRedigereValgtNotat
                && !objektModus && verktoyModus != .panorer,
            inputMode: canvasInputMode,
            toolSelectionRevision: pennSelectionRevision,
            onFormGjenkjent: { figurer.append($0) })
    }

    @ViewBuilder private var canvasStempelLag: some View {
        let synligeStempler = skjulteLag.contains(CanvasLag.stempler.rawValue)
            ? [] : stempler
        ForEach(synligeStempler) { stempel in
            StempelView(
                stempel: stempel,
                redigerbar: kanRedigereValgtNotat,
                onFlytt: { oppdaterStempel($0, id: stempel.id) },
                onSlett: { stempler.removeAll { $0.id == stempel.id } })
        }
    }

    @ViewBuilder private var canvasFigurLag: some View {
        let synligeFigurer = skjulteLag.contains(CanvasLag.former.rawValue)
            ? [] : figurer
        ForEach(synligeFigurer) { figur in
            FigurView(
                figur: figur,
                redigerbar: kanRedigereValgtNotat,
                onEndre: { oppdaterFigur($0, id: figur.id) },
                onSlett: { figurer.removeAll { $0.id == figur.id } })
        }
    }

    @ViewBuilder private var canvasNodeLag: some View {
        let synligeNoder = skjulteLag.contains(CanvasLag.noder.rawValue) ? [] : noder
        ForEach(synligeNoder) { node in
            NodeView(
                node: node,
                redigerbar: kanRedigereValgtNotat,
                onEndre: { oppdaterNode($0, id: node.id) },
                onNyttBarn: { leggTilBarnNode(til: node) },
                onRediger: { redigererNode = node },
                onSlett: { slettNode(node.id) })
        }
    }

    @ViewBuilder private var canvasTekstLag: some View {
        let synligeTekstbokser = skjulteLag.contains(CanvasLag.tekst.rawValue)
            ? [] : tekstbokser
        ForEach(synligeTekstbokser) { tekstboks in
            TekstboksView(
                boks: tekstboks,
                redigerbar: kanRedigereValgtNotat,
                onFlytt: { oppdaterTekstboks($0, id: tekstboks.id) },
                onRediger: { redigererTekstboks = tekstboks },
                onSlett: { tekstbokser.removeAll { $0.id == tekstboks.id } })
        }
    }

    private var dokumentZoomGesture: some Gesture {
        MagnifyGesture()
            .updating($pinchZoom) { verdi, tilstand, _ in
                guard verktoyModus == .panorer else { return }
                tilstand = verdi.magnification
            }
            .onEnded { verdi in
                guard verktoyModus == .panorer else { return }
                let nyZoom = dokumentZoom * verdi.magnification
                dokumentZoom = min(
                    2.5,
                    max(Self.minimumDokumentZoom, nyZoom))
            }
    }

    private func dokument(for objekt: CanvasObjekt) -> CanvasDokument? {
        guard let dokumentID = objekt.dokId else { return nil }
        return dokumenter.first { $0.id == dokumentID }
    }

    private func toggleValgtObjekt(_ id: String) {
        if valgte.contains(id) {
            valgte.remove(id)
        } else {
            valgte.insert(id)
        }
    }

    private func oppdaterObjekt(_ nyttObjekt: CanvasObjekt, id: String) {
        guard let indeks = objekter.firstIndex(where: { $0.id == id }) else { return }
        objekter[indeks] = nyttObjekt
    }

    private func oppdaterStempel(_ nyttStempel: CanvasStempel, id: String) {
        guard let indeks = stempler.firstIndex(where: { $0.id == id }) else { return }
        stempler[indeks] = nyttStempel
    }

    private func oppdaterFigur(_ nyFigur: CanvasFigur, id: String) {
        guard let indeks = figurer.firstIndex(where: { $0.id == id }) else { return }
        figurer[indeks] = nyFigur
    }

    private func oppdaterNode(_ nyNode: CanvasNode, id: String) {
        guard let indeks = noder.firstIndex(where: { $0.id == id }) else { return }
        noder[indeks] = nyNode
    }

    private func leggTilBarnNode(til node: CanvasNode) {
        let barn = CanvasNode(
            parentId: node.id,
            tekst: "",
            x: node.x + Double.random(in: 120...190),
            y: node.y + Double.random(in: -80...110))
        noder.append(barn)
        redigererNode = barn
    }

    private func slettNode(_ id: String) {
        // Barn beholdes som frittstående lapper.
        for indeks in noder.indices where noder[indeks].parentId == id {
            noder[indeks].parentId = nil
        }
        noder.removeAll { $0.id == id }
    }

    private func oppdaterTekstboks(_ nyTekstboks: CanvasTekstboks, id: String) {
        guard let indeks = tekstbokser.firstIndex(where: { $0.id == id }) else { return }
        tekstbokser[indeks] = nyTekstboks
    }

    private func slettObjekt(_ id: String) {
        objekter.removeAll { $0.id == id }
        valgte.remove(id)
    }

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
        el.erMin = true
        bibliotek.append(el)
        if bibliotek.count > 30 { bibliotek.removeFirst() }
        BibliotekElement.lagreAlle(bibliotek)
        // Synk til org-biblioteket (privat til man deler det).
        if !isDemo, let api = appState.api {
            let kopi = el
            Task { try? await api.lagreCanvasBibliotekElement(
                id: kopi.id, navn: kopi.navn,
                innhold: kopi.innholdJSON, delt: false) }
        }
    }

    /// Del/av-del et av mine elementer med hele teamet.
    private func settElementDeling(_ el: BibliotekElement, delt: Bool) {
        guard let i = bibliotek.firstIndex(where: { $0.id == el.id }) else { return }
        bibliotek[i].delt = delt
        BibliotekElement.lagreAlle(bibliotek)
        guard !isDemo, let api = appState.api else { return }
        let kopi = bibliotek[i]
        Task { try? await api.lagreCanvasBibliotekElement(
            id: kopi.id, navn: kopi.navn,
            innhold: kopi.innholdJSON, delt: delt) }
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
