// LeadgridImportSheet.swift
//
// Bottom-sheet for å importere leads til Leadgrid fra iPad. To moduser:
//
//   1. CSV / Excel    — DocumentPicker → preview → enkel auto-mapping →
//                       commit. Vi viser ikke full column-mapping på iPad
//                       (det er en web-flate), men vi sender mappingen vi
//                       auto-utleder.
//   2. URL Research   — lim inn EN nettside-URL → Role Room Agents
//                       orchestrator-stack kjører Brreg + website +
//                       Google Places + Claude synthesis → draft-lead
//                       opprettes → preview m/ lokasjons-konfidens →
//                       commit → pin på kartet.
//
// Bruker eksisterende APIClient-metoder:
//   CSV: uploadImportFile, commitImportCsv
//   URL Research: startUrlResearch, runUrlResearch, commitDraftLead,
//                 refreshUrlResearchSection

import SwiftUI
import UniformTypeIdentifiers

@MainActor
struct LeadgridImportSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var mode: ImportMode = .csv
    @State private var statusMessage: String?

    enum ImportMode: String, CaseIterable, Identifiable {
        case csv, url
        var id: String { rawValue }
        var label: String {
            switch self {
            case .csv: return "CSV / Excel-fil"
            case .url: return "URL Research"
            }
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("", selection: $mode) {
                    ForEach(ImportMode.allCases) { m in
                        Text(m.label).tag(m)
                    }
                }
                .pickerStyle(.segmented)
                .padding()

                Divider()

                switch mode {
                case .csv:
                    CsvImportTab(statusMessage: $statusMessage)
                case .url:
                    LeadgridUrlResearchView(statusMessage: $statusMessage)
                }
            }
            .navigationTitle("Importer leads")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Lukk") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                if let msg = statusMessage {
                    Text(msg)
                        .font(.footnote)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(.thinMaterial)
                }
            }
        }
    }
}

// MARK: - CSV-tab

@MainActor
private struct CsvImportTab: View {
    @Environment(AppState.self) private var appState
    @Binding var statusMessage: String?

