// NexusFlateTests.swift
//
// Tre ting fra flate-gruppen som kan gå stille i stykker.

import XCTest
import PencilKit
@testable import LeadMapApp

final class NexusFlateTests: XCTestCase {

    private func strok(x: CGFloat, y: CGFloat, skrevet: Date) -> PKStroke {
        let pkt = stride(from: x, to: x + 60, by: 6).map {
            PKStrokePoint(location: CGPoint(x: $0, y: y), timeOffset: 0,
                          size: CGSize(width: 4, height: 4), opacity: 1,
                          force: 1, azimuth: 0, altitude: .pi / 2)
        }
        return PKStroke(ink: PKInk(.pen, color: .black),
                        path: PKStrokePath(controlPoints: pkt, creationDate: skrevet))
    }

    // MARK: Tapp på blekket

    func testFinnerStroketManPektePå() {
        let nå = Date()
        let tegning = PKDrawing(strokes: [
            strok(x: 100, y: 100, skrevet: nå),
            strok(x: 100, y: 400, skrevet: nå),
        ])
        let i = NexusBlekkSynk.strokNaer(CGPoint(x: 120, y: 402), i: tegning)
        XCTAssertEqual(i, 1, "Nederste strøk er nærmest.")
    }

    func testGirIngentingLangtFraAltBlekk() {
        // Et tapp på tomt ark skal ikke slå opp en tilfeldig ytring.
        let tegning = PKDrawing(strokes: [strok(x: 100, y: 100, skrevet: Date())])
        XCTAssertNil(NexusBlekkSynk.strokNaer(CGPoint(x: 900, y: 900), i: tegning))
    }

    func testToleransenFangerEtBomskuddMedFingeren() {
        // En finger er bredere enn en penn. 30 punkter unna skal treffe.
        let tegning = PKDrawing(strokes: [strok(x: 100, y: 100, skrevet: Date())])
        XCTAssertEqual(NexusBlekkSynk.strokNaer(CGPoint(x: 120, y: 130), i: tegning), 0)
    }

    func testSagtDaKnytterStroketTilYtringen() {
        let start = Date()
        let s = strok(x: 10, y: 10, skrevet: start.addingTimeInterval(42))
        let treff = NexusBlekkSynk.sagtDa(
            s, opptakStartet: start, varighet: 300,
            referat: [
                .init(start: 5, varighet: 2, tekst: "Hei"),
                .init(start: 41, varighet: 3, tekst: "Prisen er hinderet"),
            ])
        XCTAssertEqual(treff?.tekst, "Prisen er hinderet")
    }

    func testStrokSkrevetFørOpptaketGirIngenYtring() {
        let start = Date()
        let s = strok(x: 10, y: 10, skrevet: start.addingTimeInterval(-600))
        XCTAssertNil(NexusBlekkSynk.sagtDa(
            s, opptakStartet: start, varighet: 300,
            referat: [.init(start: 5, varighet: 2, tekst: "Hei")]))
    }

    // MARK: Maler per kategori

    func testAlleHovedtyperAapnerPaaEnMalIkkeBlanktArk() {
        // Hele poenget: står man hos kunden skal arket spørre om noe.
        for type in CanvasKategori.hovedTyper {
            XCTAssertNotEqual(CanvasPapir.standardFor(type), .blank,
                              "\(type.etikett) åpner fortsatt blankt.")
        }
    }

    func testHverMalHarEtiketterSomForteller() {
        for papir in [CanvasPapir.befaring, .leadkort] {
            XCTAssertEqual(papir.spec.etiketter.count, 4,
                           "\(papir.etikett) mangler seksjoner.")
        }
    }

    func testLegacyKategoriBeholderBlanktArk() {
        // Gamle notater skal ikke få nye streker under blekket sitt.
        XCTAssertEqual(CanvasPapir.standardFor(.internt), .blank)
    }

    // MARK: Markører

    func testMarkørerOverleverLagring() {
        let objekt = CanvasObjekt(
            type: CanvasObjektType.lyd.rawValue, x: 0, y: 0,
            varighet: 300, markorer: [12.5, 88.0, 201.25])
        XCTAssertEqual(objekt.markorer?.count, 3)
        XCTAssertEqual(objekt.markorer?.last, 201.25)
    }
}
