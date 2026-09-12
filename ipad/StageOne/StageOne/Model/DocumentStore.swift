import Foundation

/// JSON-persistens for scener: `<id>.stageone.json` i Documents.
struct DocumentStore: Sendable {
    var directory: URL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    private static let suffix = ".stageone.json"

    func save(_ scene: SceneData, id: String) throws {
        let enc = JSONEncoder()
        enc.outputFormatting = [.sortedKeys]
        try enc.encode(scene).write(to: url(id), options: .atomic)
    }

    func load(id: String) throws -> SceneData {
        try JSONDecoder().decode(SceneData.self, from: Data(contentsOf: url(id)))
    }

    func listSceneIds() -> [String] {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: directory.path)) ?? []
        return names.filter { $0.hasSuffix(Self.suffix) }
            .map { String($0.dropLast(Self.suffix.count)) }
            .sorted()
    }

    private func url(_ id: String) -> URL { directory.appendingPathComponent(id + Self.suffix) }
}
