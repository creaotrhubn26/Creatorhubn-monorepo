// CalendarService.swift
//
// Gratis EventKit-integrasjon: legg en shoot/booking rett i brukerens
// kalender. Write-only-tilgang (iOS 17+) → ingen lesetilgang til eksisterende
// avtaler, minst mulig personvern-fotavtrykk.

import Foundation
import EventKit

@MainActor
final class CalendarService {
    enum CalendarError: Error { case accessDenied }

    /// Legg en shoot i standardkalenderen. `durationHours` styrer sluttidspunkt.
    func addShoot(
        title: String,
        start: Date,
        durationHours: Double = 2,
        notes: String? = nil,
        location: String? = nil
    ) async throws {
        let store = EKEventStore()

        let granted: Bool
        if #available(iOS 17.0, *) {
            granted = try await store.requestWriteOnlyAccessToEvents()
        } else {
            granted = try await store.requestAccess(to: .event)
        }
        guard granted else { throw CalendarError.accessDenied }

        let event = EKEvent(eventStore: store)
        event.title = title
        event.startDate = start
        event.endDate = start.addingTimeInterval(durationHours * 3600)
        event.notes = notes
        event.location = location
        event.calendar = store.defaultCalendarForNewEvents
        try store.save(event, span: .thisEvent)
    }
}
