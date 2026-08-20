// AnbudView.swift — Anbud (Doffin) tilleggstjeneste (2026-08-02)
//
// Søk i Doffin (Database for offentlige anskaffelser) rett fra Leadgrid:
// fritekst + fylke (NUTS, empirisk verifisert 2024-koder) + status, med
// lagrede overvåkninger per org. Oppdragsgivere kommer med orgnr —
// «Kopier oppdragsgiver» legger navn + orgnr på utklippstavlen for
// lead-registrering (full CRM-kobling = fase 2).
//
// Gated på LeadgridFeature.leadgridAnbud (server-håndhevet i tillegg).

import SwiftUI
import UIKit
import MapKit

struct AnbudView: View {
    var embedded: Bool = false
    @Environment(AppState.self) private var appState

    @State private var searchText = ""
    @State private var selectedFylke: Fylke? = nil
    @State private var selectedBransje: Bransje? = nil
    /// CPV-organisering: søk med KUNDENES koder (auto-satt per bedrift).
    @State private var brukKundeCpv = false
    /// 2026-08-19: forhånds-utfylt CPV fra broad-NACE discovery-fallback
    /// (leadgrid-project-lead-discovery-routes.ts → suggest_anbud_cpv) —
    /// selgere uten søkbar Places-kundetype (kontorrekvisita, engros,
    /// renhold osv.) rutes hit i stedet for et tomt kart-søk.
    @State private var externalCpv: [String]

    init(embedded: Bool = false, initialCpvOverride: [String] = []) {
        self.embedded = embedded
        self._externalCpv = State(initialValue: initialCpvOverride)
    }
    @State private var status: String = "ACTIVE"
    @State private var results: [DoffinKunngjoringDTO] = []
    @State private var total = 0
    @State private var isLoading = false
    @State private var errorText: String?
    @State private var watches: [DoffinWatchDTO] = []
    @State private var showWatches = false
    @State private var copiedToastId: String?
    // «Opprett lead» (fase 2, 2026-08-02): kunngjøring → ekte CRM-lead
    // via from-card-løypa (BRREG-kobling på org.nr + full berikelse).
    @State private var creatingLeadId: String?
    @State private var createdLeadIds: Set<String> = []
    @State private var leadErrorText: String?
    // Les gjennom (2026-08-03): tap på kort → fullt lese-ark. Alt innhold
    // ligger allerede i søkesvaret (Doffin v2 har ikke detalj-endepunkt).
    @State private var openKunngjoring: DoffinKunngjoringDTO?
    // Nivå 1 (2026-08-03): AI-prioritering + tildelings-innsikt.
    @State private var scores: [String: DoffinScoreDTO] = [:]
    @State private var isScoring = false
    @State private var scoreError: String?
    @State private var showTildelinger = false
    @State private var tildelinger: DoffinTildelingerDTO?
    @State private var tildelingerLaster = false
    // Nivå 2 (2026-08-03): anbuds-pipeline + AI-lesehjelp.
    @State private var showPipeline = false
    @State private var pipelineItems: [AnbudPipelineItemDTO] = []
    @State private var pipelineStats: AnbudPipelineStatsDTO?
    @State private var pipelineLaster = false
    @State private var iPipelineIds: Set<String> = []
    @State private var oppsummering: AnbudOppsummeringDTO?
    @State private var oppsummerer = false
    @State private var oppsummeringFeil: String?
    // Nivå 3 (2026-08-03): tapt-årsak-dialog (læringssløyfen).
    @State private var taptDialogItem: AnbudPipelineItemDTO?
    // Tilbuds-assistent (2026-08-04): AI-utkast i lese-arket.
    @State private var tilbudsutkast: AnbudTilbudsutkastDTO?
    @State private var lagerUtkast = false
    @State private var utkastFeil: String?

    /// NUTS 2024-koder verifisert empirisk mot Doffin (entydige kommunenavn
    /// per kode, 2026-08-02). NO082/NO091 utelatt — ingen entydige treff.
    enum Fylke: String, CaseIterable, Identifiable {
        case oslo = "NO081", ostfold = "NO083", akershus = "NO084"
        case buskerud = "NO085", innlandet = "NO020", agder = "NO092"
        case vestfold = "NO093", telemark = "NO094", rogaland = "NO0A1"
        case vestland = "NO0A2", moreRomsdal = "NO0A3", trondelag = "NO060"
        case nordland = "NO071", troms = "NO072", finnmark = "NO073"
        var id: String { rawValue }
        var navn: String {
            switch self {
            case .oslo: return "Oslo"
            case .ostfold: return "Østfold"
            case .akershus: return "Akershus"
            case .buskerud: return "Buskerud"
            case .innlandet: return "Innlandet"
            case .agder: return "Agder"
            case .vestfold: return "Vestfold"
            case .telemark: return "Telemark"
            case .rogaland: return "Rogaland"
            case .vestland: return "Vestland"
            case .moreRomsdal: return "Møre og Romsdal"
            case .trondelag: return "Trøndelag"
            case .nordland: return "Nordland"
            case .troms: return "Troms"
            case .finnmark: return "Finnmark"
            }
        }
    }

    /// CPV-forslag fra bransje (2026-08-03): selgeren kjenner bransjen sin,
    /// ikke CPV-systemet. Kuratert liste over vanlige feltsalg-bransjer →
    /// CPV-hovedgrupper (verifisert mot Doffins CPV-koder).
    enum Bransje: String, CaseIterable, Identifiable {
        case elektro, bygg, rorlegger, renhold, sikkerhet, it
        case transport, kantine, eiendomsdrift, maler
        var id: String { rawValue }
        var navn: String {
            switch self {
            case .elektro: return "Elektro"
            case .bygg: return "Bygg og anlegg"
            case .rorlegger: return "Rørlegger/VVS"
            case .renhold: return "Renhold"
            case .sikkerhet: return "Sikkerhet/vakt"
            case .it: return "IT-tjenester"
            case .transport: return "Transport"
            case .kantine: return "Kantine/catering"
            case .eiendomsdrift: return "Eiendomsdrift"
            case .maler: return "Maler/overflate"
            }
        }
        var cpv: String {
            switch self {
            case .elektro: return "45310000"
            case .bygg: return "45000000"
            case .rorlegger: return "45330000"
            case .renhold: return "90910000"
            case .sikkerhet: return "79710000"
            case .it: return "72000000"
            case .transport: return "60100000"
            case .kantine: return "55500000"
            case .eiendomsdrift: return "50700000"
            case .maler: return "45440000"
            }
        }
    }

    /// CPV-strengen søket bruker: kundenes koder (distinct, maks 6) i
    /// kunde-modus, ellers valgt bransje.
    private var effektivCpv: String? {
        if brukKundeCpv {
            var koder: [String] = []
            for lead in appState.leads {
                for k in lead.cpvKoder ?? [] where !koder.contains(k) {
                    koder.append(k)
                }
            }
            return koder.isEmpty ? nil : koder.prefix(6).joined(separator: ",")
        }
        if let b = selectedBransje { return b.cpv }
        if !externalCpv.isEmpty { return externalCpv.prefix(6).joined(separator: ",") }
        return nil
    }

    var body: some View {
        Group {
            if embedded {
                inner
            } else {
                NavigationStack { inner.toolbar(.hidden, for: .navigationBar) }
            }
        }
        .gated(.leadgridAnbud)   // tilleggstjeneste — låst uten entitlement
        .sheet(isPresented: $showWatches) { watchesSheet }
        .sheet(item: $openKunngjoring) { k in leseArk(k) }
        .sheet(isPresented: $showTildelinger) { tildelingerArk }
        .sheet(isPresented: $showPipeline) { pipelineArk }
    }

