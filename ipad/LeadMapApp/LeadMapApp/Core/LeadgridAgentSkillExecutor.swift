// LeadgridAgentSkillExecutor.swift
// Strict local validation + explicitly confirmed execution for Leadgrid skills.

import CryptoKit
import Foundation

enum LeadgridAgentSkill: String, CaseIterable, Sendable {
    case findDuplicates = "leadgrid_find_duplicates"
    case enrichCompany = "leadgrid_enrich_company"
    case logVisit = "leadgrid_log_visit"
    case syncOfflineActions = "leadgrid_sync_offline_actions"
    case planFollowUp = "leadgrid_plan_follow_up"
    case dataQuality = "leadgrid_data_quality"

    var title: String {
        switch self {
        case .findDuplicates: return "Finn duplikater"
        case .enrichCompany: return "Berik fra BRREG"
        case .logVisit: return "Logg kontakt"
        case .syncOfflineActions: return "Synkroniser offline"
        case .planFollowUp: return "Planlegg oppfølging"
        case .dataQuality: return "Sjekk datakvalitet"
        }
    }

    var isWrite: Bool {
        [.enrichCompany, .logVisit, .syncOfflineActions, .planFollowUp].contains(self)
    }
}

enum LeadgridValidatedSkill: Sendable, Equatable {
    struct Visit: Sendable, Equatable {
        let leadId: String
        let visitType: String
        let conversationSummary: String
        let contactPerson: String?
        let notes: String?
        let newStatus: String?
        let nextAction: String?
        let nextFollowUpAt: String?
    }

    case findDuplicates(leadId: String)
    case enrichCompany(leadId: String, forceRefresh: Bool)
    case logVisit(Visit)
    case syncOfflineActions(reason: String?)
    case planFollowUp(leadId: String, at: String, action: String)
    case dataQuality(leadId: String?, limit: Int)

    var skill: LeadgridAgentSkill {
        switch self {
        case .findDuplicates: return .findDuplicates
        case .enrichCompany: return .enrichCompany
        case .logVisit: return .logVisit
        case .syncOfflineActions: return .syncOfflineActions
        case .planFollowUp: return .planFollowUp
        case .dataQuality: return .dataQuality
        }
    }
}

enum LeadgridAgentSkillValidationError: LocalizedError, Equatable {
    case unknownSkill
    case malformedInput(String)
    case leadOutsideActiveContext

    var errorDescription: String? {
        switch self {
        case .unknownSkill:
            return "Dette agentforslaget støttes ikke av denne appversjonen."
        case .malformedInput(let message):
            return message
        case .leadOutsideActiveContext:
            return "Leaden finnes ikke i aktiv organisasjon og kan derfor ikke behandles."
        }
    }
}

enum LeadgridAgentSkillValidator {
    private static let visitTypes = Set([
        "physical", "phone", "email", "online_meeting", "research",
    ])
    private static let leadStatuses = Set(LeadStatus.allCases.map(\.rawValue))

