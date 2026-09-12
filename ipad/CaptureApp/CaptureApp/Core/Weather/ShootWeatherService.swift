// ShootWeatherService.swift
//
// Gratis (Apple-konto) WeatherKit-integrasjon for golden hour + vær på shoot-
// lokasjonen. Krever at WeatherKit-capability er aktivert for App ID-en i
// Apple Developer-portalen + entitlement (se project.yml + aktiverings-liste).
//
// Egen navnetype (ShootWeatherService) for ikke å kollidere med Apples
// WeatherService.

import Foundation
import WeatherKit
import CoreLocation

@available(iOS 16.0, *)
struct ShootWeatherService {
    struct Snapshot: Sendable {
        var temperatureC: Double
        var conditionSymbol: String
        var sunrise: Date?
        var sunset: Date?
    }

    func snapshot(at coordinate: CLLocationCoordinate2D) async throws -> Snapshot {
        let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        let weather = try await WeatherService.shared.weather(for: location)
        let today = weather.dailyForecast.first
        return Snapshot(
            temperatureC: weather.currentWeather.temperature.converted(to: .celsius).value,
            conditionSymbol: weather.currentWeather.symbolName,
            sunrise: today?.sun.sunrise,
            sunset: today?.sun.sunset
        )
    }
}
