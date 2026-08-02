#if DEBUG
import Foundation

/// DEBUG-only: seeds a capture session + asset from a bundled sample Canon CR2
/// (`_MG_9300.CR2`) so the Redigering tab has a real RAW to edit in the
/// simulator. No-ops when the fixture isn't bundled or the sample session
/// already exists. The CR2 is a local fixture — not committed.
enum RedigeringSampleSeeder {
    static let sessionName = "CR2 testbilde"

    /// Finn et bundlet RAW-testbilde. Foretrekk demo-bryllupsbildet (CR3), fall
    /// tilbake til den eldre `_MG_9300.CR2`. Begge dekodes direkte via CIRAWFilter.
    private static func bundledRaw() -> (url: URL, hint: String)? {
        if let u = Bundle.main.url(forResource: "demo_wedding", withExtension: "CR3") { return (u, "cr3") }
        if let u = Bundle.main.url(forResource: "demo_wedding", withExtension: "CR2") { return (u, "cr2") }
        if let u = Bundle.main.url(forResource: "_MG_9300", withExtension: "CR2") { return (u, "cr2") }
        return nil
    }

    static func seedIfNeeded(ownerUserId: String) async {
        guard let url = try? AppDatabase.defaultDiskURL(),
              let db = try? AppDatabase.openOnDisk(at: url) else { return }
        let store = SessionStore(database: db)

        let existing = (try? await store.listSessions(ownerUserId: ownerUserId)) ?? []
        if existing.contains(where: { $0.name == sessionName }) { return }

        guard let sample = bundledRaw(),
              let rawData = try? Data(contentsOf: sample.url) else { return }

        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("sample", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        // Camera-original RAW on disk (rawKey) — Redigering renders this via
        // CIRAWFilter directly.
        let rawDest = dir.appendingPathComponent("demo_sample.\(sample.hint)")
        try? rawData.write(to: rawDest, options: .atomic)

        // A display preview (previewKey) for the filmstrip + "Før".
        let previewDest = dir.appendingPathComponent("demo_sample_preview.jpg")
        if let jpeg = try? RAWExportPipeline.render(
            rawData: rawData, recipe: .neutral, identifierHint: sample.hint,
            targetMaxDimension: 2400, colorPurpose: .appPreview,
        ) {
            try? jpeg.write(to: previewDest, options: .atomic)
        }

        guard let session = try? await store.createSession(
            name: sessionName, clientId: nil, ownerUserId: ownerUserId) else { return }
        let desc = AssetDescriptor(
            id: UUID(), originalFilename: "demo_sample.\(sample.hint)", captureTime: Date(),
            mime: sample.hint == "cr3" ? "image/x-canon-cr3" : "image/x-canon-cr2",
            sizeBytes: Int64(rawData.count))
        guard let asset = try? await store.createAsset(
            sessionId: session.id, descriptor: desc, initialState: .previewReady) else { return }

        try? await store.attachStorageKey(
            id: asset.id, kind: .raw, key: rawDest.path, checksumSha256: "", sizeBytes: Int64(rawData.count))
        if FileManager.default.fileExists(atPath: previewDest.path) {
            let size = (try? FileManager.default.attributesOfItem(atPath: previewDest.path)[.size] as? Int64) ?? 0
            try? await store.attachStorageKey(
                id: asset.id, kind: .preview, key: previewDest.path, checksumSha256: "", sizeBytes: size ?? 0)
        }

        // Åpne demoen med «Bryllup»-graden alt påført, så «Etter» viser den
        // korrigerende redigeringen live (fotografen kan bytte preset derfra).
        RedigeringEditStore.save(asset.id, .init(recipe: .wedding, exposureEV: 0, crop: nil))
    }
}
#endif
