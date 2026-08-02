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

struct AnbudView: View {
    var embedded: Bool = false
    @Environment(AppState.self) private var appState

    @State private var searchText = ""
    @State private var selectedFylke: Fylke? = nil
    @State private var selectedBransje: Bransje? = nil
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
                    Button("Alle bransjer") { selectedBransje = nil; Task { await search() } }
                    ForEach(Bransje.allCases) { b in
                        Button(b.navn) { selectedBransje = b; Task { await search() } }
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "wrench.and.screwdriver.fill").font(.appScaled(size: 10))
                        Text(selectedBransje?.navn ?? "Alle bransjer")
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
                    Spacer()
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
                Spacer()
                if k.oppdragsgivere.first != nil {
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
                Button {
                    if let og = k.oppdragsgivere.first {
                        UIPasteboard.general.string = "\(og.navn) — org.nr \(og.orgnr)\n\(k.tittel)\n\(k.url)"
                        withAnimation { copiedToastId = k.id }
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
                            withAnimation { if copiedToastId == k.id { copiedToastId = nil } }
                        }
                    }
                } label: {
                    Label(copiedToastId == k.id ? "Kopiert ✓" : "Kopier",
                          systemImage: "doc.on.doc.fill")
                        .font(.appScaled(size: 10, weight: .bold))
                        .foregroundStyle(copiedToastId == k.id ? LBrand.green : .white)
                }.buttonStyle(.plain)
                if let url = URL(string: k.url) {
                    Link(destination: url) {
                        Label("Åpne i Doffin", systemImage: "arrow.up.right.square.fill")
                            .font(.appScaled(size: 10, weight: .bold))
                            .foregroundStyle(Color.indigo)
                    }
                }
            }
        }
        .padding(13)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
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

    private func fristChip(_ iso: String) -> some View {
        let days = daysUntil(iso)
        let urgent = (days ?? 99) <= 7
        return HStack(spacing: 4) {
            Image(systemName: "clock.fill").font(.appScaled(size: 9))
            Text(days.map { $0 >= 0 ? "Frist om \($0) d" : "Frist utløpt" } ?? "Frist")
                .font(.appScaled(size: 10, weight: .bold))
        }
        .foregroundStyle(urgent ? LBrand.red : LBrand.yellow)
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background((urgent ? LBrand.red : LBrand.yellow).opacity(0.14), in: Capsule())
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
                cpv: selectedBransje?.cpv,
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
              url: "https://doffin.no"),
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

    private func daysUntil(_ iso: String) -> Int? {
        let f = ISO8601DateFormatter()
        guard let d = f.date(from: iso) else { return nil }
        return Calendar.current.dateComponents([.day], from: Date(), to: d).day
    }
}
