// DeepLink.swift
//
// senseaidexplore://poi/{slug}?lang=nb åpnes fra delingssiden
// (backend: GET /api/guide/share/{slug}). URL-skjemaet er registrert i
// project.yml (CFBundleURLTypes). Ren parsing, testes uten UI.

import Foundation

enum DeepLink: Equatable {
    case poi(slug: String, lang: String?)

    static let scheme = "senseaidexplore"

    static func parse(_ url: URL) -> DeepLink? {
        guard url.scheme?.lowercased() == scheme, url.host()?.lowercased() == "poi" else { return nil }
        let slug = url.pathComponents.filter { $0 != "/" }.first?.lowercased() ?? ""
        guard slug.range(of: "^[a-z0-9]+(-[a-z0-9]+)*$", options: .regularExpression) != nil else { return nil }
        let lang = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?.first { $0.name == "lang" }?.value?
            .trimmingCharacters(in: .whitespaces).lowercased()
        return .poi(slug: slug, lang: (lang?.isEmpty ?? true) ? nil : lang)
    }
}
