// MoteOppfolging.swift — etter-møte-triggeren («logget ut»-halvdelen av
// «aldri uforberedt»)
//
// Forskningen: oppfølging innen én time gir 7× høyere kvalifisering, og
// 80 % av møtet er glemt innen 24 timer. Det som ikke dukker opp av seg
// selv, blir ikke gjort — så etterarbeidet TRIGGES:
//   1. Tidsbasert: sluttid passert + ikke logget → «Logg møtet»-CTA + badge
//   2. Lokal push ved møteslutt («Hvordan gikk møtet med X?») → deep-link
//   3. Varselet avlyses i det møtet faktisk logges

import CoreLocation
import Foundation
import MapKit
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

    /// «Brief klar»-push kvelden før: kl. 17 i dag hvis morgendagen har
    /// møter — symmetrien til etter-møte-varselet (forberedt inn, logget ut).
    static func planleggKveldsbrief(antallIMorgen: Int) {
        guard antallIMorgen > 0 else { return }
        var comps = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        comps.hour = 17
        comps.minute = 0
        guard let tid = Calendar.current.date(from: comps), tid > Date() else { return }
        let innhold = UNMutableNotificationContent()
        innhold.title = "I morgen: \(antallIMorgen) møte\(antallIMorgen == 1 ? "" : "r")"
        innhold.body = "Møtebriefene dine er klare — les dem i kveld, eller la bilen lese dem på veien i morgen."
        innhold.sound = .default
        innhold.userInfo = ["event_type": "brief_klar"]
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        UNUserNotificationCenter.current().add(UNNotificationRequest(
            identifier: "kveldsbrief-\(df.string(from: Date()))",
            content: innhold,
            trigger: UNTimeIntervalNotificationTrigger(
                timeInterval: max(60, tid.timeIntervalSinceNow), repeats: false)))
    }

    /// Møtet er logget (eller flyttet) → varselet er utdatert.
    static func avlys(_ id: UUID) {
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: [identifikator(id)])
    }
}

/// Reisetids-vakta: rekker du fysisk fram mellom to møter? Konflikt-vakta
/// fanger overlapp — dette fanger «30 min mellom, men kjøreturen tar 32».
/// Samme rutemotor som ruteplanleggeren (MKDirections), med luftlinje ×
/// 35 km/t som fallback når ruting feiler (offline).
@MainActor
enum ReisetidsVakt {
    /// Margin for parkering + å komme seg inn døra.
    static let bufferMin = 5

    private static var cache: [String: Int] = [:]

    /// Kjøretid i minutter, eller nil når koordinater mangler (lat/lon 0).
    static func kjoretidMin(fraLat: Double, fraLon: Double,
                            tilLat: Double, tilLon: Double) async -> Int? {
        guard fraLat != 0, fraLon != 0, tilLat != 0, tilLon != 0 else { return nil }
        let key = String(format: "%.4f,%.4f→%.4f,%.4f", fraLat, fraLon, tilLat, tilLon)
        if let hit = cache[key] { return hit }
        let luftKm = CLLocation(latitude: fraLat, longitude: fraLon)
            .distance(from: CLLocation(latitude: tilLat, longitude: tilLon)) / 1000
        // Samme adresse/bygg — ingen reise å advare om.
        if luftKm < 0.15 {
            cache[key] = 0
            return 0
        }
        let req = MKDirections.Request()
        req.source = MKMapItem(placemark: MKPlacemark(
            coordinate: .init(latitude: fraLat, longitude: fraLon)))
        req.destination = MKMapItem(placemark: MKPlacemark(
            coordinate: .init(latitude: tilLat, longitude: tilLon)))
        req.transportType = .automobile
        let minutter: Int
        if let rute = try? await MKDirections(request: req).calculate().routes.first {
            minutter = Int((rute.expectedTravelTime / 60).rounded(.up))
        } else {
            minutter = Int((luftKm * 1.3 / 35 * 60).rounded(.up))
        }
        cache[key] = minutter
        return minutter
    }
}
