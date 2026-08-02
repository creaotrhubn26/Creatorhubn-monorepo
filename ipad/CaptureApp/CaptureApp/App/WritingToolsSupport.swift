// WritingToolsSupport.swift
//
// Tynn iOS 18-gated helper for Apple Writing Tools på tekstfelt. `.complete`
// skrur på hele panelet (omskriv/oppsummer/korrektur) på prosafelt; `.disabled`
// slår det av på ikke-prosa (e-post/UUID/token). No-op på iOS 17.

import SwiftUI

enum AppWritingToolsMode {
    case complete
    case disabled
}

extension View {
    @ViewBuilder
    func appWritingTools(_ mode: AppWritingToolsMode) -> some View {
        if #available(iOS 18.0, *) {
            switch mode {
            case .complete: writingToolsBehavior(.complete)
            case .disabled: writingToolsBehavior(.disabled)
            }
        } else {
            self
        }
    }
}
