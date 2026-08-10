import Testing
@testable import OutboxKit

/// Retry-stigen er pakkens egen kontrakt: den avgjør hvor lenge en mutasjon
/// blir liggende før den gir opp. Appene stoler på tallene, så de testes her
/// framfor hos konsumenten.
@Suite("Outbox backoff")
struct OutboxBackoffTests {
    @Test("stigen er den dokumenterte")
    func ladder() {
        #expect(OutboxWorker.backoff(forAttempts: 0) == 1)
        #expect(OutboxWorker.backoff(forAttempts: 1) == 2)
        #expect(OutboxWorker.backoff(forAttempts: 2) == 5)
        #expect(OutboxWorker.backoff(forAttempts: 3) == 15)
        #expect(OutboxWorker.backoff(forAttempts: 4) == 60)
    }

    @Test("stiger monotont — en retry skal aldri komme raskere enn forrige")
    func monotonic() {
        let steps = (0..<OutboxMutation.maxAttempts).map(OutboxWorker.backoff(forAttempts:))
        #expect(steps == steps.sorted())
    }

    @Test("flater ut framfor å vokse i det uendelige")
    func plateau() {
        // Uten taket ville en rad som ble liggende over natten fått en
        // backoff målt i timer, og aldri kommet seg av gårde om morgenen.
        #expect(OutboxWorker.backoff(forAttempts: 99) == 60)
    }

    @Test("samlet ventetid holder seg under to minutter")
    func totalWallClock() {
        // Dokumentert som ~83 s i OutboxWorker. Fotografer rekker ofte å
        // koble seg på igjen i det vinduet; blir det mye lengre, taper vi
        // mutasjoner til brukere som gir opp og lukker appen.
        let total = (0..<OutboxMutation.maxAttempts)
            .map(OutboxWorker.backoff(forAttempts:))
            .reduce(0, +)
        #expect(total < 120)
    }
}
