// LeadbookInnsiktTab.swift — Innsikt-fane: AI-analyse av samtaler, mønstre, trender (2026-07-01)
//
// Hero m/ Marit's ukentlige innsikt, 4 KPI-tiles, pondus-trend-graf, tema-clustring,
// "det som virker / virker ikke", selger-leaderboard, tid-distribusjon, topp/bunn-eksempler.

import SwiftUI
import Charts

struct LeadbookInnsiktView: View {
    @State private var period: Period = .d30
    @State private var sellerFilter: PondusCast?
    @State private var favorited: Bool = true
    @State private var showFullReport = false
    @State private var toast: String?
    @State private var openExample: LeadbookExample?

    enum Period: String, CaseIterable, Identifiable {
        case d7 = "7 dager"
        case d30 = "30 dager"
        case d90 = "90 dager"
        case ytd = "Hittil i år"
        var id: String { rawValue }
    }

    var body: some View {
        VStack(spacing: 14) {
            insiktHeader
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
            Color.clear.frame(height: 20)
        }
        .overlay(alignment: .top) {
            if let t = toast {
                Label(t, systemImage: "checkmark.circle.fill")
                    .font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 8)
                    .background(LBrand.green, in: Capsule())
                    .padding(.top, 6)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: toast)
        .sheet(isPresented: $showFullReport) { FullInsiktReportSheet() }
        .sheet(item: $openExample) { ex in LeadbookExampleDetailSheet(example: ex) }
    }

    // MARK: Header