    @State private var pickerOpen = false
    @State private var uploading = false
    @State private var preview: LeadgridImportPreview?
    @State private var mapping: [String: String] = [:]
    @State private var dedupe: String = "email"
    @State private var commitResult: LeadgridImportCommit?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let result = commitResult {
                    successView(result)
                } else if let preview {
                    previewView(preview)
                } else {
                    uploadPromptView
                }
            }
            .padding()
        }
        .fileImporter(
            isPresented: $pickerOpen,
            allowedContentTypes: csvUTTypes,
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                if let url = urls.first {
                    Task { await handleFile(url: url) }
                }
            case .failure(let err):
                statusMessage = "Kunne ikke velge fil: \(err.localizedDescription)"
            }
        }
    }

    private var csvUTTypes: [UTType] {
        var types: [UTType] = [.commaSeparatedText]
        if let csv = UTType(filenameExtension: "csv") { types.append(csv) }
        if let xlsx = UTType(filenameExtension: "xlsx") { types.append(xlsx) }
        if let xls = UTType(filenameExtension: "xls") { types.append(xls) }
        return types
    }

    private var uploadPromptView: some View {
        VStack(spacing: 16) {
            Image(systemName: "tablecells.fill")
                .font(.system(size: 56))
                .foregroundStyle(.purple)
            Text("Velg en CSV- eller Excel-fil")
                .font(.title3.bold())
            Text("Maks 10 MB. Vi auto-detekterer Bedrift / E-post / Telefon / By osv.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                pickerOpen = true
            } label: {
                Label("Velg fil", systemImage: "folder")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(.purple)
            .disabled(uploading)

            if uploading {
                ProgressView("Laster opp og parser …")
                    .padding(.top)
            }
        }
        .padding(.top, 40)
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func previewView(_ p: LeadgridImportPreview) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "doc.text.fill").foregroundStyle(.purple)
                Text(p.fileName).font(.subheadline.bold())
                Spacer()
                Text("\(p.totalRows) rader").font(.caption).foregroundStyle(.secondary)
            }
            Divider()

            Text("AUTO-DETEKTERT MAPPING")
                .font(.caption2.bold())
                .foregroundStyle(.secondary)
            ForEach(mappingPreview, id: \.target) { row in
                HStack {
                    Text(row.target).font(.caption)
                    Spacer()
                    Text(row.source ?? "— ikke importer —")
                        .font(.caption.monospaced())
                        .foregroundStyle(row.source != nil ? Color.primary : Color.secondary)
                }
            }
            Divider()

            Text("DUPLIKAT-STRATEGI")
                .font(.caption2.bold())
                .foregroundStyle(.secondary)
            Picker("", selection: $dedupe) {
                Text("E-post").tag("email")
                Text("Telefon").tag("phone")
                Text("Navn + by").tag("name+city")
                Text("Ingen").tag("none")
            }
            .pickerStyle(.segmented)

            if mapping["name"] == nil {
                Label("Fant ingen kolonne for bedriftsnavn — last opp en annen fil.",
                      systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }

            Button {
                Task { await commit(p) }
            } label: {
                Label("Importér \(p.totalRows) rader", systemImage: "square.and.arrow.down.fill")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(.purple)
            .disabled(uploading || mapping["name"] == nil)

            Button("Velg annen fil") {
                preview = nil
                mapping = [:]
            }
            .padding(.top, 4)
        }
    }

    private func successView(_ result: LeadgridImportCommit) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.green)
            Text("\(result.imported) leads importert")
                .font(.title3.bold())
            HStack(spacing: 8) {
                Label("\(result.skippedDuplicates) dupl.", systemImage: "doc.on.doc")
                    .font(.caption)
                if result.errorsCount > 0 {
                    Label("\(result.errorsCount) feil", systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            Button("Importér ny fil") {
                preview = nil
                commitResult = nil
                mapping = [:]
            }
            .buttonStyle(.bordered)
        }
        .padding(.top, 40)
        .frame(maxWidth: .infinity)
    }

    private var mappingPreview: [(target: String, source: String?)] {
        let targets: [(String, String)] = [
            ("Navn", "name"), ("E-post", "email"), ("Telefon", "phone"),
            ("Adresse", "address"), ("By", "city"), ("Postnr", "postal_code"),
            ("Nettside", "website_url"), ("Bransje", "industry"),
        ]
        return targets.map { ($0.0, mapping[$0.1]) }
    }

    @MainActor
    private func handleFile(url: URL) async {
        statusMessage = nil
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        do {
            let data = try Data(contentsOf: url)
            uploading = true
            defer { uploading = false }
            let mime = mimeType(for: url)
            guard let api = appState.api else {
                statusMessage = "Innlogging utløpt"
                return
            }
            let p = try await api.uploadImportFile(
                data: data,
                fileName: url.lastPathComponent,
                mimeType: mime,
            )
            preview = p
            mapping = autoDetectMapping(columns: p.columns)
        } catch {
            statusMessage = "Opplasting feilet: \(error.localizedDescription)"
        }
    }

    private func mimeType(for url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "csv": return "text/csv"
        case "xlsx", "xlsm":
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        case "xls": return "application/vnd.ms-excel"
        default: return "application/octet-stream"
        }
    }

    private func autoDetectMapping(columns: [String]) -> [String: String] {
        var m: [String: String] = [:]
        let lower = columns.map { $0.lowercased().trimmingCharacters(in: .whitespaces) }
        func find(_ candidates: [String]) -> String? {
            for c in candidates {
                if let i = lower.firstIndex(where: { $0 == c || $0.contains(c) }) {
                    return columns[i]
                }
            }
            return nil
        }
        if let v = find(["bedrift", "firma", "navn", "company", "name"]) { m["name"] = v }
        if let v = find(["e-post", "epost", "email", "mail"]) { m["email"] = v }
        if let v = find(["telefon", "phone", "tlf", "mobil"]) { m["phone"] = v }
        if let v = find(["by", "city", "sted", "poststed"]) { m["city"] = v }
        if let v = find(["adresse", "address", "gate"]) { m["address"] = v }
        if let v = find(["postnummer", "postnr", "postal", "zip"]) { m["postal_code"] = v }
        if let v = find(["nettside", "website", "web", "url"]) { m["website_url"] = v }
        if let v = find(["bransje", "industry", "industri"]) { m["industry"] = v }
        return m
    }

    @MainActor
    private func commit(_ p: LeadgridImportPreview) async {
        guard let api = appState.api else { return }
        uploading = true
        defer { uploading = false }
        do {
            let res = try await api.commitImportCsv(
                fileToken: p.fileToken,
                mapping: mapping,
                dedupeStrategy: dedupe,
            )
            commitResult = res
            await appState.refreshAll()
        } catch {
            statusMessage = "Import feilet: \(error.localizedDescription)"
        }
    }
}

