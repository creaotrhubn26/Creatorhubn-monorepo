import SwiftUI
import Foundation
import Observation

struct OvLead: Identifiable, Hashable {
    let id: String
    let name: String
    let company: String?
    let latitude: Double
    let longitude: Double
    let leadScore: Int?
    let status: LeadStatus
    let estimatedValue: Double?
    let nextFollowUpAt: Date?
    let createdAt: Date

    enum LeadStatus: String {
        case unvisited, visited, `return`, meetingBooked, proposalSent, interested, won, lost, declined, notPresent, doNotContact
        var label: String {
            switch self {
            case .unvisited: return "Ikke besøkt"
            case .visited: return "Besøkt"
            case .return: return "Return"
            case .meetingBooked: return "Møte booket"
            case .proposalSent: return "Tilbud sendt"
            case .interested: return "Interessert"
            case .won: return "Vunnet"
            case .lost: return "Tapt"
            case .declined: return "Avslått"
            case .notPresent: return "Ikke til stede"
            case .doNotContact: return "Ikke kontakt"
            }
        }
    }
}

@Observable
final class OversiktDemoState {
    var leads: [OvLead] = []
    var userEmail: String? = "lars.kristensen@leadgrid.no"
    var api: Any? = nil
}

extension OversiktDemoState {
    static var preview: OversiktDemoState {
        let s = OversiktDemoState()
        // Generate 1248 leads matching mockup expectations
        var leads: [OvLead] = []
        let cal = Calendar.current
        let now = Date()
        struct Sample {
            let name: String
            let score: Int
            let value: Double
            let status: OvLead.LeadStatus
            let offset: Int?
        }
        let sampleNames: [Sample] = [
            Sample(name: "Nordic Elektro AS",   score: 92, value: 350_000, status: .meetingBooked, offset: 0),
            Sample(name: "Byggmester Hansen AS", score: 78, value: 220_000, status: .return, offset: 1800),
            Sample(name: "Energi & Miljø AS",   score: 78, value: 180_000, status: .interested, offset: 3600),
            Sample(name: "Oslo Tech AS",         score: 65, value: 160_000, status: .return, offset: 86400),
            Sample(name: "Veggbilder AS",        score: 87, value: 200_000, status: .interested, offset: 7200),
            Sample(name: "Vesuvio Pizzeria",     score: 81, value: 75_000, status: .visited, offset: 10800),
            Sample(name: "Holy Crust AS",        score: 90, value: 240_000, status: .meetingBooked, offset: 14400),
            Sample(name: "MedSide Helse",        score: 62, value: 90_000, status: .unvisited, offset: nil),
            Sample(name: "Talkit AS",            score: 73, value: 150_000, status: .unvisited, offset: nil),
        ]
        for (i, sample) in sampleNames.enumerated() {
            let nextFollowUp: Date? = sample.offset.map { now.addingTimeInterval(TimeInterval($0)) }
            leads.append(OvLead(
                id: "lead-\(i)",
                name: sample.name, company: nil,
                latitude: 59.91 + Double(i) * 0.005,
                longitude: 10.74 + Double(i) * 0.008,
                leadScore: sample.score,
                status: sample.status,
                estimatedValue: sample.value,
                nextFollowUpAt: nextFollowUp,
                createdAt: cal.date(byAdding: .day, value: -i, to: now) ?? now
            ))
        }
        // Pad til 1248 leads total (matching KPI-mockup)
        for i in 9..<1248 {
            let scoreBuckets = [25, 45, 55, 65, 75, 85, 95]
            let bucket = scoreBuckets[i % scoreBuckets.count]
            let statuses: [OvLead.LeadStatus] = [.unvisited, .visited, .interested, .meetingBooked, .won, .declined]
            let st = statuses[i % statuses.count]
            leads.append(OvLead(
                id: "lead-\(i)",
                name: "Bedrift \(i)", company: nil,
                latitude: 59.85 + Double(i % 30) * 0.005,
                longitude: 10.65 + Double(i % 40) * 0.005,
                leadScore: bucket,
                status: st,
                estimatedValue: Double(20_000 + (i % 50) * 1500),
                nextFollowUpAt: i < 25 ? cal.date(byAdding: .hour, value: i, to: now) : nil,
                createdAt: cal.date(byAdding: .day, value: -(i % 30), to: now) ?? now
            ))
        }
        s.leads = leads
        return s
    }
}

// MARK: - Re-eksport av OvDropPin/OvGlowHalo for preview-app
// (Faktiske typene bor i LeadPinView.swift i prod-appen — i preview
// trenger vi lokal kopi siden vi ikke kompilerer hele iPad-targeten.)

struct OvDropPin: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let w = rect.width, h = rect.height, r = w / 2
        p.addArc(center: CGPoint(x: w/2, y: r), radius: r,
                 startAngle: .degrees(180), endAngle: .degrees(360), clockwise: false)
        p.addQuadCurve(to: CGPoint(x: w/2, y: h),
                       control: CGPoint(x: w * 0.85, y: h * 0.65))
        p.addQuadCurve(to: CGPoint(x: 0, y: r),
                       control: CGPoint(x: w * 0.15, y: h * 0.65))
        p.closeSubpath()
        return p
    }
}

struct OvGlowHalo: View {
    let color: Color
    var body: some View {
        ZStack {
            Circle().fill(RadialGradient(colors: [color.opacity(0.55), color.opacity(0.0)],
                center: .center, startRadius: 18, endRadius: 48))
                .frame(width: 96, height: 96).blur(radius: 6)
            Circle().fill(RadialGradient(colors: [color.opacity(0.85), color.opacity(0.1)],
                center: .center, startRadius: 8, endRadius: 28))
                .frame(width: 56, height: 56).blur(radius: 2)
        }
        .allowsHitTesting(false)
    }
}
