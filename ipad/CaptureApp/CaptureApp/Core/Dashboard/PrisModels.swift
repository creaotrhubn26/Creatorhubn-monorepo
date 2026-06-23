import Foundation

// DTOs for the native "Pris" (price administration) surface. These mirror
// the JSON the Express backend returns for `/api/price-administration/*`
// (pricing structures, additional costs, discounts).
//
// Decoding is deliberately tolerant in the ``DashboardModels`` style:
// every optional field defaults to nil so a single missing/renamed column
// never fails the whole list. Money/rate fields are especially loose — the
// backend may serialise a numeric column as a JSON *number* OR as a JSON
// *string* (Postgres `numeric` often round-trips as a string), so they are
// decoded through ``decodeFlexibleDouble`` which accepts both.
//
// All types are `Sendable` so they cross the actor boundary from
// ``DashboardClient`` into `@MainActor` view models cleanly.

// MARK: - Flexible number decoding

/// Decode a value that may arrive as a JSON number, a JSON string
/// ("1500", "1 500", "1500.50", "1.500,50"), or be absent → nil.
func decodeFlexibleDouble<K: CodingKey>(
    _ container: KeyedDecodingContainer<K>,
    _ key: K,
) -> Double? {
    if let d = try? container.decodeIfPresent(Double.self, forKey: key) {
        return d
    }
    if let i = try? container.decodeIfPresent(Int.self, forKey: key) {
        return Double(i)
    }
    if let s = try? container.decodeIfPresent(String.self, forKey: key) {
        let trimmed = s.trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return nil }
        // Strip spaces (thousand separators) then normalise a decimal comma.
        var cleaned = trimmed.replacingOccurrences(of: " ", with: "")
        if cleaned.contains(",") && !cleaned.contains(".") {
            cleaned = cleaned.replacingOccurrences(of: ",", with: ".")
        } else {
            cleaned = cleaned.replacingOccurrences(of: ",", with: "")
        }
        return Double(cleaned)
    }
    return nil
}

/// Decode a value that may arrive as a JSON bool, a number (0/1), or a
/// string ("true"/"1"/"yes") → nil when absent.
func decodeFlexibleBool<K: CodingKey>(
    _ container: KeyedDecodingContainer<K>,
    _ key: K,
) -> Bool? {
    if let b = try? container.decodeIfPresent(Bool.self, forKey: key) {
        return b
    }
    if let i = try? container.decodeIfPresent(Int.self, forKey: key) {
        return i != 0
    }
    if let s = try? container.decodeIfPresent(String.self, forKey: key) {
        switch s.trimmingCharacters(in: .whitespaces).lowercased() {
        case "true", "1", "yes", "ja", "t": return true
        case "false", "0", "no", "nei", "f", "": return false
        default: return nil
        }
    }
    return nil
}

// MARK: - Pricing structure

struct PricingStructure: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var name: String?
    var type: String?
    var profession: String?
    var hourlyRate: Double?
    var fullDayRate: Double?
    var basePrice: Double?
    var minimumPrice: Double?
    var maximumPrice: Double?

    private enum CodingKeys: String, CodingKey {
        case id, name, type, profession
        case hourlyRate, fullDayRate, basePrice, minimumPrice, maximumPrice
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        type = try c.decodeIfPresent(String.self, forKey: .type)
        profession = try c.decodeIfPresent(String.self, forKey: .profession)
        hourlyRate = decodeFlexibleDouble(c, .hourlyRate)
        fullDayRate = decodeFlexibleDouble(c, .fullDayRate)
        basePrice = decodeFlexibleDouble(c, .basePrice)
        minimumPrice = decodeFlexibleDouble(c, .minimumPrice)
        maximumPrice = decodeFlexibleDouble(c, .maximumPrice)
    }

    // Memberwise init for previews/tests.
    init(
        id: String,
        name: String? = nil,
        type: String? = nil,
        profession: String? = nil,
        hourlyRate: Double? = nil,
        fullDayRate: Double? = nil,
        basePrice: Double? = nil,
        minimumPrice: Double? = nil,
        maximumPrice: Double? = nil,
    ) {
        self.id = id
        self.name = name
        self.type = type
        self.profession = profession
        self.hourlyRate = hourlyRate
        self.fullDayRate = fullDayRate
        self.basePrice = basePrice
        self.minimumPrice = minimumPrice
        self.maximumPrice = maximumPrice
    }
}

// MARK: - Additional cost

struct AdditionalCost: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var name: String?
    var description: String?
    var type: String?
    var amount: Double?
    var isBillable: Bool?

    private enum CodingKeys: String, CodingKey {
        case id, name, description, type, amount, isBillable
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        type = try c.decodeIfPresent(String.self, forKey: .type)
        amount = decodeFlexibleDouble(c, .amount)
        isBillable = decodeFlexibleBool(c, .isBillable)
    }

    init(
        id: String,
        name: String? = nil,
        description: String? = nil,
        type: String? = nil,
        amount: Double? = nil,
        isBillable: Bool? = nil,
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.type = type
        self.amount = amount
        self.isBillable = isBillable
    }
}

// MARK: - Discount

struct Discount: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var name: String?
    var discountCode: String?
    var description: String?
    var discountValue: Double?
    var isPercentage: Bool?

    private enum CodingKeys: String, CodingKey {
        case id, name, discountCode, description, discountValue, isPercentage
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        discountCode = try c.decodeIfPresent(String.self, forKey: .discountCode)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        discountValue = decodeFlexibleDouble(c, .discountValue)
        isPercentage = decodeFlexibleBool(c, .isPercentage)
    }

    init(
        id: String,
        name: String? = nil,
        discountCode: String? = nil,
        description: String? = nil,
        discountValue: Double? = nil,
        isPercentage: Bool? = nil,
    ) {
        self.id = id
        self.name = name
        self.discountCode = discountCode
        self.description = description
        self.discountValue = discountValue
        self.isPercentage = isPercentage
    }
}

// MARK: - Money formatting

/// Shared "kr 1 500" style formatter for the Pris surface (Norwegian
/// grouping, no decimals when whole). Read-only after init so it is safe
/// to share under Swift 6.
enum PrisFormat {
    private nonisolated(unsafe) static let currency: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.locale = Locale(identifier: "nb_NO")
        f.groupingSeparator = " "
        f.maximumFractionDigits = 2
        f.minimumFractionDigits = 0
        return f
    }()

    /// "kr 1 500" — whole-krone amount with a leading "kr".
    static func kr(_ value: Double?) -> String {
        guard let value else { return "—" }
        let n = currency.string(from: NSNumber(value: value)) ?? "\(value)"
        return "kr \(n)"
    }

    /// Plain number ("1 500", "20") without a currency prefix.
    static func number(_ value: Double?) -> String {
        guard let value else { return "—" }
        return currency.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}
