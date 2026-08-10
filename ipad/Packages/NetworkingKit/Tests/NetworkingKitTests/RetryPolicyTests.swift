import Foundation
import Testing
@testable import NetworkingKit

/// Retry-reglene er pakkens kontrakt. Appene stoler på at en POST aldri
/// gjentas og at en 500 gjør det — så reglene testes her, ikke hos hver
/// konsument.
@Suite("RetryPolicy")
struct RetryPolicyTests {
    @Test("gjentar forbigående statuser")
    func retryableStatuses() {
        #expect(RetryPolicy.isRetryable(status: 429))
        #expect(RetryPolicy.isRetryable(status: 500))
        #expect(RetryPolicy.isRetryable(status: 503))
    }

    @Test("gjentar ikke klientfeil — samme svar, bare senere")
    func nonRetryableStatuses() {
        for status in [400, 401, 403, 404, 409, 422] {
            #expect(!RetryPolicy.isRetryable(status: status), "\(status) skal ikke gjentas")
        }
        #expect(!RetryPolicy.isRetryable(status: 200))
    }

    @Test("gjentar nettverksfeil som kan gå over")
    func retryableTransport() {
        for code in [URLError.timedOut, .networkConnectionLost, .cannotConnectToHost,
                     .dnsLookupFailed, .cannotFindHost, .resourceUnavailable] {
            #expect(RetryPolicy.isRetryable(urlError: URLError(code)))
        }
    }

    @Test("gjentar ikke feil som ikke går over av seg selv")
    func nonRetryableTransport() {
        // Avlyst av brukeren, eller en URL som aldri kommer til å bli gyldig.
        #expect(!RetryPolicy.isRetryable(urlError: URLError(.cancelled)))
        #expect(!RetryPolicy.isRetryable(urlError: URLError(.badURL)))
        #expect(!RetryPolicy.isRetryable(urlError: URLError(.unsupportedURL)))
    }

    @Test("ventetiden dobles")
    func exponential() {
        // Jitteren gjør tallet ikke-deterministisk, så vi måler intervall.
        let p = RetryPolicy(maxAttempts: 4, baseDelay: 1, jitter: 0)
        #expect(p.delay(forAttempt: 1) == 1)
        #expect(p.delay(forAttempt: 2) == 2)
        #expect(p.delay(forAttempt: 3) == 4)
    }

    @Test("jitter holder seg innenfor sitt eget vindu")
    func jitterBounds() {
        let p = RetryPolicy(maxAttempts: 3, baseDelay: 1, jitter: 0.25)
        for _ in 0..<50 {
            let d = p.delay(forAttempt: 1)
            #expect(d >= 1 && d <= 1.25)
        }
    }

    @Test("«none» betyr virkelig ingen gjentakelser")
    func noneMeansNone() {
        #expect(RetryPolicy.none.maxAttempts == 1)
    }

    @Test("maxAttempts kan ikke settes under 1")
    func flooredAttempts() {
        // Ellers ville løkken i transporten aldri kjørt kallet én gang.
        #expect(RetryPolicy(maxAttempts: 0).maxAttempts == 1)
        #expect(RetryPolicy(maxAttempts: -5).maxAttempts == 1)
    }
}
