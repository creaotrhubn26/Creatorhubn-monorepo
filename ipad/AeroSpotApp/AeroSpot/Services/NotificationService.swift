// NotificationService.swift — lokale varsler for watchlist-treff.
// Ber om tillatelse ved første watchlist-bruk, ikke ved app-start.

import Foundation
import UserNotifications

enum NotificationService {
    static func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    /// Planlegg påminnelse på et gitt tidspunkt (f.eks. før et programpunkt).
    /// Ignoreres stille hvis tidspunktet er passert.
    static func scheduleReminder(id: String, title: String, body: String, at date: Date) {
        guard date > Date() else { return }
        requestAuthorization()
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
        let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)
        UNUserNotificationCenter.current().add(request)
    }

    static func cancelReminder(id: String) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [id])
    }

    static func fireWatchlistHit(flight: LiveFlight, airport: Airport) {
        let content = UNMutableNotificationContent()
        content.title = "\(flight.registration ?? flight.callsign) er i lufta"
        var parts: [String] = []
        if let type = flight.aircraftType { parts.append(type) }
        parts.append("\(flight.altitudeFt) ft")
        parts.append("nær \(airport.iata)")
        content.body = parts.joined(separator: " · ")
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "watchlist-\(flight.id)",
            content: content,
            trigger: nil // umiddelbart
        )
        UNUserNotificationCenter.current().add(request)
    }
}
