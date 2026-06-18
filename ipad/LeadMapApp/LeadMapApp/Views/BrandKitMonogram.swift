// BrandKitMonogram.swift
//
// Square brand-monogram-boks som matcher web-detail-header (PR #569).
// Tar firmaname og deler i 2 linjer hvis det er 2 ord.

import SwiftUI

struct BrandKitMonogram: View {
    let name: String
    let accent: Color

    var body: some View {
        let parts = name.uppercased().split(separator: " ", maxSplits: 1)
        VStack(spacing: 1) {
            Text(parts.first.map { String($0.prefix(8)) } ?? "?")
                .font(.system(size: fontSize, weight: .black, design: .default))
            if parts.count > 1 {
                Text(String(parts[1].prefix(8)))
                    .font(.system(size: fontSize, weight: .black, design: .default))
            }
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(accent.opacity(0.35), lineWidth: 1.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private var fontSize: CGFloat {
        let parts = name.uppercased().split(separator: " ", maxSplits: 1)
        let longest = parts.map(\.count).max() ?? 4
        if longest > 6 { return 9 }
        if longest > 4 { return 11 }
        return 14
    }
}
