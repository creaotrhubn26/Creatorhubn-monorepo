// KartverketService.swift
//
// Norsk offisiell adresse-oppslag via Leadgrid-backendens proxy mot
// Kartverket/Geonorge. Bruker punktsok for reverse-geocoding og faller
// tilbake til Apple CLGeocoder utenfor Norge (grov bbox-sjekk).
//
// Hvorfor Kartverket + ikke bare CLGeocoder?
//   - Offisielle norske adresser (postnr + kommunenr + matrikkel-id)
//   - Bedre håndtering av ø/æ/å, sekundær-adresser (12A/12B), tunfjord
//   - Kommune-nummer → kan mappe til Team-områder, fylke-agg, admin-senter
//   - Matrikkel-id → nøkkel til eiendom/bygning-info senere
//   - Fri av rate-limit (Apple Maps rate-limit'er per app-id)
//   - GDPR-friendly (data blir i Norge)
//
// Norge bbox (grov): lat 57.9-71.3, lon 4.1-31.3. Inkluderer Svalbard.
//
// Bruk:
//   let addr = try await KartverketService.shared.reverseGeocode(
//       lat: coord.latitude, lon: coord.longitude, using: api)
//   // .kartverket → offisiell adresse fra Kartverket
//   // .apple      → CLGeocoder (utenfor NO eller Kartverket bommet)

import Foundation
import CoreLocation
import MapKit

/// Ren, testbar policy for dørsalgskartets nettverks- og renderbudsjett.
/// Beregningene er ikke MainActor-isolert og kan kjøres utenfor UI-tråden.
enum DorsalgAddressFetchPolicy {
    static let pageSize = 350
    static let maxPages = 4
    static let renderLimit = 240
    static let minimumRequestRadius = 800
    static let maximumRequestRadius = 2_000
    static let maximumStoredAddresses = 3_000
    static let cameraSettleDelayNanoseconds: UInt64 = 120_000_000

    static func visibleRadiusMeters(
        latitudeDelta: Double,
        longitudeDelta: Double,
        centerLatitude: Double
    ) -> Double {
        let latitudeMeters = abs(latitudeDelta) * 111_000 / 2
        let longitudeMeters = abs(longitudeDelta) * 111_000
            * max(0.2, cos(centerLatitude * .pi / 180)) / 2
        return max(latitudeMeters, longitudeMeters)
    }

    static func requestRadius(
        latitudeDelta: Double,
        longitudeDelta: Double,
        centerLatitude: Double
    ) -> Int {
        min(
            maximumRequestRadius,
            max(
                minimumRequestRadius,
                Int(ceil(visibleRadiusMeters(
                    latitudeDelta: latitudeDelta,
                    longitudeDelta: longitudeDelta,
                    centerLatitude: centerLatitude
                )))
            )
        )
    }

    static func isZoomSuitable(
        latitudeDelta: Double,
        longitudeDelta: Double,
        centerLatitude: Double
    ) -> Bool {
        visibleRadiusMeters(
            latitudeDelta: latitudeDelta,
            longitudeDelta: longitudeDelta,
            centerLatitude: centerLatitude
        ) <= Double(maximumRequestRadius)
    }

    static func additionalPages(total: Int, pageSize: Int = pageSize) -> [Int] {
        guard total > pageSize, pageSize > 0 else { return [] }
        let totalPages = Int(ceil(Double(total) / Double(pageSize)))
        let pagesToLoad = min(maxPages, totalPages)
        guard pagesToLoad > 1 else { return [] }
        return Array(1..<pagesToLoad)
    }

