import Foundation
import CoreLocation

// Computed sun times + live weather for the "I dag" Lys & vær card.
//
// Golden hour + sunset are computed locally (NOAA solar position — no
// network, works offline + in the simulator). Weather is fetched from
// Open-Meteo behind ``WeatherProvider`` so the card works immediately in
// the simulator; a WeatherKit provider can drop in for device builds
// once the WeatherKit capability is enabled (it can't be set via the
// App Store Connect API and doesn't run in the simulator).

// MARK: - Sun times (local NOAA computation)

struct SunTimes: Sendable, Equatable {
    let sunrise: Date?
    let sunset: Date?
    /// Evening golden hour window (sun between +6° and −4°).
    let goldenStart: Date?
    let goldenEnd: Date?
}

enum SunCalc {
    /// Compute sun times for a coordinate + day. All math in UTC; the
    /// returned Dates render in the device's local zone.
    static func times(for date: Date, latitude lat: Double, longitude lon: Double) -> SunTimes {
        SunTimes(
            sunrise: solarEvent(date: date, lat: lat, lon: lon, angle: -0.833, morning: true),
            sunset: solarEvent(date: date, lat: lat, lon: lon, angle: -0.833, morning: false),
            goldenStart: solarEvent(date: date, lat: lat, lon: lon, angle: 6.0, morning: false),
            goldenEnd: solarEvent(date: date, lat: lat, lon: lon, angle: -4.0, morning: false),
        )
    }

    /// Time of day the sun's center hits `angle` degrees elevation.
    /// `morning` selects the rising (true) or setting (false) crossing.
    private static func solarEvent(date: Date, lat: Double, lon: Double, angle: Double, morning: Bool) -> Date? {
        let rad = Double.pi / 180
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let comps = cal.dateComponents([.year, .month, .day], from: date)
        guard let dayStart = cal.date(from: comps) else { return nil }

        // Julian day for the date. `n` must be the INTEGER day count since
        // J2000 (computed at noon) — using the midnight JD (which ends in
        // .5) as a fractional `n` offsets solar noon by ~12h.
        let jdMidnight = dayStart.timeIntervalSince1970 / 86400.0 + 2440587.5
        let n = ((jdMidnight + 0.5) - 2451545.0 + 0.0008).rounded()
        let Jstar = n - lon / 360.0
        let M = (357.5291 + 0.98560028 * Jstar).truncatingRemainder(dividingBy: 360)
        let Mr = M * rad
        let C = 1.9148 * sin(Mr) + 0.0200 * sin(2 * Mr) + 0.0003 * sin(3 * Mr)
        let lambda = (M + C + 180 + 102.9372).truncatingRemainder(dividingBy: 360)
        let lr = lambda * rad
        let Jtransit = 2451545.0 + Jstar + 0.0053 * sin(Mr) - 0.0069 * sin(2 * lr)
        let decl = asin(sin(lr) * sin(23.4397 * rad))

        let cosH = (sin(angle * rad) - sin(lat * rad) * sin(decl)) /
                   (cos(lat * rad) * cos(decl))
        if cosH > 1 || cosH < -1 { return nil } // sun never reaches angle (polar day/night)
        let H = acos(cosH) / rad // degrees
        let Jevent = morning ? Jtransit - H / 360.0 : Jtransit + H / 360.0
        let interval = (Jevent - 2440587.5) * 86400.0
        return Date(timeIntervalSince1970: interval)
    }
}

// MARK: - Weather

struct WeatherNow: Sendable, Equatable {
    let temperatureC: Double
    let code: Int
    let placeName: String?

    /// SF Symbol for the WMO weather code.
    var symbol: String {
        switch code {
        case 0: return "sun.max.fill"
        case 1, 2: return "cloud.sun.fill"
        case 3: return "cloud.fill"
        case 45, 48: return "cloud.fog.fill"
        case 51, 53, 55, 56, 57: return "cloud.drizzle.fill"
        case 61, 63, 65, 66, 67, 80, 81, 82: return "cloud.rain.fill"
        case 71, 73, 75, 77, 85, 86: return "cloud.snow.fill"
        case 95, 96, 99: return "cloud.bolt.rain.fill"
        default: return "cloud.fill"
        }
    }

