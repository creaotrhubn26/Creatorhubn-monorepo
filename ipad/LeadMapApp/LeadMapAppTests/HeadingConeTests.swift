// HeadingConeTests.swift
//
// Lyskjeglen rundt avataren viser hvilken vei enheten peker. Bredden er
// ikke kosmetikk: den er kjeglens eneste måte å si «jeg er usikker» på.
// Et magnetometer forstyrres av bilholdere, høyttalere og metallbord, og
// en smal kjegle som peker feil er verre enn en bred som peker omtrent
// riktig — selgeren stoler på den når han velger inngang.

import XCTest
@testable import LeadMapApp

final class HeadingConeTests: XCTestCase {

    func testUkjentUsikkerhetGirMiddelsBreddeIkkeSmal() {
        // CoreLocation sender −1 før kompasset er kalibrert. Da vet vi
        // ingenting, og må ikke late som vi peker presist.
        let ukjent = HeadingCone.halvVinkel(usikkerhet: -1)
        XCTAssertEqual(ukjent, 45, accuracy: 0.001)
        XCTAssertGreaterThan(ukjent, HeadingCone.halvVinkel(usikkerhet: 5),
                             "Ukjent skal være bredere enn et godt kalibrert kompass.")
    }

    func testDårligereKompassGirBredereKjegle() {
        let god = HeadingCone.halvVinkel(usikkerhet: 5)
        let middels = HeadingCone.halvVinkel(usikkerhet: 25)
        let dårlig = HeadingCone.halvVinkel(usikkerhet: 50)
        XCTAssertLessThan(god, middels)
        XCTAssertLessThan(middels, dårlig)
    }

    func testBreddenErKlemtIBeggeEnder() {
        // Et perfekt kompass skal fortsatt ha synlig kjegle, ikke en strek.
        XCTAssertEqual(HeadingCone.halvVinkel(usikkerhet: 0), 24, accuracy: 0.001)
        // Og et håpløst kompass skal ikke bli en full sirkel.
        XCTAssertEqual(HeadingCone.halvVinkel(usikkerhet: 999), 60, accuracy: 0.001)
    }
}
