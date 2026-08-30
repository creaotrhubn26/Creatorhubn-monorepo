import Foundation

/// Centralizes native interpretation of server-side video job states.
///
/// Unknown non-empty states intentionally fail closed: they block another paid
/// submission, but are not polled until the client has an explicit contract for
/// them. This prevents a newer server state from causing duplicate generation.
enum StoryboardVideoJobLifecyclePolicy {
    private static let pollableStatuses: Set<String> = [
        "queued",
        "pending",
        "submitted",
        "in_progress",
        "processing",
        "running",
    ]

    private static let reconciliationStatuses: Set<String> = [
        "submission_unknown",
        "accepted_contract_unknown",
    ]

    private static let terminalStatuses: Set<String> = [
        "completed",
        "completed-archived",
        "failed",
        "failed_permanent",
        "rejected_retryable",
        "nsfw",
        "canceled",
        "cancelled",
    ]

    static func normalizedStatus(_ rawStatus: String?) -> String? {
        guard let normalized = rawStatus?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased(),
              !normalized.isEmpty else { return nil }
        return normalized
    }

    static func isActive(_ rawStatus: String?) -> Bool {
        guard let status = normalizedStatus(rawStatus) else { return false }
        return !terminalStatuses.contains(status)
    }

    static func isPollable(_ rawStatus: String?) -> Bool {
        guard let status = normalizedStatus(rawStatus) else { return false }
        return pollableStatuses.contains(status)
    }

    static func requiresReconciliation(_ rawStatus: String?) -> Bool {
        guard let status = normalizedStatus(rawStatus) else { return false }
        return reconciliationStatuses.contains(status)
    }

    static func reconciliationMessage(for rawStatus: String?) -> String? {
        switch normalizedStatus(rawStatus) {
        case "submission_unknown":
            return "Leverandørsvaret er uavklart. Jobben er sikret for avstemming og blir ikke sendt på nytt automatisk."
        case "accepted_contract_unknown":
            return "Leverandøren kan ha godtatt jobben, men statuskontrakten må avstemmes. Jobben blir ikke sendt på nytt automatisk."
        default:
            return nil
        }
    }
}
