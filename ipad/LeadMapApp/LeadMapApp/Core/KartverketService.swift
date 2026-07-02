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

    private struct KartverketReverseDTO: Decodable {
        struct Match: Decodable {
            let address: String
            let formatted: String
            let postal_code: String
            let city: String
            let municipality: String
            let municipality_number: String
            let county: String
            let matrikkel_id: String?
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
                ? "\(m.address), \(m.postal_code) \(m.city)"
                : m.formatted,
            postalCode: m.postal_code,
            city: m.city,
            municipality: m.municipality,
            municipalityNumber: m.municipality_number,
            county: m.county,
            matrikkelId: m.matrikkel_id,
            source: .kartverket
        )
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

    /// Hent kommune-grense fra Leadgrid-backendens Kartverket-proxy.
    /// Returnerer nil ved feil (klient faller tilbake til hardkodet).
    func fetchKommuneOmrade(
        kommunenummer: String, using api: APIClient
    ) async -> KommuneOmrade? {
        // Response = GeoJSON Feature. Vi må trekke ut rå JSON-bytes fra
        // backend og gi dem til MKGeoJSONDecoder.
        let path = "/api/leadgrid/kartverket/kommune/\(kommunenummer)/omrade"
        do {
            let data = try await api._raw(path)
            return decodeKommuneOmrade(kommunenummer: kommunenummer, data: data)
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