    static func validate(
        _ tool: AgentToolUse,
        allowedLeadIDs: Set<String>,
        now: Date = Date()
    ) throws -> LeadgridValidatedSkill {
        guard !tool.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              tool.id.count <= 255 else {
            throw LeadgridAgentSkillValidationError.malformedInput("Forslaget mangler en gyldig handlings-ID.")
        }
        guard let skill = LeadgridAgentSkill(rawValue: tool.name) else {
            throw LeadgridAgentSkillValidationError.unknownSkill
        }
        let data = Data(tool.inputJSON.utf8)
        let object: [String: Any]
        do {
            object = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        } catch {
            throw LeadgridAgentSkillValidationError.malformedInput("Forslaget inneholder ugyldig JSON.")
        }

        func requireAllowedKeys(_ keys: Set<String>) throws {
            let unknown = Set(object.keys).subtracting(keys)
            if !unknown.isEmpty {
                throw LeadgridAgentSkillValidationError.malformedInput(
                    "Forslaget inneholder ukjente felt: \(unknown.sorted().joined(separator: ", "))."
                )
            }
        }
        func text(_ key: String, required: Bool = false, max: Int) throws -> String? {
            guard let raw = object[key] else {
                if required {
                    throw LeadgridAgentSkillValidationError.malformedInput("Feltet \(key) mangler.")
                }
                return nil
            }
            guard let raw = raw as? String else {
                throw LeadgridAgentSkillValidationError.malformedInput("Feltet \(key) har feil type.")
            }
            let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if required && value.isEmpty {
                throw LeadgridAgentSkillValidationError.malformedInput("Feltet \(key) kan ikke være tomt.")
            }
            if value.count > max {
                throw LeadgridAgentSkillValidationError.malformedInput("Feltet \(key) er for langt.")
            }
            return value.isEmpty ? nil : value
        }
        func leadId() throws -> String {
            let id = try text("lead_id", required: true, max: 255) ?? ""
            guard allowedLeadIDs.contains(id) else {
                throw LeadgridAgentSkillValidationError.leadOutsideActiveContext
            }
            return id
        }
        func futureDate(_ key: String, required: Bool) throws -> String? {
            guard let value = try text(key, required: required, max: 64) else { return nil }
            let parser = ISO8601DateFormatter()
            parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let date = parser.date(from: value) ?? ISO8601DateFormatter().date(from: value)
            guard let date, date > now else {
                throw LeadgridAgentSkillValidationError.malformedInput(
                    "Oppfølgingstidspunktet må være gyldig ISO 8601 og ligge i fremtiden."
                )
            }
            return ISO8601DateFormatter().string(from: date)
        }

        switch skill {
        case .findDuplicates:
            try requireAllowedKeys(["lead_id"])
            return .findDuplicates(leadId: try leadId())

        case .enrichCompany:
            try requireAllowedKeys(["lead_id", "force_refresh"])
            let force: Bool
            if let raw = object["force_refresh"] {
                guard let value = raw as? Bool else {
                    throw LeadgridAgentSkillValidationError.malformedInput("force_refresh må være true eller false.")
                }
                force = value
            } else {
                force = false
            }
            return .enrichCompany(leadId: try leadId(), forceRefresh: force)

        case .logVisit:
            try requireAllowedKeys([
                "lead_id", "visit_type", "conversation_summary", "contact_person",
                "notes", "new_status", "next_action", "next_follow_up_at",
            ])
            let visitType = try text("visit_type", required: true, max: 40) ?? ""
            guard visitTypes.contains(visitType) else {
                throw LeadgridAgentSkillValidationError.malformedInput("Kontakttypen er ugyldig.")
            }
            let newStatus = try text("new_status", max: 40)
            if let newStatus, !leadStatuses.contains(newStatus) {
                throw LeadgridAgentSkillValidationError.malformedInput("Lead-statusen er ugyldig.")
            }
            return .logVisit(.init(
                leadId: try leadId(),
                visitType: visitType,
                conversationSummary: try text("conversation_summary", required: true, max: 4000) ?? "",
                contactPerson: try text("contact_person", max: 240),
                notes: try text("notes", max: 20000),
                newStatus: newStatus,
                nextAction: try text("next_action", max: 2000),
                nextFollowUpAt: try futureDate("next_follow_up_at", required: false)
            ))

        case .syncOfflineActions:
            try requireAllowedKeys(["reason"])
            return .syncOfflineActions(reason: try text("reason", max: 500))

        case .planFollowUp:
            try requireAllowedKeys(["lead_id", "next_follow_up_at", "next_action"])
            return .planFollowUp(
                leadId: try leadId(),
                at: try futureDate("next_follow_up_at", required: true) ?? "",
                action: try text("next_action", required: true, max: 2000) ?? ""
            )

        case .dataQuality:
            try requireAllowedKeys(["lead_id", "limit"])
            let id = try text("lead_id", max: 255)
            if let id, !allowedLeadIDs.contains(id) {
                throw LeadgridAgentSkillValidationError.leadOutsideActiveContext
            }
            let limit: Int
            if let raw = object["limit"] {
                guard let number = raw as? NSNumber,
                      CFGetTypeID(number) != CFBooleanGetTypeID(),
                      number.doubleValue.rounded() == number.doubleValue,
                      (1...100).contains(number.intValue) else {
                    throw LeadgridAgentSkillValidationError.malformedInput("Grensen må være et heltall fra 1 til 100.")
                }
                limit = number.intValue
            } else {
                limit = 25
            }
            return .dataQuality(leadId: id, limit: limit)
        }
    }
}

struct LeadgridAgentSkillResult: Sendable, Equatable {
    enum State: Sendable, Equatable { case completed, queued, failed }
    let state: State
    let title: String
    let detail: String
}

@MainActor
enum LeadgridAgentExecutionStore {
    private static let storageKey = "leadgrid.agent.executed-tools.v1"
    private static let maximumEntries = 500

