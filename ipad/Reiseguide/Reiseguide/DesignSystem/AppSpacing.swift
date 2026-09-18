// AppSpacing.swift
//
// Avstander, radius og lag fra UI-spesifikasjon del 4. Grid 4 pt,
// referansebredde 393 pt.

import SwiftUI

enum AppSpacing {
    static let xs: CGFloat = 4
    static let s: CGFloat = 8
    static let m: CGFloat = 12
    static let l: CGFloat = 16
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
    static let screenMargin: CGFloat = 20

    /// Minste treffområde for alt interaktivt (del 5, del 8.3).
    static let minTapTarget: CGFloat = 44
}

enum AppRadius {
    static let pill: CGFloat = 999
    static let card: CGFloat = 20
    static let tile: CGFloat = 16
    static let sheet: CGFloat = 24
}

enum AppShadow {
    /// Kun flytende kort over kart og posisjonsknappen har skygge.
    static func floating<V: View>(_ view: V) -> some View {
        view.shadow(color: .black.opacity(0.35), radius: 16, x: 0, y: 8)
    }
}

extension View {
    /// Sørger for 44 × 44 pt treffområde uten å endre det visuelle.
    func minTapTarget() -> some View {
        frame(minWidth: AppSpacing.minTapTarget, minHeight: AppSpacing.minTapTarget)
            .contentShape(Rectangle())
    }
}
