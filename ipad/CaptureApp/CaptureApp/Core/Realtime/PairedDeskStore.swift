import Foundation

/// Lagrer Desk-instanser iPad-en har gått med på å pare med. Backes av
/// UserDefaults — ikke GRDB — fordi:
///   1. Datamengden er trivial (typisk 1-3 Desks per fotograf).
///   2. Vi vil ikke at en GRDB-migration-bug skal låse paringen ute.
///   3. Backup/restore via iCloud (default for UserDefaults) er nice
///      hvis fotografen bytter iPad.
///
/// Hver entry har:
///   - deskId: stabil UUID Desk-siden genererer + lagrer lokalt
///   - deskName: visningsnavn ("Daniel's Mac Studio")
///   - pairedAt: tidsstempel
struct PairedDesk: Codable, Sendable, Equatable, Identifiable {
    var id: String { deskId }
    let deskId: String
    let deskName: String
    let pairedAt: Date
}

@MainActor
final class PairedDeskStore {
    static let shared = PairedDeskStore()

    private let key = "creatorhub.one.paired-desks.v1"
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func load() -> [PairedDesk] {
        guard
            let data = defaults.data(forKey: key),
            let list = try? decoder.decode([PairedDesk].self, from: data)
        else {
            return []
        }
        return list
    }

    /// Upsert basert på deskId. Hvis Desk allerede er paret, oppdaterer
    /// vi bare deskName + pairedAt så omdøping i Desk-appen reflekteres
    /// neste gang fotografen pares.
    func upsert(_ desk: PairedDesk) {
        var list = load()
        list.removeAll { $0.deskId == desk.deskId }
        list.append(desk)
        persist(list)
    }

    func remove(deskId: String) {
        var list = load()
        list.removeAll { $0.deskId == deskId }
        persist(list)
    }

    func isPaired(deskId: String) -> Bool {
        load().contains { $0.deskId == deskId }
    }

    private func persist(_ list: [PairedDesk]) {
        guard let data = try? encoder.encode(list) else { return }
        defaults.set(data, forKey: key)
    }

    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()
}
