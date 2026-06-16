// CompetitorPin.swift
//
// Diamant-pin for konkurrenter — speilbilde av web-versjonen.

import SwiftUI

struct CompetitorPin: View {
    let threat: ThreatLevel?
    let selected: Bool

    var body: some View {
        ZStack {
            Diamond()
                .fill(color)
                .stroke(.black, lineWidth: 1.2)
                .shadow(color: .black.opacity(0.45), radius: 2, x: 0, y: 1)
                .frame(width: selected ? 28 : 24, height: selected ? 28 : 24)
            Image(systemName: "star.fill")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(.white)
            if selected {
                Circle()
                    .stroke(Color.yellow.opacity(0.85), lineWidth: 1.6)
                    .frame(width: 32, height: 32)
            }
        }
    }

    private var color: Color {
        switch threat {
        case .near: return Color(red: 0.937, green: 0.267, blue: 0.267)   // #ef4444
        case .medium: return Color(red: 0.961, green: 0.620, blue: 0.043) // #f59e0b
        case .far: return Color(red: 0.580, green: 0.639, blue: 0.722)    // #94a3b8
        case .none: return Color(red: 0.278, green: 0.333, blue: 0.412)   // #475569
        }
    }
}

private struct Diamond: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        p.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
        p.closeSubpath()
        return p
    }
}
