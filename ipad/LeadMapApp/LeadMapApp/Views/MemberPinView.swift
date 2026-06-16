// MemberPinView.swift
//
// Live selger-pin på kartet. Sirkulær avatar + rolle-farget ring +
// grønn fresh-dot. Tap viser popover med navn/tittel/team.
// Speilet fra web LeadMapMemberPins.tsx (PR #612).

import SwiftUI

struct MemberPinView: View {
    let member: MemberLocation
    @State private var popoverShown = false

    private var roleColor: Color {
        switch member.role {
        case "admin": return Color(red: 0.75, green: 0.52, blue: 0.99)
        case "salgssjef": return Color(red: 0.97, green: 0.45, blue: 0.09)
        case "teamleder": return Color(red: 0.98, green: 0.75, blue: 0.14)
        case "salgskonsulent": return Color(red: 0.20, green: 0.85, blue: 0.60)
        case "promotor": return Color(red: 0.37, green: 0.65, blue: 0.98)
        default: return Color(red: 0.66, green: 0.55, blue: 0.98)
        }
    }

    var body: some View {
        Button {
            popoverShown.toggle()
        } label: {
            ZStack(alignment: .bottomTrailing) {
                AsyncImage(url: member.avatarUrl.flatMap(URL.init)) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFit()
                    default:
                        Text(String((member.displayName ?? "?").prefix(1)).uppercased())
                            .font(.callout).bold()
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                            .background(Color(white: 0.1))
                    }
                }
                .frame(width: 36, height: 36)
                .clipShape(Circle())
                .overlay(
                    Circle().stroke(roleColor, lineWidth: 3)
                        .shadow(color: roleColor.opacity(0.4), radius: 4)
                )

                if member.isFresh {
                    Circle()
                        .fill(Color(red: 0.20, green: 0.85, blue: 0.60))
                        .frame(width: 10, height: 10)
                        .overlay(Circle().stroke(Color.black, lineWidth: 2))
                }
            }
        }
        .buttonStyle(.plain)
        .popover(isPresented: $popoverShown, arrowEdge: .top) {
            popoverContent
                .padding()
                .presentationCompactAdaptation(.popover)
        }
        .accessibilityLabel("\(member.displayName ?? member.role), \(member.isFresh ? "online" : "offline")")
    }

    private var popoverContent: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                AsyncImage(url: member.avatarUrl.flatMap(URL.init)) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFit()
                    default: Image(systemName: "person.circle").foregroundStyle(.secondary)
                    }
                }
                .frame(width: 36, height: 36)
                .clipShape(Circle())
                VStack(alignment: .leading) {
                    Text(member.displayName ?? member.userId).font(.headline)
                    Text(member.title ?? member.role).font(.caption).foregroundStyle(.secondary)
                }
            }
            if let team = member.teamName {
                Label(team, systemImage: "person.3.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 4) {
                Image(systemName: "circle.fill")
                    .font(.caption2)
                    .foregroundStyle(member.isFresh ? Color(red: 0.20, green: 0.85, blue: 0.60) : .gray)
                Text(activityLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let acc = member.accuracyM {
                Text("Presisjon ±\(Int(acc)) m")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(minWidth: 200, alignment: .leading)
    }

    private var activityLabel: String {
        switch member.activity {
        case "visit": return "På besøk"
        case "driving": return "Underveis"
        case "event": return "På event"
        default: return member.isFresh ? "Tilgjengelig" : "Offline"
        }
    }
}
