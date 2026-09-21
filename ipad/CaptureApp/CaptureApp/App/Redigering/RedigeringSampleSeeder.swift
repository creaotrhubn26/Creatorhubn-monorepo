#if DEBUG
import Foundation
import UIKit

/// DEBUG-only: seeds a capture session + asset so the Redigering-tab har ET bilde
/// å redigere (nok til å demonstrere «Min stil (lært)» + slidere). Foretrekker en
/// LOKAL, ikke-committet RAW-fixture (`_MG_9300.CR2` / `demo_wedding.CR3`) hvis den
/// er bundlet; ellers GENERERES et syntetisk demo-bilde i minne. Slik virker
/// `--demo-redigering` ut av boksen på enhet/CI uten å committe en binær (og uten
/// klient-bilder), og ingenting av dette havner i Release (`#if DEBUG`).
/// No-ops når sample-økten alt finnes.
enum RedigeringSampleSeeder {
    /// Hold den genererte portrett-QA-en adskilt fra eldre demoøkter. Da får
    /// UI-testen alltid den nyeste fixture-filen selv på en simulator som har
    /// kjørt `--demo-redigering` tidligere.
    static var sessionName: String {
        ProcessInfo.processInfo.arguments.contains("--portrait-fixture")
            ? "Portrett QA"
            : "CR2 testbilde"
    }

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
        if let existingSession = existing.first(where: { $0.name == sessionName }) {
            // XCUITest re-installer app-bundlen. DB-en kan overleve, men gamle
            // absolutte Documents-stier inneholder da en utgått container-UUID.
            // Reparér fixture-kopien + DB-pekeren ved hver portrett-QA-start.
            if ProcessInfo.processInfo.arguments.contains("--portrait-fixture") {
                await repairPortraitFixture(in: existingSession, store: store)
            }
            return
        }

        // Ingen RAW-fixture bundlet (enhet/CI/frisk installasjon) → seed et syntetisk
        // demo-bilde så editoren ikke står tom. Kun preview (ingen rawKey).
        guard let sample = bundledRaw(),
              let rawData = try? Data(contentsOf: sample.url) else {
            await seedSynthetic(store: store, ownerUserId: ownerUserId)
            return
        }

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