// MARK: - URL Research-tab
//
// Ny flyt (mig 328):
//   1. URL-input + "Start research"-knapp.
//   2. Kall /start → draftLeadId + research_job_id.
//   3. Kall /run → vis LeadResearchProgressView-stil progress mens
//      orchestrator kjører (10-30s).
//   4. Når .ready: vis preview m/ brand kit, lokasjons-badge, kontakt,
//      socials, estimated value/score, og knappene
//      "Legg til som lead" + "Forkast".
//   5. Ved commit: hent oppdatert lead-objekt, append til AppState.leads
//      hvis lat/lng er populert → MapScreen tegner pin automatisk.

@MainActor
struct LeadgridUrlResearchView: View {
    @Environment(AppState.self) private var appState
    @Binding var statusMessage: String?

    @State private var urlText: String = ""
    @State private var stage: Stage = .idle
    @State private var draftLeadId: String?
    @State private var lastRun: UrlResearchRunResponse?
    @State private var overrides = UrlResearchOverrides()
    @State private var committing = false
    @State private var committedLead: UrlResearchDraftLead?

    /// Bulk-modus (mig 0351): brukeren limer inn N URLer separert med newline.
    @State private var subMode: SubMode = .single
    @State private var bulkUrlsText: String = ""
    @State private var bulkStarting = false
    @State private var bulkBatchId: String?
    @State private var bulkTotalUrls: Int = 0

    enum SubMode: String, CaseIterable, Identifiable {
        case single, bulk
        var id: String { rawValue }
        var label: String {
            switch self {
            case .single: return "Enkelt URL"
            case .bulk:   return "Flere URLs"
            }
        }
    }

