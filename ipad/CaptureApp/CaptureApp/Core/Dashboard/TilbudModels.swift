import Foundation

// DTOs for the native "Tilbud" (quotes) surface. These mirror the JSON
// the Express backend returns for `/api/quotes/*`. Decoding follows the
// same tolerant style as ``DashboardModels`` — every optional field
// defaults to nil so a single missing/renamed column never fails the
// whole list, and dates stay as raw ISO strings (render via
// ``DashboardDate``).
//
// Money is special: the backend (Postgres `numeric` columns through
// node-postgres) may hand us amounts as JSON numbers *or* as strings
// ("1995.00"). ``flexibleDouble`` decodes either, so a string price
// never blows up the row. All types are `Sendable` so they cross the
// ``DashboardClient`` actor boundary into `@MainActor` view models.

// MARK: - Money decoding helper

/// Decode a numeric value that the backend may send as a JSON number
/// *or* a string. Returns nil when the key is absent/null/empty.
func flexibleDouble<K: CodingKey>(
    _ container: KeyedDecodingContainer<K>,
    _ key: K,
) -> Double? {
    if let d = try? container.decodeIfPresent(Double.self, forKey: key) { return d }
    if let s = try? container.decodeIfPresent(String.self, forKey: key),
       !s.isEmpty {
        // Tolerate "1 995,00" / "1995.00" / "1,995.00" shapes.
        let normalized = s
            .replacingOccurrences(of: " ", with: "")
            .replacingOccurrences(of: "\u{00A0}", with: "")
        if let d = Double(normalized) { return d }
        if let d = Double(normalized.replacingOccurrences(of: ",", with: ".")) { return d }
    }
    return nil
}

// MARK: - Quote line item

struct QuoteService: Codable, Sendable, Identifiable, Hashable {
    /// Synthetic id for `ForEach` — line items don't carry one from the
    /// backend, so we mint a stable UUID on decode.
    var id = UUID()
    var description: String
    var quantity: Double
    var unitPrice: Double
    var totalPrice: Double

    init(
        id: UUID = UUID(),
        description: String,
        quantity: Double,
        unitPrice: Double,
        totalPrice: Double,
    ) {
        self.id = id
        self.description = description
        self.quantity = quantity
        self.unitPrice = unitPrice
        self.totalPrice = totalPrice
    }

    private enum CodingKeys: String, CodingKey {
        case description, quantity, unitPrice, totalPrice, name
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = UUID()
        description = (try? c.decodeIfPresent(String.self, forKey: .description))
            ?? (try? c.decodeIfPresent(String.self, forKey: .name))
            ?? ""
        quantity = flexibleDouble(c, .quantity) ?? 1
        unitPrice = flexibleDouble(c, .unitPrice) ?? 0
        // Fall back to quantity * unitPrice when the backend omits the line total.
        totalPrice = flexibleDouble(c, .totalPrice) ?? (quantity * unitPrice)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(description, forKey: .description)
        try c.encode(quantity, forKey: .quantity)
        try c.encode(unitPrice, forKey: .unitPrice)
        try c.encode(totalPrice, forKey: .totalPrice)
    }
}

// MARK: - Quote

struct Quote: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var quoteNumber: String?
    var title: String?
    var description: String?
    var clientName: String?
    var clientEmail: String?
    /// draft / pending / sent / viewed / accepted / rejected
    var status: String?
    var services: [QuoteService]?
    var subtotal: Double?
    var mva: Double?
    var totalAmount: Double?
    var validUntil: String?
    var createdAt: String?

    private enum CodingKeys: String, CodingKey {
        case id, quoteNumber, title, description, clientName, clientEmail
        case status, services, subtotal, mva, totalAmount, validUntil, createdAt
        // Alternate keys the backend sometimes uses.
        case quote_number, client_name, client_email
        case lineItems, items, total, vat, total_amount, valid_until, created_at
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // id may arrive as a number or string from different routes.
        if let s = try? c.decode(String.self, forKey: .id) {
            id = s
        } else if let i = try? c.decode(Int.self, forKey: .id) {
            id = String(i)
        } else {
            id = (try? c.decode(Double.self, forKey: .id)).map { String(Int($0)) } ?? UUID().uuidString
        }
        quoteNumber = (try? c.decodeIfPresent(String.self, forKey: .quoteNumber))
            ?? (try? c.decodeIfPresent(String.self, forKey: .quote_number))
            ?? nil
        title = try? c.decodeIfPresent(String.self, forKey: .title)
        description = try? c.decodeIfPresent(String.self, forKey: .description)
        clientName = (try? c.decodeIfPresent(String.self, forKey: .clientName))
            ?? (try? c.decodeIfPresent(String.self, forKey: .client_name))
            ?? nil
        clientEmail = (try? c.decodeIfPresent(String.self, forKey: .clientEmail))
            ?? (try? c.decodeIfPresent(String.self, forKey: .client_email))
            ?? nil
        status = try? c.decodeIfPresent(String.self, forKey: .status)
        services = (try? c.decodeIfPresent([QuoteService].self, forKey: .services))
            ?? (try? c.decodeIfPresent([QuoteService].self, forKey: .lineItems))
            ?? (try? c.decodeIfPresent([QuoteService].self, forKey: .items))
            ?? nil
        subtotal = flexibleDouble(c, .subtotal)
        mva = flexibleDouble(c, .mva) ?? flexibleDouble(c, .vat)
        totalAmount = flexibleDouble(c, .totalAmount)
            ?? flexibleDouble(c, .total_amount)
            ?? flexibleDouble(c, .total)
        validUntil = (try? c.decodeIfPresent(String.self, forKey: .validUntil))
            ?? (try? c.decodeIfPresent(String.self, forKey: .valid_until))
            ?? nil
        createdAt = (try? c.decodeIfPresent(String.self, forKey: .createdAt))
            ?? (try? c.decodeIfPresent(String.self, forKey: .created_at))
            ?? nil
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encodeIfPresent(quoteNumber, forKey: .quoteNumber)
        try c.encodeIfPresent(title, forKey: .title)
        try c.encodeIfPresent(description, forKey: .description)
        try c.encodeIfPresent(clientName, forKey: .clientName)
        try c.encodeIfPresent(clientEmail, forKey: .clientEmail)
        try c.encodeIfPresent(status, forKey: .status)
        try c.encodeIfPresent(services, forKey: .services)
        try c.encodeIfPresent(subtotal, forKey: .subtotal)
        try c.encodeIfPresent(mva, forKey: .mva)
        try c.encodeIfPresent(totalAmount, forKey: .totalAmount)
        try c.encodeIfPresent(validUntil, forKey: .validUntil)
        try c.encodeIfPresent(createdAt, forKey: .createdAt)
    }
}

// MARK: - Response envelopes

struct QuoteListResponse: Codable, Sendable {
    let quotes: [Quote]
}

struct QuoteDetailResponse: Codable, Sendable {
    let data: Quote
}
