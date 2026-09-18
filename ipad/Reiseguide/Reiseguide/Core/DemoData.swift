// DemoData.swift
//
// MOCK: vurderinger («4,8», «1,2k») finnes ikke i POC-backenden. Beslutning
// 18.09.2026 (UI-spesifikasjon 6.3, punkt 3): vis mock-tall i demo-modus, og
// skjul raden automatisk når severdigheten ikke har vurdering her.
// Fjernes når backend leverer `rating`.

import Foundation

enum DemoData {
    struct Rating: Sendable, Equatable {
        let value: Double
        let count: Int
    }

    // MOCK
    private static let ratings: [String: Rating] = [
        "akershus-festning": Rating(value: 4.8, count: 1_200),
        "operaen": Rating(value: 4.9, count: 3_400),
        "christiania-torv": Rating(value: 4.4, count: 310),
        "bankplassen": Rating(value: 4.5, count: 420),
        "oslo-bors": Rating(value: 4.2, count: 150),
        "gamle-radhus": Rating(value: 4.3, count: 96),
    ]

    static func rating(forSlug slug: String) -> Rating? { ratings[slug] }
}