    static func merged(
        existing: [KartverketService.AdressePunkt],
        incoming: [KartverketService.AdressePunkt],
        centerLatitude: Double,
        centerLongitude: Double
    ) -> [KartverketService.AdressePunkt] {
        var byID = Dictionary(
            existing.map { ($0.id, $0) },
            uniquingKeysWith: { current, _ in current }
        )
        for address in incoming { byID[address.id] = address }
        var result = Array(byID.values)
        if result.count > maximumStoredAddresses {
            result.sort {
                distanceSquared(
                    $0,
                    centerLatitude: centerLatitude,
                    centerLongitude: centerLongitude
                ) < distanceSquared(
                    $1,
                    centerLatitude: centerLatitude,
                    centerLongitude: centerLongitude
                )
            }
            result = Array(result.prefix(maximumStoredAddresses))
        }
        return result
    }

    static func visible(
        addresses: [KartverketService.AdressePunkt],
        centerLatitude: Double,
        centerLongitude: Double,
        latitudeDelta: Double,
        longitudeDelta: Double,
        statuses: [String: String],
        statusFilter: String?,
        limit: Int = renderLimit
    ) -> [KartverketService.AdressePunkt] {
        let latitudeMargin = abs(latitudeDelta) * 0.65
        let longitudeMargin = abs(longitudeDelta) * 0.65
        var result = addresses.filter {
            abs($0.lat - centerLatitude) < latitudeMargin &&
            abs($0.lon - centerLongitude) < longitudeMargin
        }
        if let statusFilter {
            result = result.filter {
                let status = statuses[$0.id]
                return statusFilter == "ubesokt"
                    ? status == nil
                    : status == statusFilter
            }
        }
        if result.count > limit {
            result.sort {
                distanceSquared(
                    $0,
                    centerLatitude: centerLatitude,
                    centerLongitude: centerLongitude
                ) < distanceSquared(
                    $1,
                    centerLatitude: centerLatitude,
                    centerLongitude: centerLongitude
                )
            }
            result = Array(result.prefix(limit))
        }
        return result
    }

    static func coverageRadius(
        loadedAddresses: [KartverketService.AdressePunkt],
        reportedTotal: Int,
        requestedRadius: Int,
        centerLatitude: Double,
        centerLongitude: Double
    ) -> Double {
        guard !loadedAddresses.isEmpty else { return 0 }
        if loadedAddresses.count >= reportedTotal {
            return Double(requestedRadius)
        }
        let furthest = loadedAddresses.reduce(0.0) { partial, address in
            max(
                partial,
                distanceMeters(
                    latitude1: centerLatitude,
                    longitude1: centerLongitude,
                    latitude2: address.lat,
                    longitude2: address.lon
                )
            )
        }
        return min(Double(requestedRadius), furthest + 20)
    }

    static func isCovered(
        requestLatitude: Double,
        requestLongitude: Double,
        visibleRadius: Double,
        coverageLatitude: Double,
        coverageLongitude: Double,
        coverageRadius: Double
    ) -> Bool {
        let centerDistance = distanceMeters(
            latitude1: requestLatitude,
            longitude1: requestLongitude,
            latitude2: coverageLatitude,
            longitude2: coverageLongitude
        )
        return centerDistance + visibleRadius <= coverageRadius * 0.92
    }

    private static func distanceSquared(
        _ address: KartverketService.AdressePunkt,
        centerLatitude: Double,
        centerLongitude: Double
    ) -> Double {
        let latitudeDelta = address.lat - centerLatitude
        let longitudeDelta = (address.lon - centerLongitude)
            * cos(centerLatitude * .pi / 180)
        return latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta
    }

    private static func distanceMeters(
        latitude1: Double,
        longitude1: Double,
        latitude2: Double,
        longitude2: Double
    ) -> Double {
        let radius = 6_371_000.0
        let phi1 = latitude1 * .pi / 180
        let phi2 = latitude2 * .pi / 180
        let deltaPhi = (latitude2 - latitude1) * .pi / 180
        let deltaLambda = (longitude2 - longitude1) * .pi / 180
        let a = sin(deltaPhi / 2) * sin(deltaPhi / 2)
            + cos(phi1) * cos(phi2)
            * sin(deltaLambda / 2) * sin(deltaLambda / 2)
        return radius * 2 * atan2(sqrt(a), sqrt(1 - a))
    }
}

