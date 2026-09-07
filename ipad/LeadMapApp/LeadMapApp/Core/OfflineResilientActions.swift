// OfflineResilientActions.swift
//
// Robusthet-pakke 3 — wrapper-funksjoner for NBA-actions som faller
// gjennom til OfflineActionQueue når selger er offline eller backend
// feiler. UI bør oppdatere optimistisk og deretter kalle disse.
//
// Hvorfor egen fil: APIClient er en actor, og NetworkMonitor.shared er
// @MainActor. Wrapperne lever på MainActor og koordinerer begge.

import Foundation

@MainActor
enum OfflineResilientActions {

    private static func projectEndpoint(_ path: String, projectId: String) -> String {
        var components = URLComponents()
        components.queryItems = [URLQueryItem(name: "projectId", value: projectId)]
        guard let query = components.percentEncodedQuery, !query.isEmpty else { return path }
        return "\(path)?\(query)"
    }

    enum WriteDisposition: Sendable {
        case sent
        case queued
        case rejected(String)

        var isQueued: Bool {
            if case .queued = self { return true }
            return false
        }
    }

    struct AgentVisitPayload: Encodable, Sendable, Equatable {
        let visitType: String
        let conversationSummary: String
        let contactPerson: String?
        let notes: String?
        let newStatus: String?
        let nextAction: String?
        let nextFollowUpAt: String?
        let visitDatetime: String?
        let activityKind: String?
        let objectionReason: String?
        let visitLatitude: Double?
        let visitLongitude: Double?

        init(
            visitType: String,
            conversationSummary: String,
            contactPerson: String?,
            notes: String?,
            newStatus: String?,
            nextAction: String?,
            nextFollowUpAt: String?,
            visitDatetime: String? = nil,
            activityKind: String? = nil,
            objectionReason: String? = nil,
            visitLatitude: Double? = nil,
            visitLongitude: Double? = nil
        ) {
            self.visitType = visitType
            self.conversationSummary = conversationSummary
            self.contactPerson = contactPerson
            self.notes = notes
            self.newStatus = newStatus
            self.nextAction = nextAction
            self.nextFollowUpAt = nextFollowUpAt
            self.visitDatetime = visitDatetime
            self.activityKind = activityKind
            self.objectionReason = objectionReason
            self.visitLatitude = visitLatitude
            self.visitLongitude = visitLongitude
        }
    }

    struct AgentFollowUpPayload: Encodable, Sendable, Equatable {
        let nextFollowUpAt: String
        let nextAction: String
    }

    struct PondusUsagePayload: Encodable, Sendable, Equatable {
        let usageSessionId: UUID
        let leadId: String?
        let outcome: String
        let source: String
    }

