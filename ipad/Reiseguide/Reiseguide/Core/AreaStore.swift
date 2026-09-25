// AreaStore.swift
//
// Holder valgt område i minnet, henter det fra backend for valgt språk og
// cacher siste svar som JSON i Caches-katalogen (Lead Map-mønsteret i
// Core/OfflineCache.swift, uten GRDB: hele området er ett lite snapshot).
// Uten nett vises cachet innhold; mangler både nett og cache vises feil.
//
// Flere områder (Lørenskog, Nesoddtangen): `select(slug:lang:)` bytter slug
// og viser cachet innhold for det nye området med én gang; ReiseguideApp
// laster så på nytt via `.task(id:)` på slug + språk. `loadAreas()` henter
// områdelisten til velgeren og cacher den, så velgeren virker uten nett.

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

    /// Områdelisten (GET /api/guide/areas) til velgeren.
    enum AreasState: Equatable {
        case idle
        case loading
        case loaded
        /// Listen kunne ikke hentes; `areas` er da lagret liste eller tom.
        case failed
    }

    /// Hvor lenge velgeren venter på områdelisten før den viser lagret liste.
    nonisolated static let areasTimeout: Duration = .seconds(8)

    private(set) var state: State = .idle
    private(set) var loadedLang: String?
    /// Området som vises (eller lastes) nå.
    private(set) var slug: String
    private(set) var areas: [GuideArea] = []
    private(set) var areasState: AreasState = .idle

    @ObservationIgnored private let api: GuideAPIClient
    @ObservationIgnored private let cacheDirectory: URL
    @ObservationIgnored private var loadedSlug: String?
    /// Når området sist ble hentet fra backend (ikke fra cache).
    @ObservationIgnored private var loadedAt: Date?

    /// Hvor gammelt innholdet kan være før det hentes på nytt når appen
    /// kommer tilbake i forgrunnen.
    nonisolated static let foregroundRefreshAge: TimeInterval = 5 * 60

    init(api: GuideAPIClient = GuideAPIClient(), areaSlug: String = AreaStore.demoAreaSlug, cacheDirectory: URL? = nil) {
        self.api = api
        self.slug = areaSlug
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

    /// Henter området på nytt hvis språket eller området har endret seg, eller vi ikke har noe.
    func loadIfNeeded(lang: String) async {
        if loadedLang == lang, loadedSlug == slug, response != nil { return }
        await load(lang: lang)
    }

    /// Når appen kommer tilbake i forgrunnen: henter området på nytt hvis det
    /// er eldre enn `maxAge`, så ny lyd og nye steder kommer uten at appen må
    /// startes på nytt. Innholdet som vises, byttes først når svaret er her.
    func refreshIfStale(lang: String, maxAge: TimeInterval = AreaStore.foregroundRefreshAge, now: Date = .now) async {
        guard response != nil, let loadedAt, now.timeIntervalSince(loadedAt) >= maxAge else { return }
        await load(lang: lang)
    }

    func load(lang: String) async {
        let requested = slug
        if response == nil { state = .loading }
        do {
            let fresh = try await api.area(idOrSlug: requested, lang: lang)
            // Brukeren byttet område mens vi ventet: ikke overskriv det nye.
            guard requested == slug else { return }
            state = .loaded(fresh, fromCache: false)
            loadedLang = lang
            loadedSlug = requested
            loadedAt = .now
            writeCache(fresh, slug: requested, lang: lang)
        } catch {
            guard requested == slug else { return }
            if let cached = readCache(slug: requested, lang: lang) {
                state = .loaded(cached, fromCache: true)
                loadedLang = lang
                loadedSlug = requested
            } else {
                state = .failed(error.localizedDescription)
            }
        }
    }

    /// Bytter område. Viser cachet innhold for det nye området med én gang
    /// hvis vi har det (ellers «laster»); ferskt innhold hentes av kalleren
    /// med `loadIfNeeded(lang:)` (ReiseguideApp gjør det via `.task(id:)`).
    func select(slug newSlug: String, lang: String) {
        guard newSlug != slug else { return }
        slug = newSlug
        loadedLang = nil
        loadedSlug = nil
        if let cached = readCache(slug: newSlug, lang: lang) {
            state = .loaded(cached, fromCache: true)
        } else {
            state = .loading
        }
    }

    /// Henter områdelisten. Viser lagret liste med én gang; uten nett (eller
    /// når backend ikke svarer innen `areasTimeout`) beholdes den og
    /// `areasState` blir `.failed`, så velgeren kan si fra.
    func loadAreas() async {
        if areas.isEmpty { areas = readAreasCache() ?? [] }
        areasState = .loading
        let api = self.api
        let timeout = Self.areasTimeout
        do {
            let fresh = try await withThrowingTaskGroup(of: [GuideArea].self, returning: [GuideArea].self) { group in
                group.addTask { try await api.areas() }
                group.addTask {
                    try await Task.sleep(for: timeout)
                    throw URLError(.timedOut)
                }
                defer { group.cancelAll() }
                guard let first = try await group.next() else { throw URLError(.unknown) }
                return first
            }
            areas = fresh
            areasState = .loaded
            writeAreasCache(fresh)
        } catch {
            areasState = .failed
        }
    }

    // MARK: - Cache

    /// Samme filnavn som før flere områder fantes, så eksisterende cache for Oslo gjenbrukes.
    nonisolated static func cacheFileName(slug: String, lang: String) -> String {
        "reiseguide-area-\(slug)-\(lang).json"
    }

    private func cacheURL(slug: String, lang: String) -> URL {
        cacheDirectory.appendingPathComponent(Self.cacheFileName(slug: slug, lang: lang))
    }

    private var areasCacheURL: URL {
        cacheDirectory.appendingPathComponent("reiseguide-areas.json")
    }

    private func writeCache(_ response: AreaResponse, slug: String, lang: String) {
        do {
            let data = try JSONEncoder().encode(response)
            try data.write(to: cacheURL(slug: slug, lang: lang), options: .atomic)
        } catch {
            // Cache er en bonus; appen er brukbar uten.
        }
    }

    private func readCache(slug: String, lang: String) -> AreaResponse? {
        guard let data = try? Data(contentsOf: cacheURL(slug: slug, lang: lang)) else { return nil }
        return try? JSONDecoder().decode(AreaResponse.self, from: data)
    }

    private func writeAreasCache(_ areas: [GuideArea]) {
        guard let data = try? JSONEncoder().encode(AreasResponse(areas: areas)) else { return }
        try? data.write(to: areasCacheURL, options: .atomic)
    }

    private func readAreasCache() -> [GuideArea]? {
        guard let data = try? Data(contentsOf: areasCacheURL) else { return nil }
        return try? JSONDecoder().decode(AreasResponse.self, from: data).areas
    }
}
