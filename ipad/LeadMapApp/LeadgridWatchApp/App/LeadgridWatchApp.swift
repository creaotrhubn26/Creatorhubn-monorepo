// LeadgridWatchApp.swift
//
// watchOS-app entry-point. Single-target SwiftUI-app (Apple-anbefalt
// siden watchOS 7+ — ingen separat WatchKit-Extension).
//
// 3 features (roadmap #403):
//   1. NearbyLeadsView — leads sortert etter avstand fra GPS
//   2. QuickActionView — tap lead → marker visited/called/booked
//   3. LeadgridComplication — "12 leads i dag" på watch-face
//
// Data-flow: iPhone-appen pusher leads-snapshot via WatchConnectivity
// (PhoneSession.swift). Watch persisterer i App Group så vi har data
// før første reload.

import SwiftUI
import WatchConnectivity

@main
struct LeadgridWatchApp: App {
    @StateObject private var session = PhoneSession.shared
    @StateObject private var locationVM = WatchLocationModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(session)
                .environmentObject(locationVM)
                .onAppear {
                    session.activate()
                    locationVM.requestPermission()
                }
        }
    }
}

struct ContentView: View {
    @EnvironmentObject private var session: PhoneSession
    @EnvironmentObject private var locationVM: WatchLocationModel

    var body: some View {
        if session.leads.isEmpty {
            EmptyStateView()
        } else {
            NearbyLeadsView()
        }
    }
}
