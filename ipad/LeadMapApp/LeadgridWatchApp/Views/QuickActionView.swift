// QuickActionView.swift
//
// Detail-view: vis lead-info + 4 quick-action-knapper. Tap sender
// action via PhoneSession.sendQuickAction → iPhone POSTer til backend.

import SwiftUI
import WatchKit

struct QuickActionView: View {
    let lead: WatchLead
    @EnvironmentObject private var session: PhoneSession
    @Environment(\.dismiss) private var dismiss

    @State private var lastAction: LeadQuickAction?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text(lead.name)
                    .font(.headline)
                    .lineLimit(2)
                if let addr = lead.address {
                    Text(addr)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }

                Divider().padding(.vertical, 4)

                ForEach(LeadQuickAction.allCases, id: \.self) { action in
                    Button {
                        session.sendQuickAction(action, for: lead)
                        lastAction = action
                        // Liten haptisk + auto-dismiss
                        WKInterfaceDevice.current().play(.success)
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                            dismiss()
                        }
                    } label: {
                        HStack {
                            Image(systemName: action.icon)
                            Text(action.label)
                            Spacer()
                            if lastAction == action {
                                Image(systemName: "checkmark")
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(tint(for: action))
                }
            }
            .padding(.horizontal, 4)
        }
    }

    private func tint(for action: LeadQuickAction) -> Color {
        switch action {
        case .visited: return .green
        case .called: return .blue
        case .meetingBooked: return .purple
        case .notInterested: return .red
        }
    }
}

