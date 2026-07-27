// CaptureWidgetsBundle.swift
//
// Widget-extension-inngangspunkt. Foreløpig kun «shoot i gang»-Live Activity;
// HomeScreen-widgets kan legges til her senere.

import WidgetKit
import SwiftUI

@main
struct CaptureWidgetsBundle: WidgetBundle {
    var body: some Widget {
        ShootLiveActivity()
    }
}
