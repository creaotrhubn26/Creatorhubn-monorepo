import Foundation
import UIKit
import XCTest
@testable import CaptureApp

final class CardImportServiceTests: XCTestCase {
    func testScanClassifiesAndPairsMixedCardContents() throws {
        let root = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let dcim = root.appendingPathComponent("DCIM/100CANON", isDirectory: true)
        try FileManager.default.createDirectory(at: dcim, withIntermediateDirectories: true)
        try Data("jpeg".utf8).write(to: dcim.appendingPathComponent("IMG_0001.JPG"))
        try Data("raw".utf8).write(to: dcim.appendingPathComponent("IMG_0001.CR3"))
        try Data("movie".utf8).write(to: dcim.appendingPathComponent("MVI_0002.MOV"))
        try makeWave().write(to: dcim.appendingPathComponent("A001T001.WAV"))
        try Data("sidecar".utf8).write(to: dcim.appendingPathComponent("MVI_0002.THM"))

        let result = CardImportService.scanAll(urls: [root])

        XCTAssertEqual(result.photos.count, 2)
        XCTAssertEqual(result.photoGroups.count, 1)
        XCTAssertEqual(result.videos.map(\.filename), ["MVI_0002.MOV"])
        XCTAssertEqual(result.audios.map(\.filename), ["A001T001.WAV"])
        XCTAssertEqual(result.unsupportedFileCount, 0)
        XCTAssertEqual(result.sidecarFileCount, 1)
        XCTAssertEqual(result.totalBytes, 4 + 3 + 5 + Int64(try makeWave().count))
    }

    func testCardIdentityPrefersStableVolumeAndUsesContentFallback() {
        let stableBefore = CardImportService.stableIdentifier(
            name: "EOS_DIGITAL", capacity: 128_000, volumeIdentifier: "volume-a", contentSignature: "before"
        )
        let stableAfter = CardImportService.stableIdentifier(
            name: "EOS_DIGITAL", capacity: 128_000, volumeIdentifier: "volume-a", contentSignature: "after"
        )
        let otherVolume = CardImportService.stableIdentifier(
            name: "EOS_DIGITAL", capacity: 128_000, volumeIdentifier: "volume-b", contentSignature: "before"
        )
        let fallbackOtherContent = CardImportService.stableIdentifier(
            name: "EOS_DIGITAL", capacity: 128_000, volumeIdentifier: nil, contentSignature: "after"
        )
        let fallbackFirstContent = CardImportService.stableIdentifier(
            name: "EOS_DIGITAL", capacity: 128_000, volumeIdentifier: nil, contentSignature: "before"
        )
        let fallbackRenamed = CardImportService.stableIdentifier(
            name: "RENAMED_CARD", capacity: 128_000, volumeIdentifier: nil, contentSignature: "before"
        )

        XCTAssertEqual(stableBefore, stableAfter)
        XCTAssertNotEqual(stableBefore, otherVolume)
        XCTAssertNotEqual(fallbackFirstContent, fallbackOtherContent)
        XCTAssertEqual(fallbackFirstContent, fallbackRenamed)
        XCTAssertEqual(stableBefore.count, 64)
    }

    func testScanSurfacesUnreadableMediaAndExcludesProxyByDefault() throws {
        let root = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let originals = root.appendingPathComponent("DCIM/100CANON", isDirectory: true)
        let proxies = root.appendingPathComponent("PROXY", isDirectory: true)
        try FileManager.default.createDirectory(at: originals, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: proxies, withIntermediateDirectories: true)
        try Data().write(to: originals.appendingPathComponent("BROKEN.JPG"))
        try Data(repeating: 1, count: 16).write(to: originals.appendingPathComponent("C0001.MOV"))
        try Data(repeating: 2, count: 16).write(to: proxies.appendingPathComponent("C0001_PROXY.MOV"))
        try Data("sidecar".utf8).write(to: originals.appendingPathComponent("C0001.XMP"))

        let result = CardImportService.scanAll(urls: [root])
        let runId = UUID()
        let items = CardImportManifestBuilder.makeItems(runId: runId, scan: result, pickedURLs: [root])

        XCTAssertEqual(result.sidecarFileCount, 1)
        XCTAssertEqual(result.proxyFileCount, 1)
        XCTAssertEqual(items.first(where: { $0.filename == "BROKEN.JPG" })?.inspection.state, .unreadable)
        XCTAssertEqual(items.first(where: { $0.filename == "BROKEN.JPG" })?.selected, false)
        XCTAssertEqual(items.first(where: { $0.filename == "C0001_PROXY.MOV" })?.inspection.proxyState, .proxy)
        XCTAssertEqual(items.first(where: { $0.filename == "C0001_PROXY.MOV" })?.selected, false)
    }

