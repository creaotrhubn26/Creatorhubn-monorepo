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

@MainActor
final class KartverketService {
    static let shared = KartverketService()

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

    private struct AdresseResponse: Decodable {
        let total: Int
        let adresser: [AdressePunkt]
    }

    /// Alle husstandsadresser innen radius (backend-proxy mot Kartverkets
    /// punktsøk, maks 2000 m, 1000 per side — Kartverkets maks). ([], 0) ved feil.
    func fetchAdresser(
        lat: Double, lon: Double, radius: Int, side: Int = 0,
        using api: APIClient
    ) async -> (adresser: [AdressePunkt], total: Int) {
        guard let r: AdresseResponse = try? await api._get(
            "/api/leadgrid/kartverket/adresser/punkt" +
            "?lat=\(lat)&lon=\(lon)&radius=\(radius)&side=\(side)"
        ) else { return ([], 0) }
        return (r.adresser, r.total)
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
        let _: DorsalgAck? = try? await api._post(
            "/api/leadgrid/dorsalg/status", body: body)
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
        let r: ProductAck? = try? await api._post(
            "/api/leadgrid/dorsalg/products",
            body: ProductCreateBody(navn: navn, verdiPerVunnet: verdiPerVunnet))
        return r?.ok == true
    }

    private struct ProductPatchBody: Encodable {
        let aktiv: Bool?
        let verdiPerVunnet: Double?
    }

    func patchDorsalgProduct(id: String, aktiv: Bool?, verdiPerVunnet: Double?,
                             using api: APIClient) async {
        try? await api._patch(
            "/api/leadgrid/dorsalg/products/\(id)",
            body: ProductPatchBody(aktiv: aktiv, verdiPerVunnet: verdiPerVunnet))
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
        let r: DorsalgSaleAck? = try? await api._post("/api/leadgrid/dorsalg/sales", body: body)
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
        let _: ProductAck? = try? await api._put(
            "/api/leadgrid/dorsalg/products/access",
            body: AccessPutBody(userId: userId, productIds: productIds))
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
    }

    /// Dørsalg-statistikk for callerens org. Nil ved feil.
    func fetchDorsalgStats(using api: APIClient) async -> DorsalgStats? {
        try? await api._get("/api/leadgrid/dorsalg/stats")
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
