// VisitLog.swift
//
// Personlig logg over besøkte steder med tid og dato («etter besøket»,
// Daniel 18.09.2026). Ligger KUN på telefonen: appen har ingen konto, og
// hvor noen har vært er personopplysninger vi ikke trenger på serveren.
// Lagres som JSON i Application Support (atomisk skriving); tåler at fila
// mangler eller er ødelagt (da starter loggen tom).
//
// Ett besøk = én oppføring. Starter man samme sted igjen innen kort tid
// (pause, bytte av variant) gjenbrukes oppføringen i stedet for å lage en ny.

import Foundation
import Observation

struct VisitEntry: Codable, Sendable, Identifiable, Equatable {
    let id: String
    let poiId: String
    let poiSlug: String
    var title: String
    let startedAt: Date
    var completedAt: Date?
    /// Stjerner 1–5 gitt etter besøket; nil til brukeren har vurdert.
    var stars: Int?
    var quizCorrect: Int?
    var quizTotal: Int?

    var isCompleted: Bool { completedAt != nil }

    /// Tidspunktet loggen viser: fullført hvis det finnes, ellers start.
    var displayDate: Date { completedAt ?? startedAt }
}

@MainActor
@Observable
final class VisitLogStore {
    /// Nytt oppslag på samme sted innen dette vinduet regnes som samme besøk.
    nonisolated static let sameVisitWindow: TimeInterval = 3 * 60 * 60

    /// Nyeste først.
    private(set) var entries: [VisitEntry] = []

    @ObservationIgnored private let fileURL: URL
    @ObservationIgnored private let now: () -> Date

    init(fileURL: URL? = nil, now: @escaping () -> Date = { Date() }) {
        self.now = now
        self.fileURL = fileURL ?? Self.defaultFileURL()
        entries = Self.read(from: self.fileURL)
    }

    var visitedPoiIds: Set<String> { Set(entries.map(\.poiId)) }

    func entry(id: String) -> VisitEntry? { entries.first { $0.id == id } }

    func latestEntry(poiId: String) -> VisitEntry? { entries.first { $0.poiId == poiId } }

    /// Registrerer at en opplevelse startet. Returnerer oppføringen som
    /// avspilleren skal oppdatere videre (fullført, stjerner, quiz).
    @discardableResult
    func recordStart(poi: GuidePOI) -> VisitEntry {
        let timestamp = now()
        if let existing = latestEntry(poiId: poi.id),
           timestamp.timeIntervalSince(existing.startedAt) < Self.sameVisitWindow {
            update(existing.id) { $0.title = poi.title }
            return entry(id: existing.id) ?? existing
        }
        let entry = VisitEntry(
            id: UUID().uuidString,
            poiId: poi.id,
            poiSlug: poi.slug,
            title: poi.title,
            startedAt: timestamp,
            completedAt: nil,
            stars: nil,
            quizCorrect: nil,
            quizTotal: nil
        )
        entries.insert(entry, at: 0)
        persist()
        return entry
    }

    func markCompleted(entryId: String) {
        let timestamp = now()
        update(entryId) { entry in
            if entry.completedAt == nil { entry.completedAt = timestamp }
        }
    }

    func setStars(entryId: String, stars: Int) {
        let clamped = min(5, max(1, stars))
        update(entryId) { $0.stars = clamped }
    }

    func setQuizResult(entryId: String, correct: Int, total: Int) {
        update(entryId) { entry in
            entry.quizCorrect = correct
            entry.quizTotal = total
        }
    }

    func remove(entryId: String) {
        entries.removeAll { $0.id == entryId }
        persist()
    }

    func removeAll() {
        entries = []
        persist()
    }

    // MARK: - Privat

    private func update(_ entryId: String, _ change: (inout VisitEntry) -> Void) {
        guard let index = entries.firstIndex(where: { $0.id == entryId }) else { return }
        change(&entries[index])
        persist()
    }

    private func persist() {
        do {
            let directory = fileURL.deletingLastPathComponent()
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.sortedKeys]
            try encoder.encode(entries).write(to: fileURL, options: .atomic)
        } catch {
            // Loggen lever videre i minnet; neste vellykkede skriving tar igjen.
        }
    }

    nonisolated private static func read(from url: URL) -> [VisitEntry] {
        guard let data = try? Data(contentsOf: url) else { return [] }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let decoded = (try? decoder.decode([VisitEntry].self, from: data)) ?? []
        return decoded.sorted { $0.startedAt > $1.startedAt }
    }

    nonisolated private static func defaultFileURL() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return base.appendingPathComponent("SenseAidExplore", isDirectory: true).appendingPathComponent("visits.json")
    }
}