    /// Norwegian condition label.
    var condition: String {
        switch code {
        case 0: return "Klart"
        case 1: return "Stort sett klart"
        case 2: return "Delvis skyet"
        case 3: return "Overskyet"
        case 45, 48: return "Tåke"
        case 51, 53, 55: return "Yr"
        case 56, 57: return "Underkjølt yr"
        case 61, 63, 65: return "Regn"
        case 66, 67: return "Underkjølt regn"
        case 71, 73, 75, 77: return "Snø"
        case 80, 81, 82: return "Regnbyger"
        case 85, 86: return "Snøbyger"
        case 95, 96, 99: return "Torden"
        default: return "—"
        }
    }
}

protocol WeatherProvider: Sendable {
    func current(latitude: Double, longitude: Double) async throws -> WeatherNow
}

/// Open-Meteo current weather. Free, no API key, works in the simulator.
struct OpenMeteoProvider: WeatherProvider {
    func current(latitude lat: Double, longitude lon: Double) async throws -> WeatherNow {
        var c = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        c.queryItems = [
            .init(name: "latitude", value: String(lat)),
            .init(name: "longitude", value: String(lon)),
            .init(name: "current", value: "temperature_2m,weather_code"),
            .init(name: "timezone", value: "auto")
        ]
        struct Resp: Decodable {
            struct Current: Decodable { let temperature_2m: Double; let weather_code: Int }
            let current: Current
        }
        let (data, response) = try await URLSession.shared.data(from: c.url!)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        let decoded = try JSONDecoder().decode(Resp.self, from: data)
        return WeatherNow(temperatureC: decoded.current.temperature_2m, code: decoded.current.weather_code, placeName: nil)
    }
}

// MARK: - Multi-day forecast (Lys & vær detail)

/// One day's weather (Open-Meteo) + locally computed sun/golden-hour.
struct DailyForecast: Sendable, Identifiable, Equatable {
    var id: Date { date }
    let date: Date
    let code: Int
    let tempMax: Double
    let tempMin: Double
    let sun: SunTimes

    var symbol: String { WeatherNow(temperatureC: 0, code: code, placeName: nil).symbol }
    var condition: String { WeatherNow(temperatureC: 0, code: code, placeName: nil).condition }
}

extension OpenMeteoProvider {
    /// 7-day forecast: weather from Open-Meteo, sun + golden hour computed
    /// locally per day so the photographer can plan light for the week.
    func dailyForecast(latitude lat: Double, longitude lon: Double, days: Int = 7) async throws -> [DailyForecast] {
        var c = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
        c.queryItems = [
            .init(name: "latitude", value: String(lat)),
            .init(name: "longitude", value: String(lon)),
            .init(name: "daily", value: "weather_code,temperature_2m_max,temperature_2m_min"),
            .init(name: "forecast_days", value: String(days)),
            .init(name: "timezone", value: "auto")
        ]
        struct Resp: Decodable {
            struct Daily: Decodable {
                let time: [String]
                let weather_code: [Int]
                let temperature_2m_max: [Double]
                let temperature_2m_min: [Double]
            }
            let daily: Daily
        }
        let (data, response) = try await URLSession.shared.data(from: c.url!)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        let r = try JSONDecoder().decode(Resp.self, from: data)
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        df.timeZone = TimeZone(identifier: "UTC")
        df.locale = Locale(identifier: "en_US_POSIX")
        var out: [DailyForecast] = []
        for i in r.daily.time.indices {
            guard let day = df.date(from: r.daily.time[i]) else { continue }
            out.append(DailyForecast(
                date: day,
                code: r.daily.weather_code[i],
                tempMax: r.daily.temperature_2m_max[i],
                tempMin: r.daily.temperature_2m_min[i],
                sun: SunCalc.times(for: day, latitude: lat, longitude: lon),
            ))
        }
        return out
    }
}

// MARK: - Location

/// One-shot location for sun + weather. Uses the modern async
/// ``CLLocationUpdate.liveUpdates`` (no delegate → Swift 6 clean) and
/// falls back to Oslo when access is denied or location stalls, so the
/// card always shows something useful.
@MainActor
enum LocationProvider {
    nonisolated static let osloFallback = CLLocationCoordinate2D(latitude: 59.9139, longitude: 10.7522)

    static func currentOrFallback() async -> CLLocationCoordinate2D {
        let manager = CLLocationManager()
        switch manager.authorizationStatus {
        case .denied, .restricted:
            return osloFallback
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        default:
            break
        }
        // Use the OS's cached fix when present; otherwise fall back to Oslo
        // (the photographer's home region) so golden hour + weather always
        // render. A precise live fix lands on a later refresh once the OS
        // has one — kept simple + Swift-6 clean, no delegate/hang risk.
        return manager.location?.coordinate ?? osloFallback
    }
}
