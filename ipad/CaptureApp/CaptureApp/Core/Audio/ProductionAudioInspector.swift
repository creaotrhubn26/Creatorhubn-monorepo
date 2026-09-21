@preconcurrency import AVFoundation
import Foundation

enum ProductionAudioInspector {
    static func inspect(fileURL: URL) async -> ProductionAudioInspection {
        var result = (try? inspectWave(fileURL: fileURL)) ?? .empty
        let asset = AVURLAsset(url: fileURL)
        if result.durationMs == nil,
           let duration = try? await asset.load(.duration),
           duration.isNumeric {
            result.durationMs = max(0, Int64((duration.seconds * 1000).rounded()))
        }
        if result.sampleRate == nil || result.channelCount == nil {
            if let tracks = try? await asset.loadTracks(withMediaType: .audio),
               let track = tracks.first,
               let descriptions = try? await track.load(.formatDescriptions),
               let description = descriptions.first,
               let basic = CMAudioFormatDescriptionGetStreamBasicDescription(description) {
                if result.sampleRate == nil { result.sampleRate = Int(basic.pointee.mSampleRate.rounded()) }
                if result.channelCount == nil { result.channelCount = Int(basic.pointee.mChannelsPerFrame) }
                if result.bitDepth == nil, basic.pointee.mBitsPerChannel > 0 {
                    result.bitDepth = Int(basic.pointee.mBitsPerChannel)
                }
            }
        }
        return result
    }

    private static func inspectWave(fileURL: URL) throws -> ProductionAudioInspection {
        let handle = try FileHandle(forReadingFrom: fileURL)
        defer { try? handle.close() }
        guard let header = try handle.read(upToCount: 12), header.count == 12 else { return .empty }
        let signature = ascii(header, 0..<4)
        guard ["RIFF", "RF64", "BW64", "RIFX"].contains(signature),
              ascii(header, 8..<12) == "WAVE"
        else { return .empty }
        let littleEndian = signature != "RIFX"
        var result = ProductionAudioInspection.empty
        var byteRate: UInt64?
        var dataSize: UInt64?
        var rf64DataSize: UInt64?
        var scannedBytes: UInt64 = 12
        let scanLimit: UInt64 = 32 * 1024 * 1024

        while scannedBytes + 8 <= scanLimit {
            guard let chunkHeader = try handle.read(upToCount: 8), chunkHeader.count == 8 else { break }
            scannedBytes += 8
            let chunkId = ascii(chunkHeader, 0..<4)
            let rawSize = uint32(chunkHeader, offset: 4, littleEndian: littleEndian)
            let chunkSize = UInt64(rawSize)
            let paddedSize = chunkSize + (chunkSize % 2)
            let readLimit: UInt64
            switch chunkId {
            case "fmt ": readLimit = min(chunkSize, 128)
            case "bext": readLimit = min(chunkSize, 2048)
            case "iXML": readLimit = min(chunkSize, 2 * 1024 * 1024)
            case "ds64": readLimit = min(chunkSize, 64)
            default: readLimit = 0
            }
            let body = readLimit > 0 ? (try handle.read(upToCount: Int(readLimit)) ?? Data()) : Data()
            scannedBytes += readLimit
            if chunkId == "fmt ", body.count >= 16 {
                result.channelCount = Int(uint16(body, offset: 2, littleEndian: littleEndian))
                result.sampleRate = Int(uint32(body, offset: 4, littleEndian: littleEndian))
                byteRate = UInt64(uint32(body, offset: 8, littleEndian: littleEndian))
                result.bitDepth = Int(uint16(body, offset: 14, littleEndian: littleEndian))
            } else if chunkId == "bext", body.count >= 346 {
                result.notes = trimmedASCII(body, range: 0..<256)
                result.recorderManufacturer = trimmedASCII(body, range: 256..<288)
                if let originatorReference = trimmedASCII(body, range: 288..<320) {
                    result.metadata["bextOriginatorReference"] = originatorReference
                }
                let low = UInt64(uint32(body, offset: 338, littleEndian: true))
                let high = UInt64(uint32(body, offset: 342, littleEndian: true))
                result.timeReferenceSamples = Int64(bitPattern: low | (high << 32))
            } else if chunkId == "iXML", !body.isEmpty {
                parseIXML(body, into: &result)
            } else if chunkId == "ds64", body.count >= 16 {
                rf64DataSize = uint64(body, offset: 8, littleEndian: true)
            } else if chunkId == "data" {
                dataSize = rawSize == UInt32.max ? rf64DataSize : chunkSize
            }

            let remaining = paddedSize > readLimit ? paddedSize - readLimit : 0
            if remaining > 0 {
                try handle.seek(toOffset: handle.offsetInFile + remaining)
                scannedBytes += remaining
            }
            if chunkId == "data" { break }
        }

        if let bytes = dataSize, let byteRate, byteRate > 0 {
            result.durationMs = Int64((Double(bytes) / Double(byteRate) * 1000).rounded())
        }
        if result.timecodeStart == nil,
           let samples = result.timeReferenceSamples,
           let sampleRate = result.sampleRate,
           let frameRate = result.frameRate,
           sampleRate > 0, frameRate > 0 {
            result.timecodeStart = formatTimecode(
                seconds: Double(samples) / Double(sampleRate),
                frameRate: frameRate,
                dropFrame: result.dropFrame == true
            )
        }
        return result
    }

