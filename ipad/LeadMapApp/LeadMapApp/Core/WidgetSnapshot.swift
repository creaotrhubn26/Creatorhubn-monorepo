// WidgetSnapshot.swift
//
// Codable struct som speil-rendering av Lead Map-state i widget'en.
// Hovedappen skriver til delt App Group container etter hver refreshAll;
// widget'ens TimelineProvider leser samme fil.
//
// Vi unngår å dele hele LeadModel/RemindersResponse for å holde
// payload liten og widget-compile rask.

import Foundation

public struct WidgetSnapshot: Codable {
    public let activeProjectName: String?
    public let totalLeads: Int
    public let followUpsDue: Int
    public let meetingsBooked: Int
    public let staleOver30: Int
    public let staleOver14: Int
    public let staleOver7: Int
    public let dueToday: [DueItem]
    public let writtenAt: Date

    public struct DueItem: Codable, Hashable {
        public let leadName: String
        public let datetime: Date?
        public let nextAction: String?
    }

    public init(
        activeProjectName: String?,
        totalLeads: Int,
        followUpsDue: Int,
        meetingsBooked: Int,
        staleOver30: Int,
        staleOver14: Int,
        staleOver7: Int,
        dueToday: [DueItem],
        writtenAt: Date
    ) {
        self.activeProjectName = activeProjectName
        self.totalLeads = totalLeads
        self.followUpsDue = followUpsDue
        self.meetingsBooked = meetingsBooked
        self.staleOver30 = staleOver30
        self.staleOver14 = staleOver14
        self.staleOver7 = staleOver7
        self.dueToday = dueToday
        self.writtenAt = writtenAt
    }

    public static var empty: WidgetSnapshot {
        WidgetSnapshot(
            activeProjectName: nil,
            totalLeads: 0,
            followUpsDue: 0,
            meetingsBooked: 0,
            staleOver30: 0,
            staleOver14: 0,
            staleOver7: 0,
            dueToday: [],
            writtenAt: Date()
        )
    }
}

/// Felles read/write-logikk for App Group container. Brukes både fra
/// hovedappen (skriving) og widget-extension (lesing).
public enum WidgetSnapshotStore {
    public static let appGroupId = "group.com.creatorhubn.LeadMapApp"
    private static let fileName = "widget-snapshot.json"

    /// URL til shared container. Returnerer nil i debug-miljøer hvor
    /// App Group ikke er konfigurert.
    public static var fileURL: URL? {
        guard let container = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroupId)
        else { return nil }
        return container.appendingPathComponent(fileName)
    }

    public static func write(_ snapshot: WidgetSnapshot) {
        guard let url = fileURL else { return }
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            let data = try encoder.encode(snapshot)
            try data.write(to: url, options: .atomic)
        } catch {
            print("[WidgetSnapshotStore] write failed: \(error)")
        }
    }

    public static func read() -> WidgetSnapshot? {
        guard let url = fileURL,
              let data = try? Data(contentsOf: url)
        else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(WidgetSnapshot.self, from: data)
    }
}