    private var inner: some View {
        ZStack {
            LBrand.bg.ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    header
                    searchCard
                    if let errorText {
                        errorBanner(errorText)
                    }
                    if let leadErrorText {
                        errorBanner(leadErrorText)
                    }
                    resultsList
                    Color.clear.frame(height: 80)
                }
                .padding(16)
            }
        }
        .task { await initialLoad() }
    }

    // MARK: Header

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Anbud").font(.appScaled(size: 26, weight: .heavy)).foregroundStyle(.white)
                Text("Offentlige anskaffelser fra Doffin — finn kontrakter før konkurrentene")
                    .font(.appScaled(size: 12)).foregroundStyle(LBrand.textSecondary)
            }
            Spacer()
            // Pipeline (nivå 2): anbudene gjennom salgsprosessen.
            Button {
                showPipeline = true
                Task { await lastPipeline() }
            } label: {
                Label(pipelineStats.map { "Pipeline (\($0.aapne))" } ?? "Pipeline",
                      systemImage: "chart.line.text.clipboard")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(LBrand.cardHi, in: Capsule())
            }.buttonStyle(.plain)
            // Tildelings-innsikt (nivå 1): hvem vinner hva i markedet ditt.
            Button {
                showTildelinger = true
                Task { await lastTildelinger() }
            } label: {
                Label("Tildelinger", systemImage: "chart.bar.fill")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(LBrand.cardHi, in: Capsule())
            }.buttonStyle(.plain)
            Button {
                showWatches = true
            } label: {
                Label("Overvåkninger (\(watches.count))", systemImage: "bell.badge.fill")
                    .font(.appScaled(size: 12, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(Color.indigo.opacity(0.35), in: Capsule())
            }.buttonStyle(.plain)
        }
    }

    // MARK: Søk

    private var searchCard: some View {
        VStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").foregroundStyle(LBrand.textTertiary)
                TextField("Søk (f.eks. elektriker, renhold, rammeavtale …)", text: $searchText)
                    .font(.appScaled(size: 14))
                    .foregroundStyle(.white)
                    .submitLabel(.search)
                    .onSubmit { Task { await search() } }
                if !searchText.isEmpty {
                    Button { searchText = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(LBrand.textTertiary)
                    }.buttonStyle(.plain)
                }
            }
            .padding(12)
            .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))

            if !externalCpv.isEmpty && selectedBransje == nil && !brukKundeCpv {
                HStack(spacing: 6) {
                    Image(systemName: "sparkles").font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
                    Text("Foreslått fra din bransje (NACE)").font(.appScaled(size: 11)).foregroundStyle(LBrand.textTertiary)
                    Spacer()
                    Button("Fjern") { externalCpv = []; Task { await search() } }
                        .font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(LBrand.textTertiary)
                }
            }

            HStack(spacing: 8) {
                Menu {
                    Button("Hele landet") { selectedFylke = nil; Task { await search() } }
                    ForEach(Fylke.allCases) { f in
                        Button(f.navn) { selectedFylke = f; Task { await search() } }
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "map.fill").font(.appScaled(size: 10))
                        Text(selectedFylke?.navn ?? "Hele landet")
                            .font(.appScaled(size: 12, weight: .semibold))
                        Image(systemName: "chevron.down").font(.appScaled(size: 9, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 11).padding(.vertical, 8)
                    .background(LBrand.cardHi, in: Capsule())
                }

                // CPV-forslag fra bransje (2026-08-03): selgeren velger
                // bransje, vi oversetter til CPV-hovedgruppe mot Doffin.
                Menu {
                    Button {
                        brukKundeCpv = true
                        selectedBransje = nil
                        Task { await search() }
                    } label: {
                        Label("Mine kunders CPV", systemImage: "person.2.crop.square.stack")
                    }
                    Divider()
                    Button("Alle bransjer") { brukKundeCpv = false; selectedBransje = nil; Task { await search() } }
                    ForEach(Bransje.allCases) { b in
                        Button(b.navn) { brukKundeCpv = false; selectedBransje = b; Task { await search() } }
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "wrench.and.screwdriver.fill").font(.appScaled(size: 10))
                        Text(brukKundeCpv ? "Mine kunders CPV"
                             : (selectedBransje?.navn ?? "Alle bransjer"))
                            .font(.appScaled(size: 12, weight: .semibold))
                        Image(systemName: "chevron.down").font(.appScaled(size: 9, weight: .bold))
                    }
                    .foregroundStyle(selectedBransje == nil ? .white : Color.indigo)
                    .padding(.horizontal, 11).padding(.vertical, 8)
                    .background(
                        selectedBransje == nil
                            ? AnyShapeStyle(LBrand.cardHi)
                            : AnyShapeStyle(Color.indigo.opacity(0.18)),
                        in: Capsule())
                }

                Picker("Status", selection: $status) {
                    Text("Aktive").tag("ACTIVE")
                    Text("Tildelte").tag("AWARDED")
                    Text("Utløpte").tag("EXPIRED")
                }
                .pickerStyle(.segmented)
                .onChange(of: status) { Task { await search() } }

                Button {
                    Task { await search() }
                } label: {
                    if isLoading {
                        ProgressView().controlSize(.small).tint(.white)
                            .padding(.horizontal, 16).padding(.vertical, 8)
                    } else {
                        Text("Søk").font(.appScaled(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 16).padding(.vertical, 8)
                    }
                }
                .buttonStyle(.plain)
                .background(
                    LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                   startPoint: .leading, endPoint: .trailing),
                    in: Capsule()
                )
                .disabled(isLoading)
            }
            if total > 0 {
                HStack {
                    Text("\(total) kunngjøringer").font(.appScaled(size: 11, weight: .semibold))
                        .foregroundStyle(LBrand.textSecondary)
                    if !scores.isEmpty {
                        Text("· AI-sortert")
                            .font(.appScaled(size: 10, weight: .bold))
                            .foregroundStyle(Color.indigo)
                    }
                    Spacer()
                    // AI-prioritering (nivå 1): scorer treffene mot org-ens
                    // overvåkninger og sorterer beste øverst.
                    if !results.isEmpty {
                        Button {
                            Task { await prioriterMedAI() }
                        } label: {
                            HStack(spacing: 4) {
                                if isScoring {
                                    ProgressView().tint(Color.indigo).scaleEffect(0.6)
                                } else {
                                    Image(systemName: "sparkles").font(.appScaled(size: 10, weight: .bold))
                                }
                                Text(isScoring ? "Prioriterer …" : "Prioriter med AI")
                                    .font(.appScaled(size: 11, weight: .bold))
                            }
                            .foregroundStyle(Color.indigo)
                        }
                        .buttonStyle(.plain)
                        .disabled(isScoring)
                    }
                    if !searchText.isEmpty || selectedFylke != nil {
                        Button {
                            Task { await saveCurrentAsWatch() }
                        } label: {
                            Label("Overvåk dette søket", systemImage: "plus.circle.fill")
                                .font(.appScaled(size: 11, weight: .bold))
                                .foregroundStyle(Color.indigo)
                        }.buttonStyle(.plain)
                    }
                }
                if let scoreError {
                    Text(scoreError)
                        .font(.appScaled(size: 10))
                        .foregroundStyle(LBrand.orange)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
    }

    // MARK: Resultater

    @ViewBuilder
    private var resultsList: some View {
        if results.isEmpty && !isLoading && errorText == nil {
            ContentUnavailableView(
                "Søk i offentlige anskaffelser",
                systemImage: "doc.text.magnifyingglass",
                description: Text("Fritekst + fylke — resultatene kommer rett fra Doffin.")
            )
            .padding(.vertical, 30)
        } else {
            ForEach(results) { k in
                anbudCard(k)
            }
        }
    }

    private func anbudCard(_ k: DoffinKunngjoringDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(k.tittel)
                        .font(.appScaled(size: 14, weight: .bold)).foregroundStyle(.white)
                        .lineLimit(2)
                    if let og = k.oppdragsgivere.first {
                        HStack(spacing: 5) {
                            Image(systemName: "building.columns.fill")
                                .font(.appScaled(size: 9)).foregroundStyle(Color.indigo)
                            Text(og.navn).font(.appScaled(size: 11, weight: .semibold))
                                .foregroundStyle(LBrand.textSecondary)
                            if !og.orgnr.isEmpty {
                                Text("· \(og.orgnr)").font(.appScaled(size: 10, design: .monospaced))
                                    .foregroundStyle(LBrand.textTertiary)
                            }
                        }
                    }
                }
                Spacer()
                if let v = k.verdi {
                    Text(formatNOK(v.belop))
                        .font(.appScaled(size: 12, weight: .heavy, design: .monospaced))
                        .foregroundStyle(LBrand.green)
                }
            }
            Text(k.beskrivelse)
                .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                .lineLimit(3)
            HStack(spacing: 8) {
                if let frist = k.frist {
                    fristChip(frist)
                }
                if !k.cpvKoder.isEmpty {
                    Text("CPV \(k.cpvKoder.prefix(2).joined(separator: ", "))")
                        .font(.appScaled(size: 9, design: .monospaced))
                        .foregroundStyle(LBrand.textTertiary)
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(LBrand.cardHi, in: Capsule())
                }
                // Kunde-match (nivå 1): sterkeste signalet vi har — grønn ⚡.
                if let km = k.kundeMatch {
                    HStack(spacing: 4) {
                        Image(systemName: "bolt.fill").font(.appScaled(size: 9))
                        Text(km.eier.map { "Kunde · \($0)" } ?? "Allerede kunde")
                            .font(.appScaled(size: 10, weight: .bold))
                    }
                    .foregroundStyle(LBrand.green)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(LBrand.green.opacity(0.14), in: Capsule())
                }
                // AI-prioritering: score vises kun etter at brukeren kjørte den.
                if let s = scores[k.id] {
                    Text("\(s.score)")
                        .font(.appScaled(size: 10, weight: .heavy, design: .monospaced))
                        .foregroundStyle(s.score >= 70 ? LBrand.green : (s.score >= 40 ? LBrand.yellow : LBrand.textTertiary))
                        .padding(.horizontal, 7).padding(.vertical, 3)
                        .background(LBrand.cardHi, in: Capsule())
                }
                Spacer()
                if k.oppdragsgivere.first != nil {
                    createLeadButton(k)
                }
                // Gullstandard (audit 2026-08-03): sekundærhandlinger bak ⋯
                // — «Opprett lead» skal stå helt alene som handling.
                secondaryMenu(k)
            }
        }
        .padding(13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        // Les gjennom (Daniel 2026-08-03): hele kortet åpner lese-arket
        // med full beskrivelse — knappene over fanger sine egne tap.
        .contentShape(RoundedRectangle(cornerRadius: 12))
        .onTapGesture {
            // Nullstill AI-tilstand fra forrige kunngjøring (2026-08-04).
            oppsummering = nil
            oppsummeringFeil = nil
            tilbudsutkast = nil
            utkastFeil = nil
            openKunngjoring = k
        }
    }

    private func createLeadButton(_ k: DoffinKunngjoringDTO) -> some View {
        Button {
            Task { await createLead(from: k) }
        } label: {
            HStack(spacing: 4) {
                if creatingLeadId == k.id {
                    ProgressView().tint(.white).scaleEffect(0.6)
                } else {
                    Image(systemName: createdLeadIds.contains(k.id)
                          ? "checkmark.circle.fill" : "person.crop.circle.badge.plus")
                        .font(.appScaled(size: 10, weight: .bold))
                }
                Text(createdLeadIds.contains(k.id) ? "Lead opprettet ✓" : "Opprett lead")
                    .font(.appScaled(size: 10, weight: .bold))
            }
            .foregroundStyle(createdLeadIds.contains(k.id) ? LBrand.green : .white)
            .padding(.horizontal, 9).padding(.vertical, 5)
            .background(
                createdLeadIds.contains(k.id)
                    ? AnyShapeStyle(LBrand.green.opacity(0.16))
                    : AnyShapeStyle(Color.indigo.opacity(0.85)),
                in: Capsule())
        }
        .buttonStyle(.plain)
        .disabled(creatingLeadId != nil || createdLeadIds.contains(k.id))
    }

    /// Kopier + Åpne i Doffin — dempet til én ⋯-meny (audit-grep 2).
    /// Ikonet blir grønn hake et øyeblikk etter kopiering.
    private func secondaryMenu(_ k: DoffinKunngjoringDTO) -> some View {
        Menu {
            // Nivå 2: inn i salgsprosessen.
            Button {
                Task { await leggIPipeline(k) }
            } label: {
                Label(iPipelineIds.contains(k.id) ? "I pipelinen ✓" : "Legg i pipeline",
                      systemImage: iPipelineIds.contains(k.id)
                        ? "checkmark.circle" : "chart.line.text.clipboard")
            }
            .disabled(iPipelineIds.contains(k.id))
            Button {
                copyOppdragsgiver(k)
            } label: {
                Label("Kopier oppdragsgiver", systemImage: "doc.on.doc")
            }
            if let url = URL(string: k.url) {
                Link(destination: url) {
                    Label("Åpne i Doffin", systemImage: "arrow.up.right.square")
                }
            }
        } label: {
            Image(systemName: copiedToastId == k.id ? "checkmark.circle.fill" : "ellipsis.circle")
                .font(.appScaled(size: 15, weight: .semibold))
                .foregroundStyle(copiedToastId == k.id ? LBrand.green : LBrand.textSecondary)
                .padding(6)
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
    }

    private func copyOppdragsgiver(_ k: DoffinKunngjoringDTO) {
        guard let og = k.oppdragsgivere.first else { return }
        UIPasteboard.general.string = "\(og.navn) — org.nr \(og.orgnr)\n\(k.tittel)\n\(k.url)"
        withAnimation { copiedToastId = k.id }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
            withAnimation { if copiedToastId == k.id { copiedToastId = nil } }
        }
    }

    // MARK: Lese-ark (2026-08-03) — «man skal også kunne lese gjennom»

    /// Full lesevisning av kunngjøringen: hele beskrivelsen + all metadata
    /// fra søkesvaret. Samme primær-CTA som kortet; dokumentene ligger hos
    /// Doffin (v2 har ikke detalj-endepunkt) — lenken er ærlig merket.
    private func leseArk(_ k: DoffinKunngjoringDTO) -> some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text(k.tittel)
                            .font(.appScaled(size: 20, weight: .heavy))
                            .foregroundStyle(.white)
                            .fixedSize(horizontal: false, vertical: true)
                        if let og = k.oppdragsgivere.first {
                            HStack(spacing: 8) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(Color.indigo.opacity(0.22))
                                    Image(systemName: "building.columns.fill")
                                        .font(.appScaled(size: 13, weight: .bold))
                                        .foregroundStyle(Color.indigo)
                                }
                                .frame(width: 34, height: 34)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(og.navn)
                                        .font(.appScaled(size: 13, weight: .bold))
                                        .foregroundStyle(.white)
                                    if !og.orgnr.isEmpty {
                                        Text("Org.nr \(og.orgnr)")
                                            .font(.appScaled(size: 11, design: .monospaced))
                                            .foregroundStyle(LBrand.textSecondary)
                                    }
                                }
                            }
                        }
                        // Kunde-match (nivå 1): relasjonen er gullet.
                        if let km = k.kundeMatch {
                            HStack(spacing: 8) {
                                Image(systemName: "bolt.fill")
                                    .font(.appScaled(size: 12, weight: .bold))
                                    .foregroundStyle(LBrand.green)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text("Allerede kunde i CRM-et")
                                        .font(.appScaled(size: 12, weight: .bold))
                                        .foregroundStyle(LBrand.green)
                                    Text([km.leadNavn,
                                          km.eier.map { "eies av \($0)" },
                                          km.leadStatus].compactMap { $0 }
                                            .joined(separator: " · "))
                                        .font(.appScaled(size: 11))
                                        .foregroundStyle(LBrand.textSecondary)
                                }
                                Spacer()
                            }
                            .padding(10)
                            .background(LBrand.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10)
                                .stroke(LBrand.green.opacity(0.3), lineWidth: 1))
                        }
                        // Metadata-rad: frist, kunngjort, verdi, fylke
                        HStack(spacing: 8) {
                            if let frist = k.frist { fristChip(frist) }
                            if let kunngjort = k.kunngjort, let d = Self.kortDato(kunngjort) {
                                metaChip("Kunngjort \(d)", icon: "megaphone.fill")
                            }
                            if let fylke = k.nutsKoder.compactMap({ Fylke(rawValue: $0)?.navn }).first {
                                metaChip(fylke, icon: "map.fill")
                            }
                            Spacer()
                            if let v = k.verdi {
                                Text(formatNOK(v.belop))
                                    .font(.appScaled(size: 14, weight: .heavy, design: .monospaced))
                                    .foregroundStyle(LBrand.green)
                            }
                        }
                        Divider().overlay(LBrand.stroke)
                        // AI-lesehjelp (nivå 2): oppsummering + krav-ekstraksjon
                        // — sparer selgeren for kravspek-lesingen.
                        if let opp = oppsummering {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack(spacing: 6) {
                                    Image(systemName: "sparkles")
                                        .font(.appScaled(size: 11, weight: .bold))
                                        .foregroundStyle(Color.indigo)
                                    Text("AI-OPPSUMMERING")
                                        .font(.appScaled(size: 10, weight: .black))
                                        .foregroundStyle(Color.indigo).tracking(0.8)
                                }
                                Text(opp.sammendrag)
                                    .font(.appScaled(size: 13))
                                    .foregroundStyle(.white)
                                    .fixedSize(horizontal: false, vertical: true)
                                if !opp.krav.isEmpty {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("KRAV I KUNNGJØRINGEN")
                                            .font(.appScaled(size: 9, weight: .black))
                                            .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                                        ForEach(opp.krav, id: \.self) { krav in
                                            HStack(alignment: .top, spacing: 6) {
                                                Image(systemName: "checkmark.seal")
                                                    .font(.appScaled(size: 9))
                                                    .foregroundStyle(LBrand.yellow)
                                                    .padding(.top, 2)
                                                Text(krav)
                                                    .font(.appScaled(size: 12))
                                                    .foregroundStyle(LBrand.textSecondary)
                                                    .fixedSize(horizontal: false, vertical: true)
                                            }
                                        }
                                    }
                                }
                                if let vv = opp.verdtAaVite, !vv.isEmpty {
                                    Text(vv)
                                        .font(.appScaled(size: 11))
                                        .foregroundStyle(LBrand.yellow)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            .padding(12)
                            .background(Color.indigo.opacity(0.08), in: RoundedRectangle(cornerRadius: 11))
                            .overlay(RoundedRectangle(cornerRadius: 11)
                                .stroke(Color.indigo.opacity(0.3), lineWidth: 1))
                        } else {
                            Button {
                                Task { await oppsummer(k) }
                            } label: {
                                HStack(spacing: 5) {
                                    if oppsummerer {
                                        ProgressView().tint(Color.indigo).scaleEffect(0.7)
                                    } else {
                                        Image(systemName: "sparkles")
                                            .font(.appScaled(size: 11, weight: .bold))
                                    }
                                    Text(oppsummerer ? "Oppsummerer …" : "Oppsummer med AI")
                                        .font(.appScaled(size: 12, weight: .bold))
                                }
                                .foregroundStyle(Color.indigo)
                            }
                            .buttonStyle(.plain)
                            .disabled(oppsummerer)
                        }
                        if let oppsummeringFeil {
                            Text(oppsummeringFeil)
                                .font(.appScaled(size: 11))
                                .foregroundStyle(LBrand.orange)
                        }
                        // Tilbuds-assistent (2026-08-04): AI-UTKAST til
                        // disposisjon + følgebrev + sjekkliste.
                        if let utkast = tilbudsutkast {
                            tilbudsutkastVisning(utkast)
                        } else {
                            Button {
                                Task { await lagUtkast(k) }
                            } label: {
                                HStack(spacing: 5) {
                                    if lagerUtkast {
                                        ProgressView().tint(LBrand.green).scaleEffect(0.7)
                                    } else {
                                        Image(systemName: "doc.badge.gearshape")
                                            .font(.appScaled(size: 11, weight: .bold))
                                    }
                                    Text(lagerUtkast ? "Lager utkast …" : "Lag tilbudsutkast")
                                        .font(.appScaled(size: 12, weight: .bold))
                                }
                                .foregroundStyle(LBrand.green)
                            }
                            .buttonStyle(.plain)
                            .disabled(lagerUtkast)
                        }
                        if let utkastFeil {
                            Text(utkastFeil)
                                .font(.appScaled(size: 11))
                                .foregroundStyle(LBrand.orange)
                        }
                        // HELE beskrivelsen — markerbar tekst for videre bruk.
                        Text(k.beskrivelse.isEmpty ? "Ingen beskrivelse i kunngjøringen — åpne Doffin for dokumentene." : k.beskrivelse)
                            .font(.appScaled(size: 14))
                            .foregroundStyle(k.beskrivelse.isEmpty ? LBrand.textTertiary : LBrand.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                            .textSelection(.enabled)
                        if !k.cpvKoder.isEmpty {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("CPV-KODER")
                                    .font(.appScaled(size: 10, weight: .black))
                                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                                Text(k.cpvKoder.joined(separator: " · "))
                                    .font(.appScaled(size: 11, design: .monospaced))
                                    .foregroundStyle(LBrand.textSecondary)
                            }
                        }
                        if let url = URL(string: k.url) {
                            Link(destination: url) {
                                Label("Åpne kunngjøringen med dokumenter i Doffin",
                                      systemImage: "arrow.up.right.square")
                                    .font(.appScaled(size: 12, weight: .semibold))
                                    .foregroundStyle(Color.indigo)
                            }
                        }
                        Color.clear.frame(height: 30)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { openKunngjoring = nil }
                        .tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    HStack(spacing: 8) {
                        if k.oppdragsgivere.first != nil {
                            createLeadButton(k)
                        }
                        secondaryMenu(k)
                    }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private func metaChip(_ text: String, icon: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon).font(.appScaled(size: 9))
            Text(text).font(.appScaled(size: 10, weight: .bold))
        }
        .foregroundStyle(LBrand.textSecondary)
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(LBrand.cardHi, in: Capsule())
    }

    // MARK: Nivå 2 — pipeline + AI-lesehjelp (2026-08-03)

    private static let pipelineStatusNavn: [(String, String)] = [
        ("vurderer", "Vurderer"), ("gaar_for", "Går for"),
        ("tilbud_levert", "Tilbud levert"), ("vant", "Vant"), ("tapt", "Tapt"),
    ]

    private func statusNavn(_ raw: String) -> String {
        Self.pipelineStatusNavn.first(where: { $0.0 == raw })?.1 ?? raw
    }

    private func statusFarge(_ raw: String) -> Color {
        switch raw {
        case "vant": return LBrand.green
        case "tapt": return LBrand.red
        case "tilbud_levert": return Color.indigo
        case "gaar_for": return LBrand.yellow
        default: return LBrand.textSecondary
        }
    }

    @MainActor
    private func lastPipeline() async {
        if DemoModeManager.isActiveNonisolated {
            if pipelineItems.isEmpty { pipelineItems = Self.demoPipeline }
            pipelineStats = AnbudPipelineStatsDTO(
                aapne: 2, vant: 1, tapt: 1, vinnrate: 0.5, sumAapneVerdi: 20_500_000,
                tapsaarsaker: [AnbudTapsAarsakDTO(aarsak: "pris", antall: 1)])
            return
        }
        guard let api = appState.api, !pipelineLaster else { return }
        pipelineLaster = true
        if let r = try? await api.fetchAnbudPipeline() {
            pipelineItems = r.items
            pipelineStats = r.stats
            iPipelineIds = Set(r.items.map(\.doffinId))
        }
        pipelineLaster = false
    }

    @MainActor
    private func leggIPipeline(_ k: DoffinKunngjoringDTO) async {
        if DemoModeManager.isActiveNonisolated {
            withAnimation { _ = iPipelineIds.insert(k.id) }
            return
        }
        guard let api = appState.api else { return }
        do {
            _ = try await api.addToAnbudPipeline(k)
            withAnimation { _ = iPipelineIds.insert(k.id) }
            await lastPipeline()
        } catch {
            leadErrorText = "Kunne ikke legge i pipelinen — prøv igjen."
        }
    }

    @MainActor
    private func oppsummer(_ k: DoffinKunngjoringDTO) async {
        guard !oppsummerer else { return }
        oppsummeringFeil = nil
        if DemoModeManager.isActiveNonisolated {
            oppsummering = AnbudOppsummeringDTO(
                sammendrag: "Kommunen anskaffer løpende elektrikertjenester for formålsbygg over 2 år med opsjon på 1+1 år. Rammeavtale med én leverandør.",
                krav: ["DSB-registrert elektrovirksomhet", "Minst 2 referanseprosjekter fra offentlige bygg", "Responstid 4 timer ved akutt feil"],
                verdtAaVite: "Opsjon 1+1 år kan doble kontraktens levetid.")
            return
        }
        guard let api = appState.api else { return }
        oppsummerer = true
        do {
            oppsummering = try await api.oppsummerAnbud(tittel: k.tittel, beskrivelse: k.beskrivelse)
        } catch {
            let msg = String(describing: error)
            oppsummeringFeil = msg.contains("for_kort_tekst")
                ? "Kunngjøringen har for lite tekst å oppsummere — åpne Doffin for dokumentene."
                : "AI-oppsummeringen feilet — prøv igjen."
        }
        oppsummerer = false
    }

    private var pipelineArk: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if let s = pipelineStats {
                            HStack(spacing: 10) {
                                statBoks(tall: "\(s.aapne)", label: "ÅPNE")
                                statBoks(tall: s.vinnrate.map { "\(Int($0 * 100)) %" } ?? "—",
                                         label: "VINNRATE (\(s.vant)/\(s.vant + s.tapt))")
                                statBoks(tall: formatNOK(s.sumAapneVerdi), label: "ÅPEN VERDI")
                            }
                        }
                        if pipelineItems.isEmpty && !pipelineLaster {
                            ContentUnavailableView("Tom pipeline",
                                systemImage: "chart.line.text.clipboard",
                                description: Text("Legg kunngjøringer i pipelinen fra ⋯-menyen på et søketreff."))
                                .padding(.vertical, 20)
                        }
                        // Nivå 3: anbudene geografisk — geokodet fra Brreg-
                        // adressen til oppdragsgiveren (best effort).
                        pipelineKart
                        ForEach(pipelineItems) { p in
                            pipelineRad(p)
                        }
                        // Nivå 3: læringssløyfen — hvorfor taper vi, og
                        // hvilken Pondus-trening adresserer det.
                        tapsAarsakSeksjon
                        Color.clear.frame(height: 20)
                    }
                    .padding(18)
                }
            }
            .navigationTitle("Anbuds-pipeline")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { showPipeline = false }
                        .tint(LBrand.textSecondary)
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        // Nivå 3: «tapt» krever årsak — det er læringssløyfens råstoff.
        .confirmationDialog(
            "Hvorfor tapte dere anbudet?",
            isPresented: Binding(get: { taptDialogItem != nil },
                                 set: { if !$0 { taptDialogItem = nil } }),
            titleVisibility: .visible
        ) {
            ForEach(Self.taptAarsakNavn, id: \.0) { raw, navn in
                Button(navn) {
                    if let p = taptDialogItem {
                        Task { await lagreStatus(p, status: "tapt", taptAarsak: raw) }
                    }
                    taptDialogItem = nil
                }
            }
            Button("Avbryt", role: .cancel) { taptDialogItem = nil }
        }
    }

    private func pipelineRad(_ p: AnbudPipelineItemDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.tittel)
                        .font(.appScaled(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                    Text(p.oppdragsgiver)
                        .font(.appScaled(size: 11))
                        .foregroundStyle(LBrand.textSecondary)
                }
                Spacer()
                if let v = p.verdi {
                    Text(formatNOK(v))
                        .font(.appScaled(size: 11, weight: .heavy, design: .monospaced))
                        .foregroundStyle(LBrand.green)
                }
            }
            HStack(spacing: 8) {
                // Status-bytte: hele salgsprosessen i én meny.
                Menu {
                    ForEach(Self.pipelineStatusNavn, id: \.0) { raw, navn in
                        Button {
                            Task { await endreStatus(p, til: raw) }
                        } label: {
                            if raw == p.status { Label(navn, systemImage: "checkmark") }
                            else { Text(navn) }
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Circle().fill(statusFarge(p.status)).frame(width: 7, height: 7)
                        Text(statusNavn(p.status))
                            .font(.appScaled(size: 11, weight: .bold))
                        Image(systemName: "chevron.down")
                            .font(.appScaled(size: 8, weight: .bold))
                    }
                    .foregroundStyle(statusFarge(p.status))
                    .padding(.horizontal, 9).padding(.vertical, 5)
                    .background(statusFarge(p.status).opacity(0.14), in: Capsule())
                }
                // Team-tildeling (nivå 2): den tildelte varsles av backend.
                Menu {
                    Button("Ingen") { Task { await tildel(p, til: nil) } }
                    ForEach(TeamLiveStore.shared.memberDTOs, id: \.userId) { m in
                        Button(m.name) { Task { await tildel(p, til: m.userId) } }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "person.crop.circle")
                            .font(.appScaled(size: 10, weight: .bold))
                        Text(p.assignedNavn ?? "Tildel")
                            .font(.appScaled(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(p.assignedNavn == nil ? LBrand.textSecondary : Color.indigo)
                    .padding(.horizontal, 9).padding(.vertical, 5)
                    .background(LBrand.cardHi, in: Capsule())
                }
                if let frist = p.frist { fristChip(frist) }
                // Nivå 3: registrert tapsårsak vises på raden.
                if p.status == "tapt", let aarsak = p.taptAarsak {
                    Text(Self.taptAarsakNavn.first(where: { $0.0 == aarsak })?.1
                         ?? aarsak.capitalized)
                        .font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(LBrand.red)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(LBrand.red.opacity(0.12), in: Capsule())
                }
                Spacer()
                Button {
                    Task { await fjernFraPipeline(p) }
                } label: {
                    Image(systemName: "trash")
                        .font(.appScaled(size: 11))
                        .foregroundStyle(LBrand.textTertiary)
                }.buttonStyle(.plain)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
    }

    @MainActor
    private func endreStatus(_ p: AnbudPipelineItemDTO, til status: String) async {
        // Nivå 3: «tapt» går via årsaks-dialogen — læringssløyfen starter
        // med å vite HVORFOR.
        if status == "tapt" {
            taptDialogItem = p
            return
        }
        await lagreStatus(p, status: status, taptAarsak: nil)
    }

    @MainActor
    private func lagreStatus(_ p: AnbudPipelineItemDTO, status: String, taptAarsak: String?) async {
        if DemoModeManager.isActiveNonisolated {
            if let i = pipelineItems.firstIndex(where: { $0.id == p.id }) {
                var kopi = AnbudPipelineItemDTO(
                    id: p.id, doffinId: p.doffinId, tittel: p.tittel,
                    oppdragsgiver: p.oppdragsgiver, orgnr: p.orgnr, url: p.url,
                    frist: p.frist, verdi: p.verdi, status: status,
                    assignedUserId: p.assignedUserId, assignedNavn: p.assignedNavn,
                    notat: p.notat)
                kopi.lat = p.lat; kopi.lng = p.lng; kopi.adresse = p.adresse
                kopi.taptAarsak = taptAarsak ?? p.taptAarsak
                pipelineItems[i] = kopi
            }
            return
        }
        guard let api = appState.api else { return }
        try? await api.updateAnbudPipeline(id: p.id, status: status, taptAarsak: taptAarsak)
        await lastPipeline()
    }

    // MARK: Tilbuds-assistent (2026-08-04)

    /// AI-utkast — sender med kravene fra oppsummeringen hvis den er kjørt.
    @MainActor
    private func lagUtkast(_ k: DoffinKunngjoringDTO) async {
        guard !lagerUtkast else { return }
        utkastFeil = nil
        if DemoModeManager.isActiveNonisolated {
            tilbudsutkast = AnbudTilbudsutkastDTO(
                disposisjon: [
                    .init(seksjon: "Om oss", innhold: "[FYLL INN: kort om bedriften, antall montører, DSB-registrering og relevante sertifiseringer.]"),
                    .init(seksjon: "Forståelse av oppdraget", innhold: "Kommunen trenger en rammeavtale-partner for løpende elektroarbeid i formålsbygg med rask respons og dokumentert internkontroll. Vi leser omfanget som drift + småprosjekter over 2 år med opsjon 1+1."),
                    .init(seksjon: "Løsning og bemanning", innhold: "[FYLL INN: teamet som betjener avtalen, responstid dere kan forplikte dere til, og hvordan internkontrollen dokumenteres.]"),
                    .init(seksjon: "Referanser", innhold: "[FYLL INN: 2 referanseprosjekter fra offentlige bygg med kontaktperson.]"),
                ],
                folgebrev: "Vi viser til kunngjøringen om rammeavtale for elektrikertjenester og bekrefter med dette vår interesse. [FYLL INN: én setning om hvorfor akkurat dere.] Vedlagt følger tilbud med dokumentasjon på [FYLL INN: sertifiseringer]. Vi står gjerne til disposisjon for avklaringer.",
                sjekkliste: ["DSB-registrering vedlagt", "2 referanser fra offentlige bygg", "Responstid-forpliktelse definert", "Signert av daglig leder før frist 25. aug"])
            return
        }
        guard let api = appState.api else { return }
        lagerUtkast = true
        do {
            tilbudsutkast = try await api.lagTilbudsutkast(
                tittel: k.tittel, beskrivelse: k.beskrivelse,
                krav: oppsummering?.krav ?? [])
        } catch {
            let msg = String(describing: error)
            utkastFeil = msg.contains("for_kort_tekst")
                ? "Kunngjøringen har for lite tekst til et utkast — åpne Doffin for dokumentene."
                : "Utkastet feilet — prøv igjen."
        }
        lagerUtkast = false
    }

    private func tilbudsutkastVisning(_ u: AnbudTilbudsutkastDTO) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "doc.badge.gearshape")
                    .font(.appScaled(size: 11, weight: .bold))
                    .foregroundStyle(LBrand.green)
                Text("TILBUDSUTKAST")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.green).tracking(0.8)
                Spacer()
                Button {
                    UIPasteboard.general.string = utkastSomTekst(u)
                } label: {
                    Label("Kopier alt", systemImage: "doc.on.doc")
                        .font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(LBrand.textSecondary)
                }.buttonStyle(.plain)
            }
            // Ærlighet foran alt: dette er et utkast, ikke et tilbud.
            Text("Utkast med [FYLL INN]-markører — skal alltid gjennomgås og tilpasses av dere før innsending.")
                .font(.appScaled(size: 10))
                .foregroundStyle(LBrand.yellow)
                .fixedSize(horizontal: false, vertical: true)
            ForEach(u.disposisjon) { s in
                VStack(alignment: .leading, spacing: 3) {
                    Text(s.seksjon.uppercased())
                        .font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                    Text(s.innhold)
                        .font(.appScaled(size: 12))
                        .foregroundStyle(LBrand.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                }
            }
            VStack(alignment: .leading, spacing: 3) {
                Text("FØLGEBREV")
                    .font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                Text(u.folgebrev)
                    .font(.appScaled(size: 12))
                    .foregroundStyle(LBrand.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
            }
            if !u.sjekkliste.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    Text("FØR INNSENDING")
                        .font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                    ForEach(u.sjekkliste, id: \.self) { punkt in
                        HStack(alignment: .top, spacing: 6) {
                            Image(systemName: "square")
                                .font(.appScaled(size: 9))
                                .foregroundStyle(LBrand.green)
                                .padding(.top, 2)
                            Text(punkt)
                                .font(.appScaled(size: 12))
                                .foregroundStyle(LBrand.textSecondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
        }
        .padding(12)
        .background(LBrand.green.opacity(0.06), in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11)
            .stroke(LBrand.green.opacity(0.25), lineWidth: 1))
    }

    private func utkastSomTekst(_ u: AnbudTilbudsutkastDTO) -> String {
        var deler: [String] = []
        for s in u.disposisjon { deler.append("## \(s.seksjon)\n\(s.innhold)") }
        deler.append("## Følgebrev\n\(u.folgebrev)")
        if !u.sjekkliste.isEmpty {
            deler.append("## Før innsending\n" + u.sjekkliste.map { "☐ \($0)" }.joined(separator: "\n"))
        }
        return deler.joined(separator: "\n\n")
    }

    // MARK: Nivå 3 — kart, tapt-årsak og læringssløyfe (2026-08-03)

    private static let taptAarsakNavn: [(String, String)] = [
        ("pris", "Pris"), ("kapasitet", "Kapasitet"),
        ("krav", "Krav vi ikke oppfylte"), ("referanser", "Referanser"),
        ("annet", "Annet"),
    ]

    /// Ærlig, statisk kobling tapsårsak → trening/tiltak (samme sløyfe
    /// som Kvalitets underkjenningsårsak → Pondus-modul).
    private func pondusAnbefaling(for aarsak: String) -> String? {
        switch aarsak {
        case "pris": return "Pondus: Trygghet — pris-innvending og verdiargumentasjon"
        case "krav": return "Kvalitet: dokumentasjon og sertifiseringer bør på plass før neste tilbud"
        case "referanser": return "Bygg referansebank av vunnede anbud — be om attest ved «Vant»"
        case "kapasitet": return "Vurder rammeavtale-partnere for kapasitetstopper"
        default: return nil
        }
    }

    @ViewBuilder
    private var pipelineKart: some View {
        let medKoordinater = pipelineItems.filter { $0.lat != nil && $0.lng != nil }
        if !medKoordinater.isEmpty {
            Map {
                ForEach(medKoordinater) { p in
                    Annotation(p.oppdragsgiver.isEmpty ? p.tittel : p.oppdragsgiver,
                               coordinate: CLLocationCoordinate2D(
                                   latitude: p.lat ?? 0, longitude: p.lng ?? 0)) {
                        ZStack {
                            Circle().fill(statusFarge(p.status))
                                .frame(width: 26, height: 26)
                                .shadow(color: statusFarge(p.status).opacity(0.6), radius: 5)
                            Image(systemName: "doc.text.magnifyingglass")
                                .font(.appScaled(size: 11, weight: .bold))
                                .foregroundStyle(.white)
                        }
                    }
                }
            }
            .frame(height: 220)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .allowsHitTesting(false)
        }
    }

    @ViewBuilder
    private var tapsAarsakSeksjon: some View {
        if let aarsaker = pipelineStats?.tapsaarsaker, !aarsaker.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("HVORFOR TAPER VI")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                ForEach(aarsaker) { a in
                    VStack(alignment: .leading, spacing: 3) {
                        HStack {
                            Text(Self.taptAarsakNavn.first(where: { $0.0 == a.aarsak })?.1
                                 ?? a.aarsak.capitalized)
                                .font(.appScaled(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                            Spacer()
                            Text("\(a.antall)")
                                .font(.appScaled(size: 12, weight: .heavy, design: .monospaced))
                                .foregroundStyle(LBrand.red)
                        }
                        if let anbefaling = pondusAnbefaling(for: a.aarsak) {
                            HStack(spacing: 5) {
                                Image(systemName: "graduationcap.fill")
                                    .font(.appScaled(size: 9))
                                Text(anbefaling)
                                    .font(.appScaled(size: 11))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .foregroundStyle(LBrand.purpleLight)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        }
    }

    @MainActor
    private func tildel(_ p: AnbudPipelineItemDTO, til userId: String?) async {
        guard !DemoModeManager.isActiveNonisolated, let api = appState.api else { return }
        try? await api.updateAnbudPipeline(id: p.id, assignedUserId: .some(userId))
        await lastPipeline()
    }

    @MainActor
    private func fjernFraPipeline(_ p: AnbudPipelineItemDTO) async {
        if DemoModeManager.isActiveNonisolated {
            pipelineItems.removeAll { $0.id == p.id }
            return
        }
        guard let api = appState.api else { return }
        try? await api.deleteAnbudPipeline(id: p.id)
        await lastPipeline()
    }

    private static let demoPipeline: [AnbudPipelineItemDTO] = {
        var liste: [AnbudPipelineItemDTO] = demoPipelineBase
        // Nivå 3: demo-koordinater (ekte adresser) + tapt-årsak.
        let koordinater: [String: (Double, Double, String)] = [
            "dp-1": (59.9284, 10.9594, "Rådhuset, Lørenskog"),
            "dp-2": (59.9139, 10.7522, "Kirkeveien 166, Oslo"),
            "dp-3": (59.8940, 10.5460, "Rådhuset, Bærum"),
            "dp-4": (59.9560, 11.0490, "Rådhuset, Lillestrøm"),
        ]
        for i in liste.indices {
            if let k = koordinater[liste[i].id] {
                liste[i].lat = k.0; liste[i].lng = k.1; liste[i].adresse = k.2
            }
            if liste[i].status == "tapt" { liste[i].taptAarsak = "pris" }
        }
        return liste
    }()

    private static let demoPipelineBase: [AnbudPipelineItemDTO] = [
        .init(id: "dp-1", doffinId: "demo-1",
              tittel: "Rammeavtale elektrikertjenester — kommunale bygg",
              oppdragsgiver: "Lørenskog kommune", orgnr: "842566142", url: "https://doffin.no",
              frist: "2026-08-25", verdi: 8_500_000, status: "gaar_for",
              assignedUserId: nil, assignedNavn: "Espen Berg", notat: ""),
        .init(id: "dp-2", doffinId: "demo-3",
              tittel: "Vakthold og alarmrespons — helsebygg",
              oppdragsgiver: "Oslo universitetssykehus HF", orgnr: "993467049", url: "https://doffin.no",
              frist: "2026-09-05", verdi: 12_000_000, status: "vurderer",
              assignedUserId: nil, assignedNavn: nil, notat: ""),
        .init(id: "dp-3", doffinId: "demo-x1",
              tittel: "Elektroarbeid nye omsorgsboliger",
              oppdragsgiver: "Bærum kommune", orgnr: "", url: "https://doffin.no",
              frist: nil, verdi: 6_200_000, status: "vant",
              assignedUserId: nil, assignedNavn: "Kari Nordmann", notat: ""),
        .init(id: "dp-4", doffinId: "demo-x2",
              tittel: "Rammeavtale internkontroll el-anlegg",
              oppdragsgiver: "Lillestrøm kommune", orgnr: "", url: "https://doffin.no",
              frist: nil, verdi: 3_100_000, status: "tapt",
              assignedUserId: nil, assignedNavn: nil, notat: ""),
    ]

    // MARK: Nivå 1 — AI-prioritering + tildelings-innsikt (2026-08-03)

    /// Scor treffene mot org-ens overvåkninger og sorter beste øverst.
    /// Demo: statiske scores så flyten er demobar uten AI-kall.
    @MainActor
    private func prioriterMedAI() async {
        guard !isScoring else { return }
        scoreError = nil
        if DemoModeManager.isActiveNonisolated {
            scores = [
                "demo-1": DoffinScoreDTO(id: "demo-1", score: 92, hvorfor: "Elektro-rammeavtale i kjerneområdet"),
                "demo-2": DoffinScoreDTO(id: "demo-2", score: 38, hvorfor: "Renhold — utenfor bransjeprofilen"),
                "demo-3": DoffinScoreDTO(id: "demo-3", score: 55, hvorfor: "Sikkerhet — delvis relevant"),
            ]
            sorterEtterScore()
            return
        }
        guard let api = appState.api else { return }
        isScoring = true
        do {
            let result = try await api.scoreDoffin(kunngjoringer: results)
            scores = Dictionary(uniqueKeysWithValues: result.map { ($0.id, $0) })
            sorterEtterScore()
        } catch {
            let msg = String(describing: error)
            scoreError = msg.contains("ingen_overvaakninger")
                ? "AI-prioritering bruker overvåkningene dine som profil — lagre minst ett søk først."
                : "AI-prioriteringen feilet — prøv igjen."
        }
        isScoring = false
    }

    private func sorterEtterScore() {
        results.sort { (scores[$0.id]?.score ?? -1) > (scores[$1.id]?.score ?? -1) }
    }

    /// Hent aggregert AWARDED-innsikt for gjeldende bransje/fylke-filter.
    @MainActor
    private func lastTildelinger() async {
        if DemoModeManager.isActiveNonisolated {
            tildelinger = nil   // demo-arket bruker statiske tall under
            return
        }
        guard let api = appState.api, !tildelingerLaster else { return }
        tildelingerLaster = true
        tildelinger = try? await api.fetchDoffinTildelinger(
            cpv: effektivCpv, location: selectedFylke?.rawValue)
        tildelingerLaster = false
    }

    private var tildelingerArk: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Text([selectedBransje?.navn, selectedFylke?.navn]
                                .compactMap { $0 }.joined(separator: " · ")
                                .isEmpty ? "Hele markedet" :
                             [selectedBransje?.navn, selectedFylke?.navn]
                                .compactMap { $0 }.joined(separator: " · "))
                            .font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(LBrand.textSecondary)
                        if DemoModeManager.isActiveNonisolated {
                            tildelingerInnhold(total: 47, sum: 182_000_000,
                                oppdragsgivere: [("Oslo kommune", 9), ("Akershus fylkeskommune", 6), ("Bærum kommune", 4)],
                                vinnere: [("Bravida Norge AS", 8), ("GK Gruppen AS", 5)])
                        } else if tildelingerLaster {
                            ProgressView().tint(Color.indigo)
                                .frame(maxWidth: .infinity).padding(.vertical, 40)
                        } else if let t = tildelinger {
                            tildelingerInnhold(
                                total: t.total, sum: t.sumVerdi,
                                oppdragsgivere: t.toppOppdragsgivere.map { ($0.navn, $0.antall) },
                                vinnere: t.toppVinnere.map { ($0.navn, $0.antall) })
                        } else {
                            Text("Kunne ikke hente tildelinger — prøv igjen.")
                                .font(.appScaled(size: 12))
                                .foregroundStyle(LBrand.orange)
                        }
                        Color.clear.frame(height: 20)
                    }
                    .padding(18)
                }
            }
            .navigationTitle("Tildelte kontrakter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { showTildelinger = false }
                        .tint(LBrand.textSecondary)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private func tildelingerInnhold(
        total: Int, sum: Double,
        oppdragsgivere: [(String, Int)], vinnere: [(String, Int)]
    ) -> some View {
        HStack(spacing: 12) {
            statBoks(tall: "\(total)", label: "TILDELT")
            statBoks(tall: formatNOK(sum), label: "SAMLET VERDI (utvalg)")
        }
        if !oppdragsgivere.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("TOPP OPPDRAGSGIVERE")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                ForEach(oppdragsgivere, id: \.0) { navn, antall in
                    HStack {
                        Text(navn).font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                        Spacer()
                        Text("\(antall) kontrakter")
                            .font(.appScaled(size: 11, design: .monospaced))
                            .foregroundStyle(LBrand.textSecondary)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        VStack(alignment: .leading, spacing: 6) {
            Text("HVEM VINNER")
                .font(.appScaled(size: 10, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
            if vinnere.isEmpty {
                // Ærlig: Doffin-søket eksponerer ikke alltid vinner-data.
                Text("Doffin oppgir ikke vinnere i søkedataene for dette utvalget — åpne enkeltkunngjøringer i Doffin for tildelingsdetaljer.")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LBrand.textTertiary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                ForEach(vinnere, id: \.0) { navn, antall in
                    HStack {
                        Text(navn).font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                        Spacer()
                        Text("\(antall) seire")
                            .font(.appScaled(size: 11, design: .monospaced))
                            .foregroundStyle(LBrand.green)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }

    private func statBoks(tall: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(tall).font(.appScaled(size: 20, weight: .heavy, design: .monospaced))
                .foregroundStyle(.white)
            Text(label).font(.appScaled(size: 9, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
    }

    /// Opprett CRM-lead fra kunngjøringen: navn = oppdragsgiver, org.nr i
    /// raw_text → sikker BRREG-kobling + full berikelse i backend-jobbkøen.
    @MainActor
    private func createLead(from k: DoffinKunngjoringDTO) async {
        guard let api = appState.api, let og = k.oppdragsgivere.first,
              creatingLeadId == nil else { return }
        creatingLeadId = k.id
        leadErrorText = nil
        do {
            _ = try await api.createLeadFromAnbud(
                navn: og.navn, orgnr: og.orgnr,
                tittel: k.tittel, url: k.url, frist: k.frist)
            withAnimation { _ = createdLeadIds.insert(k.id) }
        } catch {
            leadErrorText = "Kunne ikke opprette lead — prøv igjen. (\(error.localizedDescription))"
        }
        creatingLeadId = nil
    }

    /// Frist-chip m/ EKTE dato (audit-grep 1): «Frist 25. aug · 22 d».
    /// Uparsbar dato → ingen chip (en gul chip uten innhold er ren støy).
    @ViewBuilder
    private func fristChip(_ iso: String) -> some View {
        if let dato = Self.kortDato(iso) {
            let days = daysUntil(iso)
            let urgent = (days ?? 99) <= 7
            HStack(spacing: 4) {
                Image(systemName: "clock.fill").font(.appScaled(size: 9))
                Text(days.map { $0 >= 0 ? "Frist \(dato) · \($0) d" : "Frist \(dato) — utløpt" }
                     ?? "Frist \(dato)")
                    .font(.appScaled(size: 10, weight: .bold))
            }
            .foregroundStyle(urgent ? LBrand.red : LBrand.yellow)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background((urgent ? LBrand.red : LBrand.yellow).opacity(0.14), in: Capsule())
        }
    }

    // MARK: Overvåkninger

    private var watchesSheet: some View {
        NavigationStack {
            List {
                if watches.isEmpty {
                    ContentUnavailableView("Ingen overvåkninger",
                        systemImage: "bell.slash",
                        description: Text("Gjør et søk og trykk «Overvåk dette søket»."))
                } else {
                    ForEach(watches) { w in
                        Button {
                            searchText = w.query.q ?? ""
                            selectedFylke = Fylke(rawValue: w.query.location ?? "")
                            selectedBransje = Bransje.allCases.first { $0.cpv == w.query.cpv }
                            showWatches = false
                            // Kjøring = sett: nullstill «nye treff»-badgen
                            // (fire-and-forget — søket er hovedhandlingen).
                            if (w.newHitsCount ?? 0) > 0 {
                                Task { try? await appState.api?.markDoffinWatchSeen(id: w.id) }
                            }
                            Task { await search() }
                        } label: {
                            HStack(spacing: 8) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(w.name).font(.appScaled(size: 13, weight: .bold))
                                    Text([w.query.q, w.query.location].compactMap { $0 }
                                            .filter { !$0.isEmpty }.joined(separator: " · "))
                                        .font(.appScaled(size: 11)).foregroundStyle(.secondary)
                                }
                                Spacer()
                                // «Nye treff»-badge (2026-08-03) — fylles av
                                // cron-sjekken, nullstilles ved kjøring.
                                if let nye = w.newHitsCount, nye > 0 {
                                    Text("\(nye) nye")
                                        .font(.appScaled(size: 10, weight: .black))
                                        .foregroundStyle(.white)
                                        .padding(.horizontal, 8).padding(.vertical, 3)
                                        .background(Color.indigo, in: Capsule())
                                }
                            }
                        }
                    }
                    .onDelete { idx in
                        Task {
                            for i in idx {
                                try? await appState.api?.deleteDoffinWatch(id: watches[i].id)
                            }
                            await reloadWatches()
                        }
                    }
                }
            }
            .navigationTitle("Overvåkninger")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { showWatches = false }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    // MARK: Handlinger

    private func initialLoad() async {
        await reloadWatches()
        if results.isEmpty { await search() }
    }

    private func search() async {
        // Demo-modus (2026-08-03): fanen skal være testbar/demobar uten
        // ekte innlogging + entitlement — statiske mock-kunngjøringer,
        // lett filtrert så kontrollene kjennes ekte.
        if DemoModeManager.isActiveNonisolated {
            isLoading = false
            errorText = nil
            var demo = Self.demoKunngjoringer
            if !searchText.isEmpty {
                let q = searchText.lowercased()
                demo = demo.filter {
                    $0.tittel.lowercased().contains(q) || $0.beskrivelse.lowercased().contains(q)
                }
            }
            if let b = selectedBransje {
                demo = demo.filter { $0.cpvKoder.contains(where: { $0.hasPrefix(String(b.cpv.prefix(4))) }) }
            }
            results = demo
            total = demo.count
            return
        }
        guard let api = appState.api else {
            errorText = "Ikke innlogget mot backend."
            return
        }
        isLoading = true
        errorText = nil
        do {
            let r = try await api.searchDoffin(
                q: searchText.isEmpty ? nil : searchText,
                location: selectedFylke?.rawValue,
                cpv: effektivCpv,
                status: status
            )
            results = r.kunngjoringer
            total = r.total
        } catch {
            let msg = String(describing: error)
            errorText = msg.contains("entitlement_locked")
                ? "Anbud er en tilleggstjeneste organisasjonen ikke har aktivert."
                : "Kunne ikke hente fra Doffin — prøv igjen. (\(error.localizedDescription))"
            results = []
            total = 0
        }
        isLoading = false
    }

    private func reloadWatches() async {
        if DemoModeManager.isActiveNonisolated {
            watches = Self.demoWatches
            return
        }
        guard let api = appState.api else { return }
        watches = (try? await api.fetchDoffinWatches()) ?? []
    }

    private func saveCurrentAsWatch() async {
        guard let api = appState.api else { return }
        let name = [searchText.isEmpty ? nil : searchText,
                    selectedBransje?.navn, selectedFylke?.navn]
            .compactMap { $0 }.joined(separator: " · ")
        let query = DoffinWatchQueryDTO(
            q: searchText.isEmpty ? nil : searchText,
            location: selectedFylke?.rawValue,
            cpv: selectedBransje?.cpv
        )
        do {
            try await api.createDoffinWatch(name: name.isEmpty ? "Alle anbud" : name, query: query)
            await reloadWatches()
        } catch {
            errorText = "Kunne ikke lagre overvåkning. (\(error.localizedDescription))"
        }
    }

    // MARK: Demo-data (2026-08-03) — aldri backend i demo-modus.

    private static let demoKunngjoringer: [DoffinKunngjoringDTO] = [
        .init(id: "demo-1",
              tittel: "Rammeavtale elektrikertjenester — kommunale bygg",
              beskrivelse: "Løpende elektroarbeid, internkontroll og småoppdrag i kommunens formålsbygg. 2 år + opsjon 1+1.",
              oppdragsgivere: [.init(navn: "Lørenskog kommune", orgnr: "842566142")],
              verdi: .init(belop: 8_500_000, valuta: "NOK"),
              type: "COMPETITION", status: "ACTIVE",
              kunngjort: "2026-07-28", frist: "2026-08-25",
              nutsKoder: ["NO084"], cpvKoder: ["45310000"],
              url: "https://doffin.no",
              kundeMatch: .init(leadId: "demo-lead-1",
                                leadNavn: "Lørenskog kommune",
                                leadStatus: "contacted",
                                eier: "Kari Nordmann")),
        .init(id: "demo-2",
              tittel: "Renholdstjenester for videregående skoler",
              beskrivelse: "Daglig renhold og periodisk hovedrent for fire skoler i fylket.",
              oppdragsgivere: [.init(navn: "Akershus fylkeskommune", orgnr: "930580694")],
              verdi: .init(belop: 12_000_000, valuta: "NOK"),
              type: "COMPETITION", status: "ACTIVE",
              kunngjort: "2026-07-30", frist: "2026-08-18",
              nutsKoder: ["NO084"], cpvKoder: ["90910000"],
              url: "https://doffin.no"),
        .init(id: "demo-3",
              tittel: "Vakthold og alarmrespons — helsebygg",
              beskrivelse: "Stasjonært vakthold, mobilpatrulje og alarmutrykning for tre lokasjoner.",
              oppdragsgivere: [.init(navn: "Oslo universitetssykehus HF", orgnr: "993467049")],
              verdi: nil,
              type: "COMPETITION", status: "ACTIVE",
              kunngjort: "2026-08-01", frist: "2026-09-05",
              nutsKoder: ["NO081"], cpvKoder: ["79710000"],
              url: "https://doffin.no"),
    ]

    private static let demoWatches: [DoffinWatchDTO] = [
        .init(id: "demo-w1", name: "Elektro · Akershus",
              query: .init(q: nil, location: "NO084", cpv: "45310000"),
              createdAt: nil, newHitsCount: 2),
        .init(id: "demo-w2", name: "rammeavtale",
              query: .init(q: "rammeavtale", location: nil, cpv: nil),
              createdAt: nil, newHitsCount: 0),
    ]

    // MARK: Helpers

    private func errorBanner(_ text: String) -> some View {
        HStack(spacing: 7) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(LBrand.orange)
            Text(text).font(.appScaled(size: 11)).foregroundStyle(LBrand.orange)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LBrand.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 9))
    }

    private func formatNOK(_ v: Double) -> String {
        if v >= 1_000_000 { return String(format: "%.1f MNOK", v / 1_000_000) }
        if v >= 1_000 { return String(format: "%.0f kNOK", v / 1_000) }
        return String(format: "%.0f kr", v)
    }

    /// Robust Doffin-dato-parsing (audit-grep 1, 2026-08-03): default
    /// ISO8601DateFormatter krever full dato+tid — Doffin leverer både
    /// med brøkdels-sekunder og rene datoer, så chipen sto tom («Frist»).
    static func parseDoffinDate(_ iso: String) -> Date? {
        let full = ISO8601DateFormatter()
        full.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = full.date(from: iso) { return d }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        if let d = plain.date(from: iso) { return d }
        let dateOnly = ISO8601DateFormatter()
        dateOnly.formatOptions = [.withFullDate]
        return dateOnly.date(from: iso)
    }

    private func daysUntil(_ iso: String) -> Int? {
        guard let d = Self.parseDoffinDate(iso) else { return nil }
        return Calendar.current.dateComponents(
            [.day], from: Calendar.current.startOfDay(for: Date()),
            to: Calendar.current.startOfDay(for: d)).day
    }

    /// «25. aug»-format for frist/kunngjort (nb_NO).
    static func kortDato(_ iso: String) -> String? {
        guard let d = parseDoffinDate(iso) else { return nil }
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "d. MMM"
        return f.string(from: d)
    }
}
