@preconcurrency import AVFoundation
import CoreMedia
import Foundation
import ImageIO

enum CardMediaInspectionState: String, Codable, Sendable {
    case ready
    case limited
    case unreadable

    var title: String {
        switch self {
        case .ready: "Metadata klar"
        case .limited: "Begrenset metadata"
        case .unreadable: "Kan ikke leses"
        }
    }
}

enum CardProxyState: String, Codable, Sendable {
    case notApplicable
    case originalMissingProxy
    case originalWithProxy
    case proxy

    var title: String? {
        switch self {
        case .notApplicable: nil
        case .originalMissingProxy: "Proxy mangler"
        case .originalWithProxy: "Proxy funnet"
        case .proxy: "Proxy"
        }
    }
}

/// Lightweight information gathered while scanning a removable card. The
/// scanner reads container headers and small image metadata dictionaries, not
/// complete media bodies. SHA-256 verification still happens only while the
/// selected original is copied into CreatorHub-managed storage.
struct CardMediaInspection: Codable, Sendable, Hashable {
    var state: CardMediaInspectionState
    var cameraName: String?
    var codec: String?
    var width: Int?
    var height: Int?
    var durationSeconds: Double?
    var frameRate: Double?
    var audioChannels: Int?
    var sampleRate: Double?
    var proxyState: CardProxyState
    var sidecarCount: Int
    var duplicateCandidate: Bool?
    var issue: String?

    static let limited = CardMediaInspection(
        state: .limited,
        cameraName: nil,
        codec: nil,
        width: nil,
        height: nil,
        durationSeconds: nil,
        frameRate: nil,
        audioChannels: nil,
        sampleRate: nil,
        proxyState: .notApplicable,
        sidecarCount: 0,
        duplicateCandidate: nil,
        issue: nil
    )

    var isProxy: Bool { proxyState == .proxy }

    var technicalSummary: String {
        var parts: [String] = []
        if let codec, !codec.isEmpty { parts.append(codec) }
        if let width, let height, width > 0, height > 0 { parts.append("\(width)×\(height)") }
        if let frameRate, frameRate > 0 { parts.append(String(format: "%.2f fps", frameRate)) }
        if let sampleRate, sampleRate > 0 { parts.append("\(Int(sampleRate.rounded())) Hz") }
        if let audioChannels, audioChannels > 0 { parts.append("\(audioChannels) kanaler") }
        if let cameraName, !cameraName.isEmpty { parts.append(cameraName) }
        return parts.joined(separator: " · ")
    }
}

enum CardMediaInspector {
    static let sidecarExtensions: Set<String> = [
        "xmp", "thm", "xml", "cpi", "mpl", "ppn", "cpf", "sif", "bdm", "idx"
    ]
    static let proxyOnlyExtensions: Set<String> = ["lrv"]

    nonisolated static func isProxyURL(_ url: URL) -> Bool {
        let lowerComponents = url.pathComponents.map { $0.lowercased() }
        let stem = url.deletingPathExtension().lastPathComponent.lowercased()
        return lowerComponents.contains(where: { ["proxy", "proxies", "proxy_media"].contains($0) })
            || stem.hasSuffix("_proxy")
            || stem.hasSuffix("-proxy")
            || stem.hasSuffix("_lrv")
            || proxyOnlyExtensions.contains(url.pathExtension.lowercased())
    }

    nonisolated static func pairingKey(_ url: URL) -> String {
        var stem = url.deletingPathExtension().lastPathComponent.lowercased()
        for suffix in ["_proxy", "-proxy", "_lrv"] where stem.hasSuffix(suffix) {
            stem.removeLast(suffix.count)
        }
        return stem
    }

