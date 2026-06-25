import SwiftUI

/// "Lys & vær denne uken" — tap the I dag weather card to plan light for
/// the week ahead: 7-day weather (Open-Meteo) + golden hour + sunset
/// computed per day. CreatorHub dark.
@MainActor
@Observable
final class LysVaerModel {
    private(set) var days: [DailyForecast] = []
    private(set) var loading = true
    private(set) var errorMessage: String?

    func load() async {
        loading = days.isEmpty
        errorMessage = nil
        let coord = await LocationProvider.currentOrFallback()
        do {
            days = try await OpenMeteoProvider().dailyForecast(latitude: coord.latitude, longitude: coord.longitude)
        } catch {
            if days.isEmpty { errorMessage = "Kunne ikke hente værvarsel." }
        }
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
