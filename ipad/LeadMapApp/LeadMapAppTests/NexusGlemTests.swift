// NexusGlemTests.swift
//
// «Glem de siste to minuttene» — DPIA-utkastet §5 punkt 2.
//
// En kunde kan nevne sykdom, gjeld eller en tredjeperson uoppfordret.
// Art. 9 har strengere krav, og selgeren må kunne fjerne det uten å avbryte
// møtet.
//
// Det som testes her er klippet i referatet. Lyden kan ikke klippes bakfra
// mens den skrives, og kastes derfor i sin helhet — det er dekket av
// kastOgStartPaaNytt, ikke av dette.

import XCTest
@testable import LeadMapApp

final class NexusGlemTests: XCTestCase {

    @MainActor
    private func motorMedSegmenter() -> LiveTranscriptionEngine {
        let m = LiveTranscriptionEngine()
        m.segmenter = [
            .init(start: 5, varighet: 3, tekst: "Vi ser på en ny leverandør"),
            .init(start: 60, varighet: 4, tekst: "Budsjettet er på plass"),
            .init(start: 190, varighet: 3, tekst: "Jeg har vært sykmeldt"),
            .init(start: 240, varighet: 2, tekst: "men det går bedre nå"),
        ]
        return m
    }

    @MainActor
    func testFjernerAltEtterGrensen() {
        let m = motorMedSegmenter()
        // Opptaket har gått 300 s; «glem siste 120» gir grense 180.
        m.klippBort(etter: 180)
        XCTAssertEqual(m.segmenter.count, 2)
        XCTAssertFalse(m.segmenter.contains { $0.tekst.contains("sykmeldt") })
    }

    @MainActor
    func testBeholderAltForGrensen() {
        let m = motorMedSegmenter()
        m.klippBort(etter: 180)
        XCTAssertEqual(m.segmenter.first?.tekst, "Vi ser på en ny leverandør")
        XCTAssertEqual(m.segmenter.last?.tekst, "Budsjettet er på plass")
    }

    @MainActor
    func testTranskriptStrengenBygdOppPaaNytt() {
        // `transcript` er én streng uten tidspunkt og kan ikke klippes
        // presist — den må bygges fra segmentene som står igjen, ellers
        // ville teksten overlevd slettingen.
        let m = motorMedSegmenter()
        m.transcript = "Vi ser på en ny leverandør Budsjettet er på plass "
            + "Jeg har vært sykmeldt men det går bedre nå"
        m.klippBort(etter: 180)
        XCTAssertFalse(m.transcript.contains("sykmeldt"))
        XCTAssertTrue(m.transcript.contains("Budsjettet"))
    }

    @MainActor
    func testGrenseNullFjernerAlt() {
        let m = motorMedSegmenter()
        m.klippBort(etter: 0)
        XCTAssertTrue(m.segmenter.isEmpty)
        XCTAssertTrue(m.transcript.isEmpty)
    }
}
