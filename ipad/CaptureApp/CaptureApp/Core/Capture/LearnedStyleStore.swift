import Foundation

/// Laster en bundlet arkiv-lært stil-profil (`learned_style.json`, eksportert fra
/// Post Agent-motoren). Nil når ingen profil er bundlet → «Min stil»-valget vises
/// ikke. På sikt: last nedlastede/synkede profiler per fotograf fra Documents.
final class LearnedStyleStore: @unchecked Sendable {
    static let shared = LearnedStyleStore()

    #if DEBUG
    /// Demo-hekte (`--demo-redigering --learned-on[=N]`) — KUN DEBUG (skal ikke
    /// være med i Release-binæret). Lar Redigering-demoen åpne med stil N alt valgt.
    nonisolated(unsafe) static var demoForceStyleIndex: Int?
    nonisolated(unsafe) static var demoForceAuto = false
    #endif

    // #1: profilen lastes ASYNK (off-main) via `preload()` — flere hundre KB JSON
    // (256-entry LUT-er × scener × stiler) ble ellers dekodet SYNKRONT på main ved
    // første aksess (som skjer ved første UI-berøring). Lås-beskyttet.
    private let lock = NSLock()
    private var _profile: LearnedStyleProfile?
    private var didLoad = false

    private init() {}

    /// Last profilen off-main. Kalles fra editorens `.task` FØR render, så
    /// getterne er klare uten synkron disk-I/O på main.
    func preload() async {
        if alreadyLoaded() { return }
        let loaded = await Task.detached(priority: .utility) { () -> LearnedStyleProfile? in
            Bundle.main.url(forResource: "learned_style", withExtension: "json")
                .flatMap { LearnedStyleProfile.load(contentsOf: $0) }
        }.value
        store(loaded)
    }

    // Synkrone lås-hjelpere (NSLock er ikke lov å holde over en await i Swift 6).
    private func alreadyLoaded() -> Bool { lock.lock(); defer { lock.unlock() }; return didLoad }
    private func store(_ p: LearnedStyleProfile?) { lock.lock(); _profile = p; didLoad = true; lock.unlock() }

    var profile: LearnedStyleProfile? { lock.lock(); defer { lock.unlock() }; return _profile }
    /// De navngitte stilene (v1 → én «Min stil»; v2 → flere distinkte looker).
    var styles: [LearnedStyleProfile.Style] { profile?.allStyles ?? [] }
    var styleNames: [String] { styles.map(\.name) }
    var isAvailable: Bool { !styles.isEmpty }
}