    static func contains(organizationId: String, toolID: String) -> Bool {
        executedKeys.contains(key(organizationId: organizationId, toolID: toolID))
    }

    static func markExecuted(organizationId: String, toolID: String) {
        var keys = executedKeys.filter { $0 != key(organizationId: organizationId, toolID: toolID) }
        keys.append(key(organizationId: organizationId, toolID: toolID))
        if keys.count > maximumEntries {
            keys.removeFirst(keys.count - maximumEntries)
        }
        UserDefaults.standard.set(keys, forKey: storageKey)
    }

    private static var executedKeys: [String] {
        UserDefaults.standard.stringArray(forKey: storageKey) ?? []
    }

    private static func key(organizationId: String, toolID: String) -> String {
        "\(organizationId)|\(toolID)"
    }
}

@MainActor
struct LeadgridAgentSkillExecutor {
    let api: APIClient
    let organizationId: String
    let projectId: String
    let leads: [LeadModel]

    func execute(_ tool: AgentToolUse) async -> LeadgridAgentSkillResult {
        let validated: LeadgridValidatedSkill
        do {
            validated = try LeadgridAgentSkillValidator.validate(
                tool,
                allowedLeadIDs: Set(leads.map(\.id))
            )
        } catch {
            return .init(
                state: .failed,
                title: "Forslaget ble avvist",
                detail: error.localizedDescription
            )
        }

        do {
            switch validated {
            case .findDuplicates(let leadId):
                guard let lead = lead(leadId) else { return missingLead() }
                let matches = try await api.findLeadDuplicates(duplicateDraft(for: lead))
                    .filter { $0.id != leadId }
                let detail = matches.isEmpty
                    ? "Ingen andre sannsynlige duplikater funnet."
                    : matches.map { "\($0.name) – \($0.matchReasons.joined(separator: ", "))" }
                        .joined(separator: "\n")
                return .init(state: .completed, title: "Duplikatsjekk fullført", detail: detail)

            case .enrichCompany(let leadId, let forceRefresh):
                let enrichment = try await api.triggerEnrichment(
                    leadId: leadId,
                    forceRefresh: forceRefresh
                )
                guard let enrichment, enrichment.found else {
                    return .init(
                        state: .completed,
                        title: "Ingen BRREG-treff",
                        detail: "Leaden ble ikke endret."
                    )
                }
                let company = enrichment.company?.name ?? "Bedriften"
                let orgNumber = enrichment.orgNr.map { " (org.nr. \($0))" } ?? ""
                return .init(
                    state: .completed,
                    title: "BRREG-berikelse fullført",
                    detail: "\(company)\(orgNumber) ble hentet fra \(enrichment.source)."
                )

            case .logVisit(let visit):
                let disposition = await OfflineResilientActions.logVisit(
                    api: api,
                    organizationId: organizationId,
                    leadId: visit.leadId,
                    payload: .init(
                        visitType: visit.visitType,
                        conversationSummary: visit.conversationSummary,
                        contactPerson: visit.contactPerson,
                        notes: visit.notes,
                        newStatus: visit.newStatus,
                        nextAction: visit.nextAction,
                        nextFollowUpAt: visit.nextFollowUpAt
                    ),
                    actionId: Self.stableActionID(organizationId: organizationId, toolID: tool.id)
                )
                return result(from: disposition, sent: "Kontakten er logget.", queued: "Kontakten er lagret sikkert og sendes når nettet er tilbake.")

            case .syncOfflineActions:
                guard NetworkMonitor.shared.isOnline else {
                    return .init(state: .failed, title: "Ingen nettforbindelse", detail: "Koble til nettet og prøv synkronisering på nytt.")
                }
                let before = await OfflineActionQueue.shared.pendingCount(organizationId: organizationId)
                let drain = await OfflineActionQueue.shared.drain(api: api, organizationId: organizationId)
                let remaining = await OfflineActionQueue.shared.pendingCount(organizationId: organizationId)
                let permanent = await OfflineActionQueue.shared.failedCount(organizationId: organizationId)
                return .init(
                    state: permanent > 0 ? .failed : .completed,
                    title: "Offline-synkronisering fullført",
                    detail: "Ventet: \(before). Sendt: \(drain.success). Gjenstår: \(remaining). Krever oppfølging: \(permanent)."
                )

            case .planFollowUp(let leadId, let at, let action):
                let disposition = await OfflineResilientActions.planFollowUp(
                    api: api,
                    organizationId: organizationId,
                    leadId: leadId,
                    payload: .init(nextFollowUpAt: at, nextAction: action),
                    actionId: Self.stableActionID(organizationId: organizationId, toolID: tool.id)
                )
                return result(from: disposition, sent: "Oppfølgingen er planlagt.", queued: "Oppfølgingen er lagret sikkert og sendes når nettet er tilbake.")

            case .dataQuality(let leadId, let limit):
                let selected = leadId.map { id in leads.filter { $0.id == id } } ?? Array(leads.prefix(limit))
                let findings = Self.dataQualityFindings(for: selected)
                return .init(
                    state: .completed,
                    title: "Datakvalitet kontrollert",
                    detail: findings.isEmpty
                        ? "Ingen mangler funnet i \(selected.count) lead(s)."
                        : findings.joined(separator: "\n")
                )
            }
        } catch {
            return .init(state: .failed, title: "Handlingen feilet", detail: error.localizedDescription)
        }
    }

