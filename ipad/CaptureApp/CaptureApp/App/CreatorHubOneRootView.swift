import SwiftUI

/// Root surface for CreatorHub One. 6 primary tabs backed by the
/// iPad's bottom tab bar in portrait and the side-bar in Stage
/// Manager / split-view. Each tab is a separate surface that lazily
/// loads its own data from the shared ``AppDatabase``.
///
/// Tab layout, in photographer workflow order:
///   1. I dag      — today's active shoots + countdown to next event
///   2. Shoot      — the existing capture surface (tether + review)
///   3. Galleri    — client-gallery viewer (photographer POV)
///   4. Admin      — webview to creatorhubn.com/administrasjon
///   5. Meldinger  — comms inbox (webview to CommunicationHub)
///   6. Debug      — foundation status + outbox live-view (dev builds)
///
/// The Debug tab is the one I'm shipping first so you can see the
/// CreatorHub One foundation actually working in simulator — DB
/// schema version, row counts per table, outbox state, sync
/// indicator. Once the rest of the tabs render real content we'll
/// gate Debug behind a hidden-gesture or feature flag.
struct CreatorHubOneRootView: View {
    enum Tab: Int, CaseIterable, Identifiable {
        case today
        case shoot
        case gallery
        case admin
        case tilbud
        case pricing
        case messages
        case debug
        var id: Int { rawValue }
    }

    /// Backend URL paths the iPad tabs deep-link into. Kept as a
    /// single source of truth so tests can assert the exact query
    /// contract with the web ``UniversalDashboard`` + its
    /// sub-hubs. Note: the dashboard reads ``?tab=<id>`` to pick the
    /// main section and stashes ``?subTab=<id>`` into sessionStorage
    /// so the target hub picks it up on mount.
    enum TabPath {
        /// Host that serves the photographer dashboard. This is the web
        /// FRONTEND (the React SPA on Vercel) — deliberately NOT the API
        /// backend (`session.backendBaseURL`). The backend only serves
        /// `/api/*` and returns Express's "Cannot GET <path>" for these
        /// SPA routes, which is exactly what a backend-based URL produced.
        /// Auth still flows because ``WebViewAuthBridge`` pre-seeds the
        /// session token into localStorage (host-agnostic), and the SPA
        /// calls the backend API from there just like a desktop browser.
        static let webBaseURL = URL(string: "https://creatorhubn.com")!

        static let gallery = "/photographer-dashboard-material?tab=showcase-admin"
        static let admin = "/photographer-dashboard-material?tab=administration"
        static let tilbud = "/photographer-dashboard-material?tab=administration&subTab=quotes"
        static let pricing = "/price-administration"
        static let messages = "/photographer-dashboard-material?tab=administration&subTab=communication"
    }

    @State private var selected: Tab = .today

    /// Build a WebView-backed tab that points at a path on the
    /// signed-in photographer's backend. Falls back to the given
    /// placeholder when the user isn't signed in yet — without a
    /// session the auth-bridge has nothing to inject and the embed
    /// would just bounce to a login page.
    ///
    /// ``enablePencilBridge`` opts the tab into the native Pencil
    /// signature bridge — on for Admin (kontrakter) + Tilbud so the
    /// photographer can sign tilbud/kontrakt-drafts directly from the
    /// web form with Apple Pencil precision. Off for Gallery +
    /// Meldinger where signatures aren't part of the flow.
    @ViewBuilder
    private func webTab<Fallback: View>(
        path: String,
        enablePencilBridge: Bool = false,
        fallback: Fallback,
    ) -> some View {
        if let stored = SignInService.shared.session,
           let url = URL(string: path, relativeTo: TabPath.webBaseURL) {
            AuthenticatedWebView(
                url: url,
                session: stored,
                onDeepLink: { intent in
                    route(deepLink: intent)
                },
                enablePencilBridge: enablePencilBridge,
            )
        } else {
            fallback
        }
    }

    /// Route a deep-link intent back to the native tab bar. Switches
    /// tabs instead of pushing a second navigation stack so the
    /// native state (ongoing Live Cull, unsaved shot list edits)
    /// isn't torn down by an accidental jump.
    private func route(deepLink intent: DeepLinkRouter.Intent) {
        switch intent {
        case .openProject, .openShotList:
            selected = .today
        case .openSession, .openCull:
            selected = .shoot
        }
    }

