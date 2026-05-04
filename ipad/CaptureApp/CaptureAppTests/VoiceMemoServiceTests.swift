import XCTest
@testable import CaptureApp

/// Phase 5.1 — VoiceMemoService contract tests.
///
/// **Why these exist:** The voice-memo path (recording, playback,
/// reset) shipped without runtime test coverage. AVAudioRecorder /
/// AVAudioPlayer integration is fragile across simulator/device, and
/// without tests a quiet regression (state stuck in `.recording`,
/// memo URL drift, double-finalize after manual stop) would surface
/// only on-set when the photographer can't recover. Same coverage
/// philosophy as Phase 7-7F: assert the documented contract surface
/// (state machine + path stability + reset semantics) without trying
/// to exercise the AVFoundation backend, which is OS-dependent and
/// flaky in CI.
///
/// **What we cover:**
///   - Initial state is `.idle`
///   - `memoURL(for:)` is stable + unique per assetId
///   - `stopRecording()` / `stopPlayback()` are no-ops when not active
///     (must not crash the audio session)
///   - `deleteMemo(for:)` cleans up file + state
///   - `reset()` clears state + recorder/player references
///   - `maxRecordingDuration` matches the documented 60 s cap
///
/// **What we DON'T test:** Actual audio capture/playback (requires
/// real device microphone + speaker, simulator cap doesn't expose
/// either reliably). Those land in `SMOKE_TEST_R6MKII.md`.
@MainActor
final class VoiceMemoServiceTests: XCTestCase {

    private var tempDir: URL!
    private var service: VoiceMemoService!

    override func setUp() async throws {
        try await super.setUp()
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("voice-memo-tests-\(UUID().uuidString)")
        service = VoiceMemoService(outputDirectory: tempDir)
    }

    override func tearDown() async throws {
        service.reset()
        try? FileManager.default.removeItem(at: tempDir)
        try await super.tearDown()
    }

    // MARK: - Init contract

    func testInitialStateIsIdle() {
        XCTAssertEqual(service.state, .idle)
    }

    func testInitCreatesOutputDirectory() {
        // Service constructor creates the directory eagerly so that
        // memoURL(for:) immediately points at a writable location even
        // before the first recording.
        var isDirectory: ObjCBool = false
        let exists = FileManager.default.fileExists(
            atPath: tempDir.path, isDirectory: &isDirectory,
        )
        XCTAssertTrue(exists)
        XCTAssertTrue(isDirectory.boolValue)
    }

    // MARK: - memoURL stability

    func testMemoURLIsStableForSameAssetId() {
        let assetId = UUID()
        let first = service.memoURL(for: assetId)
        let second = service.memoURL(for: assetId)
        XCTAssertEqual(first, second,
                       "memoURL must be deterministic for callers checking fileExists()")
    }

    func testMemoURLIsUniquePerAssetId() {
        let url1 = service.memoURL(for: UUID())
        let url2 = service.memoURL(for: UUID())
        XCTAssertNotEqual(url1, url2)
    }

    func testMemoURLLandsInsideOutputDirectory() {
        let assetId = UUID()
        let url = service.memoURL(for: assetId)
        XCTAssertTrue(
            url.path.hasPrefix(tempDir.path),
            "memo files must stay inside the configured directory",
        )
    }

    func testMemoURLUsesM4AExtension() {
        // m4a is what AVAudioRecorder writes with our AAC settings;
        // the path extension must agree so AVAudioPlayer reads it back.
        let url = service.memoURL(for: UUID())
        XCTAssertEqual(url.pathExtension, "m4a")
    }

    // MARK: - No-op contracts

    func testStopRecordingIsNoOpWhenIdle() {
        // Documented as safe to call when not recording. Must not
        // mutate state, must not crash the audio session.
        service.stopRecording()
        XCTAssertEqual(service.state, .idle)
    }

    func testStopPlaybackIsNoOpWhenIdle() {
        service.stopPlayback()
        XCTAssertEqual(service.state, .idle)
    }

