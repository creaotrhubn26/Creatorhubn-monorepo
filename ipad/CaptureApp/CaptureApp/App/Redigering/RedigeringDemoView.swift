import SwiftUI

/// Demo-rute (`--demo-redigering`) som viser den EKTE Redigering-fanen på et
/// bundlet testbilde uten innlogging. Setter en lokal demo-sesjon (så
/// `RedigeringModel.loadSessions` har en eier), og lar `RedigeringSampleSeeder`
/// (DEBUG) seede økt + asset fra `demo_wedding.CR3` hvis den er bundlet.
/// Åpner direkte med «Bryllup»-presetet så redigeringen vises live.
struct RedigeringDemoView: View {
    @State private var ready = false

    var body: some View {
        Group {
            if ready {
                RedigeringView()
            } else {
                ProgressView("Klargjør demo …")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(CHTheme.bg.ignoresSafeArea())
            }
        }
        .preferredColorScheme(.dark)
        .task {
            if SignInService.shared.session == nil {
                SignInService.shared.setInMemoryDemoSession(
                    userId: "demo-redigering",
                    backendBaseURL: URL(string: "https://creatorhub-backend-rtbl.onrender.com")!)
            }
            ready = true
        }
    }
}
