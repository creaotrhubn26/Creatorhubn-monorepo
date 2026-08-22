import SwiftUI
import UserNotifications

// APNs: be om tillatelse etter innlogging og registrer device-token hos
// backend, så @mention-varsler når fram når appen er lukket.
final class PushDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { await RoleRoomAPIClient.shared.registerDeviceToken(token) }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Sim/dev uten push-provisjonering — stille.
    }

    static func requestAuthorizationAndRegister() {
        UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
                guard granted else { return }
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
    }
}

@main
struct StoryboardStudioApp: App {
    @UIApplicationDelegateAdaptor(PushDelegate.self) private var pushDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
