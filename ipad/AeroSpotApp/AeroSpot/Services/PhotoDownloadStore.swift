// PhotoDownloadStore.swift — opt-in auto-nedlasting av bilder fra Canon
// til telefonens fotobibliotek. Store filer viser nedlastings-progress.
//
// Aktiveres i «Mitt utstyr» / Kamera. Når på: hvert capture-event laster
// ned siste bilde fra kameraet og lagrer det i Photos.

import Foundation
import Observation
import Photos
import UIKit

struct DownloadItem: Identifiable, Sendable {
    let id = UUID()
    var fileName: String
    var progress: Double  // 0–1
    var state: State
    enum State: Sendable { case downloading, saving, done, failed }
}

@MainActor
@Observable
final class PhotoDownloadStore {
    /// Opt-in — av som standard.
    var autoDownload: Bool {
        didSet { UserDefaults.standard.set(autoDownload, forKey: "aerospot.autoDownload") }
    }
    private(set) var active: [DownloadItem] = []

    init() {
        autoDownload = UserDefaults.standard.bool(forKey: "aerospot.autoDownload")
    }

    /// Last ned et bilde fra en absolutt CCAPI-content-URL og lagre i Photos.
    /// session må være kameraets insecure-trust-session (via CameraSyncStore).
    func download(from url: URL, fileName: String, session: URLSession) async {
        guard autoDownload else { return }
        var item = DownloadItem(fileName: fileName, progress: 0, state: .downloading)
        active.append(item)
        let index = active.count - 1

        do {
            // Last ned med progress (store RAW-filer kan være 30–60 MB).
            let (data, response) = try await downloadWithProgress(url: url, session: session) { p in
                Task { @MainActor in
                    if self.active.indices.contains(index) { self.active[index].progress = p }
                }
            }
            _ = response
            item.progress = 1
            item.state = .saving
            if active.indices.contains(index) { active[index] = item }

            try await saveToPhotos(data: data, fileName: fileName)
            item.state = .done
            if active.indices.contains(index) { active[index] = item }
            // Rydd fullførte etter litt
            try? await Task.sleep(for: .seconds(3))
            active.removeAll { $0.id == item.id }
        } catch {
            if active.indices.contains(index) { active[index].state = .failed }
        }
    }

    private func downloadWithProgress(
        url: URL, session: URLSession, onProgress: @escaping (Double) -> Void
    ) async throws -> (Data, URLResponse) {
        let (bytes, response) = try await session.bytes(from: url)
        let total = response.expectedContentLength
        var data = Data()
        if total > 0 { data.reserveCapacity(Int(total)) }
        var lastReported = 0.0
        for try await byte in bytes {
            data.append(byte)
            if total > 0 {
                let p = Double(data.count) / Double(total)
                if p - lastReported >= 0.02 { lastReported = p; onProgress(p) }
            }
        }
        onProgress(1)
        return (data, response)
    }

    private func saveToPhotos(data: Data, fileName: String) async throws {
        let status = await requestPhotoAuth()
        guard status == .authorized || status == .limited else {
            throw NSError(domain: "aerospot.photos", code: 1)
        }
        try await PHPhotoLibrary.shared().performChanges {
            let request = PHAssetCreationRequest.forAsset()
            request.addResource(with: .photo, data: data, options: nil)
        }
    }

    private func requestPhotoAuth() async -> PHAuthorizationStatus {
        await withCheckedContinuation { cont in
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { cont.resume(returning: $0) }
        }
    }
}
