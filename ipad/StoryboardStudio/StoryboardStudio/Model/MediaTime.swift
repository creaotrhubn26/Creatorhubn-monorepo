import CoreFoundation
import Foundation

enum MediaTimeError: Error, Sendable, Equatable {
    case invalidTimescale(Int32)
    case negativeValue(Int64)
    case negativeSeconds
    case nonFiniteSeconds
    case valueOutOfRange
    case arithmeticOverflow
    case inexactConversion(targetTimescale: Int32)
}

enum MediaTimeRoundingRule: Sendable, Equatable {
    case towardZero
    case awayFromZero
    case nearestAwayFromZero
}

/// Platform-neutral rational media time. Values are reduced at every input
/// boundary so equivalent times serialize identically and hash consistently.
struct MediaTime: Codable, Sendable, Hashable, Comparable {
    let value: Int64
    let timescale: Int32

    static let zero = MediaTime(canonicalValue: 0, timescale: 1)

    init(value: Int64, timescale: Int32) throws {
        guard timescale > 0 else {
            throw MediaTimeError.invalidTimescale(timescale)
        }
        guard value >= 0 else {
            throw MediaTimeError.negativeValue(value)
        }

        if value == 0 {
            self = .zero
            return
        }

        let divisor = Self.greatestCommonDivisor(
            UInt64(value), UInt64(timescale)
        )
        self.init(
            canonicalValue: value / Int64(divisor),
            timescale: timescale / Int32(divisor)
        )
    }

    /// Compatibility boundary for legacy Double durations. The stored result
    /// remains a reduced rational value; Double is never authoritative.
    init(
        seconds: Double,
        preferredTimescale: Int32 = 600
    ) throws {
        guard preferredTimescale > 0 else {
            throw MediaTimeError.invalidTimescale(preferredTimescale)
        }
        guard seconds.isFinite else {
            throw MediaTimeError.nonFiniteSeconds
        }
        guard seconds >= 0 else {
            throw MediaTimeError.negativeSeconds
        }

        let scaled = seconds * Double(preferredTimescale)
        guard scaled.isFinite else { throw MediaTimeError.valueOutOfRange }
        let rounded = scaled.rounded(.toNearestOrAwayFromZero)
        guard let integer = Int64(exactly: rounded) else {
            throw MediaTimeError.valueOutOfRange
        }
        try self.init(value: integer, timescale: preferredTimescale)
    }

    var seconds: Double {
        Double(value) / Double(timescale)
    }

    static func < (lhs: MediaTime, rhs: MediaTime) -> Bool {
        // Both values are non-negative. Full-width products make comparison
        // exact even when Int64 cross-multiplication would overflow.
        let left = UInt64(lhs.value).multipliedFullWidth(
            by: UInt64(rhs.timescale)
        )
        let right = UInt64(rhs.value).multipliedFullWidth(
            by: UInt64(lhs.timescale)
        )
        if left.high != right.high { return left.high < right.high }
        return left.low < right.low
    }

    func clamped(to range: ClosedRange<MediaTime>) -> MediaTime {
        if self < range.lowerBound { return range.lowerBound }
        if self > range.upperBound { return range.upperBound }
        return self
    }

    /// Returns the numerator at an explicit target timescale. This is the
    /// operation AVFoundation/export boundaries need before creating CMTime.
    func scaledValue(
        to targetTimescale: Int32,
        rounding rule: MediaTimeRoundingRule
    ) throws -> Int64 {
        guard targetTimescale > 0 else {
            throw MediaTimeError.invalidTimescale(targetTimescale)
        }

        let product = UInt64(value).multipliedFullWidth(
            by: UInt64(targetTimescale)
        )
        let divisor = UInt64(timescale)
        guard product.high < divisor else {
            throw MediaTimeError.arithmeticOverflow
        }

        let division = divisor.dividingFullWidth(product)
        var quotient = division.quotient
        let remainder = division.remainder
        let shouldIncrement: Bool
        switch rule {
        case .towardZero:
            shouldIncrement = false
        case .awayFromZero:
            shouldIncrement = remainder != 0
        case .nearestAwayFromZero:
            shouldIncrement = remainder != 0
                && remainder >= divisor - remainder
        }

        if shouldIncrement {
            let incremented = quotient.addingReportingOverflow(1)
            guard !incremented.overflow else {
                throw MediaTimeError.arithmeticOverflow
            }
            quotient = incremented.partialValue
        }
        guard quotient <= UInt64(Int64.max) else {
            throw MediaTimeError.arithmeticOverflow
        }
        return Int64(quotient)
    }

    func converted(
        to targetTimescale: Int32,
        rounding rule: MediaTimeRoundingRule
    ) throws -> MediaTime {
        try MediaTime(
            value: scaledValue(to: targetTimescale, rounding: rule),
            timescale: targetTimescale
        )
    }

    /// Converts only when the target timescale can represent the rational
    /// value without rounding. Media/export boundaries use this method so an
    /// inexact project clock is a contract error, never a hidden drift.
    func scaledValueExactly(to targetTimescale: Int32) throws -> Int64 {
        let scaled = try scaledValue(
            to: targetTimescale, rounding: .towardZero)
        let roundtrip = try MediaTime(
            value: scaled, timescale: targetTimescale)
        guard roundtrip == self else {
            throw MediaTimeError.inexactConversion(
                targetTimescale: targetTimescale)
        }
        return scaled
    }

    fileprivate init(canonicalValue: Int64, timescale: Int32) {
        value = canonicalValue
        self.timescale = timescale
    }

    private static func greatestCommonDivisor(
        _ lhs: UInt64,
        _ rhs: UInt64
    ) -> UInt64 {
        var a = lhs
        var b = rhs
        while b != 0 {
            let remainder = a % b
            a = b
            b = remainder
        }
        return max(1, a)
    }