@MainActor
final class KartverketService {
    static let shared = KartverketService()

    /// Dørsalg-backenden har en eksplisitt camelCase-kontrakt. Den delte
    /// API-encoderen konverterer ellers til snake_case, så alle writes går
    /// gjennom denne broen. Feil kan fortsatt håndteres av eksisterende UI,
    /// men payloaden endrer ikke feltnavn på vei ut.
    private func requestCamelCase<B: Encodable, R: Decodable>(
        _ path: String,
        method: String,
        body: B,
        using api: APIClient
    ) async throws -> R {
        let encoder = JSONEncoder()
        let decoder = JSONDecoder()
        let payload = try encoder.encode(body)
        let data = try await api._request(path, method: method, body: payload)
        return try decoder.decode(R.self, from: data)
    }

    /// Resultat-source så UI kan vise "🇳🇴 Kartverket" hvis vi vil.
    enum Source: String, Sendable { case kartverket, apple }

    struct ReverseResult: Sendable {
        let address: String        // "Solgården 12"
        let formatted: String      // "Solgården 12, 1830 Askim"
        let postalCode: String     // "1830"
        let city: String           // "Askim"
        let municipality: String   // "Askim"
        let municipalityNumber: String  // "3018"
        let county: String         // "Viken"
        let matrikkelId: String?
        let source: Source
    }

    // MARK: - Public API

    /// Reverse-geocode gitt WGS84-koordinat. Bruker Kartverket i Norge,
    /// CLGeocoder ellers. Kaster ikke: returnerer nil ved feil så UI kan
    /// vise koordinater som fallback.
    func reverseGeocode(
        lat: Double, lon: Double, using api: APIClient?
    ) async -> ReverseResult? {
        if isInsideNorway(lat: lat, lon: lon), let api {
            if let hit = try? await fetchFromKartverket(
                lat: lat, lon: lon, using: api
            ) {
                return hit
            }
        }
        // Fallback: Apple CLGeocoder (utenfor NO ELLER Kartverket bommet)
        return await fetchFromApple(lat: lat, lon: lon)
    }

    // MARK: - Kartverket

    // NB: `_get` dekoder med .convertFromSnakeCase — feltnavnene her MÅ
    // være camelCase (postal_code i JSON → postalCode her). Med snake_case
    // properties kastet dekodingen stille og alt falt tilbake til Apple.
    private struct KartverketReverseDTO: Decodable {
        struct Match: Decodable {
            let address: String
            let formatted: String
            let postalCode: String
            let city: String
            let municipality: String
            let municipalityNumber: String
            let county: String
            let matrikkelId: String?
        }
        let match: Match?
    }

    private func fetchFromKartverket(
        lat: Double, lon: Double, using api: APIClient
    ) async throws -> ReverseResult? {
        let path = "/api/leadgrid/kartverket/reverse"
            + "?lat=\(lat)&lon=\(lon)&radius=100"
        let dto: KartverketReverseDTO = try await api._get(path)
        guard let m = dto.match else { return nil }
        return ReverseResult(
            address: m.address,
            formatted: m.formatted.isEmpty
                ? "\(m.address), \(m.postalCode) \(m.city)"
                : m.formatted,
            postalCode: m.postalCode,
            city: m.city,
            municipality: m.municipality,
            municipalityNumber: m.municipalityNumber,
            county: m.county,
            matrikkelId: m.matrikkelId,
            source: .kartverket
        )
    }

    // MARK: - Kommune-katalog

    /// Én kommune fra Kartverkets offisielle katalog (~357 stk).
    struct KommuneInfo: Decodable, Sendable, Identifiable, Hashable {
        let nummer: String
        let navn: String
        var id: String { nummer }
    }

    private struct KommuneListeDTO: Decodable {
        let kommuner: [KommuneInfo]
    }

