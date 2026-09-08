// LeadgridProfileAvatar.swift
// Felles serverdrevet avatar med initialer som feil-/tom-fallback.

import SwiftUI

struct LeadgridProfileAvatar: View {
    let imageURL: URL?
    let initials: String
    var size: CGFloat = 44
    var tint: Color = Color(red: 0.75, green: 0.45, blue: 1.0)

    var body: some View {
        ZStack {
            Circle().fill(tint.opacity(0.22))
            initialsView
            if let imageURL {
                AsyncImage(url: imageURL, transaction: Transaction(animation: .easeInOut(duration: 0.2))) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    default:
                        Color.clear
                    }
                }
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().stroke(Color.white.opacity(0.12), lineWidth: 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Profilbilde for \(initials)")
    }

    private var initialsView: some View {
        Text(initials.isEmpty ? "?" : initials)
            .font(.appScaled(size: max(11, size * 0.31), weight: .bold, design: .rounded))
            .foregroundStyle(tint)
            .minimumScaleFactor(0.7)
    }
}
