// LeadgridHeaderLive.swift — QA-runde 2 (2026-07-04)
//
// Ekte header-verdier delt av fanene. Dato-pillen («Tir 20. mai 2025»)
// og badge-tallene (8 neste handlinger / 3 varsler) var hardkodet mock i
// alle faner unntatt Oversikt — nå leser alle samme kilder:
//   dato    → faktisk dagens dato (nb_NO)
//   sjekkliste-badge → oppfølginger som forfaller innen 3 dager
//                      (samme semantikk som Oversikts upcomingFollowupsCount)
//   varsel-badge     → appState.leadgridUnreadCount (ekte fra API)

import Foundation

enum LeadgridHeaderLive {
    private static let shortFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "EEE d."
        return f
    }()

    private static let longFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "nb_NO")
        f.dateFormat = "EEE d. MMM"
        return f
    }()

    /// «Lør 4.» — for smale skjermer.
    static var dateShort: String {
        shortFormatter.string(from: Date()).capitalized
    }

    /// «Lør 4. jul» — for brede skjermer.
    static var dateLong: String {
        longFormatter.string(from: Date()).capitalized
    }

    /// Oppfølginger som forfaller innen 3 dager (inkl. forfalte).
    static func upcomingFollowups(in leads: [LeadModel]) -> Int {
        let cutoff = Calendar.current.date(byAdding: .day, value: 3, to: Date()) ?? Date()
        return leads.filter { lead in
            guard let next = lead.nextFollowUpAt else { return false }
            return next <= cutoff
        }.count
    }
}
