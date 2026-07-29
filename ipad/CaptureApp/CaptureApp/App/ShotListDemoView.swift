// ShotListDemoView.swift
//
// Demo-rute (--demo-shotlist) som viser shot-list-panelet med team-funksjonene
// for markedsføring/skjermbilder/QA i simulator — uten innlogging.
//
// Kjører en SKRIPTET auto-spillende fortelling (ingen tap-styring nødvendig,
// så et skjermopptak blir en ren markedsføringsvideo):
//   1. Shot-liste med fremdrift + team-attribusjon («Ferdig · Ole»).
//   2. Auto-huk skjer LIVE mens fotografen skyter — shots hakes av, fremdrift
//      klatrer, «Ferdig · deg» dukker opp med animasjon.
//   3. Team-kontrollen: lead slår auto-huk av (undertekst endrer seg) og på.
//
// `isDemoMode` gjør at toggelen virker lokalt uten backend.

import SwiftUI

struct ShotListDemoView: View {
    @State private var model: LiveCaptureModel
    @State private var shots: [BackendShotListItem]

    init() {
        let m = LiveCaptureModel()
        m.isDemoMode = true
        m.shotListAutoCheckEnabled = true
        let (summary, detail) = ShotListDemoView.build(ShotListDemoView.initialShots)
        m.selectedProject = summary
        m.selectedProjectDetail = detail
        // «Auto-huket denne økta»-oversikt (s1/s2 er auto-hukede) → viser angre.
        m.autoCheckLog = [
            .init(shotId: "s2", scene: "Modell påfører serum", assetId: UUID(), at: Date()),
            .init(shotId: "s1", scene: "Produkt på marmor — flatlay", assetId: UUID(), at: Date(), uncertain: true)
        ]
        ShotListPanel.demoThumbs = [
            "s1": .lifestyle, "s2": .texture, "s3": .lifestyle,
            "s4": .texture, "s5": .group, "s6": .packaging
        ]
        _model = State(initialValue: m)
        _shots = State(initialValue: ShotListDemoView.initialShots)
    }

    var body: some View {
        ShotListPanel(model: model)
            .task { await runStory() }
    }

    // MARK: - Skriptet fortelling

    @MainActor
    private func runStory() async {
        // 1. La seeren lese lista + attribusjonen som alt finnes.
        try? await pause(2.8)
        // 2. Auto-huk skjer live mens fotografen skyter.
        await complete("s3", by: "deg")
        try? await pause(2.0)
        await complete("s4", by: "deg")
        try? await pause(2.0)
        await complete("s5", by: "Ole")
        try? await pause(2.6)
        // 3. Team-kontroll: lead slår auto-huk AV …
        withAnimation(.easeInOut(duration: 0.4)) { model.shotListAutoCheckEnabled = false }
        try? await pause(2.8)
        // … og PÅ igjen.
        withAnimation(.easeInOut(duration: 0.4)) { model.shotListAutoCheckEnabled = true }
        try? await pause(2.0)
        // Siste shot faller på plass.
        await complete("s6", by: "Kari")
        try? await pause(2.5)
    }

    private func complete(_ id: String, by: String) async {
        guard let i = shots.firstIndex(where: { $0.id == id }) else { return }
        let s = shots[i]
        shots[i] = BackendShotListItem(
            id: s.id, scene: s.scene, description: s.description,
            estimatedDuration: s.estimatedDuration, priority: s.priority,
            shotType: s.shotType, locationName: s.locationName, notes: s.notes,
            scouted: s.scouted, isCompleted: true,
            capturedAssetId: "auto-\(id)", completedBy: by)
        withAnimation(.easeInOut(duration: 0.55)) { push() }
    }

    private func push() {
        let (summary, detail) = ShotListDemoView.build(shots)
        model.selectedProject = summary
        model.selectedProjectDetail = detail
    }

    private func pause(_ seconds: Double) async throws {
        try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
    }

    // MARK: - Demo-data

    private static func build(_ shots: [BackendShotListItem]) -> (BackendProjectSummary, BackendProjectDetail) {
        let total = shots.count
        let done = shots.filter { $0.isCompleted == true }.count
        let must = shots.filter { $0.priority == "critical" }.count
        let mustDone = shots.filter { $0.priority == "critical" && $0.isCompleted == true }.count
        let summary = BackendProjectShotListSummary(
            listId: "demo-list", totalShots: total, completedShots: done,
            mustHaveShots: must, completedMustHave: mustDone)
        let ps = BackendProjectSummary(
            id: "demo-project", title: "Nordic Skin — kampanje",
            clientName: "Nordic Skin", eventDate: "2026-08-14",
            location: "Aker Brygge", projectType: "commercial",
            status: "active", shotListSummary: summary, updatedAt: nil)
        let pd = BackendProjectDetail(
            id: "demo-project", title: "Nordic Skin — kampanje",
            description: nil, clientName: "Nordic Skin", eventDate: "2026-08-14",
            location: "Aker Brygge", projectType: "commercial", status: "active",
            shotListSummary: summary, updatedAt: nil, shotList: shots)
        return (ps, pd)
    }

    private static let initialShots: [BackendShotListItem] = [
        BackendShotListItem(id: "s1", scene: "Produkt på marmor — flatlay",
            description: "Topplys, myk skygge", estimatedDuration: 10,
            priority: "critical", shotType: "detail", locationName: "Studio A",
            notes: nil, scouted: true, isCompleted: true,
            capturedAssetId: "a1", completedBy: "Ole"),
        BackendShotListItem(id: "s2", scene: "Modell påfører serum",
            description: "Nærbilde hender + ansikt", estimatedDuration: 15,
            priority: "critical", shotType: "tight", locationName: "Studio A",
            notes: nil, scouted: nil, isCompleted: true,
            capturedAssetId: "a2", completedBy: "Kari"),
        BackendShotListItem(id: "s3", scene: "Livsstil — morgenrutine",
            description: "Naturlig vindulys", estimatedDuration: 20,
            priority: "high", shotType: "wide", locationName: "Leilighet",
            notes: nil, scouted: nil, isCompleted: false,
            capturedAssetId: nil, completedBy: nil),
        BackendShotListItem(id: "s4", scene: "Teksturbilde — krem",
            description: nil, estimatedDuration: 8, priority: "high",
            shotType: "detail", locationName: "Studio A", notes: nil,
            scouted: nil, isCompleted: false, capturedAssetId: nil, completedBy: nil),
        BackendShotListItem(id: "s5", scene: "Gruppe — team bak merket",
            description: "Kandid", estimatedDuration: 12, priority: "medium",
            shotType: "candid", locationName: "Takterrasse", notes: nil,
            scouted: nil, isCompleted: false, capturedAssetId: nil, completedBy: nil),
        BackendShotListItem(id: "s6", scene: "Emballasje — hero",
            description: nil, estimatedDuration: 10, priority: "low",
            shotType: "detail", locationName: "Studio A", notes: nil,
            scouted: nil, isCompleted: false, capturedAssetId: nil, completedBy: nil)
    ]
}
