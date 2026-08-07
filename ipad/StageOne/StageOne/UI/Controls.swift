import SwiftUI

/// Tynn 3px-slider m/ accent-fylling og verdichip i mono (brand-spec regel 3).
struct ValueChipSlider: View {
    let label: String
    let unit: String
    let range: ClosedRange<Double>
    var step: Double = 1
    let value: Double
    let onChange: (Double) -> Void   // transient (under drag)
    let onCommit: () -> Void         // drag sluppet

    var body: some View {
        VStack(spacing: 5) {
            HStack {
                Text(label)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
                Spacer()
                Text(chipText)
                    .font(Theme.mono(11))
                    .foregroundStyle(Theme.fg)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(RoundedRectangle(cornerRadius: 6).fill(Theme.raise))
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: Theme.hairline))
            }
            GeometryReader { geo in
                let fraction = (value - range.lowerBound) / (range.upperBound - range.lowerBound)
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.raise).frame(height: 3)
                    Capsule().fill(Theme.accent)
                        .frame(width: max(0, geo.size.width * fraction), height: 3)
                    Circle()
                        .fill(Theme.fg)
                        .frame(width: 14, height: 14)
                        .offset(x: max(0, geo.size.width * fraction - 7))
                }
                .frame(height: 22)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { g in
                            let f = min(max(g.location.x / geo.size.width, 0), 1)
                            var v = range.lowerBound + f * (range.upperBound - range.lowerBound)
                            v = (v / step).rounded() * step
                            onChange(min(max(v, range.lowerBound), range.upperBound))
                        }
                        .onEnded { _ in onCommit() }
                )
            }
            .frame(height: 22)
        }
    }

    private var chipText: String {
        let formatted = step < 1 ? String(format: "%.1f", value) : String(Int(value.rounded()))
        return unit.isEmpty ? formatted : "\(formatted) \(unit)"
    }
}

/// Numerisk felt for transform-verdier (committer på submit/fokus-tap).
struct NumericField: View {
    let label: String
    let value: Float
    let onCommit: (Float) -> Void

    @State private var text = ""
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(Theme.muted)
            TextField("", text: $text)
                .font(Theme.mono(11))
                .foregroundStyle(Theme.fg)
                .keyboardType(.numbersAndPunctuation)
                .multilineTextAlignment(.trailing)
                .focused($focused)
                .onSubmit(commit)
                .onChange(of: focused) { _, isFocused in
                    if !isFocused { commit() }
                }
                .padding(.horizontal, 6)
                .padding(.vertical, 4)
                .background(RoundedRectangle(cornerRadius: 6).fill(Theme.raise))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.border, lineWidth: Theme.hairline))
        }
        .onAppear { text = format(value) }
        .onChange(of: value) { _, v in
            if !focused { text = format(v) }
        }
    }

    private func format(_ v: Float) -> String { String(format: "%.2f", v) }

    private func commit() {
        if let v = Float(text.replacingOccurrences(of: ",", with: ".")) {
            onCommit(v)
        } else {
            text = format(value)
        }
    }
}

/// Segmentert valg i pille-stil (accent på aktiv).
struct SegmentPicker: View {
    let options: [String]
    let selection: String
    let onSelect: (String) -> Void

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options, id: \.self) { option in
                Button {
                    onSelect(option)
                } label: {
                    Text(option)
                        .font(.system(size: 11, weight: selection == option ? .semibold : .regular))
                        .foregroundStyle(selection == option ? Theme.fg : Theme.muted)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .frame(maxWidth: .infinity)
                        .background(Capsule().fill(selection == option ? Theme.accent.opacity(0.35) : .clear))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(2)
        .background(Capsule().fill(Theme.raise))
        .overlay(Capsule().stroke(Theme.border, lineWidth: Theme.hairline))
    }
}

/// Seksjonsoverskrift i inspector-stil.
struct InspectorSectionHeader: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(Theme.muted)
            .textCase(.uppercase)
            .kerning(0.5)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}
