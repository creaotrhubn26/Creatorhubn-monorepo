import SwiftUI
import UIKit

/// Fargepalett — Role Room-merket.
enum Theme {
    /// Role Room Lilla (#a030c0) — brukt som aksentfarge i hele appen.
    static let accent = Color(red: 0.63, green: 0.19, blue: 0.75)

    /// Klassisk klaffebrett-gul for TAKE-feltet når klaffen er lukket.
    static let takeHighlight = Color(red: 1.0, green: 0.85, blue: 0.20)

    /// Håndskrevet font — kursiv tusj som skrevet på en ekte klaff.
    /// Fallback-kjede garanterer ekte håndskrift uansett enhet.
    static func handwritten(_ size: CGFloat, preferBold: Bool = false) -> Font {
        let candidates = preferBold
            ? ["BradleyHandITCTT-Bold", "MarkerFelt-Wide", "ChalkboardSE-Bold"]
            : ["BradleyHandITCTT-Bold", "MarkerFelt-Thin", "ChalkboardSE-Regular"]
        let name = candidates.first { UIFont(name: $0, size: size) != nil }
            ?? "MarkerFelt-Thin"
        return .custom(name, size: size)
    }
}

/// Lukker tastaturet (brukes fra TextField onSubmit).
@MainActor
func dismissKeyboard() {
    UIApplication.shared.sendAction(
        #selector(UIResponder.resignFirstResponder),
        to: nil,
        from: nil,
        for: nil
    )
}