    var body: some View {
        TabView(selection: $selected) {
            TodayView()
                .tabItem { Label("I dag", systemImage: "sun.max") }
                .tag(Tab.today)

            // Existing capture flow — reused as-is. Eventually this
            // becomes the shoot-plus-live-cull surface, but wiring
            // shouldn't change so the tether integration keeps
            // working through the transition.
            LiveCaptureView()
                .tabItem { Label("Shoot", systemImage: "camera") }
                .tag(Tab.shoot)

            // Galleri → NATIVE client-gallery review (showcase admin).
            // Rebuilt native for a run-and-gun feel: live engagement
            // counts, client selections + comments, respond + mark
            // complete — e2e synced against /api/photographer/galleries.
            GalleriView()
                .tabItem { Label("Galleri", systemImage: "photo.on.rectangle") }
                .tag(Tab.gallery)

            // Admin → whole AdministrationHub (pris, kontrakter,
            // kommunikasjon, Evendi). Pencil-bridge on so contract
            // signatures + tilbud-signaturer inside the hub work.
            webTab(
                path: TabPath.admin,
                enablePencilBridge: true,
                fallback: AdminPlaceholderView(),
            )
            .tabItem { Label("Admin", systemImage: "slider.horizontal.3") }
            .tag(Tab.admin)

            // Tilbud → same hub but deep-links straight to the
            // Evendi/quote sub-tab, skipping the two-tap drill-down.
            // ``source=ipad-quote`` is kept for backwards-compat with
            // SmartWorkflowSystem's own auto-open handler (desktop
            // flow still works without the outer dashboard).
            webTab(
                path: TabPath.tilbud,
                enablePencilBridge: true,
                fallback: TilbudPlaceholderView(),
            )
            .tabItem { Label("Tilbud", systemImage: "doc.text.below.ecg") }
            .tag(Tab.tilbud)

            // Pris-admin → the standalone ``/price-administration``
            // route. Separate from Admin because pricing is
            // referenced from every other tab (tilbud pulls prices,
            // kontrakter reference packages) so a direct entry keeps
            // the photographer one tap away.
            webTab(
                path: TabPath.pricing,
                fallback: PricingPlaceholderView(),
            )
            .tabItem { Label("Pris", systemImage: "tag") }
            .tag(Tab.pricing)

            // Meldinger → Kommunikasjon sub-tab inside Admin. Uses
            // the same subTab handoff. Pencil-bridge off (no
            // signatures in chat — would just pop the sheet on
            // stray taps).
            webTab(
                path: TabPath.messages,
                fallback: MessagesPlaceholderView(),
            )
            .tabItem { Label("Meldinger", systemImage: "envelope") }
            .tag(Tab.messages)

            // Debug-fanen følger KUN med i DEBUG-builds — skjules i release.
            #if DEBUG
            FoundationDebugView()
                .tabItem { Label("Debug", systemImage: "wrench.and.screwdriver") }
                .tag(Tab.debug)
            #endif
        }
        // CreatorHub dark branding across the whole shell — amber accent +
        // forced dark scheme so every tab reads as one branded product.
        .chBranded()
    }
}

// MARK: - Placeholders
// Each placeholder describes what the real tab will do so reviewers
// in the simulator understand what's coming. They also ensure the
// tab bar compiles + navigates today, before the real surfaces ship.

private struct TodayPlaceholderView: View {
    var body: some View {
        PlaceholderScreen(
            title: "I dag",
            subtitle: "Oppstart: dagens aktive jobber, neste event, siste sync-status.",
            detail: "Task #53 — følger rett etter foundation.",
        )
    }
}

private struct GalleryPlaceholderView: View {
    var body: some View {
        PlaceholderScreen(
            title: "Klient-galleri",
            subtitle: "Se hva klienten har hjertet og kommentert.",
            detail: "Task #65 — webview-wrapper mot /client/gallery/:token.",
        )
    }
}

private struct AdminPlaceholderView: View {
    var body: some View {
        PlaceholderScreen(
            title: "Administrasjon",
            subtitle: "Tilbud, kontrakter, pris-admin, Evendi.",
            detail: "Task #61 — webview mot creatorhubn.com/administrasjon med auth-bridge.",
        )
    }
}

private struct MessagesPlaceholderView: View {
    var body: some View {
        PlaceholderScreen(
            title: "Meldinger",
            subtitle: "E-post-tråder, møter, notater, klient-chat på ett sted.",
            detail: "Task #64 — CommunicationHub i webview + APNs for push.",
        )
    }
}

private struct TilbudPlaceholderView: View {
    var body: some View {
        PlaceholderScreen(
            title: "Tilbud",
            subtitle: "Bygg + signer tilbud på iPaden med Apple Pencil.",
            detail: "Task #62 — QuoteGeneratorModal i webview + Pencil-signatur-bro.",
        )
    }
}

private struct PricingPlaceholderView: View {
    var body: some View {
        PlaceholderScreen(
            title: "Prisadministrasjon",
            subtitle: "Pakker, tilleggskostnader, rabatter — gjenbrukt av tilbud og kontrakter.",
            detail: "Task #63 — direkte webview mot /price-administration.",
        )
    }
}

private struct PlaceholderScreen: View {
    let title: String
    let subtitle: String
    let detail: String

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.largeTitle.bold())
            Text(subtitle)
                .font(.title3)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Text(detail)
                .font(.caption)
                .foregroundStyle(.tertiary)
                .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}
