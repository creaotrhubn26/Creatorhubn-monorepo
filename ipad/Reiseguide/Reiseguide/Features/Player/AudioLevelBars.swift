// AudioLevelBars.swift
//
// Levende detalj i avspilleren og miniavspilleren (SenseAid Explore pakke 1,
// punkt 4): animerte lydnivå-stolper mens noe spilles. Rent dekorativt —
// avspill/pause-status finnes allerede i knappen og VoiceOver-verdien, så
// stolpene er skjult for VoiceOver. Ingen bevegelse når «Reduser bevegelse»
// er på, og de er stille (fast lav høyde) når ingenting spiller.
//
// Høydene regnes deterministisk ut fra klokkeslettet TimelineView gir, så
// komponenten ikke trenger egen tidtaker eller tilstand (enklere under
// Swift 6 streng samtidighet).

import SwiftUI

struct AudioLevelBars: View {
    let isPlaying: Bool
    var barCount = 4
    var tint: Color = AppColor.accent

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.28)) { context in
            HStack(alignment: .bottom, spacing: 3) {
                ForEach(0 ..< barCount, id: \.self) { index in
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(tint)
                        .frame(width: 3, height: height(index: index, date: context.date))
                }
            }
        }
        .frame(height: 16, alignment: .bottom)
        .accessibilityHidden(true)
    }

    private func height(index: Int, date: Date) -> CGFloat {
        guard isPlaying, !reduceMotion else { return 4 }
        let tick = Int(date.timeIntervalSinceReferenceDate * 3.6) + index * 7
        let phase = Double(tick % 11) / 10
        return 4 + CGFloat(phase) * 12
    }
}
