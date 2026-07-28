import SwiftUI
import CoreLocation
import MapKit

/// "Lys & vær denne uken" — tap the I dag weather card to plan light for
/// the week ahead: 7-day weather (Open-Meteo) + golden hour + sunset
/// computed per day, PLUS #8 en handlingsrettet «i dag»-plan (golden hour +
/// når regnet gir seg) og shoot-lokasjonen på kart. CreatorHub dark.
@MainActor
@Observable
final class LysVaerModel {
    private(set) var days: [DailyForecast] = []
    private(set) var plan: TodayShootPlan?
    private(set) var coordinate: CLLocationCoordinate2D?
    private(set) var loading = true
    private(set) var errorMessage: String?

    func load() async {
        loading = days.isEmpty
        errorMessage = nil
        let coord = await LocationProvider.currentOrFallback()
        coordinate = coord
        let provider = OpenMeteoProvider()
        do {
            days = try await provider.dailyForecast(latitude: coord.latitude, longitude: coord.longitude)
        } catch {
            if days.isEmpty { errorMessage = "Kunne ikke hente værvarsel." }
        }
        // #8 Dagens plan: golden hour (dag[0]) + når regnet gir seg (timevis).
        let hours = (try? await provider.hourlyPrecipitation(latitude: coord.latitude, longitude: coord.longitude)) ?? []
        plan = TodayShootPlanner.plan(today: days.first, hours: hours, now: Date())
        loading = false
    }
}

struct LysVaerDetailView: View {
    @State private var model = LysVaerModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                if model.loading && model.days.isEmpty {
                    ProgressView("Henter værvarsel…").padding(.top, 40)
                } else if let message = model.errorMessage, model.days.isEmpty {
                    ContentUnavailableView("Ingen værdata", systemImage: "cloud.slash", description: Text(message))
                } else {
                    if let plan = model.plan {
                        TodayPlanCard(plan: plan, coordinate: model.coordinate)
                    }
                    ForEach(model.days) { day in
                        DayRow(day: day)
                    }
                    Text("Golden hour beregnet lokalt fra posisjon + dato · vær fra Open-Meteo")
                        .font(.caption2)
                        .foregroundStyle(CHTheme.textMuted)
                        .padding(.top, 4)
                }
            }
            .padding(16)
        }
        .frame(maxWidth: .infinity)
        .background(CHTheme.bg.ignoresSafeArea())
        .navigationTitle("Lys & vær")
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.load() }
        .refreshable { await model.load() }
    }
}

/// #8 Handlingsrettet «i dag»-kort: beste lys (golden hour), solnedgang, når
/// regnet gir seg, og shoot-lokasjonen på kart.
private struct TodayPlanCard: View {
    let plan: TodayShootPlan
    let coordinate: CLLocationCoordinate2D?

    var body: some View {
        CHCard {
            VStack(alignment: .leading, spacing: 10) {
                Label("I dag", systemImage: "sun.max.fill")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(CHTheme.accent)
                if let gs = plan.goldenStart, let ge = plan.goldenEnd {
                    planRow("sun.haze.fill", "Beste lys \(t(gs))–\(t(ge))", CHTheme.accentSoft)
                } else {
                    planRow("sun.haze", "Golden hour ikke tilgjengelig i dag", CHTheme.textMuted)
                }
                if let sunset = plan.sunset {
                    planRow("sunset.fill", "Solnedgang \(t(sunset))", CHTheme.textSecondary)
                }
                if let rain = plan.rainClearsAt {
                    planRow("cloud.sun.fill", "Regnet gir seg ca \(t(rain))", CHTheme.info)
                }
                if let coordinate {
                    Map(initialPosition: .region(MKCoordinateRegion(
                        center: coordinate, latitudinalMeters: 4000, longitudinalMeters: 4000))) {
                        Marker("Shoot", coordinate: coordinate).tint(CHTheme.accent)
                    }
                    .frame(height: 130)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .allowsHitTesting(false)
                }
            }
        }
    }

    private func planRow(_ icon: String, _ text: String, _ tint: Color) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon).font(.subheadline).foregroundStyle(tint).frame(width: 22)
            Text(text).font(.subheadline.weight(.medium)).foregroundStyle(CHTheme.textPrimary)
            Spacer()
        }
    }

    private func t(_ d: Date) -> String { d.formatted(.dateTime.hour().minute()) }
}

private struct DayRow: View {
    let day: DailyForecast

    var body: some View {
        CHCard {
            HStack(alignment: .center, spacing: 14) {
                // Day
                VStack(alignment: .leading, spacing: 1) {
                    Text(day.date.formatted(.dateTime.weekday(.wide)).capitalized)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(CHTheme.textPrimary)
                    Text(day.date.formatted(.dateTime.day().month(.abbreviated)))
                        .font(.caption).foregroundStyle(CHTheme.textMuted)
                }
                .frame(width: 92, alignment: .leading)

                // Weather
                HStack(spacing: 8) {
                    Image(systemName: day.symbol).foregroundStyle(CHTheme.accent)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("\(Int(day.tempMax.rounded()))° / \(Int(day.tempMin.rounded()))°")
                            .font(.subheadline.monospacedDigit())
                            .foregroundStyle(CHTheme.textPrimary)
                        Text(day.condition).font(.caption2).foregroundStyle(CHTheme.textSecondary).lineLimit(1)
                    }
                }
                .frame(width: 120, alignment: .leading)

                Spacer()

                // Golden hour + sunset
                VStack(alignment: .trailing, spacing: 2) {
                    if let gs = day.sun.goldenStart, let ge = day.sun.goldenEnd {
                        HStack(spacing: 5) {
                            Image(systemName: "sun.haze.fill").font(.caption2).foregroundStyle(CHTheme.accentSoft)
                            Text("\(t(gs))–\(t(ge))")
                                .font(.subheadline.weight(.semibold).monospacedDigit())
                                .foregroundStyle(CHTheme.accentSoft)
                        }
                    } else {
                        Text("Midnattssol / ingen").font(.caption2).foregroundStyle(CHTheme.textMuted)
                    }
                    if let sunset = day.sun.sunset {
                        Text("Solnedgang \(t(sunset))").font(.caption2).foregroundStyle(CHTheme.textMuted)
                    }
                }
            }
        }
    }

    private func t(_ d: Date) -> String { d.formatted(.dateTime.hour().minute()) }
}
