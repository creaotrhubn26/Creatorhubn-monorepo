// LeadgridMarketScanModels.swift
//
// Native Leadgrid Market Scan-modeller. Matcher backend
// /api/leadgrid/market-scan/* (se leadgrid-market-scan-routes.ts).
//
// Modellene er prefikset `Leadgrid…` for å unngå navne-konflikt med
// eksisterende `MarketScan*`-typer i SuperAdminFase22Models.swift, som
// peker på det eldre /api/market-scans-endepunktet.
//
// APIClient bruker JSONDecoder med .convertFromSnakeCase, så snake_case
// fra DB blir camelCase her automatisk.
//
// Backend-shape (referanse):
//   scan: {
//     id, name, phase, phase_message, status,
//     total_competitors, total_opportunities, leads_created_count,
//     started_at, completed_at, error_message,
//     region, industry, target_audience, goal,
//     auto_create_leads, target_org_id, created_at
//   }
//   competitor: { id, name, domain?, category?, confidence?, latitude?,
//                 longitude?, googlePlaceId?, googleAddress?, googlePhone?,
//                 googleRating? }
//   opportunity: { id, title, description?, estimatedImpact? }

import Foundation

// MARK: - Scan

struct LeadgridMarketScan: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    let industry: String?
    let region: String?
    let targetAudience: String?
    let goal: String?
    /// 'pending' | 'completed' | 'failed' | (m.fl. interne flagg fra DB).
    /// Vi rendrer chip ut fra `displayStatus` som mapper både `status` og
    /// `phase` til UI-modellen { draft | running | completed | failed }.
    let status: String
    /// Mer detaljert fase (pending / web_search / discovery /
    /// geocode_competitors / creating_leads / done / failed).
    let phase: String?
    /// Kort menneske-lesbar tekst som backend setter mens orchestrator
    /// kjører ("Plottet 14 pins på kartet" etc.).
    let phaseMessage: String?
    /// Backend har ingen confidenceSummary i denne tabellen — vi
    /// utleder en visuell signal i view-laget basert på phase + status.
    /// Feltet er bevart i modellen for fremtidig server-side beriking.
    let confidenceSummary: String?
    let totalCompetitors: Int
    let totalOpportunities: Int
    let leadsCreatedCount: Int
    let autoCreateLeads: Bool
    let startedAt: String?
    let completedAt: String?
    let errorMessage: String?
    let createdAt: String?

    /// UI-status: 'draft' | 'running' | 'completed' | 'failed'.
    /// Backend bruker både `status` ('pending'/'completed'/'failed') og
    /// `phase` ('done'/'failed'/...) — vi normaliserer her.
    var displayStatus: String {
        let s = status.lowercased()
        if s == "failed" { return "failed" }
        if s == "completed" || phase?.lowercased() == "done" {
            return "completed"
        }
        if s == "pending" || s == "running" {
            // Hvis phase er satt til noe annet enn 'pending'/'done' →
            // orchestrator jobber.
            return "running"
        }
        return "draft"
    }
}

enum LeadgridMarketScanStatusChip {
    case draft
    case running
    case completed
    case failed

    init(_ displayStatus: String) {
        switch displayStatus {
        case "running":   self = .running
        case "completed": self = .completed
        case "failed":    self = .failed
        default:          self = .draft
        }
    }

    var label: String {
        switch self {
        case .draft:     return "Utkast"
        case .running:   return "Pågår"
        case .completed: return "Ferdig"
        case .failed:    return "Feilet"
        }
    }

    var systemIcon: String {
        switch self {
        case .draft:     return "doc"
        case .running:   return "hourglass"
        case .completed: return "checkmark.circle.fill"
        case .failed:    return "exclamationmark.triangle.fill"
        }
    }
}

// MARK: - Competitor

struct LeadgridMarketScanCompetitor: Codable, Hashable, Identifiable {
    let id: String
    let name: String
    /// Backend kan returnere `domain` ELLER `websiteUrl` (etter
    /// convertFromSnakeCase mapping av `website_url`). Vi tilbyr begge
    /// felter slik at modellen tåler begge respons-former.
    let websiteUrl: String?
    let domain: String?
    let category: String?
    let confidence: String?
    // Valgfrie Places-felter (settes når backend geo-koder konkurrenten)
    let latitude: Double?
    let longitude: Double?
    let googlePlaceId: String?
    let googleAddress: String?
    let googlePhone: String?
    let googleRating: Double?

    /// Convenience: foretrekk eksplisitt websiteUrl, fall tilbake til
    /// domain. UI viser bare ÉN sti.
    var displayWebsite: String? {
        if let w = websiteUrl, !w.isEmpty { return w }
        if let d = domain, !d.isEmpty { return d }
        return nil
    }

    var hasCoordinates: Bool {
        latitude != nil && longitude != nil
    }
}

// MARK: - Opportunity

struct LeadgridMarketScanOpportunity: Codable, Hashable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let estimatedImpact: String?
}

// MARK: - Detail-bundle

/// Konstrueres i klient-laget ved å kombinere de tre endepunkt-svarene
/// (scan + competitors + opportunities). Backend har ingen samlet
/// endpoint per dags dato.
struct LeadgridMarketScanDetail: Hashable {
    let scan: LeadgridMarketScan
    let competitors: [LeadgridMarketScanCompetitor]
    let opportunities: [LeadgridMarketScanOpportunity]
}

// MARK: - Response envelopes

struct LeadgridMarketScanListResponse: Decodable {
    let scans: [LeadgridMarketScan]
}

struct LeadgridMarketScanProgressResponse: Decodable {
    let scan: LeadgridMarketScan
}

struct LeadgridMarketScanCompetitorsResponse: Decodable {
    let competitors: [LeadgridMarketScanCompetitor]
}

struct LeadgridMarketScanOpportunitiesResponse: Decodable {
    let opportunities: [LeadgridMarketScanOpportunity]
}

struct LeadgridMarketScanRunResponse: Decodable {
    let scanId: String
    let name: String
}

struct LeadgridMarketScanCreateLeadsResponse: Decodable {
    let createdCount: Int
}

// MARK: - Form-input

/// Input til POST /api/leadgrid/market-scan/run. Speiles til backend's
/// snake_case via APIClient.runLeadgridMarketScan(...).
struct RunLeadgridMarketScanInput: Hashable {
    /// Valgfri tittel — backend fyller inn "{industry} i {region}" hvis
    /// vi sender null/tom.
    var name: String
    var industry: String
    var region: String
    var targetAudience: String
    var goal: String
    var autoCreateLeads: Bool
    /// Hvis satt, scopes scan + auto-opprettede leads til denne org-en.
    var organizationId: String?

    static let empty = RunLeadgridMarketScanInput(
        name: "",
        industry: "",
        region: "",
        targetAudience: "",
        goal: "",
        autoCreateLeads: true,
        organizationId: nil,
    )

    var isValid: Bool {
        industry.trimmingCharacters(in: .whitespaces).count >= 2
            && region.trimmingCharacters(in: .whitespaces).count >= 2
    }
}
