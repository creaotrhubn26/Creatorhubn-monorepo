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
            let args = ProcessInfo.processInfo.arguments
            if let a = args.first(where: { $0.hasPrefix("--learned-on") }) {
                // «--learned-on» → stil 0; «--learned-on=N» → stil N; «=auto» → auto.
                let val = a.split(separator: "=").last.map(String.init)
                if val == "auto" { LearnedStyleStore.demoForceAuto = true }
                else { LearnedStyleStore.demoForceStyleIndex = val.flatMap { Int($0) } ?? 0 }
            }
            if SignInService.shared.session == nil {
                SignInService.shared.setInMemoryDemoSession(
                    userId: "demo-redigering",
                    backendBaseURL: URL(string: "https://creatorhub-backend-rtbl.onrender.com")!)
            }
            ready = true
        }
    }
}