    private var kommuneListeCache: [KommuneInfo] = []

    /// Full kommune-katalog fra backend-proxyen (24t-cachet der, session-
    /// cachet her). Tom liste ved feil — UI viser ærlig feilmelding.
    func fetchKommuneListe(using api: APIClient) async -> [KommuneInfo] {
        if !kommuneListeCache.isEmpty { return kommuneListeCache }
        guard let dto: KommuneListeDTO = try? await api._get(
            "/api/leadgrid/kartverket/kommuner"
        ) else { return [] }
        kommuneListeCache = dto.kommuner
        return dto.kommuner
    }

    // MARK: - Dørsalg-modus: husstandsadresser (2026-07-18)
    // EGEN modus for dørsalg-org-er (feature-nøkkel `dorsalgModus`) —
    // blandes ALDRI med bedrifts-leads; adressene skrives aldri til CRM.

    struct AdressePunkt: Decodable, Sendable, Identifiable, Hashable {
        let adressetekst: String
        let postnummer: String
        let poststed: String
        let lat: Double
        let lon: Double
        var id: String { "\(adressetekst)|\(postnummer)" }
    }

struct AdressePage: Sendable {
    let total: Int
    let side: Int
    let pageSize: Int
    let hasMore: Bool
    let adresser: [AdressePunkt]
}

private struct AdresseResponse: Decodable {
    let total: Int
    let side: Int?
    let pageSize: Int?
    let hasMore: Bool?
    let adresser: [AdressePunkt]
}

/// Én avstandssortert side med husstandsadresser. Feil kastes slik at
/// kartet kan beholde eksisterende pins og tilby eksplisitt retry.
func fetchAdresser(
    lat: Double,
    lon: Double,
    radius: Int,
    side: Int = 0,
    pageSize: Int = DorsalgAddressFetchPolicy.pageSize,
    using api: APIClient
) async throws -> AdressePage {
    let safePageSize = min(1_000, max(50, pageSize))
    let response: AdresseResponse = try await api._get(
        "/api/leadgrid/kartverket/adresser/punkt" +
        "?lat=\(lat)&lon=\(lon)&radius=\(radius)" +
        "&side=\(side)&page_size=\(safePageSize)"
    )
    return AdressePage(
        total: response.total,
        side: response.side ?? side,
        pageSize: response.pageSize ?? safePageSize,
        hasMore: response.hasMore
            ?? ((side + 1) * safePageSize < response.total),
        adresser: response.adresser
    )
}

    // MARK: - Dørsalg: husstands-status (vunnet/avslått, mig 0397)
    // Utfallet på døra er org-data og persisteres — adressene selv aldri.

    struct DorsalgStatus: Decodable, Sendable {
        let adresseId: String
        let status: String        // "vunnet" | "avslatt"
    }

    private struct DorsalgStatusResponse: Decodable { let statuser: [DorsalgStatus] }
    private struct DorsalgAck: Decodable { let ok: Bool? }

    /// Alle husstands-statuser for callerens org. [:] ved feil.
    func fetchDorsalgStatuser(using api: APIClient) async -> [String: String] {
        guard let r: DorsalgStatusResponse = try? await api._get(
            "/api/leadgrid/dorsalg/status"
        ) else { return [:] }
        return Dictionary(r.statuser.map { ($0.adresseId, $0.status) },
                          uniquingKeysWith: { a, _ in a })
    }

    private struct DorsalgStatusBody: Encodable {
        let adresseId: String
        let adressetekst: String
        let postnummer: String
        let poststed: String
        let lat: Double
        let lon: Double
        let status: String
        let productId: String?
    }

