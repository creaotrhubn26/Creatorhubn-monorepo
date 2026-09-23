// ReiseguideWidgetsBundle.swift
//
// @main-inngang for widget-extension-target-et (pakke 2, item 6). Inneholder
// bare Live Activity-widgeten («Nå spilles» på låseskjerm og i Dynamic
// Island) — ingen widget på hjemskjermen i denne pakken.
//
// Deployment-target for Reiseguide er iOS 17, godt over ActivityKits
// minimum (iOS 16.1), så widgeten legges til ubetinget her.

import SwiftUI
import WidgetKit

@main
struct ReiseguideWidgetsBundle: WidgetBundle {
    var body: some Widget {
        PlayerLiveActivityWidget()
    }
}
