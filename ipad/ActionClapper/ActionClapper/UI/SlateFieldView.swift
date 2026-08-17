import SwiftUI

/// Redigerbart slate-felt (Scene, Roll, Take, Director, Camera, Date).
/// Stor skrift, store trykkflater, høy kontrast — lesbart foran kamera.
struct SlateFieldView: View {
    let label: String
    @Binding var text: String
    let scale: CGFloat
    var highlighted = false

    var body: some View {
        VStack(alignment: .leading, spacing: 5 * scale) {
            Text(label.uppercased())
                .font(.system(size: 12 * scale, weight: .bold, design: .rounded))
                .tracking(2.2)
                .foregroundStyle(highlighted ? Theme.takeHighlight : Color.white.opacity(0.55))

            TextField("", text: $text)
                .font(Theme.handwritten(24 * scale))
                .foregroundStyle(highlighted ? Theme.takeHighlight : .white)
                .textFieldStyle(.plain)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.characters)
                .padding(.horizontal, 12 * scale)
                .padding(.vertical, 9 * scale)
                .background(
                    RoundedRectangle(cornerRadius: 9 * scale, style: .continuous)
                        .fill(highlighted ? Theme.takeHighlight.opacity(0.16) : Color.white.opacity(0.07))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 9 * scale, style: .continuous)
                        .strokeBorder(
                            highlighted ? Theme.takeHighlight.opacity(0.9) : Color.white.opacity(0.14),
                            lineWidth: highlighted ? 2 : 1
                        )
                )
                .onSubmit { dismissKeyboard() }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Løpende timecode-visning (ikke redigerbar — den teller opp i sanntid).
struct SlateTimecodeView: View {
    let model: SlateModel
    let scale: CGFloat
    var highlighted = false

    var body: some View {
        VStack(alignment: .leading, spacing: 5 * scale) {
            HStack(spacing: 6 * scale) {
                Text("TIMECODE")
                    .font(.system(size: 12 * scale, weight: .bold, design: .rounded))
                    .tracking(2.2)
                    .foregroundStyle(highlighted ? Theme.takeHighlight : Color.white.opacity(0.55))

                if model.timecodeMode == .freeRun {
                    Text("FREE")
                        .font(.system(size: 9 * scale, weight: .bold, design: .rounded))
                        .padding(.horizontal, 5 * scale)
                        .padding(.vertical, 2 * scale)
                        .background(Capsule().fill(Theme.accent.opacity(0.28)))
                        .foregroundStyle(Theme.accent)
                }
            }

            TimelineView(.periodic(from: .now, by: 1.0 / 30.0)) { context in
                Text(model.timecode(at: context.date))
                    .font(.system(size: 24 * scale, weight: .bold, design: .monospaced))
                    .foregroundStyle(highlighted ? Theme.takeHighlight : .white)
                    .monospacedDigit()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12 * scale)
                    .padding(.vertical, 9 * scale)
                    .background(
                        RoundedRectangle(cornerRadius: 9 * scale, style: .continuous)
                            .fill(Color.white.opacity(0.07))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 9 * scale, style: .continuous)
                            .strokeBorder(Color.white.opacity(0.14), lineWidth: 1)
                    )
                    .contentShape(Rectangle())
                    .onLongPressGesture { model.resetFreeRun() }
            }

            if model.timecodeMode == .freeRun {
                Text("Hold inne for å nullstille til 00:00:00:00")
                    .font(.system(size: 10 * scale, weight: .medium, design: .rounded))
                    .foregroundStyle(.white.opacity(0.4))
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
