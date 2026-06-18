// MeetingBriefModel.swift
//
// Meeting-brief fra Claude — kort forberedelse-readout før selger
// går inn til kunden.

import Foundation

struct MeetingBrief: Decodable, Sendable {
    let headline: String
    let key_status: String
    let warnings: [String]
    let talking_points: [String]
    let questions_to_ask: [String]
    let progress_tips: [String]
    // Utvidelser (PR #642): BRREG/Proff + kontrakt + tilnærming
    let company_profile: CompanyProfile?
    let strategic_value: String?
    let contract_recommendations: [ContractRecommendation]?
    let personal_approach: String?

    struct CompanyProfile: Decodable, Sendable {
        let founded_year: Int?
        let age_label: String?
        let financial_health: String?
        let key_facts: [String]?

        var ageColor: String {
            switch age_label {
            case "fersk": return "fbbf24"           // gul — risk
            case "voksende": return "60a5fa"        // blå — momentum
            case "etablert": return "34d399"        // grønn — trygg
            case "moden": return "c084fc"           // lilla — stor
            default: return "9ca3af"
            }
        }

        var financialColor: String {
            switch financial_health {
            case "sterk": return "34d399"
            case "stabil": return "60a5fa"
            case "svak": return "f87171"
            default: return "9ca3af"
            }
        }
    }

    struct ContractRecommendation: Decodable, Sendable, Identifiable {
        let type: String
        let reason: String
        let fit_score: Int

        var id: String { type }
        var fitColor: String {
            if fit_score >= 80 { return "34d399" }
            if fit_score >= 60 { return "60a5fa" }
            if fit_score >= 40 { return "fbbf24" }
            return "f87171"
        }
    }

    let pitch_deck_suggestion: PitchDeckSuggestion?

    struct PitchDeckSuggestion: Decodable, Sendable {
        let recommended_slides: [RecommendedSlide]?
        let skip_slides: [String]?
        let key_proof_points: [String]?

        struct RecommendedSlide: Decodable, Sendable, Identifiable {
            let title: String
            let rationale: String
            var id: String { title }
        }
    }
}