    private static func parseIXML(_ data: Data, into result: inout ProductionAudioInspection) {
        guard let xml = String(data: data, encoding: .utf8)
                ?? String(data: data, encoding: .isoLatin1)
        else { return }
        func value(_ names: [String]) -> String? {
            for name in names {
                let escaped = NSRegularExpression.escapedPattern(for: name)
                let pattern = "<\\s*\(escaped)\\s*>([\\s\\S]*?)<\\s*/\\s*\(escaped)\\s*>"
                guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
                      let match = regex.firstMatch(in: xml, range: NSRange(xml.startIndex..., in: xml)),
                      let range = Range(match.range(at: 1), in: xml)
                else { continue }
                let text = String(xml[range])
                    .replacingOccurrences(of: "<![CDATA[", with: "")
                    .replacingOccurrences(of: "]]>", with: "")
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                if !text.isEmpty { return text }
            }
            return nil
        }

        result.scene = value(["SCENE"])
        result.take = value(["TAKE"])
        result.tape = value(["TAPE", "ROLL"])
        result.notes = value(["NOTE", "NOTES"]) ?? result.notes
        result.recorderManufacturer = value(["MANUFACTURER"]) ?? result.recorderManufacturer
        result.recorderModel = value(["MODEL"])
        result.recorderSerial = value(["SERIAL", "SERIAL_NUMBER"]) ?? result.recorderSerial
        result.timecodeStart = value(["TIMECODE", "START_TIMECODE"])
        if let circled = value(["CIRCLED"])?.lowercased() {
            result.circled = ["true", "1", "yes", "y"].contains(circled)
        }
        if let rawRate = value(["TIMECODE_RATE", "FRAME_RATE"]) {
            result.frameRate = parseRate(rawRate)
        }
        if let flag = value(["TIMECODE_FLAG"])?.uppercased() {
            result.dropFrame = flag.contains("DF") && !flag.contains("NDF")
        }
        if result.timeReferenceSamples == nil {
            if let samples = value(["TIMESTAMP_SAMPLES_SINCE_MIDNIGHT"]), let parsed = Int64(samples) {
                result.timeReferenceSamples = parsed
            } else if let hi = value(["TIMESTAMP_SAMPLES_SINCE_MIDNIGHT_HI"]),
                      let lo = value(["TIMESTAMP_SAMPLES_SINCE_MIDNIGHT_LO"]),
                      let high = UInt64(hi), let low = UInt64(lo) {
                result.timeReferenceSamples = Int64(bitPattern: (high << 32) | low)
            }
        }

        if let regex = try? NSRegularExpression(
            pattern: "<\\s*NAME\\s*>([^<]+)<\\s*/\\s*NAME\\s*>",
            options: [.caseInsensitive]
        ) {
            result.channelNames = regex.matches(in: xml, range: NSRange(xml.startIndex..., in: xml))
                .compactMap { match in
                    guard let range = Range(match.range(at: 1), in: xml) else { return nil }
                    let value = String(xml[range]).trimmingCharacters(in: .whitespacesAndNewlines)
                    return value.isEmpty ? nil : value
                }
        }
        let known: [(String, String?)] = [
            ("scene", result.scene), ("take", result.take), ("tape", result.tape),
            ("timecode", result.timecodeStart), ("recorderModel", result.recorderModel),
        ]
        for (key, value) in known { if let value { result.metadata[key] = value } }
    }

