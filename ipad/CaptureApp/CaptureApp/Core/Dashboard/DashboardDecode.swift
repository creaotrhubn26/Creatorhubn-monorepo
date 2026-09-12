import Foundation

/// Shared tolerant-decode helpers for the dashboard DTOs. Long
/// `(try? decodeIfPresent(...)) ?? (try? ...).flatMap { $0 } ?? …` chains
/// blow up the Swift type-checker ("unable to type-check in reasonable
/// time"); these helpers keep the call sites short and well-typed.
extension KeyedDecodingContainer {
    /// First non-nil String among the given keys (key absent / null / decode
    /// error → skipped). Returns nil if none present.
    func firstString(_ keys: [Key]) -> String? {
        for key in keys {
            if let v = try? decodeIfPresent(String.self, forKey: key) { return v }
        }
        return nil
    }

    /// First non-nil Int among the given keys.
    func firstInt(_ keys: [Key]) -> Int? {
        for key in keys {
            if let v = try? decodeIfPresent(Int.self, forKey: key) { return v }
            if let s = try? decodeIfPresent(String.self, forKey: key), let n = Int(s) { return n }
        }
        return nil
    }

    /// First non-nil Bool among the given keys (accepts bool / 0-1 / "true").
    func firstBool(_ keys: [Key]) -> Bool? {
        for key in keys {
            if let v = try? decodeIfPresent(Bool.self, forKey: key) { return v }
            if let i = try? decodeIfPresent(Int.self, forKey: key) { return i != 0 }
            if let s = try? decodeIfPresent(String.self, forKey: key) {
                return s == "true" || s == "1" || s.lowercased() == "yes"
            }
        }
        return nil
    }

    /// First non-nil Double among the given keys (accepts number or string).
    func firstDouble(_ keys: [Key]) -> Double? {
        for key in keys {
            if let v = try? decodeIfPresent(Double.self, forKey: key) { return v }
            if let s = try? decodeIfPresent(String.self, forKey: key) {
                let cleaned = s.replacingOccurrences(of: " ", with: "").replacingOccurrences(of: ",", with: ".")
                if let n = Double(cleaned) { return n }
            }
        }
        return nil
    }
}