    private enum CodingKeys: String, CodingKey {
        case value
        case timescale
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        try self.init(
            value: container.decode(Int64.self, forKey: .value),
            timescale: container.decode(Int32.self, forKey: .timescale)
        )
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(value, forKey: .value)
        try container.encode(timescale, forKey: .timescale)
    }
}

enum StoryboardTimingError: Error, Sendable, Equatable {
    case unsupportedVersion(Int)
    case invalidFrameRate
    case invalidTimelineTimescale(Int32)
    case inexactProjectFrameDuration(Int32)
}

struct StoryboardTiming: Codable, Sendable, Equatable {
    static let schemaVersion = 1
    static let legacyDefault = StoryboardTiming(
        uncheckedFrameRate: MediaTime(canonicalValue: 25, timescale: 1),
        timelineTimescale: 600
    )

    let version: Int
    let projectFrameRate: MediaTime
    let timelineTimescale: Int32

    init(
        projectFrameRate: MediaTime,
        timelineTimescale: Int32 = 600
    ) throws {
        guard projectFrameRate > .zero else {
            throw StoryboardTimingError.invalidFrameRate
        }
        guard timelineTimescale > 0 else {
            throw StoryboardTimingError.invalidTimelineTimescale(
                timelineTimescale
            )
        }
        // One project frame must be an exact integer number of timeline
        // ticks. 24000/1001 therefore requires (at least) a 24000 timebase;
        // accepting it at 600 would guarantee drift before export starts.
        guard projectFrameRate.value <= Int64(Int32.max),
              let projectFrameDuration = try? MediaTime(
                value: Int64(projectFrameRate.timescale),
                timescale: Int32(projectFrameRate.value)),
              (try? projectFrameDuration.scaledValueExactly(
                to: timelineTimescale)) != nil else {
            throw StoryboardTimingError.inexactProjectFrameDuration(
                timelineTimescale)
        }
        version = Self.schemaVersion
        self.projectFrameRate = projectFrameRate
        self.timelineTimescale = timelineTimescale
    }

    private init(
        uncheckedFrameRate: MediaTime,
        timelineTimescale: Int32
    ) {
        version = Self.schemaVersion
        projectFrameRate = uncheckedFrameRate
        self.timelineTimescale = timelineTimescale
    }

    private enum CodingKeys: String, CodingKey {
        case version
        case projectFrameRate
        case timelineTimescale
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // A missing storyboardTiming field is migrated by the manuscript
        // boundary. Once the object is present its schema version is required.
        let version = try container.decode(Int.self, forKey: .version)
        guard version == Self.schemaVersion else {
            throw StoryboardTimingError.unsupportedVersion(version)
        }
        try self.init(
            projectFrameRate: container.decode(
                MediaTime.self, forKey: .projectFrameRate
            ),
            timelineTimescale: container.decode(
                Int32.self, forKey: .timelineTimescale
            )
        )
    }
}

enum StoryboardTimingCoding {
    static func decode(_ value: Any) throws -> StoryboardTiming {
        guard let object = value as? [String: Any],
              JSONSerialization.isValidJSONObject(object) else {
            throw StoryboardTimingError.invalidFrameRate
        }
        let data = try JSONSerialization.data(
            withJSONObject: object, options: [.sortedKeys])
        return try JSONDecoder().decode(StoryboardTiming.self, from: data)
    }

    static func object(_ timing: StoryboardTiming) -> [String: Any] {
        [
            "version": timing.version,
            "projectFrameRate": MediaTimeCoding.object(
                timing.projectFrameRate),
            "timelineTimescale": timing.timelineTimescale,
        ]
    }
}

/// Lossless bridge for the JSON dictionaries used by the existing Role Room
/// compatibility client. Codable remains the canonical wire representation;
/// this adapter only prevents every call site from reimplementing permissive
/// NSNumber/String coercion differently.
enum MediaTimeCoding {
    static func decode(_ value: Any?) -> MediaTime? {
        guard let object = value as? [String: Any],
              let rawValue = integer64(object["value"]),
              let rawTimescale = integer64(object["timescale"]),
              rawTimescale > 0,
              rawTimescale <= Int64(Int32.max)
        else { return nil }
        return try? MediaTime(
            value: rawValue,
            timescale: Int32(rawTimescale)
        )
    }

    static func object(_ time: MediaTime) -> [String: Any] {
        ["value": time.value, "timescale": time.timescale]
    }

    /// Legacy durations are normalized once at the boundary. The returned
    /// value is always a reduced rational equivalent of the nearest 1/600 s.
    static func decodeLegacySeconds(_ value: Any?) -> MediaTime? {
        let seconds: Double?
        if let number = value as? NSNumber,
           CFGetTypeID(number) != CFBooleanGetTypeID() {
            seconds = number.doubleValue
        } else if let string = value as? String {
            seconds = Double(string)
        } else {
            seconds = nil
        }
        guard let seconds else { return nil }
        return try? MediaTime(seconds: seconds, preferredTimescale: 600)
    }

    private static func integer64(_ value: Any?) -> Int64? {
        if let value = value as? Int64 { return value }
        if let value = value as? Int { return Int64(value) }
        if let value = value as? NSNumber {
            guard CFGetTypeID(value) != CFBooleanGetTypeID() else {
                return nil
            }
            let double = value.doubleValue
            guard double.isFinite,
                  double.rounded(.towardZero) == double,
                  double >= Double(Int64.min),
                  double <= Double(Int64.max) else { return nil }
            return value.int64Value
        }
        if let value = value as? String { return Int64(value) }
        return nil
    }
}
