// TripService.swift
//
// Leadgrid Go — synk av kjøreboka mot backend (`/api/leadgrid/trips`).
// Lokal `TripStore` er kilde for visning; denne pusher/henter for durabel
// lagring på tvers av enheter + CSV-eksport (Skatteetaten-format).
//
// camelCase ↔ snake_case via APIClients delte coder (iso8601 uten millis).

import Foundation

@MainActor
final class TripService {
    static let shared = TripService()

    private struct TripsResponse: Decodable { let trips: [Trip] }
    private struct SyncBody: Encodable { let trips: [Trip] }
    private struct Ack: Decodable { let ok: Bool? }
    private struct PurposePatch: Encodable { let purpose: String }

    /// Bulk-synk: push lokale turer, få autoritativ liste tilbake. Nil ved feil.
    func sync(_ local: [Trip], using api: APIClient?) async -> [Trip]? {
        guard let api else { return nil }
        let r: TripsResponse? = try? await api._post("/api/leadgrid/trips/sync", body: SyncBody(trips: local))
        return r?.trips
    }

    /// Push én tur (fire-and-forget, f.eks. ved auto-logg fra nav).
    func push(_ trip: Trip, using api: APIClient?) async {
        guard let api else { return }
        let _: Ack? = try? await api._post("/api/leadgrid/trips", body: trip)
    }

    /// Oppdater formål (fører-attestering).
    func setPurpose(_ purpose: TripPurpose, id: UUID, using api: APIClient?) async {
        guard let api else { return }
        try? await api._patch("/api/leadgrid/trips/\(id.uuidString)", body: PurposePatch(purpose: purpose.rawValue))
    }

    func delete(id: UUID, using api: APIClient?) async {
        guard let api else { return }
        try? await api._delete("/api/leadgrid/trips/\(id.uuidString)")
    }

    /// Hent Skatteetaten-CSV (hele kjøreboka). Nil ved feil.
    func exportCSV(using api: APIClient?) async -> String? {
        guard let api else { return nil }
        let data = try? await api._raw("/api/leadgrid/trips/export.csv")
        return data.flatMap { String(data: $0, encoding: .utf8) }
    }

    struct ReportResult: Decodable { let sent: Bool?; let to: String?; let error: String? }
    /// Send månedsrapport til egen innboks. Returnerer e-post ved suksess, nil ved feil.
    func sendMonthlyReport(using api: APIClient?) async -> String? {
        guard let api else { return nil }
        struct Empty: Encodable {}
        let r: ReportResult? = try? await api._post("/api/leadgrid/trips/report", body: Empty())
        return (r?.sent == true) ? r?.to : nil
    }

    // MARK: Leadgrid Go Dashboard — team-oversikt (kun admin/salgssjef)

    /// Team-oversikt. Nil ved feil ELLER hvis caller ikke er Go-admin (403).
    func teamOverview(using api: APIClient?) async -> GoTeamResponse? {
        guard let api else { return nil }
        return try? await api._get("/api/leadgrid/trips/team")
    }

    // MARK: kjøretøy-booking (delte firmabiler)

    private struct FleetResponse: Decodable { let vehicles: [GoFleetVehicle] }
    private struct BookingsResponse: Decodable { let bookings: [GoBooking] }
    private struct BookAck: Decodable { let ok: Bool?; let error: String? }

    func fleet(using api: APIClient?) async -> [GoFleetVehicle] {
        guard let api else { return [] }
        let r: FleetResponse? = try? await api._get("/api/leadgrid/vehicle/fleet")
        return r?.vehicles ?? []
    }
    func bookings(using api: APIClient?) async -> [GoBooking] {
        guard let api else { return [] }
        let r: BookingsResponse? = try? await api._get("/api/leadgrid/vehicle/bookings")
        return r?.bookings ?? []
    }
    /// Reserver. Returnerer nil ved suksess, ellers en feilkode («time_conflict» osv.).
    /// `vehicleId` (flåtebil) vinner over fritekst-label på serveren.
    func createBooking(label: String, plate: String?, startAt: Date, endAt: Date,
                       purpose: String, bookedByName: String,
                       vehicleId: String? = nil, using api: APIClient?) async -> String? {
        guard let api else { return "no_api" }
        struct Body: Encodable {
            let vehicleLabel: String; let vehiclePlate: String?; let vehicleId: String?
            let startAt: String; let endAt: String; let purpose: String; let bookedByName: String
        }
        let iso = ISO8601DateFormatter()
        let body = Body(vehicleLabel: label, vehiclePlate: plate, vehicleId: vehicleId,
                        startAt: iso.string(from: startAt), endAt: iso.string(from: endAt),
                        purpose: purpose, bookedByName: bookedByName)
        do {
            let r: BookAck = try await api._post("/api/leadgrid/vehicle/bookings", body: body)
            return r.ok == true ? nil : (r.error ?? "failed")
        } catch { return "time_conflict" }   // 409 → konflikt (vanligste feil)
    }
    func cancelBooking(id: String, using api: APIClient?) async {
        guard let api else { return }
        try? await api._delete("/api/leadgrid/vehicle/bookings/\(id)")
    }

