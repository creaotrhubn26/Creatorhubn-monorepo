// RetningsvalgTests.swift
//
// Valget mellom kompass og GPS-kurs. Det finnes ingen kilde som er best
// overalt, og feil valg er verre enn ingen retning: en lyskjegle som peker
// selvsikkert feil får selgeren til å gå til feil inngang.
//
// Tallene under er reelle: 1,4 m/s er gangfart, 6 m/s er sykkel i fart,
// 17 m/s er ca. 60 km/t.

import XCTest
import CoreLocation
@testable import LeadMapApp

private func kompass(_ grader: Double, usikkerhet: Double = 8) -> Retning {
    Retning(grader: grader, kilde: .kompass, usikkerhet: usikkerhet)
}
private func kurs(_ grader: Double, usikkerhet: Double = 10) -> Retning {
    Retning(grader: grader, kilde: .kurs, usikkerhet: usikkerhet)
}

final class RetningsvalgTests: XCTestCase {

    func testGangeBrukerKompassSelvIFart() {
        // En fotgjenger snur seg på stedet, og går ofte med telefonen vendt
        // en annen vei enn han beveger seg. Kursen er feil svar her.
        let (r, brukerKurs) = Retningsvalg.velg(
            kompass: kompass(90), kurs: kurs(270), sisteKurs: kurs(270),
            fart: 1.4, transport: .walking, brukteKurs: false)
        XCTAssertEqual(r?.kilde, .kompass)
        XCTAssertEqual(r?.grader, 90)
        XCTAssertFalse(brukerKurs)
    }

    func testBilIFartBrukerKursIkkeKompass() {
        // 17 m/s = ca. 60 km/t. Magnetholderen og karosseriet gjør kompasset
        // upålitelig; kursen over bakken er nærmest perfekt.
        let (r, brukerKurs) = Retningsvalg.velg(
            kompass: kompass(90), kurs: kurs(270), sisteKurs: kurs(270),
            fart: 17, transport: .automotive, brukteKurs: false)
        XCTAssertEqual(r?.kilde, .kurs)
        XCTAssertEqual(r?.grader, 270)
        XCTAssertTrue(brukerKurs)
    }

    func testBilIKoeHolderKursenIStedetForAaSnurreEtterKompasset() {
        // Bilen står i rødt lys. Den har ikke snudd seg. Kompasset ligger i
        // en magnet. Å la kartet rotere etter det ville vært ren støy.
        let (r, _) = Retningsvalg.velg(
            kompass: kompass(15), kurs: nil, sisteKurs: kurs(270),
            fart: 0, transport: .automotive, brukteKurs: true)
        XCTAssertEqual(r?.kilde, .holdt)
        XCTAssertEqual(r?.grader, 270)
    }

    func testStillestaaendeSykkelFallerTilbakeTilKompasset() {
        // Sykkelen kan trilles rundt, og har lite metall. Her er kompasset
        // riktig — i motsetning til bilen.
        let (r, _) = Retningsvalg.velg(
            kompass: kompass(15), kurs: nil, sisteKurs: kurs(270),
            fart: 0, transport: .cycling, brukteKurs: true)
        XCTAssertEqual(r?.kilde, .kompass)
        XCTAssertEqual(r?.grader, 15)
    }

    func testKompassetBlirBredereIKjoeretoey() {
        // Vi kan ikke måle magnetforstyrrelsen, men vi vet at den er der.
        // Kjeglen skal si fra ved å bli bredere, ikke peke like skarpt.
        let (påSykkel, _) = Retningsvalg.velg(
            kompass: kompass(15, usikkerhet: 5), kurs: nil, sisteKurs: nil,
            fart: 0, transport: .cycling, brukteKurs: false)
        let (tilFots, _) = Retningsvalg.velg(
            kompass: kompass(15, usikkerhet: 5), kurs: nil, sisteKurs: nil,
            fart: 0, transport: .walking, brukteKurs: false)
        XCTAssertGreaterThan(påSykkel?.usikkerhet ?? 0, tilFots?.usikkerhet ?? 0)
        XCTAssertEqual(tilFots?.usikkerhet, 5)
    }

    func testHysteresenHindrerFlakkingRundtTerskelen() {
        // 1,5 m/s ligger mellom ned-terskelen (1,2) og opp-terskelen (2,2).
        // Samme fart må gi samme kilde som forrige gang — ellers bytter
        // kartet kilde fram og tilbake mens farten sitrer.
        let (fraKurs, holderKurs) = Retningsvalg.velg(
            kompass: kompass(90), kurs: kurs(270), sisteKurs: kurs(270),
            fart: 1.5, transport: .automotive, brukteKurs: true)
        XCTAssertEqual(fraKurs?.kilde, .kurs)
        XCTAssertTrue(holderKurs)

        let (fraKompass, holderKompass) = Retningsvalg.velg(
            kompass: kompass(90), kurs: kurs(270), sisteKurs: kurs(270),
            fart: 1.5, transport: .automotive, brukteKurs: false)
        XCTAssertNotEqual(fraKompass?.kilde, .kurs)
        XCTAssertFalse(holderKompass)
    }

    func testUkjentTransportLaterFartenBestemme() {
        // Core Motion har ikke klassifisert ennå (eller vi er på macOS).
        let (rask, _) = Retningsvalg.velg(
            kompass: kompass(90), kurs: kurs(270), sisteKurs: kurs(270),
            fart: 17, transport: nil, brukteKurs: false)
        XCTAssertEqual(rask?.kilde, .kurs)

        let (stille, _) = Retningsvalg.velg(
            kompass: kompass(90), kurs: nil, sisteKurs: kurs(270),
            fart: 0, transport: nil, brukteKurs: false)
        XCTAssertEqual(stille?.kilde, .kompass)
    }

    func testIngenKilderGirIngenRetning() {
        // Simulator uten kompass, stillestående. Kjeglen skal utebli, ikke
        // peke mot nord som om det var en måling.
        let (r, _) = Retningsvalg.velg(
            kompass: nil, kurs: nil, sisteKurs: nil,
            fart: 0, transport: nil, brukteKurs: false)
        XCTAssertNil(r)
    }
}
