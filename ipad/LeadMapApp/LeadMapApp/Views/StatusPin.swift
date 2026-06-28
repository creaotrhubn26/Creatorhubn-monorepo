// StatusPin.swift
//
// SwiftUI-versjon av web-droppin-pinen. Match-farger med
// frontend/client STATUS_META.

import SwiftUI

struct StatusPin: View {
    let status: LeadStatus
    let selected: Bool

    var body: some View {
        ZStack {
            // Droppin-shape (sirkel + spiss nedover)
            DropPinShape()
                .fill(color)
                .stroke(.black, lineWidth: 1.2)
                .shadow(color: .black.opacity(0.45), radius: 2, x: 0, y: 1)
                .frame(width: selected ? 34 : 28, height: selected ? 44 : 36)
            // Hvit innvendig ikon
            Image(systemName: iconName)
                .font(.system(size: selected ? 12 : 10, weight: .bold))
                .foregroundStyle(.white)
                .offset(y: selected ? -8 : -6)
            if selected {
                Circle()
                    .stroke(Color.yellow.opacity(0.85), lineWidth: 1.6)
                    .frame(width: 26, height: 26)
                    .offset(y: -8)
            }
        }
    }

    private var color: Color {
        switch status {
        case .unvisited: return Color(red: 0.376, green: 0.647, blue: 0.980)   // #60a5fa
        case .visited: return Color(red: 0.797, green: 0.835, blue: 0.882)
        case .return: return Color(red: 0.984, green: 0.749, blue: 0.141)      // #fbbf24
        case .notPresent: return Color(red: 0.580, green: 0.639, blue: 0.722)
        case .declined: return Color(red: 0.972, green: 0.443, blue: 0.443)    // #f87171
        case .interested: return Color(red: 0.203, green: 0.827, blue: 0.600)  // #34d399
        case .meetingBooked: return Color(red: 0.654, green: 0.545, blue: 0.980) // #a78bfa
        case .proposalSent: return Color(red: 0.984, green: 0.572, blue: 0.235)
        case .won: return Color(red: 0.992, green: 0.878, blue: 0.278)         // #fde047
        case .lost: return Color(red: 0.498, green: 0.114, blue: 0.114)
        case .doNotContact: return Color(red: 0.118, green: 0.161, blue: 0.231)
        }
    }

    private var iconName: String {
        switch status {
        case .interested: return "heart.fill"
        case .won: return "star.fill"
        case .declined: return "xmark"
        case .return: return "arrow.clockwise"
        case .meetingBooked: return "calendar"
        case .proposalSent: return "doc.text"
        case .notPresent: return "minus"
        case .doNotContact: return "nosign"
        default: return "circle.fill"
        }
    }
}

private struct LegacyStatusPinShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        let r = rect.width / 2
        p.addArc(center: CGPoint(x: rect.midX, y: r), radius: r, startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.closeSubpath()
        return p
    }
}
