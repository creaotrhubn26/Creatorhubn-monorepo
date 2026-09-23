// PromptHaptics.swift
//
// Én inngang for haptikk fra de interaktive innslagene (spørsmål underveis),
// bygd på SwiftUI `.sensoryFeedback` (iOS 17). Samles her så en felles
// «Vibrasjon»-innstilling kan kobles på ett sted senere.

import SwiftUI

extension View {
    /// Spiller `feedback` hver gang `trigger` endres.
    func promptHaptic<T: Equatable>(_ feedback: SensoryFeedback, trigger: T) -> some View {
        sensoryFeedback(feedback, trigger: trigger)
    }
}
