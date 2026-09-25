// NexusDraTypeTests.swift
//
// Dra-typen for notater er den stille typen feil: går den i stykker, blir
// draget bare ignorert. Ingen exception, ingen logg — notatet lander ikke,
// og man tror man bommet med fingeren.
//
// To ting kan ryke uavhengig av hverandre: Info.plist-deklarasjonen, og
// Codable-rundturen. Testen dekker begge.

import XCTest
import UniformTypeIdentifiers
@testable import LeadMapApp

final class NexusDraTypeTests: XCTestCase {

    func testTypenErDeklarertIInfoPlist() {
        // UTType(exportedAs:) returnerer en type uansett, men uten
        // deklarasjonen i UTExportedTypeDeclarations er den ikke registrert
        // i systemet, og dropDestination matcher aldri.
        let type = UTType.nexusNotat
        XCTAssertEqual(type.identifier, "no.leadgrid.nexus-notat")
        XCTAssertTrue(type.conforms(to: .data),
                      "Typen må arve public.data, ellers bærer den ingen bytes.")
        XCTAssertTrue(type.isDeclared,
                      "Typen er ikke registrert — mangler den i Info.plist "
                      + "(UTExportedTypeDeclarations), blir draget ignorert "
                      + "uten feilmelding.")
    }

    func testReferansenOverleverRundturen() throws {
        let inn = NexusNotatReferanse(notatId: "abc-123",
                                      tittel: "Neras Direkte — første møte")
        let data = try JSONEncoder().encode(inn)
        let ut = try JSONDecoder().decode(NexusNotatReferanse.self, from: data)
        XCTAssertEqual(ut.notatId, inn.notatId)
        // Tittelen følger med i draget så kortet har et navn med én gang,
        // før notatet er hentet.
        XCTAssertEqual(ut.tittel, inn.tittel)
    }
}
