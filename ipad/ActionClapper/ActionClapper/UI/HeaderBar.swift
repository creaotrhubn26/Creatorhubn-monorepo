import SwiftUI

/// Topplinje: appnavn til venstre, levende klokke til høyre (som designet).
struct HeaderBar: View {
    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "film.stack")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Theme.accent)

            Text("The Role Room Action Clapper")
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundStyle(.white.opacity(0.9))

            Spacer()

            TimelineView(.periodic(from: .now, by: 1)) { context in
                HStack(spacing: 8) {
                    Text(context.date, format: .dateTime.hour().minute())
                    Text(context.date, format: .dateTime.weekday(.abbreviated).month(.abbreviated).day())
                }
                .font(.system(size: 15, weight: .semibold, design: .rounded).monospacedDigit())
                .foregroundStyle(.white.opacity(0.6))
            }
        }
        .frame(height: 40)
    }
}
