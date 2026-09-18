// AreaStore.swift
//
// Holder demo-området i minnet, henter det fra backend for valgt språk og
// cacher siste svar som JSON i Caches-katalogen (Lead Map-mønsteret i
// Core/OfflineCache.swift, uten GRDB: hele området er ett lite snapshot).
// Uten nett vises cachet innhold; mangler både nett og cache vises feil.

import Foundation
import Observation

@MainActor
@Observable
final class AreaStore {
    /// Demo-området (seed: backend/server/reiseguide-demo-data.ts).
    nonisolated static let demoAreaSlug = "oslo-kvadraturen-festningen-operaen"

    enum State: Equatable {
        case idle
        case loading
        case loaded(AreaResponse, fromCache: Bool)
        case failed(String)
    }

    private(set) var state: State = .idle
    private(set) var loadedLang: String?

    @ObservationIgnored private let api: GuideAPIClient
    @ObservationIgnored private let cacheDirectory: URL
    @ObservationIgnored private let areaSlug: String

    init(api: GuideAPIClient = GuideAPIClient(), areaSlug: String = AreaStore.demoAreaSlug, cacheDirectory: URL? = nil) {
        self.api = api
        self.areaSlug = areaSlug
        self.cacheDirectory = cacheDirectory
            ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
    }

    var response: AreaResponse? {
        if case let .loaded(response, _) = state { return response }
        return nil
    }

    var area: GuideArea? { response?.area }
    var pois: [GuidePOI] { response?.pois ?? [] }
    var categories: [GuideCategory] { response?.categories ?? [] }

    func poi(id: String) -> GuidePOI? { pois.first { $0.id == id } }

    /// Henter området på nytt hvis språket har endret seg eller vi ikke har noe.
    func loadIfNeeded(lang: String) async {
        if loadedLang == lang, response != nil { return }
        await load(lang: lang)
    }

    func load(lang: String) async {
        if response == nil { state = .loading }
        do {
            let fresh = try await api.area(idOrSlug: areaSlug, lang: lang)
            state = .loaded(fresh, fromCache: false)
            loadedLang = lang
            writeCache(fresh, lang: lang)
        } catch {
            if let cached = readCache(lang: lang) {
                state = .loaded(cached, fromCache: true)
                loadedLang = lang
            } else {
                state = .failed(error.localizedDescription)
            }
        }
    }

    // MARK: - Cache

    private func cacheURL(lang: String) -> URL {
        cacheDirectory.appendingPathComponent("reiseguide-area-\(areaSlug)-\(lang).json")
    }

    private func writeCache(_ response: AreaResponse, lang: String) {
        do {
            let data = try JSONEncoder().encode(response)
            try data.write(to: cacheURL(lang: lang), options: .atomic)
        } catch {
            // Cache er en bonus; appen er brukbar uten.
        }
    }

    private func readCache(lang: String) -> AreaResponse? {
        guard let data = try? Data(contentsOf: cacheURL(lang: lang)) else { return nil }
        return try? JSONDecoder().decode(AreaResponse.self, from: data)
    }
}
