// OverviewDashboardView.swift
//
// Fotografens «Oversikt»-dashboard for et prosjekt: sidemeny + hero-kort
// (auto-huk-status + fremdrift), auto-huk-oversikt m/ angre, «Gjør dette
// neste», og shots-tabellen med filtre. Wiret til LiveCaptureModel; demo via
// --demo-overview.

import SwiftUI

private enum DB {
    static let bgApp = Color(hex: 0x0A0A0C)
    static let bgSide = Color(hex: 0x0C0C0F)
    static let card = Color(hex: 0x161619)
    static let cardHi = Color(hex: 0x1B1B20)
    static let stroke = Color.white.opacity(0.07)
    static let green = Color(hex: 0x2FD27A)
    static let purple = Color(hex: 0x8B5CF6)
    static let textPri = Color(hex: 0xF3F3F5)
    static let textSec = Color.white.opacity(0.56)
    static let textDim = Color.white.opacity(0.38)

    static func priority(_ p: String?) -> Color {
        switch (p ?? "").lowercased() {
        case "critical", "must": return Color(hex: 0xE0606A)
        case "high": return Color(hex: 0xE0A955)
        case "medium": return Color(hex: 0xD8C24A)
        default: return Color.white.opacity(0.5)
        }
    }
}

struct OverviewDashboardView: View {
    @Bindable var model: LiveCaptureModel
    /// Angre en auto-huking. Injiseres så demo + ekte bruk deler UI.
    var onUndo: (String) async -> Void = { _ in }

    @State private var filter: ShotFilter = .all
    @State private var query = ""

    private enum ShotFilter: String, CaseIterable { case all = "Alle", must = "Must-have", optional = "Valgfritt" }

