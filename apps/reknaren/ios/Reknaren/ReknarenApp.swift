import SwiftUI

@main
struct ReknarenApp: App {
    @State private var session = Session()
    @State private var app = AppState()
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            Group {
                switch session.state {
                case .loading:
                    ProgressView().task { await session.restore() }
                case .signedOut:
                    LoginView()
                case .signedIn:
                    RootView().task {
                        await app.loadOrgsIfNeeded()
                        appDelegate.requestAuthorizationAndRegister()
                    }
                }
            }
            .environment(session)
            .environment(app)
            .environment(PushRouter.shared)
            .onOpenURL { url in
                // Universal Link / custom scheme: …/auth/verify?token=…
                guard let comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
                      let token = comps.queryItems?.first(where: { $0.name == "token" })?.value
                else { return }
                Task { try? await session.verify(magicToken: token) }
            }
        }
    }
}
