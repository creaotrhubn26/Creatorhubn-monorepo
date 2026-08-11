// LeadgridImportSheet.swift
//
// Bottom-sheet for å importere leads til Leadgrid fra iPad. To moduser:
//
//   1. CSV / Excel  — DocumentPicker → preview → enkel auto-mapping →
//                     commit. Vi viser ikke full column-mapping på iPad
//                     (det er en web-flate), men vi sender mappingen vi
//                     auto-utleder.
//   2. URL          — én URL inn → research via eksisterende Role Room
//                     Agent-stack (runBrandScan + Market Scan) →
//                     native preview m/ brand kit + market scan →
//                     accept/reject.
//
// URL-flyten har INGEN Claude-orchestration her — vi gjenbruker
// eksisterende, allerede testede backend-pipelines. iPad UI er fullt
// native end-to-end.

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
            case .url: return "URL / Research"
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
                    UrlResearchTab(statusMessage: $statusMessage)
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

// MARK: - URL-research-tab

@MainActor
private struct UrlResearchTab: View {
    @Environment(AppState.self) private var appState
    @Binding var statusMessage: String?

    enum Phase: Equatable {
        case input
        case researching
        case preview(LeadgridUrlResearchResult)
        case accepted(String)   // lead-id
        case rejected
    }

    @State private var urlText: String = ""
    @State private var phase: Phase = .input
    @State private var committing = false