    func testStartPlaybackIsNoOpForMissingMemo() {
        // No memo file written → startPlayback short-circuits via
        // FileManager.fileExists check. State stays .idle.
        service.startPlayback(assetId: UUID())
        XCTAssertEqual(service.state, .idle)
    }

    // MARK: - Cleanup

    func testDeleteMemoRemovesFileAndIsSafeWhenAbsent() throws {
        let assetId = UUID()
        let url = service.memoURL(for: assetId)
        // Plant a fake memo so deleteMemo has something to remove.
        try "fake".write(to: url, atomically: true, encoding: .utf8)
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))

        service.deleteMemo(for: assetId)
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))

        // Calling delete again must be a no-op — never throws.
        service.deleteMemo(for: assetId)
        XCTAssertEqual(service.state, .idle)
    }

    func testResetReturnsStateToIdle() {
        // reset is the catch-all called from LiveCaptureModel.disconnect.
        // Even with no active recording/playback, state must remain idle
        // and the call must not throw.
        service.reset()
        XCTAssertEqual(service.state, .idle)
    }

    // MARK: - Documented constants

    func testMaxRecordingDurationMatchesSpec() {
        // The 60-second cap is documented at the top of the file
        // ("memos are pre-shoot intent, not long-form audio"). Drift
        // on this constant changes the auto-stop behaviour silently;
        // we lock it via this assertion.
        XCTAssertEqual(VoiceMemoService.maxRecordingDuration, 60,
                       accuracy: 0.001)
    }

    // MARK: - State machine

    func testStateEqualityRecordingDistinguishesByAssetId() {
        // .recording and .playing carry assetId so the UI can tell
        // "is THIS asset's memo being recorded right now". Equatable
        // on the state must reflect that — two recording states with
        // different asset IDs are distinct.
        let now = Date()
        let a = UUID(), b = UUID()
        XCTAssertNotEqual(
            VoiceMemoService.State.recording(assetId: a, startedAt: now),
            VoiceMemoService.State.recording(assetId: b, startedAt: now),
        )
        XCTAssertNotEqual(
            VoiceMemoService.State.playing(assetId: a),
            VoiceMemoService.State.playing(assetId: b),
        )
    }
}

/// Phase 5.1 — ClientReview.Kind.audio shape tests.
///
/// Locks the on-disk shape of the audio variant so future changes
/// don't accidentally rename `localPath` / `durationSeconds` and
/// silently break the chat-bubble renderer (which destructures the
/// case in a switch).
final class ClientReviewAudioKindTests: XCTestCase {

    func testAudioKindCarriesPathAndDuration() {
        let kind = ClientReview.Kind.audio(
            localPath: "/tmp/reply.m4a",
            durationSeconds: 8.5,
        )
        switch kind {
        case .audio(let path, let duration):
            XCTAssertEqual(path, "/tmp/reply.m4a")
            XCTAssertEqual(duration, 8.5, accuracy: 1e-6)
        default:
            XCTFail("expected .audio case")
        }
    }

    func testAudioKindEqualityIsByValue() {
        let a = ClientReview.Kind.audio(localPath: "/p", durationSeconds: 5)
        let b = ClientReview.Kind.audio(localPath: "/p", durationSeconds: 5)
        let c = ClientReview.Kind.audio(localPath: "/q", durationSeconds: 5)
        let d = ClientReview.Kind.audio(localPath: "/p", durationSeconds: 6)
        XCTAssertEqual(a, b)
        XCTAssertNotEqual(a, c)
        XCTAssertNotEqual(a, d)
    }

    func testAudioKindIsDistinctFromCommentAndHeart() {
        let audio = ClientReview.Kind.audio(localPath: "/x", durationSeconds: 1)
        let comment = ClientReview.Kind.comment(preview: "x")
        let heart = ClientReview.Kind.heart(on: true)
        XCTAssertNotEqual(audio, comment)
        XCTAssertNotEqual(audio, heart)
    }
}
