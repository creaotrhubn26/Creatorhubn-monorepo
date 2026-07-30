import Foundation

/// Laster en bundlet arkiv-lært stil-profil (`learned_style.json`, eksportert fra
/// Post Agent-motoren). Nil når ingen profil er bundlet → «Min stil»-valget vises
/// ikke. På sikt: last nedlastede/synkede profiler per fotograf fra Documents.
final class LearnedStyleStore: @unchecked Sendable {
    static let shared = LearnedStyleStore()

    /// Demo-hekte (`--demo-redigering --learned-on[=N]`): la Redigering-demoen
    /// åpne med stil N alt valgt, så før/etter kan fanges i sim-skjermbilder.
    nonisolated(unsafe) static var demoForceStyleIndex: Int?

    let profile: LearnedStyleProfile?
    /// De navngitte stilene (v1 → én «Min stil»; v2 → flere distinkte looker).
    var styles: [LearnedStyleProfile.Style] { profile?.allStyles ?? [] }
    var styleNames: [String] { styles.map(\.name) }
    var isAvailable: Bool { !styles.isEmpty }

    private init() {
        if let url = Bundle.main.url(forResource: "learned_style", withExtension: "json") {
            profile = LearnedStyleProfile.load(contentsOf: url)
        } else {
            profile = nil
        }
    }
}
