// LeadbookInnsiktTab.swift — Innsikt-fane: AI-analyse av samtaler, mønstre, trender (2026-07-01)
//
// Hero m/ Marit's ukentlige innsikt, 4 KPI-tiles, pondus-trend-graf, tema-clustring,
// "det som virker / virker ikke", selger-leaderboard, tid-distribusjon, topp/bunn-eksempler.

import SwiftUI
import Charts

struct LeadbookInnsiktView: View {
    @Environment(AppState.self) private var appState
    @State private var period: Period = .d30
    @State private var sellerFilter: PondusCast?
    @State private var favorited: Bool = true
    @State private var showFullReport = false
    @State private var toast: String?
    @State private var openExample: LeadbookExample?

    // Ekte innsikt (2026-08-02): backend-aggregering av org-ens publiserte
    // eksempler. Demo-modus beholder mock-dashboardet urørt.
    @State private var innsikt: APIClient.LeadbookInnsiktDTO?
    @State private var innsiktLoading = false
    @State private var innsiktError: String?
    @State private var openingCaseId: String?

    enum Period: String, CaseIterable, Identifiable {
        case d7 = "7 dager"
        case d30 = "30 dager"
        case d90 = "90 dager"
        case ytd = "Hittil i år"
        var id: String { rawValue }

        var apiValue: String {
            switch self {
            case .d7: return "7d"
            case .d30: return "30d"
            case .d90: return "90d"
            case .ytd: return "ytd"
            }
        }
    }

