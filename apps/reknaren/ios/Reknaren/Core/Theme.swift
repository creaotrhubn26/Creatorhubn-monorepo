import SwiftUI
import UIKit

/// Reknaren-merkevaren: skoggrønn + gull. Samme verdier som web (`--accent` #1F4D3A).
extension Color {
    static let reknarenGreen = Color(red: 0.122, green: 0.302, blue: 0.227)      // #1F4D3A
    static let reknarenGreenEdge = Color(red: 0.086, green: 0.227, blue: 0.169)  // #163A2B
    static let reknarenGold = Color(red: 0.690, green: 0.569, blue: 0.231)       // #B0913B

    /// Varm off-white bunn (lys) / dyp grønn-slate (mørk) — erstatter kald system-grå.
    static let reknarenGround = Color("ReknarenGround")
}

/// Global utseende: skoggrønne store titler + varm navbar. Kalles én gang ved oppstart.
enum ReknarenAppearance {
    static func apply() {
        let green = UIColor(Color.reknarenGreen)
        let ground = UIColor(named: "ReknarenGround") ?? .systemGroupedBackground
        let bar = UINavigationBarAppearance()
        bar.configureWithOpaqueBackground()
        bar.backgroundColor = ground
        bar.shadowColor = .clear
        bar.largeTitleTextAttributes = [.foregroundColor: green]
        bar.titleTextAttributes = [.foregroundColor: green]
        UINavigationBar.appearance().standardAppearance = bar
        UINavigationBar.appearance().scrollEdgeAppearance = bar
        UINavigationBar.appearance().compactAppearance = bar
    }
}

/// Tidløs primærknapp: skoggrønn fyll, mørk kant + subtil hvit inset-highlight
/// (samme «opphøyde» oppskrift som tidum.no/web). Radius 12, full bredde.
struct ReknarenPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration c: Configuration) -> some View {
        c.label
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .background(Color.reknarenGreen, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.reknarenGreenEdge, lineWidth: 1)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .inset(by: 1)
                    .strokeBorder(Color.white.opacity(0.15), lineWidth: 1)
            )
            .brightness(c.isPressed ? -0.04 : 0)
            .scaleEffect(c.isPressed ? 0.99 : 1)
            .animation(.easeOut(duration: 0.12), value: c.isPressed)
    }
}