    private var shots: [BackendShotListItem] { model.selectedProjectDetail?.shotList ?? [] }
    private var summary: BackendProjectShotListSummary? { model.selectedProjectDetail?.shotListSummary }
    private var nextShot: BackendShotListItem? {
        shots.first { !($0.isCompleted ?? false) }
    }
    private var filteredShots: [BackendShotListItem] {
        shots.filter { s in
            let byFilter: Bool = {
                switch filter {
                case .all: return true
                case .must: return ["critical", "must", "high"].contains((s.priority ?? "").lowercased())
                case .optional: return !["critical", "must", "high"].contains((s.priority ?? "").lowercased())
                }
            }()
            let byQuery = query.isEmpty || s.scene.localizedCaseInsensitiveContains(query)
            return byFilter && byQuery
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            sidebar.frame(width: 236)
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    header
                    HStack(alignment: .top, spacing: 16) {
                        autoHukHero
                        progressCard.frame(width: 380)
                    }
                    HStack(alignment: .top, spacing: 16) {
                        autoCheckLogCard
                        nextShotCard.frame(width: 380)
                    }
                    shotsTable
                }
                .padding(28)
            }
            .background(DB.bgApp)
        }
        .background(DB.bgApp.ignoresSafeArea())
        .preferredColorScheme(.dark)
    }

    // MARK: - Sidemeny

    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 11) {
                RoundedRectangle(cornerRadius: 9)
                    .fill(LinearGradient(colors: [DB.green, DB.purple], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 34, height: 34)
                    .overlay(Image(systemName: "diamond.fill").font(.caption).foregroundStyle(.white))
                VStack(alignment: .leading, spacing: 1) {
                    Text(model.selectedProject?.title ?? "Prosjekt").font(.headline).foregroundStyle(DB.textPri)
                    Text("Kampanje").font(.caption).foregroundStyle(DB.green)
                }
            }
            .padding(.horizontal, 8).padding(.top, 8).padding(.bottom, 18)

            navItem("Oversikt", "house.fill", active: true)
            navItem("Shots", "list.bullet.indent")
            navItem("Auto-huk", "sparkles", badge: model.autoCheckLog.count)
            navItem("Kalender", "calendar")
            navItem("Team", "person.2.fill")
            navItem("Innstillinger", "gearshape.fill")

            Spacer()

            HStack(spacing: 10) {
                Circle().fill(DB.purple.opacity(0.4)).frame(width: 34, height: 34)
                    .overlay(Text("KN").font(.caption2.weight(.bold)).foregroundStyle(.white))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Kari Nordmann").font(.subheadline.weight(.semibold)).foregroundStyle(DB.textPri)
                    Text("Admin").font(.caption2).foregroundStyle(DB.textSec)
                }
                Spacer()
                Image(systemName: "chevron.up.chevron.down").font(.caption2).foregroundStyle(DB.textDim)
            }
            .padding(10)
            .background(DB.card, in: RoundedRectangle(cornerRadius: 14))
        }
        .padding(14)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(DB.bgSide)
    }

    private func navItem(_ title: String, _ icon: String, active: Bool = false, badge: Int = 0) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).frame(width: 22).foregroundStyle(active ? DB.textPri : DB.textSec)
            Text(title).font(.subheadline.weight(active ? .semibold : .regular))
                .foregroundStyle(active ? DB.textPri : DB.textSec)
            Spacer()
            if badge > 0 {
                Text("\(badge)").font(.caption2.weight(.bold)).foregroundStyle(.white)
                    .padding(.horizontal, 7).padding(.vertical, 2)
                    .background(DB.green, in: Capsule())
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 11)
        .background(active ? DB.cardHi : .clear, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Oversikt").font(.system(size: 30, weight: .bold)).foregroundStyle(DB.textPri)
                Text("Hei Kari! La oss sikre at kampanjen blir visuelt perfekt.")
                    .font(.subheadline).foregroundStyle(DB.textSec)
            }
            Spacer()
            Button {} label: {
                Label("Del rapport", systemImage: "square.and.arrow.up")
                    .font(.subheadline.weight(.semibold)).foregroundStyle(DB.textPri)
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(DB.card, in: Capsule())
                    .overlay(Capsule().stroke(DB.stroke))
            }.buttonStyle(.plain)
            Button {} label: {
                Label("Ny økt", systemImage: "plus")
                    .font(.subheadline.weight(.bold)).foregroundStyle(.black)
                    .padding(.horizontal, 18).padding(.vertical, 10)
                    .background(DB.green, in: Capsule())
            }.buttonStyle(.plain)
        }
    }

    // MARK: - Hero-kort

    private var autoHukHero: some View {
        ZStack(alignment: .topLeading) {
            LinearGradient(colors: [Color(hex: 0x0E2A1C), Color(hex: 0x122016)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            RadialGradient(colors: [DB.green.opacity(0.35), .clear], center: .init(x: 0.8, y: 0.55),
                           startRadius: 10, endRadius: 320)
            VStack(alignment: .leading, spacing: 12) {
                Label("AUTO-HUK SHOTS", systemImage: "sparkles")
                    .font(.caption.weight(.bold)).foregroundStyle(DB.green)
                Text(model.shotListAutoCheckEnabled ? "Auto-huk er på" : "Auto-huk er av")
                    .font(.system(size: 26, weight: .bold)).foregroundStyle(DB.textPri)
                Text("Vision huker av shots automatisk når du tar bildet.\nGjelder hele teamet.")
                    .font(.subheadline).foregroundStyle(DB.textSec)
                Spacer()
            }
            .padding(22)
        }
        .frame(height: 210).frame(maxWidth: .infinity, alignment: .leading)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(DB.stroke))
    }

    private var progressCard: some View {
        let done = summary?.completedShots ?? shots.filter { $0.isCompleted ?? false }.count
        let total = max(summary?.totalShots ?? shots.count, 1)
        let mustDone = summary?.completedMustHave ?? 0
        let must = summary?.mustHaveShots ?? 0
        let pct = Int((Double(done) / Double(total) * 100).rounded())
        return VStack(alignment: .leading, spacing: 16) {
            Text("PROGRESS").font(.caption.weight(.bold)).foregroundStyle(DB.textSec)
            HStack(spacing: 20) {
                ZStack {
                    Circle().stroke(Color.white.opacity(0.08), lineWidth: 10)
                    Circle().trim(from: 0, to: Double(done) / Double(total))
                        .stroke(DB.green, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: 0) {
                        Text("\(done)").font(.system(size: 26, weight: .bold)).foregroundStyle(DB.textPri)
                        Text("av \(total)").font(.caption2).foregroundStyle(DB.textSec)
                    }
                }.frame(width: 108, height: 108)
                VStack(alignment: .leading, spacing: 5) {
                    Text("\(pct)% fullført").font(.title3.weight(.bold)).foregroundStyle(DB.textPri)
                    Text(pct >= 100 ? "Alle must-have shots er fullført. Flott jobbet! 🎉"
                         : "\(total - done) shots gjenstår.")
                        .font(.caption).foregroundStyle(DB.textSec).fixedSize(horizontal: false, vertical: true)
                }
            }
            if must > 0 {
                Label("\(mustDone) av \(must) must-have shots gjort", systemImage: "checkmark.circle.fill")
                    .font(.caption.weight(.medium)).foregroundStyle(DB.green)
            }
        }
        .padding(22).frame(height: 210, alignment: .topLeading)
        .background(DB.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(DB.stroke))
    }

    // MARK: - Auto-huk-oversikt + Neste

    private var autoCheckLogCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("AUTO-HUKET DENNE ØKTA (\(model.autoCheckLog.count))", systemImage: "sparkles")
                    .font(.caption.weight(.bold)).foregroundStyle(DB.textSec)
                Spacer()
                Text("Se alle").font(.caption.weight(.semibold)).foregroundStyle(DB.purple)
            }
            if model.autoCheckLog.isEmpty {
                Text("Ingen auto-hukede shots ennå.").font(.subheadline).foregroundStyle(DB.textDim)
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 18)
            } else {
                ForEach(model.autoCheckLog) { entry in
                    HStack(spacing: 12) {
                        thumb(for: entry.shotId).frame(width: 48, height: 42)
                            .clipShape(RoundedRectangle(cornerRadius: 9))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(entry.scene).font(.subheadline.weight(.semibold)).foregroundStyle(DB.textPri)
                            Text("Auto-huket \(entry.at.formatted(date: .omitted, time: .shortened))")
                                .font(.caption2).foregroundStyle(DB.textSec)
                        }
                        Spacer()
                        Button { Task { await onUndo(entry.shotId) } } label: {
                            Text("Angre").font(.caption.weight(.semibold)).foregroundStyle(Color(hex: 0xE0A955))
                                .padding(.horizontal, 12).padding(.vertical, 6)
                                .overlay(Capsule().stroke(Color(hex: 0xE0A955).opacity(0.5)))
                        }.buttonStyle(.plain)
                        Image(systemName: "ellipsis").foregroundStyle(DB.textDim)
                    }
                    .padding(10)
                    .background(DB.cardHi, in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
        .padding(18).frame(maxWidth: .infinity, alignment: .leading)
        .background(DB.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(DB.stroke))
    }

    private var nextShotCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("GJØR DETTE NESTE", systemImage: "sparkles")
                .font(.caption.weight(.bold)).foregroundStyle(DB.purple)
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 12).fill(DB.purple.opacity(0.18)).frame(width: 52, height: 52)
                    .overlay(Image(systemName: "photo").foregroundStyle(DB.purple))
                VStack(alignment: .leading, spacing: 3) {
                    Text(nextShot?.scene ?? "Alt er tatt 🎉").font(.subheadline.weight(.bold)).foregroundStyle(DB.textPri)
                    Text(nextShot == nil ? "Ingen gjenstående shots." : "Dette shotet mangler ennå.")
                        .font(.caption).foregroundStyle(DB.textSec)
                }
                Spacer(minLength: 0)
            }
            if nextShot != nil {
                Button {} label: {
                    Text("Start shot").font(.subheadline.weight(.bold)).foregroundStyle(.white)
                        .padding(.horizontal, 16).padding(.vertical, 9)
                        .background(DB.purple, in: Capsule())
                }.buttonStyle(.plain)
            }
        }
        .padding(20).frame(height: 178, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(LinearGradient(colors: [Color(hex: 0x1A1530), DB.card], startPoint: .topLeading, endPoint: .bottomTrailing)))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(DB.purple.opacity(0.28)))
    }

    // MARK: - Shots-tabell

    private var shotsTable: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Text("SHOTS").font(.caption.weight(.bold)).foregroundStyle(DB.textSec)
                HStack(spacing: 4) {
                    ForEach(ShotFilter.allCases, id: \.self) { f in
                        Button { filter = f } label: {
                            Text(f.rawValue).font(.caption.weight(.semibold))
                                .foregroundStyle(filter == f ? .black : DB.textSec)
                                .padding(.horizontal, 12).padding(.vertical, 6)
                                .background(filter == f ? DB.green : .clear, in: Capsule())
                        }.buttonStyle(.plain)
                    }
                }
                Spacer()
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass").font(.caption).foregroundStyle(DB.textDim)
                    TextField("Søk etter shot…", text: $query)
                        .font(.caption).foregroundStyle(DB.textPri).frame(width: 150)
                }
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(DB.cardHi, in: Capsule())
            }
            .padding(.horizontal, 18).padding(.vertical, 16)

            ForEach(Array(filteredShots.enumerated()), id: \.element.id) { idx, shot in
                shotRow(index: idx + 1, shot: shot)
                if idx < filteredShots.count - 1 { Divider().overlay(DB.stroke).padding(.leading, 74) }
            }
        }
        .background(DB.card, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(DB.stroke))
    }

    private func shotRow(index: Int, shot: BackendShotListItem) -> some View {
        let done = shot.isCompleted ?? false
        return HStack(spacing: 14) {
            ZStack {
                Circle().stroke(done ? DB.green : DB.textDim, lineWidth: 1.5)
                Text("\(index)").font(.caption.weight(.bold)).foregroundStyle(done ? DB.green : DB.textSec)
            }.frame(width: 26, height: 26)
            thumb(for: shot.id).frame(width: 52, height: 44).clipShape(RoundedRectangle(cornerRadius: 9))
            VStack(alignment: .leading, spacing: 2) {
                Text(shot.scene).font(.subheadline.weight(.semibold)).foregroundStyle(DB.textPri).lineLimit(1)
                if let d = shot.description, !d.isEmpty {
                    Text(d).font(.caption2).foregroundStyle(DB.textSec).lineLimit(1)
                }
            }.frame(width: 220, alignment: .leading)
            if done, let by = shot.completedBy, !by.isEmpty {
                pill("Ferdig · \(by)", DB.green)
            } else if done {
                pill("Ferdig", DB.green)
            }
            if let p = shot.priority, !p.isEmpty { pill(p.capitalized, DB.priority(p)) }
            if let t = shot.shotType, !t.isEmpty { pill(t.capitalized, Color(hex: 0x4A90E2)) }
            Spacer(minLength: 8)
            if let loc = shot.locationName, !loc.isEmpty {
                Label(loc, systemImage: "mappin.and.ellipse").font(.caption).foregroundStyle(DB.textSec)
            }
            if let dur = shot.estimatedDuration {
                Label("\(dur) min", systemImage: "clock").font(.caption).foregroundStyle(DB.textSec).frame(width: 76, alignment: .leading)
            }
            Image(systemName: "ellipsis").foregroundStyle(DB.textDim)
        }
        .padding(.horizontal, 18).padding(.vertical, 12)
    }

    private func pill(_ text: String, _ color: Color) -> some View {
        Text(text).font(.caption2.weight(.bold)).foregroundStyle(color)
            .padding(.horizontal, 10).padding(.vertical, 4)
            .background(color.opacity(0.15), in: Capsule())
    }

    // MARK: - Thumbnails

    @ViewBuilder
    private func thumb(for shotId: String) -> some View {
        if let scene = OverviewDashboardView.demoThumbs[shotId] {
            MockPhotoView(scene: scene)
        } else {
            RoundedRectangle(cornerRadius: 9).fill(DB.cardHi)
                .overlay(Image(systemName: "photo").font(.caption2).foregroundStyle(DB.textDim))
        }
    }

    /// Demo-thumbnails pr shot-id (mock-scener). Ekte bruk kobler asset-previews.
    static var demoThumbs: [String: MockScene] = [:]
}

