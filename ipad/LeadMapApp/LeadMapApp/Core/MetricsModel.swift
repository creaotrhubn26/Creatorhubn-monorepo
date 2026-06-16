// MetricsModel.swift

import Foundation

struct MetricsTrends: Codable, Hashable {
    let totalLeads: Double?
    let followUpsDue: Double?
    let meetingsBooked: Double?
    let conversionRate: Double?
}

struct MetricsSparklines: Codable, Hashable {
    let totalLeads: [Int]?
    let followUpsDue: [Int]?
    let meetingsBooked: [Int]?
    let conversionRate: [Int]?
}

struct MetricsModel: Codable, Hashable {
    let totalLeads: Int
    let followUpsDue: Int
    let meetingsBooked: Int
    let conversionRate: Int
    let statusCounts: [String: Int]
    let trends: MetricsTrends?
    let sparklines: MetricsSparklines?
}

struct CalendarEvent: Identifiable, Codable, Hashable {
    let id: String
    let leadName: String
    let status: String
    let datetime: Date?
    let nextAction: String?
    let city: String?
    let phone: String?
    let email: String?
    let assignedUserName: String?
    let eventType: String // "meeting" eller "follow_up"
}

struct RemindersBuckets: Codable, Hashable {
    let over30days: Int
    let over14days: Int
    let over7days: Int
}

struct StaleLead: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let status: String
    let city: String?
    let daysSilent: Int
    let updatedAt: String
}

struct DueLead: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let datetime: String
    let nextAction: String?
}

struct RemindersResponse: Codable, Hashable {
    let staleLeads: [StaleLead]
    let buckets: RemindersBuckets
    let dueToday: [DueLead]
    let totalStale: Int
}
