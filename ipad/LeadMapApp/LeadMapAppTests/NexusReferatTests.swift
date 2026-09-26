// NexusReferatTests.swift
//
// Blekk-synkingen skal virke UTEN at lyden lagres.
//
// docs/leadgrid-gdpr-lydopptak.md slår fast at rå lyd ikke persisteres før
// GDPR-pakken er godkjent. Teksten kan lagres i dag, og segmentene bærer
// tidspunktene. Et referat-objekt uten `dokId` er et opptak som aldri ble
// lagret — bare hørt, skrevet ned og kastet.

import XCTest
@testable import LeadMapApp

final class NexusReferatTests: XCTestCase {

    private let referat: [Referatsegment] = [
        .init(start: 2.0, varighet: 3.0, tekst: "De bruker Veeva i dag"),
        .init(start: 41.0, varighet: 4.0, tekst: "Prisen er det største hinderet"),
        .init(start: 120.0, varighet: 2.5, tekst: "Send tilbud før fredag"),
    ]

    func testFinnerYtringenRundtEtTidspunkt() {
        // «Hva ble sagt da jeg skrev dette?» er spørsmålet man faktisk stiller.
        let treff = NexusBlekkSynk.segmentVed(42.0, i: referat)
        XCTAssertEqual(treff?.tekst, "Prisen er det største hinderet")
    }

    func testVelgerNaermesteNaarToErInnenforVinduet() {
        let treff = NexusBlekkSynk.segmentVed(3.0, i: referat)
        XCTAssertEqual(treff?.tekst, "De bruker Veeva i dag")
    }

    func testGirIngentingLangtUtenforEnYtring() {
        // Stillhet er en ekte tilstand. Å returnere nærmeste ytring uansett
        // ville knyttet et strøk til noe som ble sagt et halvt minutt unna.
        XCTAssertNil(NexusBlekkSynk.segmentVed(80.0, i: referat))
    }

    func testTomtReferatGirIngenTreff() {
        XCTAssertNil(NexusBlekkSynk.segmentVed(10.0, i: []))
    }

    func testObjektUtenDokIdErEtOpptakSomAldriBleLagret() {
        // Formen som lagres når org-en ikke har GDPR-nøkkelen: referat, men
        // ingen referanse til en lydfil.
        let objekt = CanvasObjekt(
            type: CanvasObjektType.lyd.rawValue, x: 0, y: 0,
            tittel: "Opptak", dokId: nil,
            varighet: 180, opptakStartet: Date(), referat: referat)
        XCTAssertNil(objekt.dokId, "Lyden skal ikke være referert.")
        XCTAssertEqual(objekt.referat?.count, 3, "Teksten skal være beholdt.")
    }
}
