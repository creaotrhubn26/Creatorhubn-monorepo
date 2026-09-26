// NexusMedieKoTests.swift
//
// Det som betyr noe her er at køen overlever at appen lukkes. Testene lager
// derfor en ny kø mot samme mappe i stedet for å gjenbruke instansen.

import XCTest
@testable import LeadMapApp

final class NexusMedieKoTests: XCTestCase {

    private var mappe: URL!

    override func setUp() async throws {
        mappe = FileManager.default.temporaryDirectory
            .appendingPathComponent("medieko-\(UUID().uuidString)")
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: mappe)
    }

    private func ko() -> NexusMedieKo { NexusMedieKo(mappe: mappe) }

    func testOpptakOverleverAtAppenLukkes() async {
        let bytes = Data("et møte".utf8)
        await ko().leggTil(dokId: "d1", notatId: "n1", prosjektId: "p1",
                           navn: "Opptak", slag: "lyd", data: bytes)

        // Ny instans = appen startet på nytt.
        let etterOmstart = ko()
        let ventende = await etterOmstart.ventende
        XCTAssertEqual(ventende.count, 1)
        let lagret = await etterOmstart.bytes(for: ventende[0])
        XCTAssertEqual(lagret, bytes)
        XCTAssertEqual(ventende[0].notatId, "n1")
    }

    func testOpplastetMedieForsvinnerHeltFraDisk() async {
        let k = ko()
        await k.leggTil(dokId: "d1", notatId: "n1", prosjektId: "p1",
                        navn: "Opptak", slag: "lyd", data: Data("x".utf8))
        await k.fjern(dokId: "d1")
        let tom = await ko().ventende.isEmpty
        XCTAssertTrue(tom)
        XCTAssertEqual(
            try? FileManager.default.contentsOfDirectory(atPath: mappe.path)
                .filter { $0.hasSuffix(".bin") }.count, 0,
            "Bytesene skal ikke bli liggende etter vellykket opplasting.")
    }

    func testOppforingUtenFilRyddesBort() async {
        let k = ko()
        await k.leggTil(dokId: "d1", notatId: "n1", prosjektId: "p1",
                        navn: "Opptak", slag: "lyd", data: Data("x".utf8))
        // Noen har tømt disken under oss.
        try? FileManager.default.removeItem(
            at: mappe.appendingPathComponent("d1.bin"))
        _ = k
        let tomEtterTaptFil = await ko().ventende.isEmpty
        XCTAssertTrue(tomEtterTaptFil,
                      "En oppføring uten bytes lover et opptak som ikke finnes.")
    }

    func testSammeDokIdLeggesIkkeToGanger() async {
        let k = ko()
        await k.leggTil(dokId: "d1", notatId: "n1", prosjektId: "p1",
                        navn: "Opptak", slag: "lyd", data: Data("en".utf8))
        await k.leggTil(dokId: "d1", notatId: "n1", prosjektId: "p1",
                        navn: "Opptak", slag: "lyd", data: Data("to".utf8))
        let ventende = await k.ventende
        XCTAssertEqual(ventende.count, 1)
        let lagret = await k.bytes(for: ventende[0])
        XCTAssertEqual(lagret, Data("to".utf8))
    }

    func testForsokTellesOgOverleverOmstart() async {
        let k = ko()
        await k.leggTil(dokId: "d1", notatId: "n1", prosjektId: "p1",
                        navn: "Opptak", slag: "lyd", data: Data("x".utf8))
        await k.bomTur(dokId: "d1")
        await k.bomTur(dokId: "d1")
        let forsok = await ko().ventende.first?.forsok
        XCTAssertEqual(forsok, 2)
    }

    func testVentendePerNotat() async {
        let k = ko()
        await k.leggTil(dokId: "d1", notatId: "n1", prosjektId: "p1",
                        navn: "A", slag: "lyd", data: Data("a".utf8))
        await k.leggTil(dokId: "d2", notatId: "n2", prosjektId: "p1",
                        navn: "B", slag: "video", data: Data("b".utf8))
        let iN2 = await k.ventende(iNotat: "n2").map(\.dokId)
        XCTAssertEqual(iN2, ["d2"])
        let venterPaaD1 = await k.venter(dokId: "d1")
        XCTAssertTrue(venterPaaD1)
    }
}
