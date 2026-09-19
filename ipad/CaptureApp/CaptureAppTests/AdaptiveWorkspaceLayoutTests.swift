import CoreGraphics
import Testing
@testable import CaptureApp

struct AdaptiveWorkspaceLayoutTests {
    @Test func shootUsesRailOnlyForWideLandscapeWorkspaces() {
        let landscape = CaptureWorkspaceLayout.resolve(size: CGSize(width: 1_366, height: 920))
        #expect(landscape.mode == .landscapeRail)
        #expect(landscape.sideRailWidth == 382.48)

        let portrait = CaptureWorkspaceLayout.resolve(size: CGSize(width: 1_024, height: 1_366))
        #expect(portrait.mode == .stacked)

        let shortWideWindow = CaptureWorkspaceLayout.resolve(size: CGSize(width: 834, height: 600))
        #expect(shortWideWindow.mode == .landscapeRail)
        #expect(shortWideWindow.sideRailWidth == 300)

        let splitView = CaptureWorkspaceLayout.resolve(size: CGSize(width: 680, height: 920))
        #expect(splitView.mode == .stacked)
        #expect(splitView.filmstripHeight == 152)
    }

    @Test func videoKeepsEveryPanelReachableAcrossWindowWidths() {
        let wide = VideoWorkspaceLayout.resolve(size: CGSize(width: 1_366, height: 920))
        #expect(wide.mode == .wide)
        #expect(wide.showsSourceRail)
        #expect(wide.showsTakeInspector)

        let iPadMiniLandscape = VideoWorkspaceLayout.resolve(size: CGSize(width: 1_133, height: 744))
        #expect(iPadMiniLandscape.mode == .standard)
        #expect(iPadMiniLandscape.showsSourceRail)
        #expect(!iPadMiniLandscape.showsTakeInspector)

        let shortWideWindow = VideoWorkspaceLayout.resolve(size: CGSize(width: 1_600, height: 685))
        #expect(shortWideWindow.mode == .standard)
        #expect(!shortWideWindow.showsTakeInspector)

        let standard = VideoWorkspaceLayout.resolve(size: CGSize(width: 820, height: 700))
        #expect(standard.mode == .standard)
        #expect(standard.showsSourceRail)
        #expect(!standard.showsTakeInspector)

        let compact = VideoWorkspaceLayout.resolve(size: CGSize(width: 620, height: 540))
        #expect(compact.mode == .compact)
        #expect(!compact.showsSourceRail)
        #expect(!compact.showsTakeInspector)
        #expect(compact.filmstripHeight == 104)
    }
}
