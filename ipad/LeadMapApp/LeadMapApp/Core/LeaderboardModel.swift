// LeaderboardModel.swift
//
// Team-leaderboard — speilet fra web PR #620.
//
//   GET /organizations/:id/leaderboard?period=&team_id=&sort=
//   GET /organizations/:id/leaderboard-summary?period=

import Foundation

enum LeaderboardPeriod: String, CaseIterable, Identifiable {
    case thisMonth = "this_month"
    case last30d = "last_30d"
    case ytd = "ytd"

    var id: String { rawValue }
    var label: String {
        switch self {
        case .thisMonth: return "Denne mnd"
        case .last30d: return "Siste 30 d"
        case .ytd: return "I år"
        }
    }
}

enum LeaderboardSort: String, CaseIterable, Identifiable {
    case progress, achieved, won, meetings

    var id: String { rawValue }
    var label: String {
        switch self {
        case .progress: return "Kvote-progresjon"
        case .achieved: return "Omsetning"
        case .won: return "Antall vunnet"
        case .meetings: return "Antall møter"
        }
    }
}

struct LeaderboardEntry: Identifiable, Decodable {
    let rank: Int
    let userId: String
    let displayName: String?
    let email: String?
    let avatarUrl: String?
    let title: String?
    let role: String
    let salesTeamId: String?
    let teamName: String?
    let territory: String?
    let targetNok: Double
    let achievedNok: Double
    let wonCount: Int
    let lostCount: Int
    let meetingsCount: Int
    let leadsAssigned: Int
    let leadsActive: Int
    let progressPct: Int?
    let closeRate: Int?

    var id: String { userId }

    /// Returnerer medalje-farge for top 3 (gull/sølv/bronse).
    var medalHex: String? {
        switch rank {
        case 1: return "fbbf24"
        case 2: return "cbd5e1"
        case 3: return "d97706"
        default: return nil
        }
    }
}

struct LeaderboardResponse: Decodable {
    let leaderboard: [LeaderboardEntry]
    let period: String
    let teamFilter: String?
    let sortBy: String
}

struct LeaderboardSummary: Decodable {
    let period: String
    let totalTargetNok: Double
    let totalAchievedNok: Double
    let progressPct: Int?
    let totalWon: Int
    let totalLost: Int
    let totalMeetings: Int
    let activeSellers: Int
    let closeRate: Int?
}
