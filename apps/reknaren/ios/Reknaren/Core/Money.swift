import Foundation

/// Penger i hele øre (bigint på server → String i JSON). ALDRI Double.
/// Dekoder både String ("15000") og tall (15000) for robusthet.
struct Money: Codable, Hashable, Sendable {
    let minor: Int64

    init(minor: Int64) { self.minor = minor }

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let s = try? c.decode(String.self), let v = Int64(s) {
            minor = v
        } else {
            minor = try c.decode(Int64.self)
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(String(minor))
    }

    /// «1 234,50 kr» — norsk formattering, avledet av heltalls-øre (ingen flyttall).
    var kr: String {
        let neg = minor < 0
        let abs = neg ? -minor : minor
        let kroner = abs / 100
        let ore = abs % 100
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = "\u{00A0}"
        f.usesGroupingSeparator = true
        let krStr = f.string(from: NSNumber(value: kroner)) ?? "\(kroner)"
        return "\(neg ? "−" : "")\(krStr),\(String(format: "%02d", ore)) kr"
    }
}