    func testSourceFingerprintSurvivesSelectingRootOrCameraFolder() throws {
        let root = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: root) }
        let cameraFolder = root.appendingPathComponent("DCIM/100CANON", isDirectory: true)
        try FileManager.default.createDirectory(at: cameraFolder, withIntermediateDirectories: true)
        try makeJPEG().write(to: cameraFolder.appendingPathComponent("IMG_0001.JPG"))

        let rootScan = CardImportService.scanAll(urls: [root])
        let folderScan = CardImportService.scanAll(urls: [cameraFolder])
        let runId = UUID()
        let rootItem = CardImportManifestBuilder.makeItems(
            runId: runId, scan: rootScan, pickedURLs: [root]
        ).first
        let folderItem = CardImportManifestBuilder.makeItems(
            runId: runId, scan: folderScan, pickedURLs: [cameraFolder]
        ).first

        XCTAssertEqual(rootItem?.sourceFingerprint, folderItem?.sourceFingerprint)
    }

    func testPhotoPairCreatesDistinctPreviewAndPersistentSourceFingerprints() async throws {
        let source = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: source) }
        let jpegURL = source.appendingPathComponent("IMG_0042.JPG")
        let rawURL = source.appendingPathComponent("IMG_0042.CR3")
        try makeJPEG().write(to: jpegURL)
        try Data(repeating: 0x2A, count: 8_192).write(to: rawURL)

        let database = try AppDatabase.inMemory()
        let service = CardImportService(database: database)
        let session = try await service.createImportSession(name: "Card", ownerUserId: "owner")
        defer {
            if let directory = try? CardImportService.storageDirectory(sessionId: session.id) {
                try? FileManager.default.removeItem(at: directory)
            }
        }
        let group = try XCTUnwrap(CardImportService.scanAll(urls: [source]).photoGroups.first)

        let result = try await service.importGroup(
            group,
            into: session.id,
            ownerUserId: "owner",
            seenChecksums: [],
            storagePolicy: .creatorHubOnly
        )
        let imported = try XCTUnwrap(result.imported)
        let fetchedPhoto = try await SessionStore(database: database).fetchAsset(id: imported.asset.id)
        let stored = try XCTUnwrap(fetchedPhoto)

        XCTAssertEqual(stored.storagePolicy, .creatorHubOnly)
        XCTAssertNotNil(stored.previewKey)
        XCTAssertNotNil(stored.fullKey)
        XCTAssertNotNil(stored.rawKey)
        XCTAssertNotEqual(stored.previewKey, stored.fullKey)
        XCTAssertTrue(try XCTUnwrap(stored.fullKey).contains("/Foto/"))
        XCTAssertTrue(FileManager.default.fileExists(atPath: try XCTUnwrap(stored.previewKey)))
        XCTAssertTrue(FileManager.default.fileExists(atPath: try XCTUnwrap(stored.fullKey)))
        XCTAssertTrue(FileManager.default.fileExists(atPath: try XCTUnwrap(stored.rawKey)))
        XCTAssertEqual(Set(imported.backupItems.map(\.kind)), Set([.preview, .full, .raw]))

        let fingerprints = try await service.existingChecksums(ownerUserId: "owner")
        XCTAssertEqual(fingerprints.count, 2)
        let signatures = try await service.existingImportSignatures(ownerUserId: "owner")
        XCTAssertTrue(signatures.contains(CardImportService.importSignature(
            filename: "IMG_0042.JPG",
            sizeBytes: Int64(try Data(contentsOf: jpegURL).count)
        )))
        let duplicate = try await service.importGroup(
            group,
            into: session.id,
            ownerUserId: "owner",
            seenChecksums: fingerprints
        )
        XCTAssertNil(duplicate.imported)
    }

    func testVideoImportPersistsOfflineTakeAndDeduplicatesByChecksum() async throws {
        let source = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: source) }
        let videoURL = source.appendingPathComponent("C0001.MOV")
        try Data(repeating: 0x7F, count: 16_384).write(to: videoURL)

        let database = try AppDatabase.inMemory()
        let service = CardImportService(database: database)
        let session = try await service.createImportSession(name: "Field", ownerUserId: "owner")
        defer {
            if let directory = try? CardImportService.storageDirectory(sessionId: session.id) {
                try? FileManager.default.removeItem(at: directory)
            }
        }
        let video = try XCTUnwrap(CardImportService.scanAll(urls: [source]).videos.first)

        let first = try await service.importVideo(
            video,
            sessionId: session.id,
            ownerUserId: "owner",
            projectId: nil,
            takeNumber: 1,
            storagePolicy: .keepLocalAndCloud,
            seenChecksums: []
        )
        let fetchedVideo = try await VideoCaptureStore(database: database).asset(
            id: try XCTUnwrap(first.asset?.id),
            ownerUserId: "owner"
        )
        let stored = try XCTUnwrap(fetchedVideo)
        XCTAssertEqual(stored.projectId, "")
        XCTAssertEqual(stored.sourceType, .imported)
        XCTAssertEqual(stored.captureState, .local)
        XCTAssertTrue(stored.localPath.contains("/Video/"))
        XCTAssertTrue(FileManager.default.fileExists(atPath: stored.localPath))

        let fingerprints = try await service.existingVideoChecksums(ownerUserId: "owner")
        let duplicate = try await service.importVideo(
            video,
            sessionId: session.id,
            ownerUserId: "owner",
            projectId: nil,
            takeNumber: 2,
            storagePolicy: .keepLocalAndCloud,
            seenChecksums: fingerprints
        )
        XCTAssertNil(duplicate.asset)
    }

    func testProductionAudioImportPreservesBWFMetadataAndDeduplicates() async throws {
        let source = try temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: source) }
        let audioURL = source.appendingPathComponent("A001T001.WAV")
        try makeWave().write(to: audioURL)

        let database = try AppDatabase.inMemory()
        let service = CardImportService(database: database)
        let session = try await service.createImportSession(name: "Sound", ownerUserId: "owner")
        defer {
            if let directory = try? CardImportService.storageDirectory(sessionId: session.id) {
                try? FileManager.default.removeItem(at: directory)
            }
        }
        let audio = try XCTUnwrap(CardImportService.scanAll(urls: [source]).audios.first)
        let first = try await service.importAudio(
            audio,
            sessionId: session.id,
            ownerUserId: "owner",
            projectId: nil,
            storagePolicy: .keepLocalAndCloud,
            seenChecksums: []
        )
        let id = try XCTUnwrap(first.asset?.id)
        let fetched = try await ProductionAudioStore(database: database).asset(
            id: id,
            ownerUserId: "owner"
        )
        let stored = try XCTUnwrap(fetched)

        XCTAssertEqual(stored.projectId, "")
        XCTAssertEqual(stored.captureState, .local)
        XCTAssertEqual(stored.sampleRate, 48_000)
        XCTAssertEqual(stored.bitDepth, 24)
        XCTAssertEqual(stored.channelCount, 2)
        XCTAssertEqual(stored.channelNames, ["Boom", "Lavalier"])
        XCTAssertEqual(stored.scene, "12A")
        XCTAssertEqual(stored.take, "3")
        XCTAssertEqual(stored.recorderManufacturer, "Sound Devices")
        XCTAssertEqual(stored.metadata["bextOriginatorReference"], "833-TEST")
        XCTAssertEqual(stored.timeReferenceSamples, 172_800_000)
        XCTAssertEqual(stored.timecodeStart, "01:00:00:00")
        XCTAssertTrue(stored.localPath.contains("/Lyd/"))
        XCTAssertTrue(FileManager.default.fileExists(atPath: stored.localPath))

        let fingerprints = try await service.existingAudioChecksums(ownerUserId: "owner")
        let duplicate = try await service.importAudio(
            audio,
            sessionId: session.id,
            ownerUserId: "owner",
            projectId: nil,
            storagePolicy: .keepLocalAndCloud,
            seenChecksums: fingerprints
        )
        XCTAssertNil(duplicate.asset)
    }

    private func temporaryDirectory() throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("card-import-test-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    private func makeJPEG() throws -> Data {
        let image = UIGraphicsImageRenderer(size: CGSize(width: 64, height: 48)).image { context in
            UIColor.systemBlue.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 64, height: 48))
        }
        return try XCTUnwrap(image.jpegData(compressionQuality: 0.9))
    }

    private func makeWave() throws -> Data {
        var format = Data()
        format.appendLittleEndian(UInt16(1))
        format.appendLittleEndian(UInt16(2))
        format.appendLittleEndian(UInt32(48_000))
        format.appendLittleEndian(UInt32(288_000))
        format.appendLittleEndian(UInt16(6))
        format.appendLittleEndian(UInt16(24))

        var bext = Data(repeating: 0, count: 602)
        bext.replaceSubrange(256..<(256 + 13), with: Data("Sound Devices".utf8))
        bext.replaceSubrange(288..<(288 + 8), with: Data("833-TEST".utf8))
        var timeReference = Data()
        timeReference.appendLittleEndian(UInt32(172_800_000))
        bext.replaceSubrange(338..<342, with: timeReference)
        let ixml = Data("""
            <BWFXML><SCENE>12A</SCENE><TAKE>3</TAKE><TIMECODE_RATE>25/1</TIMECODE_RATE>
            <TIMECODE_FLAG>NDF</TIMECODE_FLAG><TRACK_LIST><TRACK><NAME>Boom</NAME></TRACK>
            <TRACK><NAME>Lavalier</NAME></TRACK></TRACK_LIST></BWFXML>
            """.utf8)
        let samples = Data(repeating: 0, count: 2_880)
        let chunks = [waveChunk("fmt ", format), waveChunk("bext", bext),
                      waveChunk("iXML", ixml), waveChunk("data", samples)]
        let body = Data("WAVE".utf8) + chunks.reduce(Data(), +)
        var file = Data("RIFF".utf8)
        file.appendLittleEndian(UInt32(body.count))
        file.append(body)
        return file
    }

    private func waveChunk(_ id: String, _ body: Data) -> Data {
        XCTAssertEqual(id.utf8.count, 4)
        var chunk = Data(id.utf8)
        chunk.appendLittleEndian(UInt32(body.count))
        chunk.append(body)
        if body.count.isMultiple(of: 2) == false { chunk.append(0) }
        return chunk
    }
}

private extension Data {
    mutating func appendLittleEndian<T: FixedWidthInteger>(_ value: T) {
        var little = value.littleEndian
        Swift.withUnsafeBytes(of: &little) { append(contentsOf: $0) }
    }
}