    /// Sett vunnet/avslått på en adresse (best effort — UI er optimistisk).
    /// productId: hvilket produkt som ble solgt (vunnet m/ flere produkter).
    func setDorsalgStatus(_ status: String, for adr: AdressePunkt,
                          productId: String? = nil,
                          using api: APIClient) async {
        let body = DorsalgStatusBody(
            adresseId: adr.id, adressetekst: adr.adressetekst,
            postnummer: adr.postnummer, poststed: adr.poststed,
            lat: adr.lat, lon: adr.lon, status: status, productId: productId)
        let _: DorsalgAck? = try? await requestCamelCase(
            "/api/leadgrid/dorsalg/status", method: "POST", body: body,
            using: api)
    }

    // Dørsalg-produkter (mig 0399): org-en selger for flere oppdragsgivere
    // (SOS Barnebyer, Kirkens Bymisjon, …). Selgere ser kun produktene
    // salgssjefen har satt dem på (tom mine-liste = alle).
    struct DorsalgProduct: Decodable, Sendable, Identifiable, Hashable {
        struct Bidrag: Decodable, Sendable, Hashable, Identifiable {
            let belop: Double
            let label: String
            var id: String { "\(belop)|\(label)" }
        }
        let id: String
        let navn: String
        let farge: String
        let aktiv: Bool
        let verdiPerVunnet: Double?
        /// Prekonfigurerte bidragsnivåer (250/350/500 kr/mnd …) — settes av
        /// salgssjefen per oppdragsgiver. Optional: eldre backend mangler dem.
        let bidrag: [Bidrag]?
        let samtykkeTekst: String?
        /// Oppdragsgivers signeringsside (AvtaleGiro/Vipps) — fylles når
        /// avtalen foreligger. Betalingen skjer ALDRI i appen.
        let signeringUrl: String?
    }

    struct DorsalgProductsEnvelope: Decodable, Sendable {
        let canManage: Bool
        let mine: [String]
        let products: [DorsalgProduct]

        /// Produktene calleren faktisk kan selge (aktive ∩ tildelte).
        var tilgjengelige: [DorsalgProduct] {
            let aktive = products.filter(\.aktiv)
            guard !mine.isEmpty else { return aktive }
            let mineSet = Set(mine)
            return aktive.filter { mineSet.contains($0.id) }
        }
    }

    func fetchDorsalgProducts(using api: APIClient) async -> DorsalgProductsEnvelope? {
        try? await api._get("/api/leadgrid/dorsalg/products")
    }

    private struct ProductCreateBody: Encodable {
        let navn: String
        let verdiPerVunnet: Double?
    }
    private struct ProductAck: Decodable { let ok: Bool? }

    func createDorsalgProduct(navn: String, verdiPerVunnet: Double?,
                              using api: APIClient) async -> Bool {
        let r: ProductAck? = try? await requestCamelCase(
            "/api/leadgrid/dorsalg/products", method: "POST",
            body: ProductCreateBody(navn: navn, verdiPerVunnet: verdiPerVunnet), using: api)
        return r?.ok == true
    }

    private struct ProductPatchBody: Encodable {
        let aktiv: Bool?
        let verdiPerVunnet: Double?
    }

    func patchDorsalgProduct(id: String, aktiv: Bool?, verdiPerVunnet: Double?,
                             using api: APIClient) async {
        let _: ProductAck? = try? await requestCamelCase(
            "/api/leadgrid/dorsalg/products/\(id)", method: "PATCH",
            body: ProductPatchBody(aktiv: aktiv, verdiPerVunnet: verdiPerVunnet),
            using: api)
    }

    // «Registrer salg» (mig 0400): ekte avtale på døra. Grandma-prinsippet:
    // aldri betalingsdata i appen — kun kunde + produkt + bidrag + samtykke.
    private struct DorsalgSaleBody: Encodable {
        let adresseId: String
        let adressetekst: String
        let postnummer: String
        let poststed: String
        let lat: Double
        let lon: Double
        let productId: String?
        let bidragBelop: Double?
        let bidragLabel: String?
        let kundeNavn: String
        let kundeTelefon: String
        let kundeEpost: String?
        let ringBekreftet: Bool
        let samtykkeTekst: String
    }
    private struct DorsalgSaleAck: Decodable { let ok: Bool?; let id: String? }

