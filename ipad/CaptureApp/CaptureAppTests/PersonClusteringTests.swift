import XCTest
@testable import CaptureApp

/// Ansikts-feature-print-avstand + person-klynging (E8 levering per-ansikt).
final class PersonClusteringTests: XCTestCase {

    // MARK: - FacePrint.distance (kosinus)

    func testDistanceOfIdenticalIsZero() {
        XCTAssertEqual(FacePrint.distance([1, 2, 3], [1, 2, 3]), 0, accuracy: 1e-5)
    }

    func testDistanceIgnoresMagnitude() {
        // Kosinus-avstand er skala-invariant: samme retning, ulik lengde → ~0.
        XCTAssertEqual(FacePrint.distance([1, 0, 0], [5, 0, 0]), 0, accuracy: 1e-5)
    }

    func testOrthogonalVectorsAreDistanceOne() {
        XCTAssertEqual(FacePrint.distance([1, 0], [0, 1]), 1, accuracy: 1e-5)
    }

    func testOppositeVectorsAreDistanceTwo() {
        XCTAssertEqual(FacePrint.distance([1, 0], [-1, 0]), 2, accuracy: 1e-5)
    }

    func testEmptyVectorIsMaxDistance() {
        XCTAssertEqual(FacePrint.distance([], [1, 2]), 2, accuracy: 1e-5)
    }

    // MARK: - PersonClusterer

    func testSimilarPrintsClusterTogether() {
        // To personer: A rundt (1,0), B rundt (0,1), tydelig adskilt.
        let prints: [[Float]] = [
            [1.0, 0.02], [0.98, 0.0], [0.97, 0.05],   // person A ×3
            [0.02, 1.0], [0.0, 0.99],                 // person B ×2
        ]
        let labels = PersonClusterer.cluster(prints, threshold: 0.2)
        XCTAssertEqual(labels[0], labels[1])
        XCTAssertEqual(labels[1], labels[2], "alle A-printer i samme klynge")
        XCTAssertEqual(labels[3], labels[4], "begge B-printer i samme klynge")
        XCTAssertNotEqual(labels[0], labels[3], "A og B skal være ulike personer")
        XCTAssertEqual(Set(labels).count, 2, "nøyaktig to personer")
    }

    func testDissimilarPrintsMakeSeparatePersons() {
        let prints: [[Float]] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
        let labels = PersonClusterer.cluster(prints, threshold: 0.2)
        XCTAssertEqual(Set(labels).count, 3, "tre ortogonale printer → tre personer")
    }

    func testCentroidIsRunningMeanAndCountTracked() {
        var c = PersonClusterer(threshold: 0.5)
        XCTAssertEqual(c.assign([1, 0]), 0)
        XCTAssertEqual(c.assign([1, 0]), 0)   // samme retning → samme person
        XCTAssertEqual(c.personCount, 1)
        XCTAssertEqual(c.counts[0], 2)
    }

    func testEmptyAssignReturnsMinusOneAndNoPerson() {
        var c = PersonClusterer()
        XCTAssertEqual(c.assign([]), -1)
        XCTAssertEqual(c.personCount, 0)
    }

    func testClusteringIsDeterministic() {
        let prints: [[Float]] = [[1, 0], [0, 1], [0.99, 0.01], [0.01, 0.99]]
        XCTAssertEqual(PersonClusterer.cluster(prints, threshold: 0.2),
                       PersonClusterer.cluster(prints, threshold: 0.2))
    }
}
