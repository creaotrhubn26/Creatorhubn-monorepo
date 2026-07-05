// ScaledFont.swift — Dynamic Type-støtte (a11y-backlog 2026-07-05)
//
// Hele appen var bygget med faste `.system(size:)`-fonter — Apples
// a11y-audit flagget «Dynamic Type font sizes are unsupported» på alt.
// `appScaled` er en drop-in-erstatning med identisk signatur som
// skalerer punktstørrelsen med brukerens tekststørrelse (relativt til
// .body via UIFontMetrics):
//
//   .font(.appScaled(size: 13, weight: .bold))          // fast
//   .font(.appScaled(size: 13, weight: .bold))       // skalerer
//
// Ved standard tekststørrelse returnerer UIFontMetrics samme verdi →
// null visuell endring for brukere som ikke har justert noe.
//
// MERK: fonten beregnes når view-body evalueres. Root-viewet
// (MainTabView) leser dynamicTypeSize og setter `.id(...)` så hele
// hierarkiet re-bygges når brukeren endrer tekststørrelse, og
// `.dynamicTypeSize(...(.xxxLarge))` capper mot accessibility-størrelsene
// (de krever ekte adaptive layouts — egen runde).

import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

extension Font {
    /// Dynamic Type-vennlig `.system(size:)`. Samme parametre, skalert
    /// punktstørrelse.
    static func appScaled(
        size: CGFloat,
        weight: Font.Weight = .regular,
        design: Font.Design = .default
    ) -> Font {
        #if canImport(UIKit)
        let scaled = UIFontMetrics(forTextStyle: .body).scaledValue(for: size)
        return .system(size: scaled, weight: weight, design: design)
        #else
        return .system(size: size, weight: weight, design: design)
        #endif
    }
}