    var body: some View {
        VStack(spacing: 14) {
            insiktHeader
            if DemoModeManager.isActiveNonisolated {
                // Demo: mock-dashbordet (cast-basert), uendret.
                maritHeroCard
                kpiRow
                HStack(alignment: .top, spacing: 14) {
                    trendChartCard.frame(maxWidth: .infinity)
                    temaClusterCard.frame(maxWidth: .infinity)
                }
                HStack(alignment: .top, spacing: 14) {
                    worksCard.frame(maxWidth: .infinity)
                    doesNotWorkCard.frame(maxWidth: .infinity)
                }
                leaderboardCard
                timeDistributionCard
                topBottomCasesRow
            } else if let inn = innsikt, inn.totals.examples > 0 {
                // Ekte innsikt fra backend-aggregeringen.
                realKpiRow(inn)
                HStack(alignment: .top, spacing: 14) {
                    realTrendCard(inn).frame(maxWidth: .infinity)
                    realDimensionCard(inn).frame(maxWidth: .infinity)
                }
                realLeaderboardCard(inn)
                if !inn.byChannel.isEmpty { realChannelCard(inn) }
                realCasesRow(inn)
                Text("Basert på \(inn.totals.examples) publiserte eksempler i perioden — registrer flere samtaler for rikere innsikt.")
                    .font(.appScaled(size: 10))
                    .foregroundStyle(LBrand.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else if innsiktLoading {
                VStack(spacing: 10) {
                    ProgressView().tint(LBrand.purpleLight)
                    Text("Henter innsikt …")
                        .font(.appScaled(size: 12))
                        .foregroundStyle(LBrand.textSecondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 70)
            } else {
                VStack(spacing: 10) {
                    Image(systemName: "chart.bar.doc.horizontal")
                        .font(.appScaled(size: 32, weight: .semibold))
                        .foregroundStyle(LBrand.textTertiary)
                    Text(innsiktError == nil ? "Ingen innsikt enda" : "Kunne ikke hente innsikt")
                        .font(.appScaled(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                    Text(innsiktError
                         ?? "Innsikten fylles når teamet publiserer eksempler i valgt periode — prøv en lengre periode, eller registrer samtaler i Eksempler.")
                        .font(.appScaled(size: 12))
                        .foregroundStyle(LBrand.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 30)
                    if innsiktError != nil {
                        Button { Task { await loadInnsikt() } } label: {
                            Text("Prøv igjen")
                                .font(.appScaled(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                                .padding(.horizontal, 14).padding(.vertical, 8)
                                .background(LBrand.purple, in: Capsule())
                        }.buttonStyle(.plain)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 70)
            }
            Color.clear.frame(height: 20)
        }
        .task(id: period) { await loadInnsikt() }
        .overlay(alignment: .top) {
            if let t = toast {
                Label(t, systemImage: "checkmark.circle.fill")
                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(LBrand.green, in: Capsule())
                    .padding(.top, 6)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
        .sheet(isPresented: $showFullReport) {
            FullInsiktReportSheet(
                innsikt: DemoModeManager.isActiveNonisolated ? nil : innsikt,
                periodLabel: period.rawValue
            )
        }
        .sheet(item: $openExample) { ex in LeadbookExampleDetailSheet(example: ex) }
    }

    // MARK: Header

    private var insiktHeader: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 9) {
                    Text("Leadbook — Innsikt")
                        .font(.appScaled(size: 22, weight: .bold)).foregroundStyle(.white)
                    Button { favorited.toggle() } label: {
                        Image(systemName: favorited ? "star.fill" : "star")
                            .font(.appScaled(size: 16, weight: .semibold))
                            .foregroundStyle(favorited ? LBrand.yellow : LBrand.textTertiary)
                    }.buttonStyle(.plain)
                    HStack(spacing: 4) {
                        Image(systemName: "sparkles").font(.appScaled(size: 10, weight: .bold))
                        Text("AI-KURATERT").font(.appScaled(size: 9, weight: .black))
                    }
                    .foregroundStyle(LBrand.purpleLight).tracking(0.6)
                    .padding(.horizontal, 7).padding(.vertical, 3)
                    .background(LBrand.purple.opacity(0.18), in: Capsule())
                    .overlay(Capsule().stroke(LBrand.purpleLight.opacity(0.45), lineWidth: 1))
                }
                Text("Pondus-mønstre, tema-clustring og selger-trender — automatisk oppdaget av AI.")
                    .font(.appScaled(size: 12)).foregroundStyle(LBrand.textSecondary)
                    .lineLimit(2)
            }
            Spacer(minLength: 12)
            HStack(spacing: 8) {
                // Perioden gjelder nå BEGGE moduser (2026-08-02): i ekte
                // modus sendes den som query-param til backend-aggregeringen.
                Menu {
                    ForEach(Period.allCases) { p in
                        Button(p.rawValue) { period = p }
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "calendar").font(.appScaled(size: 11, weight: .bold))
                            .foregroundStyle(LBrand.orange)
                        Text(period.rawValue).font(.appScaled(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                        Image(systemName: "chevron.down").font(.appScaled(size: 9, weight: .bold))
                            .foregroundStyle(LBrand.textTertiary)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                }
                // «Send rapport» fjernet 2026-07-17: var død knapp — kun
                // toast, ingen rapport-utsendelse bak.
                // «Full rapport» + PDF-eksport (2026-08-16): ekte i begge
                // moduser nå — demo viser eksempeldata, ekte modus krever
                // at innsikt faktisk er lastet (samme datakrav som kortene).
                if DemoModeManager.isActiveNonisolated || (innsikt?.totals.examples ?? 0) > 0 {
                Button { showFullReport = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "doc.text.fill").font(.appScaled(size: 11, weight: .bold))
                        Text("Full rapport").font(.appScaled(size: 13, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 9)
                    .background(
                        LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                       startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                    .shadow(color: LBrand.purple.opacity(0.45), radius: 6, y: 2)
                }.buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: Ekte innsikt (2026-08-02)

    @MainActor
    private func loadInnsikt() async {
        guard !DemoModeManager.isActiveNonisolated, let api = appState.api else { return }
        innsiktLoading = true
        innsiktError = nil
        do {
            innsikt = try await api.fetchLeadbookInnsikt(period: period.apiValue)
        } catch {
            let msg = String(describing: error)
            innsiktError = msg.contains("entitlement_locked")
                ? "Eksempler-modulen er ikke aktivert for organisasjonen."
                : "Sjekk nettverket og prøv igjen."
        }
        innsiktLoading = false
    }

    private func realKpiRow(_ inn: APIClient.LeadbookInnsiktDTO) -> some View {
        HStack(spacing: 12) {
            realKpiTile(label: "SNITT PONDUS",
                        value: inn.totals.avgPondus.map(String.init) ?? "—",
                        delta: pondusDelta(inn),
                        icon: "circle.hexagongrid.fill", tint: LBrand.purpleLight)
            realKpiTile(label: "VINN-RATE",
                        value: inn.totals.winRate.map(percent) ?? "—",
                        delta: winRateDelta(inn),
                        icon: "checkmark.seal.fill", tint: LBrand.green)
            realKpiTile(label: "EKSEMPLER I PERIODEN",
                        value: "\(inn.totals.examples)",
                        delta: countDelta(inn),
                        icon: "waveform", tint: LBrand.blue)
            realKpiTile(label: "TILBAKEMELDINGER",
                        value: "\(inn.totals.feedback ?? 0)",
                        delta: nil,
                        icon: "bubble.left.and.text.bubble.right.fill", tint: LBrand.orange)
        }
    }

    /// Delta-tekst (+/-) mot forrige like lange periode; nil når forrige
    /// periode mangler data (vises som «ingen sammenligning»).
    private func pondusDelta(_ inn: APIClient.LeadbookInnsiktDTO) -> (String, Bool)? {
        guard let now = inn.totals.avgPondus, let prev = inn.previous.avgPondus else { return nil }
        let d = now - prev
        return ("\(d >= 0 ? "+" : "−")\(abs(d))", d >= 0)
    }

    private func winRateDelta(_ inn: APIClient.LeadbookInnsiktDTO) -> (String, Bool)? {
        guard let now = inn.totals.winRate, let prev = inn.previous.winRate else { return nil }
        let pp = (now - prev) * 100
        let txt = String(format: "%.1f pp", abs(pp)).replacingOccurrences(of: ".", with: ",")
        return ("\(pp >= 0 ? "+" : "−")\(txt)", pp >= 0)
    }

    private func countDelta(_ inn: APIClient.LeadbookInnsiktDTO) -> (String, Bool)? {
        let prev = inn.previous.examples
        guard prev > 0 else { return nil }
        let d = inn.totals.examples - prev
        return ("\(d >= 0 ? "+" : "−")\(abs(d))", d >= 0)
    }

    private func realKpiTile(label: String, value: String, delta: (String, Bool)?,
                             icon: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(tint)
                Text(label).font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            Text(value).font(.appScaled(size: 24, weight: .heavy, design: .rounded))
                .foregroundStyle(.white).monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.7)
            if let (text, up) = delta {
                HStack(spacing: 4) {
                    Image(systemName: up ? "arrow.up.right" : "arrow.down.right")
                        .font(.appScaled(size: 9, weight: .bold))
                    Text(text).font(.appScaled(size: 10, weight: .bold, design: .rounded))
                    Text("vs forrige periode").font(.appScaled(size: 9))
                        .foregroundStyle(LBrand.textTertiary)
                }
                .foregroundStyle(up ? LBrand.green : LBrand.red)
            } else {
                Text("ingen sammenligning enda")
                    .font(.appScaled(size: 9))
                    .foregroundStyle(LBrand.textTertiary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func realTrendCard(_ inn: APIClient.LeadbookInnsiktDTO) -> some View {
        let points = inn.trend.filter { $0.avgPondus != nil }
        return VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text("PONDUS-TREND")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                Text("Snitt per dag · \(period.rawValue.lowercased())")
                    .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
            }
            if points.count >= 2 {
                Chart(points) { p in
                    LineMark(x: .value("Dag", shortDay(p.day)),
                             y: .value("Pondus", p.avgPondus ?? 0))
                        .foregroundStyle(LBrand.purpleLight)
                        .interpolationMethod(.catmullRom)
                        .lineStyle(StrokeStyle(lineWidth: 2))
                    PointMark(x: .value("Dag", shortDay(p.day)),
                              y: .value("Pondus", p.avgPondus ?? 0))
                        .foregroundStyle(LBrand.purpleLight)
                        .symbolSize(20)
                }
                .chartYScale(domain: 0...100)
                .chartXAxis {
                    AxisMarks { _ in
                        AxisValueLabel().foregroundStyle(LBrand.textTertiary)
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { _ in
                        AxisGridLine().foregroundStyle(LBrand.stroke.opacity(0.3))
                        AxisValueLabel().foregroundStyle(LBrand.textTertiary)
                    }
                }
                .frame(height: 180)
            } else {
                Text("Trenden tegnes når minst to dager har eksempler med Pondus-score.")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LBrand.textTertiary)
                    .frame(maxWidth: .infinity, minHeight: 180)
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func shortDay(_ isoDay: String) -> String {
        // "2026-08-02" → "2/8"
        let parts = isoDay.split(separator: "-")
        guard parts.count == 3, let m = Int(parts[1]), let d = Int(parts[2]) else { return isoDay }
        return "\(d)/\(m)"
    }

    private func realDimensionCard(_ inn: APIClient.LeadbookInnsiktDTO) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text("PONDUS-DIMENSJONER")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                Text("Hvilke dimensjoner eksemplene lærer bort")
                    .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
            }
            if inn.byDimension.isEmpty {
                Text("Sett «featured dimension» på eksemplene for å se fordelingen.")
                    .font(.appScaled(size: 11))
                    .foregroundStyle(LBrand.textTertiary)
                    .frame(maxWidth: .infinity, minHeight: 120, alignment: .center)
            } else {
                VStack(spacing: 6) {
                    ForEach(inn.byDimension) { row in
                        HStack(spacing: 10) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 7)
                                    .fill(LBrand.purple.opacity(0.22))
                                Image(systemName: dimensionIcon(row.dimension))
                                    .font(.appScaled(size: 11, weight: .bold))
                                    .foregroundStyle(LBrand.purpleLight)
                            }
                            .frame(width: 28, height: 28)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(row.dimension.capitalized)
                                    .font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                                Text("\(row.count) eksempler").font(.appScaled(size: 9))
                                    .foregroundStyle(LBrand.textTertiary)
                            }
                            Spacer()
                            if let avg = row.avgPondus {
                                VStack(alignment: .trailing, spacing: 1) {
                                    Text("\(avg)")
                                        .font(.appScaled(size: 13, weight: .bold, design: .rounded))
                                        .foregroundStyle(.white).monospacedDigit()
                                    Text("SNITT").font(.appScaled(size: 7, weight: .black))
                                        .foregroundStyle(LBrand.textTertiary).tracking(0.5)
                                }
                            }
                        }
                        .padding(.vertical, 5)
                    }
                }
            }
        }
        .padding(14)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func dimensionIcon(_ raw: String) -> String {
        switch raw.lowercased() {
        case "autoritet": return "person.fill"
        case "klarhet": return "scope"
        case "troverdighet": return "checkmark.seal.fill"
        case "trygghet": return "shield.fill"
        case "fremdrift": return "arrow.right.circle.fill"
        default: return "circle.hexagongrid.fill"
        }
    }

    private func realLeaderboardCard(_ inn: APIClient.LeadbookInnsiktDTO) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text("SELGERE I EKSEMPLENE")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                Text("Pondus-snitt og utfall · siste \(period.rawValue.lowercased())")
                    .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
            }
            VStack(spacing: 8) {
                ForEach(Array(inn.bySeller.enumerated()), id: \.element.id) { idx, seller in
                    HStack(spacing: 12) {
                        ZStack {
                            Circle().fill(idx == 0 ? LBrand.yellow.opacity(0.25) : LBrand.cardHi)
                            Text("\(idx + 1)")
                                .font(.appScaled(size: 12, weight: .heavy, design: .rounded))
                                .foregroundStyle(idx == 0 ? LBrand.yellow : LBrand.textSecondary)
                        }
                        .frame(width: 32, height: 32)
                        ZStack {
                            Circle().fill(LBrand.purple.opacity(0.25))
                            Text(initials(seller.name))
                                .font(.appScaled(size: 11, weight: .bold))
                                .foregroundStyle(LBrand.purpleLight)
                        }
                        .frame(width: 36, height: 36)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(seller.name)
                                .font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                            Text(seller.winRate.map {
                                "\(seller.count) eksempler · \(percent($0)) vinn-rate"
                            } ?? "\(seller.count) eksempler")
                                .font(.appScaled(size: 10)).foregroundStyle(LBrand.textSecondary)
                        }
                        Spacer()
                        if let avg = seller.avgPondus {
                            VStack(alignment: .trailing, spacing: 1) {
                                Text("\(avg)")
                                    .font(.appScaled(size: 18, weight: .heavy, design: .rounded))
                                    .foregroundStyle(.white).monospacedDigit()
                                Text("PONDUS").font(.appScaled(size: 7, weight: .black))
                                    .foregroundStyle(LBrand.textTertiary).tracking(0.5)
                            }
                        }
                    }
                    .padding(.vertical, 6).padding(.horizontal, 10)
                    .background(LBrand.cardHi.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
                }
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func initials(_ name: String) -> String {
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return name.isEmpty ? "?" : String(name.prefix(2)).uppercased()
    }

    private func realChannelCard(_ inn: APIClient.LeadbookInnsiktDTO) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("KANAL-FORDELING")
                .font(.appScaled(size: 10, weight: .black))
                .foregroundStyle(LBrand.textTertiary).tracking(0.8)
            HStack(spacing: 10) {
                ForEach(inn.byChannel) { row in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(channelLabel(row.channel))
                            .font(.appScaled(size: 11, weight: .bold)).foregroundStyle(.white)
                        Text("\(row.count) eksempler")
                            .font(.appScaled(size: 9)).foregroundStyle(LBrand.textTertiary)
                        if row.won + row.lost > 0 {
                            Text(percent(Double(row.won) / Double(row.won + row.lost)) + " vinn")
                                .font(.appScaled(size: 10, weight: .bold, design: .rounded))
                                .foregroundStyle(LBrand.green)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(LBrand.cardHi.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
                }
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func channelLabel(_ raw: String) -> String {
        switch raw.lowercased() {
        case "telephone", "phone": return "Telefon"
        case "field": return "Feltbesøk"
        case "email": return "E-post"
        case "video": return "Video"
        default: return raw.capitalized
        }
    }

    private func realCasesRow(_ inn: APIClient.LeadbookInnsiktDTO) -> some View {
        HStack(alignment: .top, spacing: 14) {
            if let top = inn.topExample {
                realCaseCard(label: "PERIODENS BESTE EKSEMPEL", tint: LBrand.green,
                             icon: "trophy.fill", caseRow: top)
            }
            if let bottom = inn.bottomExample {
                realCaseCard(label: "PERIODENS LÆRINGSCASE", tint: LBrand.red,
                             icon: "lightbulb.fill", caseRow: bottom)
            }
        }
    }

    private func realCaseCard(label: String, tint: Color, icon: String,
                              caseRow: APIClient.LeadbookInnsiktDTO.CaseRow) -> some View {
        Button { Task { await openCase(id: caseRow.id) } } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) {
                    Image(systemName: icon).foregroundStyle(tint)
                    Text(label).font(.appScaled(size: 9, weight: .black))
                        .foregroundStyle(tint).tracking(0.6)
                    Spacer()
                    if openingCaseId == caseRow.id {
                        ProgressView().tint(tint).scaleEffect(0.7)
                    }
                }
                Text(caseRow.title)
                    .font(.appScaled(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                HStack(spacing: 8) {
                    Text("Pondus")
                        .font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
                    Text("\(caseRow.pondusScore ?? 0)")
                        .font(.appScaled(size: 22, weight: .heavy, design: .rounded))
                        .foregroundStyle(tint)
                        .monospacedDigit()
                    Spacer()
                }
                if let summary = caseRow.summary, !summary.isEmpty {
                    Text(summary).font(.appScaled(size: 11))
                        .foregroundStyle(LBrand.textSecondary)
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                HStack(spacing: 5) {
                    Image(systemName: "arrow.right.circle.fill").font(.appScaled(size: 11))
                    Text("Åpne eksempelet").font(.appScaled(size: 11, weight: .bold))
                }
                .foregroundStyle(tint)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(tint.opacity(0.3), lineWidth: 1))
        }.buttonStyle(.plain)
    }

    /// Hent full-eksempelet og åpne detalj-sheeten (innsikt-endepunktet
    /// returnerer kun sammendrags-felter).
    @MainActor
    private func openCase(id: String) async {
        guard let api = appState.api, openingCaseId == nil else { return }
        openingCaseId = id
        defer { openingCaseId = nil }
        do {
            let resp = try await api.fetchLeadbookExamples()
            if let dto = resp.examples.first(where: { $0.id == id }) {
                openExample = LeadbookExample.fromDTO(dto)
            } else {
                flash("Fant ikke eksempelet — det kan være arkivert")
            }
        } catch {
            flash("Kunne ikke åpne eksempelet")
        }
    }

    // MARK: Marit-hero

    private var maritHeroCard: some View {
        HStack(alignment: .top, spacing: 16) {
            SmartPortrait(assetName: "portrait-marit")
                .frame(width: 72, height: 72)
                .overlay(Circle().stroke(LBrand.purpleLight.opacity(0.5), lineWidth: 2))
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text("MARIT'S UKENTLIGE INNSIKT")
                        .font(.appScaled(size: 10, weight: .black))
                        .foregroundStyle(LBrand.purpleLight).tracking(0.8)
                    Text("·").foregroundStyle(LBrand.textTertiary)
                    Text("OPPDATERT 1. JULI")
                        .font(.appScaled(size: 9, weight: .bold))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                }
                Text("Maria's 4-sekunders pause på pris-innvendinger driver pondus opp 8 poeng denne uka")
                    .font(.appScaled(size: 17, weight: .heavy))
                    .foregroundStyle(.white)
                    .lineLimit(3)
                Text("Hun har gjentatt mønsteret 11 ganger på 14 samtaler. To andre i teamet har begynt å imitere — pondus-snitt steg fra 78 til 82 på 7 dager. Rull ut som «mester-mønster» til hele teamet?")
                    .font(.appScaled(size: 13))
                    .foregroundStyle(LBrand.textSecondary)
                    .lineLimit(3)
                // «Rull ut til team» + «Hør Maria's samtale» fjernet
                // 2026-07-17: var døde knapper — kun toast/tom closure,
                // ingen utrullings- eller avspillings-flate.
            }
            Spacer(minLength: 0)
        }
        .padding(16)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(LBrand.purple.opacity(0.30), lineWidth: 1))
    }

    // MARK: KPI Row

    private var kpiRow: some View {
        HStack(spacing: 12) {
            kpiTile(label: "SNITT PONDUS", value: "82", trend: "+4", icon: "circle.hexagongrid.fill", tint: LBrand.purpleLight)
            kpiTile(label: "VINN-RATE", value: "28,6 %", trend: "+3,4 pp", icon: "checkmark.seal.fill", tint: LBrand.green)
            kpiTile(label: "SAMTALER ANALYSERT", value: "1 082", trend: "+18 %", icon: "waveform", tint: LBrand.blue)
            kpiTile(label: "TOPP MAL", value: "Møtebooking", trend: "41 %", icon: "doc.fill", tint: LBrand.orange, valueSize: 15)
        }
    }

    private func kpiTile(label: String, value: String, trend: String, icon: String, tint: Color, valueSize: CGFloat = 24) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(tint)
                Text(label).font(.appScaled(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            Text(value).font(.appScaled(size: valueSize, weight: .heavy, design: .rounded))
                .foregroundStyle(.white).monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.7)
            HStack(spacing: 4) {
                Image(systemName: "arrow.up.right").font(.appScaled(size: 9, weight: .bold))
                Text(trend).font(.appScaled(size: 10, weight: .bold, design: .rounded))
                Text("vs forrige periode").font(.appScaled(size: 9))
                    .foregroundStyle(LBrand.textTertiary)
            }
            .foregroundStyle(LBrand.green)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(LBrand.stroke, lineWidth: 1))
    }

    // MARK: Trend chart card

    private struct TrendPoint: Identifiable {
        let id = UUID()
        let day: Int
        let value: Double
        let seller: String
    }

    private var trendData: [TrendPoint] {
        let team = ["Maria L", "Lars K", "Espen B", "Anders S"]
        let baseValues: [Double] = [78, 76, 73, 65]
        var pts: [TrendPoint] = []
        for (idx, name) in team.enumerated() {
            for day in 0..<30 {
                let trend = Double(day) * 0.15 * (idx == 0 ? 1.5 : 1.0)
                let noise = Double.random(in: -3...3)
                pts.append(TrendPoint(day: day, value: baseValues[idx] + trend + noise, seller: name))
            }
        }
        return pts
    }

    private var trendChartCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("PONDUS-TREND")
                        .font(.appScaled(size: 10, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                    Text("Per selger · siste 30 dager")
                        .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                }
                Spacer()
                Text("+12 %").font(.appScaled(size: 14, weight: .bold, design: .rounded))
                    .foregroundStyle(LBrand.green)
            }
            Chart(trendData) { p in
                LineMark(x: .value("Dag", p.day), y: .value("Pondus", p.value))
                    .foregroundStyle(by: .value("Selger", p.seller))
                    .interpolationMethod(.catmullRom)
                    .lineStyle(StrokeStyle(lineWidth: 2))
            }
            .chartForegroundStyleScale([
                "Maria L": LBrand.purpleLight,
                "Lars K":  LBrand.green,
                "Espen B": LBrand.orange,
                "Anders S": LBrand.blue
            ])
            .chartYScale(domain: 60...95)
            .chartXAxis {
                AxisMarks(values: [0, 7, 14, 21, 29]) { v in
                    AxisGridLine().foregroundStyle(LBrand.stroke.opacity(0.3))
                    AxisValueLabel().foregroundStyle(LBrand.textTertiary)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) { _ in
                    AxisGridLine().foregroundStyle(LBrand.stroke.opacity(0.3))
                    AxisValueLabel().foregroundStyle(LBrand.textTertiary)
                }
            }
            .chartLegend(position: .bottom, alignment: .leading, spacing: 6)
            .frame(height: 180)
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.stroke, lineWidth: 1))
    }

    // MARK: Tema-clustring

    private struct Tema: Identifiable {
        let id = UUID()
        let name: String
        let count: Int
        let conversion: Double
        let trend: Double
        let icon: String
        let tint: Color
    }

    private let temaer: [Tema] = [
        Tema(name: "Pris-innvending", count: 142, conversion: 0.31, trend: 0.08, icon: "creditcard.fill", tint: LBrand.green),
        Tema(name: "Behovsavdekking", count: 218, conversion: 0.42, trend: 0.05, icon: "questionmark.circle.fill", tint: LBrand.purpleLight),
        Tema(name: "Møtebooking", count: 187, conversion: 0.38, trend: 0.12, icon: "calendar.badge.checkmark", tint: LBrand.blue),
        Tema(name: "Beslutningstaker", count: 94, conversion: 0.22, trend: -0.04, icon: "person.badge.shield.checkmark.fill", tint: LBrand.orange),
        Tema(name: "Cold outreach", count: 156, conversion: 0.18, trend: 0.02, icon: "envelope.fill", tint: LBrand.pink),
        Tema(name: "Re-engasjement", count: 67, conversion: 0.45, trend: 0.18, icon: "arrow.uturn.right.circle.fill", tint: LBrand.yellow)
    ]

    private var temaClusterCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("TEMA-CLUSTRING")
                        .font(.appScaled(size: 10, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                    Text("AI grupperer samtaler automatisk")
                        .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                }
                Spacer()
                Image(systemName: "sparkles").foregroundStyle(LBrand.purpleLight)
            }
            VStack(spacing: 6) {
                ForEach(temaer.prefix(6)) { tema in
                    HStack(spacing: 10) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 7).fill(tema.tint.opacity(0.22))
                            Image(systemName: tema.icon).font(.appScaled(size: 11, weight: .bold))
                                .foregroundStyle(tema.tint)
                        }
                        .frame(width: 28, height: 28)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(tema.name).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                            Text("\(tema.count) samtaler").font(.appScaled(size: 9))
                                .foregroundStyle(LBrand.textTertiary)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(percent(tema.conversion))
                                .font(.appScaled(size: 13, weight: .bold, design: .rounded))
                                .foregroundStyle(.white).monospacedDigit()
                            HStack(spacing: 2) {
                                Image(systemName: tema.trend >= 0 ? "arrow.up" : "arrow.down")
                                    .font(.appScaled(size: 7, weight: .black))
                                Text(percent(abs(tema.trend)))
                                    .font(.appScaled(size: 9, weight: .bold, design: .rounded)).monospacedDigit()
                            }
                            .foregroundStyle(tema.trend >= 0 ? LBrand.green : LBrand.red)
                        }
                    }
                    .padding(.vertical, 5)
                }
            }
        }
        .padding(14)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.stroke, lineWidth: 1))
    }

    // MARK: Det som virker / virker ikke

    private var worksCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 7) {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(LBrand.green)
                Text("DET SOM VIRKER")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.green).tracking(0.8)
            }
            VStack(spacing: 10) {
                workRow("4-sekunders pause etter prisinnvending",
                        impact: "+14 pondus", icon: "pause.fill", color: LBrand.green)
                workRow("Refleksjon-spørsmål før behov avdekkes",
                        impact: "+9 pondus", icon: "questionmark.bubble.fill", color: LBrand.green)
                workRow("Kundecase med tall i åpningsreplikk",
                        impact: "+11 pondus", icon: "chart.line.uptrend.xyaxis", color: LBrand.green)
                workRow("Bekreftet neste-steg med dato + tid",
                        impact: "+7 pondus", icon: "calendar.badge.checkmark", color: LBrand.green)
            }
        }
        .padding(14)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(LBrand.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.green.opacity(0.3), lineWidth: 1))
    }

    private var doesNotWorkCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 7) {
                Image(systemName: "xmark.octagon.fill").foregroundStyle(LBrand.red)
                Text("DET SOM IKKE VIRKER")
                    .font(.appScaled(size: 10, weight: .black))
                    .foregroundStyle(LBrand.red).tracking(0.8)
            }
            VStack(spacing: 10) {
                workRow("«Beklager at jeg forstyrrer»-åpning",
                        impact: "−12 pondus", icon: "xmark.bubble.fill", color: LBrand.red)
                workRow("Demo før behov er avdekket",
                        impact: "−15 pondus", icon: "rectangle.dashed.fill", color: LBrand.red)
                workRow("«Vi tar kontakt»-avslutning uten dato",
                        impact: "−9 pondus", icon: "ellipsis.circle.fill", color: LBrand.red)
                workRow("Avhørs-stil med 5+ spørsmål på rad",
                        impact: "−7 pondus", icon: "questionmark.diamond.fill", color: LBrand.red)
            }
        }
        .padding(14)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(LBrand.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.red.opacity(0.3), lineWidth: 1))
    }

    private func workRow(_ text: String, impact: String, icon: String, color: Color) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon).font(.appScaled(size: 12, weight: .bold))
                .foregroundStyle(color).frame(width: 18)
            VStack(alignment: .leading, spacing: 2) {
                Text(text).font(.appScaled(size: 12, weight: .semibold)).foregroundStyle(.white)
                Text(impact)
                    .font(.appScaled(size: 10, weight: .bold, design: .rounded))
                    .foregroundStyle(color)
            }
            Spacer()
        }
    }

    // MARK: Leaderboard

    private struct Seller: Identifiable {
        let id = UUID()
        let cast: PondusCast
        let pondus: Int
        let calls: Int
        let conversion: Double
        let trend: Int
    }

    private let leaderboard: [Seller] = [
        Seller(cast: .marit, pondus: 89, calls: 142, conversion: 0.34, trend: 7),
        Seller(cast: .lars, pondus: 85, calls: 118, conversion: 0.31, trend: 3),
        Seller(cast: .aaron, pondus: 81, calls: 96, conversion: 0.26, trend: 5),
        Seller(cast: .sofie, pondus: 78, calls: 87, conversion: 0.24, trend: -2),
        Seller(cast: .espen, pondus: 72, calls: 124, conversion: 0.21, trend: 1)
    ]

    private var leaderboardCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("SELGER-LEADERBOARD")
                        .font(.appScaled(size: 10, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                    Text("Pondus + konvertering · siste \(period.rawValue.lowercased())")
                        .font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                }
                Spacer()
                // «Se alle» fjernet 2026-07-17: var død knapp — ingen full
                // leaderboard-flate å navigere til.
            }
            VStack(spacing: 8) {
                ForEach(Array(leaderboard.enumerated()), id: \.element.id) { idx, seller in
                    leaderboardRow(rank: idx + 1, seller: seller)
                }
            }
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.stroke, lineWidth: 1))
    }

    private func leaderboardRow(rank: Int, seller: Seller) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(rank == 1 ? LBrand.yellow.opacity(0.25) : LBrand.cardHi)
                Text("\(rank)")
                    .font(.appScaled(size: 12, weight: .heavy, design: .rounded))
                    .foregroundStyle(rank == 1 ? LBrand.yellow : LBrand.textSecondary)
                if rank == 1 {
                    Image(systemName: "crown.fill")
                        .font(.appScaled(size: 8, weight: .black))
                        .foregroundStyle(LBrand.yellow)
                        .offset(y: -16)
                }
            }
            .frame(width: 32, height: 32)
            SmartPortrait(assetName: seller.cast.assetName)
                .frame(width: 36, height: 36)
                .overlay(Circle().stroke(LBrand.stroke, lineWidth: 1))
            VStack(alignment: .leading, spacing: 2) {
                Text(seller.cast.displayName)
                    .font(.appScaled(size: 13, weight: .bold)).foregroundStyle(.white)
                Text("\(seller.calls) samtaler · \(percent(seller.conversion)) konvertering")
                    .font(.appScaled(size: 10)).foregroundStyle(LBrand.textSecondary)
            }
            Spacer()
            HStack(spacing: 8) {
                VStack(alignment: .trailing, spacing: 1) {
                    Text("\(seller.pondus)")
                        .font(.appScaled(size: 18, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white).monospacedDigit()
                    Text("PONDUS").font(.appScaled(size: 7, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.5)
                }
                HStack(spacing: 2) {
                    Image(systemName: seller.trend >= 0 ? "arrow.up" : "arrow.down")
                        .font(.appScaled(size: 8, weight: .black))
                    Text("\(abs(seller.trend))")
                        .font(.appScaled(size: 10, weight: .bold, design: .rounded)).monospacedDigit()
                }
                .foregroundStyle(seller.trend >= 0 ? LBrand.green : LBrand.red)
                .padding(.horizontal, 6).padding(.vertical, 3)
                .background((seller.trend >= 0 ? LBrand.green : LBrand.red).opacity(0.16), in: Capsule())
            }
        }
        .padding(.vertical, 6).padding(.horizontal, 10)
        .background(LBrand.cardHi.opacity(0.5), in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: Time distribution

    private struct HourBucket: Identifiable {
        let id = UUID()
        let hour: String
        let calls: Int
        let conversion: Double
    }

    private let hourBuckets: [HourBucket] = [
        HourBucket(hour: "08", calls: 32, conversion: 0.21),
        HourBucket(hour: "09", calls: 68, conversion: 0.36),
        HourBucket(hour: "10", calls: 94, conversion: 0.41),
        HourBucket(hour: "11", calls: 78, conversion: 0.38),
        HourBucket(hour: "12", calls: 24, conversion: 0.18),
        HourBucket(hour: "13", calls: 56, conversion: 0.27),
        HourBucket(hour: "14", calls: 82, conversion: 0.33),
        HourBucket(hour: "15", calls: 71, conversion: 0.29),
        HourBucket(hour: "16", calls: 43, conversion: 0.22),
        HourBucket(hour: "17", calls: 18, conversion: 0.14)
    ]

    private var timeDistributionCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("KONVERTERING PER TID PÅ DAGEN")
                        .font(.appScaled(size: 10, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                    Text("kl. 10–11 vinner stort — book viktige samtaler der")
                        .font(.appScaled(size: 11)).foregroundStyle(LBrand.purpleLight)
                }
                Spacer()
            }
            Chart(hourBuckets) { b in
                BarMark(x: .value("Tid", b.hour), y: .value("Konvertering", b.conversion))
                    .foregroundStyle(
                        b.conversion > 0.35 ? LBrand.green :
                        b.conversion > 0.25 ? LBrand.purpleLight :
                        LBrand.orange.opacity(0.7)
                    )
                    .cornerRadius(4)
            }
            .chartYAxis {
                AxisMarks(position: .leading) { v in
                    AxisGridLine().foregroundStyle(LBrand.stroke.opacity(0.3))
                    AxisValueLabel {
                        if let val = v.as(Double.self) {
                            Text("\(Int(val * 100))%")
                                .font(.appScaled(size: 9))
                                .foregroundStyle(LBrand.textTertiary)
                        }
                    }
                }
            }
            .chartXAxis {
                AxisMarks { _ in
                    AxisValueLabel().foregroundStyle(LBrand.textTertiary)
                }
            }
            .frame(height: 140)
        }
        .padding(14)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 13))
        .overlay(RoundedRectangle(cornerRadius: 13).stroke(LBrand.stroke, lineWidth: 1))
    }

    // MARK: Top + bottom eksempler

    private var topBottomCasesRow: some View {
        HStack(alignment: .top, spacing: 14) {
            caseHighlight(
                label: "UKAS BESTE SAMTALE",
                tint: LBrand.green,
                example: LeadbookExampleData.examples.first { $0.outcome == .won }
            )
            caseHighlight(
                label: "UKAS LÆRINGSCASE",
                tint: LBrand.red,
                example: LeadbookExampleData.examples.first { $0.outcome == .lost }
            )
        }
    }

    private func caseHighlight(label: String, tint: Color, example: LeadbookExample?) -> some View {
        Group {
            if let ex = example {
                Button { openExample = ex } label: {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 6) {
                            Image(systemName: ex.outcome == .won ? "trophy.fill" : "lightbulb.fill")
                                .foregroundStyle(tint)
                            Text(label).font(.appScaled(size: 9, weight: .black))
                                .foregroundStyle(tint).tracking(0.6)
                        }
                        Text(ex.title)
                            .font(.appScaled(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        HStack(spacing: 8) {
                            Text("Pondus")
                                .font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
                            Text("\(ex.pondusScore)")
                                .font(.appScaled(size: 22, weight: .heavy, design: .rounded))
                                .foregroundStyle(tint)
                                .monospacedDigit()
                            Spacer()
                            HStack(spacing: 4) {
                                Image(systemName: ex.outcome.icon).font(.appScaled(size: 9, weight: .bold))
                                Text(ex.outcome.rawValue.uppercased())
                                    .font(.appScaled(size: 9, weight: .black))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 7).padding(.vertical, 3)
                            .background(ex.outcome.color, in: Capsule())
                        }
                        Text(ex.summary).font(.appScaled(size: 11))
                            .foregroundStyle(LBrand.textSecondary)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        HStack(spacing: 5) {
                            Image(systemName: "arrow.right.circle.fill").font(.appScaled(size: 11))
                            Text("Spill av samtalen").font(.appScaled(size: 11, weight: .bold))
                        }
                        .foregroundStyle(tint)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(LBrand.card, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(tint.opacity(0.3), lineWidth: 1))
                }.buttonStyle(.plain)
            }
        }
    }

    // MARK: Helpers

    private func percent(_ v: Double) -> String {
        let p = v * 100
        if p.truncatingRemainder(dividingBy: 1) == 0 { return "\(Int(p)) %" }
        return String(format: "%.1f %%", p).replacingOccurrences(of: ".", with: ",")
    }

    private func flash(_ text: String) {
        toast = text
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
            if toast == text { toast = nil }
        }
    }
}

