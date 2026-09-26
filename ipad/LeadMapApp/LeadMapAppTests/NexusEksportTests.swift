// NexusEksportTests.swift

import XCTest
@testable import LeadMapApp

final class NexusEksportTests: XCTestCase {

    func testInitialerAvFulltNavn() {
        XCTAssertEqual(NexusEksport.initialer("Sindre Andresen"), "S.A.")
        XCTAssertEqual(NexusEksport.initialer("Karianne"), "K.")
    }

    private let kontakter = ["Sindre Andresen", "Karianne Hjallen"]

    func testNavnByttesUtMedInitialer() {
        let anonymt = NexusEksport.anonymiser(
            "Sindre Andresen mener prisen er for høy", kjenteNavn: kontakter)
        XCTAssertFalse(anonymt.contains("Sindre"),
                       "Fornavnet skal ikke stå igjen: \(anonymt)")
        XCTAssertTrue(anonymt.contains("S.A."), anonymt)
        XCTAssertTrue(anonymt.contains("prisen er for høy"),
                      "Innholdet skal overleve: \(anonymt)")
    }

    func testBareFornavnErLikeIdentifiserende() {
        // «Sindre mener prisen er for høy» sier like mye til den som kjenner
        // kunden som hele navnet gjør.
        let anonymt = NexusEksport.anonymiser("sindre sa nei", kjenteNavn: kontakter)
        XCTAssertEqual(anonymt, "S.A. sa nei")
    }

    func testLengsteNavnByttesForst() {
        let anonymt = NexusEksport.anonymiser(
            "Karianne Hjallen og Sindre Andresen var med", kjenteNavn: kontakter)
        XCTAssertEqual(anonymt, "K.H. og S.A. var med")
    }

    func testOrdSomInneholderNavnetErUrort() {
        // Ordgrense, ikke delstreng: \"Andresenveien\" er en adresse.
        let anonymt = NexusEksport.anonymiser("møtet var i Andresenveien",
                                              kjenteNavn: kontakter)
        XCTAssertEqual(anonymt, "møtet var i Andresenveien")
    }

    func testVanligTekstErUrort() {
        let tekst = "Vi må bytte ut hele ventilasjonsanlegget før vinteren"
        XCTAssertEqual(NexusEksport.anonymiser(tekst, kjenteNavn: kontakter), tekst)
    }

    func testUtenKjenteNavnLoverViIngenting() {
        let tekst = "Sindre Andresen sa nei"
        XCTAssertEqual(NexusEksport.anonymiser(tekst, kjenteNavn: []), tekst)
    }

    func testTomTekstTaalerAnonymisering() {
        XCTAssertEqual(NexusEksport.anonymiser("", kjenteNavn: kontakter), "")
    }

    // MARK: Referatlinjer

    private let referat: [Referatsegment] = [
        .init(start: 12, varighet: 3, tekst: "Prisen er hinderet"),
        .init(start: 95, varighet: 4, tekst: "Vi bestemmer oss i neste uke"),
    ]

    func testTidsstempelForanHverLinje() {
        let linjer = NexusEksport.referatLinjer(referat, markorer: [], skjulNavn: [])
        XCTAssertTrue(linjer[0].hasPrefix("0:12"), linjer[0])
        XCTAssertTrue(linjer[1].hasPrefix("1:35"), linjer[1])
    }

    func testMarkertYtringMerkesISiden() {
        // Et merke er selgerens egen «dette var viktig». Uten det må
        // mottakeren lese alt for å finne de tjue sekundene som betydde noe.
        let linjer = NexusEksport.referatLinjer(referat, markorer: [94], skjulNavn: [])
        XCTAssertFalse(linjer[0].hasPrefix("★"))
        XCTAssertTrue(linjer[1].hasPrefix("★"))
    }

    func testMerkeLangtUnnaMerkerIngenting() {
        let linjer = NexusEksport.referatLinjer(referat, markorer: [400], skjulNavn: [])
        XCTAssertTrue(linjer.allSatisfy { !$0.hasPrefix("★") })
    }

    func testAnonymtErStandardveienUt() {
        let navngitt: [Referatsegment] = [
            .init(start: 0, varighet: 2, tekst: "Sindre Andresen sa nei til tilbudet"),
        ]
        let linje = NexusEksport.referatLinjer(
            navngitt, markorer: [], skjulNavn: kontakter)[0]
        XCTAssertFalse(linje.contains("Sindre"), linje)
    }
}