    // Edit-bart felt-overlays (overrides) i preview-stadiet
    @State private var editName: String = ""
    @State private var editEmail: String = ""
    @State private var editPhone: String = ""
    @State private var editCity: String = ""
    @State private var editNotes: String = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                switch phase {
                case .input:
                    inputView
                case .researching:
                    researchingView
                case .preview(let result):
                    previewView(result)
                case .accepted(let leadId):
                    acceptedView(leadId: leadId)
                case .rejected:
                    rejectedView
                }
            }
            .padding()
        }
    }

    // MARK: input

    private var inputView: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(spacing: 10) {
                Image(systemName: "sparkles.rectangle.stack.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.purple)
                Text("Research en URL som lead")
                    .font(.title3.bold())
                Text("Vi kjører Role Room Agent på adressen — Brand Kit, "
                    + "markedslandskap og posisjonering — så du kan vurdere "
                    + "om den skal inn på kartet.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 24)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: "link").foregroundStyle(.purple)
                    Text("URL").font(.subheadline.bold())
                }
                TextField("acme.no eller https://acme.no", text: $urlText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .font(.callout.monospaced())
                    .padding(10)
                    .background(Color(.secondarySystemBackground),
                                in: RoundedRectangle(cornerRadius: 8))
            }

            Button {
                Task { await research() }
            } label: {
                Label("Kjør research", systemImage: "sparkles")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(.purple)
            .disabled(parsedUrl == nil)
        }
    }

    private var parsedUrl: URL? {
        let t = urlText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return nil }
        if t.lowercased().hasPrefix("http://") || t.lowercased().hasPrefix("https://") {
            return URL(string: t)
        }
        return URL(string: "https://" + t)
    }

    // MARK: researching

    private var researchingView: some View {
        VStack(spacing: 16) {
            ProgressView().scaleEffect(1.4)
            Text("Role Room Agent jobber …")
                .font(.headline)
            Text("Skanner nettside, bygger Brand Kit og oppretter Market Scan. "
                + "Tar 10–25 sek.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.top, 60)
    }

    // MARK: preview

    @ViewBuilder
    private func previewView(_ result: LeadgridUrlResearchResult) -> some View {
        if let bk = result.brandKit {
            VStack(alignment: .leading, spacing: 16) {
                headerCard(bk)
                brandKitCard(bk)
                if result.marketScanId != nil {
                    marketScanCard()
                }
                overridesCard()
                actionsCard(result: result)
                if let err = result.error {
                    Label(err, systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            }
        } else {
            failedResearchView(result: result)
        }
    }

    @ViewBuilder
    private func headerCard(_ bk: LeadgridImportBrandKit) -> some View {
        HStack(alignment: .top, spacing: 12) {
            // Logo
            if let logo = bk.logoUrl, let url = URL(string: logo) {
                AsyncImage(url: url) { img in
                    img.resizable().aspectRatio(contentMode: .fit)
                } placeholder: {
                    Image(systemName: "building.2.crop.circle.fill")
                        .foregroundStyle(.purple)
                }
                .frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            } else {
                Image(systemName: "building.2.crop.circle.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.purple)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(bk.businessName ?? "(uten navn)")
                    .font(.title3.bold())
                if let tag = bk.tagline, !tag.isEmpty {
                    Text(tag)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                Text(bk.sourceUrl)
                    .font(.caption.monospaced())
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
            }
            Spacer()
        }
        .padding()
        .background(Color.purple.opacity(0.08),
                     in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14)
                    .strokeBorder(Color.purple.opacity(0.20)))
    }

    @ViewBuilder
    private func brandKitCard(_ bk: LeadgridImportBrandKit) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Brand Kit", systemImage: "paintpalette.fill")
                .font(.headline)
                .foregroundStyle(.purple)

            if let desc = bk.description, !desc.isEmpty {
                Text(desc)
                    .font(.callout)
                    .foregroundStyle(.primary)
            }

            // Farger
            HStack(spacing: 8) {
                colorSwatch(hex: bk.colors.primary, label: "Primær")
                colorSwatch(hex: bk.colors.accent, label: "Aksent")
                colorSwatch(hex: bk.colors.secondary, label: "Sekundær")
            }

            // Industri + målgruppe + tone
            if bk.industry != nil || bk.targetAudience != nil || bk.toneOfVoice != nil {
                Divider()
                VStack(alignment: .leading, spacing: 4) {
                    if let i = bk.industry, !i.isEmpty {
                        labelRow("Industri", value: i)
                    }
                    if let t = bk.targetAudience, !t.isEmpty {
                        labelRow("Målgruppe", value: t)
                    }
                    if let tov = bk.toneOfVoice, !tov.isEmpty {
                        labelRow("Tone", value: tov)
                    }
                }
            }

            // USPs
            if !bk.usps.isEmpty {
                Divider()
                Text("USPs").font(.caption2.bold()).foregroundStyle(.secondary)
                ForEach(bk.usps, id: \.self) { u in
                    HStack(alignment: .top, spacing: 6) {
                        Text("•").foregroundStyle(.purple)
                        Text(u).font(.caption)
                    }
                }
            }

            // Sosiale kanaler
            if bk.socialLinks.linkedin != nil
                || bk.socialLinks.instagram != nil
                || bk.socialLinks.facebook != nil {
                Divider()
                HStack(spacing: 10) {
                    if bk.socialLinks.linkedin != nil {
                        Image(systemName: "person.crop.rectangle.stack.fill")
                            .foregroundStyle(.purple)
                    }
                    if bk.socialLinks.instagram != nil {
                        Image(systemName: "camera.fill")
                            .foregroundStyle(.purple)
                    }
                    if bk.socialLinks.facebook != nil {
                        Image(systemName: "person.2.fill")
                            .foregroundStyle(.purple)
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemBackground),
                     in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color.purple.opacity(0.20)))
    }

    private func marketScanCard() -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("Market Scan opprettet", systemImage: "chart.bar.doc.horizontal")
                .font(.headline)
                .foregroundStyle(.purple)
            Text("Konkurrenter, posisjonering og muligheter er klare for "
                + "full Claude-analyse. Trykk «Legg til» — så åpner du lead "
                + "for å se SWOT.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(Color.purple.opacity(0.06),
                     in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color.purple.opacity(0.20)))
    }

    private func overridesCard() -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Justér før lagring", systemImage: "pencil.circle.fill")
                .font(.headline)
                .foregroundStyle(.purple)
            TextField("Navn", text: $editName)
                .textFieldStyle(.roundedBorder)
            HStack {
                TextField("E-post", text: $editEmail)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                TextField("Telefon", text: $editPhone)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.phonePad)
            }
            TextField("By", text: $editCity)
                .textFieldStyle(.roundedBorder)
            TextField("Notater", text: $editNotes, axis: .vertical)
                .lineLimit(3, reservesSpace: true)
                .textFieldStyle(.roundedBorder)
        }
        .padding()
        .background(Color(.systemBackground),
                     in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color.purple.opacity(0.20)))
    }

    private func actionsCard(result: LeadgridUrlResearchResult) -> some View {
        VStack(spacing: 10) {
            Button {
                Task { await commit(result: result, accept: true) }
            } label: {
                Label("Legg til som lead", systemImage: "checkmark.circle.fill")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(.purple)
            .disabled(committing)

            Button(role: .destructive) {
                Task { await commit(result: result, accept: false) }
            } label: {
                Label("Forkast", systemImage: "trash")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.bordered)
            .disabled(committing)

            if committing {
                ProgressView().padding(.top, 4)
            }
        }
    }

    @ViewBuilder
    private func failedResearchView(result: LeadgridUrlResearchResult) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 56))
                .foregroundStyle(.orange)
            Text("Brand Kit-scan feilet")
                .font(.title3.bold())
            if let err = result.error {
                Text(err)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            Text("Draft-leaden er opprettet. Du kan fortsatt akseptere den "
                + "manuelt eller forkaste den.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            HStack(spacing: 12) {
                Button(role: .destructive) {
                    Task { await commit(result: result, accept: false) }
                } label: {
                    Label("Forkast", systemImage: "trash")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.bordered)

                Button {
                    Task { await commit(result: result, accept: true) }
                } label: {
                    Label("Behold likevel", systemImage: "checkmark")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .tint(.purple)
            }

            Button("Prøv ny URL") { resetForm() }
                .padding(.top, 8)
        }
        .padding(.top, 40)
        .frame(maxWidth: .infinity)
    }

    // MARK: accepted / rejected

    private func acceptedView(leadId: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.green)
            Text("Lead lagt til")
                .font(.title3.bold())
            Text("Åpne lead-detaljen for å se SWOT-analysen fra Market Scan "
                + "når Role Room Agent er ferdig.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 16)

            Button("Importér ny URL") { resetForm() }
                .buttonStyle(.bordered)
        }
        .padding(.top, 40)
        .frame(maxWidth: .infinity)
    }

    private var rejectedView: some View {
        VStack(spacing: 16) {
            Image(systemName: "xmark.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.secondary)
            Text("Draft forkastet")
                .font(.title3.bold())
            Button("Importér ny URL") { resetForm() }
                .buttonStyle(.bordered)
        }
        .padding(.top, 40)
        .frame(maxWidth: .infinity)
    }

    // MARK: helpers

    private func labelRow(_ key: String, value: String) -> some View {
        HStack(alignment: .top) {
            Text(key).font(.caption.bold()).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.caption).multilineTextAlignment(.trailing)
        }
    }

    @ViewBuilder
    private func colorSwatch(hex: String?, label: String) -> some View {
        VStack(spacing: 4) {
            RoundedRectangle(cornerRadius: 8)
                .fill(hexColor(hex) ?? Color(.secondarySystemBackground))
                .frame(height: 28)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(Color.black.opacity(0.06))
                )
            Text(label).font(.caption2).foregroundStyle(.secondary)
            if let h = hex {
                Text(h).font(.caption2.monospaced()).foregroundStyle(.tertiary)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private func hexColor(_ hex: String?) -> Color? {
        guard var s = hex?.trimmingCharacters(in: .whitespaces) else { return nil }
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let v = UInt64(s, radix: 16) else { return nil }
        let r = Double((v >> 16) & 0xFF) / 255.0
        let g = Double((v >> 8) & 0xFF) / 255.0
        let b = Double(v & 0xFF) / 255.0
        return Color(red: r, green: g, blue: b)
    }

    // MARK: actions

    @MainActor
    private func research() async {
        guard let api = appState.api, let url = parsedUrl else {
            statusMessage = "Ugyldig URL"
            return
        }
        statusMessage = nil
        phase = .researching
        do {
            let res = try await api.researchUrlAsLead(url)
            // Pre-fyll edit-feltene fra brand kit slik at overrides er
            // klare straks brukeren vil endre noe.
            editName = res.brandKit?.businessName ?? ""
            editEmail = ""
            editPhone = ""
            editCity = ""
            editNotes = res.brandKit?.description ?? ""
            phase = .preview(res)
        } catch {
            statusMessage = "Research feilet: \(error.localizedDescription)"
            phase = .input
        }
    }

    @MainActor
    private func commit(result: LeadgridUrlResearchResult, accept: Bool) async {
        guard let api = appState.api else { return }
        committing = true
        defer { committing = false }
        do {
            let overrides: LeadgridUrlCommitOverrides? = accept
                ? LeadgridUrlCommitOverrides(
                    name: nonEmpty(editName),
                    email: nonEmpty(editEmail),
                    phone: nonEmpty(editPhone),
                    city: nonEmpty(editCity),
                    address: nil,
                    industry: nil,
                    notes: nonEmpty(editNotes),
                )
                : nil
            let res = try await api.commitDraftLead(
                result.draftLeadId,
                accept: accept,
                overrides: overrides,
            )
            await appState.refreshAll()
            if accept {
                phase = .accepted(res.leadId)
                let displayName = nonEmpty(editName)
                    ?? result.brandKit?.businessName
                    ?? "Lead"
                statusMessage = "\(displayName) lagt til. "
                    + "Åpne lead for å se SWOT-analyse."
            } else {
                phase = .rejected
                statusMessage = nil
            }
        } catch {
            statusMessage = "Commit feilet: \(error.localizedDescription)"
        }
    }

    private func nonEmpty(_ s: String) -> String? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    private func resetForm() {
        urlText = ""
        editName = ""
        editEmail = ""
        editPhone = ""
        editCity = ""
        editNotes = ""
        statusMessage = nil
        phase = .input
    }
}