    static func dataQualityFindings(for leads: [LeadModel]) -> [String] {
        leads.compactMap { lead in
            var missing: [String] = []
            if lead.phone?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false { missing.append("telefon") }
            if lead.email?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false { missing.append("e-post") }
            if lead.websiteUrl?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false { missing.append("nettside") }
            if lead.address?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false { missing.append("adresse") }
            if lead.city?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false { missing.append("sted") }
            if lead.nextFollowUpAt == nil { missing.append("oppfølgingstid") }
            if lead.nextAction?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false { missing.append("neste handling") }
            if lead.industryId == nil && lead.category?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false {
                missing.append("bransje")
            }
            return missing.isEmpty ? nil : "\(lead.name): \(missing.joined(separator: ", "))"
        }
    }

    static func stableActionID(organizationId: String, toolID: String) -> UUID {
        var bytes = Array(SHA256.hash(
            data: Data("leadgrid-agent:\(organizationId):\(toolID)".utf8)
        ).prefix(16))
        bytes[6] = (bytes[6] & 0x0f) | 0x50
        bytes[8] = (bytes[8] & 0x3f) | 0x80
        return UUID(uuid: (
            bytes[0], bytes[1], bytes[2], bytes[3],
            bytes[4], bytes[5], bytes[6], bytes[7],
            bytes[8], bytes[9], bytes[10], bytes[11],
            bytes[12], bytes[13], bytes[14], bytes[15]
        ))
    }

    private func lead(_ id: String) -> LeadModel? { leads.first { $0.id == id } }

    private func missingLead() -> LeadgridAgentSkillResult {
        .init(state: .failed, title: "Leaden finnes ikke", detail: "Oppdater prosjektet og prøv igjen.")
    }

    private func result(
        from disposition: OfflineResilientActions.WriteDisposition,
        sent: String,
        queued: String
    ) -> LeadgridAgentSkillResult {
        switch disposition {
        case .sent: return .init(state: .completed, title: "Utført", detail: sent)
        case .queued: return .init(state: .queued, title: "Lagt i offline-kø", detail: queued)
        case .rejected(let message): return .init(state: .failed, title: "Avvist", detail: message)
        }
    }

    private func duplicateDraft(for lead: LeadModel) -> LeadDraft {
        let validTemperature = ["cold", "warm", "hot", "ready"].contains(lead.leadTemperature ?? "")
            ? lead.leadTemperature!
            : "warm"
        let validPipeline = ["new", "first_contact", "qualified", "meeting", "proposal", "negotiation", "won", "lost"]
            .contains(lead.pipelineStage ?? "") ? lead.pipelineStage! : "new"
        return LeadDraft(
            creationId: UUID(), organizationId: organizationId, name: lead.name,
            company: lead.company, organizationNumber: nil, websiteUrl: lead.websiteUrl,
            contactName: nil, contactRole: nil, email: lead.email, phone: lead.phone,
            address: lead.address, postalCode: lead.postalCode, city: lead.city,
            country: lead.country, latitude: lead.latitude, longitude: lead.longitude,
            googlePlaceId: lead.googlePlaceId, industryId: lead.industryId,
            industry: lead.category, employeeCountEstimate: nil,
            annualRevenueNokEstimate: nil, estimatedValue: lead.estimatedValue,
            notes: nil, leadTemperature: validTemperature, pipelineStage: validPipeline,
            leadStatus: lead.status.rawValue, nextFollowUpAt: nil, nextAction: nil,
            locationConfidence: "exact", leadSource: "agent_duplicate_check",
            projectId: projectId, rawText: nil, allowDuplicate: false
        )
    }
}
