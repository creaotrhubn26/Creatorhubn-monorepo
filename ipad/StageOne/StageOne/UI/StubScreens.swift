import SwiftUI

struct StubScreen: View {
    let mode: AppMode

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 28))
                .foregroundStyle(Theme.muted)
            Text(mode.rawValue)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Theme.fg)
            Text("Kommer i fase \(phase)")
                .font(.system(size: 13))
                .foregroundStyle(Theme.muted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.bg)
    }

    private var icon: String {
        switch mode {
        case .studio: "cube"
        case .lights: "lightbulb"
        case .cameras: "video"
        case .export: "square.and.arrow.up"
        }
    }

    private var phase: String {
        switch mode {
        case .export: "3"
        default: "2"
        }
    }
}
