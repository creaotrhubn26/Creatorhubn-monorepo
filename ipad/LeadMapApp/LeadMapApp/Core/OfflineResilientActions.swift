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

    /// Aksepter NBA — hvis online forsøker vi direkte, ellers queue.
    /// Returnerer true hvis kallet gikk gjennom umiddelbart, false hvis enqueued.
    @discardableResult
    static func acceptRecommendation(api: APIClient, id: String) async -> Bool {
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
            endpoint: "/api/leadgrid/intelligence/recommendations/\(id)/accept",
            httpMethod: "POST",
            bodyJson: body
        ))
        return false
    }

    /// Dismiss NBA — som accept, men dismiss-endpoint.
    @discardableResult
    static func dismissRecommendation(api: APIClient, id: String) async -> Bool {
        if NetworkMonitor.shared.isOnline {
            do {
                _ = try await api.dismissRecommendation(id)
                return true
            } catch { }
        }
        await OfflineActionQueue.shared.enqueue(.init(
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
            endpoint: "/api/leadgrid/intelligence/recommendations/\(id)/execute",
            httpMethod: "POST",
            bodyJson: body
        ))
        return false
    }

    /// Lead-status-update — også resilient.
    @discardableResult
    static func updateLeadStatus(api: APIClient, leadId: String, status: String) async -> Bool {
        if NetworkMonitor.shared.isOnline {
            do {
                try await api.updateStatus(leadId: leadId, status: status)
                return true
            } catch { }
        }
        let body = try? JSONSerialization.data(withJSONObject: ["status": status])
        await OfflineActionQueue.shared.enqueue(.init(
            endpoint: "/api/admin-room/lead-map/leads/\(leadId)/status",
            httpMethod: "PATCH",
            bodyJson: body
        ))
        return false
    }
}
