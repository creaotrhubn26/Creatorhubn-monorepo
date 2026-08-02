// LeadbookLiveStore.swift
//
// Leadbook-fanens live-datakilde (samme mønster som TeamLiveStore):
// Pondus-backenden (mig 0355/0356) har hele mal-katalogen med steg,
// innvendinger, score og versjonering — men fanen leste LeadbookData-
// mocks. Denne storen mapper PondusTemplateDTO + usage-stats (mig 0364)
// til fanens rad-modeller, og LeadbookData-getterne leser herfra når
// demo-modus er AV.
//
// Live nå: maler (m/ ekte used/conversion fra usage), innvendinger,
// KPI-tallene. Fortsatt demo-gated: steg-innhold/versjoner (trenger
// per-mal-detalj-UI — innholdet ligger på PondusTemplateDTO.steps) og
// Ytelse-modalen (trenger outcome-oppdaterings-flyt i UI først).

import SwiftUI

@MainActor
@Observable
final class LeadbookLiveStore {
    static let shared = LeadbookLiveStore()

    private(set) var templates: [LeadbookTemplate] = []
    private(set) var objections: [Objection] = []
    private(set) var stats: PondusUsageStatsDTO?
    /// Rå DTO-er per mal-id (2026-08-02): mal-editoren trenger malens EKTE
    /// steg (title/prompt/step_key) — før seedet den kanal-defaults.
    private(set) var dtosById: [UUID: PondusTemplateDTO] = [:]
    var loadState: ProjectsLoadState = .idle

    /// Ekte pondus-DTO for en mappet LeadbookTemplate (id-ene er like —
    /// mapTemplate bruker dto.id direkte). nil for demo-mocks.
    func templateDTO(for template: LeadbookTemplate) -> PondusTemplateDTO? {
        dtosById[template.id]
    }

    private weak var api: APIClient?
    private var didInitialSync = false

    private init() {}

    /// Kalles fra LeadbookView når APIClient er klar (idempotent).
    func attach(api: APIClient) {
        self.api = api
        guard !didInitialSync else { return }
        didInitialSync = true
        Task { await refresh() }
    }

    func refresh() async {
        guard let api else { return }
        if case .loaded = loadState {} else { loadState = .loading }
        do {
            async let templatesTask = api.pondusListTemplates(
                category: nil, kind: nil, publishedOnly: true
            )
            let usage: PondusUsageStatsDTO? = try? await api.pondusUsageStats()
            let dtos = try await templatesTask
            self.stats = usage
            let usageByTemplate = Dictionary(
                uniqueKeysWithValues: (usage?.templates ?? []).map { ($0.templateId, $0) }
            )
            self.templates = dtos.map { dto in
                Self.mapTemplate(dto, usage: usageByTemplate[dto.id.uuidString.lowercased()])
            }
            self.dtosById = Dictionary(uniqueKeysWithValues: dtos.map { ($0.id, $0) })
            // Innvendinger: flat liste over alle publiserte malers
            // innvendinger, dedupet på prompt.
            var seen = Set<String>()
            self.objections = dtos.flatMap(\.objections).compactMap { obj in
                let key = obj.prompt.lowercased()
                guard !seen.contains(key) else { return nil }
                seen.insert(key)
                return Objection(
                    title: "\u{22}\(obj.prompt)\u{22}",
                    response: obj.response,
                    icon: "shield.fill",
                    iconColor: LBrand.green
                )
            }
            loadState = .loaded
        } catch {
            print("[LeadbookLiveStore] refresh feilet: \(error)")
            if case .loaded = loadState {} else {
                loadState = .failed(error.localizedDescription)
            }
        }
    }

    /// «Bruk mal» — logg bruk (fire-and-forget) og oppdater tellere.
    func logUsage(_ template: LeadbookTemplate, leadId: String? = nil) {
        guard let api, let backendId = template.backendId else { return }
        Task {
            try? await api.pondusLogUsage(templateId: backendId, leadId: leadId)
            await refresh()
        }
    }

    /// Utfalls-registrering (2026-07-04): oppgraderer den ferske
    /// 'used'-raden i backend (meeting_booked/won/… erstatter, dobler
    /// ikke nevneren) → ekte møte-rater per mal.
    func logOutcome(_ template: LeadbookTemplate, outcome: String) {
        guard let api, let backendId = template.backendId else { return }
        Task {
            try? await api.pondusLogUsage(templateId: backendId, outcome: outcome)
            await refresh()
        }
    }

    // MARK: - KPI-verdier (LeadbookKPI.liveValue)

    var kpiActiveTemplates: String { "\(templates.count)" }

    var kpiUsedToday: String {
        guard let t = stats?.totals else { return "—" }
        return "\(t.usedToday)"
    }

    var kpiMeetingRate: String {
        guard let t = stats?.totals, t.used30d > 0 else { return "—" }
        return String(format: "%.1f %%", t.meetingRate30d * 100)
            .replacingOccurrences(of: ".", with: ",")
    }

    var kpiTeamAdoption: String {
        guard let t = stats?.totals else { return "—" }
        return t.distinctUsers30d == 0 ? "—" : "\(t.distinctUsers30d) aktive"
    }

    // MARK: - Mapping

    private static func mapTemplate(
        _ dto: PondusTemplateDTO,
        usage: PondusTemplateUsageStatDTO?
    ) -> LeadbookTemplate {
        let channel: LeadbookTemplate.Channel
        switch dto.kindEnum {
        case .field:     channel = .field
        case .telephone: channel = .phone
        case .email:     channel = .email
        case .video:     channel = .video
        default:         channel = .phone
        }
        let used = usage?.usedTotal ?? 0
        let conversion = usage?.meetingRate ?? 0
        // Status: høy ytelse krever både volum og rate; upublisert = review.
        let status: LeadbookTemplate.Status
        if !dto.isPublished {
            status = .underReview
        } else if used >= 10 && conversion >= 0.35 {
            status = .highPerf
        } else {
            status = .active
        }
        return LeadbookTemplate(
            id: dto.id,
            name: dto.name,
            channel: channel,
            step: max(1, dto.steps.count),
            stepTotal: max(1, dto.steps.count),
            used: used,
            conversion: conversion,
            status: status,
            backendId: dto.id.uuidString.lowercased()
        )
    }
}
