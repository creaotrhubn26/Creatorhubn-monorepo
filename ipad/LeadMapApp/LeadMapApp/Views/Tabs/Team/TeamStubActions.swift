// TeamStubActions.swift — helper for stubbed team-actions (Pakke 10.1, 2026-07-01).
//
// Alle «Eksporter CSV / Send rapport / Sammenlign / Marker som lest»-menyer
// venter på backend-integrasjon (CSV-generator, PDF-eksport, Slack-webhook).
// Denne helperen gir dem en synlig respons uten å bygge hele exporter-pipen.
//
// UI-mønster: NotificationCenter → root-overlay-toast i TeamView.

import SwiftUI

enum TeamStubActions {
    /// Vis toast med action-navn. Bruker NotificationCenter så vi ikke må
    /// dra @State gjennom alle sub-modaler.
    static func toast(_ actionName: String) {
        NotificationCenter.default.post(
            name: .teamStubActionTriggered,
            object: nil,
            userInfo: ["action": actionName, "state": "info"]
        )
    }

    /// Pakke 10.1 (Daniel-feedback): all backend-actions går gjennom feature-matrix.
    /// Sjekker EntitlementStore FØRST — hvis brukeren har tilgang, kjør block;
    /// hvis låst, vis upsell-hint. SuperAdmin styrer state per organisasjon.
    @MainActor
    static func performGated(
        _ feature: LeadgridFeature,
        actionName: String,
        block: @escaping () -> Void = {}
    ) {
        let store = EntitlementStore.shared
        if store.canUse(feature) {
            // Trigger backend-action (mock: bare toast)
            let stateLabel: String
            switch store.access(feature) {
            case .included: stateLabel = "utført"
            case .trial: stateLabel = "utført (trial)"
            case .addOn: stateLabel = "utført (addon)"
            case .locked: stateLabel = "låst"  // shouldn't reach
            }
            NotificationCenter.default.post(
                name: .teamStubActionTriggered,
                object: nil,
                userInfo: [
                    "action": "\(actionName) — \(stateLabel)",
                    "state": "success",
                    "feature": feature.rawValue
                ]
            )
            block()
        } else {
            // Låst — vis upsell-hint
            NotificationCenter.default.post(
                name: .teamStubActionTriggered,
                object: nil,
                userInfo: [
                    "action": "🔒 \(actionName) — ikke i din plan",
                    "state": "locked",
                    "feature": feature.rawValue
                ]
            )
        }
    }
}

extension Notification.Name {
    static let teamStubActionTriggered = Notification.Name("team.stub.action.triggered")
}

// MARK: - TeamStubToastOverlay

/// Mount som overlay på TeamView (eller hvor du vil vise toast). Lytter på
/// notifikasjonen fra alle stubbede team-actions.
struct TeamStubToastOverlay: View {
    @State private var toast: String?
    @State private var state: String = "info"

    private var toastColor: Color {
        switch state {
        case "success": return Color(red: 0.20, green: 0.85, blue: 0.60)  // green
        case "locked":  return Color(red: 0.95, green: 0.20, blue: 0.20)  // red
        default:        return Color(red: 0.66, green: 0.32, blue: 0.99)  // purple
        }
    }

    private var toastIcon: String {
        switch state {
        case "success": return "checkmark.circle.fill"
        case "locked":  return "lock.fill"
        default:        return "hammer.circle.fill"
        }
    }

    var body: some View {
        VStack {
            if let t = toast {
                Label(t, systemImage: toastIcon)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(toastColor.opacity(0.95), in: Capsule())
                    .shadow(color: .black.opacity(0.5), radius: 8, y: 3)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
            Spacer()
        }
        .padding(.top, 8)
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
        .onReceive(NotificationCenter.default.publisher(for: .teamStubActionTriggered)) { note in
            guard let action = note.userInfo?["action"] as? String else { return }
            state = (note.userInfo?["state"] as? String) ?? "info"
            toast = action
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.4) {
                if toast == action { toast = nil }
            }
        }
    }
}