    // MARK: flåteregister — org-EIDE firmabiler (admin registrerer sentralt)

    private struct OrgVehiclesResponse: Decodable { let vehicles: [OrgVehicle] }
    private struct IdAck: Decodable { let ok: Bool?; let id: String?; let error: String? }

    /// Aktiv flåte i org-en. Tom liste ved feil (og for org uten flåte).
    func orgVehicles(using api: APIClient?) async -> [OrgVehicle] {
        guard let api else { return [] }
        let r: OrgVehiclesResponse? = try? await api._get("/api/leadgrid/org-vehicles")
        return r?.vehicles ?? []
    }

    struct OrgVehicleDraft: Encodable {
        var plate: String
        var displayName: String
        var fuel: String
        var kind: String = "car"
        var euControlDue: String?
        var isShared: Bool = true
        var assignedUserId: String?
        var note: String = ""
    }

    /// Registrer firmabil. Returnerer nil ved suksess, ellers feilkode
    /// («plate_exists», «not_go_admin» …).
    func createOrgVehicle(_ draft: OrgVehicleDraft, using api: APIClient?) async -> String? {
        guard let api else { return "no_api" }
        do {
            let r: IdAck = try await api._post("/api/leadgrid/org-vehicles", body: draft)
            return r.ok == true ? nil : (r.error ?? "failed")
        } catch { return "plate_exists" }   // 409 → duplikat (vanligste feil)
    }

    /// PATCH — kun satte felter sendes (JSONEncoder utelater nil-optionals).
    struct OrgVehiclePatch: Encodable {
        var displayName: String?
        var fuel: String?
        var euControlDue: String?
        var isShared: Bool?
        var assignedUserId: String?   // "" → fjern tildeling (server tolker tom som null)
        var note: String?
        var status: String?
    }

    func updateOrgVehicle(id: String, _ patch: OrgVehiclePatch, using api: APIClient?) async -> Bool {
        guard let api else { return false }
        do { try await api._patch("/api/leadgrid/org-vehicles/\(id)", body: patch); return true }
        catch { return false }
    }

    /// Avregistrer (soft delete — historikk/booking-referanser består).
    func retireOrgVehicle(id: String, using api: APIClient?) async -> Bool {
        guard let api else { return false }
        do { try await api._delete("/api/leadgrid/org-vehicles/\(id)"); return true }
        catch { return false }
    }
}

/// Org-eid firmabil fra flåteregisteret (leadgrid_org_vehicles).
struct OrgVehicle: Decodable, Identifiable, Hashable {
    let id: String
    let plate: String
    let displayName: String?
    let fuel: String?
    let kind: String?
    let euControlDue: String?
    let isShared: Bool
    let assignedUserId: String?
    let assignedUserName: String?
    let note: String?
    let status: String?
    var label: String { (displayName?.isEmpty == false ? displayName! : plate) }
}

struct GoFleetVehicle: Decodable, Identifiable, Hashable {
    let plate: String?
    let displayName: String?
    let fuel: String?
    let driverName: String?
    let euControlDue: String?
    var id: String { plate ?? displayName ?? driverName ?? UUID().uuidString }
    var label: String { displayName ?? plate ?? "Firmabil" }
}

struct GoBooking: Decodable, Identifiable, Hashable {
    let id: String
    let vehicleLabel: String
    let vehiclePlate: String?
    let bookedBy: String
    let bookedByName: String?
    let startAt: String
    let endAt: String
    let purpose: String?
    let isMine: Bool?
}

struct GoDriverSummary: Decodable, Identifiable, Hashable {
    let userId: String
    let name: String
    let role: String
    let trips: Int
    let km: Double
    let businessKm: Double
    let amount: Double
    let tolls: Double
    let unconfirmed: Int
    let vehicleName: String?
    let vehiclePlate: String?
    let isCompanyCar: Bool?
    let vehicleFuel: String?
    let euControlDue: String?
    let lastTrip: String?
    var id: String { userId }
}

struct GoTeamTotals: Decodable, Hashable {
    let drivers: Int
    let activeDrivers: Int
    let km: Double
    let amount: Double
    let tolls: Double
    let unconfirmed: Int
}

struct GoTeamResponse: Decodable {
    let role: String?
    let drivers: [GoDriverSummary]
    let totals: GoTeamTotals
}