// MARK: - Demo (--demo-overview)

struct OverviewDemoView: View {
    @State private var model = OverviewDemoView.makeModel()

    var body: some View {
        OverviewDashboardView(model: model, onUndo: { shotId in
            await model.undoAutoCheck(shotId: shotId)
        })
    }

    private static func makeModel() -> LiveCaptureModel {
        // (scene, desc, priority, type, location, min, ferdigAv?) — nil = ikke tatt.
        let rows: [(String, String, String, String, String, Int, String?)] = [
            ("Produkt på marmor — flatlay", "Topplys, myk skygge", "critical", "detail", "Studio A", 10, "Ole"),
            ("Modell påfører serum", "Nærbilde hender + ansikt", "critical", "tight", "Studio A", 15, "Kari"),
            ("Livsstil — morgenrutine", "Naturlig vindulys", "high", "wide", "Leilighet", 20, nil),
            ("Teksturbilde — krem", "Detalj, krem på spatula", "high", "detail", "Studio A", 8, "deg"),
            ("Gruppe — team bak merket", "Kandid", "medium", "candid", "Takterrasse", 12, "Ole"),
            ("Emballasje — hero", "Produkt + eske", "low", "detail", "Studio A", 10, "Kari"),
        ]
        let ids = (1...rows.count).map { "s\($0)" }
        let shots: [BackendShotListItem] = rows.enumerated().map { i, r in
            BackendShotListItem(
                id: ids[i], scene: r.0, description: r.1, estimatedDuration: r.5,
                priority: r.2, shotType: r.3, locationName: r.4, notes: nil, scouted: nil,
                isCompleted: r.6 != nil, capturedAssetId: r.6 != nil ? "a\(i)" : nil, completedBy: r.6)
        }
        let done = shots.filter { $0.isCompleted ?? false }.count
        let summary = BackendProjectShotListSummary(
            listId: "demo", totalShots: shots.count, completedShots: done,
            mustHaveShots: 2, completedMustHave: 2)
        let m = LiveCaptureModel()
        m.isDemoMode = true
        m.shotListAutoCheckEnabled = true
        m.selectedProject = BackendProjectSummary(
            id: "demo", title: "Nordic Skin", clientName: "Nordic Skin", eventDate: nil,
            location: "Studio A", projectType: "commercial", status: "active",
            shotListSummary: summary, updatedAt: nil)
        m.selectedProjectDetail = BackendProjectDetail(
            id: "demo", title: "Nordic Skin", description: nil, clientName: "Nordic Skin",
            eventDate: nil, location: "Studio A", projectType: "commercial", status: "active",
            shotListSummary: summary, updatedAt: nil, shotList: shots)
        m.autoCheckLog = [
            .init(shotId: "s2", scene: "Modell påfører serum", assetId: UUID(), at: Date()),
            .init(shotId: "s1", scene: "Produkt på marmor — flatlay", assetId: UUID(), at: Date()),
        ]
        OverviewDashboardView.demoThumbs = [
            "s1": .lifestyle, "s2": .texture, "s3": .lifestyle,
            "s4": .texture, "s5": .group, "s6": .packaging,
        ]
        return m
    }
}
