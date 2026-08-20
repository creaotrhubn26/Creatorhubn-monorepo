import SwiftUI
import UIKit
import UserNotifications

/// Enkel «deep-link»-tilstand: hvilken skjerm et push-trykk skal åpne.
@MainActor
@Observable
final class PushRouter {
    static let shared = PushRouter()
    var pendingScreen: String?
}

/// Håndterer APNs-registrering: ber om tillatelse, henter device-token, sender det til
/// backend (/api/push/register), og ruter varsel-trykk til riktig skjerm.
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func requestAuthorizationAndRegister() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else { return }
            Task { @MainActor in UIApplication.shared.registerForRemoteNotifications() }
        }
    }

    func application(_ application: UIApplication,
                     didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task {
            struct Body: Encodable { let token: String; let platform: String }
            _ = try? await APIClient.shared.post("/api/push/register", body: Body(token: hex, platform: "ios")) as Empty
        }
    }

    func application(_ application: UIApplication,
                     didFailToRegisterForRemoteNotificationsWithError error: Error) {
        // Simulator har ingen APNs; ekte enhet trenger «Push Notifications»-capability.
    }

    // Vis varsel også når appen er i forgrunnen.
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter,
                                            willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    // Trykk på varsel → rut til skjermen i payloaden (f.eks. «concierge»).
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter,
                                            didReceive response: UNNotificationResponse) async {
        let screen = response.notification.request.content.userInfo["screen"] as? String
        if let screen {
            await MainActor.run { PushRouter.shared.pendingScreen = screen }
        }
    }
}