    /// Registrer et dørsalg. true ved suksess (pin/Kvalitet/velkomst-e-post
    /// håndteres av backend).
    func registerDorsalgSale(
        for adr: AdressePunkt, productId: String?,
        bidragBelop: Double?, bidragLabel: String?,
        kundeNavn: String, kundeTelefon: String, kundeEpost: String?,
        ringBekreftet: Bool, samtykkeTekst: String,
        using api: APIClient
    ) async -> Bool {
        let body = DorsalgSaleBody(
            adresseId: adr.id, adressetekst: adr.adressetekst,
            postnummer: adr.postnummer, poststed: adr.poststed,
            lat: adr.lat, lon: adr.lon,
            productId: productId, bidragBelop: bidragBelop, bidragLabel: bidragLabel,
            kundeNavn: kundeNavn, kundeTelefon: kundeTelefon,
            kundeEpost: kundeEpost, ringBekreftet: ringBekreftet,
            samtykkeTekst: samtykkeTekst)
        let r: DorsalgSaleAck? = try? await requestCamelCase(
            "/api/leadgrid/dorsalg/sales", method: "POST", body: body, using: api)
        return r?.ok == true
    }

    struct DorsalgAccessMember: Decodable, Sendable, Identifiable {
        let userId: String
        let navn: String
        let role: String
        let productIds: [String]
        var id: String { userId }
    }
    private struct DorsalgAccessEnvelope: Decodable { let members: [DorsalgAccessMember] }

    func fetchDorsalgProductAccess(using api: APIClient) async -> [DorsalgAccessMember] {
        let r: DorsalgAccessEnvelope? = try? await api._get(
            "/api/leadgrid/dorsalg/products/access")
        return r?.members ?? []
    }

    private struct AccessPutBody: Encodable {
        let userId: String
        let productIds: [String]
    }

    func setDorsalgProductAccess(userId: String, productIds: [String],
                                 using api: APIClient) async {
        let _: ProductAck? = try? await requestCamelCase(
            "/api/leadgrid/dorsalg/products/access", method: "PUT",
            body: AccessPutBody(userId: userId, productIds: productIds), using: api)
    }

    // Dørsalg-oversikt (aggregat for org-en) — vises i Oversikt-fanen.
    struct DorsalgStats: Decodable, Sendable {
        struct Selger: Decodable, Sendable, Identifiable {
            let navn: String
            let vunnet: Int
            let avslatt: Int
            /// Provisjonsgrunnlag: vunnet × produktets verdi (eldre backend: nil).
            let verdi: Double?
            var id: String { navn }
        }
        struct Produkt: Decodable, Sendable, Identifiable {
            let produktId: String?
            let navn: String
            let vunnet: Int
            let avslatt: Int
            var id: String { produktId ?? navn }
        }
        struct VunnetDor: Decodable, Sendable, Identifiable {
            let adressetekst: String
            let postnummer: String
            let poststed: String
            let settAt: String
            var id: String { "\(adressetekst)|\(postnummer)|\(settAt)" }
        }
        /// Callerens egne tall (Min profil) — optional: eldre backend
        /// mangler feltet.
        struct Meg: Decodable, Sendable {
            let vunnet: Int
            let avslatt: Int
            let iDag: Int
            let denneUka: Int
        }
        let vunnet: Int
        let avslatt: Int
        let iDag: Int
        let vunnetIDag: Int
        let denneUka: Int
        let meg: Meg?
        /// KPI per produkt (ikke-ledere ser kun sine — filtrert i backend).
        let perProdukt: [Produkt]?
        let perSelger: [Selger]
        let sisteVunnet: [VunnetDor]
        /// Callerens resolverte dagsmål (team-først). Eldre backend: nil.
        let dagsmal: Int?
        /// Valgfritt kr-budsjett per selger per dag. Eldre backend: nil.
        let budsjett: Int?
    }