// MARK: - FullInsiktReportSheet

/// Full innsikt-rapport + PDF-eksport (2026-08-16). `innsikt == nil` betyr
/// demo-modus — viser en tydelig merket eksempelrapport (samme tall som
/// før, men ikke lenger fremstilt som om de er ekte). Ekte modus bygger
/// alle tall fra samme `LeadbookInnsiktDTO` som kortene på selve fanen.
struct FullInsiktReportSheet: View {
    @Environment(\.dismiss) private var dismiss
    let innsikt: APIClient.LeadbookInnsiktDTO?
    let periodLabel: String
    @State private var isExporting = false
    @State private var exportedPDFURL: URL?
    @State private var showShareSheet = false
    @State private var exportError: String?

    private static let pdfPageWidth: CGFloat = 612 // US Letter, 72pt/inch

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView { reportBody.padding(20) }
            }
            .navigationTitle(innsikt == nil ? "Eksempelrapport" : "Innsiktsrapport")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button { Task { await exportPDF() } } label: {
                        if isExporting {
                            ProgressView().tint(LBrand.purpleLight)
                        } else {
                            Label("Eksporter PDF", systemImage: "square.and.arrow.up")
                        }
                    }
                    .disabled(isExporting)
                }
            }
            .sheet(isPresented: $showShareSheet) {
                if let exportedPDFURL { ShareSheet(items: [exportedPDFURL]) }
            }
            .alert("Kunne ikke eksportere PDF", isPresented: .init(
                get: { exportError != nil }, set: { if !$0 { exportError = nil } }
            )) {
                Button("OK") { exportError = nil }
            } message: {
                Text(exportError ?? "")
            }
        }
    }

    // MARK: - Report content (delt mellom skjerm og PDF-render)

    @ViewBuilder
    private var reportBody: some View {
        if let inn = innsikt {
            realReport(inn)
        } else {
            demoReport
        }
    }

    private func realReport(_ inn: APIClient.LeadbookInnsiktDTO) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Innsiktsrapport").font(.appScaled(size: 22, weight: .heavy)).foregroundStyle(.white)
            Text(periodLabel).font(.appScaled(size: 12)).foregroundStyle(LBrand.textSecondary)

            sectionHeader("EXECUTIVE SUMMARY")
            Text(executiveSummary(inn))
                .font(.appScaled(size: 13)).foregroundStyle(.white)
                .padding(14).background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))

            sectionHeader("NØKKELTALL")
            reportStatGrid(inn)

            if !inn.bySeller.isEmpty {
                sectionHeader("SELGER-LEADERBOARD")
                reportRows(inn.bySeller.prefix(10).map { s in
                    (s.name, "\(s.count) samtaler · \(pondusText(s.avgPondus)) · \(percentText(s.winRate))")
                })
            }
            if !inn.byDimension.isEmpty {
                sectionHeader("PER DIMENSJON")
                reportRows(inn.byDimension.map { ($0.dimension, "\($0.count) · \(pondusText($0.avgPondus))") })
            }
            if !inn.byChannel.isEmpty {
                sectionHeader("PER KANAL")
                reportRows(inn.byChannel.map { c in
                    let decided = c.won + c.lost
                    let rate = decided > 0 ? Double(c.won) / Double(decided) : nil
                    return (c.channel, "\(c.count) · \(percentText(rate)) vunnet")
                })
            }
            if let top = inn.topExample {
                sectionHeader("BESTE EKSEMPEL")
                caseCard(top, tint: LBrand.green)
            }
            if let bottom = inn.bottomExample {
                sectionHeader("LÆRINGSEKSEMPEL")
                caseCard(bottom, tint: LBrand.orange)
            }
            Text("Basert på \(inn.totals.examples) publiserte eksempler i perioden.")
                .font(.appScaled(size: 10)).foregroundStyle(LBrand.textTertiary)
                .padding(.top, 10)
        }
    }

    private var demoReport: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Eksempelrapport").font(.appScaled(size: 22, weight: .heavy)).foregroundStyle(.white)
            Label("Demo-data — ikke faktiske tall for din organisasjon", systemImage: "sparkles")
                .font(.appScaled(size: 11, weight: .semibold)).foregroundStyle(LBrand.purpleLight)
            sectionHeader("EXECUTIVE SUMMARY")
            Text("Pondus-snittet steg fra 78 til 82 i perioden (+5 %). Hovedtrenden er at teamet har internalisert pause-mønsteret etter prisinnvendinger. Vinn-raten følger med, fra 25,2 % til 28,6 %. Møtebooking-malen er klar markedsleder med 41 % konvertering.")
                .font(.appScaled(size: 13)).foregroundStyle(.white)
                .padding(14).background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
            Text("Slå av demo-modus for å se din organisasjons ekte rapport her.")
                .font(.appScaled(size: 11)).foregroundStyle(LBrand.textTertiary)
                .padding(.top, 10)
        }
    }

    // MARK: - Building blocks

    private func sectionHeader(_ t: String) -> some View {
        Text(t).font(.appScaled(size: 11, weight: .black)).foregroundStyle(LBrand.purpleLight).tracking(0.8)
    }

    private func reportStatGrid(_ inn: APIClient.LeadbookInnsiktDTO) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            reportStat("Eksempler", "\(inn.totals.examples)")
            reportStat("Vunnet", "\(inn.totals.won)")
            reportStat("Tapt", "\(inn.totals.lost)")
            reportStat("Pågår", "\(inn.totals.ongoing)")
            reportStat("Snitt Pondus", pondusText(inn.totals.avgPondus))
            reportStat("Vinn-rate", percentText(inn.totals.winRate))
        }
    }

    private func reportStat(_ label: String, _ value: String) -> some View {
        VStack(spacing: 3) {
            Text(value).font(.appScaled(size: 16, weight: .black, design: .rounded)).foregroundStyle(.white)
            Text(label).font(.appScaled(size: 9)).foregroundStyle(LBrand.textSecondary)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 10)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 10))
    }

    private func reportRows(_ rows: [(String, String)]) -> some View {
        VStack(spacing: 6) {
            ForEach(rows, id: \.0) { row in
                HStack {
                    Text(row.0).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
                    Spacer()
                    Text(row.1).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary)
                }
                .padding(10).background(LBrand.card, in: RoundedRectangle(cornerRadius: 9))
            }
        }
    }

    private func caseCard(_ c: APIClient.LeadbookInnsiktDTO.CaseRow, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(c.title).font(.appScaled(size: 12, weight: .bold)).foregroundStyle(.white)
            if let summary = c.summary { Text(summary).font(.appScaled(size: 11)).foregroundStyle(LBrand.textSecondary) }
            if let score = c.pondusScore {
                Text("Pondus \(score)").font(.appScaled(size: 10, weight: .bold)).foregroundStyle(tint)
            }
        }
        .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
        .overlay(RoundedRectangle(cornerRadius: 11).stroke(tint.opacity(0.3), lineWidth: 1))
    }

    // MARK: - Formatting

    private func percentText(_ v: Double?) -> String {
        guard let v else { return "—" }
        let p = v * 100
        return p.truncatingRemainder(dividingBy: 1) == 0 ? "\(Int(p)) %" : String(format: "%.1f %%", p)
    }

    private func pondusText(_ v: Int?) -> String { v.map { "\($0)" } ?? "—" }

    private func executiveSummary(_ inn: APIClient.LeadbookInnsiktDTO) -> String {
        let t = inn.totals, p = inn.previous
        var parts: [String] = []
        if let cur = t.avgPondus, let prev = p.avgPondus, prev > 0 {
            let delta = cur - prev
            parts.append(delta == 0
                ? "Pondus-snittet holdt seg stabilt på \(cur) i perioden."
                : "Pondus-snittet \(delta > 0 ? "steg" : "falt") fra \(prev) til \(cur) (\(delta > 0 ? "+" : "")\(delta)).")
        } else if let cur = t.avgPondus {
            parts.append("Snitt Pondus-score i perioden: \(cur).")
        }
        if let curRate = t.winRate {
            if let prevRate = p.winRate {
                parts.append("Vinn-raten er \(percentText(curRate)), mot \(percentText(prevRate)) forrige periode.")
            } else {
                parts.append("Vinn-raten i perioden er \(percentText(curRate)).")
            }
        }
        if let best = inn.bySeller.max(by: { ($0.winRate ?? 0) < ($1.winRate ?? 0) }) {
            parts.append("\(best.name) leder leaderboardet med \(percentText(best.winRate)) vinn-rate.")
        }
        if parts.isEmpty { parts.append("Ikke nok data ennå til å oppsummere trender for perioden.") }
        return parts.joined(separator: " ")
    }

    // MARK: - PDF export (native ImageRenderer → PDF-context, WWDC22-mønster)
    //
    // «Åpne i Canvas» (ikke bygget ennå — Daniel ba om at veien holdes åpen):
    // `exportedPDFURL` sin Data kan sendes rett til `CanvasView.importerPDFData`
    // (nå internal med vilje). Mangler: navigere til `Destination.canvas`
    // (entitlement-gatet, egen NavigationStack et hakk unna Leadbook) FØR
    // kallet — ikke forsøkt her uten å kunne verifisere navigasjonen live.

    @MainActor
    private func exportPDF() async {
        isExporting = true
        defer { isExporting = false }
        let content = reportBody
            .padding(24)
            .frame(width: Self.pdfPageWidth, alignment: .leading)
            .background(LBrand.bg)
        let renderer = ImageRenderer(content: content)
        renderer.proposedSize = ProposedViewSize(width: Self.pdfPageWidth, height: nil)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("leadbook-innsiktsrapport-\(Int(Date().timeIntervalSince1970)).pdf")

        var didWrite = false
        renderer.render { size, renderInContext in
            var box = CGRect(origin: .zero, size: size)
            guard let consumer = CGDataConsumer(url: url as CFURL),
                  let ctx = CGContext(consumer: consumer, mediaBox: &box, nil) else { return }
            ctx.beginPDFPage(nil)
            renderInContext(ctx)
            ctx.endPDFPage()
            ctx.closePDF()
            didWrite = true
        }
        guard didWrite else {
            exportError = "Kunne ikke opprette PDF-fil."
            return
        }
        exportedPDFURL = url
        showShareSheet = true
    }
}
