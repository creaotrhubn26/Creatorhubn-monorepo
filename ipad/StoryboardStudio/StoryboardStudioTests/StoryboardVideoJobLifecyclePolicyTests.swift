import XCTest
@testable import StoryboardStudio

final class StoryboardVideoJobLifecyclePolicyTests: XCTestCase {
    func testActiveStatusesBlockDuplicatePaidSubmission() {
        let statuses = [
            "prepared",
            "submitting",
            "queued",
            "pending",
            "submitted",
            "in_progress",
            "processing",
            "running",
            "submission_unknown",
            "accepted_contract_unknown",
        ]

        for status in statuses {
            XCTAssertTrue(
                StoryboardVideoJobLifecyclePolicy.isActive(status),
                "Expected \(status) to block another paid submission")
        }
    }

    func testTerminalStatusesReleasePaidAction() {
        let statuses: [String?] = [
            nil,
            "",
            "completed",
            "completed-archived",
            "failed",
            "failed_permanent",
            "rejected_retryable",
            "nsfw",
            "canceled",
            "cancelled",
        ]

        for status in statuses {
            XCTAssertFalse(
                StoryboardVideoJobLifecyclePolicy.isActive(status),
                "Expected \(status ?? "nil") to release the paid action")
        }
    }

    func testOnlyProviderProgressStatusesArePollable() {
        let pollable = [
            "queued", "pending", "submitted", "in_progress", "processing", "running",
        ]
        let nonPollable = [
            "submitting", "submission_unknown", "accepted_contract_unknown",
            "completed", "failed", "future_server_state",
        ]

        for status in pollable {
            XCTAssertTrue(StoryboardVideoJobLifecyclePolicy.isPollable(status))
        }
        for status in nonPollable {
            XCTAssertFalse(StoryboardVideoJobLifecyclePolicy.isPollable(status))
        }
    }

    func testReconciliationStatusesStopPollingAndExplainNoAutomaticResubmit() {
        for status in ["submission_unknown", "accepted_contract_unknown"] {
            XCTAssertTrue(
                StoryboardVideoJobLifecyclePolicy.requiresReconciliation(status))
            XCTAssertFalse(StoryboardVideoJobLifecyclePolicy.isPollable(status))
            XCTAssertTrue(
                StoryboardVideoJobLifecyclePolicy
                    .reconciliationMessage(for: status)?
                    .contains("ikke sendt på nytt automatisk") == true)
        }
    }

    func testNormalizationIsCaseAndWhitespaceInsensitive() {
        XCTAssertTrue(
            StoryboardVideoJobLifecyclePolicy.isActive("  SUBMISSION_UNKNOWN\n"))
        XCTAssertTrue(
            StoryboardVideoJobLifecyclePolicy
                .requiresReconciliation(" ACCEPTED_CONTRACT_UNKNOWN "))
        XCTAssertTrue(
            StoryboardVideoJobLifecyclePolicy.isPollable(" Processing "))
    }

    func testUnknownFutureStatusFailsClosedWithoutPolling() {
        XCTAssertTrue(
            StoryboardVideoJobLifecyclePolicy.isActive("provider_new_state"))
        XCTAssertFalse(
            StoryboardVideoJobLifecyclePolicy.isPollable("provider_new_state"))
    }
}