    /// Dørsalg-statistikk for callerens org. Nil ved feil.
    func fetchDorsalgStats(using api: APIClient) async -> DorsalgStats? {
        try? await api._get("/api/leadgrid/dorsalg/stats")
    }

    // ─── Dagsmål + budsjett (2026-07-19): leder styrer per team/org ─────

    struct DorsalgMaal: Decodable, Sendable {
        struct OrgDefault: Decodable, Sendable {
            let dagsmal: Int
            let budsjett: Int?
            let erSatt: Bool
        }
        struct TeamMaal: Decodable, Sendable, Identifiable {
            let teamId: String
            let navn: String
            let dagsmal: Int?
            let budsjett: Int?
            var id: String { teamId }
        }
        let canManage: Bool
        let mittDagsmal: Int
        let mittBudsjett: Int?
        let orgDefault: OrgDefault?
        let perTeam: [TeamMaal]?
    }

    /// Hent dagsmål/budsjett — callerens resolverte + (leder) org/team.
    func fetchDorsalgMaal(using api: APIClient) async -> DorsalgMaal? {
        try? await api._get("/api/leadgrid/dorsalg/maal")
    }

    /// Sett org-default (teamId nil/tom) eller et teams mål (leder).
    /// Returnerer true ved suksess.
    @discardableResult
    func setDorsalgMaal(teamId: String?, dagsmalPerSelger: Int,
                        budsjettPerSelger: Int?, using api: APIClient) async -> Bool {
        struct Body: Encodable {
            let teamId: String
            let dagsmalPerSelger: Int
            let budsjettPerSelger: Int?
        }
        struct Ack: Decodable { let ok: Bool? }
        let ack: Ack? = try? await requestCamelCase(
            "/api/leadgrid/dorsalg/maal", method: "PUT",
            body: Body(teamId: teamId ?? "", dagsmalPerSelger: dagsmalPerSelger,
                       budsjettPerSelger: budsjettPerSelger), using: api)
        return ack?.ok == true
    }

    /// Fjern status (angre) — best effort.
    func clearDorsalgStatus(adresseId: String, using api: APIClient) async {
        let encoded = adresseId.addingPercentEncoding(
            withAllowedCharacters: .urlPathAllowed) ?? adresseId
        try? await api._delete("/api/leadgrid/dorsalg/status/\(encoded)")
    }

    // MARK: - Apple CLGeocoder fallback

    private func fetchFromApple(lat: Double, lon: Double) async -> ReverseResult? {
        let loc = CLLocation(latitude: lat, longitude: lon)
        let geocoder = CLGeocoder()
        do {
            let places = try await geocoder.reverseGeocodeLocation(loc)
            guard let p = places.first else { return nil }
            let street: String = {
                if let s = p.thoroughfare {
                    if let n = p.subThoroughfare { return "\(s) \(n)" }
                    return s
                }
                return p.name ?? ""
            }()
            var parts: [String] = []
            if !street.isEmpty { parts.append(street) }
            if let postal = p.postalCode, let city = p.locality {
                parts.append("\(postal) \(city)")
            } else if let city = p.locality {
                parts.append(city)
            }
            let formatted = parts.joined(separator: ", ")
            return ReverseResult(
                address: street,
                formatted: formatted,
                postalCode: p.postalCode ?? "",
                city: p.locality ?? "",
                municipality: p.subAdministrativeArea ?? p.locality ?? "",
                municipalityNumber: "",
                county: p.administrativeArea ?? "",
                matrikkelId: nil,
                source: .apple
            )
        } catch {
            return nil
        }
    }

    // MARK: - Kommune-grense (GeoJSON polygon)

