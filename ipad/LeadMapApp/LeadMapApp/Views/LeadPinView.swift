// LeadPinView.swift
//
// Sirkulær pin med bedrifts-logo hvis tilgjengelig, ellers status-
// farget StatusPin (eksisterende). Speilet fra web makePinIcon-logo-
// varianten (PR #612).

import SwiftUI

struct LeadPinView: View {
    let lead: LeadModel
    let selected: Bool

    private var statusColor: Color {
        switch lead.status {
        case .won, .interested: return Color(red: 0.20, green: 0.85, blue: 0.60)
        case .lost, .declined: return Color(red: 0.97, green: 0.44, blue: 0.44)
        case .meetingBooked: return Color(red: 0.37, green: 0.65, blue: 0.98)
        case .proposalSent: return Color(red: 0.75, green: 0.52, blue: 0.99)
        case .return: return Color(red: 0.98, green: 0.75, blue: 0.14)
        default: return Color.gray
        }
    }

    var body: some View {
        if let logoUrl = lead.logoUrl, let url = URL(string: logoUrl) {
            logoVariant(url: url)
        } else {
            StatusPin(status: lead.status, selected: selected)
        }
    }

    @ViewBuilder
    private func logoVariant(url: URL) -> some View {
        let size: CGFloat = selected ? 44 : 38
        VStack(spacing: 0) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let img):
                    img.resizable().scaledToFit()
                case .failure:
                    StatusPin(status: lead.status, selected: selected)
                default:
                    ProgressView().controlSize(.mini)
                }
            }
            .frame(width: size - 8, height: size - 8)
            .background(Color.white)
            .clipShape(Circle())
            .overlay(Circle().stroke(statusColor, lineWidth: selected ? 4 : 3))
            .shadow(radius: 2)
            // Droppin-hale
            Triangle()
                .fill(statusColor)
                .frame(width: 10, height: 8)
                .offset(y: -2)
        }
    }
}

private struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        p.closeSubpath()
        return p
    }
}
