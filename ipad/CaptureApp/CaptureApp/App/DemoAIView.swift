// DemoAIView.swift
//
// Demo-rute (--demo-ai) som viser de nye on-device AI-flatene uten innlogging.
// Kun for skjermbilder/QA i simulator.

import SwiftUI

struct DemoAIView: View {
    private let sample = FieldNote(
        body: "Møte med Nordic Skin på Aker Brygge. De vil ha 30 bilder retusjert, levering fredag. Sjekk fokus på gruppebildene og book oppfølgingsmøte neste uke.")

    var body: some View {
        TabView {
            NoteEditorView(note: sample, onSave: { _ in }, onDelete: { _ in })
                .tabItem { Label("Notat-AI", systemImage: "sparkles") }

            if #available(iOS 18, *) {
                VisionToolsView()
                    .tabItem { Label("Vision", systemImage: "text.viewfinder") }
            }
        }
    }
}
