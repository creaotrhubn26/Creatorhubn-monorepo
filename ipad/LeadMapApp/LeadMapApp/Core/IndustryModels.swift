// IndustryModels.swift
//
// Codable for industries-systemet (mig 329). Bransje-katalog +
// medlems-spesialiseringer + auto-routing.
//
// Backend sender camelCase via JSONDecoder.convertFromSnakeCase, så
// vi skriver feltene i camelCase her.

import Foundation
import SwiftUI

/// En bransje i katalogen. `scope='global'` er NACE/sentral, `scope='custom'`
/// er org-spesifikk og kan administreres av admins i org'en.
struct Industry: Identifiable, Codable, Hashable, Sendable {
    let id: String
    let code: String
    let nameNo: String
    let nameEn: String?
    let parentId: String?
    let icon: String?
    let colorHex: String?
    let scope: String          // "global" | "custom"
    let organizationId: String?
    let isActive: Bool
    let displayOrder: Int
    let createdAt: String?
    let updatedAt: String?

    var isCustom: Bool { scope == "custom" }
    var displayName: String { nameNo }

    /// Parse colorHex → Color. Default lilla (Leadgrid brand).
    var color: Color {
        guard let hex = colorHex, hex.hasPrefix("#"), hex.count == 7 else {
            return Color(red: 0.58, green: 0.20, blue: 0.92) // #9333ea
        }
        let scanner = Scanner(string: String(hex.dropFirst()))
        var value: UInt64 = 0
        guard scanner.scanHexInt64(&value) else {
            return Color(red: 0.58, green: 0.20, blue: 0.92)
        }
        let r = Double((value >> 16) & 0xFF) / 255.0
        let g = Double((value >> 8) & 0xFF) / 255.0
        let b = Double(value & 0xFF) / 255.0
        return Color(red: r, green: g, blue: b)
    }

    /// Hvis icon ikke er en SF Symbol (f.eks. emoji), bruk fallback.
    /// Konvensjon: alle våre seedede icons er SF Symbols, men UI'et må
    /// være defensiv.
    var sfSymbol: String { icon ?? "tag.fill" }
}

/// Et medlems spesialisering (sales-rep × bransje × expertise).
struct MemberIndustry: Codable, Hashable, Sendable, Identifiable {
    let organizationId: String
    let userId: String
    let industryId: String
    let expertiseLevel: String   // "general" | "specialist" | "expert"
    let isPrimary: Bool
    let notes: String?
    let createdAt: String?
    let updatedAt: String?

    var id: String { "\(organizationId)-\(userId)-\(industryId)" }
}

enum ExpertiseLevel: String, CaseIterable, Codable, Sendable {
    case general
    case specialist
    case expert

    var labelNo: String {
        switch self {
        case .general: return "Generelt"
        case .specialist: return "Spesialist"
        case .expert: return "Ekspert"
        }
    }

    var sortOrder: Int {
        switch self {
        case .expert: return 0
        case .specialist: return 1
        case .general: return 2
        }
    }
}

// MARK: - API-konvolutter

struct IndustriesResponse: Codable, Sendable {
    let industries: [Industry]
}

struct IndustryResponse: Codable, Sendable {
    let industry: Industry
}

struct MemberIndustriesResponse: Codable, Sendable {
    let memberIndustries: [MemberIndustry]
}

// MARK: - Helpers

extension Array where Element == Industry {
    /// Gruppér flat liste i hierarki — returnerer top-level + children-map.
    func hierarchical() -> (roots: [Industry], childrenByParent: [String: [Industry]]) {
        var byParent: [String: [Industry]] = [:]
        var roots: [Industry] = []
        for ind in self where ind.isActive {
            if let pid = ind.parentId {
                byParent[pid, default: []].append(ind)
            } else {
                roots.append(ind)
            }
        }
        for key in byParent.keys {
            byParent[key]?.sort { $0.displayOrder < $1.displayOrder || $0.nameNo < $1.nameNo }
        }
        roots.sort {
            if $0.scope != $1.scope {
                return $0.scope == "global"  // global først, custom etter
            }
            return $0.displayOrder < $1.displayOrder || $0.nameNo < $1.nameNo
        }
        return (roots, byParent)
    }
}