    private static func parseRate(_ raw: String) -> Double? {
        let parts = raw.split(separator: "/", maxSplits: 1).compactMap { Double($0) }
        if parts.count == 2, parts[1] != 0 { return parts[0] / parts[1] }
        return Double(raw)
    }

    private static func formatTimecode(seconds: Double, frameRate: Double, dropFrame: Bool) -> String {
        let nominal = max(1, Int(frameRate.rounded()))
        var timecodeFrames = max(0, Int((seconds * frameRate).rounded()))
        if dropFrame, nominal == 30 || nominal == 60 {
            let droppedPerMinute = nominal == 60 ? 4 : 2
            let framesPerTenMinutes = nominal * 60 * 10 - droppedPerMinute * 9
            let framesPerMinute = nominal * 60 - droppedPerMinute
            let tenMinuteBlocks = timecodeFrames / framesPerTenMinutes
            let remaining = timecodeFrames % framesPerTenMinutes
            let extraMinutes = max(0, (remaining - droppedPerMinute) / framesPerMinute)
            timecodeFrames += droppedPerMinute * (tenMinuteBlocks * 9 + extraMinutes)
        }
        let framesPerDay = nominal * 60 * 60 * 24
        timecodeFrames %= framesPerDay
        let frames = timecodeFrames % nominal
        let wholeSeconds = timecodeFrames / nominal
        let hours = wholeSeconds / 3600
        let minutes = (wholeSeconds % 3600) / 60
        let secs = wholeSeconds % 60
        let separator = dropFrame ? ";" : ":"
        return String(format: "%02d:%02d:%02d%@%02d", hours, minutes, secs, separator, frames)
    }

    private static func ascii(_ data: Data, _ range: Range<Int>) -> String {
        String(data: data.subdata(in: range), encoding: .ascii) ?? ""
    }

    private static func trimmedASCII(_ data: Data, range: Range<Int>) -> String? {
        guard data.count >= range.upperBound else { return nil }
        let value = (String(data: data.subdata(in: range), encoding: .utf8)
            ?? String(data: data.subdata(in: range), encoding: .isoLatin1) ?? "")
            .trimmingCharacters(in: CharacterSet(charactersIn: "\0 ").union(.whitespacesAndNewlines))
        return value.isEmpty ? nil : value
    }

    private static func uint16(_ data: Data, offset: Int, littleEndian: Bool) -> UInt16 {
        guard data.count >= offset + 2 else { return 0 }
        let a = UInt16(data[offset]), b = UInt16(data[offset + 1])
        return littleEndian ? a | (b << 8) : (a << 8) | b
    }

    private static func uint32(_ data: Data, offset: Int, littleEndian: Bool) -> UInt32 {
        guard data.count >= offset + 4 else { return 0 }
        let bytes = (0..<4).map { UInt32(data[offset + $0]) }
        return littleEndian
            ? bytes.enumerated().reduce(0) { $0 | ($1.element << UInt32($1.offset * 8)) }
            : bytes.reduce(0) { ($0 << 8) | $1 }
    }

    private static func uint64(_ data: Data, offset: Int, littleEndian: Bool) -> UInt64 {
        guard data.count >= offset + 8 else { return 0 }
        let bytes = (0..<8).map { UInt64(data[offset + $0]) }
        return littleEndian
            ? bytes.enumerated().reduce(0) { $0 | ($1.element << UInt64($1.offset * 8)) }
            : bytes.reduce(0) { ($0 << 8) | $1 }
    }
}
