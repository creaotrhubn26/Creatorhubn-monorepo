// LiveViewStore.swift — driver Canon live view: henter frames via CCAPI,
// viser dem, analyserer hver N-te frame med Vision, og oppdaterer et
// live coaching-tips. Alt on-device.

import Foundation
import Observation
import SwiftUI

@MainActor
@Observable
final class LiveViewStore {
    private(set) var frame: UIImage?
    private(set) var tip: LiveTip?
    private(set) var isStreaming = false
    private(set) var error: String?

    private let analyzer = FrameAnalyzer()
    private var streamTask: Task<Void, Never>?
    private var frameCounter = 0

    /// context-provider gir ferske aviation-data per analyse (fly, lys, lukker).
    var contextProvider: (() -> TipContext)?

    func start(client: CCAPIClient) {
        stop()
        isStreaming = true
        error = nil
        streamTask = Task { [weak self] in
            guard let self else { return }
            do {
                try await client.startLiveView(size: "medium")
            } catch {
                await MainActor.run { self.error = "Kunne ikke starte live view"; self.isStreaming = false }
                return
            }
            while !Task.isCancelled {
                do {
                    let jpeg = try await client.liveViewFrame()
                    await self.handleFrame(jpeg)
                } catch {
                    // enkelt frame-tap er greit; kort pause og prøv igjen
                    try? await Task.sleep(for: .milliseconds(200))
                }
            }
        }
    }

    func stop() {
        streamTask?.cancel()
        streamTask = nil
        isStreaming = false
    }

    func stop(client: CCAPIClient) {
        stop()
        Task { try? await client.stopLiveView() }
    }

    private func handleFrame(_ jpeg: Data) async {
        if let image = UIImage(data: jpeg) {
            frame = image
        }
        frameCounter += 1
        // Analyser hvert 6. frame (~2/s ved 12 fps) for å spare batteri.
        guard frameCounter % 6 == 0 else { return }
        let context = contextProvider?() ?? TipContext()
        if let signals = await analyzer.analyze(jpeg: jpeg) {
            let best = await TipEngine.bestTip(signals: signals, context: context)
            // Bytt bare tips hvis nytt er viktigere eller det gamle er borte.
            if let best, best.priority >= (tip?.priority ?? 0) || tip == nil {
                withAnimation { tip = best }
            }
        }
    }
}
