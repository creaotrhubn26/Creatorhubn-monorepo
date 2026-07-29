import Foundation

/// Laster en bundlet arkiv-lært stil-profil (`learned_style.json`, eksportert fra
/// Post Agent-motoren). Nil når ingen profil er bundlet → «Min stil»-valget vises
/// ikke. På sikt: last nedlastede/synkede profiler per fotograf fra Documents.
final class LearnedStyleStore: @unchecked Sendable {
    static let shared = LearnedStyleStore()

    let profile: LearnedStyleProfile?
    var isAvailable: Bool { profile != nil }
    var sceneCount: Int { profile?.scenes.count ?? 0 }

    private init() {
        if let url = Bundle.main.url(forResource: "learned_style", withExtension: "json") {
            profile = LearnedStyleProfile.load(contentsOf: url)
        } else {
            profile = nil
        }
    }
}
