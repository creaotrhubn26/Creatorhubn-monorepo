// WidgetSnapshotBakoverTests.swift
//
// Snapshot-filen bor i App Group-containeren og overlever appoppdateringer.
// Legger man til et PÅKREVD felt, kan ikke gamle filer lenger dekodes — og
// widgeten står tom til appen tilfeldigvis skriver en ny. En widget som blir
// tom etter en oppdatering ser ut som en feil, ikke som en ny funksjon.

import XCTest
@testable import LeadMapApp

final class WidgetSnapshotBakoverTests: XCTestCase {

    /// Nøyaktig formen filen hadde før Nexus-notatene ble lagt til.
    private let gammelJson = """
    {
      "actorUserId": "u1",
      "organizationId": "o1",
      "projectId": "p1",
      "activeProjectName": "Leadgrid — egne kunder",
      "totalLeads": 354,
      "followUpsDue": 3,
      "meetingsBooked": 2,
      "staleOver30": 1,
      "staleOver14": 4,
      "staleOver7": 9,
      "dueToday": [
        {"leadName": "Neras Direkte", "nextAction": "Ring"}
      ],
      "writtenAt": 780000000
    }
    """

    func testGammelFilDekodesFortsatt() throws {
        let data = Data(gammelJson.utf8)
        let snap = try JSONDecoder().decode(WidgetSnapshot.self, from: data)
        XCTAssertEqual(snap.totalLeads, 354)
        XCTAssertEqual(snap.dueToday.count, 1)
        // Det nye feltet mangler i filen, og det skal være helt greit.
        XCTAssertNil(snap.nexusNotater)
    }

    func testNotaterOverleverRundturen() throws {
        let snap = WidgetSnapshot(
            actorUserId: "u1", organizationId: "o1", projectId: "p1",
            activeProjectName: nil, totalLeads: 1, followUpsDue: 0,
            meetingsBooked: 0, staleOver30: 0, staleOver14: 0, staleOver7: 0,
            dueToday: [],
            nexusNotater: [
                .init(tittel: "Møte 25. sep", selskap: "Neras Direkte",
                      oppdatert: Date(timeIntervalSince1970: 1_700_000_000)),
            ],
            writtenAt: Date())
        let ut = try JSONDecoder().decode(
            WidgetSnapshot.self, from: try JSONEncoder().encode(snap))
        XCTAssertEqual(ut.nexusNotater?.count, 1)
        XCTAssertEqual(ut.nexusNotater?.first?.selskap, "Neras Direkte")
    }

    func testTomListeSkrivesSomNilSaaWidgetenSkjulerSeksjonen() {
        // AppState sender nil i stedet for [] når det ikke finnes notater.
        // Widgeten sjekker `!isEmpty`, men nil er det ærligste: vi har ikke
        // notater, ikke «null notater».
        let snap = WidgetSnapshot(
            actorUserId: nil, organizationId: nil, projectId: nil,
            activeProjectName: nil, totalLeads: 0, followUpsDue: 0,
            meetingsBooked: 0, staleOver30: 0, staleOver14: 0, staleOver7: 0,
            dueToday: [], nexusNotater: nil, writtenAt: Date())
        XCTAssertNil(snap.nexusNotater)
    }
}
