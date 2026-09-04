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
                endpoint: "/api/leadgrid/leadbook/examples",
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
                endpoint: "/api/leadgrid/leadbook/examples/\(exampleId)/feedback",
                httpMethod: "POST",
                bodyJson: data
            )
        )
    }

    @discardableResult
    static func replyLeadbookFeedback(
        api: APIClient,
        organizationId: String,
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
                endpoint: "/api/leadgrid/leadbook/feedback/\(feedbackId)/replies",
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
        leadId: String,
        payload: AgentVisitPayload,
        actionId: UUID = UUID()
    ) throws -> OfflineActionQueue.PendingAction {
        let encoder = JSONEncoder()
        let body = try encoder.encode(payload)
        return .init(
            id: actionId,
            organizationId: organizationId,
            endpoint: "/api/admin-room/lead-map/leads/\(leadId)/visits",
            httpMethod: "POST",
            bodyJson: body
        )
    }

    static func makeAgentFollowUpAction(
        organizationId: String,
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
            endpoint: "/api/admin-room/lead-map/leads/\(leadId)/follow-up",
            httpMethod: "PATCH",
            bodyJson: body
        )
    }

    @discardableResult
    static func logVisit(
        api: APIClient,
        organizationId: String,
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
        if NetworkMonitor.shared.isOnline {
            do {
                _ = try await api.executeRaw(
                    method: action.httpMethod,
                    path: action.endpoint,
                    body: action.bodyJson,
                    idempotencyKey: "leadgrid:\(organizationId):\(action.id.uuidString)",
                    organizationId: organizationId
                )
                return .sent
            } catch APIError.forbidden {
                return .rejected("Du har ikke tilgang til organisasjonen eller leaden lenger.")
            } catch APIError.unauthorized {
                return .rejected("Økten er utløpt. Logg inn på nytt.")
            } catch APIError.statusCode(let code) where (400...499).contains(code) && code != 429 {
                return .rejected("Handlingen ble avvist av tjeneren (HTTP \(code)).")
            } catch APIError.serverError(let code, _) where (400...499).contains(code) && code != 429 {
                return .rejected("Handlingen ble avvist av tjeneren (HTTP \(code)).")
            } catch { }
        }
        let persisted = await OfflineActionQueue.shared.enqueue(action)
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
        id: String
    ) async -> Bool {
        if NetworkMonitor.shared.isOnline {
            do {
                _ = try await api.acceptRecommendation(id)
                return true
            } catch {
                // Fall gjennom til kø — connectivity blip eller server-feil
            }
        }
        let body = try? JSONSerialization.data(withJSONObject: ["recommendation_id": id])
        await OfflineActionQueue.shared.enqueue(.init(
            organizationId: organizationId,
            endpoint: "/api/leadgrid/intelligence/recommendations/\(id)/accept",
            httpMethod: "POST",
            bodyJson: body
        ))
        return false
    }

    /// Dismiss NBA — som accept, men dismiss-endpoint.
    @discardableResult
    static func dismissRecommendation(
        api: APIClient,
        organizationId: String,
        id: String
    ) async -> Bool {
        if NetworkMonitor.shared.isOnline {
            do {
                _ = try await api.dismissRecommendation(id)
                return true
            } catch { }
        }
        await OfflineActionQueue.shared.enqueue(.init(
            organizationId: organizationId,
            endpoint: "/api/leadgrid/intelligence/recommendations/\(id)/dismiss",
            httpMethod: "POST",
            bodyJson: nil
        ))
        return false
    }

    /// Execute NBA m/ outcome + notes.
    @discardableResult
    static func executeRecommendation(
        api: APIClient,
        organizationId: String,
        id: String,
        outcome: String,
        notes: String?
    ) async -> Bool {
        if NetworkMonitor.shared.isOnline {
            do {
                _ = try await api.executeRecommendation(id, outcome: outcome, notes: notes)
                return true
            } catch { }
        }
        var bodyDict: [String: Any] = ["outcome": outcome]
        if let n = notes { bodyDict["outcome_notes"] = n }
        let body = try? JSONSerialization.data(withJSONObject: bodyDict)
        await OfflineActionQueue.shared.enqueue(.init(
            organizationId: organizationId,
            endpoint: "/api/leadgrid/intelligence/recommendations/\(id)/execute",
            httpMethod: "POST",
            bodyJson: body
        ))
        return false
    }

    /// Lead-status-update — også resilient.
    @discardableResult
    static func updateLeadStatus(
        api: APIClient,
        organizationId: String,
        leadId: String,
        status: String,
        actionId: UUID = UUID()
    ) async -> WriteDisposition {
        let body = try? JSONSerialization.data(withJSONObject: ["status": status])
        let action = OfflineActionQueue.PendingAction(
            id: actionId,
            organizationId: organizationId,
            endpoint: "/api/admin-room/lead-map/leads/\(leadId)/status",
            httpMethod: "PATCH",
            bodyJson: body
        )
        if NetworkMonitor.shared.isOnline {
            do {
                _ = try await api.executeRaw(
                    method: action.httpMethod,
                    path: action.endpoint,
                    body: action.bodyJson,
                    idempotencyKey: "leadgrid:\(organizationId):\(actionId.uuidString)",
                    organizationId: organizationId
                )
                return .sent
            } catch APIError.forbidden {
                return .rejected("Du har ikke tilgang til organisasjonen eller leaden lenger.")
            } catch APIError.unauthorized {
                return .rejected("Økten på iPhone er utløpt. Logg inn igjen før du prøver fra Watch.")
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
        leadId: String,
        actionId: UUID = UUID()
    ) async -> WriteDisposition {
        let body: [String: Any] = [
            "visitType": "phone",
            "conversationSummary": "Telefonkontakt registrert fra Apple Watch",
        ]
        let json = try? JSONSerialization.data(withJSONObject: body)
        let action = OfflineActionQueue.PendingAction(
            id: actionId,
            organizationId: organizationId,
            endpoint: "/api/admin-room/lead-map/leads/\(leadId)/visits",
            httpMethod: "POST",
            bodyJson: json
        )
        if NetworkMonitor.shared.isOnline {
            do {
                _ = try await api.executeRaw(
                    method: action.httpMethod,
                    path: action.endpoint,
                    body: action.bodyJson,
                    idempotencyKey: "leadgrid:\(organizationId):\(actionId.uuidString)",
                    organizationId: organizationId
                )
                return .sent
            } catch APIError.forbidden {
                return .rejected("Du har ikke tilgang til organisasjonen eller leaden lenger.")
            } catch APIError.unauthorized {
                return .rejected("Økten på iPhone er utløpt. Logg inn igjen før du prøver fra Watch.")
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

        let action: OfflineActionQueue.PendingAction
        do {
            action = try makeLeadCreationAction(draft: draft)
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
