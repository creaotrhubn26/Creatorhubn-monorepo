import Foundation
import AVFoundation
import CoreGraphics
import ImageIO
import Metal
import Observation
import UniformTypeIdentifiers

struct ExportRecord: Identifiable, Sendable {
    var id: String { url.path }
    var url: URL
    var name: String
    var sizeBytes: Int
    var date: Date
}

enum ExportError: Error { case cameraMissing, writerFailed, cancelled, imageEncodeFailed }

/// Rendrer scener til ekte filer: PNG-still og H.264-video (frame-for-frame
/// offscreen render → AVAssetWriter). Filene havner i Documents/exports/.
@Observable @MainActor
final class ExportEngine {
    var isExporting = false
    var progress: Double = 0
    @ObservationIgnored private var cancelled = false

    static var exportsDirectory: URL {
        let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("exports", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func listExports() -> [ExportRecord] {
        let fm = FileManager.default
        let urls = (try? fm.contentsOfDirectory(at: exportsDirectory,
                                                includingPropertiesForKeys: [.fileSizeKey, .creationDateKey])) ?? []
        return urls.compactMap { url in
            let values = try? url.resourceValues(forKeys: [.fileSizeKey, .creationDateKey])
            return ExportRecord(url: url, name: url.lastPathComponent,
                                sizeBytes: values?.fileSize ?? 0,
                                date: values?.creationDate ?? .distantPast)
        }
        .sorted { $0.date > $1.date }
    }

    func cancel() { cancelled = true }

    // MARK: - Still

    func exportStill(scene: SceneData, cameraNodeId: String, width: Int, height: Int,
                     renderer: StageRenderer) throws -> URL {
        guard let node = scene.node(cameraNodeId), node.kind == .camera else {
            throw ExportError.cameraMissing
        }
        let texture = try renderer.renderOffscreen(scene: scene, camera: .from(node: node),
                                                   width: width, height: height)
        let url = Self.exportsDirectory
            .appendingPathComponent("StageOne-\(node.name.replacingOccurrences(of: " ", with: ""))-\(Self.timestamp()).png")
        guard let image = Self.cgImage(from: texture),
              let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
            throw ExportError.imageEncodeFailed
        }
        CGImageDestinationAddImage(dest, image, nil)
        guard CGImageDestinationFinalize(dest) else { throw ExportError.imageEncodeFailed }
        return url
    }

    // MARK: - Video

    /// Rendrer shot-sekvensen (eller ett shot) som H.264 .mp4.
    func exportVideo(scene: SceneData, shots: [Shot], width: Int, height: Int, fps: Int,
                     renderer: StageRenderer, label: String) async throws -> URL {
        precondition(!shots.isEmpty)
        isExporting = true
        progress = 0
        cancelled = false
        defer { isExporting = false }

        let url = Self.exportsDirectory
            .appendingPathComponent("StageOne-\(label)-\(Self.timestamp()).mp4")
        try? FileManager.default.removeItem(at: url)

        let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
        ])
        input.expectsMediaDataInRealTime = false
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                kCVPixelBufferWidthKey as String: width,
                kCVPixelBufferHeightKey as String: height,
            ])
        guard writer.canAdd(input) else { throw ExportError.writerFailed }
        writer.add(input)
        guard writer.startWriting() else { throw ExportError.writerFailed }
        writer.startSession(atSourceTime: .zero)

        let totalDuration = shots.reduce(0) { $0 + $1.durationSec }
        let frameCount = max(1, Int((totalDuration * Double(fps)).rounded()))

        for frame in 0..<frameCount {
            if cancelled {
                writer.cancelWriting()
                try? FileManager.default.removeItem(at: url)
                throw ExportError.cancelled
            }
            let elapsed = Double(frame) / Double(fps)
            guard let shotIndex = ShotPlayer.shotIndex(at: elapsed, in: shots),
                  let camNode = scene.node(shots[shotIndex].cameraNodeId), camNode.kind == .camera else {
                writer.cancelWriting()
                throw ExportError.cameraMissing
            }
            let texture = try renderer.renderOffscreen(scene: scene, camera: .from(node: camNode),
                                                       width: width, height: height)
            while !input.isReadyForMoreMediaData { await Task.yield() }
            guard let pool = adaptor.pixelBufferPool,
                  let buffer = Self.pixelBuffer(from: texture, pool: pool) else {
                writer.cancelWriting()
                throw ExportError.writerFailed
            }
            adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(frame),
                                                                timescale: CMTimeScale(fps)))
            progress = Double(frame + 1) / Double(frameCount)
            await Task.yield()
        }

        input.markAsFinished()
        await writer.finishWriting()
        guard writer.status == .completed else { throw ExportError.writerFailed }
        return url
    }

    // MARK: - Hjelpere

    private static func timestamp() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        return formatter.string(from: Date())
    }

    static func cgImage(from texture: MTLTexture) -> CGImage? {
        let w = texture.width, h = texture.height
        var pixels = [UInt8](repeating: 0, count: w * h * 4)
        pixels.withUnsafeMutableBytes { raw in
            texture.getBytes(raw.baseAddress!, bytesPerRow: w * 4,
                             from: MTLRegionMake2D(0, 0, w, h), mipmapLevel: 0)
        }
        return pixels.withUnsafeMutableBytes { raw in
            CGContext(data: raw.baseAddress, width: w, height: h, bitsPerComponent: 8,
                      bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(),
                      bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
                          | CGBitmapInfo.byteOrder32Little.rawValue)?.makeImage()
        }
    }

    private static func pixelBuffer(from texture: MTLTexture, pool: CVPixelBufferPool) -> CVPixelBuffer? {
        var buffer: CVPixelBuffer?
        guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &buffer) == kCVReturnSuccess,
              let buffer else { return nil }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard let base = CVPixelBufferGetBaseAddress(buffer) else { return nil }
        texture.getBytes(base, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
                         from: MTLRegionMake2D(0, 0, texture.width, texture.height), mipmapLevel: 0)
        return buffer
    }
}
