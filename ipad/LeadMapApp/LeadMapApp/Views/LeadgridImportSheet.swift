// LeadgridImportSheet.swift
//
// Bottom-sheet for å importere leads til Leadgrid fra iPad. To moduser:
//
//   1. CSV / Excel  — DocumentPicker → preview → enkel auto-mapping →
//                     commit. Vi viser ikke full column-mapping på iPad
//                     (det er en web-flate), men vi sender mappingen vi
//                     auto-utleder.
//   2. URL          — TextEditor m/ 1-20 URLer, scrape via Claude,
//                     velg leads m/ checkmarks, commit.
//
// Bruker eksisterende APIClient-metoder (uploadImportFile, scrapeUrls,
// commitImportCsv, commitImportUrls).

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
            case .url: return "URL / SoMe"
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
                    UrlImportTab(statusMessage: $statusMessage)
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

// MARK: - URL-tab

@MainActor
private struct UrlImportTab: View {
    @Environment(AppState.self) private var appState
    @Binding var statusMessage: String?

    @State private var urlText: String = ""
    @State private var scraping = false
    @State private var results: [LeadgridImportScrapeItem] = []
    @State private var selected: Set<String> = []
    @State private var committing = false
    @State private var commitResult: LeadgridImportCommit?

    private var urls: [String] {
        urlText
            .split(whereSeparator: { $0.isNewline })
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let result = commitResult {
                    successView(result)
                } else {
                    inputArea
                    if !results.isEmpty {
                        resultsList
                    }
                }
            }
            .padding()
        }
    }

    private var inputArea: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "link").foregroundStyle(.purple)
                Text("URL-er (én per linje)").font(.subheadline.bold())
                Spacer()
                Text("\(urls.count) / 20").font(.caption).foregroundStyle(.secondary)
            }
            TextEditor(text: $urlText)
                .font(.callout.monospaced())
                .frame(minHeight: 120)
                .padding(6)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 8))

            Button {
                Task { await scrape() }
            } label: {
                Label(
                    scraping ? "Ekstraherer …" : "Ekstraher \(urls.count) URLer",
                    systemImage: "sparkles"
                )
                .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(.purple)
            .disabled(scraping || urls.isEmpty || urls.count > 20)

            if scraping {
                ProgressView()
            }
        }
    }

    private var resultsList: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("RESULTAT").font(.caption2.bold()).foregroundStyle(.secondary)
                Spacer()
                let okCount = results.filter { $0.lead != nil }.count
                let errCount = results.filter { $0.error != nil }.count
                Text("\(okCount) OK · \(errCount) feil")
                    .font(.caption).foregroundStyle(.secondary)
            }

            ForEach(results) { item in
                resultRow(item)
            }

            Button {
                Task { await commit() }
            } label: {
                Label(
                    committing ? "Importerer …" : "Importér \(selected.count) valgte",
                    systemImage: "square.and.arrow.down.fill"
                )
                .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .tint(.purple)
            .disabled(committing || selected.isEmpty)
        }
    }

    @ViewBuilder
    private func resultRow(_ item: LeadgridImportScrapeItem) -> some View {
        if let err = item.error {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.url).font(.caption.monospaced()).lineLimit(1)
                Text("❌ \(err)").font(.caption).foregroundStyle(.red)
            }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
        } else if let lead = item.lead {
            Button {
                if selected.contains(item.url) { selected.remove(item.url) }
                else { selected.insert(item.url) }
            } label: {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: selected.contains(item.url)
                          ? "checkmark.square.fill" : "square")
                        .foregroundStyle(.purple)
                        .font(.title3)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(lead.name ?? "(uten navn)").font(.subheadline.bold())
                        Text(item.url).font(.caption2.monospaced())
                            .foregroundStyle(.secondary).lineLimit(1)
                        HStack(spacing: 6) {
                            if let v = lead.email { chip(v) }
                            if let v = lead.phone { chip(v) }
                            if let v = lead.city { chip(v) }
                            if let s = lead.leadQualityScore {
                                chip("Score \(s)").foregroundStyle(.purple)
                            }
                        }
                    }
                }
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemBackground),
                            in: RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
        }
    }

    private func chip(_ text: String) -> some View {
        Text(text)
            .font(.caption2)
            .padding(.horizontal, 6).padding(.vertical, 2)
            .background(Color.purple.opacity(0.12), in: Capsule())
            .lineLimit(1)
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
            Button("Importér flere") {
                commitResult = nil
                results = []
                selected = []
                urlText = ""
            }
            .buttonStyle(.bordered)
        }
        .padding(.top, 40)
        .frame(maxWidth: .infinity)
    }

    @MainActor
    private func scrape() async {
        guard let api = appState.api else {
            statusMessage = "Innlogging utløpt"
            return
        }
        statusMessage = nil
        scraping = true
        defer { scraping = false }
        do {
            let res = try await api.scrapeUrls(urls)
            results = res.results
            selected = Set(res.results.compactMap { $0.lead != nil ? $0.url : nil })
        } catch {
            statusMessage = "Scraping feilet: \(error.localizedDescription)"
        }
    }

    @MainActor
    private func commit() async {
        guard let api = appState.api else { return }
        let chosen: [[String: Any]] = results.compactMap { item in
            guard selected.contains(item.url), let lead = item.lead else { return nil }
            return lead.toCommitDict()
        }
        guard !chosen.isEmpty else { return }
        // Serialiser til Data her i @MainActor-scope; Data er Sendable og
        // kan trygt sendes til actor APIClient (Swift 6 strict concurrency).
        let payload: Data
        do {
            payload = try JSONSerialization.data(withJSONObject: [
                "leads": chosen,
                "dedupe_strategy": "email",
            ])
        } catch {
            statusMessage = "Pakking feilet: \(error.localizedDescription)"
            return
        }
        committing = true
        defer { committing = false }
        do {
            let res = try await api.commitImportUrls(payload: payload)
            commitResult = res
            await appState.refreshAll()
        } catch {
            statusMessage = "Import feilet: \(error.localizedDescription)"
        }
    }
}