    nonisolated static func inspectImage(url: URL, isRaw: Bool, sizeBytes: Int64) -> CardMediaInspection {
        guard sizeBytes > 0 else {
            return unreadable("Filen er tom.")
        }
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
            return isRaw ? limitedIssue("RAW-headeren støttes ikke av denne iPaden.") : unreadable("Bildefilen kunne ikke åpnes.")
        }
        guard let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] else {
            return isRaw ? limitedIssue("RAW-metadata er ikke tilgjengelig.") : unreadable("Bildefilen mangler lesbar bildemetadata.")
        }
        let width = integer(properties[kCGImagePropertyPixelWidth])
        let height = integer(properties[kCGImagePropertyPixelHeight])
        let tiff = properties[kCGImagePropertyTIFFDictionary] as? [CFString: Any]
        let camera = (tiff?[kCGImagePropertyTIFFModel] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        let type = CGImageSourceGetType(source) as String?
        return CardMediaInspection(
            state: width != nil && height != nil ? .ready : .limited,
            cameraName: camera,
            codec: type.flatMap(shortCodecName),
            width: width,
            height: height,
            durationSeconds: nil,
            frameRate: nil,
            audioChannels: nil,
            sampleRate: nil,
            proxyState: .notApplicable,
            sidecarCount: 0,
            duplicateCandidate: nil,
            issue: width == nil || height == nil ? "Bildedimensjoner mangler." : nil
        )
    }

    nonisolated static func inspectVideo(url: URL, sizeBytes: Int64) -> CardMediaInspection {
        guard sizeBytes > 0 else { return unreadable("Filen er tom.") }
        let asset = AVURLAsset(url: url)
        guard let track = asset.tracks(withMediaType: .video).first else {
            return limitedIssue("Videohodet kunne ikke tolkes på denne iPaden.", proxy: isProxyURL(url))
        }
        let transformed = track.naturalSize.applying(track.preferredTransform)
        let width = Int(abs(transformed.width).rounded())
        let height = Int(abs(transformed.height).rounded())
        let duration = CMTimeGetSeconds(asset.duration)
        let codec = track.formatDescriptions.first.map { rawDescription in
            let description = rawDescription as! CMFormatDescription
            return fourCC(CMFormatDescriptionGetMediaSubType(description))
        }
        return CardMediaInspection(
            state: .ready,
            cameraName: cameraModel(from: asset.metadata),
            codec: codec,
            width: width > 0 ? width : nil,
            height: height > 0 ? height : nil,
            durationSeconds: duration.isFinite && duration >= 0 ? duration : nil,
            frameRate: track.nominalFrameRate > 0 ? Double(track.nominalFrameRate) : nil,
            audioChannels: nil,
            sampleRate: nil,
            proxyState: isProxyURL(url) ? .proxy : .originalMissingProxy,
            sidecarCount: 0,
            duplicateCandidate: nil,
            issue: nil
        )
    }

    nonisolated static func inspectAudio(url: URL, sizeBytes: Int64) -> CardMediaInspection {
        guard sizeBytes > 0 else { return unreadable("Filen er tom.") }
        let asset = AVURLAsset(url: url)
        guard let track = asset.tracks(withMediaType: .audio).first else {
            return limitedIssue("Lydhodet kunne ikke tolkes på denne iPaden.")
        }
        let description = track.formatDescriptions.first.map { $0 as! CMFormatDescription }
        let basic = description.flatMap { CMAudioFormatDescriptionGetStreamBasicDescription($0)?.pointee }
        let duration = CMTimeGetSeconds(asset.duration)
        return CardMediaInspection(
            state: .ready,
            cameraName: nil,
            codec: description.map { fourCC(CMFormatDescriptionGetMediaSubType($0)) },
            width: nil,
            height: nil,
            durationSeconds: duration.isFinite && duration >= 0 ? duration : nil,
            frameRate: nil,
            audioChannels: basic.map { Int($0.mChannelsPerFrame) },
            sampleRate: basic?.mSampleRate,
            proxyState: .notApplicable,
            sidecarCount: 0,
            duplicateCandidate: nil,
            issue: nil
        )
    }

    private nonisolated static func unreadable(_ issue: String) -> CardMediaInspection {
        var result = CardMediaInspection.limited
        result.state = .unreadable
        result.issue = issue
        return result
    }

    private nonisolated static func limitedIssue(_ issue: String, proxy: Bool = false) -> CardMediaInspection {
        var result = CardMediaInspection.limited
        result.proxyState = proxy ? .proxy : .notApplicable
        result.issue = issue
        return result
    }

    private nonisolated static func integer(_ value: Any?) -> Int? {
        if let value = value as? NSNumber { return value.intValue }
        if let value = value as? Int { return value }
        return nil
    }

    private nonisolated static func shortCodecName(_ identifier: String) -> String {
        identifier.split(separator: ".").last.map(String.init)?.uppercased() ?? identifier
    }

    private nonisolated static func cameraModel(from metadata: [AVMetadataItem]) -> String? {
        metadata.first { item in
            let key = item.key.map { String(describing: $0) }?.lowercased() ?? ""
            let identifier = item.identifier?.rawValue.lowercased() ?? ""
            return key.contains("model") || identifier.contains("model")
        }?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private nonisolated static func fourCC(_ value: FourCharCode) -> String {
        let bytes: [UInt8] = [
            UInt8((value >> 24) & 0xff), UInt8((value >> 16) & 0xff),
            UInt8((value >> 8) & 0xff), UInt8(value & 0xff)
        ]
        let printable = bytes.map { (32...126).contains($0) ? $0 : 32 }
        let result = String(bytes: printable, encoding: .ascii)?.trimmingCharacters(in: .whitespaces) ?? ""
        return result.isEmpty ? String(format: "0x%08X", value) : result.uppercased()
    }
}