    private var insiktHeader: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 9) {
                    Text("Leadbook — Innsikt")
                        .font(.system(size: 22, weight: .bold)).foregroundStyle(.white)
                    Button { favorited.toggle() } label: {
                        Image(systemName: favorited ? "star.fill" : "star")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(favorited ? LBrand.yellow : LBrand.textTertiary)
                    }.buttonStyle(.plain)
                    HStack(spacing: 4) {
                        Image(systemName: "sparkles").font(.system(size: 10, weight: .bold))
                        Text("AI-KURATERT").font(.system(size: 9, weight: .black))
                    }
                    .foregroundStyle(LBrand.purpleLight).tracking(0.6)
                    .padding(.horizontal, 7).padding(.vertical, 3)
                    .background(LBrand.purple.opacity(0.18), in: Capsule())
                    .overlay(Capsule().stroke(LBrand.purpleLight.opacity(0.45), lineWidth: 1))
                }
                Text("Pondus-mønstre, tema-clustring og selger-trender — automatisk oppdaget av AI.")
                    .font(.system(size: 12)).foregroundStyle(LBrand.textSecondary)
                    .lineLimit(2)
            }
            Spacer(minLength: 12)
            HStack(spacing: 8) {
                Menu {
                    ForEach(Period.allCases) { p in
                        Button(p.rawValue) { period = p }
                    }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "calendar").font(.system(size: 11, weight: .bold))
                            .foregroundStyle(LBrand.orange)
                        Text(period.rawValue).font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                        Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold))
                            .foregroundStyle(LBrand.textTertiary)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                }
                Button {
                    flash("Ukerapport sendt til team")
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: "paperplane.fill").font(.system(size: 11, weight: .bold))
                        Text("Send rapport").font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 9)
                    .background(LBrand.cardHi, in: RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(LBrand.stroke, lineWidth: 1))
                }.buttonStyle(.plain)
                Button { showFullReport = true } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "doc.text.fill").font(.system(size: 11, weight: .bold))
                        Text("Full rapport").font(.system(size: 13, weight: .bold))
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

    // MARK: Marit-hero

    private var maritHeroCard: some View {
        HStack(alignment: .top, spacing: 16) {
            SmartPortrait(assetName: "portrait-marit")
                .frame(width: 72, height: 72)
                .overlay(Circle().stroke(LBrand.purpleLight.opacity(0.5), lineWidth: 2))
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text("MARIT'S UKENTLIGE INNSIKT")
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(LBrand.purpleLight).tracking(0.8)
                    Text("·").foregroundStyle(LBrand.textTertiary)
                    Text("OPPDATERT 1. JULI")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                }
                Text("Maria's 4-sekunders pause på pris-innvendinger driver pondus opp 8 poeng denne uka")
                    .font(.system(size: 17, weight: .heavy))
                    .foregroundStyle(.white)
                    .lineLimit(3)
                Text("Hun har gjentatt mønsteret 11 ganger på 14 samtaler. To andre i teamet har begynt å imitere — pondus-snitt steg fra 78 til 82 på 7 dager. Rull ut som «mester-mønster» til hele teamet?")
                    .font(.system(size: 13))
                    .foregroundStyle(LBrand.textSecondary)
                    .lineLimit(3)
                HStack(spacing: 8) {
                    Button {
                        flash("Mester-mønster delt med teamet")
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "person.3.fill").font(.system(size: 11, weight: .bold))
                            Text("Rull ut til team").font(.system(size: 12, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(LBrand.green, in: Capsule())
                    }.buttonStyle(.plain)
                    Button {} label: {
                        HStack(spacing: 5) {
                            Image(systemName: "play.fill").font(.system(size: 10, weight: .bold))
                            Text("Hør Maria's samtale").font(.system(size: 12, weight: .semibold))
                        }
                        .foregroundStyle(LBrand.purpleLight)
                        .padding(.horizontal, 11).padding(.vertical, 7)
                        .background(LBrand.purple.opacity(0.18), in: Capsule())
                        .overlay(Capsule().stroke(LBrand.purple.opacity(0.4), lineWidth: 1))
                    }.buttonStyle(.plain)
                }
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
                Image(systemName: icon).font(.system(size: 12, weight: .bold)).foregroundStyle(tint)
                Text(label).font(.system(size: 9, weight: .black))
                    .foregroundStyle(LBrand.textTertiary).tracking(0.6)
                    .lineLimit(1).minimumScaleFactor(0.8)
            }
            Text(value).font(.system(size: valueSize, weight: .heavy, design: .rounded))
                .foregroundStyle(.white).monospacedDigit()
                .lineLimit(1).minimumScaleFactor(0.7)
            HStack(spacing: 4) {
                Image(systemName: "arrow.up.right").font(.system(size: 9, weight: .bold))
                Text(trend).font(.system(size: 10, weight: .bold, design: .rounded))
                Text("vs forrige periode").font(.system(size: 9))
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
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                    Text("Per selger · siste 30 dager")
                        .font(.system(size: 11)).foregroundStyle(LBrand.textSecondary)
                }
                Spacer()
                Text("+12 %").font(.system(size: 14, weight: .bold, design: .rounded))
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
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                    Text("AI grupperer samtaler automatisk")
                        .font(.system(size: 11)).foregroundStyle(LBrand.textSecondary)
                }
                Spacer()
                Image(systemName: "sparkles").foregroundStyle(LBrand.purpleLight)
            }
            VStack(spacing: 6) {
                ForEach(temaer.prefix(6)) { tema in
                    HStack(spacing: 10) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 7).fill(tema.tint.opacity(0.22))
                            Image(systemName: tema.icon).font(.system(size: 11, weight: .bold))
                                .foregroundStyle(tema.tint)
                        }
                        .frame(width: 28, height: 28)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(tema.name).font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                            Text("\(tema.count) samtaler").font(.system(size: 9))
                                .foregroundStyle(LBrand.textTertiary)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 1) {
                            Text(percent(tema.conversion))
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundStyle(.white).monospacedDigit()
                            HStack(spacing: 2) {
                                Image(systemName: tema.trend >= 0 ? "arrow.up" : "arrow.down")
                                    .font(.system(size: 7, weight: .black))
                                Text(percent(abs(tema.trend)))
                                    .font(.system(size: 9, weight: .bold, design: .rounded)).monospacedDigit()
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
                    .font(.system(size: 10, weight: .black))
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
                    .font(.system(size: 10, weight: .black))
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
            Image(systemName: icon).font(.system(size: 12, weight: .bold))
                .foregroundStyle(color).frame(width: 18)
            VStack(alignment: .leading, spacing: 2) {
                Text(text).font(.system(size: 12, weight: .semibold)).foregroundStyle(.white)
                Text(impact)
                    .font(.system(size: 10, weight: .bold, design: .rounded))
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
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                    Text("Pondus + konvertering · siste \(period.rawValue.lowercased())")
                        .font(.system(size: 11)).foregroundStyle(LBrand.textSecondary)
                }
                Spacer()
                Button {} label: {
                    HStack(spacing: 4) {
                        Text("Se alle").font(.system(size: 11, weight: .semibold))
                        Image(systemName: "arrow.up.right").font(.system(size: 9, weight: .bold))
                    }.foregroundStyle(LBrand.purpleLight)
                }.buttonStyle(.plain)
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
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
                    .foregroundStyle(rank == 1 ? LBrand.yellow : LBrand.textSecondary)
                if rank == 1 {
                    Image(systemName: "crown.fill")
                        .font(.system(size: 8, weight: .black))
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
                    .font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                Text("\(seller.calls) samtaler · \(percent(seller.conversion)) konvertering")
                    .font(.system(size: 10)).foregroundStyle(LBrand.textSecondary)
            }
            Spacer()
            HStack(spacing: 8) {
                VStack(alignment: .trailing, spacing: 1) {
                    Text("\(seller.pondus)")
                        .font(.system(size: 18, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white).monospacedDigit()
                    Text("PONDUS").font(.system(size: 7, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.5)
                }
                HStack(spacing: 2) {
                    Image(systemName: seller.trend >= 0 ? "arrow.up" : "arrow.down")
                        .font(.system(size: 8, weight: .black))
                    Text("\(abs(seller.trend))")
                        .font(.system(size: 10, weight: .bold, design: .rounded)).monospacedDigit()
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
                        .font(.system(size: 10, weight: .black))
                        .foregroundStyle(LBrand.textTertiary).tracking(0.8)
                    Text("kl. 10–11 vinner stort — book viktige samtaler der")
                        .font(.system(size: 11)).foregroundStyle(LBrand.purpleLight)
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
                                .font(.system(size: 9))
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
                            Text(label).font(.system(size: 9, weight: .black))
                                .foregroundStyle(tint).tracking(0.6)
                        }
                        Text(ex.title)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        HStack(spacing: 8) {
                            Text("Pondus")
                                .font(.system(size: 10)).foregroundStyle(LBrand.textTertiary)
                            Text("\(ex.pondusScore)")
                                .font(.system(size: 22, weight: .heavy, design: .rounded))
                                .foregroundStyle(tint)
                                .monospacedDigit()
                            Spacer()
                            HStack(spacing: 4) {
                                Image(systemName: ex.outcome.icon).font(.system(size: 9, weight: .bold))
                                Text(ex.outcome.rawValue.uppercased())
                                    .font(.system(size: 9, weight: .black))
                            }
                            .foregroundStyle(.white)
                            .padding(.horizontal, 7).padding(.vertical, 3)
                            .background(ex.outcome.color, in: Capsule())
                        }
                        Text(ex.summary).font(.system(size: 11))
                            .foregroundStyle(LBrand.textSecondary)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        HStack(spacing: 5) {
                            Image(systemName: "arrow.right.circle.fill").font(.system(size: 11))
                            Text("Spill av samtalen").font(.system(size: 11, weight: .bold))
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

struct FullInsiktReportSheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                LBrand.bg.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Full insikt-rapport").font(.system(size: 22, weight: .heavy))
                            .foregroundStyle(.white)
                        Text("Q2 2026 · Leadgrid AS")
                            .font(.system(size: 12)).foregroundStyle(LBrand.textSecondary)
                        Text("📈 EXECUTIVE SUMMARY")
                            .font(.system(size: 11, weight: .black))
                            .foregroundStyle(LBrand.purpleLight).tracking(0.8)
                        Text("Pondus-snittet steg fra 78 til 82 i Q2 (+5 %). Hovedtrenden er at teamet har internalisert pause-mønsteret etter prisinnvendinger. Vinn-raten følger med, fra 25,2 % til 28,6 %. Møtebooking-malen er klar markedsleder med 41 % konvertering.")
                            .font(.system(size: 13))
                            .foregroundStyle(.white)
                            .padding(14)
                            .background(LBrand.card, in: RoundedRectangle(cornerRadius: 11))
                        Text("Hele rapporten porteres til PDF-eksport i prod. Her er bare en placeholder for å vise modal-mønsteret.")
                            .font(.system(size: 11)).foregroundStyle(LBrand.textTertiary)
                            .padding(.top, 30)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Q2-rapport")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Lukk") { dismiss() }.tint(LBrand.textSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {} label: {
                        HStack(spacing: 5) {
                            Image(systemName: "square.and.arrow.up").font(.system(size: 11))
                            Text("Eksporter PDF").font(.system(size: 12, weight: .bold))
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(
                            LinearGradient(colors: [LBrand.purple, LBrand.purpleLight],
                                           startPoint: .leading, endPoint: .trailing),
                            in: Capsule()
                        )
                    }.buttonStyle(.plain)
                }
            }
        }
    }
}
