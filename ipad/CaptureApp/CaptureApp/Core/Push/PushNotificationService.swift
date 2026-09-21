// PushNotificationService.swift
//
// APNs push for CaptureApp: leverer de hendelsene realtime-laget allerede
// kjenner (kunde signerte kontrakt/tilbud, likte/kommenterte bilder, redigerer
// ferdig, ny melding) SELV NÅR APPEN ER LUKKET — der WebSocket-realtime
// suspenderes av iOS.
//
// Flyt: be om tillatelse → registrer for remote notifications → AppDelegate
// mottar APNs-token → send til backend (knyttes til innlogget fotograf).

import Foundation
import GoogleSignIn
import Observation
import UIKit
import UserNotifications

/// Process-lifetime navigation state for notification deep links. Keeping the
/// pending id here means a cold-start notification is not lost while the root
/// view and its NavigationStack are still being constructed.
@MainActor
@Observable
final class CaptureDeepLinkRouter {
    static let shared = CaptureDeepLinkRouter()
    var inquiryId: String?

    func route(type: String, inquiryId id: String) {
        guard type == "inquiry", !id.isEmpty else { return }
        inquiryId = id
    }
}

@MainActor
final class PushNotificationService: NSObject {
    static let shared = PushNotificationService()

    private var pendingToken: String?

    /// Be om varsel-tillatelse og registrer for remote notifications.
    /// Kalles når fotografen er innlogget (hovedskjermen vises).
    func requestAuthorizationAndRegister() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            guard granted else { return }
            Task { @MainActor in
                UIApplication.shared.registerForRemoteNotifications()
            }
        }
        // Hvis vi allerede har et token fra en tidligere registrering (før
        // innlogging), send det nå som sesjonen finnes.
        flushPendingToken()
    }

    /// Kalles fra AppDelegate når APNs leverer enhets-token.
    func didRegister(deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        pendingToken = token
        Task { await sendTokenToBackend(token) }
    }

    /// Send et ventende token på nytt (etter innlogging).
    func flushPendingToken() {
        guard let token = pendingToken else { return }
        Task { await sendTokenToBackend(token) }
    }

    private func sendTokenToBackend(_ token: String) async {
        guard let session = SignInService.shared.session else { return }  // ikke innlogget → behold token
        let client = BackendClient(
            baseURL: session.backendBaseURL,
            authHeaders: ["Authorization": "Bearer \(session.bearer)"])
        do {
            try await client.registerCaptureDeviceToken(token: token)
            pendingToken = nil
        } catch {
            // Behold token; neste flush prøver igjen.
        }
    }
}

/// App-delegat for APNs-registrering + innkommende varsler. Koblet på via
/// `@UIApplicationDelegateAdaptor` i CaptureAppMain.
final class PushAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Task { @MainActor in
            PushNotificationService.shared.didRegister(deviceToken: deviceToken)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // Stille — simulator/uten nett gir ingen token; ingen degradering.
    }

    func application(
        _ application: UIApplication,
        handleEventsForBackgroundURLSession identifier: String,
        completionHandler: @escaping () -> Void
    ) {
        BackgroundMultipartUploader.shared.handleEvents(
            identifier: identifier,
            completionHandler: completionHandler
        )
    }

    /// Route Google Sign-In's registered callback scheme back to the SDK.
    func application(
        _ application: UIApplication,
        open url: URL,
        options: [UIApplication.OpenURLOptionsKey: Any] = [:]
    ) -> Bool {
        GIDSignIn.sharedInstance.handle(url)
    }

    // Vis varsel også når appen er i forgrunn.
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }

    // Åpne riktig forespørsel når fotografen trykker på varselet. APNs-feltene
    // ligger på toppnivå i payloaden (ved siden av `aps`).
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        guard let type = userInfo["type"] as? String,
              let inquiryId = userInfo["inquiryId"] as? String else { return }
        await MainActor.run {
            CaptureDeepLinkRouter.shared.route(type: type, inquiryId: inquiryId)
        }
    }
}
