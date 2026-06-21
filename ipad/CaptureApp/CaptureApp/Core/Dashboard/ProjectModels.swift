import Foundation

/// DTOs for the native project hub — the center of the request→project→
/// conversation→timeline→worklog loop. Mirrors
/// `/api/photographer/projects/:id` (detail bundles project + time entries +
/// galleries), `/milestones` (timeline) and the status/time mutations.
/// Tolerant decoding throughout.

struct ProjectDetail: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var title: String?
    var clientName: String?
    var clientEmail: String?
    var clientPhone: String?
    var description: String?
    var projectType: String?
    var status: String?
    var phase: String?
    var eventDate: String?
    var location: String?
    var servicePriceGross: Double
    var trackedHours: Double
    var trackedCost: Double
    var totalCost: Double
    var estimatedHours: Double?
    var marginPct: Double?
    var profitAmount: Double?

    private enum CodingKeys: String, CodingKey {
        case id, title, clientName, clientEmail, clientPhone, description
        case projectType, status, phase, eventDate, location
        case servicePriceGross, trackedHours, trackedCost, totalCost
        case estimatedHours, marginPct, profitAmount
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = c.firstString([.title])
        clientName = c.firstString([.clientName])
        clientEmail = c.firstString([.clientEmail])
        clientPhone = c.firstString([.clientPhone])
        description = c.firstString([.description])
        projectType = c.firstString([.projectType])
        status = c.firstString([.status])
        phase = c.firstString([.phase])
        eventDate = c.firstString([.eventDate])
        location = c.firstString([.location])
        servicePriceGross = c.firstDouble([.servicePriceGross]) ?? 0
        trackedHours = c.firstDouble([.trackedHours]) ?? 0
        trackedCost = c.firstDouble([.trackedCost]) ?? 0
        totalCost = c.firstDouble([.totalCost]) ?? 0
        estimatedHours = c.firstDouble([.estimatedHours])
        marginPct = c.firstDouble([.marginPct])
        profitAmount = c.firstDouble([.profitAmount])
    }
}

struct ProjectTimeEntry: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var taskDescription: String?
    var hoursSpent: Double
    var billableHours: Double
    var rate: Double
    var dateWorked: String?

    private enum CodingKeys: String, CodingKey {
        case id, taskDescription, hoursSpent, billableHours, rate, dateWorked
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // id may arrive as a number from some rows.
        if let s = try? c.decode(String.self, forKey: .id) { id = s }
        else if let n = try? c.decode(Int.self, forKey: .id) { id = String(n) }
        else { id = UUID().uuidString }
        taskDescription = c.firstString([.taskDescription])
        hoursSpent = c.firstDouble([.hoursSpent]) ?? 0
        billableHours = c.firstDouble([.billableHours]) ?? 0
        rate = c.firstDouble([.rate]) ?? 0
        dateWorked = c.firstString([.dateWorked])
    }
}

struct ProjectGalleryRef: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var title: String?
    var status: String?
}

struct ProjectDetailResponse: Codable, Sendable {
    let project: ProjectDetail
    var timeEntries: [ProjectTimeEntry]
    var galleries: [ProjectGalleryRef]

    private enum CodingKeys: String, CodingKey { case project, timeEntries, galleries }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        project = try c.decode(ProjectDetail.self, forKey: .project)
        timeEntries = (try? c.decodeIfPresent([ProjectTimeEntry].self, forKey: .timeEntries)) ?? []
        galleries = (try? c.decodeIfPresent([ProjectGalleryRef].self, forKey: .galleries)) ?? []
    }
}

struct ProjectMilestone: Codable, Sendable, Identifiable, Hashable {
    let id: String
    var title: String?
    var description: String?
    var status: String?
    var dueDate: String?
    var progress: Double
    var priority: String?

    private enum CodingKeys: String, CodingKey {
        case id, title, description, status, dueDate, progress, priority
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        if let s = try? c.decode(String.self, forKey: .id) { id = s }
        else if let n = try? c.decode(Int.self, forKey: .id) { id = String(n) }
        else { id = UUID().uuidString }
        title = c.firstString([.title])
        description = c.firstString([.description])
        status = c.firstString([.status])
        dueDate = c.firstString([.dueDate])
        progress = c.firstDouble([.progress]) ?? 0
        priority = c.firstString([.priority])
    }
}

struct ProjectMilestonesResponse: Codable, Sendable {
    var milestones: [ProjectMilestone]
    private enum CodingKeys: String, CodingKey { case milestones }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        milestones = (try? c.decodeIfPresent([ProjectMilestone].self, forKey: .milestones)) ?? []
    }
}

/// Canonical photographer project lifecycle — drives the native status stepper.
enum ProjectStatus: String, CaseIterable, Sendable {
    case lead, booked, shooting, editing, delivered

    var label: String {
        switch self {
        case .lead: return "Forespørsel"
        case .booked: return "Booket"
        case .shooting: return "Shooting"
        case .editing: return "Redigering"
        case .delivered: return "Levert"
        }
    }

    /// Map the backend's varied status strings into a stepper position.
    static func from(_ raw: String?) -> ProjectStatus? {
        switch (raw ?? "").lowercased() {
        case "lead", "inquiry", "new", "forespørsel": return .lead
        case "booked", "confirmed", "active", "booket": return .booked
        case "shooting", "in_progress", "shoot": return .shooting
        case "editing", "post", "culling", "redigering": return .editing
        case "delivered", "completed", "done", "levert": return .delivered
        default: return nil
        }
    }
}
