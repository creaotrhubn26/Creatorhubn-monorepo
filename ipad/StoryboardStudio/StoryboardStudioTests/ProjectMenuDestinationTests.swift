import XCTest
@testable import StoryboardStudio

final class ProjectMenuDestinationTests: XCTestCase {
    func testProjectWithoutManuscriptOpensProductionBrowser() {
        XCTAssertEqual(
            ProjectMenuDestination.resolve(manuscriptCount: 0),
            .productionBrowser
        )
    }

    func testProjectWithOneManuscriptOpensDirectly() {
        XCTAssertEqual(
            ProjectMenuDestination.resolve(manuscriptCount: 1),
            .manuscript
        )
    }

    func testProjectWithSeveralManuscriptsUsesPicker() {
        XCTAssertEqual(
            ProjectMenuDestination.resolve(manuscriptCount: 2),
            .manuscriptPicker
        )
    }
}