    @discardableResult
    static func createLeadbookExample(
        api: APIClient,
        organizationId: String,
        projectId: String,
        body: [String: Any],
        actionId: UUID = UUID()
    ) async -> WriteDisposition {
        var payload = body
        payload["creation_id"] = actionId.uuidString.lowercased()
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload)
        else { return .rejected("Eksempelet kunne ikke klargjøres for sikker lagring.") }
        return await sendOrQueue(
            api: api,
            organizationId: organizationId,
            action: .init(
                id: actionId,
                organizationId: organizationId,
                projectId: projectId,
                endpoint: projectEndpoint(
                    "/api/leadgrid/leadbook/examples",
                    projectId: projectId),
                httpMethod: "POST",
                bodyJson: data
            )
        )
    }

    @discardableResult
    static func saveAcademyProgress(
        api: APIClient,
        organizationId: String,
        chapterId: String,
        watched: Bool,
        positionSeconds: Int,
        actionId: UUID = UUID()
    ) async -> WriteDisposition {
        let payload: [String: Any] = [
            "chapter_id": chapterId,
            "watched": watched,
            "position_seconds": max(0, min(positionSeconds, 86400))
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else {
            return .rejected("Kursprogresjonen kunne ikke klargjøres.")
        }
        return await sendOrQueue(
            api: api,
            organizationId: organizationId,
            action: .init(
                id: actionId,
                organizationId: organizationId,
                endpoint: "/api/leadgrid/academy/progress",
                httpMethod: "POST",
                bodyJson: data
            )
        )
    }

    @discardableResult
    static func addLeadbookFeedback(
        api: APIClient,
        organizationId: String,
        projectId: String,
        exampleId: String,
        payload: [String: Any],
        actionId: UUID = UUID()
    ) async -> WriteDisposition {
        var body = payload
        body["client_action_id"] = actionId.uuidString.lowercased()
        guard JSONSerialization.isValidJSONObject(body),
              let data = try? JSONSerialization.data(withJSONObject: body)
        else { return .rejected("Tilbakemeldingen kunne ikke klargjøres.") }
        return await sendOrQueue(
            api: api,
            organizationId: organizationId,
            action: .init(
                id: actionId,
                organizationId: organizationId,
                projectId: projectId,
                endpoint: projectEndpoint(
                    "/api/leadgrid/leadbook/examples/\(exampleId)/feedback",
                    projectId: projectId),
                httpMethod: "POST",
                bodyJson: data
            )
        )
    }

    @discardableResult
    static func replyLeadbookFeedback(
        api: APIClient,
        organizationId: String,
        projectId: String,
        feedbackId: String,
        body text: String,
        actionId: UUID = UUID()
    ) async -> WriteDisposition {
        guard let data = try? JSONSerialization.data(withJSONObject: [
            "body": text,
            "client_action_id": actionId.uuidString.lowercased()
        ]) else { return .rejected("Svaret kunne ikke klargjøres.") }
        return await sendOrQueue(
            api: api,
            organizationId: organizationId,
            action: .init(
                id: actionId,
                organizationId: organizationId,
                projectId: projectId,
                endpoint: projectEndpoint(
                    "/api/leadgrid/leadbook/feedback/\(feedbackId)/replies",
                    projectId: projectId),
                httpMethod: "POST",
                bodyJson: data
            )
        )
    }

    static func makePondusUsageAction(
        organizationId: String,
        templateId: UUID,
        payload: PondusUsagePayload,
        actionId: UUID
    ) throws -> OfflineActionQueue.PendingAction {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        return .init(
            id: actionId,
            organizationId: organizationId,
            endpoint: "/api/leadgrid/pondus/templates/\(templateId.uuidString.lowercased())/usage",
            httpMethod: "POST",
            bodyJson: try encoder.encode(payload)
        )
    }

    @discardableResult
    static func logPondusUsage(
        api: APIClient,
        organizationId: String,
        templateId: UUID,
        usageSessionId: UUID,
        leadId: String?,
        outcome: String,
        source: String = "ipad",
        actionId: UUID? = nil
    ) async -> WriteDisposition {
        let queueActionId = actionId ?? (outcome == "used" ? usageSessionId : UUID())
        do {
            let action = try makePondusUsageAction(
                organizationId: organizationId,
                templateId: templateId,
                payload: .init(
                    usageSessionId: usageSessionId,
                    leadId: leadId,
                    outcome: outcome,
                    source: source
                ),
                actionId: queueActionId
            )
            return await sendOrQueue(
                api: api,
                organizationId: organizationId,
                action: action
            )
        } catch {
            return .rejected("Pondus-økten kunne ikke klargjøres for sikker lagring.")
        }
    }

    struct PondusQuizPayload: Encodable, Sendable, Equatable {
        let answers: [String: Int]
    }

    @discardableResult
    static func submitPondusQuiz(
        api: APIClient,
        organizationId: String,
        answers: [String: Int],
        actionId: UUID = UUID()
    ) async -> WriteDisposition {
        let encoder = JSONEncoder()
        let body: Data
        do {
            body = try encoder.encode(PondusQuizPayload(answers: answers))
        } catch {
            return .rejected("Quiz-svarene kunne ikke klargjøres.")
        }
        return await sendOrQueue(
            api: api,
            organizationId: organizationId,
            action: .init(
                id: actionId,
                organizationId: organizationId,
                endpoint: "/api/leadgrid/pondus/quiz",
                httpMethod: "POST",
                bodyJson: body
            )
        )
    }

    static func makeAgentVisitAction(
        organizationId: String,
        projectId: String,
        leadId: String,
        payload: AgentVisitPayload,
        actionId: UUID = UUID()
    ) throws -> OfflineActionQueue.PendingAction {
        let encoder = JSONEncoder()
        let body = try encoder.encode(payload)
        return .init(
            id: actionId,
            organizationId: organizationId,
            projectId: projectId,
            endpoint: projectEndpoint(
                "/api/admin-room/lead-map/leads/\(leadId)/visits",
                projectId: projectId),
            httpMethod: "POST",
            bodyJson: body
        )
    }

    static func makeAgentFollowUpAction(
        organizationId: String,
        projectId: String,
        leadId: String,
        payload: AgentFollowUpPayload,
        actionId: UUID = UUID()
    ) throws -> OfflineActionQueue.PendingAction {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let body = try encoder.encode(payload)
        return .init(
            id: actionId,
            organizationId: organizationId,
            projectId: projectId,
            endpoint: projectEndpoint(
                "/api/admin-room/lead-map/leads/\(leadId)/follow-up",
                projectId: projectId),
            httpMethod: "PATCH",
            bodyJson: body
        )
    }

    @discardableResult
    static func logVisit(
        api: APIClient,
        organizationId: String,
        projectId: String,
        leadId: String,
        payload: AgentVisitPayload,
        actionId: UUID = UUID()
    ) async -> WriteDisposition {
        do {
            return await sendOrQueue(
                api: api,
                organizationId: organizationId,
                action: try makeAgentVisitAction(
                    organizationId: organizationId,
                    projectId: projectId,
                    leadId: leadId,
                    payload: payload,
                    actionId: actionId
                )
            )
        } catch {
            return .rejected("Besøket kunne ikke klargjøres for sikker lagring.")
        }
    }

    @discardableResult
    static func planFollowUp(
        api: APIClient,
        organizationId: String,
        projectId: String,
        leadId: String,
        payload: AgentFollowUpPayload,
        actionId: UUID = UUID()
    ) async -> WriteDisposition {
        do {
            return await sendOrQueue(
                api: api,
                organizationId: organizationId,
                action: try makeAgentFollowUpAction(
                    organizationId: organizationId,
                    projectId: projectId,
                    leadId: leadId,
                    payload: payload,
                    actionId: actionId
                )
            )
        } catch {
            return .rejected("Oppfølgingen kunne ikke klargjøres for sikker lagring.")
        }
    }

    private static func sendOrQueue(
        api: APIClient,
        organizationId: String,
        action: OfflineActionQueue.PendingAction
    ) async -> WriteDisposition {
        guard let actorUserId = await api.offlineActorUserId() else {
            return .rejected("Brukeridentiteten er ikke bekreftet. Logg inn på nytt før handlingen lagres.")
        }
        let securedAction = action.bound(actorUserId: actorUserId)
        if NetworkMonitor.shared.isOnline {
            do {
                _ = try await api.executeRaw(
                    method: securedAction.httpMethod,
                    path: securedAction.endpoint,
                    body: securedAction.bodyJson,
                    idempotencyKey: OfflineActionIdempotency.key(
                        for: securedAction,
                        organizationId: organizationId),
                    organizationId: organizationId
                )
                return .sent
            } catch APIError.forbidden {
                return .rejected("Du har ikke tilgang til organisasjonen eller leaden lenger.")
            } catch APIError.unauthorized {
                return .rejected("Økten er utløpt. Logg inn på nytt.")
            } catch APIError.idempotencyConflict {
                return .rejected("Samme handling finnes med andre data. Oppdater visningen før du prøver igjen.")
            } catch APIError.statusCode(let code) where (400...499).contains(code) && code != 429 {
                return .rejected("Handlingen ble avvist av tjeneren (HTTP \(code)).")
            } catch APIError.serverError(let code, _) where (400...499).contains(code) && code != 429 {
                return .rejected("Handlingen ble avvist av tjeneren (HTTP \(code)).")
            } catch { }
        }
        let persisted = await OfflineActionQueue.shared.enqueue(securedAction)
        return persisted
            ? .queued
            : .rejected("Handlingen kunne ikke lagres sikkert på iPad. Frigjør plass og prøv igjen.")
    }

    /// Aksepter NBA — hvis online forsøker vi direkte, ellers queue.
    /// Returnerer true hvis kallet gikk gjennom umiddelbart, false hvis enqueued.
    @discardableResult
    static func acceptRecommendation(
        api: APIClient,
        organizationId: String,
        projectId: String,
        id: String
    ) async -> Bool {
        let disposition = await sendOrQueue(
            api: api,
            organizationId: organizationId,
            action: .init(
                organizationId: organizationId,
                projectId: projectId,
                endpoint: LeadgridNBARequestPath.mutation(
                    id: id, action: "accept", projectId: projectId)))
        if case .sent = disposition { return true }
        return false
    }

    /// Dismiss NBA — som accept, men dismiss-endpoint.
    @discardableResult
    static func dismissRecommendation(
        api: APIClient,
        organizationId: String,
        projectId: String,
        id: String
    ) async -> Bool {
        let disposition = await sendOrQueue(
            api: api,
            organizationId: organizationId,
            action: .init(
                organizationId: organizationId,
                projectId: projectId,
                endpoint: LeadgridNBARequestPath.mutation(
                    id: id, action: "dismiss", projectId: projectId)))
        if case .sent = disposition { return true }
        return false
    }

    /// Execute NBA m/ outcome + notes.
    @discardableResult
    static func executeRecommendation(
        api: APIClient,
        organizationId: String,
        projectId: String,
        id: String,
        outcome: LeadgridNBAOutcome,
        notes: String?
    ) async -> Bool {
        var bodyDict: [String: Any] = ["outcome": outcome.rawValue]
        if let n = notes { bodyDict["outcome_notes"] = n }
        let body = try? JSONSerialization.data(withJSONObject: bodyDict)
        let disposition = await sendOrQueue(
            api: api,
            organizationId: organizationId,
            action: .init(
                organizationId: organizationId,
                projectId: projectId,
                endpoint: LeadgridNBARequestPath.mutation(
                    id: id, action: "execute", projectId: projectId),
                httpMethod: "POST",
                bodyJson: body))
        if case .sent = disposition { return true }
        return false
    }

    /// Lead-status-update — også resilient.
    @discardableResult
    static func updateLeadStatus(
        api: APIClient,
        organizationId: String,
        projectId: String,
        leadId: String,
        status: String,
        actionId: UUID = UUID()
    ) async -> WriteDisposition {
        guard let actorUserId = await api.offlineActorUserId() else {
            return .rejected("Brukeridentiteten er ikke bekreftet. Logg inn på nytt.")
        }
        let body = try? JSONSerialization.data(withJSONObject: ["status": status])
        let action = OfflineActionQueue.PendingAction(
            id: actionId,
            organizationId: organizationId,
            actorUserId: actorUserId,
            projectId: projectId,
            endpoint: "/api/admin-room/lead-map/leads/\(leadId)/status?projectId=\(projectId)",
            httpMethod: "PATCH",
            bodyJson: body
        )
        if NetworkMonitor.shared.isOnline {
            do {
                _ = try await api.executeRaw(
                    method: action.httpMethod,
                    path: action.endpoint,
                    body: action.bodyJson,
                    idempotencyKey: OfflineActionIdempotency.key(
                        for: action,
                        organizationId: organizationId),
                    organizationId: organizationId
                )
                return .sent
            } catch APIError.forbidden {
                return .rejected("Du har ikke tilgang til organisasjonen eller leaden lenger.")
            } catch APIError.unauthorized {
                return .rejected("Økten på iPhone er utløpt. Logg inn igjen før du prøver fra Watch.")
            } catch APIError.idempotencyConflict {
                return .rejected("Samme statushandling finnes med andre data. Oppdater Leadgrid før nytt forsøk.")
            } catch { }
        }
        let persisted = await OfflineActionQueue.shared.enqueue(action)
        return persisted
            ? .queued
            : .rejected("Handlingen kunne ikke lagres sikkert på iPhone. Åpne Leadgrid og prøv igjen.")
    }

    /// Logg telefonkontakt fra Watch. Ved nettverksfeil beholdes samme
    /// tenant-scopede, idempotente payload i offline-køen.
    @discardableResult
    static func logPhoneCall(
        api: APIClient,
        organizationId: String,
        projectId: String,
        leadId: String,
        actionId: UUID = UUID()
    ) async -> WriteDisposition {
        guard let actorUserId = await api.offlineActorUserId() else {
            return .rejected("Brukeridentiteten er ikke bekreftet. Logg inn på nytt.")
        }
        let body: [String: Any] = [
            "visitType": "phone",
            "conversationSummary": "Telefonkontakt registrert fra Apple Watch",
        ]
        let json = try? JSONSerialization.data(withJSONObject: body)
        let action = OfflineActionQueue.PendingAction(
            id: actionId,
            organizationId: organizationId,
            actorUserId: actorUserId,
            projectId: projectId,
            endpoint: "/api/admin-room/lead-map/leads/\(leadId)/visits?projectId=\(projectId)",
            httpMethod: "POST",
            bodyJson: json
        )
        if NetworkMonitor.shared.isOnline {
            do {
                _ = try await api.executeRaw(
                    method: action.httpMethod,
                    path: action.endpoint,
                    body: action.bodyJson,
                    idempotencyKey: OfflineActionIdempotency.key(
                        for: action,
                        organizationId: organizationId),
                    organizationId: organizationId
                )
                return .sent
            } catch APIError.forbidden {
                return .rejected("Du har ikke tilgang til organisasjonen eller leaden lenger.")
            } catch APIError.unauthorized {
                return .rejected("Økten på iPhone er utløpt. Logg inn igjen før du prøver fra Watch.")
            } catch APIError.idempotencyConflict {
                return .rejected("Kontakten er allerede registrert med andre data. Oppdater Leadgrid før nytt forsøk.")
            } catch { }
        }
        let persisted = await OfflineActionQueue.shared.enqueue(action)
        return persisted
            ? .queued
            : .rejected("Handlingen kunne ikke lagres sikkert på iPhone. Åpne Leadgrid og prøv igjen.")
    }


    enum LeadCreateDisposition: Sendable {
        case sent(LeadCreationResponse)
        case queued
        case duplicate([LeadDuplicateCandidate])
        case rejected(String)
    }

    /// Lager nøyaktig den køhandlingen som draines senere. Eksponert internt
    /// for kontrakttest: body, tenant og idempotency-ID må forbli identiske.
    static func makeLeadCreationAction(
        draft: LeadDraft
    ) throws -> OfflineActionQueue.PendingAction {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        let body = try encoder.encode(draft)
        return .init(
            id: draft.creationId,
            organizationId: draft.organizationId,
            endpoint: "/api/admin-room/lead-map/leads",
            httpMethod: "POST",
            bodyJson: body
        )
    }

    /// Opprett lead direkte når nettet er stabilt. Bare retrybare transport-
    /// og serverfeil havner i kø; validering, tilgang og duplikat må løses av
    /// brukeren og skal aldri gjentas automatisk.
    @discardableResult
    static func createLead(
        api: APIClient,
        draft: LeadDraft
    ) async -> LeadCreateDisposition {
        let issues = draft.validationIssues()
        if !issues.isEmpty {
            return .rejected(issues.joined(separator: "\n"))
        }
        guard let actorUserId = await api.offlineActorUserId() else {
            return .rejected("Brukeridentiteten er ikke bekreftet. Logg inn på nytt.")
        }

        let action: OfflineActionQueue.PendingAction
        do {
            action = try makeLeadCreationAction(draft: draft)
                .bound(actorUserId: actorUserId, projectId: draft.projectId)
        } catch {
            return .rejected("Lead-dataene kunne ikke klargjøres for sikker lagring.")
        }

        if NetworkMonitor.shared.isOnline {
            do {
                return .sent(try await api.createLead(draft))
            } catch LeadCreationSubmissionError.duplicate(let candidates) {
                return .duplicate(candidates)
            } catch LeadCreationSubmissionError.idempotencyConflict {
                return .rejected(
                    LeadCreationSubmissionError.idempotencyConflict.localizedDescription
                )
            } catch APIError.unauthorized {
                return .rejected("Økten er utløpt. Logg inn på nytt.")
            } catch APIError.forbidden {
                return .rejected("Du har ikke tilgang til å opprette leads i denne organisasjonen.")
            } catch APIError.statusCode(let code) {
                return .rejected("Lead-dataene ble avvist av tjeneren (HTTP \(code)).")
            } catch APIError.decodingFailure {
                return .rejected("Tjeneren svarte med et ukjent lead-format. Oppdater appen og prøv igjen.")
            } catch APIError.invalidURL {
                return .rejected("Leadgrid-adressen er ugyldig.")
            } catch {
                // Transportfeil, 429, 5xx og ugyldig/manglende respons kan
                // trygt gjentas fordi creationId er stabilt på backend.
            }
        }

        let persisted = await OfflineActionQueue.shared.enqueue(action)
        return persisted
            ? .queued
            : .rejected("Leaden kunne ikke lagres sikkert offline. Frigjør lagringsplass og prøv igjen.")
    }

}
