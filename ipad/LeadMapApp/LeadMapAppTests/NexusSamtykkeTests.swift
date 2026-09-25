// NexusSamtykkeTests.swift
//
// §4 i docs/leadgrid-gdpr-lydopptak.md: samtykke per samtale, med ordlyd som
// beskriver det som FAKTISK skjer.
//
// Den farligste feilen her er ikke at samtykket mangler. Det er at det
// finnes, men gjelder noe annet enn det vi gjør — da ser det ut som
// etterlevelse i loggen, og er det motsatte.

import XCTest
@testable import LeadMapApp

final class NexusSamtykkeTests: XCTestCase {

    func testLydOrdlydenLoverIkkeAtOpptaketIkkeLagres() {
        let tekst = RecordingConsentGate.nexusLydText()
        // Leadbook sin tekst sier «Opptaket lagres ikke, kun teksten».
        // Brukt i lyd-modus ville det vært en usannhet kunden sa ja til.
        XCTAssertFalse(tekst.contains("lagres ikke"))
        XCTAssertTrue(tekst.contains("lyden"), "Kunden skal få vite at lyden tas opp.")
    }

    func testLagringstidenStaarIOrdlyden() {
        // §4 punkt 1: hva tas opp, formål, LAGRINGSTID, rett til å trekke.
        XCTAssertTrue(RecordingConsentGate.nexusLydText().contains("90 dager"))
        XCTAssertTrue(RecordingConsentGate.nexusLydText(dager: 30).contains("30 dager"))
    }

    func testRettenTilAaTrekkeStaarIOrdlyden() {
        XCTAssertTrue(RecordingConsentGate.nexusLydText().contains("slettes"))
    }

    func testVersjonenErEgenForLydModus() {
        // Samtykket må kunne spores til nøyaktig teksten kunden fikk høre.
        // Deler de versjon, kan de ikke skilles i ettertid.
        XCTAssertNotEqual(RecordingConsentGate.nexusLydVersion,
                          RecordingConsentGate.currentVersion)
    }

    func testLydobjektUtenSamtykkeIdErEtBrudd() {
        // Formen som IKKE skal kunne oppstå: lagret lyd uten samtykke.
        let ulovlig = CanvasObjekt(
            type: CanvasObjektType.lyd.rawValue, x: 0, y: 0,
            dokId: "dok-1", varighet: 60, samtykkeId: nil)
        XCTAssertNotNil(ulovlig.dokId)
        XCTAssertNil(ulovlig.samtykkeId,
                     "Denne kombinasjonen er det gaten skal hindre.")

        // Formen som er i orden i referat-modus: ingen lyd, intet samtykke.
        let referatModus = CanvasObjekt(
            type: CanvasObjektType.lyd.rawValue, x: 0, y: 0,
            dokId: nil, varighet: 60,
            referat: [.init(start: 0, varighet: 2, tekst: "Hei")],
            samtykkeId: nil)
        XCTAssertNil(referatModus.dokId)
        XCTAssertEqual(referatModus.referat?.count, 1)
    }
}
