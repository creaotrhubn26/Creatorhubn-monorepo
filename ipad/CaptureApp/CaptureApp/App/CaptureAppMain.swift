import SwiftUI

@main
struct CaptureAppMain: App {
    var body: some Scene {
        WindowGroup {
            PlaceholderRoot()
        }
    }
}

private struct PlaceholderRoot: View {
    var body: some View {
        VStack(spacing: 16) {
            Text("CreatorHub Capture")
                .font(.largeTitle.weight(.semibold))
            Text("Scaffolding only. Session Dashboard lands in task #10.")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}