    enum Stage: Equatable {
        case idle
        case running
        case ready
        case committed
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if bulkBatchId == nil {
                    Picker("", selection: $subMode) {
                        ForEach(SubMode.allCases) { m in
                            Text(m.label).tag(m)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.top, 4)
                }

                if let batchId = bulkBatchId {
                    LeadgridBulkUrlResearchProgressView(
                        statusMessage: $statusMessage,
                        batchId: batchId,
                        totalUrls: bulkTotalUrls,
                        onStartOver: resetBulkState,
                        onClose: resetBulkState,
                    )
                } else if subMode == .bulk {
                    bulkInputArea
                } else {
                    singleModeContent
                }
            }
            .padding()
        }
    }

    @ViewBuilder
    private var singleModeContent: some View {
        switch stage {
        case .idle:
            inputArea
        case .running:
            runningView
        case .ready:
            if let run = lastRun {
                previewView(run)
            }
        case .committed:
            if let lead = committedLead {
                successView(lead)
            }
        }
    }

    // MARK: - Bulk input

    private var bulkInputArea: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Image(systemName: "list.bullet.rectangle.portrait.fill")
                        .foregroundStyle(.purple)
                    Text("Flere URLs").font(.subheadline.bold())
                }
                Text("Lim inn 1–100 URL-er (én per linje). Leadgrid Agent kjører research på hver og rapporterer live: \"X av Y leads lagt til på kartet\".")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            // Multi-line tekst-editor for URL-er
            TextEditor(text: $bulkUrlsText)
                .frame(minHeight: 180)
                .padding(8)
                .background(Color(.secondarySystemBackground),
                            in: RoundedRectangle(cornerRadius: 8))
                .font(.callout.monospaced())
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)

            HStack {
                Text("\(parsedUrlCount) URL-er klare")
                    .font(.caption2.monospaced())
                    .foregroundStyle(.secondary)
                Spacer()
            }

            Button {
                Task { await startBulkResearch() }
            } label: {
                if bulkStarting {
                    ProgressView().controlSize(.small)
                        .frame(maxWidth: .infinity, minHeight: 44)
                } else {
                    Label("Start research", systemImage: "sparkles")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.purple)
            .disabled(bulkStarting || parsedUrlCount == 0 || parsedUrlCount > 100)
            if parsedUrlCount > 100 {
                Label("Maks 100 URL-er per batch — del opp i flere batcher.",
                      systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
        .padding(.top, 12)
    }

    private var parsedUrlCount: Int {
        parseBulkUrls(bulkUrlsText).count
    }

    private func parseBulkUrls(_ text: String) -> [String] {
        text
            .split(whereSeparator: { $0.isNewline || $0 == "," || $0 == ";" })
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    @MainActor
    private func startBulkResearch() async {
        guard let api = appState.api else {
            statusMessage = "Innlogging utløpt"
            return
        }
        let urls = parseBulkUrls(bulkUrlsText)
        guard !urls.isEmpty else { return }
        bulkStarting = true
        statusMessage = nil
        defer { bulkStarting = false }
        do {
            let resp = try await api.startBulkUrlResearch(urls)
            bulkBatchId = resp.batchId
            bulkTotalUrls = resp.totalUrls
        } catch {
            statusMessage = "Kunne ikke starte: \(error.localizedDescription)"
        }
    }

    private func resetBulkState() {
        bulkBatchId = nil
        bulkTotalUrls = 0
        bulkUrlsText = ""
        subMode = .bulk
    }

    // MARK: - Sub-views

    private var inputArea: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Image(systemName: "sparkle.magnifyingglass")
                        .foregroundStyle(.purple)
                    Text("URL Research")
                        .font(.subheadline.bold())
                }
                Text("Lim inn en nettside — Leadgrid bygger lead, finner pin på kartet og fyller inn alt vi vet om selskapet.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            TextField("acme.no  eller  https://acme.no", text: $urlText)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.URL)
                .padding(10)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 8))
                .font(.callout.monospaced())

            Button {
                Task { await startResearch() }
            } label: {
                Label("Start research", systemImage: "sparkles")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(.purple)
            .disabled(urlText.trimmingCharacters(in: .whitespaces).isEmpty)
        }
        .padding(.top, 16)
    }

    private var runningView: some View {
        VStack(spacing: 24) {
            ProgressView()
                .controlSize(.large)
                .tint(.purple)
                .padding(.top, 40)
            Text("Leadgrid Agent jobber …")
                .font(.title3.weight(.semibold))
            VStack(alignment: .leading, spacing: 10) {
                phaseRow(symbol: "globe", label: "Henter nettside-innhold")
                phaseRow(symbol: "building.columns", label: "Slår opp i Brønnøysund")
                phaseRow(symbol: "mappin.and.ellipse", label: "Finner Google Places-signaler")
                phaseRow(symbol: "brain.head.profile", label: "Claude syntetiserer brand kit")
                phaseRow(symbol: "map", label: "Setter pin på kartet")
            }
            .padding()
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))

            Text("Tar typisk 10-30 sekunder.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func phaseRow(symbol: String, label: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: symbol)
                .foregroundStyle(.purple)
                .frame(width: 22)
            Text(label).font(.callout)
        }
    }

    private func previewView(_ run: UrlResearchRunResponse) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            locationConfidenceBadge(run.locationConfidence)
            brandKitCard(run.researchResult.companyProfile)
            if run.locationConfidence.requiresManualVerification {
                manualPinHint(run.researchResult.location)
            }
            contactCard(run.researchResult.companyProfile)
            socialsCard(run.researchResult.companyProfile.socials)

            HStack(spacing: 12) {
                Button(role: .destructive) {
                    Task { await discard() }
                } label: {
                    Label("Forkast", systemImage: "trash")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.bordered)
                .disabled(committing)

                Button {
                    Task { await commit() }
                } label: {
                    Label("Legg til som lead", systemImage: "checkmark.circle.fill")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(.purple)
                .disabled(committing)
            }
            .padding(.top, 8)
        }
    }

    private func locationConfidenceBadge(_ confidence: LocationConfidence) -> some View {
        let (symbol, tint): (String, Color) = {
            switch confidence {
            case .exact:       return ("checkmark.circle.fill", .green)
            case .geocoded:    return ("location.fill", .yellow)
            case .approximate: return ("mappin.slash", .orange)
            case .unknown:     return ("xmark.circle.fill", .red)
            }
        }()
        return HStack(spacing: 10) {
            Image(systemName: symbol).foregroundStyle(tint)
            VStack(alignment: .leading, spacing: 2) {
                Text("Lokasjon").font(.caption2.bold()).foregroundStyle(.secondary)
                Text(confidence.label).font(.subheadline)
            }
            Spacer()
        }
        .padding(12)
        .background(tint.opacity(0.10), in: RoundedRectangle(cornerRadius: 10))
    }

    private func brandKitCard(_ profile: UrlResearchCompanyProfile) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
                if let logoUrl = profile.logoUrl, let url = URL(string: logoUrl) {
                    AsyncImage(url: url) { phase in
                        if case let .success(image) = phase {
                            image.resizable().aspectRatio(contentMode: .fit)
                        } else {
                            Color.purple.opacity(0.15)
                        }
                    }
                    .frame(width: 56, height: 56)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                } else {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color.purple.opacity(0.15))
                        .frame(width: 56, height: 56)
                        .overlay(
                            Image(systemName: "building.2.fill")
                                .foregroundStyle(.purple)
                        )
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(profile.name ?? "Uten navn").font(.headline)
                    if let industry = profile.industry {
                        Text(industry).font(.caption).foregroundStyle(.secondary)
                    }
                    if let org = profile.organizationNumber {
                        Text("Org.nr \(org)").font(.caption2.monospaced())
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
            }
            if let summary = profile.summary, !summary.isEmpty {
                Text(summary).font(.callout).foregroundStyle(.primary)
            }
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
    }

    private func contactCard(_ profile: UrlResearchCompanyProfile) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("KONTAKT").font(.caption2.bold()).foregroundStyle(.secondary)
            row(symbol: "globe", value: profile.website)
            row(symbol: "envelope", value: profile.email)
            row(symbol: "phone", value: profile.phone)
        }
        .padding(12)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
    }

    private func socialsCard(_ socials: UrlResearchSocials) -> some View {
        let hasAny = socials.instagram != nil || socials.linkedin != nil || socials.facebook != nil
        return Group {
            if hasAny {
                VStack(alignment: .leading, spacing: 8) {
                    Text("SOSIALE PROFILER").font(.caption2.bold()).foregroundStyle(.secondary)
                    row(symbol: "camera", value: socials.instagram)
                    row(symbol: "person.crop.rectangle.stack", value: socials.linkedin)
                    row(symbol: "person.2", value: socials.facebook)
                }
                .padding(12)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    @ViewBuilder
    private func row(symbol: String, value: String?) -> some View {
        if let v = value, !v.isEmpty {
            HStack(spacing: 10) {
                Image(systemName: symbol)
                    .foregroundStyle(.purple)
                    .frame(width: 22)
                Text(v).font(.callout).lineLimit(1).truncationMode(.middle)
                Spacer()
            }
        }
    }

    private func manualPinHint(_ location: UrlResearchResolvedLocation) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Sett pin manuelt for best presisjon",
                  systemImage: "hand.point.up.left")
                .font(.subheadline.bold())
                .foregroundStyle(.orange)
            Text(location.city.map { "By: \($0)" } ?? "Ingen by funnet — bruk knappen til å sette koordinater før commit.")
                .font(.caption).foregroundStyle(.secondary)
            // For nå: enkel TextField for lat/lng. En full kart-velger
            // kommer i Fase 2 (gjenbruker MKMapView annotation-drag fra
            // MapScreen).
            HStack {
                TextField("Lat (f.eks. 59.913)", text: Binding(
                    get: { overrides.latitude.map { String($0) } ?? "" },
                    set: { overrides.latitude = Double($0) },
                ))
                .keyboardType(.decimalPad)
                .padding(6)
                .background(Color(.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 6))
                TextField("Lng (f.eks. 10.752)", text: Binding(
                    get: { overrides.longitude.map { String($0) } ?? "" },
                    set: { overrides.longitude = Double($0) },
                ))
                .keyboardType(.decimalPad)
                .padding(6)
                .background(Color(.tertiarySystemBackground), in: RoundedRectangle(cornerRadius: 6))
            }
            .font(.callout.monospaced())
        }
        .padding(12)
        .background(Color.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    private func successView(_ lead: UrlResearchDraftLead) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "mappin.and.ellipse")
                .font(.system(size: 64))
                .foregroundStyle(.green)
            Text("Lead lagt til")
                .font(.title3.bold())
            if let name = lead.name {
                Text(name).font(.callout).foregroundStyle(.secondary)
            }
            if lead.latitude != nil && lead.longitude != nil {
                Text("Pinen er på kartet")
                    .font(.caption).foregroundStyle(.green)
            } else {
                Text("Mangler koordinater — åpne lead-detaljer for å sette pin manuelt")
                    .font(.caption).foregroundStyle(.orange)
                    .multilineTextAlignment(.center)
            }
            Button("Research en ny URL") {
                resetState()
            }
            .buttonStyle(.bordered)
        }
        .padding(.top, 30)
        .frame(maxWidth: .infinity)
    }

    // MARK: - Actions

    private func resetState() {
        urlText = ""
        stage = .idle
        draftLeadId = nil
        lastRun = nil
        overrides = UrlResearchOverrides()
        committedLead = nil
    }

    @MainActor
    private func startResearch() async {
        guard let api = appState.api else {
            statusMessage = "Innlogging utløpt"
            return
        }
        statusMessage = nil
        stage = .running
        do {
            let start = try await api.startUrlResearch(urlText)
            draftLeadId = start.draftLeadId
            let run = try await api.runUrlResearch(draftLeadId: start.draftLeadId)
            lastRun = run
            stage = .ready
        } catch {
            statusMessage = "Research feilet: \(error.localizedDescription)"
            stage = .idle
        }
    }

    @MainActor
    private func commit() async {
        guard let api = appState.api, let id = draftLeadId else { return }
        committing = true
        defer { committing = false }
        do {
            let res = try await api.commitDraftLead(
                draftLeadId: id, accept: true, overrides: overrides)
            committedLead = res.lead
            stage = .committed
            // Pin-garanti: hvis lat/lng er populert, injekt direkte i
            // AppState.leads slik at MapScreen rendrer pin umiddelbart
            // uten å vente på refreshAll-syklusen.
            if let leadModel = res.lead?.toLeadModelForMap() {
                if !appState.leads.contains(where: { $0.id == leadModel.id }) {
                    appState.leads.append(leadModel)
                }
            }
            // Refresh i bakgrunnen så vi får eventuelle felter vi ikke
            // satte selv (assignment, projectId, etc.).
            Task { await appState.refreshAll() }
        } catch {
            statusMessage = "Commit feilet: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func discard() async {
        guard let api = appState.api, let id = draftLeadId else {
            resetState()
            return
        }
        do {
            _ = try await api.commitDraftLead(
                draftLeadId: id, accept: false, overrides: nil)
        } catch {
            statusMessage = "Forkasting feilet: \(error.localizedDescription)"
        }
        resetState()
    }
}
