// TranscriptAnalysisModel.swift
//
// Speilet fra backend lead-map-transcript-routes.ts. Claude parser
// visit-dikteringen og foreslår actions: erstatt 'kunden' med navn,
// finn follow-up-dato, foreslå kalender-event, vurder sentiment.

import Foundation

struct TranscriptAnalysis: Decodable, Sendable {
    let resolved_text: String
    let action_items: [String]
    let follow_up_date: String?
    let calendar_suggestion: CalendarSuggestion?
    let sentiment: String

    struct CalendarSuggestion: Decodable, Sendable {
        let title: String
        let date: String
        let notes: String?
    }

    var followUpDate: Date? {
        guard let s = follow_up_date else { return nil }
        // Backend returnerer YYYY-MM-DD; konverter til lokal kl 09:00
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        if let d = formatter.date(from: s) {
            var comp = Calendar.current.dateComponents([.year, .month, .day], from: d)
            comp.hour = 9
            return Calendar.current.date(from: comp)
        }
        return nil
    }

    var calendarDate: Date? {
        guard let s = calendar_suggestion?.date else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withFullDate]
        return f.date(from: s)
    }

    var sentimentColor: String {
        switch sentiment {
        case "positiv": return "34d399"
        case "negativ": return "f87171"
        default: return "9ca3af"
        }
    }
}
