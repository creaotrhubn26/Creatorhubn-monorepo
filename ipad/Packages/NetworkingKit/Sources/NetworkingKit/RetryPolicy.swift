import Foundation

/// Når og hvor lenge et kall skal prøves på nytt.
///
/// Regelen som betyr mest står først: **bare idempotente kall gjentas.** En
/// POST som ser ut til å ha feilet kan ha kommet fram likevel, og et blindt
/// nytt forsøk gir dobbel innsending. Det er ikke en teoretisk fare på et
/// filmsett med 4G som kommer og går.
public struct RetryPolicy: Sendable, Equatable {
    /// Maks forsøk for et idempotent kall. 1 = ingen retry.
    public let maxAttempts: Int
    /// Første ventetid. Dobles per forsøk.
    public let baseDelay: TimeInterval
    /// Tilfeldig påslag, 0…jitter sekunder. Hindrer at alle klientene
    /// kommer tilbake samtidig etter et backend-fall.
    public let jitter: TimeInterval

    public init(maxAttempts: Int = 3, baseDelay: TimeInterval = 0.4, jitter: TimeInterval = 0.25) {
        self.maxAttempts = max(1, maxAttempts)
        self.baseDelay = baseDelay
        self.jitter = jitter
    }

    /// Ingen gjentakelser. For kall der selv en idempotent retry er uønsket.
    public static let none = RetryPolicy(maxAttempts: 1)
    public static let `default` = RetryPolicy()

    /// Ventetid før forsøk nummer `attempt` (1-indeksert).
    ///
    /// Jitteren gjør funksjonen ikke-deterministisk med vilje; testene måler
    /// derfor intervall, ikke likhet.
    public func delay(forAttempt attempt: Int) -> TimeInterval {
        let base = baseDelay * pow(2.0, Double(max(0, attempt - 1)))
        return base + Double.random(in: 0...jitter)
    }

    /// Er statuskoden verdt et nytt forsøk?
    ///
    /// 429 og 5xx er forbigående. 4xx utenom 429 er klientens egen feil — et
    /// nytt forsøk gir samme svar og bruker bare tid.
    public static func isRetryable(status: Int) -> Bool {
        status == 429 || (500...599).contains(status)
    }

    /// Er transportfeilen verdt et nytt forsøk?
    public static func isRetryable(urlError: URLError) -> Bool {
        switch urlError.code {
        case .timedOut, .networkConnectionLost, .cannotConnectToHost,
             .dnsLookupFailed, .cannotFindHost, .resourceUnavailable:
            return true
        default:
            return false
        }
    }
}