    /// Kommune-grense som MapKit-overlay(s). Én kommune kan returnere
    /// flere `MKPolygon` (multipolygon: fastland + øyer). Sentroid regnes
    /// på det største fragmentet.
    ///
    /// `@unchecked Sendable` fordi MKPolygon ikke er offisielt Sendable,
    /// men objektet er immutable etter dekoding og leses kun fra
    /// `@MainActor` SwiftUI-koden.
    struct KommuneOmrade: @unchecked Sendable {
        let kommunenummer: String
        let polygons: [MKPolygon]
        let center: CLLocationCoordinate2D
    }

    /// Session-cache for kommunegrenser — polygonene er store (100-500 KB)
    /// og endrer seg aldri i en app-økt.
    private var omradeCache: [String: KommuneOmrade] = [:]

    /// Hent kommune-grense fra Leadgrid-backendens Kartverket-proxy.
    /// Returnerer nil ved feil (klient faller tilbake til hardkodet).
    func fetchKommuneOmrade(
        kommunenummer: String, using api: APIClient
    ) async -> KommuneOmrade? {
        if let hit = omradeCache[kommunenummer] { return hit }
        // Response = GeoJSON Feature. Vi må trekke ut rå JSON-bytes fra
        // backend og gi dem til MKGeoJSONDecoder.
        let path = "/api/leadgrid/kartverket/kommune/\(kommunenummer)/omrade"
        do {
            let data = try await api._raw(path)
            let omrade = decodeKommuneOmrade(kommunenummer: kommunenummer, data: data)
            if let omrade { omradeCache[kommunenummer] = omrade }
            return omrade
        } catch {
            return nil
        }
    }

    private func decodeKommuneOmrade(
        kommunenummer: String, data: Data
    ) -> KommuneOmrade? {
        let decoder = MKGeoJSONDecoder()
        guard let objects = try? decoder.decode(data) else { return nil }
        var polygons: [MKPolygon] = []
        for obj in objects {
            if let feature = obj as? MKGeoJSONFeature {
                for geom in feature.geometry {
                    if let poly = geom as? MKPolygon {
                        polygons.append(poly)
                    } else if let multi = geom as? MKMultiPolygon {
                        polygons.append(contentsOf: multi.polygons)
                    }
                }
            } else if let poly = obj as? MKPolygon {
                polygons.append(poly)
            } else if let multi = obj as? MKMultiPolygon {
                polygons.append(contentsOf: multi.polygons)
            }
        }
        guard !polygons.isEmpty else { return nil }
        // Sentroid på det største polygonet (fastland > øyer)
        let biggest = polygons.max(by: { $0.pointCount < $1.pointCount }) ?? polygons[0]
        return KommuneOmrade(
            kommunenummer: kommunenummer,
            polygons: polygons,
            center: polygonCentroid(biggest)
        )
    }

    private func polygonCentroid(_ polygon: MKPolygon) -> CLLocationCoordinate2D {
        let count = polygon.pointCount
        guard count > 0 else { return polygon.coordinate }
        let pts = UnsafeBufferPointer(start: polygon.points(), count: count)
        var sumLat = 0.0, sumLon = 0.0
        for i in 0..<count {
            let c = pts[i].coordinate
            sumLat += c.latitude
            sumLon += c.longitude
        }
        return CLLocationCoordinate2D(
            latitude: sumLat / Double(count),
            longitude: sumLon / Double(count)
        )
    }

    // MARK: - Bbox

    /// Enkel bbox-sjekk for Fastlands-Norge + Svalbard. Litt raus i
    /// kantene så vi ikke bommer på Frøya, Nordkapp osv.
    private func isInsideNorway(lat: Double, lon: Double) -> Bool {
        let inMainland = (lat >= 57.9 && lat <= 71.3)
            && (lon >= 4.0 && lon <= 31.5)
        let inSvalbard = (lat >= 74.0 && lat <= 81.0)
            && (lon >= 10.0 && lon <= 35.0)
        return inMainland || inSvalbard
    }
}
