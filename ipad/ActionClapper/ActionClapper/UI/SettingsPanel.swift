import SwiftUI

/// Kompakt innstillingslinje nederst — matcher designet: klaffelyd,
/// auto-øk take og bildehastighet. Intet annet: ingen dashboard-funksjoner.
struct SettingsPanel: View {
    @Bindable var model: SlateModel
    let scale: CGFloat

    var body: some View {
        VStack(spacing: 10 * scale) {
            HStack(spacing: 18 * scale) {
                ToggleRow(
                    icon: "speaker.wave.2.fill",
                    title: "Clap Sound",
                    subtitle: "Sound from device speaker",
                    isOn: $model.clapSoundEnabled,
                    scale: scale
                )

                ToggleRow(
                    icon: "plus.circle.fill",
                    title: "Auto Increment Take",
                    subtitle: "Increase take number after each clap",
                    isOn: $model.autoIncrementTake,
                    scale: scale
                )

                Spacer(minLength: 12 * scale)

                HStack(spacing: 14 * scale) {
                    VStack(alignment: .trailing, spacing: 6 * scale) {
                        Text("FPS")
                            .font(.system(size: 11 * scale, weight: .bold, design: .rounded))
                            .tracking(1.5)
                            .foregroundStyle(.white.opacity(0.5))

                        Picker("Frame rate", selection: $model.frameRate) {
                            ForEach(FrameRate.allCases) { fr in
                                Text(fr.rawValue).tag(fr)
                            }
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 185 * scale)
                    }

                    VStack(alignment: .trailing, spacing: 6 * scale) {
                        Text("TIMECODE")
                            .font(.system(size: 11 * scale, weight: .bold, design: .rounded))
                            .tracking(1.5)
                            .foregroundStyle(.white.opacity(0.5))

                        Picker("Timecode", selection: $model.timecodeMode) {
                            ForEach(TimecodeMode.allCases) { mode in
                                Text(mode.rawValue).tag(mode)
                            }
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 150 * scale)
                    }
                }
                .padding(.leading, 6)
            }

            Rectangle()
                .fill(Color.white.opacity(0.1))
                .frame(height: 1)

            // Klaff-styrke — justerer volumet på klaffelyden.
            HStack(spacing: 12 * scale) {
                Image(systemName: "speaker.fill")
                    .font(.system(size: 15 * scale, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.4))

                Slider(value: $model.clapStrength, in: 0.2...1.0)
                    .tint(Theme.accent)

                Image(systemName: "speaker.wave.3.fill")
                    .font(.system(size: 15 * scale, weight: .semibold))
                    .foregroundStyle(Theme.accent)

                Text("\(Int(model.clapStrength * 100))%")
                    .font(.system(size: 13 * scale, weight: .bold, design: .rounded).monospacedDigit())
                    .foregroundStyle(.white.opacity(0.7))
                    .frame(width: 48 * scale, alignment: .trailing)
            }
        }
        .padding(.horizontal, 18 * scale)
        .padding(.vertical, 12 * scale)
        .background(
            RoundedRectangle(cornerRadius: 16 * scale, style: .continuous)
                .fill(Color(white: 0.09))
                .overlay(
                    RoundedRectangle(cornerRadius: 16 * scale, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
                )
        )
    }
}

private struct ToggleRow: View {
    let icon: String
    let title: String
    let subtitle: String
    @Binding var isOn: Bool
    let scale: CGFloat

    var body: some View {
        HStack(spacing: 12 * scale) {
            Image(systemName: icon)
                .font(.system(size: 20 * scale, weight: .semibold))
                .foregroundStyle(isOn ? Theme.accent : Color.white.opacity(0.35))
                .frame(width: 34 * scale)

            VStack(alignment: .leading, spacing: 3 * scale) {
                Text(title)
                    .font(.system(size: 15 * scale, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white)
                Text(subtitle)
                    .font(.system(size: 12 * scale, weight: .medium, design: .rounded))
                    .foregroundStyle(.white.opacity(0.5))
            }

            Toggle("", isOn: $isOn)
                .labelsHidden()
                .tint(Theme.accent)
        }
        .frame(minHeight: 44)
        .contentShape(Rectangle())
    }
}
