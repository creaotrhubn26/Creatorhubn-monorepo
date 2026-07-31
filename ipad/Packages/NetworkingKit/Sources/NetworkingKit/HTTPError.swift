import Foundation

/// Feil fra et HTTP-kall, i den formen kallstedene faktisk trenger å skille på.
///
/// `unauthorized` og `notFound` er skilt ut fra `httpStatus` fordi de nesten
/// alltid behandles ulikt: den første betyr «logg inn på nytt», den andre
/// «raden er borte» — mens en generisk 500 betyr «prøv igjen senere».
public enum HTTPError: Error, Sendable, Equatable {
    /// 401 eller 403.
    case unauthorized
    /// 404.
    case notFound
    /// Andre ikke-2xx. Body tas med fordi backend legger årsaken der.
    case httpStatus(Int, body: String?)
    /// Svaret kom, men lot seg ikke dekode til forventet type.
    case decode(String)
    /// Kallet kom aldri fram — nettverk, DNS, timeout.
    case transport(String)
    /// Klienten mangler oppsett (base-URL, token).
    case notConfigured
}
