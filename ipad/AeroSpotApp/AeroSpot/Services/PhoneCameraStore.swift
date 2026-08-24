// PhoneCameraStore.swift — bruker iPhone-kameraet som søker og kjører
// samme Vision-coaching (FrameAnalyzer) på strømmen. Gjør live-coaching
// tilgjengelig UTEN tilkoblet Canon.

import Foundation
import AVFoundation
import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
final class PhoneCameraStore: NSObject {
    let session = AVCaptureSession()
    private(set) var authorized = false
    private(set) var running = false
    private(set) var tip: LiveTip?

    /// Gir ferske aviation-data per analyse.
    var contextProvider: (() -> TipContext)?

    private let analyzer = FrameAnalyzer()
    private let output = AVCaptureVideoDataOutput()
    private let queue = DispatchQueue(label: "aerospot.phonecam")
    private var frameCounter = 0
    private var analyzing = false

    func start() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            authorized = true
            configureAndRun()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                Task { @MainActor in
                    self?.authorized = granted
                    if granted { self?.configureAndRun() }
                }
            }
        default:
            authorized = false
        }
    }

    func stop() {
        guard running else { return }
        queue.async { [session] in session.stopRunning() }
        running = false
    }

    private func configureAndRun() {
        queue.async { [weak self] in
            guard let self else { return }
            if self.session.inputs.isEmpty {
                self.session.beginConfiguration()
                self.session.sessionPreset = .high
                if let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
                   let input = try? AVCaptureDeviceInput(device: device),
                   self.session.canAddInput(input) {
                    self.session.addInput(input)
                }
                self.output.videoSettings = [
                    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                ]
                self.output.setSampleBufferDelegate(self, queue: self.queue)
                if self.session.canAddOutput(self.output) {
                    self.session.addOutput(self.output)
                }
                self.session.commitConfiguration()
            }
            if !self.session.isRunning { self.session.startRunning() }
            Task { @MainActor in self.running = true }
        }
    }

    private func analyze(_ jpeg: Data) {
        Task { @MainActor in
            guard !analyzing else { return }
            analyzing = true
            defer { analyzing = false }
            if let signals = await analyzer.analyze(jpeg: jpeg) {
                let ctx = contextProvider?() ?? TipContext()
                let best = await TipEngine.bestTip(signals: signals, context: ctx)
                if let best { withAnimation { tip = best } }
            }
        }
    }
}

extension PhoneCameraStore: AVCaptureVideoDataOutputSampleBufferDelegate {
    nonisolated func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        // Analyser ~hvert 20. frame (~1.5/s) — nok for coaching, sparer batteri.
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let ci = CIImage(cvPixelBuffer: pixelBuffer)
        let context = CIContext()
        guard let cg = context.createCGImage(ci, from: ci.extent) else { return }
        let ui = UIImage(cgImage: cg)
        guard let jpeg = ui.jpegData(compressionQuality: 0.5) else { return }
        Task { @MainActor in
            self.frameCounter += 1
            if self.frameCounter % 20 == 0 { self.analyze(jpeg) }
        }
    }
}

/// SwiftUI-wrapper for AVCaptureVideoPreviewLayer.
struct PhoneCameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> PreviewView {
        let v = PreviewView()
        v.videoPreviewLayer.session = session
        v.videoPreviewLayer.videoGravity = .resizeAspectFill
        return v
    }
    func updateUIView(_ uiView: PreviewView, context: Context) {}

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var videoPreviewLayer: AVCaptureVideoPreviewLayer {
            layer as! AVCaptureVideoPreviewLayer
        }
    }
}
