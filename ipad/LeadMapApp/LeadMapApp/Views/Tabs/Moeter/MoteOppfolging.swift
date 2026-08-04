// MoteOppfolging.swift — etter-møte-triggeren («logget ut»-halvdelen av
// «aldri uforberedt»)
//
// Forskningen: oppfølging innen én time gir 7× høyere kvalifisering, og
// 80 % av møtet er glemt innen 24 timer. Det som ikke dukker opp av seg
// selv, blir ikke gjort — så etterarbeidet TRIGGES:
//   1. Tidsbasert: sluttid passert + ikke logget → «Logg møtet»-CTA + badge
//   2. Lokal push ved møteslutt («Hvordan gikk møtet med X?») → deep-link
//   3. Varselet avlyses i det møtet faktisk logges

import Foundation
import UserNotifications

/// Hvilke møter er logget (etterarbeid fullført)? Lokal, lettvekts —
/// møteloggen i backend er sannheten per selskap; dette er per-MØTE-flagget
/// som styrer CTA/badge/varsel på enheten.
enum MoteLoggStatus {
    private static let key = "leadgrid.mote_logget_ids"

    static func erLogget(_ id: UUID) -> Bool {
        (UserDefaults.standard.stringArray(forKey: key) ?? [])
            .contains(id.uuidString)
    }

    static func merkLogget(_ id: UUID) {
        var ids = UserDefaults.standard.stringArray(forKey: key) ?? []
        guard !ids.contains(id.uuidString) else { return }
        ids.append(id.uuidString)
        // Cap: gamle møter trenger ikke huskes evig.
        if ids.count > 300 { ids.removeFirst(ids.count - 300) }
        UserDefaults.standard.set(ids, forKey: key)
    }
}

/// Lokale «logg møtet»-varsler ved møteslutt. Ingen backend — fungerer
/// også når appen er lukket (selgeren setter seg i bilen).
enum MoteVarsler {
    static func identifikator(_ id: UUID) -> String { "etterMote-\(id.uuidString)" }

    /// Planlegg varsel ved hvert møtes sluttid (framtidige, uloggede).
    /// Re-planlegging med samme identifier erstatter — trygt å kalle ofte.
    static func planlegg(moter: [(id: UUID, selskap: String, slutt: Date)]) {
        let senter = UNUserNotificationCenter.current()
        for m in moter {
            guard m.slutt > Date(), !MoteLoggStatus.erLogget(m.id) else { continue }
            let innhold = UNMutableNotificationContent()
            innhold.title = "Hvordan gikk møtet med \(m.selskap)?"
            innhold.body = "Logg det nå — 2 min. Oppfølging innen timen vinner avtaler."
            innhold.sound = .default
            innhold.userInfo = [
                "event_type": "etter_mote",
                "mote_id": m.id.uuidString,
                "selskap": m.selskap,
            ]
            let trigger = UNTimeIntervalNotificationTrigger(
                timeInterval: max(60, m.slutt.timeIntervalSinceNow), repeats: false)
            senter.add(UNNotificationRequest(
                identifier: identifikator(m.id), content: innhold, trigger: trigger))
        }
    }

    /// Møtet er logget (eller flyttet) → varselet er utdatert.
    static func avlys(_ id: UUID) {
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: [identifikator(id)])
    }
}