        // Portrett-QA bruker den naturlige portrettoppskriften; den generelle
        // RAW-demoen beholder bryllupsgraden som før.
        RedigeringEditStore.save(
            asset.id,
            .init(
                recipe: ProcessInfo.processInfo.arguments.contains("--portrait-fixture") ? .portrait : .wedding,
                exposureEV: 0,
                crop: nil
            )
        )
    }

    /// Seed en økt + asset fra den bundlete, AI-genererte portrett-fixturen.
    /// Den syntetiske tegningen beholdes som siste fallback slik at DEBUG-ruten
    /// fortsatt virker dersom noen bygger uten ressursfilen.
    private static func seedSynthetic(store: SessionStore, ownerUserId: String) async {
        let bundledPortrait = bundledPortraitJPEG()
        guard let jpg = bundledPortrait ?? syntheticSampleJPEG() else { return }
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("sample", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let previewDest = dir.appendingPathComponent("demo_sample_preview.jpg")
        try? jpg.write(to: previewDest, options: .atomic)
        guard let session = try? await store.createSession(
                name: sessionName, clientId: nil, ownerUserId: ownerUserId),
              let asset = try? await store.createAsset(
                sessionId: session.id,
                descriptor: AssetDescriptor(
                    id: UUID(),
                    originalFilename: bundledPortrait == nil
                        ? "demo_sample.jpg"
                        : "creatorhub-editor-portrait.jpg",
                    captureTime: Date(),
                    mime: "image/jpeg", sizeBytes: Int64(jpg.count)),
                initialState: .previewReady) else { return }
        try? await store.attachStorageKey(
            id: asset.id, kind: .preview, key: previewDest.path,
            checksumSha256: "", sizeBytes: Int64(jpg.count))
        RedigeringEditStore.save(
            asset.id,
            .init(
                recipe: ProcessInfo.processInfo.arguments.contains("--portrait-fixture") ? .portrait : .wedding,
                exposureEV: 0,
                crop: nil
            )
        )
    }

    private static func bundledPortraitJPEG() -> Data? {
        Bundle.main.url(
            forResource: "creatorhub-editor-portrait",
            withExtension: "jpg"
        ).flatMap { try? Data(contentsOf: $0) }
    }

    /// Rebind et eksisterende QA-asset til DEN NÅVÆRENDE app-containeren.
    /// Dette er kun DEBUG/demo-data; ekte importer flyttes aldri på denne måten.
    private static func repairPortraitFixture(in session: Session, store: SessionStore) async {
        guard let jpg = bundledPortraitJPEG(),
              let assets = try? await store.listAssets(sessionId: session.id),
              let asset = assets.first else { return }
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("sample", isDirectory: true)
        let destination = dir.appendingPathComponent("demo_sample_preview.jpg")
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try jpg.write(to: destination, options: .atomic)
            try await store.attachStorageKey(
                id: asset.id,
                kind: .preview,
                key: destination.path,
                checksumSha256: "",
                sizeBytes: Int64(jpg.count)
            )
            // En QA-kjøring skal starte fra samme, naturlige portrettoppskrift
            // hver gang. Ellers ligger crop/EV fra forrige simulatorrunde igjen
            // i UserDefaults og skjermbildet tester ikke lenger fabrikktilstanden.
            RedigeringEditStore.save(
                asset.id,
                .init(recipe: .portrait, exposureEV: 0, crop: nil)
            )
        } catch {
            NSLog("RedigeringSampleSeeder: kunne ikke reparere portrett-fixture: %@", String(describing: error))
        }
    }

    /// Generer et tydelig SYNTETISK portrett (varm gradient + mykt motiv-lys i
    /// hudtone) — nok tonalt/farge-spenn til at «Min stil»-graden + sliderne viser
    /// synlig effekt. Ingen klient-data, ingen committet binær.
    private static func syntheticSampleJPEG() -> Data? {
        let size = CGSize(width: 1600, height: 2000)
        let space = CGColorSpaceCreateDeviceRGB()
        let img = UIGraphicsImageRenderer(size: size).image { ctx in
            let cg = ctx.cgContext
            if let bg = CGGradient(colorsSpace: space, colors: [
                UIColor(red: 0.20, green: 0.22, blue: 0.27, alpha: 1).cgColor,
                UIColor(red: 0.44, green: 0.35, blue: 0.28, alpha: 1).cgColor] as CFArray,
                locations: [0, 1]) {
                cg.drawLinearGradient(bg, start: .zero, end: CGPoint(x: 0, y: size.height), options: [])
            }
            let subj = CGRect(x: size.width * 0.22, y: size.height * 0.24,
                              width: size.width * 0.56, height: size.height * 0.56)
            cg.saveGState(); cg.addEllipse(in: subj); cg.clip()
            if let skin = CGGradient(colorsSpace: space, colors: [
                UIColor(red: 0.92, green: 0.80, blue: 0.72, alpha: 1).cgColor,
                UIColor(red: 0.70, green: 0.55, blue: 0.49, alpha: 1).cgColor] as CFArray,
                locations: [0, 1]) {
                let c = CGPoint(x: subj.midX, y: subj.midY)
                cg.drawRadialGradient(skin, startCenter: c, startRadius: 0,
                                      endCenter: c, endRadius: subj.width * 0.75, options: [])
            }
            cg.restoreGState()
            ("SYNTETISK DEMO-BILDE" as NSString).draw(
                at: CGPoint(x: 60, y: size.height - 96),
                withAttributes: [.foregroundColor: UIColor.white.withAlphaComponent(0.55),
                                 .font: UIFont.systemFont(ofSize: 42, weight: .semibold)])
        }
        return img.jpegData(compressionQuality: 0.9)
    }
}
#endif
